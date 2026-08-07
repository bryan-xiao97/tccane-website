# Google Sheets Interest Submission Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bloomerang Volunteer with Google Sheets API v4 as the destination for `POST /api/interest` submissions, using a stable submission ID and retry-time ID lookup so every valid submission produces at most one complete sheet row.

**Architecture:** The existing Cloudflare Pages Function stays the only write boundary. A new `functions/lib/sheets.js` adapter performs an ID-column lookup followed by a `values.append` call (RAW input, INSERT_ROWS). A new `functions/lib/google-token.js` wraps `google-auth-library` to mint service-account access tokens. The handler generates an opaque `submissionId` and UTC timestamp before the first destination call, persists them in both the sheet row and the existing KV DLQ, and the existing retry worker reuses them so a retry never appends twice. All external I/O (`fetch`, token provider, KV, clock) is injected so unit tests run in Node with mocks and never touch real Google credentials.

**Tech Stack:** Cloudflare Pages Functions (Workers runtime), JavaScript ES modules, `google-auth-library` (production dependency), Google Sheets API v4 REST, Vitest with in-memory KV and mock `fetch`. Node 20+.

**Spec source:** `references/specs/Google Sheets Interest Submission Storage - Functional Spec - 08.05.html`

**Out of scope (per spec):** Form UI / request payload redesign, reporting or staff-editing workflows, auto-creating or repairing spreadsheets at runtime, Apps Script or CLI as the production write path, and any permanent-database strategy. Dated artifacts under `references/` that mention Bloomerang are preserved.

## Global Constraints

- The write path stays in the existing Cloudflare Pages Function (`functions/api/interest.js` → `functions/lib/handler.js`).
- Google access uses a service account and `google-auth-library` only — NOT the full `googleapis` client and NOT a hand-rolled JWT.
- Service-account credentials exist only in an encrypted Cloudflare secret; never commit a real key.
- The spreadsheet is pre-provisioned, organization-owned, and shared directly with the service account as Editor. The application never creates or repairs the spreadsheet or its headers.
- Row schema is exactly five fixed columns in this order: `submissionId`, `submittedAtUtc` (ISO 8601 UTC), `firstName`, `lastName`, `email`. Never write IP, Turnstile tokens, or retry history to the sheet.
- Append requests use `valueInputOption=RAW` and `insertDataOption=INSERT_ROWS` so form strings are stored as text (never evaluated as formulas) and rows never overwrite adjacent content.
- Exactly-once behavior comes from a stable submission ID: the initial write and every retry use the same ID, and a retry checks the sheet's ID column before deciding whether to append.
- Public endpoint keeps its existing request contract (`firstName`, `lastName`, `email`, `turnstileToken`, optional empty `company`) and its existing validation, rate limiting, Turnstile, and failure-handling behavior.
- Immediate success returns `{ ok: true, status: "recorded" }`; a durably queued submission returns `{ ok: true, status: "accepted" }`.
- Network errors, HTTP 429, and HTTP 5xx from Google are retryable; other client errors are permanent.
- Prioritize maintainability and reliability over the smallest change. No fixed delivery deadline.
- Do not log full email addresses or authorization material. Log at most a short fingerprint (`emailFingerprint`) plus the opaque submission ID.
- Remove Bloomerang from active source, tests, environment examples, deployment config, and current README guidance. Preserve dated artifacts under `references/`.
- Repo conventions: ESM modules with `.js` extensions and relative imports; `npm test` runs `vitest run`; tests live in `tests/` and use `tests/helpers/memory-kv.js` and `tests/helpers/mock-fetch.js`; no TypeScript; conventional commits (`feat(middleware):`, `chore(middleware):`, etc.); no agent co-author on commits.

## File structure

| Path | Responsibility | Action |
| :--- | :--- | :--- |
| `package.json` | Add `google-auth-library` to `dependencies`; add `--compatibility-flags=nodejs_compat` to `pages:dev` | Modify |
| `wrangler.toml` | Add `compatibility_flags = ["nodejs_compat"]`; later replace `VOLUNTEER_API_BASE` with `GOOGLE_SHEET_TAB` | Modify |
| `.dev.vars.example` | Swap Volunteer secrets for `GOOGLE_SERVICE_ACCOUNT` / `GOOGLE_SPREADSHEET_ID` | Modify |
| `functions/lib/google-token.js` | Lazily build a `JWT` client from service-account JSON and return `getAccessToken()` closures | Create |
| `functions/lib/sheets.js` | Sheet row shape, ID-column lookup, RAW/INSERT_ROWS append, retry classification, dedup orchestration | Create |
| `functions/lib/handler.js` | Generate submission ID + UTC timestamp; call `writeSubmission`; return `recorded`/`accepted` | Modify |
| `functions/lib/dlq.js` | Persist `submissionId` / `submittedAtUtc` in queued records | Modify |
| `functions/scheduled/retry-dlq.js` | Drain DLQ to Sheets via `writeSubmission` with dedup | Modify |
| `functions/lib/volunteer.js` | Bloomerang client — no longer referenced after Task 4 | Delete (Task 5) |
| `functions/api/interest.js` | Thin Pages Function entry — unchanged | — |
| `tests/google-token.test.js` | Token provider tests with injected fake JWT client | Create |
| `tests/sheets.test.js` | Sheets adapter + dedup tests | Create |
| `tests/handler.test.js` | Update env/deps/expected statuses to Sheets | Modify |
| `tests/dlq.test.js` | Add submission-metadata persistence test | Modify |
| `tests/retry-dlq.test.js` | Update to Sheets retry | Modify |
| `tests/volunteer.test.js` | Bloomerang client tests | Delete (Task 5) |
| `tests/hygiene.test.js` | Rename stale test description | Modify |
| `README.md` | Rewrite middleware section for Google Sheets | Modify |

