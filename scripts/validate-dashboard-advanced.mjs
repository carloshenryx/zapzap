import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function extractFirstNumericAnswer(customAnswers) {
  if (!customAnswers || typeof customAnswers !== 'object') return null;
  const values = Object.values(customAnswers);
  for (const v of values) {
    if (isFiniteNumber(v)) return v;
  }
  return null;
}

function normalizeTo10(raw) {
  if (!isFiniteNumber(raw)) return null;
  const value = Math.max(0, raw);
  if (value <= 5) return value * 2;
  if (value <= 10) return value;
  if (value <= 100) return value / 10;
  return null;
}

function getUnifiedScore10(response) {
  const raw = isFiniteNumber(response?.overall_rating)
    ? response.overall_rating
    : extractFirstNumericAnswer(response?.custom_answers);
  return normalizeTo10(raw);
}

function getUnifiedScore5(response) {
  const s10 = getUnifiedScore10(response);
  if (!isFiniteNumber(s10)) return null;
  return s10 / 2;
}

function getResponseDate(response) {
  const raw = response?.created_at || response?.created_date;
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function applyAdvancedFilters(items, filters) {
  const {
    selectedTemplate = 'all',
    dateStart = '',
    dateEnd = '',
    ratingMin = 0,
    ratingMax = 5,
    npsSegment = 'all',
  } = filters || {};

  const isRatingFilterActive = Number(ratingMin) !== 0 || Number(ratingMax) !== 5;
  const startDate = dateStart ? new Date(dateStart) : null;
  if (startDate) startDate.setHours(0, 0, 0, 0);
  const endDate = dateEnd ? new Date(dateEnd) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  return items.filter((response) => {
    if (selectedTemplate !== 'all') {
      if (response.template_id !== selectedTemplate) return false;
    }

    const responseDate = getResponseDate(response);
    if (startDate && responseDate && responseDate < startDate) return false;
    if (endDate && responseDate && responseDate > endDate) return false;

    const score5 = getUnifiedScore5(response);
    if (isRatingFilterActive && score5 === null) return false;
    if (score5 !== null && (score5 < Number(ratingMin) || score5 > Number(ratingMax))) return false;

    if (npsSegment !== 'all') {
      const score10 = getUnifiedScore10(response);
      if (score10 === null) return false;
      if (npsSegment === 'promoters' && score10 < 9) return false;
      if (npsSegment === 'passives' && (score10 < 7 || score10 > 8)) return false;
      if (npsSegment === 'detractors' && score10 > 6) return false;
    }

    return true;
  });
}

function applyPeriodFilter(allResponses, periodConfig) {
  const {
    selectedPeriod = 'all',
    customStart = '',
    customEnd = '',
    periodDateMode = 'dashboard',
  } = periodConfig || {};

  if (!allResponses.length) return [];

  const now = new Date();
  let startDate = new Date(0);

  switch (selectedPeriod) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
      break;
    }
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      if (customStart) startDate = new Date(customStart);
      break;
    case 'all':
    default:
      return allResponses;
  }

  let endDate = now;
  if (selectedPeriod === 'custom' && customEnd) {
    endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);
  }

  return allResponses.filter((r) => {
    const raw = periodDateMode === 'dashboard' ? r.created_at : (r.created_at || r.created_date);
    if (!raw) return false;
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return false;
    return d >= startDate && d <= endDate;
  });
}

