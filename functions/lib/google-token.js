import { JWT } from 'google-auth-library';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export function createTokenProvider(serviceAccountJson, scope = SHEETS_SCOPE, Client = JWT) {
  let client = null;
  return async function getAccessToken() {
    if (!client) {
      const sa = JSON.parse(serviceAccountJson);
      client = new Client({
        email: sa.client_email,
        key: sa.private_key,
        scopes: [scope],
      });
    }
    const res = await client.getAccessToken();
    if (!res || !res.token) {
      throw new Error('Google auth returned no access token');
    }
    return res.token;
  };
}