**Interface contracts (stable names across all tasks):**

```js
// google-token.js
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export function createTokenProvider(serviceAccountJson, scope = SHEETS_SCOPE, Client = JWT)
// → async function getAccessToken() → Promise<string>  (throws if the library returns no token)

// sheets.js
export function newSubmissionId(rng) // → string  (rng defaults to () => crypto.randomUUID())
export function rowForSubmission(submission) // → [submissionId, submittedAtUtc, firstName, lastName, email]
export async function submissionExists({ fetchImpl, spreadsheetId, range, submissionId, getAccessToken })
// → { ok: true, found: boolean } | { ok: false, retryable: boolean, status: number, error: string }
export async function appendSubmission({ fetchImpl, spreadsheetId, range, row, getAccessToken })
// → { ok: true } | { ok: false, retryable: boolean, status: number, error: string }
export async function writeSubmission({ fetchImpl, spreadsheetId, tab, submission, getAccessToken })
// → { ok: true, duplicate: boolean } | { ok: false, retryable: boolean, status: number, error: string }
// submission = { submissionId, submittedAtUtc, firstName, lastName, email }

// dlq.js
export async function enqueueFailure({ kv, payload, error, nowMs, maxAttempts })
// payload is now stored with submissionId and submittedAtUtc in addition to the three business fields
```

---

### Task 1: `google-auth-library` dependency, Node compatibility flag, and token provider

**Files:**
- Modify: `package.json` (add `dependencies.google-auth-library`; add `--compatibility-flags=nodejs_compat` to the `pages:dev` script)
- Modify: `wrangler.toml` (add `compatibility_flags = ["nodejs_compat"]`)
- Create: `functions/lib/google-token.js`
- Create: `tests/google-token.test.js`

**Interfaces:**
- Produces: `createTokenProvider(serviceAccountJson, scope?, Client?)` and `SHEETS_SCOPE` (see contracts above). Tasks 2, 3, and 4 consume these.

- [ ] **Step 1: Install the production dependency**

Run: `npm install google-auth-library`

Verify `package.json` now has a top-level block like:
```json
"dependencies": {
  "google-auth-library": "^9.x.x"
}
```
(Exact version number varies — any current release is fine. `package-lock.json` will also change.)

- [ ] **Step 2: Enable Node compatibility in config**

Edit `wrangler.toml` so the top of the file reads:
```toml
name = "tccane-website"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "."
```

Edit `package.json` so the `pages:dev` script is:
```json
"pages:dev": "wrangler pages dev . --compatibility-date=2024-11-01 --compatibility-flags=nodejs_compat"
```

- [ ] **Step 3: Write the failing test**

Create `tests/google-token.test.js`:
```js
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`

Expected: the suite fails to load `tests/google-token.test.js` because `../functions/lib/google-token.js` does not exist (module not found).

- [ ] **Step 5: Write the implementation**

Create `functions/lib/google-token.js`:
```js
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`

Expected: all three new tests pass and the pre-existing suite still passes (nothing else changed).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json wrangler.toml functions/lib/google-token.js tests/google-token.test.js
git commit -m "feat(middleware): add google-auth-library token provider"
```

---

### Task 2: Google Sheets adapter with ID lookup, RAW append, and dedup

**Files:**
- Create: `functions/lib/sheets.js`
- Create: `tests/sheets.test.js`

**Interfaces:**
- Consumes: nothing at build time — `getAccessToken` is injected by callers.
- Produces: `newSubmissionId`, `rowForSubmission`, `submissionExists`, `appendSubmission`, `writeSubmission` (see contracts above). Tasks 3 and 4 consume `newSubmissionId` and `writeSubmission`.

- [ ] **Step 1: Write the failing test**

Create `tests/sheets.test.js`:
```js
import { describe, expect, test } from 'vitest';
import {
  appendSubmission,
  newSubmissionId,
  rowForSubmission,
  submissionExists,
  writeSubmission,
} from '../functions/lib/sheets.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

const getAccessToken = async () => 'fake-token';
const submission = {
  submissionId: 'sub-1',
  submittedAtUtc: '2026-08-05T12:00:00.000Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@college.edu',
};

describe('rowForSubmission', () => {
  test('returns five cells in contract order', () => {
    expect(rowForSubmission(submission)).toEqual([
      'sub-1',
      '2026-08-05T12:00:00.000Z',
      'Ada',
      'Lovelace',
      'ada@college.edu',
    ]);
  });
});

describe('newSubmissionId', () => {
  test('returns the injected rng result', () => {
    expect(newSubmissionId(() => 'opaque-id')).toBe('opaque-id');
  });
});

