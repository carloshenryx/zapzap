import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

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

function getScore10FromResponse(r) {
  const raw = isFiniteNumber(r?.overall_rating) ? r.overall_rating : extractFirstNumericAnswer(r?.custom_answers);
  return normalizeTo10(raw);
}

function toDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPeriodRangeFromArgs(args) {
  const period = String(args.period || 'month');
  const now = new Date();
  let start = null;
  let end = null;

  if (period === 'all') return { period, start: null, end: null };

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now);
    return { period, start, end };
  }

  if (period === 'week') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    return { period, start, end };
  }

  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now);
    return { period, start, end };
  }

  if (period === 'custom') {
    start = args.start ? new Date(String(args.start)) : null;
    end = args.end ? new Date(String(args.end)) : new Date(now);
    if (end) end.setHours(23, 59, 59, 999);
    return { period, start, end };
  }

  start = new Date(now.getFullYear(), now.getMonth(), 1);
  end = new Date(now);
  return { period: 'month', start, end };
}

function clampThreshold(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), 5);
}

function auditInputData(rows) {
  const issues = {
    total: rows.length,
    missingCreatedAt: 0,
    invalidCreatedAt: 0,
    missingTemplateId: 0,
    ratingNull: 0,
    ratingOutOfExpectedRange: 0,
    customAnswersNotObject: 0,
    googleRedirectMissingFieldOrNull: 0,
  };

  const examples = {
    missingCreatedAt: [],
    invalidCreatedAt: [],
    ratingNull: [],
  };

  const pushExample = (key, id) => {
    if (!id) return;
    if (!examples[key]) return;
    if (examples[key].length >= 5) return;
    examples[key].push(id);
  };

  for (const r of rows) {
    const id = r.id || null;
    if (!r.created_at) {
      issues.missingCreatedAt++;
      pushExample('missingCreatedAt', id);
    } else {
      const d = new Date(r.created_at);
      if (!Number.isFinite(d.getTime())) {
        issues.invalidCreatedAt++;
        pushExample('invalidCreatedAt', id);
      }
    }

    if (!r.template_id) issues.missingTemplateId++;

    if (r.custom_answers && typeof r.custom_answers !== 'object') issues.customAnswersNotObject++;

    const score10 = getScore10FromResponse(r);
    if (score10 === null) {
      issues.ratingNull++;
      pushExample('ratingNull', id);
    } else if (score10 < 0 || score10 > 10) {
      issues.ratingOutOfExpectedRange++;
    }

    if (typeof r.google_redirect_triggered === 'undefined' || r.google_redirect_triggered === null) {
      issues.googleRedirectMissingFieldOrNull++;
    }
  }

  return { issues, examples };
}

async function tryFetchResponses(supabase, tenantId, range, templateId) {
  const baseSelect = 'id, tenant_id, template_id, created_at, overall_rating, custom_answers, would_recommend, comment, source, is_anonymous, customer_name, customer_email, customer_phone';
  const optionalSelect = `${baseSelect}, google_redirect_triggered, followup_status, followup_note, followup_updated_at`;

  let query = supabase
    .from('survey_responses')
    .select(optionalSelect)
    .eq('tenant_id', tenantId);

  if (templateId !== 'all') query = query.eq('template_id', templateId);
  if (range.start) query = query.gte('created_at', range.start.toISOString());
  if (range.end) query = query.lte('created_at', range.end.toISOString());

  const firstTry = await query.order('created_at', { ascending: true });
  if (!firstTry.error) return { rows: firstTry.data || [], optionalFields: true };

  const code = firstTry.error.code;
  const msg = String(firstTry.error.message || '').toLowerCase();
  if (code === '42703' || msg.includes('does not exist')) {
    let fallback = supabase
      .from('survey_responses')
      .select(baseSelect)
      .eq('tenant_id', tenantId);
    if (templateId !== 'all') fallback = fallback.eq('template_id', templateId);
    if (range.start) fallback = fallback.gte('created_at', range.start.toISOString());
    if (range.end) fallback = fallback.lte('created_at', range.end.toISOString());
    const secondTry = await fallback.order('created_at', { ascending: true });
    if (secondTry.error) throw secondTry.error;
    return { rows: secondTry.data || [], optionalFields: false };
  }

  throw firstTry.error;
}