function computeDashboardKPIs(filteredResponsesForMetrics) {
  const total = filteredResponsesForMetrics.length;
  const withRating = filteredResponsesForMetrics.filter((r) => getUnifiedScore10(r) !== null);

  const avgOverall = withRating.length > 0
    ? (withRating.reduce((sum, r) => sum + (getUnifiedScore5(r) || 0), 0) / withRating.length)
    : 0;

  const recommendRate = total > 0
    ? Math.round((filteredResponsesForMetrics.filter((r) => r.would_recommend).length / total) * 100)
    : 0;

  const fiveStarCount = withRating.filter((r) => (getUnifiedScore5(r) || 0) >= 4.5).length;

  const satisfactionBuckets = {
    rating5: withRating.filter((r) => (getUnifiedScore5(r) || 0) >= 4.5).length,
    rating4: withRating.filter((r) => {
      const s = getUnifiedScore5(r);
      return s !== null && s >= 3.5 && s < 4.5;
    }).length,
    rating3: withRating.filter((r) => {
      const s = getUnifiedScore5(r);
      return s !== null && s >= 2.5 && s < 3.5;
    }).length,
    ratingLow: withRating.filter((r) => {
      const s = getUnifiedScore5(r);
      return s !== null && s < 2.5;
    }).length,
  };

  const promoters = withRating.filter((r) => (getUnifiedScore10(r) || 0) >= 9);
  const passives = withRating.filter((r) => {
    const s = getUnifiedScore10(r);
    return s !== null && s >= 7 && s <= 8;
  });
  const detractors = withRating.filter((r) => (getUnifiedScore10(r) || 0) <= 6);

  const nps = withRating.length > 0 ? Math.round(((promoters.length - detractors.length) / withRating.length) * 100) : 0;
  const detractorsPercent = withRating.length > 0 ? Math.round((detractors.length / withRating.length) * 100) : 0;
  const promotersPercent = withRating.length > 0 ? Math.round((promoters.length / withRating.length) * 100) : 0;

  const surveyCountBySource = {
    total,
    manual_whatsapp: filteredResponsesForMetrics.filter((r) => r.source === 'manual_whatsapp').length,
    webhook: filteredResponsesForMetrics.filter((r) => r.source === 'webhook').length,
    totem: filteredResponsesForMetrics.filter((r) => r.source === 'totem').length,
    qrcode: filteredResponsesForMetrics.filter((r) => r.source === 'qrcode').length,
    clicktotem: filteredResponsesForMetrics.filter((r) => r.source === 'clicktotem').length,
  };

  return {
    totalResponses: total,
    responsesWithRating: withRating.length,
    avgOverall: Number(avgOverall.toFixed(1)),
    recommendRate,
    fiveStarCount,
    satisfactionBuckets,
    promoters: promoters.length,
    passives: passives.length,
    detractors: detractors.length,
    nps,
    detractorsPercent,
    promotersPercent,
    surveyCountBySource,
  };
}

function auditInputData(responses) {
  const issues = {
    total: responses.length,
    missingCreatedAtOrDate: 0,
    invalidDate: 0,
    missingTemplateId: 0,
    missingSource: 0,
    ratingNull: 0,
    ratingOutOfExpectedRange: 0,
    wouldRecommendMissing: 0,
    customAnswersNotObject: 0,
    createdAtVsCreatedDateMismatch: 0,
  };

  const sourceCounts = {};
  const ratingHistogram10 = {};
  const examples = {
    missingCreatedAtOrDate: [],
    invalidDate: [],
    missingTemplateId: [],
    missingSource: [],
    ratingNull: [],
    ratingOutOfExpectedRange: [],
    wouldRecommendMissing: [],
    customAnswersNotObject: [],
    createdAtVsCreatedDateMismatch: [],
  };

  const pushExample = (key, id) => {
    if (!id) return;
    if (!examples[key]) return;
    if (examples[key].length >= 5) return;
    examples[key].push(id);
  };

  for (const r of responses) {
    const id = r.id || r.response_id || null;
    const d = getResponseDate(r);
    if (!r.created_at && !r.created_date) {
      issues.missingCreatedAtOrDate++;
      pushExample('missingCreatedAtOrDate', id);
    }
    if ((r.created_at || r.created_date) && !d) {
      issues.invalidDate++;
      pushExample('invalidDate', id);
    }
    if (!r.template_id) {
      issues.missingTemplateId++;
      pushExample('missingTemplateId', id);
    }
    if (!r.source) {
      issues.missingSource++;
      pushExample('missingSource', id);
    }

    if (r.created_at && r.created_date) {
      const d1 = new Date(r.created_at);
      const d2 = new Date(r.created_date);
      if (Number.isFinite(d1.getTime()) && Number.isFinite(d2.getTime())) {
        const deltaMs = Math.abs(d1.getTime() - d2.getTime());
        if (deltaMs > 60_000) {
          issues.createdAtVsCreatedDateMismatch++;
          pushExample('createdAtVsCreatedDateMismatch', id);
        }
      }
    }

    const score10 = getUnifiedScore10(r);
    if (score10 === null) {
      issues.ratingNull++;
      pushExample('ratingNull', id);
    } else {
      const bucket = String(Math.round(score10));
      ratingHistogram10[bucket] = (ratingHistogram10[bucket] || 0) + 1;
      if (score10 < 0 || score10 > 10) {
        issues.ratingOutOfExpectedRange++;
        pushExample('ratingOutOfExpectedRange', id);
      }
    }

    if (typeof r.would_recommend === 'undefined' || r.would_recommend === null) {
      issues.wouldRecommendMissing++;
      pushExample('wouldRecommendMissing', id);
    }

    if (r.custom_answers && typeof r.custom_answers !== 'object') {
      issues.customAnswersNotObject++;
      pushExample('customAnswersNotObject', id);
    }

    const s = r.source || 'null';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }

  return { issues, examples, sourceCounts, ratingHistogram10 };
}

