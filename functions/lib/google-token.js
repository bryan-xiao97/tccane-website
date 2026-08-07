import { OAuth2Client } from 'google-auth-library';
import { TimeoutError, withTimeout } from './http.js';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const PERMANENT_CODES = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client']);

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

export function createTokenProvider(config, Client = OAuth2Client, timeoutMs = 8_000) {
  let client;
  return async function getAccessToken() {
    if (!client) {
      client = new Client(config.clientId, config.clientSecret);
      client.setCredentials({ refresh_token: config.refreshToken });
    }
    try {
      const result = await withTimeout(client.getAccessToken(), timeoutMs, 'Google token request');
      if (!result?.token) throw new GoogleAuthError('missing_access_token', { retryable: true });
      return result.token;
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      const classified = classifyGoogleAuthError(error);
      throw new GoogleAuthError(classified.code, { ...classified, cause: error });
    }
  };
}
