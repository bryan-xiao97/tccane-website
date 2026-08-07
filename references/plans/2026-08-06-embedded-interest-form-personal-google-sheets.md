# Embedded Interest Form and Personal Google Sheets Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible inline interest form that submits through the existing Cloudflare Pages endpoint to a personally owned, app-created Google Sheet using per-file OAuth, with truthful failure handling and an actively deployed retry Worker.

**Architecture:** The browser posts the existing five-field JSON contract to `POST /api/interest`; Google credentials never leave Cloudflare. A one-time local setup flow obtains offline `drive.file` authorization from the designated owner, creates and protects the fixed sheet then stores the OAuth client credentials, refresh token and spreadsheet ID as Cloudflare secrets. The Pages Function attempts a synchronous append and returns `recorded`, or durably writes a retryable failure to KV and returns `accepted`; a separately deployed Cron Worker drains the same KV records with the same token provider and practical submission-ID deduplication.

**Tech Stack:** Vanilla HTML, CSS and JavaScript; Cloudflare Pages Functions and Workers; Workers KV; Google Sheets API v4 REST; `google-auth-library` 11.x; Vitest 3.x; jsdom; Node.js 20+.

**Spec source:** `references/specs/Embedded Interest Form and Personal Google Sheets Access - Functional Spec - 08.06.html`

## Global Constraints

- The site remains vanilla HTML, CSS and JavaScript hosted on Cloudflare Pages.
- The public write boundary remains the same-origin `POST /api/interest` Pages Function.
- Google client credentials, refresh tokens and access tokens remain server-side and are never exposed to a visitor's browser.
- The destination spreadsheet is owned by the designated personal Google account.
- Google access uses `google-auth-library` and only `https://www.googleapis.com/auth/drive.file`; do not request `spreadsheets` or `drive` scope.
- The one-time local setup and production runtime use the same OAuth client ID, client secret and refresh token.
- The setup creates one spreadsheet titled `TCCANE Interest Submissions`, one `Submissions` tab and headers in this exact order: `submissionId`, `submittedAtUtc`, `firstName`, `lastName`, `email`.
- The row schema remains those five columns. Never write IP addresses, Turnstile tokens, OAuth material or retry history to Sheets.
- Sheets writes continue to use `valueInputOption=RAW` and `insertDataOption=INSERT_ROWS`.
- Turnstile, IP rate limiting, opaque server-generated submission identifiers and KV-backed retry retention remain active.
- Immediate success returns `{ ok: true, status: "recorded" }`; durable enqueue returns `{ ok: true, status: "accepted" }`. The browser presents the same persistent completion panel for both.
- Invalid or revoked OAuth grants, missing spreadsheet access, missing tabs and schema drift are permanent failures. They never return `accepted`.
- Network failures, explicit timeouts, HTTP 408, HTTP 429, HTTP 5xx and Google quota reasons `rateLimitExceeded` or `userRateLimitExceeded` are retryable.
- Delivery is at least once with practical submission-ID deduplication. Do not claim transactional or exactly-once Sheets delivery.
- The retry Worker runs every five minutes, processes no more than 20 due records sequentially per invocation and uses the same OAuth and spreadsheet settings as Pages.
- Queue records older than 24 hours become poisoned. Queued and poisoned records expire from KV after 30 days. Staff review and remove Sheet rows older than 12 months.
- Production alert conditions are: `google_auth_permanent`, `sheet_contract_invalid`, `dlq_poisoned` and `dlq_oldest_age_exceeded` with an oldest-age threshold of 15 minutes.
- Do not log names, email addresses, raw Google error bodies or authorization material. Use the opaque `submissionId` for correlation.
- Preserve entered names and email after failure. Clear or reset Turnstile state after every unsuccessful request.
- Do not automatically retry browser POST requests.
- Existing email, Instagram and Discord links remain visible as secondary contact methods.
- No CRM, reporting dashboard, production owner console, arbitrary sheet picker or fallback datastore is added.
- Repo conventions: ES modules with `.js`/`.mjs` extensions, Vitest via `npm test`, test helpers under `tests/helpers/`, no TypeScript and no manual changes to generated changelogs.
- Commits use conventional messages and never add an agent as co-author.

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `functions/lib/http.js` | Timeout wrappers shared by token, Sheets and Turnstile requests | Create |
| `functions/lib/google-token.js` | Owner OAuth configuration, refresh-token client and typed auth failures | Replace service-account implementation |
| `functions/lib/sheets.js` | Header verification, dedup lookup, RAW append and Google error classification | Modify |
| `functions/lib/turnstile.js` | Time-bounded Siteverify request | Modify |
| `functions/lib/handler.js` | OAuth configuration guard and truthful `recorded`/`accepted`/failure behavior | Modify |
| `scripts/lib/google-owner-setup.js` | Pure helpers for OAuth URL generation, sheet creation, protection and verification | Create |
| `scripts/setup-google-owner.mjs` | Local loopback OAuth flow and secure `.dev.vars` update | Create |
| `functions/lib/dlq.js` | Cursor pagination, maximum retry age and record TTL | Modify |
| `functions/lib/log.js` | Structured operational events without email fingerprints | Modify |
| `functions/scheduled/retry-dlq.js` | OAuth-backed retry processing and health summary | Modify |
| `wrangler.retry.toml` | Independently deployable five-minute Cron Worker | Create |
| `functions/api/config.js` | Expose only the public Turnstile site key to the static client | Create |
| `interest-form.js` | Browser form state machine, Turnstile rendering and API submission | Create |
| `index.html` | Inline form, persistent result panel and module entry | Modify |
| `styles.css` | Form, validation, responsive and success-panel styles | Modify |
| `app.js` | Initialize the interest form alongside existing navigation and reveal behavior | Modify |
| `.dev.vars.example` | Personal OAuth, Sheet and Turnstile example configuration | Modify |
| `package.json` / `package-lock.json` | jsdom, setup and retry scripts | Modify |
| `scripts/smoke-interest.sh` | Safe endpoint smoke test using a temporary output file | Modify |
| `README.md` | Owner setup, deployment, reauthorization, retention and monitoring runbook | Modify |
| `tests/http.test.js` | Timeout helper tests | Create |
| `tests/google-token.test.js` | Personal OAuth token-provider tests | Replace service-account tests |
| `tests/owner-setup.test.js` | Setup URL, spreadsheet contract and `.dev.vars` serialization tests | Create |
| `tests/sheets.test.js` | Header, error classification, timeout and dedup tests | Modify |
| `tests/handler.test.js` | OAuth environment and truthful response tests | Modify |
| `tests/dlq.test.js` | Pagination, age and TTL tests | Modify |
| `tests/helpers/memory-kv.js` | Cursor and TTL-aware KV test double | Modify |
| `tests/retry-dlq.test.js` | OAuth-backed scheduled retry and monitoring-event tests | Modify |
| `tests/config.test.js` | Public config endpoint tests | Create |
| `tests/interest-form.test.js` | jsdom browser state and accessibility tests | Create |
| `tests/hygiene.test.js` | Reject service-account remnants and secret-shaped content | Modify |

## Stable interfaces

```js
// functions/lib/http.js
export class TimeoutError extends Error
export async function withTimeout(promise, timeoutMs, label) // Promise<unknown>
export async function fetchWithTimeout(fetchImpl, input, init = {}, timeoutMs = 8_000) // Promise<Response>

// functions/lib/google-token.js
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export class GoogleAuthError extends Error // fields: code, retryable, status
export function oauthConfigFromEnv(env)
// -> { ok: true, value: { clientId, clientSecret, refreshToken } }
//  | { ok: false, missing: string[] }
export function classifyGoogleAuthError(error)
// -> { code: string, retryable: boolean, status: number }
export function createTokenProvider(config, Client = OAuth2Client, timeoutMs = 8_000)
// -> async function getAccessToken() -> Promise<string>, throws GoogleAuthError

// functions/lib/sheets.js
export const SHEET_HEADERS = ['submissionId', 'submittedAtUtc', 'firstName', 'lastName', 'email'];
export async function verifySheetContract({ fetchImpl, spreadsheetId, tab, getAccessToken, timeoutMs })
// -> { ok: true } | { ok: false, retryable, status, code, error }
export async function writeSubmission({ fetchImpl, spreadsheetId, tab, submission, getAccessToken, timeoutMs })
// -> { ok: true, duplicate: boolean } | { ok: false, retryable, status, code, error }

// scripts/lib/google-owner-setup.js
export const OWNER_REDIRECT_URI = 'http://127.0.0.1:53682/oauth2/callback';
export function createOwnerAuthUrl({ client, state }) // -> string
export async function createInterestSpreadsheet({ fetchImpl, getAccessToken, title })
// -> { spreadsheetId: string, sheetId: number }
export async function protectInterestSheet({ fetchImpl, getAccessToken, spreadsheetId, sheetId })
export async function verifyInterestSpreadsheet({ fetchImpl, getAccessToken, spreadsheetId })
export function mergeDevVars(existingText, values) // -> string

// functions/lib/dlq.js
export async function enqueueFailure({ kv, payload, error, nowMs, maxAttempts }) // -> { id }
export async function listDue({ kv, nowMs, limit }) // -> retry records across all KV pages
export async function markAttempt({ kv, id, success, error, nowMs, maxAttempts })
export async function poisonRecord({ kv, id, error, nowMs })
export async function queueHealth({ kv, nowMs })
// -> { queued: number, poisoned: number, oldestAgeMs: number }

// interest-form.js
export async function initInterestForm({ documentRef, fetchImpl, turnstileApi, loadTurnstile } = {})
// -> { destroy(): void } | null
```