function computeExecutiveMetrics(rows, thresholds, lowRatingsLimit) {
  const badThreshold = clampThreshold(thresholds.bad, 2);
  const goodThreshold = clampThreshold(thresholds.good, 4);
  const badThreshold10 = badThreshold * 2;
  const goodThreshold10 = goodThreshold * 2;

  const scored = (rows || []).map((r) => {
    const score10 = getScore10FromResponse(r);
    const normalized5 = isFiniteNumber(score10) ? Number((score10 / 2).toFixed(1)) : null;
    return {
      ...r,
      overall_score10: score10,
      overall_rating_normalized: normalized5,
    };
  });

  const rated = scored.filter((r) => isFiniteNumber(r.overall_score10));
  const totalSubmissions = scored.length;
  const ratingCount = rated.length;
  const ratingSum10 = rated.reduce((sum, r) => sum + (r.overall_score10 || 0), 0);
  const avgRating = ratingCount > 0 ? Number(((ratingSum10 / ratingCount) / 2).toFixed(2)) : 0;

  const goodCount = rated.filter((r) => (r.overall_score10 || 0) >= goodThreshold10).length;
  const badCount = rated.filter((r) => (r.overall_score10 || 0) <= badThreshold10).length;
  const neutralCount = Math.max(ratingCount - goodCount - badCount, 0);

  const badIdentifiedCount = rated.filter((r) =>
    (r.overall_score10 || 0) <= badThreshold10 && !!(r.customer_name || r.customer_phone || r.customer_email)
  ).length;

  const googleRedirectCount = scored.filter((r) => r.google_redirect_triggered === true).length;

  const byDay = {};
  for (const r of scored) {
    if (!r.created_at) continue;
    const dt = new Date(r.created_at);
    if (!Number.isFinite(dt.getTime())) continue;
    const key = toDateKey(dt);
    if (!byDay[key]) {
      byDay[key] = { good: 0, neutral: 0, bad: 0, ratingSum: 0, ratingCount: 0, total: 0, total_submissions: 0 };
    }
    const bucket = byDay[key];
    bucket.total_submissions += 1;

    if (isFiniteNumber(r.overall_score10)) {
      bucket.total += 1;
      bucket.ratingSum += r.overall_score10;
      bucket.ratingCount += 1;
      if (r.overall_score10 >= goodThreshold10) bucket.good += 1;
      else if (r.overall_score10 <= badThreshold10) bucket.bad += 1;
      else bucket.neutral += 1;
    }
  }

  const trend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      total: v.total,
      total_submissions: v.total_submissions,
      good: v.good,
      neutral: v.neutral,
      bad: v.bad,
      avg_rating: v.ratingCount > 0 ? Number(((v.ratingSum / v.ratingCount) / 2).toFixed(2)) : 0,
    }));

  const lowRatings = rated
    .filter((r) => (r.overall_score10 || 0) <= badThreshold10)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, Math.min(Number(lowRatingsLimit || 30), 100))
    .map((r) => ({
      ...r,
      overall_rating: isFiniteNumber(r.overall_rating_normalized) ? r.overall_rating_normalized : r.overall_rating,
    }));

  return {
    thresholds: { bad: badThreshold, good: goodThreshold },
    kpis: {
      total_responses: ratingCount,
      total_submissions: totalSubmissions,
      avg_rating: avgRating,
      good_count: goodCount,
      neutral_count: neutralCount,
      bad_count: badCount,
      bad_identified_count: badIdentifiedCount,
      google_redirect_count: googleRedirectCount,
    },
    trend,
    low_ratings: lowRatings,
  };
}