describe('submissionExists', () => {
  test('returns found when the ID column contains the id', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [['sub-1'], ['other']] }),
      },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, found: true });
  });

  test('returns not found when the id is absent', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [['x'], ['y']] }),
      },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, found: false });
  });

  test('treats empty values as not found', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, {}) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, found: false });
  });

  test('treats a 503 read as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(503);
  });

  test('treats a 400 read as permanent', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
  });

  test('treats a network throw as retryable', async () => {
    const fetchImpl = async () => {
      throw new Error('network');
    };
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });

  test('treats a token failure as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, { values: [] }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken: async () => {
        throw new Error('auth down');
      },
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });
});

describe('appendSubmission', () => {
  test('POSTs a RAW INSERT_ROWS append with bearer token and correct body', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url, init) => url.includes(':append') && init.method === 'POST',
        response: async (_url, init) => {
          expect(init.headers.Authorization).toBe('Bearer fake-token');
          expect(JSON.parse(init.body).values).toEqual([rowForSubmission(submission)]);
          return jsonResponse(200, { updates: { updatedRows: 1 } });
        },
      },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r).toEqual({ ok: true });
    const call = fetchImpl.calls[0];
    expect(call.url).toContain('/spreadsheets/s1/values/Submissions!A:E:append');
    expect(call.url).toContain('valueInputOption=RAW');
    expect(call.url).toContain('insertDataOption=INSERT_ROWS');
  });

  test('treats a 503 append as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(503);
  });

  test('treats a 400 append as permanent', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
  });

  test('treats a network throw as retryable', async () => {
    const fetchImpl = async () => {
      throw new Error('network');
    };
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });

  test('treats a token failure as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, {}) },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken: async () => {
        throw new Error('auth down');
      },
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });
});

describe('writeSubmission', () => {
  test('appends when the id is absent', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('!A:A'),
        response: jsonResponse(200, { values: [] }),
      },
      {
        match: (url) => url.includes(':append'),
        response: jsonResponse(200, { updates: { updatedRows: 1 } }),
      },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, duplicate: false });
    expect(fetchImpl.calls.filter((c) => c.url.includes(':append'))).toHaveLength(1);
  });

  test('skips the append when the id is already present', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('!A:A'),
        response: jsonResponse(200, { values: [['sub-1']] }),
      },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, duplicate: true });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  test('propagates a retryable read failure without appending', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(fetchImpl.calls).toHaveLength(1);
  });

  test('propagates a permanent append failure', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('!A:A'),
        response: jsonResponse(200, { values: [] }),
      },
      {
        match: (url) => url.includes(':append'),
        response: jsonResponse(400, { error: 'bad' }),
      },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: the suite fails to load `tests/sheets.test.js` because `../functions/lib/sheets.js` does not exist (module not found).

- [ ] **Step 3: Write the implementation**

Create `functions/lib/sheets.js`:
```js
export function newSubmissionId(rng = () => crypto.randomUUID()) {
  return rng();
}

export function rowForSubmission(s) {
  return [s.submissionId, s.submittedAtUtc, s.firstName, s.lastName, s.email];
}

function apiUrl(spreadsheetId, range, suffix = '') {
  const root = 'https://sheets.googleapis.com/v4/spreadsheets';
  return `${root}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${suffix}`;
}

async function classify(res, label) {
  const status = res.status;
  const retryable = status >= 500 || status === 429;
  let error = `Sheets ${label} HTTP ${status}`;
  try {
    const text = await res.text();
    if (text) error = text.slice(0, 200);
  } catch {
    /* ignore */
  }
  return { ok: false, retryable, status, error };
}

async function getBearerToken(getAccessToken) {
  let token;
  try {
    token = await getAccessToken();
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Google token error' };
  }
  return { ok: true, token };
}

export async function submissionExists({ fetchImpl, spreadsheetId, range, submissionId, getAccessToken }) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;

  let res;
  try {
    res = await fetchImpl(apiUrl(spreadsheetId, range), {
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    });
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Sheets network error' };
  }
  if (!res.ok) return classify(res, 'read');

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Sheets invalid JSON' };
  }
  const values = Array.isArray(data?.values) ? data.values : [];
  return { ok: true, found: values.some((row) => row && row[0] === submissionId) };
}

export async function appendSubmission({ fetchImpl, spreadsheetId, range, row, getAccessToken }) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;

  const url = `${apiUrl(spreadsheetId, range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Sheets network error' };
  }
  if (res.ok) return { ok: true };
  return classify(res, 'append');
}

