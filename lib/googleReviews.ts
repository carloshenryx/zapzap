import crypto from 'crypto';

export type GoogleReviewNormalized = {
    place_id: string;
    external_review_id: string;
    author_name: string | null;
    rating: number;
    comment: string | null;
    review_published_at: string | null;
    source: 'scraping';
    raw_payload?: any;
};

export function isCriticalRating(rating: number): boolean {
    return Number.isFinite(rating) && rating <= 3;
}

export function computeReviewContentHash(input: {
    place_id: string;
    external_review_id: string;
    author_name: string | null;
    rating: number;
    comment: string | null;
    review_published_at: string | null;
}): string {
    const stable = JSON.stringify({
        place_id: input.place_id,
        external_review_id: input.external_review_id,
        author_name: input.author_name || null,
        rating: input.rating,
        comment: input.comment || null,
        review_published_at: input.review_published_at || null,
    });
    return crypto.createHash('sha256').update(stable).digest('hex');
}

export function normalizeGoogleReview(placeId: string, raw: any): GoogleReviewNormalized | null {
    const external_review_id = String(raw?.external_review_id || raw?.reviewId || raw?.id || '').trim();
    if (!external_review_id) return null;

    const rating = Number(raw?.rating ?? raw?.stars ?? raw?.score);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;

    const author_name = raw?.author_name ?? raw?.authorName ?? raw?.author ?? raw?.user?.name ?? null;
    const comment = raw?.comment ?? raw?.text ?? raw?.content ?? raw?.snippet ?? null;

    const publishedRaw = raw?.review_published_at ?? raw?.publishedAt ?? raw?.date ?? raw?.timestamp ?? null;
    const review_published_at = publishedRaw ? new Date(publishedRaw).toISOString() : null;

    return {
        place_id: placeId,
        external_review_id,
        author_name: author_name ? String(author_name) : null,
        rating,
        comment: comment ? String(comment) : null,
        review_published_at,
        source: 'scraping',
        raw_payload: raw,
    };
}

export async function scrapeGoogleReviewsPublic(placeId: string, opts?: { hl?: string; gl?: string; limit?: number }) {
    const hl = opts?.hl || 'pt-BR';
    const gl = opts?.gl || 'BR';
    const limit = Math.min(Math.max(Number(opts?.limit || 50), 1), 200);

    const candidates = [
        `https://www.google.com/maps/preview/review/listentitiesreviews?hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&authuser=0&pb=!1m2!1y${encodeURIComponent(placeId)}!2y0!2m2!1i${limit}!2s!4m3!3b1!4b1!5b1`,
        `https://www.google.com/maps/preview/review/listentitiesreviews?hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&authuser=0&pb=!1m2!1y${encodeURIComponent(placeId)}!2y0!2m2!1i${limit}!2s`,
    ];

    let lastError: any = null;
    for (const url of candidates) {
        try {
            const resp = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-language': `${hl},en;q=0.8`,
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            });
            if (!resp.ok) {
                lastError = new Error(`HTTP ${resp.status}`);
                continue;
            }
            const text = await resp.text();
            const parsed = tryParseGoogleMapsReviewsPayload(text);
            if (!parsed) {
                lastError = new Error('Failed to parse Google payload');
                continue;
            }
            const normalized = parsed
                .map((r) => normalizeGoogleReview(placeId, r))
                .filter(Boolean) as GoogleReviewNormalized[];

            return { reviews: normalized, source_url: url };
        } catch (err: any) {
            lastError = err;
        }
    }

    return { reviews: [], error: lastError ? String(lastError?.message || lastError) : 'Unknown scraping error' };
}

function tryParseGoogleMapsReviewsPayload(payloadText: string): any[] | null {
    const trimmed = payloadText.trim();

    try {
        const json = JSON.parse(trimmed);
        const extracted = extractReviewsFromUnknownGoogleShape(json);
        if (extracted) return extracted;
    } catch (_) {}

    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
        const slice = trimmed.slice(firstBracket, lastBracket + 1);
        try {
            const json = JSON.parse(slice);
            const extracted = extractReviewsFromUnknownGoogleShape(json);
            if (extracted) return extracted;
        } catch (_) {}
    }

    return null;
}

function extractReviewsFromUnknownGoogleShape(json: any): any[] | null {
    if (Array.isArray(json)) {
        const flattened = flattenArrays(json);
        const reviewLike = flattened.filter((x) => x && typeof x === 'object' && ('rating' in x || 'stars' in x || 'score' in x));
        if (reviewLike.length > 0) return reviewLike;
    }

    if (json && typeof json === 'object') {
        const candidates = [json?.reviews, json?.data?.reviews, json?.result?.reviews];
        for (const c of candidates) {
            if (Array.isArray(c)) return c;
        }
    }

    return null;
}

function flattenArrays(input: any): any[] {
    const out: any[] = [];
    const stack = [input];
    while (stack.length) {
        const cur = stack.pop();
        if (Array.isArray(cur)) {
            for (const item of cur) stack.push(item);
        } else if (cur && typeof cur === 'object') {
            out.push(cur);
            for (const v of Object.values(cur)) {
                if (v && (Array.isArray(v) || typeof v === 'object')) stack.push(v);
            }
        }
    }
    return out;
}

