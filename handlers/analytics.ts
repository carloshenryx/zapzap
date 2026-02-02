import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { successResponse, errorResponse } from '../lib/response.js';

const surveyExecutiveCache = new Map<string, { expiresAt: number; payload: any }>();

function getCachedSurveyExecutive(key: string) {
    const hit = surveyExecutiveCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        surveyExecutiveCache.delete(key);
        return null;
    }
    return hit.payload;
}

function setCachedSurveyExecutive(key: string, payload: any, ttlMs: number) {
    surveyExecutiveCache.set(key, { expiresAt: Date.now() + ttlMs, payload });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    if (req.method !== 'GET') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    switch (action) {
        case 'system-overview':
            return await getSystemOverview(req, res);
        case 'survey-executive':
            return await getSurveyExecutive(req, res);
        case 'survey-live-feed':
            return await getSurveyLiveFeed(req, res);
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

async function getSystemOverview(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        // Super admin check
        if (!user.is_super_admin) {
            return errorResponse(res, 'Forbidden: Super admin access required', 403);
        }

        const supabase = getSupabaseServiceClient();

        // Total tenants
        const { count: totalTenants } = await supabase
            .from('tenants')
            .select('*', { count: 'exact', head: true });

        // Active subscriptions
        const { count: activeSubscriptions } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        // Total users
        const { count: totalUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .not('tenant_id', 'is', null);

        // Current month consumption
        const period = new Date().toISOString().slice(0, 7);
        const { data: consumptionData } = await supabase
            .from('consumption')
            .select('messages_sent, surveys_created, responses_received')
            .eq('period', period);

        // Aggregate consumption
        const totalMessages = consumptionData?.reduce((sum, c) => sum + (c.messages_sent || 0), 0) || 0;
        const totalSurveys = consumptionData?.reduce((sum, c) => sum + (c.surveys_created || 0), 0) || 0;
        const totalResponses = consumptionData?.reduce((sum, c) => sum + (c.responses_received || 0), 0) || 0;

        // Total survey responses ever
        const { count: totalResponsesEver } = await supabase
            .from('survey_responses')
            .select('*', { count: 'exact', head: true });

        return successResponse(res, {
            total_tenants: totalTenants || 0,
            active_subscriptions: activeSubscriptions || 0,
            total_users: totalUsers || 0,
            current_month: {
                messages_sent: totalMessages,
                surveys_created: totalSurveys,
                responses_received: totalResponses,
            },
            total_responses_ever: totalResponsesEver || 0,
        });

    } catch (error: any) {
        console.error('System overview error:', error);
        const message = String(error?.message || 'Failed to get system overview');
        const lower = message.toLowerCase();
        const status = lower.includes('unauthorized') ? 401 : lower.includes('forbidden') ? 403 : 500;
        return errorResponse(res, message, status);
    }
}

function getPeriodRange(query: VercelRequest['query']) {
    const period = (query.period as string) || 'month';
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (period === 'all') {
        return { period, start: null, end: null };
    }

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
        const startStr = query.start as string | undefined;
        const endStr = query.end as string | undefined;
        start = startStr ? new Date(startStr) : null;
        end = endStr ? new Date(endStr) : new Date(now);
        if (end) end.setHours(23, 59, 59, 999);
        return { period, start, end };
    }

    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now);
    return { period: 'month', start, end };
}

function getPeriodRangeDefaultToday(query: VercelRequest['query']) {
    const raw = query.period;
    const hasPeriod = typeof raw === 'string' && raw.length > 0;
    const effectiveQuery = hasPeriod ? query : ({ ...query, period: 'today' } as any);
    return getPeriodRange(effectiveQuery);
}