export async function writeSubmission({ fetchImpl, spreadsheetId, tab, submission, getAccessToken }) {
  const check = await submissionExists({
    fetchImpl,
    spreadsheetId,
    range: `${tab}!A:A`,
    submissionId: submission.submissionId,
    getAccessToken,
  });
  if (!check.ok) return check;
  if (check.found) return { ok: true, duplicate: true };

  const appended = await appendSubmission({
    fetchImpl,
    spreadsheetId,
    range: `${tab}!A:E`,
    row: rowForSubmission(submission),
    getAccessToken,
  });
  if (!appended.ok) return appended;
  return { ok: true, duplicate: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: all `tests/sheets.test.js` tests pass and the rest of the suite still passes.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/sheets.js tests/sheets.test.js
git commit -m "feat(middleware): add Google Sheets append client with dedup"
```

---

### Task 3: Write submissions to Sheets from the handler and persist the ID in the DLQ

**Files:**
- Modify: `functions/lib/handler.js`
- Modify: `functions/lib/dlq.js`
- Modify: `tests/handler.test.js`
- Modify: `tests/dlq.test.js`

**Interfaces:**
- Consumes: `newSubmissionId`, `writeSubmission` from `sheets.js`; `createTokenProvider` from `google-token.js`; `enqueueFailure` from `dlq.js`.
- Produces: `handleInterestPost(request, env, deps)` now also honors `deps.getAccessToken` and `deps.rng`; `enqueueFailure` stores `submissionId` and `submittedAtUtc` on the queued record.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/handler.test.js`:
```js
import { describe, expect, test } from 'vitest';
import { handleInterestPost } from '../functions/lib/handler.js';
import { createMemoryKv } from './helpers/memory-kv.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

function envBase(over = {}) {
  return {
    GOOGLE_SERVICE_ACCOUNT: JSON.stringify({
      type: 'service_account',
      client_email: 'sheets@project.iam.gserviceaccount.com',
      private_key: 'fake-key',
    }),
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

function post(body, headers = {}) {
  return new Request('https://example.test/api/interest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function sheetsFetch({ columnValues = [], appendStatus = 200 } = {}) {
  return createMockFetch([
    {
      match: (url) => url.includes('/values/Submissions!A:A'),
      response: jsonResponse(200, { values: columnValues }),
    },
    {
      match: (url) => url.includes(':append'),
      response: jsonResponse(appendStatus, { error: 'boom' }),
    },
  ]);
}

const valid = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@college.edu',
  turnstileToken: 'ignored-when-skip',
};

function deps(over = {}) {
  return {
    nowMs: 5_000,
    getAccessToken: async () => 'fake-token',
    rng: () => 'sub-123',
    ...over,
  };
}

describe('handleInterestPost', () => {
  test('405 on GET', async () => {
    const req = new Request('https://example.test/api/interest', { method: 'GET' });
    const res = await handleInterestPost(req, envBase(), {
      fetchImpl: createMockFetch([]),
      ...deps(),
    });
    expect(res.status).toBe(405);
  });

  test('200 recorded when Sheets append succeeds', async () => {
    const fetchImpl = sheetsFetch();
    const res = await handleInterestPost(post(valid), envBase(), { fetchImpl, ...deps() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'recorded' });
    const appendCall = fetchImpl.calls.find((c) => c.url.includes(':append'));
    expect(JSON.parse(appendCall.init.body).values).toEqual([
      ['sub-123', '1970-01-01T00:00:05.000Z', 'Ada', 'Lovelace', 'ada@college.edu'],
    ]);
  });

  test('200 recorded without a second append when the ID already exists', async () => {
    const fetchImpl = sheetsFetch({ columnValues: [['sub-123']] });
    const res = await handleInterestPost(post(valid), envBase(), { fetchImpl, ...deps() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'recorded' });
    expect(fetchImpl.calls.filter((c) => c.url.includes(':append'))).toHaveLength(0);
  });

  test('200 accepted and DLQ write when Sheets append is retryable', async () => {
    const env = envBase();
    const fetchImpl = sheetsFetch({ appendStatus: 503 });
    const res = await handleInterestPost(post(valid), env, { fetchImpl, ...deps() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'accepted' });
    const listed = await env.DLQ_KV.list({ prefix: 'dlq:' });
    expect(listed.keys.length).toBe(1);
    const rec = await env.DLQ_KV.get(listed.keys[0].name, 'json');
    expect(rec.payload).toEqual({
      submissionId: 'sub-123',
      submittedAtUtc: '1970-01-01T00:00:05.000Z',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@college.edu',
    });
  });

  test('400 on unknown field', async () => {
    const res = await handleInterestPost(
      post({ ...valid, extra: 1 }),
      envBase(),
      { fetchImpl: createMockFetch([]), ...deps() },
    );
    expect(res.status).toBe(400);
  });

  test('429 when rate limited', async () => {
    const env = envBase({ RATE_LIMIT_MAX: '1' });
    const depsObj = { ...deps(), fetchImpl: sheetsFetch() };
    const ipHeaders = { 'CF-Connecting-IP': '9.9.9.9' };
    expect((await handleInterestPost(post(valid, ipHeaders), env, depsObj)).status).toBe(200);
    const res2 = await handleInterestPost(post(valid, ipHeaders), env, depsObj);
    expect(res2.status).toBe(429);
    expect(res2.headers.get('Retry-After')).toBeTruthy();
  });

  test('403 when Turnstile fails and skip off', async () => {
    const env = envBase({ TURNSTILE_SKIP: 'false' });
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('turnstile'),
        response: jsonResponse(200, { success: false }),
      },
    ]);
    const res = await handleInterestPost(post(valid), env, { fetchImpl, ...deps() });
    expect(res.status).toBe(403);
  });

  test('500 when service account missing', async () => {
    const env = envBase({ GOOGLE_SERVICE_ACCOUNT: '' });
    const res = await handleInterestPost(post(valid), env, {
      fetchImpl: createMockFetch([]),
      ...deps(),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Server misconfigured' });
  });

  test('500 when spreadsheet id missing', async () => {
    const env = envBase({ GOOGLE_SPREADSHEET_ID: '' });
    const res = await handleInterestPost(post(valid), env, {
      fetchImpl: createMockFetch([]),
      ...deps(),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Server misconfigured' });
  });

  test('500 when RATE_LIMIT_KV missing', async () => {
    const env = envBase({ RATE_LIMIT_KV: undefined });
    const res = await handleInterestPost(post(valid), env, {
      fetchImpl: createMockFetch([]),
      ...deps(),
    });
    expect(res.status).toBe(500);
  });

  test('500 when DLQ_KV missing', async () => {
    const env = envBase({ DLQ_KV: undefined });
    const res = await handleInterestPost(post(valid), env, {
      fetchImpl: createMockFetch([]),
      ...deps(),
    });
    expect(res.status).toBe(500);
  });

  test('500 when Turnstile secret missing and skip off', async () => {
    const env = envBase({ TURNSTILE_SKIP: 'false', TURNSTILE_SECRET_KEY: '' });
    const res = await handleInterestPost(post(valid), env, {
      fetchImpl: createMockFetch([]),
      ...deps(),
    });
    expect(res.status).toBe(500);
  });

  test('503 when retryable failure and DLQ put fails', async () => {
    const badKv = {
      async get() {
        return null;
      },
      async put() {
        throw new Error('kv down');
      },
      async list() {
        return { keys: [] };
      },
      async delete() {},
    };
    const env = envBase({ DLQ_KV: badKv });
    const fetchImpl = sheetsFetch({ appendStatus: 503 });
    const res = await handleInterestPost(post(valid), env, { fetchImpl, ...deps() });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Registration temporarily unavailable' });
  });

  test('502 when Sheets append is a permanent 400', async () => {
    const fetchImpl = sheetsFetch({ appendStatus: 400 });
    const res = await handleInterestPost(post(valid), envBase(), { fetchImpl, ...deps() });
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: `tests/handler.test.js` fails — `handleInterestPost` still returns `registered` and still reads `VOLUNTEER_*` env, so the Sheets expectations (status `recorded`, new env keys) fail. The current `tests/handler.test.js` also still passes until replaced, so failures come from the new assertions in the replaced file.

- [ ] **Step 3: Update the DLQ to persist submission metadata**

In `functions/lib/dlq.js`, change the `payload` object inside `enqueueFailure` (around line 17) from:
```js
    payload: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    },
```
to:
```js
    payload: {
      submissionId: payload.submissionId,
      submittedAtUtc: payload.submittedAtUtc,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    },
```
Nothing else in `dlq.js` changes. (`JSON.stringify` drops `undefined` fields, so existing tests that enqueue three-field payloads still produce three-field records.)

- [ ] **Step 4: Write the implementation**

Replace the entire contents of `functions/lib/handler.js`:
```js
import { validateInterestBody } from './validate.js';
import { verifyTurnstile } from './turnstile.js';
import { checkRateLimit } from './rate-limit.js';
import { newSubmissionId, writeSubmission } from './sheets.js';
import { createTokenProvider } from './google-token.js';
import { enqueueFailure } from './dlq.js';
import { emailFingerprint, info, warn } from './log.js';

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function clientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

export async function handleInterestPost(request, env, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const nowMs = deps.nowMs ?? Date.now();
  const getAccessToken =
    deps.getAccessToken || createTokenProvider(env.GOOGLE_SERVICE_ACCOUNT);

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT || !env.GOOGLE_SPREADSHEET_ID) {
    warn('misconfigured', { hasServiceAccount: Boolean(env.GOOGLE_SERVICE_ACCOUNT) });
    return json(500, { error: 'Server misconfigured' });
  }

  if (!env.RATE_LIMIT_KV || !env.DLQ_KV) {
    warn('misconfigured', { hasRateLimitKv: Boolean(env.RATE_LIMIT_KV), hasDlqKv: Boolean(env.DLQ_KV) });
    return json(500, { error: 'Server misconfigured' });
  }

  if (env.TURNSTILE_SKIP !== 'true' && !env.TURNSTILE_SECRET_KEY) {
    warn('misconfigured', { hasTurnstileSecret: false });
    return json(500, { error: 'Server misconfigured' });
  }

  let raw;
  try {
    raw = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const parsed = validateInterestBody(raw);
  if (!parsed.ok) {
    return json(parsed.status, { error: parsed.error });
  }
  const input = parsed.value;
  const fp = emailFingerprint(input.email);
  const ip = clientIp(request);

  let limit = parseInt(env.RATE_LIMIT_MAX || '5', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 5;
  let windowSeconds = parseInt(env.RATE_LIMIT_WINDOW_SECONDS || '600', 10);
  if (!Number.isFinite(windowSeconds) || windowSeconds < 1) windowSeconds = 600;
  const rl = await checkRateLimit({
    kv: env.RATE_LIMIT_KV,
    ip,
    limit,
    windowSeconds,
    nowMs,
  });
  if (!rl.ok) {
    return json(
      429,
      { error: 'Too many requests' },
      { 'Retry-After': String(rl.retryAfterSeconds) },
    );
  }

  if (env.TURNSTILE_SKIP !== 'true') {
    const ts = await verifyTurnstile({
      token: input.turnstileToken,
      ip,
      secret: env.TURNSTILE_SECRET_KEY,
      fetchImpl,
    });
    if (!ts.ok) {
      return json(403, { error: 'Verification failed' });
    }
  }

  const submission = {
    submissionId: newSubmissionId(deps.rng),
    submittedAtUtc: new Date(nowMs).toISOString(),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  };

  const result = await writeSubmission({
    fetchImpl,
    spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
    tab: env.GOOGLE_SHEET_TAB || 'Submissions',
    submission,
    getAccessToken,
  });

  if (result.ok) {
    info('recorded', { fp, submissionId: submission.submissionId });
    return json(200, { ok: true, status: 'recorded' });
  }

  if (result.retryable) {
    try {
      await enqueueFailure({
        kv: env.DLQ_KV,
        payload: submission,
        error: result.error,
        nowMs,
      });
    } catch (err) {
      warn('dlq_enqueue_failed', { fp, error: String(err?.message || err) });
      return json(503, { error: 'Registration temporarily unavailable' });
    }
    warn('sheets_retryable_enqueued', { fp, submissionId: submission.submissionId });
    return json(200, { ok: true, status: 'accepted' });
  }

  warn('sheets_failed', { fp, submissionId: submission.submissionId });
  return json(502, { error: 'Registration failed' });
}
```

- [ ] **Step 5: Add the DLQ metadata test**

Append this test to `tests/dlq.test.js` inside the `describe('dlq', ...)` block:
```js
  test('enqueueFailure persists submissionId and submittedAtUtc', async () => {
    const kv = createMemoryKv();
    await enqueueFailure({
      kv,
      payload: {
        submissionId: 'sub-1',
        submittedAtUtc: '2026-08-05T12:00:00.000Z',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.co',
      },
      error: '503',
      nowMs: 0,
    });
    const listed = await kv.list({ prefix: 'dlq:' });
    const rec = await kv.get(listed.keys[0].name, 'json');
    expect(rec.payload).toEqual({
      submissionId: 'sub-1',
      submittedAtUtc: '2026-08-05T12:00:00.000Z',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
    });
  });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`

Expected: `tests/handler.test.js` and `tests/dlq.test.js` pass; `tests/volunteer.test.js` still passes (the Bloomerang client is still imported by `retry-dlq.js` until Task 4); the rest of the suite passes.

- [ ] **Step 7: Commit**

```bash
git add functions/lib/handler.js functions/lib/dlq.js tests/handler.test.js tests/dlq.test.js
git commit -m "feat(middleware): write interest submissions to Google Sheets"
```

---

### Task 4: Drain DLQ retries to Sheets with deduplication

**Files:**
- Modify: `functions/scheduled/retry-dlq.js`
- Modify: `tests/retry-dlq.test.js`

**Interfaces:**
- Consumes: `writeSubmission` from `sheets.js`; `listDue`, `markAttempt`, `poisonRecord` from `dlq.js`; `createTokenProvider` from `google-token.js`.
- Produces: `processDlqBatch(env, deps)` where `deps.getAccessToken` is now honored. `functions/lib/volunteer.js` becomes unreferenced after this task.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/retry-dlq.test.js`:
```js
import { describe, expect, test } from 'vitest';
import { enqueueFailure } from '../functions/lib/dlq.js';
import { processDlqBatch } from '../functions/scheduled/retry-dlq.js';
import { createMemoryKv } from './helpers/memory-kv.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

function envBase() {
  return {
    DLQ_KV: createMemoryKv(),
    GOOGLE_SPREADSHEET_ID: 'spreadsheet-1',
    GOOGLE_SHEET_TAB: 'Submissions',
    GOOGLE_SERVICE_ACCOUNT: JSON.stringify({
      type: 'service_account',
      client_email: 'sheets@project.iam.gserviceaccount.com',
      private_key: 'fake-key',
    }),
  };
}

const getAccessToken = async () => 'fake-token';

function queued({ kv, submissionId = 'sub-1' }) {
  return enqueueFailure({
    kv,
    payload: {
      submissionId,
      submittedAtUtc: '2026-08-05T12:00:00.000Z',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
    },
    error: '503',
    nowMs: 0,
  });
}

describe('processDlqBatch', () => {
  test('retries due items and deletes on success', async () => {
    const env = envBase();
    await queued({ kv: env.DLQ_KV });
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [] }),
      },
      {
        match: (url) => url.includes(':append'),
        response: jsonResponse(200, { updates: { updatedRows: 1 } }),
      },
    ]);
    const summary = await processDlqBatch(env, { fetchImpl, getAccessToken, nowMs: 0, limit: 10 });
    expect(summary.succeeded).toBe(1);
    expect((await env.DLQ_KV.list({ prefix: 'dlq:' })).keys.length).toBe(0);
  });

  test('deletes the record without appending when the ID is already in the sheet', async () => {
    const env = envBase();
    await queued({ kv: env.DLQ_KV });
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [['sub-1']] }),
      },
    ]);
    const summary = await processDlqBatch(env, { fetchImpl, getAccessToken, nowMs: 0, limit: 10 });
    expect(summary.succeeded).toBe(1);
    expect(fetchImpl.calls.filter((c) => c.url.includes(':append'))).toHaveLength(0);
    expect((await env.DLQ_KV.list({ prefix: 'dlq:' })).keys.length).toBe(0);
  });

  test('increments attempts on continued failure', async () => {
    const env = envBase();
    await queued({ kv: env.DLQ_KV });
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [] }),
      },
      {
        match: (url) => url.includes(':append'),
        response: jsonResponse(503, { error: 'down' }),
      },
    ]);
    await processDlqBatch(env, { fetchImpl, getAccessToken, nowMs: 0, limit: 10 });
    const listed = await env.DLQ_KV.list({ prefix: 'dlq:' });
    const rec = await env.DLQ_KV.get(listed.keys[0].name, 'json');
    expect(rec.attempts).toBe(1);
    expect(rec.nextAttemptAt).toBeGreaterThan(0);
  });

  test('poisons on permanent Sheets failure', async () => {
    const env = envBase();
    await queued({ kv: env.DLQ_KV });
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [] }),
      },
      {
        match: (url) => url.includes(':append'),
        response: jsonResponse(400, { error: 'bad' }),
      },
    ]);
    const summary = await processDlqBatch(env, { fetchImpl, getAccessToken, nowMs: 0, limit: 10 });
    expect(summary.poisoned).toBe(1);
    const listed = await env.DLQ_KV.list({ prefix: 'dlq:' });
    const rec = await env.DLQ_KV.get(listed.keys[0].name, 'json');
    expect(rec.poisoned).toBe(true);
    expect(rec.lastError).toMatch(/^permanent:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: `tests/retry-dlq.test.js` fails — `processDlqBatch` still calls the Bloomerang `createOrgUser` and reads `VOLUNTEER_*` env, so it never performs the Sheets read/append that the new tests expect.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `functions/scheduled/retry-dlq.js`:
```js
import { listDue, markAttempt, poisonRecord } from '../lib/dlq.js';
import { writeSubmission } from '../lib/sheets.js';
import { createTokenProvider } from '../lib/google-token.js';
import { emailFingerprint, info, warn } from '../lib/log.js';

export async function processDlqBatch(env, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const nowMs = deps.nowMs ?? Date.now();
  const limit = deps.limit ?? 20;
  const getAccessToken = deps.getAccessToken || createTokenProvider(env.GOOGLE_SERVICE_ACCOUNT);
  const due = await listDue({ kv: env.DLQ_KV, nowMs, limit });
  let succeeded = 0;
  let failed = 0;
  let poisoned = 0;

  for (const item of due) {
    const result = await writeSubmission({
      fetchImpl,
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      tab: env.GOOGLE_SHEET_TAB || 'Submissions',
      submission: item.payload,
      getAccessToken,
    });
    const fp = emailFingerprint(item.payload.email);
    if (result.ok) {
      await markAttempt({
        kv: env.DLQ_KV,
        id: item.id,
        success: true,
        error: '',
        nowMs,
      });
      succeeded += 1;
      info('dlq_retry_ok', { fp });
      continue;
    }
    if (!result.retryable) {
      await poisonRecord({
        kv: env.DLQ_KV,
        id: item.id,
        error: `permanent:${result.error}`,
        nowMs,
      });
      poisoned += 1;
      warn('dlq_poison_permanent', { fp, status: result.status });
      continue;
    }
    const r = await markAttempt({
      kv: env.DLQ_KV,
      id: item.id,
      success: false,
      error: result.error,
      nowMs,
      maxAttempts: item.maxAttempts || 12,
    });
    if (r.poisoned) poisoned += 1;
    else failed += 1;
  }

  return { processed: due.length, succeeded, failed, poisoned };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processDlqBatch(env, { fetchImpl: fetch }));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: `tests/retry-dlq.test.js` passes. `tests/volunteer.test.js` still passes because `functions/lib/volunteer.js` still exists — it is just no longer imported anywhere. Confirm with:
```bash
git grep -l "lib/volunteer.js"
```
Expected: no output (only the file itself exists; nothing imports it).

- [ ] **Step 5: Commit**

```bash
git add functions/scheduled/retry-dlq.js tests/retry-dlq.test.js
git commit -m "feat(middleware): drain DLQ retries to Google Sheets"
```

---

### Task 5: Remove active Bloomerang references and document Google Sheets

**Files:**
- Delete: `functions/lib/volunteer.js`
- Delete: `tests/volunteer.test.js`
- Modify: `wrangler.toml` (replace `VOLUNTEER_API_BASE` with `GOOGLE_SHEET_TAB` in `[vars]`)
- Modify: `.dev.vars.example` (replace Volunteer secrets)
- Modify: `tests/hygiene.test.js` (rename stale test description)
- Modify: `README.md` (rewrite the middleware section)
- Modify: `package.json` (already updated in Task 1 — verify the `pages:dev` script still includes `--compatibility-flags=nodejs_compat`)

**Interfaces:**
- Consumes: nothing new. This task deletes the now-dead Bloomerang files and updates configuration and documentation only.

- [ ] **Step 1: Delete the Bloomerang files**

Run:
```bash
git rm functions/lib/volunteer.js tests/volunteer.test.js
```

- [ ] **Step 2: Update `wrangler.toml`**

Replace the current `[vars]` block:
```toml
[vars]
VOLUNTEER_API_BASE = "https://volunteer.bloomerang.co/api"
RATE_LIMIT_MAX = "5"
RATE_LIMIT_WINDOW_SECONDS = "600"
```
with:
```toml
[vars]
RATE_LIMIT_MAX = "5"
RATE_LIMIT_WINDOW_SECONDS = "600"
GOOGLE_SHEET_TAB = "Submissions"
```
Leave the `compatibility_flags = ["nodejs_compat"]` line (added in Task 1) and the KV bindings and the DLQ retry comment unchanged.

- [ ] **Step 3: Update `.dev.vars.example`**

Replace the entire file contents with:
```
GOOGLE_SERVICE_ACCOUNT={"type":"service_account","project_id":"replace-me","client_email":"replace-me@replace-me.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\nREPLACE_ME\n-----END PRIVATE KEY-----\n"}
GOOGLE_SPREADSHEET_ID=replace-me
TURNSTILE_SECRET_KEY=replace-me
TURNSTILE_SKIP=true
```
Note: this must stay a single line so wrangler's `KEY=VALUE` parser reads the whole JSON. The private key value is a placeholder; never put a real key here.

- [ ] **Step 4: Rename the stale hygiene test description**

In `tests/hygiene.test.js`, change the test name (line 17) from:
```js
  test('repo source does not contain bearer-looking volunteer tokens', () => {
```
to:
```js
  test('repo source does not contain bearer-looking service credentials', () => {
```
The regex and everything else in the file stay the same.

- [ ] **Step 5: Rewrite the README middleware section**

Replace everything in `README.md` from the `## Middleware (Cloudflare Pages Function)` heading (line 47) to the end of the file with:
```markdown
## Middleware (Cloudflare Pages Function)

Interest submission API backed by a Google Sheets destination. Spec: `references/specs/Google Sheets Interest Submission Storage - Functional Spec - 08.05.html`.

```bash
npm install
npm test
cp .dev.vars.example .dev.vars   # fill when you have keys; TURNSTILE_SKIP=true for local
npx wrangler pages dev . --compatibility-date=2024-11-01 --compatibility-flags=nodejs_compat
# POST http://127.0.0.1:8788/api/interest
```

Secrets (production): `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_SPREADSHEET_ID`, `TURNSTILE_SECRET_KEY` via `wrangler pages secret put`. Vars: `GOOGLE_SHEET_TAB`. Never commit `.dev.vars`.

### DLQ retry

`processDlqBatch` lives in `functions/scheduled/retry-dlq.js`. Wire it as a
Cron Trigger on a small Worker that shares the `DLQ_KV` binding and the same
secrets (every 5 minutes), or call it from an authenticated ops route later.
Until cron is wired, failed submissions remain in KV for manual replay:
`npx wrangler kv key list --binding=DLQ_KV`.

### When Google service-account access arrives

1. In Google Cloud, create a service account and enable the Sheets API for the project.
2. Download its key, and `npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT` with the JSON contents.
3. Create the spreadsheet, add a `Submissions` tab with the headers `submissionId`, `submittedAtUtc`, `firstName`, `lastName`, `email` in row one, and share it with the service-account email as Editor.
4. `npx wrangler pages secret put GOOGLE_SPREADSHEET_ID`, and set `GOOGLE_SHEET_TAB` (default `Submissions`) in Pages project variables. Ensure `TURNSTILE_SKIP` is **unset** in production.
5. Deploy the Pages project; confirm `POST /api/interest` with a real Turnstile token appends one row per submission.
6. Wire the cron Worker for `processDlqBatch` sharing `DLQ_KV`.
```

- [ ] **Step 6: Run the full suite and confirm no active Bloomerang references**

Run: `npm test`

Expected: every test passes (the suite now has `google-token`, `sheets`, updated `handler`, `dlq`, `retry-dlq`, plus the unchanged validate/turnstile/rate-limit/hygiene tests).

Then verify no active reference remains (Bloom references inside `references/` are intentional and preserved):
```bash
git grep -niE 'bloomerang|VOLUNTEER' -- ':!references'
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(middleware): remove active Bloomerang references"
```

---

## Self-review notes (resolved before save)

- **Spec coverage:** every fork's chosen approach maps to a task — write boundary (Task 3/4), `google-auth-library` (Task 1), stable-ID dedup (Tasks 2-4), five-column schema (Task 2 `rowForSubmission`), pre-provisioned sheet / no runtime repair (Task 5 README instructions), `recorded`/`accepted` responses (Task 3), active cleanup with `references/` preserved (Task 5). The non-goal of never storing IP/Turnstile/retry history is enforced by the fixed `rowForSubmission` shape.
- **Placeholder scan:** every code step contains concrete code and exact expected output; no TBD/TODO/"add validation"-style steps.
- **Type consistency:** `writeSubmission`/`newSubmissionId`/`rowForSubmission`/`submissionExists`/`appendSubmission`/`createTokenProvider` signatures are identical across the contract block, Tasks 2-4, and the implementation code. Env keys are consistently `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEET_TAB` everywhere (tests, handler, retry worker, wrangler.toml, `.dev.vars.example`, README).
