import { describe, expect, test } from 'vitest';
import {
  DRIVE_FILE_SCOPE,
  GoogleAuthError,
  classifyGoogleAuthError,
  createTokenProvider,
  oauthConfigFromEnv,
} from '../functions/lib/google-token.js';

const CONFIG = {
  clientId: 'client.apps.googleusercontent.com',
  clientSecret: 'client-secret',
  refreshToken: 'refresh-token',
};

describe('oauthConfigFromEnv', () => {
  test('returns the three owner OAuth secrets', () => {
    expect(oauthConfigFromEnv({
      GOOGLE_OAUTH_CLIENT_ID: CONFIG.clientId,
      GOOGLE_OAUTH_CLIENT_SECRET: CONFIG.clientSecret,
      GOOGLE_OAUTH_REFRESH_TOKEN: CONFIG.refreshToken,
    })).toEqual({ ok: true, value: CONFIG });
  });

  test('reports every missing key', () => {
    expect(oauthConfigFromEnv({})).toEqual({
      ok: false,
      missing: [
        'GOOGLE_OAUTH_CLIENT_ID',
        'GOOGLE_OAUTH_CLIENT_SECRET',
        'GOOGLE_OAUTH_REFRESH_TOKEN',
      ],
    });
  });
});

describe('createTokenProvider', () => {
  test('exchanges the refresh token through the OAuth endpoint', async () => {
    let request;
    const fetchImpl = async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({
        access_token: 'access-token',
        expires_in: 3599,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const getAccessToken = createTokenProvider(CONFIG, fetchImpl, 100);

    expect(await getAccessToken()).toBe('access-token');
    expect(request.url).toBe('https://oauth2.googleapis.com/token');
    expect(request.init).toEqual({
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'client_id=client.apps.googleusercontent.com&client_secret=client-secret&refresh_token=refresh-token&grant_type=refresh_token',
    });
  });

  test('reuses an access token until its expiry window', async () => {
    let requests = 0;
    const fetchImpl = async () => {
      requests += 1;
      return new Response(JSON.stringify({ access_token: 'access-token', expires_in: 3599 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const getAccessToken = createTokenProvider(CONFIG, fetchImpl, 100, () => 0);
    expect(await getAccessToken()).toBe('access-token');
    expect(await getAccessToken()).toBe('access-token');
    expect(requests).toBe(1);
  });

  test('converts invalid_grant to a permanent typed error', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Token has been revoked.',
    }), { status: 400, headers: { 'content-type': 'application/json' } });
    const getAccessToken = createTokenProvider(CONFIG, fetchImpl, 100);
    await expect(getAccessToken()).rejects.toEqual(expect.objectContaining({
      name: 'GoogleAuthError', code: 'invalid_grant', retryable: false, status: 400,
    }));
  });
});

describe('classifyGoogleAuthError', () => {
  test.each([
    ['invalid_grant', 400, false],
    ['invalid_client', 401, false],
    ['token_timeout', 0, true],
    ['token_http_503', 503, true],
  ])('%s classification', (code, status, retryable) => {
    const error = code === 'token_timeout'
      ? Object.assign(new Error('timeout'), { name: 'TimeoutError' })
      : { response: { status, data: { error: code.replace('token_http_', '') } } };
    expect(classifyGoogleAuthError(error).retryable).toBe(retryable);
  });

  test('exports only drive.file scope', () => {
    expect(DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
  });
});