---

### Task 1: Time-bounded personal OAuth token provider

**Files:**
- Create: `functions/lib/http.js`
- Create: `tests/http.test.js`
- Modify: `functions/lib/google-token.js`
- Modify: `tests/google-token.test.js`

**Interfaces:**
- Produces: `TimeoutError`, `withTimeout`, `fetchWithTimeout`, `DRIVE_FILE_SCOPE`, `GoogleAuthError`, `oauthConfigFromEnv`, `classifyGoogleAuthError` and `createTokenProvider` exactly as listed above.
- Consumed by: Tasks 2, 3, 4 and 6.

- [ ] **Step 1: Write timeout-helper tests**

Create `tests/http.test.js`:

```js
import { describe, expect, test, vi } from 'vitest';
import { TimeoutError, fetchWithTimeout, withTimeout } from '../functions/lib/http.js';

describe('withTimeout', () => {
  test('returns a settled value', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 10, 'token')).resolves.toBe('ok');
  });

  test('rejects with a typed timeout', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 25, 'token');
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).rejects.toEqual(expect.objectContaining({
      name: 'TimeoutError',
      message: 'token timed out after 25ms',
    }));
    vi.useRealTimers();
  });
});

describe('fetchWithTimeout', () => {
  test('passes an AbortSignal to fetch', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response('ok');
    });
    expect((await fetchWithTimeout(fetchImpl, 'https://example.test', {}, 50)).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the helper tests and confirm failure**

Run: `npx vitest run tests/http.test.js`

Expected: FAIL because `functions/lib/http.js` does not exist.

- [ ] **Step 3: Implement the timeout helpers**

Create `functions/lib/http.js`:

```js
export class TimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithTimeout(fetchImpl, input, init = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new TimeoutError('HTTP request', timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run the helper tests and confirm success**

Run: `npx vitest run tests/http.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 5: Replace service-account tests with owner OAuth tests**

Replace `tests/google-token.test.js` with tests covering the stable interfaces:

```js
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
```

- [ ] **Step 6: Run OAuth tests and confirm they fail against the JWT implementation**

Run: `npx vitest run tests/google-token.test.js`

Expected: FAIL because the module still exports `SHEETS_SCOPE`, accepts service-account JSON and constructs `JWT`.

- [ ] **Step 7: Implement the owner OAuth token provider**

Replace `functions/lib/google-token.js` with an `OAuth2Client` implementation that follows this structure:

```js
import { OAuth2Client } from 'google-auth-library';
import { TimeoutError, withTimeout } from './http.js';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const PERMANENT_CODES = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client']);

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
```

- [ ] **Step 8: Run focused and full tests**

Run: `npx vitest run tests/http.test.js tests/google-token.test.js`

Expected: PASS.

Run: `npm test`

Expected: existing handler and retry tests fail because they still configure `GOOGLE_SERVICE_ACCOUNT`; those failures are intentionally resolved in Task 4.

- [ ] **Step 9: Commit the token-provider seam**

```bash
git add functions/lib/http.js functions/lib/google-token.js tests/http.test.js tests/google-token.test.js
git commit -m "feat(middleware): use personal Google OAuth tokens"
```

---

### Task 2: Sheets contract verification and truthful failure classification

**Files:**
- Modify: `functions/lib/sheets.js`
- Modify: `functions/lib/turnstile.js`
- Modify: `tests/sheets.test.js`
- Modify: `tests/turnstile.test.js`

**Interfaces:**
- Consumes: `fetchWithTimeout` and `GoogleAuthError` from Task 1.
- Produces: `SHEET_HEADERS`, `verifySheetContract` and the updated `writeSubmission` result union.
- Consumed by: Tasks 3, 4 and 6.

- [ ] **Step 1: Add focused tests for the exact header contract**

Add to `tests/sheets.test.js`:

```js
import { SHEET_HEADERS, verifySheetContract } from '../functions/lib/sheets.js';

describe('verifySheetContract', () => {
  test('accepts the exact five headers', async () => {
    const fetchImpl = createMockFetch([{
      match: (url) => decodeURIComponent(url).includes("'Submissions'!A1:E1"),
      response: jsonResponse(200, { values: [SHEET_HEADERS] }),
    }]);
    await expect(verifySheetContract({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      getAccessToken,
      timeoutMs: 100,
    })).resolves.toEqual({ ok: true });
  });

  test('rejects changed headers as permanent schema drift', async () => {
    const fetchImpl = createMockFetch([{
      match: () => true,
      response: jsonResponse(200, { values: [['email', 'firstName']] }),
    }]);
    await expect(verifySheetContract({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      getAccessToken,
      timeoutMs: 100,
    })).resolves.toEqual(expect.objectContaining({
      ok: false, retryable: false, code: 'sheet_contract_invalid',
    }));
  });
});
```

- [ ] **Step 2: Add a retry/permanent classification matrix**

Add table-driven tests for `submissionExists` and `appendSubmission`:

```js
test.each([
  [408, {}, true, 'sheets_http_408'],
  [429, {}, true, 'sheets_http_429'],
  [503, {}, true, 'sheets_http_503'],
  [403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, true, 'rateLimitExceeded'],
  [403, { error: { errors: [{ reason: 'forbidden' }] } }, false, 'forbidden'],
  [404, {}, false, 'sheets_http_404'],
])('classifies Sheets HTTP %s', async (status, body, retryable, code) => {
  const fetchImpl = createMockFetch([{ match: () => true, response: jsonResponse(status, body) }]);
  const result = await appendSubmission({
    fetchImpl,
    spreadsheetId: 's1',
    range: "'Submissions'!A:E",
    row: rowForSubmission(submission),
    getAccessToken,
    timeoutMs: 100,
  });
  expect(result).toEqual(expect.objectContaining({ ok: false, retryable, code }));
});
```

Add a test where `getAccessToken` throws `new GoogleAuthError('invalid_grant', { retryable: false, status: 400 })` and assert the Sheets result is permanent with code `invalid_grant`.

- [ ] **Step 3: Run Sheets tests and confirm failure**

Run: `npx vitest run tests/sheets.test.js`

Expected: FAIL because `SHEET_HEADERS`, `verifySheetContract`, encoded A1 ranges and structured error codes do not exist.

- [ ] **Step 4: Implement A1 safety and structured classification**

Refactor `functions/lib/sheets.js` around these exact helpers:

```js
import { GoogleAuthError } from './google-token.js';
import { fetchWithTimeout } from './http.js';

export const SHEET_HEADERS = ['submissionId', 'submittedAtUtc', 'firstName', 'lastName', 'email'];
const RETRYABLE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'backendError']);

function a1(tab, cells) {
  const quoted = String(tab).replaceAll("'", "''");
  return `'${quoted}'!${cells}`;
}

function apiUrl(spreadsheetId, range, suffix = '') {
  const root = 'https://sheets.googleapis.com/v4/spreadsheets';
  return `${root}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${suffix}`;
}

async function classifyResponse(response, label) {
  let body = {};
  try { body = await response.json(); } catch { /* status remains authoritative */ }
  const reason = body?.error?.errors?.find((item) => typeof item?.reason === 'string')?.reason;
  const code = reason || `sheets_http_${response.status}`;
  const retryable = RETRYABLE_REASONS.has(code)
    || response.status === 408
    || response.status === 429
    || response.status >= 500;
  return { ok: false, retryable, status: response.status, code, error: `Sheets ${label} failed` };
}

