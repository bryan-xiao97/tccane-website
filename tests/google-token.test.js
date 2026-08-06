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
  test('sets the refresh token and reuses one OAuth client', async () => {
    const built = [];
    class FakeOAuth2Client {
      constructor(clientId, clientSecret) {
        built.push({ clientId, clientSecret, credentials: null });
      }
      setCredentials(credentials) {
        built[0].credentials = credentials;
      }
      async getAccessToken() {
        return { token: 'access-token' };
      }
    }
    const getAccessToken = createTokenProvider(CONFIG, FakeOAuth2Client, 100);
    expect(await getAccessToken()).toBe('access-token');
    expect(await getAccessToken()).toBe('access-token');
    expect(built).toEqual([{
      clientId: CONFIG.clientId,
      clientSecret: CONFIG.clientSecret,
      credentials: { refresh_token: CONFIG.refreshToken },
    }]);
  });

  test('converts invalid_grant to a permanent typed error', async () => {
    class FakeOAuth2Client {
      setCredentials() {}
      async getAccessToken() {
        const error = new Error('revoked');
        error.response = { status: 400, data: { error: 'invalid_grant' } };
        throw error;
      }
    }
    const getAccessToken = createTokenProvider(CONFIG, FakeOAuth2Client, 100);
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
