export function isSupabaseAuthCallbackUrl(url) {
  try {
    const u = new URL(String(url));
    const search = u.searchParams;
    const hash = String(u.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);

    const hasPkceCode = search.has('code');
    const hasAccessToken = hashParams.has('access_token') || search.has('access_token');
    const hasRefreshToken = hashParams.has('refresh_token') || search.has('refresh_token');
    const hasType = hashParams.has('type') || search.has('type');

    return hasPkceCode || hasAccessToken || hasRefreshToken || hasType;
  } catch {
    return false;
  }
}