async function getBearerToken(getAccessToken) {
  try {
    return { ok: true, token: await getAccessToken() };
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return {
        ok: false,
        retryable: error.retryable,
        status: error.status,
        code: error.code,
        error: 'Google authorization failed',
      };
    }
    return { ok: false, retryable: true, status: 0, code: 'token_network_error', error: 'Google authorization failed' };
  }
}
```

Use `fetchWithTimeout` in `submissionExists` and `appendSubmission`. Convert thrown network or timeout errors to `{ ok: false, retryable: true, status: 0, code: 'sheets_network_error', error: 'Sheets request failed' }`. Never persist the raw Google body.

- [ ] **Step 5: Implement and invoke `verifySheetContract`**

Add this behavior before the ID lookup in `writeSubmission`:

```js
export async function verifySheetContract({
  fetchImpl, spreadsheetId, tab, getAccessToken, timeoutMs = 8_000,
}) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;
  let response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      apiUrl(spreadsheetId, a1(tab, 'A1:E1')),
      { headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' } },
      timeoutMs,
    );
  } catch {
    return { ok: false, retryable: true, status: 0, code: 'sheets_network_error', error: 'Sheets request failed' };
  }
  if (!response.ok) return classifyResponse(response, 'contract check');
  const data = await response.json().catch(() => null);
  if (JSON.stringify(data?.values?.[0]) !== JSON.stringify(SHEET_HEADERS)) {
    return { ok: false, retryable: false, status: 409, code: 'sheet_contract_invalid', error: 'Sheet contract invalid' };
  }
  return { ok: true };
}

export async function writeSubmission({
  fetchImpl, spreadsheetId, tab, submission, getAccessToken, timeoutMs = 8_000,
}) {
  const contract = await verifySheetContract({
    fetchImpl, spreadsheetId, tab, getAccessToken, timeoutMs,
  });
  if (!contract.ok) return contract;
  const check = await submissionExists({
    fetchImpl,
    spreadsheetId,
    range: a1(tab, 'A:A'),
    submissionId: submission.submissionId,
    getAccessToken,
    timeoutMs,
  });
  if (!check.ok) return check;
  if (check.found) return { ok: true, duplicate: true };
  const appended = await appendSubmission({
    fetchImpl,
    spreadsheetId,
    range: a1(tab, 'A:E'),
    row: rowForSubmission(submission),
    getAccessToken,
    timeoutMs,
  });
  if (!appended.ok) return appended;
  return { ok: true, duplicate: false };
}
```

- [ ] **Step 6: Add a Turnstile timeout test**

Add to `tests/turnstile.test.js`:

```js
test('fails closed when Siteverify times out', async () => {
  const fetchImpl = (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  const result = await verifyTurnstile({
    token: 'tok', ip: '1.2.3.4', secret: 'sec', fetchImpl, timeoutMs: 5,
  });
  expect(result).toEqual({ ok: false, error: 'Turnstile request failed' });
});
```

- [ ] **Step 7: Time-bound Siteverify**

Modify `verifyTurnstile` to accept `timeoutMs = 8_000` and replace its direct `fetchImpl` call with:

```js
res = await fetchWithTimeout(fetchImpl, SITEVERIFY, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body,
}, timeoutMs);
```

Import `fetchWithTimeout` from `./http.js` and retain the existing fail-closed response.

- [ ] **Step 8: Run adapter tests and update existing URL expectations**

Run: `npx vitest run tests/sheets.test.js tests/turnstile.test.js`

Expected: PASS after existing mock matchers use `decodeURIComponent(url)` and include one header-response route before ID lookup routes.

- [ ] **Step 9: Commit the destination reliability contract**

```bash
git add functions/lib/sheets.js functions/lib/turnstile.js tests/sheets.test.js tests/turnstile.test.js
git commit -m "fix(middleware): classify Google failures truthfully"
```

---

### Task 3: One-time owner OAuth and spreadsheet provisioning

**Files:**
- Create: `scripts/lib/google-owner-setup.js`
- Create: `scripts/setup-google-owner.mjs`
- Create: `tests/owner-setup.test.js`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `DRIVE_FILE_SCOPE`, `SHEET_HEADERS`, `OAuth2Client` and the global OAuth secret names.
- Produces: a repeatable local setup command, an owner-created and protected spreadsheet and a mode-`0600` `.dev.vars` containing the four Google deployment values.

- [ ] **Step 1: Write tests for authorization URL generation**

Create `tests/owner-setup.test.js` with the following first section:

```js
import { describe, expect, test, vi } from 'vitest';
import {
  OWNER_REDIRECT_URI,
  createInterestSpreadsheet,
  createOwnerAuthUrl,
  mergeDevVars,
  protectInterestSheet,
  verifyInterestSpreadsheet,
} from '../scripts/lib/google-owner-setup.js';
import { SHEET_HEADERS } from '../functions/lib/sheets.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

describe('createOwnerAuthUrl', () => {
  test('requests offline drive.file access with state and explicit consent', () => {
    const client = { generateAuthUrl: vi.fn(() => 'https://accounts.example/auth') };
    expect(createOwnerAuthUrl({ client, state: 'state-123' })).toBe('https://accounts.example/auth');
    expect(client.generateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      state: 'state-123',
    });
    expect(OWNER_REDIRECT_URI).toBe('http://127.0.0.1:53682/oauth2/callback');
  });
});
```

- [ ] **Step 2: Add spreadsheet creation, protection and verification tests**

Append to `tests/owner-setup.test.js`:

```js
describe('spreadsheet provisioning', () => {
  test('creates the fixed title, tab, frozen header and five columns', async () => {
    const fetchImpl = createMockFetch([{
      match: (url, init) => url.endsWith('/v4/spreadsheets') && init.method === 'POST',
      response: async (_url, init) => {
        const body = JSON.parse(init.body);
        expect(body.properties.title).toBe('TCCANE Interest Submissions');
        expect(body.sheets[0].properties).toEqual(expect.objectContaining({
          title: 'Submissions',
          gridProperties: expect.objectContaining({ columnCount: 5, frozenRowCount: 1 }),
        }));
        expect(body.sheets[0].data[0].rowData[0].values.map(
          (cell) => cell.userEnteredValue.stringValue,
        )).toEqual(SHEET_HEADERS);
        return jsonResponse(200, {
          spreadsheetId: 'sheet-1', sheets: [{ properties: { sheetId: 42 } }],
        });
      },
    }]);
    await expect(createInterestSpreadsheet({
      fetchImpl,
      getAccessToken: async () => 'token',
      title: 'TCCANE Interest Submissions',
    })).resolves.toEqual({ spreadsheetId: 'sheet-1', sheetId: 42 });
  });

  test('protects the raw A:E integration range', async () => {
    const fetchImpl = createMockFetch([{
      match: (url) => url.endsWith('/sheet-1:batchUpdate'),
      response: async (_url, init) => {
        expect(JSON.parse(init.body)).toEqual({ requests: [{ addProtectedRange: {
          protectedRange: {
            description: 'Application-managed interest submission columns',
            warningOnly: false,
            range: { sheetId: 42, startColumnIndex: 0, endColumnIndex: 5 },
          },
        } }] });
        return jsonResponse(200, {});
      },
    }]);
    await expect(protectInterestSheet({
      fetchImpl,
      getAccessToken: async () => 'token',
      spreadsheetId: 'sheet-1',
      sheetId: 42,
    })).resolves.toBeUndefined();
  });

  test('verifies the exact header row', async () => {
    const fetchImpl = createMockFetch([{
      match: (url) => decodeURIComponent(url).includes("'Submissions'!A1:E1"),
      response: jsonResponse(200, { values: [SHEET_HEADERS] }),
    }]);
    await expect(verifyInterestSpreadsheet({
      fetchImpl,
      getAccessToken: async () => 'token',
      spreadsheetId: 'sheet-1',
    })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Add a secret-file merge test**

Append:

```js
describe('mergeDevVars', () => {
  test('preserves unrelated values and replaces every Google owner value', () => {
    const merged = mergeDevVars('TURNSTILE_SKIP=true\nGOOGLE_SERVICE_ACCOUNT=old\n', {
      GOOGLE_OAUTH_CLIENT_ID: 'client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
      GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh-token',
      GOOGLE_SPREADSHEET_ID: 'sheet-1',
      GOOGLE_SHEET_TAB: 'Submissions',
    });
    expect(merged).toContain('TURNSTILE_SKIP=true');
    expect(merged).not.toContain('GOOGLE_SERVICE_ACCOUNT');
    expect(merged).toContain('GOOGLE_OAUTH_REFRESH_TOKEN="refresh-token"');
  });
});
```

- [ ] **Step 4: Run setup tests and confirm failure**

Run: `npx vitest run tests/owner-setup.test.js`

Expected: FAIL because `scripts/lib/google-owner-setup.js` does not exist.

- [ ] **Step 5: Implement the pure setup helpers**

Create `scripts/lib/google-owner-setup.js`. Use `DRIVE_FILE_SCOPE`, `SHEET_HEADERS` and direct authenticated REST calls. The creation request must contain:

```js
export const OWNER_REDIRECT_URI = 'http://127.0.0.1:53682/oauth2/callback';

export function createOwnerAuthUrl({ client, state }) {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_FILE_SCOPE],
    state,
  });
}

export async function createInterestSpreadsheet({
  fetchImpl, getAccessToken, title = 'TCCANE Interest Submissions',
}) {
  const token = await getAccessToken();
  const response = await fetchImpl('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [{
        properties: {
          title: 'Submissions',
          gridProperties: { rowCount: 1000, columnCount: 5, frozenRowCount: 1 },
        },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{ values: SHEET_HEADERS.map((header) => ({
            userEnteredValue: { stringValue: header },
            userEnteredFormat: { textFormat: { bold: true } },
          })) }],
        }],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Spreadsheet creation failed with HTTP ${response.status}`);
  const data = await response.json();
  return { spreadsheetId: data.spreadsheetId, sheetId: data.sheets[0].properties.sheetId };
}
```

Implement `protectInterestSheet` with the exact `batchUpdate` body asserted above. Implement `verifyInterestSpreadsheet` as an authenticated GET of encoded range `'Submissions'!A1:E1`; throw `Spreadsheet header verification failed` unless the response row exactly equals `SHEET_HEADERS`.

Implement `mergeDevVars` by removing lines whose names are `GOOGLE_SERVICE_ACCOUNT` or keys present in `values`, retaining all unrelated lines then appending each new entry as `${name}=${JSON.stringify(value)}` followed by one newline. This preserves Turnstile development settings and eliminates the obsolete service-account secret.

- [ ] **Step 6: Run setup helper tests**

Run: `npx vitest run tests/owner-setup.test.js`

Expected: PASS.

- [ ] **Step 7: Implement the loopback owner setup command**

Create `scripts/setup-google-owner.mjs` using this loopback callback and orchestration:

```js
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
```

Do not open a browser automatically and do not print the refresh token or client secret. The listener remains bound to `127.0.0.1`, validates state in constant time and closes on success, OAuth error or timeout.

- [ ] **Step 8: Add the setup command and local secret guard**

Add to `package.json`:

```json
"setup:google": "node scripts/setup-google-owner.mjs"
```

Ensure `.gitignore` contains `.dev.vars`. Add `.owner-setup-*` so any interrupted local setup artifact cannot be committed.

- [ ] **Step 9: Run tests and a missing-config CLI check**

Run: `npx vitest run tests/owner-setup.test.js`

Expected: PASS.

Run: `npm run setup:google`

Expected: exits nonzero with `GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required` before starting a listener or writing a file.

- [ ] **Step 10: Commit the owner setup flow**

```bash
git add scripts/lib/google-owner-setup.js scripts/setup-google-owner.mjs tests/owner-setup.test.js package.json .gitignore
git commit -m "feat(setup): provision the owner Google Sheet"
```

---

### Task 4: Migrate the Pages handler to owner OAuth

**Files:**
- Modify: `functions/lib/handler.js`
- Modify: `tests/handler.test.js`
- Modify: `.dev.vars.example`

**Interfaces:**
- Consumes: `oauthConfigFromEnv`, `createTokenProvider` and the updated `writeSubmission` from Tasks 1 and 2.
- Produces: the unchanged `handleInterestPost(request, env, deps)` public interface with truthful permanent and retryable behavior.

- [ ] **Step 1: Replace handler test configuration**

Change `envBase` in `tests/handler.test.js` to:

```js
function envBase(over = {}) {
  return {
    GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh-token',
    GOOGLE_SPREADSHEET_ID: 'spreadsheet-1',
    GOOGLE_SHEET_TAB: 'Submissions',
    TURNSTILE_SECRET_KEY: 'ts-secret',
    TURNSTILE_SKIP: 'true',
    RATE_LIMIT_MAX: '5',
    RATE_LIMIT_WINDOW_SECONDS: '600',
    RATE_LIMIT_KV: createMemoryKv(),
    DLQ_KV: createMemoryKv(),
    ...over,
  };
}
```

Update `sheetsFetch` so its routes return exact headers for `A1:E1`, ID values for `A:A` and append status for `:append`.

- [ ] **Step 2: Add missing-OAuth and invalid-grant tests**

Replace service-account validation tests with:

```js
test.each([
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GOOGLE_SPREADSHEET_ID',
])('500 when %s is missing', async (name) => {
  const env = envBase({ [name]: '' });
  const res = await handleInterestPost(post(valid), env, { fetchImpl: createMockFetch([]), ...deps() });
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'Server misconfigured' });
});

test('502 without enqueue when owner authorization is revoked', async () => {
  const env = envBase();
  const getAccessToken = async () => {
    throw new GoogleAuthError('invalid_grant', { retryable: false, status: 400 });
  };
  const res = await handleInterestPost(post(valid), env, {
    fetchImpl: createMockFetch([]), ...deps({ getAccessToken }),
  });
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: 'Submission failed' });
  expect((await env.DLQ_KV.list({ prefix: 'dlq:' })).keys).toHaveLength(0);
});

