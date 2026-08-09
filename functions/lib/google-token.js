import { TimeoutError, withTimeout } from './http.js';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const PERMANENT_CODES = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client']);
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export class GoogleAuthError extends Error {
  constructor(code, { retryable, status = 0, cause } = {}) {
    super(`Google OAuth ${code}`, { cause });
    this.name = 'GoogleAuthError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export function oauthConfigFromEnv(env) {
  const names = [
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN',
  ];
  const missing = names.filter((name) => typeof env[name] !== 'string' || !env[name].trim());
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    value: {
      clientId: env.GOOGLE_OAUTH_CLIENT_ID.trim(),
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET.trim(),
      refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN.trim(),
    },
  };
}

export function classifyGoogleAuthError(error) {
  if (error instanceof TimeoutError || error?.name === 'TimeoutError') {
    return { code: 'token_timeout', retryable: true, status: 0 };
  }
  const status = Number(error?.response?.status) || 0;
  const remoteCode = error?.response?.data?.error;
  const code = typeof remoteCode === 'string' && remoteCode
    ? remoteCode
    : status ? `token_http_${status}` : 'token_network_error';
  const retryable = !PERMANENT_CODES.has(code) && (status === 0 || status === 408 || status === 429 || status >= 500);
  return { code, retryable, status };
}

export function createTokenProvider(
  config,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
  nowMs = () => Date.now(),
) {
  let cachedToken = '';
  let expiresAt = 0;
  return async function getAccessToken() {
    const now = nowMs();
    if (cachedToken && now < expiresAt) return cachedToken;
    try {
      const response = await withTimeout(fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: config.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      }), timeoutMs, 'Google token request');
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const code = typeof body?.error === 'string' && body.error
          ? body.error
          : `token_http_${response.status}`;
        const retryable = !PERMANENT_CODES.has(code)
          && (response.status === 408 || response.status === 429 || response.status >= 500);
        throw new GoogleAuthError(code, { retryable, status: response.status });
      }
      if (typeof body?.access_token !== 'string' || !body.access_token) {
        throw new GoogleAuthError('missing_access_token', { retryable: true });
      }
      cachedToken = body.access_token;
      const expiresIn = Number(body.expires_in);
      expiresAt = Number.isFinite(expiresIn) && expiresIn > 60
        ? now + ((expiresIn - 60) * 1_000)
        : now;
      return cachedToken;
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      const classified = classifyGoogleAuthError(error);
      throw new GoogleAuthError(classified.code, { ...classified, cause: error });
    }
  };
}
