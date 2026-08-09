import 'dotenv/config';


import { timingSafeEqual, randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { OAuth2Client } from 'google-auth-library';
import {
  OWNER_REDIRECT_URI,
  createInterestSpreadsheet,
  createOwnerAuthUrl,
  mergeDevVars,
  protectInterestSheet,
  verifyInterestSpreadsheet,
} from './lib/google-owner-setup.js';

function receiveAuthorizationCode(expectedState) {
  return new Promise((resolve, reject) => {
    let timer;
    const server = createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1:53682');
      if (url.pathname !== '/oauth2/callback') {
        response.writeHead(404).end('Not found');
        return;
      }
      const actual = Buffer.from(url.searchParams.get('state') || '');
      const expected = Buffer.from(expectedState);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        response.writeHead(400).end('Invalid OAuth state');
        clearTimeout(timer);
        server.close(() => reject(new Error('Invalid OAuth state')));
        return;
      }
      const oauthError = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      if (oauthError || !code) {
        response.writeHead(400).end('Google authorization failed');
        clearTimeout(timer);
        server.close(() => reject(new Error(oauthError || 'Missing authorization code')));
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<h1>Authorization complete</h1><p>You may close this window.</p>', () => {
        clearTimeout(timer);
        server.close(() => resolve(code));
      });
    });
    server.on('error', reject);
    server.listen(53682, '127.0.0.1');
    timer = setTimeout(() => {
      server.close(() => reject(new Error('Owner authorization timed out after five minutes')));
    }, 5 * 60 * 1000);
  });
}

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error('GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required');
}

const client = new OAuth2Client(clientId, clientSecret, OWNER_REDIRECT_URI);
const state = randomBytes(32).toString('hex');
const authorizationUrl = createOwnerAuthUrl({ client, state });
const codePromise = receiveAuthorizationCode(state);
console.log(`Open this URL in the designated owner account:\n${authorizationUrl}`);
const code = await codePromise;
const { tokens } = await client.getToken(code);

if (!tokens.refresh_token) {
  throw new Error('Google returned no refresh token; revoke the prior grant and rerun setup');
}
client.setCredentials({ refresh_token: tokens.refresh_token });
const getAccessToken = async () => (await client.getAccessToken()).token;
const created = await createInterestSpreadsheet({ fetchImpl: fetch, getAccessToken });
await protectInterestSheet({ fetchImpl: fetch, getAccessToken, ...created });
await verifyInterestSpreadsheet({
  fetchImpl: fetch,
  getAccessToken,
  spreadsheetId: created.spreadsheetId,
});

const current = await readFile('.dev.vars', 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const next = mergeDevVars(current, {
  GOOGLE_OAUTH_CLIENT_ID: clientId,
  GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
  GOOGLE_OAUTH_REFRESH_TOKEN: tokens.refresh_token,
  GOOGLE_SPREADSHEET_ID: created.spreadsheetId,
  GOOGLE_SHEET_TAB: 'Submissions',
});
await writeFile('.dev.vars', next, { mode: 0o600 });
await chmod('.dev.vars', 0o600);
console.log(`Created https://docs.google.com/spreadsheets/d/${created.spreadsheetId}`);
console.log('Saved deployment values to git-ignored .dev.vars with mode 0600.');