function computeCompletionRate(responses, templates) {
  const activeTemplate = (templates || []).find((t) => t.is_active) || (templates || [])[0] || null;
  if (!activeTemplate || !Array.isArray(activeTemplate.questions)) {
    return { available: false, reason: 'no_active_template' };
  }

  const totalQuestions = activeTemplate.questions.length;
  const completedResponses = (responses || []).filter((r) => {
    const answeredQuestions = Object.keys(r.custom_answers || {}).length;
    return answeredQuestions === totalQuestions;
  });
  const partialResponses = (responses || []).filter((r) => {
    const answeredQuestions = Object.keys(r.custom_answers || {}).length;
    return answeredQuestions > 0 && answeredQuestions < totalQuestions;
  });
  const abandonedResponses = (responses || []).length - completedResponses.length - partialResponses.length;
  const completionRate = (responses || []).length > 0
    ? Number(((completedResponses.length / (responses || []).length) * 100).toFixed(1))
    : 0;

  return {
    available: true,
    activeTemplateId: activeTemplate.id,
    totalQuestions,
    totalResponses: (responses || []).length,
    completed: completedResponses.length,
    partial: partialResponses.length,
    abandoned: abandonedResponses,
    completionRate,
  };
}

function computeQuestionDistribution(responses, templates) {
  const activeTemplate = (templates || []).find((t) => t.is_active) || (templates || [])[0] || null;
  if (!activeTemplate || !Array.isArray(activeTemplate.questions) || activeTemplate.questions.length === 0) {
    return { available: false, reason: 'no_questions' };
  }

  const question = activeTemplate.questions[0];
  const answerCounts = {};
  for (const response of responses || []) {
    const answer = response.custom_answers?.[question.id];
    if (answer !== undefined && answer !== null && answer !== '') {
      const key = String(answer);
      answerCounts[key] = (answerCounts[key] || 0) + 1;
    }
  }

  const entries = Object.entries(answerCounts).map(([answer, count]) => ({ answer, count }))
    .sort((a, b) => b.count - a.count);

  return {
    available: true,
    activeTemplateId: activeTemplate.id,
    questionId: question.id,
    questionType: question.type,
    questionText: question.question,
    totalAnswered: entries.reduce((sum, e) => sum + e.count, 0),
    topAnswers: entries.slice(0, 10),
  };
}

function analyzeSentiment(text) {
  if (!text) return 'neutral';
  const lowerText = String(text).toLowerCase();
  const positiveWords = ['excelente', 'ótimo', 'bom', 'maravilhoso', 'incrível', 'perfeito', 'adorei', 'amei', 'fantástico', 'satisfeito', 'feliz', 'legal', 'top', 'parabéns'];
  const negativeWords = ['ruim', 'péssimo', 'horrível', 'terrível', 'insatisfeito', 'decepção', 'problema', 'demorado', 'lento', 'caro', 'sujo', 'frio', 'mal'];

  const positiveCount = positiveWords.filter((w) => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => lowerText.includes(w)).length;
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function computeSentiment(responses) {
  const comments = (responses || [])
    .filter((r) => r.comment && String(r.comment).trim())
    .map((r) => ({ id: r.id, comment: r.comment, sentiment: analyzeSentiment(r.comment) }));

  const positive = comments.filter((c) => c.sentiment === 'positive').length;
  const neutral = comments.filter((c) => c.sentiment === 'neutral').length;
  const negative = comments.filter((c) => c.sentiment === 'negative').length;

  return {
    totalComments: comments.length,
    positive,
    neutral,
    negative,
    positivePercent: comments.length ? Math.round((positive / comments.length) * 100) : 0,
    neutralPercent: comments.length ? Math.round((neutral / comments.length) * 100) : 0,
    negativePercent: comments.length ? Math.round((negative / comments.length) * 100) : 0,
  };
}

function extractKeywords(comments) {
  const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'em', 'no', 'na', 'para', 'com', 'por', 'sem', 'sob', 'sobre', 'que', 'foi', 'ser', 'ter', 'mais', 'muito', 'bem', 'está', 'são', 'foi', 'tem', 'mas', 'meu', 'sua', 'seu'];
  const wordFrequency = {};

  for (const comment of comments) {
    const words = String(comment)
      .toLowerCase()
      .replace(/[^\wáàâãéèêíïóôõöúçñ\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.includes(w));

    for (const word of words) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  }

  return Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));
}