async function resolveDefaultTenantId(supabase) {
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL || envFromFile.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envFromFile.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || envFromFile.VITE_SUPABASE_ANON_KEY;
  const defaultApiUrl = process.env.VITE_APP_URL || envFromFile.VITE_APP_URL;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tenantId = args.tenant || await resolveDefaultTenantId(supabase);
  if (!tenantId) throw new Error('Could not resolve tenant_id. Use --tenant <UUID>.');

  const templateId = String(args.template || 'all');
  const range = getPeriodRangeFromArgs(args);
  const thresholds = { bad: args['bad-threshold'] ?? 2, good: args['good-threshold'] ?? 4 };
  const lowRatingsLimit = args['low-limit'] ?? 30;

  const { rows, optionalFields } = await tryFetchResponses(supabase, tenantId, range, templateId);
  const audit = auditInputData(rows);
  const computed = computeExecutiveMetrics(rows, thresholds, lowRatingsLimit);

  let apiComparison = null;
  if (args.compare) {
    if (!anonKey) throw new Error('compare mode requires VITE_SUPABASE_ANON_KEY.');
    if (!defaultApiUrl && !args['api-url']) throw new Error('compare mode requires VITE_APP_URL or --api-url.');

    const apiUrl = String(args['api-url'] || defaultApiUrl).replace(/\/$/, '');

    const tempEmail = `validation.bot.simple.${Date.now()}@example.com`;
    const tempPassword = `Tmp!${Math.random().toString(36).slice(2)}A9`;

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true,
    });
    if (createError) throw createError;
    const userId = created?.user?.id;
    if (!userId) throw new Error('Failed to create temp user');

    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({ id: userId, tenant_id: tenantId, email: tempEmail });
    if (profileError) throw profileError;

    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword,
    });
    if (signInError) throw signInError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Failed to obtain access token for compare mode');

    const params = new URLSearchParams({
      action: 'survey-executive',
      template_id: templateId,
      bad_threshold: String(thresholds.bad ?? 2),
      good_threshold: String(thresholds.good ?? 4),
      low_ratings_limit: String(lowRatingsLimit ?? 30),
    });

    if (range.start && range.end) {
      params.set('period', 'custom');
      params.set('start', range.start.toISOString());
      params.set('end', range.end.toISOString());
    } else {
      params.set('period', range.period);
    }

    const resp = await fetch(`${apiUrl}/api/analytics?${params.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const rawText = await resp.text();
    let apiBody = {};
    try {
      apiBody = JSON.parse(rawText);
    } catch {
      apiBody = { _non_json_body: rawText.slice(0, 300) };
    }

    const cmp = {
      httpStatus: resp.status,
      ok: resp.ok,
      mismatches: [],
    };

    if (!resp.ok || apiBody?.success === false || apiBody?._non_json_body) {
      cmp.mismatches.push({ type: 'api_error', details: apiBody });
    } else {
      const apiKpis = apiBody?.kpis || {};
      const localKpis = computed.kpis;
      for (const key of Object.keys(localKpis)) {
        const a = apiKpis[key];
        const b = localKpis[key];
        if (String(a) !== String(b)) cmp.mismatches.push({ type: 'kpi', key, api: a, local: b });
      }

      const apiTrend = apiBody?.trend || [];
      if (apiTrend.length !== computed.trend.length) {
        cmp.mismatches.push({ type: 'trend_length', api: apiTrend.length, local: computed.trend.length });
      } else {
        for (let i = 0; i < apiTrend.length; i++) {
          const a = apiTrend[i];
          const b = computed.trend[i];
          for (const key of ['date', 'total', 'total_submissions', 'good', 'neutral', 'bad', 'avg_rating']) {
            if (String(a[key]) !== String(b[key])) {
              cmp.mismatches.push({ type: 'trend_item', index: i, key, api: a[key], local: b[key] });
              break;
            }
          }
        }
      }

      const apiLow = apiBody?.low_ratings || [];
      if (apiLow.length !== computed.low_ratings.length) {
        cmp.mismatches.push({ type: 'low_ratings_length', api: apiLow.length, local: computed.low_ratings.length });
      }
    }

    apiComparison = cmp;

    await supabase.from('user_profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }

  const output = {
    tenant_id: tenantId,
    template_id: templateId,
    period: { period: range.period, start: range.start ? range.start.toISOString() : null, end: range.end ? range.end.toISOString() : null },
    optional_fields_present: optionalFields,
    audit,
    computed,
    api_comparison: apiComparison,
  };

  const json = JSON.stringify(output, null, 2);
  if (args.out && typeof args.out === 'string') {
    const outPath = path.isAbsolute(args.out) ? args.out : path.join(repoRoot, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json);
  }

  if (args.json) {
    process.stdout.write(json);
    return;
  }

  process.stdout.write(`tenant_id: ${tenantId}\n`);
  process.stdout.write(`template_id: ${templateId}\n`);
  process.stdout.write(`period: ${range.period}\n`);
  process.stdout.write(`rows: ${rows.length}\n`);
  process.stdout.write(`kpis: ${JSON.stringify(computed.kpis)}\n`);
  process.stdout.write(`trend_days: ${computed.trend.length}\n`);
  process.stdout.write(`low_ratings: ${computed.low_ratings.length}\n`);
  process.stdout.write(`audit_issues: ${JSON.stringify(audit.issues)}\n`);
}

main().catch((err) => {
  if (err?.stack) {
    process.stderr.write(err.stack);
  } else if (err?.message) {
    process.stderr.write(String(err.message));
  } else {
    try {
      process.stderr.write(JSON.stringify(err));
    } catch {
      process.stderr.write(String(err));
    }
  }
  process.exit(1);
});
