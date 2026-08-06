import { describe, expect, test } from 'vitest';
import { SHEETS_SCOPE, createTokenProvider } from '../functions/lib/google-token.js';

const SA_JSON = JSON.stringify({
  type: 'service_account',
  client_email: 'sheets@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nFAKE-KEY\n-----END PRIVATE KEY-----\n',
});

describe('createTokenProvider', () => {
  test('parses service-account JSON into a JWT client and returns its token', async () => {
    let constructed = null;
    const FakeJWT = class {
      constructor(opts) {
        constructed = opts;
      }
      async getAccessToken() {
        return { token: 'token-123' };
      }
    };
    const getAccessToken = createTokenProvider(SA_JSON, SHEETS_SCOPE, FakeJWT);
    expect(typeof getAccessToken).toBe('function');
    expect(await getAccessToken()).toBe('token-123');
    expect(constructed.email).toBe('sheets@project.iam.gserviceaccount.com');
    expect(constructed.key).toContain('BEGIN PRIVATE KEY');
    expect(constructed.scopes).toEqual([SHEETS_SCOPE]);
  });

  test('reuses one client across calls', async () => {
    let builds = 0;
    const FakeJWT = class {
      constructor() {
        builds += 1;
      }
      async getAccessToken() {
        return { token: 'token-456' };
      }
    };
    const getAccessToken = createTokenProvider(SA_JSON, SHEETS_SCOPE, FakeJWT);
    await getAccessToken();
    await getAccessToken();
    expect(builds).toBe(1);
  });

  test('throws when the token is missing', async () => {
    const FakeJWT = class {
      async getAccessToken() {
        return {};
      }
    };
    const getAccessToken = createTokenProvider(SA_JSON, SHEETS_SCOPE, FakeJWT);
    await expect(getAccessToken()).rejects.toThrow(/no access token/i);
  });
});