function computeKeywords(responses) {
  const positiveComments = (responses || [])
    .filter((r) => r.comment && r.overall_rating >= 4)
    .map((r) => r.comment);

  const negativeComments = (responses || [])
    .filter((r) => r.comment && r.overall_rating < 3)
    .map((r) => r.comment);

  return {
    totalPositiveComments: positiveComments.length,
    totalNegativeComments: negativeComments.length,
    positiveTop: extractKeywords(positiveComments),
    negativeTop: extractKeywords(negativeComments),
  };
}

function computeQuestionBreakdown(responses, templates) {
  const activeTemplate = (templates || []).find((t) => t.is_active) || (templates || [])[0] || null;
  if (!activeTemplate || !Array.isArray(activeTemplate.questions)) {
    return { available: false, reason: 'no_active_template' };
  }

  const result = [];
  for (const question of activeTemplate.questions) {
    const questionId = question.id;
    const questionResponses = (responses || [])
      .filter((r) => r.custom_answers && r.custom_answers[questionId])
      .map((r) => r.custom_answers[questionId]);

    const base = {
      questionId,
      question: question.question,
      type: question.type,
      totalResponses: questionResponses.length,
    };

    if (question.type === 'stars' || question.type === 'rating') {
      const numericResponses = questionResponses.filter((v) => typeof v === 'number');
      const avg = numericResponses.length
        ? Number((numericResponses.reduce((sum, v) => sum + v, 0) / numericResponses.length).toFixed(1))
        : 0;
      const distribution = {};
      const maxRating = question.type === 'stars' ? 5 : 10;
      for (let i = 1; i <= maxRating; i++) {
        distribution[i] = numericResponses.filter((v) => v === i).length;
      }
      result.push({ ...base, avg, distribution });
    } else if (question.type === 'boolean') {
      const yesCount = questionResponses.filter((v) => v === true || v === 'Sim').length;
      const noCount = questionResponses.filter((v) => v === false || v === 'Não').length;
      result.push({ ...base, yes: yesCount, no: noCount });
    } else if (question.type === 'text') {
      result.push({ ...base, sample: questionResponses.slice(0, 5) });
    } else {
      result.push(base);
    }
  }

  return { available: true, activeTemplateId: activeTemplate.id, questions: result };
}

function groupByPeriodForTrend(responses, periodType) {
  const groups = {};

  for (const response of responses || []) {
    const created = response.created_at || response.created_date;
    if (!created) continue;
    let date;
    try {
      date = parseISO(created);
    } catch {
      date = new Date(created);
    }
    if (!Number.isFinite(date.getTime())) continue;

    let key;
    if (periodType === 'day') {
      key = format(date, 'dd/MM', { locale: ptBR });
    } else if (periodType === 'week') {
      key = format(startOfWeek(date), 'dd/MM', { locale: ptBR });
    } else {
      key = format(startOfMonth(date), 'MMM/yy', { locale: ptBR });
    }

    if (!groups[key]) groups[key] = { score10: [], score5: [], total: 0 };
    groups[key].total += 1;

    const s10 = getUnifiedScore10(response);
    const s5 = getUnifiedScore5(response);
    if (s10 !== null) groups[key].score10.push(s10);
    if (s5 !== null) groups[key].score5.push(s5);
  }

  const rows = Object.entries(groups).map(([period, data]) => {
    const promoters = data.score10.filter((s) => s >= 9).length;
    const detractors = data.score10.filter((s) => s <= 6).length;
    const nps = data.score10.length > 0 ? ((promoters - detractors) / data.score10.length) * 100 : 0;
    const csat = data.score5.length > 0 ? (data.score5.filter((s) => s >= 4).length / data.score5.length) * 100 : 0;
    return {
      period,
      nps: Number(nps.toFixed(1)),
      csat: Number(csat.toFixed(1)),
      total: data.total,
    };
  });

  return rows.sort((a, b) => a.period.localeCompare(b.period));
}