function toDateKey(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isFiniteNumber(value: any): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function extractFirstNumericAnswer(customAnswers: any): number | null {
    if (!customAnswers || typeof customAnswers !== 'object') return null;
    const values = Object.values(customAnswers);
    for (const v of values) {
        if (isFiniteNumber(v)) return v;
    }
    return null;
}

function normalizeTo10(raw: any): number | null {
    if (!isFiniteNumber(raw)) return null;
    const value = Math.max(0, raw);
    if (value <= 5) return value * 2;
    if (value <= 10) return value;
    if (value <= 100) return value / 10;
    return null;
}

function getScore10FromResponse(r: any): number | null {
    const raw = isFiniteNumber(r?.overall_rating) ? r.overall_rating : extractFirstNumericAnswer(r?.custom_answers);
    return normalizeTo10(raw);
}

async function getSurveyExecutive(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const { start, end, period } = getPeriodRange(req.query);
        const templateId = (req.query.template_id as string) || 'all';
        const badThresholdRaw = Number(req.query.bad_threshold || 2);
        const goodThresholdRaw = Number(req.query.good_threshold || 4);
        const badThreshold = Number.isFinite(badThresholdRaw) ? Math.min(Math.max(badThresholdRaw, 1), 5) : 2;
        const goodThreshold = Number.isFinite(goodThresholdRaw) ? Math.min(Math.max(goodThresholdRaw, 1), 5) : 4;
        const lowRatingsLimit = Math.min(Number(req.query.low_ratings_limit || 30), 100);

        const cacheKey = [
            user.tenant_id,
            templateId,
            period,
            start ? start.toISOString() : '',
            end ? end.toISOString() : '',
            badThreshold,
            goodThreshold,
            lowRatingsLimit,
        ].join('|');

        const cached = getCachedSurveyExecutive(cacheKey);
        if (cached) {
            return successResponse(res, cached);
        }

        const supabase = getSupabaseServiceClient();
        const baseSelect = 'id, tenant_id, template_id, created_at, overall_rating, custom_answers, would_recommend, comment, source, is_anonymous, customer_name, customer_email, customer_phone';
        const optionalSelect = `${baseSelect}, google_redirect_triggered, followup_status, followup_note, followup_updated_at`;

        let baseQuery = supabase
            .from('survey_responses')
            .select(optionalSelect)
            .eq('tenant_id', user.tenant_id);

        if (templateId !== 'all') {
            baseQuery = baseQuery.eq('template_id', templateId);
        }
        if (start) {
            baseQuery = baseQuery.gte('created_at', start.toISOString());
        }
        if (end) {
            baseQuery = baseQuery.lte('created_at', end.toISOString());
        }

        let rows: any[] | null = null;
        let error: any = null;

        const firstTry = await baseQuery.order('created_at', { ascending: true });
        rows = firstTry.data || null;
        error = firstTry.error || null;

        if (error && (error.code === '42703' || String(error.message || '').toLowerCase().includes('does not exist'))) {
            let fallbackQuery = supabase
                .from('survey_responses')
                .select(baseSelect)
                .eq('tenant_id', user.tenant_id);

            if (templateId !== 'all') {
                fallbackQuery = fallbackQuery.eq('template_id', templateId);
            }
            if (start) {
                fallbackQuery = fallbackQuery.gte('created_at', start.toISOString());
            }
            if (end) {
                fallbackQuery = fallbackQuery.lte('created_at', end.toISOString());
            }

            const secondTry = await fallbackQuery.order('created_at', { ascending: true });
            rows = secondTry.data || null;
            error = secondTry.error || null;
        }

        if (error) {
            console.error('Survey executive error:', error);
            return errorResponse(res, error.message || 'Failed to fetch survey responses', 500);
        }

        const responses = rows || [];
        const badThreshold10 = badThreshold * 2;
        const goodThreshold10 = goodThreshold * 2;

        const scored = responses
            .map(r => ({
                ...r,
                overall_rating_normalized: (() => {
                    const score10 = getScore10FromResponse(r);
                    return isFiniteNumber(score10) ? Number((score10 / 2).toFixed(1)) : null;
                })(),
                overall_score10: getScore10FromResponse(r),
            }));

        const rated = scored.filter(r => isFiniteNumber(r.overall_score10));

        const totalSubmissions = responses.length;
        const ratingCount = rated.length;
        const ratingSum10 = rated.reduce((sum, r) => sum + (r.overall_score10 || 0), 0);
        const avgRating = ratingCount > 0 ? Number(((ratingSum10 / ratingCount) / 2).toFixed(2)) : 0;

        const goodCount = rated.filter(r => (r.overall_score10 || 0) >= goodThreshold10).length;
        const badCount = rated.filter(r => (r.overall_score10 || 0) <= badThreshold10).length;
        const neutralCount = Math.max(ratingCount - goodCount - badCount, 0);
        const badIdentifiedCount = rated.filter(r =>
            (r.overall_score10 || 0) <= badThreshold10 && !!(r.customer_name || r.customer_phone || r.customer_email)
        ).length;

        const googleRedirectCount = scored.filter(r => r.google_redirect_triggered === true).length;

        const byDay: Record<string, { good: number; neutral: number; bad: number; ratingSum: number; ratingCount: number; total: number; total_submissions: number }> = {};
        for (const r of scored) {
            const key = r.created_at ? toDateKey(new Date(r.created_at)) : null;
            if (!key) continue;
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
            .filter(r => (r.overall_score10 || 0) <= badThreshold10)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, lowRatingsLimit);

        const payload = {
            period,
            range: {
                start: start ? start.toISOString() : null,
                end: end ? end.toISOString() : null,
            },
            thresholds: {
                bad: badThreshold,
                good: goodThreshold,
            },
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
            low_ratings: lowRatings.map(r => ({
                ...r,
                overall_rating: isFiniteNumber(r.overall_rating_normalized) ? r.overall_rating_normalized : r.overall_rating,
            })),
        };

        setCachedSurveyExecutive(cacheKey, payload, 15_000);
        return successResponse(res, payload);
    } catch (error: any) {
        console.error('Survey executive error:', error);
        return errorResponse(res, error.message || 'Failed to build executive dashboard', 500);
    }
}

async function getSurveyLiveFeed(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const limit = Math.min(Number(req.query.limit || 20), 50);
        const templateId = (req.query.template_id as string) || 'all';
        const { start, end } = getPeriodRangeDefaultToday(req.query);

        const supabase = getSupabaseServiceClient();
        let query = supabase
            .from('survey_responses')
            .select('id, created_at, overall_rating, would_recommend, comment, source, is_anonymous, customer_name, customer_phone, customer_email')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (templateId !== 'all') {
            query = query.eq('template_id', templateId);
        }

        if (start) {
            query = query.gte('created_at', start.toISOString());
        }

        if (end) {
            query = query.lte('created_at', end.toISOString());
        }

        const { data, error } = await query;
        if (error) {
            console.error('Survey live feed error:', error);
            return errorResponse(res, error.message || 'Failed to load live feed', 500);
        }

        return successResponse(res, { feed: data || [] });
    } catch (error: any) {
        console.error('Survey live feed error:', error);
        return errorResponse(res, error.message || 'Failed to load live feed', 500);
    }
}