test('502 without enqueue when the sheet headers drift', async () => {
  const env = envBase();
  const fetchImpl = createMockFetch([{
    match: () => true,
    response: jsonResponse(200, { values: [['wrong']] }),
  }]);
  const res = await handleInterestPost(post(valid), env, { fetchImpl, ...deps() });
  expect(res.status).toBe(502);
  expect((await env.DLQ_KV.list({ prefix: 'dlq:' })).keys).toHaveLength(0);
});
```

Import `GoogleAuthError` in the test. Keep the existing recorded, accepted, validation, rate-limit, Turnstile and failed-enqueue cases.

- [ ] **Step 3: Run handler tests and confirm failure**

Run: `npx vitest run tests/handler.test.js`

Expected: FAIL because the handler still requires `GOOGLE_SERVICE_ACCOUNT`.

- [ ] **Step 4: Replace the service-account configuration guard**

In `functions/lib/handler.js`, delete `isValidServiceAccount`. At the beginning of `handleInterestPost`, after the method check, use:

```js
const oauth = oauthConfigFromEnv(env);
if (!oauth.ok || !env.GOOGLE_SPREADSHEET_ID) {
  warn('misconfigured', { missing: oauth.ok ? ['GOOGLE_SPREADSHEET_ID'] : oauth.missing });
  return json(500, { error: 'Server misconfigured' });
}
const getAccessToken = deps.getAccessToken || createTokenProvider(oauth.value);
```

Keep KV, Turnstile and request validation checks unchanged. Pass `deps.googleTimeoutMs ?? 8_000` to `writeSubmission` as `timeoutMs`.

- [ ] **Step 5: Make public failure copy destination-neutral**

Use exactly these API responses:

```js
// Retryable write + successful enqueue
return json(200, { ok: true, status: 'accepted' });

// Retryable write + failed enqueue
return json(503, { error: 'Submission temporarily unavailable' });

// Permanent Google/configuration failure
return json(502, { error: 'Submission failed' });
```

Log permanent codes with `warn('submission_permanent_failure', { submissionId, code: result.code })`. For invalid auth use the event name `google_auth_permanent`; for schema drift use `sheet_contract_invalid`. Do not log `fp`, email, names or raw errors.

- [ ] **Step 6: Replace the local example configuration**

Replace `.dev.vars.example` with:

```dotenv
GOOGLE_OAUTH_CLIENT_ID="client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="local-owner-setup-value"
GOOGLE_OAUTH_REFRESH_TOKEN="local-owner-setup-value"
GOOGLE_SPREADSHEET_ID="owner-setup-created-id"
GOOGLE_SHEET_TAB="Submissions"
TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
TURNSTILE_SKIP="false"
```

These are Cloudflare's documented always-pass test widget values and conspicuous non-production Google examples. No service-account key remains.

- [ ] **Step 7: Run handler and full middleware tests**

Run: `npx vitest run tests/handler.test.js tests/google-token.test.js tests/sheets.test.js`

Expected: PASS.

Run: `npm test`

Expected: retry-worker tests still fail on service-account environment values; Task 6 resolves them.

- [ ] **Step 8: Commit the Pages authentication migration**

```bash
git add functions/lib/handler.js tests/handler.test.js .dev.vars.example
git commit -m "feat(middleware): authorize Sheets as the personal owner"
```

---

### Task 5: Harden KV retry retention, pagination and operational signals

**Files:**
- Modify: `functions/lib/dlq.js`
- Modify: `functions/lib/log.js`
- Modify: `tests/dlq.test.js`
- Modify: `tests/helpers/memory-kv.js`

**Interfaces:**
- Consumes: existing retry record shape and stable `submissionId`.
- Produces: cursor-aware `listDue`, 24-hour poisoning, 30-day TTL, `queueHealth` and PII-free structured logging.
- Consumed by: Task 6.

- [ ] **Step 1: Upgrade the memory KV test double for cursor pagination**

Add a cursor-aware list implementation to `tests/helpers/memory-kv.js`:

```js
async list({ prefix = '', limit = 1000, cursor } = {}) {
  const names = [...store.keys()]
    .filter((key) => !key.endsWith('__meta') && key.startsWith(prefix))
    .sort();
  const start = cursor ? Number(cursor) : 0;
  const page = names.slice(start, start + limit);
  const next = start + page.length;
  return {
    keys: page.map((name) => ({ name })),
    list_complete: next >= names.length,
    cursor: next >= names.length ? '' : String(next),
    cacheStatus: null,
  };
}
```

Expose TTL metadata through a test-only `_expirationTtl(key)` method that reads `${key}__meta` and returns its `expirationTtl`.

- [ ] **Step 2: Write pagination, age, TTL and health tests**

Add to `tests/dlq.test.js`:

```js
test('listDue paginates past poisoned records', async () => {
  const kv = createMemoryKv();
  for (let i = 0; i < 1001; i += 1) {
    await kv.put(`dlq:${String(i).padStart(4, '0')}`, JSON.stringify({
      id: String(i), payload: {}, poisoned: true, createdAt: 0, nextAttemptAt: 0,
    }));
  }
  await kv.put('dlq:zzzz', JSON.stringify({
    id: 'due', payload: {}, poisoned: false, createdAt: 0, nextAttemptAt: 0,
  }));
  expect((await listDue({ kv, nowMs: 1, limit: 20 })).map((item) => item.id)).toEqual(['due']);
});