function computeTrend(responses) {
  return {
    day: groupByPeriodForTrend(responses, 'day'),
    week: groupByPeriodForTrend(responses, 'week'),
    month: groupByPeriodForTrend(responses, 'month'),
  };
}

async function computeVoucherAnalytics(supabase, tenantId, templates) {
  try {
    const { data: vouchers, error: vouchersError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('tenant_id', tenantId);
    if (vouchersError) throw vouchersError;

    const { data: usage, error: usageError } = await supabase
      .from('voucher_usage')
      .select('*')
      .eq('tenant_id', tenantId);
    if (usageError) throw usageError;

    const totalIssued = (usage || []).length;
    const redeemed = (usage || []).filter((u) => u.redeemed).length;
    const redemptionRate = totalIssued ? Number(((redeemed / totalIssued) * 100).toFixed(1)) : 0;

    const voucherStats = (vouchers || []).map((v) => {
      const vu = (usage || []).filter((u) => u.voucher_id === v.id);
      const vRedeemed = vu.filter((u) => u.redeemed).length;
      return {
        id: v.id,
        name: v.name,
        totalUsages: vu.length,
        redeemed: vRedeemed,
        redemptionRate: vu.length ? Number(((vRedeemed / vu.length) * 100).toFixed(1)) : 0,
      };
    }).sort((a, b) => b.totalUsages - a.totalUsages).slice(0, 3);

    const templatesWithLimits = (templates || []).filter((t) => t.usage_limit?.enabled);
    const templatesNearLimit = templatesWithLimits.filter((t) => {
      const usagePct = (t.usage_limit.current_uses || 0) / (t.usage_limit.max_uses || 1);
      return usagePct >= 0.8;
    }).map((t) => ({
      id: t.id,
      name: t.name,
      current_uses: t.usage_limit.current_uses || 0,
      max_uses: t.usage_limit.max_uses || 0,
    }));

    return {
      available: true,
      totalIssued,
      redeemed,
      redemptionRate,
      topVouchers: voucherStats,
      templatesNearLimit,
    };
  } catch (error) {
    return { available: false, error: error?.message || String(error) };
  }
}

async function resolveDefaultTenantId(supabase) {
  const { data: rated, error: ratedError } = await supabase
    .from('survey_responses')
    .select('tenant_id')
    .not('tenant_id', 'is', null)
    .not('overall_rating', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (ratedError) throw ratedError;
  if (rated?.[0]?.tenant_id) return rated[0].tenant_id;

  const { data, error } = await supabase
    .from('survey_responses')
    .select('tenant_id')
    .not('tenant_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.tenant_id || null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(process.cwd());
  const envFromFile = readEnvFile(path.join(repoRoot, '.env.local'));

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || envFromFile.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envFromFile.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tenantId = args.tenant || await resolveDefaultTenantId(supabase);
  if (!tenantId) throw new Error('Could not resolve tenant_id. Use --tenant <UUID>.');

  const limit = Number(args.limit || 1000);
  const { data: responses, error: responsesError } = await supabase
    .from('survey_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (responsesError) throw responsesError;

  const { data: templates, error: templatesError } = await supabase
    .from('survey_templates')
    .select('*')
    .eq('tenant_id', tenantId);
  if (templatesError) throw templatesError;

  const periodConfig = {
    selectedPeriod: args.period || 'all',
    customStart: args['period-start'] || '',
    customEnd: args['period-end'] || '',
    periodDateMode: args['period-date-mode'] || 'dashboard',
  };

  const responsesAfterPeriod = applyPeriodFilter(responses || [], periodConfig);
  const audit = auditInputData(responsesAfterPeriod);

  const filters = {
    selectedTemplate: args.template || 'all',
    dateStart: args.start || '',
    dateEnd: args.end || '',
    ratingMin: args.min ?? 0,
    ratingMax: args.max ?? 5,
    npsSegment: args.nps || 'all',
  };

  const filteredResponsesForMetrics = applyAdvancedFilters(responsesAfterPeriod || [], filters);
  const kpis = computeDashboardKPIs(filteredResponsesForMetrics);
  const completion_periodOnly = computeCompletionRate(responsesAfterPeriod, templates || []);
  const completion_filtered = computeCompletionRate(filteredResponsesForMetrics, templates || []);
  const questionDistribution_periodOnly = computeQuestionDistribution(responsesAfterPeriod, templates || []);
  const questionDistribution_filtered = computeQuestionDistribution(filteredResponsesForMetrics, templates || []);
  const sentiment_periodOnly = computeSentiment(responsesAfterPeriod);
  const sentiment_filtered = computeSentiment(filteredResponsesForMetrics);
  const keywords_periodOnly = computeKeywords(responsesAfterPeriod);
  const keywords_filtered = computeKeywords(filteredResponsesForMetrics);
  const questionBreakdown_periodOnly = computeQuestionBreakdown(responsesAfterPeriod, templates || []);
  const questionBreakdown_filtered = computeQuestionBreakdown(filteredResponsesForMetrics, templates || []);
  const trend_periodOnly = computeTrend(responsesAfterPeriod);
  const trend_filtered = computeTrend(filteredResponsesForMetrics);
  const vouchersAnalytics = await computeVoucherAnalytics(supabase, tenantId, templates || []);

  const output = {
    tenant_id: tenantId,
    fetched: { responses: (responses || []).length, templates: (templates || []).length },
    period: periodConfig,
    filters,
    audit,
    dashboard_advanced_kpis: kpis,
    advanced_cards: {
      completionRate: { periodOnly: completion_periodOnly, filtered: completion_filtered },
      questionDistribution: { periodOnly: questionDistribution_periodOnly, filtered: questionDistribution_filtered },
      sentiment: { periodOnly: sentiment_periodOnly, filtered: sentiment_filtered },
      keywords: { periodOnly: keywords_periodOnly, filtered: keywords_filtered },
      questionBreakdown: { periodOnly: questionBreakdown_periodOnly, filtered: questionBreakdown_filtered },
      trend: { periodOnly: trend_periodOnly, filtered: trend_filtered },
      voucherFallback: vouchersAnalytics,
    },
  };

  if (args['dump-templates']) {
    output.templates = (templates || []).map((t) => ({
      id: t.id,
      name: t.name,
      is_active: t.is_active,
      created_at: t.created_at || t.created_date || null,
    }));
  }

  const asJson = args.json || false;
  const outputJson = JSON.stringify(output, null, 2);

  if (args.out && typeof args.out === 'string') {
    const outPath = path.isAbsolute(args.out) ? args.out : path.join(repoRoot, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, outputJson);
  }

  if (asJson) {
    process.stdout.write(outputJson);
  } else {
    process.stdout.write(`tenant_id: ${tenantId}\n`);
    process.stdout.write(`responses_fetched: ${(responses || []).length}\n`);
    process.stdout.write(`responses_after_period: ${responsesAfterPeriod.length}\n`);
    process.stdout.write(`responses_after_filters: ${filteredResponsesForMetrics.length}\n`);
    process.stdout.write(`totalResponses: ${kpis.totalResponses}\n`);
    process.stdout.write(`avgOverall: ${kpis.avgOverall}\n`);
    process.stdout.write(`recommendRate: ${kpis.recommendRate}%\n`);
    process.stdout.write(`fiveStarCount: ${kpis.fiveStarCount}\n`);
    process.stdout.write(`nps: ${kpis.nps}\n`);
    process.stdout.write(`promoters/passives/detractors: ${kpis.promoters}/${kpis.passives}/${kpis.detractors}\n`);
    process.stdout.write(`sourceCounts: ${JSON.stringify(kpis.surveyCountBySource)}\n`);
    process.stdout.write(`dataIssues: ${JSON.stringify(audit.issues)}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(err?.stack || String(err));
  process.exit(1);
});