test('enqueue applies a 30-day TTL', async () => {
  const kv = createMemoryKv();
  const { id } = await enqueueFailure({
    kv,
    payload: { submissionId: 'sub-1', submittedAtUtc: '2026-08-06T00:00:00Z', firstName: 'A', lastName: 'B', email: 'a@b.co' },
    error: 'sheets_http_503',
    nowMs: 0,
  });
  expect(kv._expirationTtl(`dlq:${id}`)).toBe(30 * 24 * 60 * 60);
});

test('records older than 24 hours are poisoned instead of returned due', async () => {
  const kv = createMemoryKv();
  const { id } = await enqueueFailure({ kv, payload: {}, error: 'down', nowMs: 0 });
  expect(await listDue({ kv, nowMs: 24 * 60 * 60 * 1000 + 1, limit: 20 })).toEqual([]);
  expect((await kv.get(`dlq:${id}`, 'json')).poisoned).toBe(true);
});

test('queueHealth reports depth and oldest age without exposing payloads', async () => {
  const kv = createMemoryKv();
  await kv.put('dlq:a', JSON.stringify({ id: 'a', createdAt: 100, poisoned: false }));
  await kv.put('dlq:b', JSON.stringify({ id: 'b', createdAt: 200, poisoned: true }));
  expect(await queueHealth({ kv, nowMs: 1_100 })).toEqual({
    queued: 1, poisoned: 1, oldestAgeMs: 1_000,
  });
});
```

- [ ] **Step 3: Run DLQ tests and confirm failure**

Run: `npx vitest run tests/dlq.test.js`

Expected: FAIL because pagination, TTL enforcement, maximum age and `queueHealth` are absent.

- [ ] **Step 4: Implement bounded retention and cursor scans**

In `functions/lib/dlq.js`, define:

```js
const RECORD_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_RETRY_AGE_MS = 24 * 60 * 60 * 1000;
```

Every `kv.put` for a retry or poison record must pass `{ expirationTtl: RECORD_TTL_SECONDS }`. Refactor `listDue` and `queueHealth` around this complete scan pattern:

```js
async function scanRecords(kv, visit) {
  let cursor;
  do {
    const page = await kv.list({ prefix: PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const { name } of page.keys) {
      const record = await kv.get(name, 'json');
      if (record) await visit(record);
    }
    cursor = page.list_complete ? '' : page.cursor;
  } while (cursor);
}
```

During `listDue`, poison records where `nowMs - createdAt > MAX_RETRY_AGE_MS`, skip existing poison records, collect due records then sort by `nextAttemptAt`, `createdAt` and `id` before slicing to `limit`.

Implement `queueHealth` by scanning all records, counting poison and non-poison records and calculating the largest nonnegative `nowMs - createdAt`.

- [ ] **Step 5: Remove the email fingerprint logger**

Replace `functions/lib/log.js` with only:

```js
function write(method, level, event, fields) {
  console[method](JSON.stringify({ level, event, ...fields }));
}

export function info(event, fields = {}) {
  write('log', 'info', event, fields);
}

export function warn(event, fields = {}) {
  write('warn', 'warn', event, fields);
}
```

Remove all `emailFingerprint` imports and calls. Handler and retry logs use `submissionId`, error `code`, queue counts and ages only.

- [ ] **Step 6: Run DLQ and handler tests**

Run: `npx vitest run tests/dlq.test.js tests/handler.test.js`

Expected: PASS after log imports are updated.

- [ ] **Step 7: Commit retry storage hardening**

```bash
git add functions/lib/dlq.js functions/lib/log.js tests/dlq.test.js tests/helpers/memory-kv.js functions/lib/handler.js
git commit -m "fix(middleware): bound and observe queued submissions"
```

---

### Task 6: Deployable scheduled retry Worker

**Files:**
- Modify: `functions/scheduled/retry-dlq.js`
- Modify: `tests/retry-dlq.test.js`
- Create: `wrangler.retry.toml`
- Modify: `wrangler.toml`
- Modify: `package.json`

**Interfaces:**
- Consumes: owner OAuth configuration, `writeSubmission`, `listDue`, `queueHealth`, `markAttempt` and `poisonRecord`.
- Produces: `processDlqBatch(env, deps)` and an independently deployable five-minute `scheduled()` Worker.

- [ ] **Step 1: Replace retry test environment with owner OAuth**

Change `envBase` in `tests/retry-dlq.test.js` to:

```js
function envBase() {
  return {
    DLQ_KV: createMemoryKv(),
    GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh-token',
    GOOGLE_SPREADSHEET_ID: 'spreadsheet-1',
    GOOGLE_SHEET_TAB: 'Submissions',
  };
}
```

Update every success mock to return exact headers for `A1:E1`, ID values for `A:A` then append success.

- [ ] **Step 2: Add permanent-auth and queue-health tests**

Add:

```js
test('poisons without append when owner authorization is revoked', async () => {
  const env = envBase();
  await queued({ kv: env.DLQ_KV });
  const getAccessToken = async () => {
    throw new GoogleAuthError('invalid_grant', { retryable: false, status: 400 });
  };
  const summary = await processDlqBatch(env, {
    fetchImpl: createMockFetch([]), getAccessToken, nowMs: 0, limit: 20,
  });
  expect(summary).toEqual(expect.objectContaining({ processed: 1, poisoned: 1 }));
  const listed = await env.DLQ_KV.list({ prefix: 'dlq:' });
  expect((await env.DLQ_KV.get(listed.keys[0].name, 'json')).lastError).toBe('permanent:invalid_grant');
});

test('reports an overdue queue when oldest age exceeds 15 minutes', async () => {
  const env = envBase();
  await queued({ kv: env.DLQ_KV });
  const result = await processDlqBatch(env, {
    fetchImpl: createMockFetch([]),
    getAccessToken: async () => { throw new GoogleAuthError('token_timeout', { retryable: true, status: 0 }); },
    nowMs: 16 * 60 * 1000,
    limit: 20,
  });
  expect(result.oldestAgeMs).toBeGreaterThan(15 * 60 * 1000);
});
```

Import `GoogleAuthError`. Assert logs by spying on `console.warn` and matching event names `google_auth_permanent`, `dlq_poisoned` and `dlq_oldest_age_exceeded` without matching the queued email address.

- [ ] **Step 3: Run retry tests and confirm failure**

Run: `npx vitest run tests/retry-dlq.test.js`

Expected: FAIL because the Worker still constructs a service-account provider and does not return health fields.

- [ ] **Step 4: Migrate retry processing to owner OAuth**

At the start of `processDlqBatch`:

```js
const oauth = oauthConfigFromEnv(env);
if (!oauth.ok || !env.GOOGLE_SPREADSHEET_ID || !env.DLQ_KV) {
  warn('retry_worker_misconfigured', {
    missing: oauth.ok ? ['GOOGLE_SPREADSHEET_ID or DLQ_KV'] : oauth.missing,
  });
  return { processed: 0, succeeded: 0, failed: 0, poisoned: 0, queued: 0, oldestAgeMs: 0 };
}
const getAccessToken = deps.getAccessToken || createTokenProvider(oauth.value);
```

Keep records sequential. On permanent failure, store `permanent:${result.code}` rather than a raw response. Emit `google_auth_permanent` for `invalid_grant`, `invalid_client` or `unauthorized_client`; emit `sheet_contract_invalid` for header drift and `dlq_poisoned` for every newly poisoned record.

After the batch, call `queueHealth`. Return:

```js
{
  processed,
  succeeded,
  failed,
  poisoned,
  queued: health.queued,
  oldestAgeMs: health.oldestAgeMs,
}
```

Emit `dlq_oldest_age_exceeded` when `oldestAgeMs > 15 * 60 * 1000`.

- [ ] **Step 5: Add a real standalone Worker configuration**

Create `wrangler.retry.toml`:

```toml
name = "tccane-interest-retry"
main = "functions/scheduled/retry-dlq.js"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "DLQ_KV"

[vars]
GOOGLE_SHEET_TAB = "Submissions"

[triggers]
crons = ["*/5 * * * *"]
```

Before the first dry run, execute `npx wrangler kv namespace list`, identify the already deployed Pages `DLQ_KV` namespace then add its exact `id` and `preview_id` assignments below `binding` in both Wrangler files. Verify the two files match byte-for-byte for both IDs. Do not create a second DLQ namespace.

Remove the obsolete comment in `wrangler.toml` that describes the Worker as optional.

- [ ] **Step 6: Add retry development and deployment commands**

Add to `package.json`:

```json
"retry:dev": "wrangler dev --config wrangler.retry.toml --test-scheduled",
"retry:deploy": "wrangler deploy --config wrangler.retry.toml"
```

- [ ] **Step 7: Run retry tests and validate both Wrangler configs**

Run: `npx vitest run tests/retry-dlq.test.js tests/dlq.test.js`

Expected: PASS.

Run: `npx wrangler deploy --dry-run --config wrangler.retry.toml --outdir /tmp/tccane-retry-dry-run`

Expected: successful bundle with `scheduled` handler. If the command rejects the existing explicit KV IDs, first provision the real namespace and substitute the exact IDs as described in Step 5.

- [ ] **Step 8: Commit the scheduled delivery path**

```bash
git add functions/scheduled/retry-dlq.js tests/retry-dlq.test.js wrangler.retry.toml wrangler.toml package.json
git commit -m "feat(worker): deploy queued interest retries"
```

---

### Task 7: Public Turnstile configuration and inline form markup

**Files:**
- Create: `functions/api/config.js`
- Create: `tests/config.test.js`
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Produces: `GET /api/config -> { turnstileSiteKey: string }` and DOM IDs consumed by Task 8.
- Consumed by: `initInterestForm` in Task 8.

- [ ] **Step 1: Write config endpoint tests**

Create `tests/config.test.js`:

```js
import { describe, expect, test } from 'vitest';
import { onRequestGet } from '../functions/api/config.js';

describe('GET /api/config', () => {
  test('returns only the public Turnstile site key', async () => {
    const response = await onRequestGet({ env: {
      TURNSTILE_SITE_KEY: 'site-key',
      TURNSTILE_SECRET_KEY: 'must-not-leak',
      GOOGLE_OAUTH_REFRESH_TOKEN: 'must-not-leak',
    } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ turnstileSiteKey: 'site-key' });
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });

  test('fails closed when site key is missing', async () => {
    const response = await onRequestGet({ env: {} });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server misconfigured' });
  });
});
```

- [ ] **Step 2: Run config tests and confirm failure**

Run: `npx vitest run tests/config.test.js`

Expected: FAIL because `functions/api/config.js` does not exist.

- [ ] **Step 3: Implement the public config endpoint**

Create `functions/api/config.js`:

```js
function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export async function onRequestGet({ env }) {
  if (typeof env.TURNSTILE_SITE_KEY !== 'string' || !env.TURNSTILE_SITE_KEY.trim()) {
    return json(500, { error: 'Server misconfigured' });
  }
  return json(200, { turnstileSiteKey: env.TURNSTILE_SITE_KEY.trim() }, {
    'cache-control': 'public, max-age=300',
  });
}
```

Do not implement `POST`, do not echo other environment values and do not include OAuth state.

- [ ] **Step 4: Run config tests and confirm success**

Run: `npx vitest run tests/config.test.js`

Expected: PASS, 2 tests.

- [ ] **Step 5: Add the accessible form to “Get involved”**

Replace the current primary contact-button row in `index.html` with this structure while retaining the three existing links immediately after the form as secondary actions:

```html
<div class="interest-panel" id="interest-panel">
  <form class="interest-form" id="interest-form" novalidate>
    <div class="interest-form__heading">
      <h3>Tell us you're interested</h3>
      <p>Share your contact information and a Northeast Regional Advisor will follow up.</p>
    </div>
    <div class="interest-form__fields">
      <div class="interest-field">
        <label for="interest-first-name">First name</label>
        <input id="interest-first-name" name="firstName" type="text" autocomplete="given-name" maxlength="100" required>
      </div>
      <div class="interest-field">
        <label for="interest-last-name">Last name</label>
        <input id="interest-last-name" name="lastName" type="text" autocomplete="family-name" maxlength="100" required>
      </div>
      <div class="interest-field interest-field--wide">
        <label for="interest-email">Email address</label>
        <input id="interest-email" name="email" type="email" autocomplete="email" maxlength="254" required>
      </div>
    </div>
    <div class="interest-form__trap" aria-hidden="true">
      <label for="interest-company">Company</label>
      <input id="interest-company" name="company" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div id="interest-turnstile" class="interest-form__turnstile"></div>
    <p id="interest-form-status" class="interest-form__status" role="status" aria-live="polite"></p>
    <button id="interest-submit" class="btn btn--primary btn--lg" type="submit">
      <span class="interest-submit__idle">Send my interest</span>
      <span class="interest-submit__busy" hidden>Sending…</span>
    </button>
  </form>
  <section id="interest-success" class="interest-success" tabindex="-1" hidden aria-labelledby="interest-success-title">
    <h3 id="interest-success-title">Thank you for reaching out.</h3>
    <p>A Northeast Regional Advisor will follow up using the email you provided.</p>
  </section>
</div>
```

Change the final script tag to `<script type="module" src="app.js"></script>` so Task 8 can import the controller.

- [ ] **Step 6: Add responsive form styling**

Add focused component classes to `styles.css` rather than inline form styles. Required behaviors:

```css
.interest-panel { max-width: 760px; margin: 2rem auto 1.5rem; text-align: left; }
.interest-form { position: relative; padding: clamp(1.25rem, 3vw, 2rem); border: 1px solid rgba(255,255,255,.22); border-radius: var(--tc-radius-lg); background: rgba(255,255,255,.08); }
.interest-form__fields { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 1rem; }
.interest-field { display: grid; gap: .4rem; }
.interest-field--wide { grid-column: 1 / -1; }
.interest-field input { width: 100%; min-height: 46px; border: 1px solid rgba(255,255,255,.38); border-radius: var(--tc-radius-sm); padding: .7rem .8rem; color: var(--tc-navy-deep); background: var(--tc-white); font: inherit; }
.interest-field input:focus-visible { outline: 3px solid var(--tc-sky); outline-offset: 2px; }
.interest-form__trap { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
.interest-form__status { min-height: 1.5em; color: var(--tc-cloud); }
.interest-form__status[data-state="error"] { color: #ffe3e3; }
.interest-success { padding: clamp(1.5rem, 4vw, 2.5rem); border-radius: var(--tc-radius-lg); background: rgba(255,255,255,.12); text-align: center; }
@media (max-width: 600px) { .interest-form__fields { grid-template-columns: 1fr; } .interest-field--wide { grid-column: auto; } }
```

Use existing design tokens where available. Do not alter unrelated page components.

- [ ] **Step 7: Add a static markup assertion**

Add to `tests/config.test.js` using `readFileSync`:

```js
test('index contains the complete interest form contract', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const value of ['interest-form', 'interest-first-name', 'interest-last-name', 'interest-email', 'interest-company', 'interest-turnstile', 'interest-success']) {
    expect(html).toContain(`id="${value}"`);
  }
  expect(html).toContain('type="module" src="app.js"');
});
```

- [ ] **Step 8: Run endpoint and markup tests**

Run: `npx vitest run tests/config.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 9: Commit the form surface**

```bash
git add functions/api/config.js tests/config.test.js index.html styles.css
git commit -m "feat(site): add the inline interest form"
```

---

### Task 8: Browser submission and Turnstile state machine

**Files:**
- Create: `interest-form.js`
- Create: `tests/interest-form.test.js`
- Modify: `app.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: DOM IDs and `GET /api/config` from Task 7 and existing `POST /api/interest` JSON responses.
- Produces: `initInterestForm` and the complete idle → submitting → success/failure interaction.

- [ ] **Step 1: Install jsdom as a test-only dependency**

Run: `npm install --save-dev jsdom`

Expected: `package.json` and `package-lock.json` add jsdom under development dependencies only. No browser production dependency is introduced.

- [ ] **Step 2: Write the form fixture and Turnstile fake**

Create `tests/interest-form.test.js` beginning with:

```js
// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { initInterestForm } from '../interest-form.js';

function fixture() {
  document.body.innerHTML = `
    <form id="interest-form">
      <input name="firstName" value="Ada" required>
      <input name="lastName" value="Lovelace" required>
      <input name="email" type="email" value="ada@college.edu" required>
      <input name="company" value="">
      <div id="interest-turnstile"></div>
      <p id="interest-form-status"></p>
      <button id="interest-submit" type="submit"><span class="interest-submit__idle">Send</span><span class="interest-submit__busy" hidden>Sending</span></button>
    </form>
    <section id="interest-success" tabindex="-1" hidden><h3>Thanks</h3></section>`;
}

function turnstileFake() {
  let options;
  return {
    render: vi.fn((_container, next) => { options = next; return 'widget-1'; }),
    reset: vi.fn(),
    solve(token = 'turnstile-token') { options.callback(token); },
  };
}

beforeEach(() => fixture());
```

- [ ] **Step 3: Add success-state tests**

Append:

```js
test.each(['recorded', 'accepted'])('%s replaces the form with persistent success', async (status) => {
  const turnstileApi = turnstileFake();
  const fetchImpl = vi.fn(async (url, init) => {
    if (url === '/api/config') return new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 });
    expect(url).toBe('/api/interest');
    expect(JSON.parse(init.body)).toEqual({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@college.edu', company: '', turnstileToken: 'turnstile-token',
    });
    return new Response(JSON.stringify({ ok: true, status }), { status: 200 });
  });
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  turnstileApi.solve();
  document.getElementById('interest-form').requestSubmit();
  await vi.waitFor(() => expect(document.getElementById('interest-success').hidden).toBe(false));
  expect(document.getElementById('interest-form').hidden).toBe(true);
  expect(turnstileApi.reset).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Add failure, token-reset and double-submit tests**

Append:

```js
test('permanent failure retains fields, resets Turnstile and permits retry', async () => {
  const turnstileApi = turnstileFake();
  const fetchImpl = vi.fn(async (url) => url === '/api/config'
    ? new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 })
    : new Response(JSON.stringify({ error: 'Submission failed' }), { status: 502 }));
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  turnstileApi.solve();
  document.getElementById('interest-form').requestSubmit();
  await vi.waitFor(() => expect(turnstileApi.reset).toHaveBeenCalledWith('widget-1'));
  expect(document.querySelector('[name="email"]').value).toBe('ada@college.edu');
  expect(document.getElementById('interest-submit').disabled).toBe(false);
  expect(document.getElementById('interest-success').hidden).toBe(true);
  expect(document.getElementById('interest-form-status').dataset.state).toBe('error');
});

test('submitting state ignores a second submit', async () => {
  const turnstileApi = turnstileFake();
  let resolvePost;
  const fetchImpl = vi.fn(async (url) => {
    if (url === '/api/config') return new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 });
    return new Promise((resolve) => { resolvePost = resolve; });
  });
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  turnstileApi.solve();
  const form = document.getElementById('interest-form');
  form.requestSubmit();
  form.requestSubmit();
  expect(fetchImpl.mock.calls.filter(([url]) => url === '/api/interest')).toHaveLength(1);
  resolvePost(new Response(JSON.stringify({ ok: true, status: 'recorded' }), { status: 200 }));
});
```

Also test that a missing Turnstile token shows `Please complete the verification.` without posting and that 403, 429 and 503 responses all keep the form available.

- [ ] **Step 5: Run form tests and confirm failure**

Run: `npx vitest run tests/interest-form.test.js`

Expected: FAIL because `interest-form.js` does not exist.

- [ ] **Step 6: Implement Turnstile loading**

In `interest-form.js`, add a default loader that creates only one script:

```js
function defaultLoadTurnstile(documentRef) {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  return new Promise((resolve, reject) => {
    const existing = documentRef.querySelector('script[data-interest-turnstile]');
    const script = existing || documentRef.createElement('script');
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.interestTurnstile = '';
      documentRef.head.append(script);
    }
    script.addEventListener('load', () => resolve(globalThis.turnstile), { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true });
  });
}
```

- [ ] **Step 7: Implement `initInterestForm`**

Add the controller below `defaultLoadTurnstile`:

```js
const ERROR_COPY = {
  400: 'Please check your information and try again.',
  403: 'Verification expired. Please complete it again.',
  429: 'Too many attempts. Please wait a few minutes and try again.',
  default: 'We could not send your information. Please try again or email an advisor.',
};

export async function initInterestForm({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  turnstileApi,
  loadTurnstile = defaultLoadTurnstile,
} = {}) {
  const form = documentRef?.getElementById('interest-form');
  if (!form) return null;
  const status = documentRef.getElementById('interest-form-status');
  const submit = documentRef.getElementById('interest-submit');
  const idleLabel = submit.querySelector('.interest-submit__idle');
  const busyLabel = submit.querySelector('.interest-submit__busy');
  const success = documentRef.getElementById('interest-success');
  const configResponse = await fetchImpl('/api/config', { headers: { Accept: 'application/json' } });
  const config = await configResponse.json().catch(() => null);
  if (!configResponse.ok || typeof config?.turnstileSiteKey !== 'string' || !config.turnstileSiteKey) {
    throw new Error('Turnstile configuration unavailable');
  }
  const api = turnstileApi || await loadTurnstile(documentRef);
  let token = '';
  let submitting = false;
  const widgetId = api.render('#interest-turnstile', {
    sitekey: config.turnstileSiteKey,
    callback: (value) => { token = value; status.textContent = ''; },
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; },
  });

  const setBusy = (busy) => {
    submitting = busy;
    submit.disabled = busy;
    submit.setAttribute('aria-busy', String(busy));
    idleLabel.hidden = busy;
    busyLabel.hidden = !busy;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!token) {
      status.dataset.state = 'error';
      status.textContent = 'Please complete the verification.';
      return;
    }
    setBusy(true);
    status.dataset.state = 'submitting';
    status.textContent = 'Sending your information…';
    const data = new FormData(form);
    try {
      const response = await fetchImpl('/api/interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          firstName: String(data.get('firstName') || ''),
          lastName: String(data.get('lastName') || ''),
          email: String(data.get('email') || ''),
          company: String(data.get('company') || ''),
          turnstileToken: token,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true || !['recorded', 'accepted'].includes(body.status)) {
        const failure = new Error('Submission failed');
        failure.status = response.status;
        throw failure;
      }
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (error) {
      token = '';
      api.reset(widgetId);
      status.dataset.state = 'error';
      status.textContent = ERROR_COPY[error?.status] || ERROR_COPY.default;
      setBusy(false);
    }
  };

  form.addEventListener('submit', onSubmit);
  return { destroy() { form.removeEventListener('submit', onSubmit); } };
}
```

This implementation has no timer, retry loop or repeated fetch path. It retains visible field values on failure because it never resets the form.

- [ ] **Step 8: Initialize the controller from the existing app entry**

At the top of `app.js`:

```js
import { initInterestForm } from './interest-form.js';
```

Inside the existing `DOMContentLoaded` callback:

```js
initInterestForm().catch(() => {
  const status = document.getElementById('interest-form-status');
  if (status) {
    status.dataset.state = 'error';
    status.textContent = 'The form is temporarily unavailable. Please email an advisor.';
  }
});
```

Do not alter navigation or reveal behavior.

- [ ] **Step 9: Run browser and regression tests**

Run: `npx vitest run tests/interest-form.test.js tests/config.test.js`

Expected: PASS.

Run: `npm test`

Expected: PASS across browser and middleware suites.

- [ ] **Step 10: Commit the visitor interaction**

```bash
git add interest-form.js app.js tests/interest-form.test.js package.json package-lock.json
git commit -m "feat(site): submit interest from the embedded form"
```

---

### Task 9: Secret hygiene, operating runbook and end-to-end verification

**Files:**
- Modify: `tests/hygiene.test.js`
- Modify: `scripts/smoke-interest.sh`
- Modify: `README.md`

**Interfaces:**
- Consumes: every prior task and both Wrangler configurations.
- Produces: a deployable, operable capability with no active service-account remnants and documented recovery, retention and alert thresholds.

- [ ] **Step 1: Write hygiene tests for the completed architecture**

Extend `tests/hygiene.test.js` with an active-file list that includes root `.js`, `.html`, `.toml`, `.example`, `functions/`, `scripts/`, `tests/` and `README.md` but excludes `references/` historical artifacts. Assert:

```js
test('active source contains no service-account integration remnants', () => {
  const banned = [
    /GOOGLE_SERVICE_ACCOUNT/,
    /client_email/,
    /private_key/,
    /auth\/spreadsheets/,
    /emailFingerprint/,
  ];
  for (const file of activeFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of banned) expect(source, `${file}: ${pattern}`).not.toMatch(pattern);
  }
});

test('browser assets contain no Google owner secret names', () => {
  const browser = ['index.html', 'app.js', 'interest-form.js']
    .map((file) => readFileSync(join(process.cwd(), file), 'utf8'))
    .join('\n');
  expect(browser).not.toMatch(/GOOGLE_OAUTH_(CLIENT_SECRET|REFRESH_TOKEN)/);
  expect(browser).not.toMatch(/GOOGLE_SPREADSHEET_ID/);
});
```

Retain the existing bearer-looking credential scan.

- [ ] **Step 2: Run hygiene tests and remove every active remnant**

Run: `npx vitest run tests/hygiene.test.js`

Expected initially: FAIL on current service-account references in README, examples and tests not yet migrated.

Remove those active references. Do not edit dated artifacts under `references/specs/`, `references/plans/`, `references/TDDs/` or `references/session-logs/`.

Run: `npx vitest run tests/hygiene.test.js`

Expected: PASS.

- [ ] **Step 3: Make the endpoint smoke script recoverable and PII-minimal**

Replace the fixed `/tmp/interest-smoke.json` path in `scripts/smoke-interest.sh` with:

```bash
smoke_output="$(mktemp -t tccane-interest-smoke.XXXXXX)"
trap 'rm -f "$smoke_output"' EXIT
curl -sS -X POST "$BASE_URL/api/interest" \
  -H 'content-type: application/json' \
  -d '{"firstName":"Integration","lastName":"Check","email":"integration-check@example.invalid","turnstileToken":"dev","company":""}' \
  > "$smoke_output"
grep -Eq '"status":"(recorded|accepted)"' "$smoke_output"
echo "smoke ok"
```

Keep the existing `SMOKE=1` guard. The `.invalid` address must never receive messages and the output is removed on exit.

- [ ] **Step 4: Rewrite the middleware README around personal OAuth**

Replace the service-account middleware instructions with these exact sections:

1. **Local owner setup** – create a Web OAuth client with authorized redirect URI `http://127.0.0.1:53682/oauth2/callback`, set the client ID and secret in the shell then run `npm run setup:google`. State that the OAuth consent screen must be Production, not Testing.
2. **Local development** – copy `.dev.vars.example`, retain Cloudflare's test Turnstile pair, run `npm run pages:dev` and verify the form at `http://127.0.0.1:8788/#involved`.
3. **Pages secrets** – install `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_SPREADSHEET_ID` and `TURNSTILE_SECRET_KEY`; configure `TURNSTILE_SITE_KEY` and `GOOGLE_SHEET_TAB=Submissions` as Pages variables.
4. **Retry Worker** – confirm `DLQ_KV` IDs match in both Wrangler files, install the same four Google values with `npx wrangler secret put NAME --config wrangler.retry.toml`, deploy via `npm run retry:deploy` and verify the five-minute Cron Trigger.
5. **Reauthorization** – pause or hide the form, rerun `npm run setup:google` with the designated owner, update Pages and Worker secrets, smoke test both then restore the form. Explain that revoked access produces visitor failure and `google_auth_permanent` rather than queued success.
6. **Sheet contract** – `Submissions` is append-only, columns A:E and row one are application-managed, staff must use a separate tab for notes or reporting and partial-range sorting is prohibited.
7. **Retention** – retry and poison KV records expire after 30 days, retries stop after 24 hours and rows older than 12 months are reviewed and deleted quarterly.
8. **Monitoring** – alert on `google_auth_permanent`, `sheet_contract_invalid`, `dlq_poisoned` and `dlq_oldest_age_exceeded`; the queue-age threshold is 15 minutes.
9. **Delivery semantics** – describe delivery as at least once with practical duplicate suppression. State that rare duplicates remain possible after concurrent or client-level ambiguous failures.

Include these deployment commands verbatim:

```bash
npx wrangler pages secret put GOOGLE_OAUTH_CLIENT_ID --project-name tccane-website
npx wrangler pages secret put GOOGLE_OAUTH_CLIENT_SECRET --project-name tccane-website
npx wrangler pages secret put GOOGLE_OAUTH_REFRESH_TOKEN --project-name tccane-website
npx wrangler pages secret put GOOGLE_SPREADSHEET_ID --project-name tccane-website
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name tccane-website

npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID --config wrangler.retry.toml
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --config wrangler.retry.toml
npx wrangler secret put GOOGLE_OAUTH_REFRESH_TOKEN --config wrangler.retry.toml
npx wrangler secret put GOOGLE_SPREADSHEET_ID --config wrangler.retry.toml
npm run retry:deploy
```

Do not print or embed secret values in the README.

- [ ] **Step 5: Run the complete automated suite**

Run: `npm test`

Expected: PASS with all middleware, setup, Worker and jsdom suites.

Run: `npx wrangler pages functions build --outdir /tmp/tccane-pages-functions-dry-run`

Expected: successful Pages Functions bundle with `nodejs_compat`.

Run: `npx wrangler deploy --dry-run --config wrangler.retry.toml --outdir /tmp/tccane-retry-dry-run`

Expected: successful Worker bundle with the scheduled handler.

- [ ] **Step 6: Verify the local visitor experience**

With `.dev.vars` produced by owner setup and Cloudflare test Turnstile values, run:

```bash
npm run pages:dev
```

In a browser at `http://127.0.0.1:8788/#involved`, verify at 375px and 1280px widths:

- Labels, keyboard focus and error status are visible.
- A valid submission disables the button during the request.
- `recorded` replaces the form with the persistent thank-you panel.
- A failed request retains first name, last name and email then presents a fresh Turnstile widget.
- Email, Instagram and Discord remain available.
- Browser console and network responses contain no OAuth values.

- [ ] **Step 7: Verify staging failure and retry paths**

Use a non-production Pages project and retry Worker sharing a staging KV namespace:

1. Submit once with valid owner OAuth and confirm one exact five-cell row.
2. Temporarily install the literal staging refresh-token value `invalid-staging-refresh-token` in both staging services.
3. Submit and confirm HTTP 502, preserved browser fields, no KV record and a `google_auth_permanent` event.
4. Restore the valid staging refresh token in both services.
5. Point staging temporarily at a nonexistent spreadsheet ID, submit and confirm visible failure with no `accepted` response.
6. Restore the valid spreadsheet ID.
7. Force one retryable Sheets response through the existing mocked integration harness, confirm `accepted`, invoke `/cdn-cgi/handler/scheduled` on the local retry Worker and confirm the stable ID appears once then the KV record is deleted.
8. Change one staging header, confirm `sheet_contract_invalid` and restore the exact five headers.

Never perform the invalid-token or header-drift checks against the production owner grant or production sheet.

- [ ] **Step 8: Configure and verify production operational alerts**

In Cloudflare observability, create four saved queries or notification rules using the exact structured `event` values:

```text
google_auth_permanent
sheet_contract_invalid
dlq_poisoned
dlq_oldest_age_exceeded
```

Route each rule to the same operator channel used for the website. Trigger each event in staging, confirm delivery then document the responsible primary and backup operator in the private operations record rather than this public repository.

- [ ] **Step 9: Run the production smoke test**

After Pages and the retry Worker are deployed, read the production URL from the release environment rather than committing it:

```bash
read -r -p 'Production base URL: ' BASE_URL
SMOKE=1 BASE_URL="$BASE_URL" ./scripts/smoke-interest.sh
```

Use the actual deployed host supplied by the release environment. Expected: `smoke ok`, one new row and no OAuth or email value in logs. Remove the synthetic row after verification under the documented Sheet retention workflow.

- [ ] **Step 10: Commit the operating contract**

```bash
git add tests/hygiene.test.js scripts/smoke-interest.sh README.md
git commit -m "docs(interest): add OAuth operations and acceptance checks"
```

---

## Acceptance-gate crosswalk

| Confirmed gate | Implemented and verified by |
|---|---|
| OAuth setup creates and verifies the sheet using the production client | Tasks 1 and 3; Task 9 staging verification |
| Revoked tokens produce failure rather than `accepted` | Tasks 1, 2, 4 and 6 |
| Cron Worker is deployed against the shared KV namespace | Task 6; Task 9 deployment verification |
| Ambiguous Sheets failures reuse one submission ID | Existing adapter retained in Task 2; retry tests in Task 6 |
| KV pagination, poison retention and operator recovery exist | Task 5; Task 9 runbook |
| Protected append-only Sheet contract is explicit | Tasks 2 and 3; Task 9 runbook |
| Browser success, failure and Turnstile reset paths have end-to-end coverage | Tasks 7 and 8; Task 9 browser verification |
| Monitoring covers authorization, schema, poison and queue age | Tasks 4, 5 and 6; Task 9 alert configuration |

## Final verification

- [ ] `npm test` passes without skipped tests.
- [ ] Pages Functions and retry Worker both dry-run bundle successfully.
- [ ] Active source contains no `GOOGLE_SERVICE_ACCOUNT`, service-account key fields or broad Google scopes.
- [ ] The browser receives only the public Turnstile site key from `/api/config`.
- [ ] The personal-owner sheet contains the exact protected five-column contract.
- [ ] The production Cron Trigger is enabled at `*/5 * * * *` and uses the same `DLQ_KV` namespace as Pages.
- [ ] A real `recorded` flow, simulated `accepted` flow, revoked-token flow and header-drift flow have been observed in staging.
- [ ] Alert delivery and the primary/backup operator are documented outside the public repository.
