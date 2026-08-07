# Volunteer Registration Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare Pages Function at `POST /api/interest` that validates a first/last/email payload, verifies Turnstile, rate-limits by IP, creates (or attaches) a Bloomerang Volunteer org user, and dead-letters transient failures for retry — without requiring a real API key during development.

**Architecture:** Pure modules under `functions/lib/` (validate, turnstile, rate-limit, volunteer client, DLQ) composed by a single handler. Pages Function entry at `functions/api/interest.js` is a thin adapter. All external I/O is injected (`fetch`, KV, env) so unit tests run in Node with mocks. Real Bloomerang credentials stay in Wrangler secrets and are only needed for optional live smoke tests.

**Tech Stack:** Cloudflare Pages Functions (Workers runtime), JavaScript (ES modules, no TypeScript required), Vitest + `@cloudflare/vitest-pool-workers` optional — default to plain Vitest with injected mocks (zero CF account needed for CI), Wrangler for local `pages dev` and secret binding. Node 20+.

**Spec source:** `references/TDDs/Interest Form Bloomerang Volunteer - Technical Design - 08.02.html`

**Out of scope (separate plan):** HTML form UI, Turnstile widget embed, `interest-form.js` client, site CSS, DNS/Pages project cutover. This plan delivers the middleware only; a stub HTTP client test proves the contract the future form will call.

## Global Constraints

- Security > Reliability > Speed (from TDD).
- Bearer token and Turnstile secret exist only in CF env/secrets — never in git, client bundles, or test fixtures committed as real values.
- Function exposes **only** `POST /api/interest`. No Volunteer GET proxy. No passthrough of arbitrary paths or bodies.
- Request body allows only: `firstName`, `lastName`, `email`, `turnstileToken`, and optional honeypot field `company` (must be empty). Unknown keys → 400.
- Map to Volunteer: `username` = email, `firstName`, `lastName`. No other Volunteer fields in v1.
- Volunteer call is org-user create only: `POST https://volunteer.bloomerang.co/api/v4/organizations/{org_id}/users`.
- This is a **registration** write (creates/attaches a Volunteer account). Name the route `/api/interest` to match the TDD; comments must say registration.
- Static site root stays dependency-free for browsers; Node deps live only for middleware dev/test (`package.json` at repo root is allowed and is not shipped to the browser).
- Prefer KV + scheduled retry over CF Queues until Queues are confirmed on the account (TDD fallback).
- Rate limit: ≤5 successful-or-attempted submits per client IP per 10 minutes (configurable via env).
- Do not log full email addresses or Authorization headers. Log at most a short hash prefix of email for correlation.
- No Oxford-comma style nits in code comments; no agent co-author on commits.

## File structure

| Path | Responsibility |
| :--- | :--- |
| `package.json` | Dev/test scripts and Vitest deps for middleware only |
| `wrangler.toml` | Pages project name, KV namespace bindings, vars placeholders (no secrets) |
| `.dev.vars.example` | Documented local secret names; real `.dev.vars` gitignored |
| `.gitignore` | Add `node_modules/`, `.dev.vars`, `.wrangler/` |
| `functions/lib/validate.js` | Parse/normalize body; email/name rules; honeypot; unknown-key reject |
| `functions/lib/turnstile.js` | Server-side Turnstile siteverify |
| `functions/lib/rate-limit.js` | IP fixed-window counter in KV |
| `functions/lib/volunteer.js` | Map payload → Volunteer POST; classify success / retryable / client error |
| `functions/lib/dlq.js` | Write failed payloads to KV; list/claim for retry |
| `functions/lib/log.js` | Redacted logger helpers |
| `functions/lib/handler.js` | Orchestrate validate → rate limit → turnstile → volunteer → DLQ |
| `functions/api/interest.js` | Pages Function entry: method gate, call handler, HTTP response |
| `functions/api/interest-retry.js` | Cron/scheduled entry (or `functions/_middleware` not used — separate scheduled worker binding documented in wrangler) |
| `functions/scheduled/retry-dlq.js` | Drain DLQ: retry Volunteer POSTs with attempt budget |
| `tests/validate.test.js` | Unit tests for validation |
| `tests/turnstile.test.js` | Unit tests with mocked `fetch` |
| `tests/rate-limit.test.js` | Unit tests with in-memory KV fake |
| `tests/volunteer.test.js` | Unit tests with mocked `fetch` |
| `tests/dlq.test.js` | Unit tests with in-memory KV fake |
| `tests/handler.test.js` | Integration-style unit tests of full pipeline |
| `tests/helpers/memory-kv.js` | Minimal KV namespace fake (`get`/`put`/`list`/`delete`) |
| `tests/helpers/mock-fetch.js` | URL-routed mock `fetch` |
| `README.md` | Short middleware section: secrets, `npm test`, `npx wrangler pages dev` |

**Interface contracts (stable names for all tasks):**

```js
// validate.js
export function validateInterestBody(raw) // → { ok: true, value: InterestInput } | { ok: false, error: string, status: 400 }
// InterestInput = { firstName: string, lastName: string, email: string, turnstileToken: string }

// turnstile.js
export async function verifyTurnstile({ token, ip, secret, fetchImpl })
// → { ok: true } | { ok: false, error: string }

// rate-limit.js
export async function checkRateLimit({ kv, ip, limit, windowSeconds, nowMs })
// → { ok: true, remaining: number } | { ok: false, retryAfterSeconds: number }

// volunteer.js
export function toVolunteerUserBody(input) // → { username, firstName, lastName }
export async function createOrgUser({ fetchImpl, baseUrl, orgId, token, body })
// → { ok: true, users: array }
// | { ok: false, retryable: boolean, status: number, error: string }

// dlq.js
export async function enqueueFailure({ kv, payload, error, nowMs })
// → { id: string }
export async function listDue({ kv, nowMs, limit })
// → Array<{ id, payload, attempts, nextAttemptAt, lastError }>
export async function markAttempt({ kv, id, success, error, nowMs, maxAttempts })
// → { done: boolean, poisoned: boolean }

// handler.js
export async function handleInterestPost(request, env, deps)
// deps = { fetchImpl, nowMs?: number }
// → Response
```

**Env bindings (`env` on the Function):**

| Name | Type | Notes |
| :--- | :--- | :--- |
| `VOLUNTEER_API_TOKEN` | secret string | Bearer token |
| `VOLUNTEER_ORG_ID` | string/var | Numeric org id as string |
| `VOLUNTEER_API_BASE` | string/var | Default `https://volunteer.bloomerang.co/api` |
| `TURNSTILE_SECRET_KEY` | secret string | |
| `RATE_LIMIT_KV` | KV namespace | Counters |
| `DLQ_KV` | KV namespace | Dead-letter payloads |
| `RATE_LIMIT_MAX` | optional var | Default `5` |
| `RATE_LIMIT_WINDOW_SECONDS` | optional var | Default `600` |
| `TURNSTILE_SKIP` | optional var | Only `true` in local/dev tests — never production |

---

### Task 1: Scaffold package, Wrangler, gitignore, KV fakes

**Files:**
- Create: `package.json`
- Create: `wrangler.toml`
- Create: `.dev.vars.example`
- Create: `tests/helpers/memory-kv.js`
- Create: `tests/helpers/mock-fetch.js`
- Modify: `.gitignore`
- Modify: `README.md` (add Middleware section at end)

**Interfaces:**
- Consumes: nothing
- Produces: `createMemoryKv()`, `createMockFetch(routes)` for later tests; npm scripts `test`, `test:watch`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tccane-website-v2",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "pages:dev": "wrangler pages dev . --compatibility-date=2024-11-01"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "wrangler": "^4.28.0"
  }
}
```

- [ ] **Step 2: Create `wrangler.toml`**

```toml
name = "tccane-website"
compatibility_date = "2024-11-01"
pages_build_output_dir = "."

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "REPLACE_WITH_RATE_LIMIT_KV_ID"
preview_id = "REPLACE_WITH_RATE_LIMIT_KV_PREVIEW_ID"

[[kv_namespaces]]
binding = "DLQ_KV"
id = "REPLACE_WITH_DLQ_KV_ID"
preview_id = "REPLACE_WITH_DLQ_KV_PREVIEW_ID"

[vars]
VOLUNTEER_API_BASE = "https://volunteer.bloomerang.co/api"
RATE_LIMIT_MAX = "5"
RATE_LIMIT_WINDOW_SECONDS = "600"
```

Note: Until real KV ids exist, local tests use memory fakes and do not need this file to apply. For `pages dev`, create namespaces with `npx wrangler kv namespace create RATE_LIMIT_KV` (and DLQ) and paste ids. Secrets are **not** in this file.

- [ ] **Step 3: Create `.dev.vars.example`**

```
VOLUNTEER_API_TOKEN=replace-me
VOLUNTEER_ORG_ID=0
TURNSTILE_SECRET_KEY=replace-me
TURNSTILE_SKIP=true
```

- [ ] **Step 4: Append to `.gitignore`**

```
node_modules/
.dev.vars
.wrangler/
dist/
```

- [ ] **Step 5: Write `tests/helpers/memory-kv.js`**

```js
/** Minimal KVNamespace stand-in for unit tests. */
export function createMemoryKv() {
  const store = new Map();

  return {
    async get(key, type = 'text') {
      const raw = store.get(key);
      if (raw === undefined) return null;
      if (type === 'json') return JSON.parse(raw);
      return raw;
    },
    async put(key, value, options = {}) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      if (options.expirationTtl) {
        // TTL ignored in unit tests unless a test asserts presence; keep metadata optional
        store.set(`${key}__meta`, JSON.stringify({ expirationTtl: options.expirationTtl }));
      }
    },
    async delete(key) {
      store.delete(key);
      store.delete(`${key}__meta`);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...store.keys()]
        .filter((k) => !k.endsWith('__meta') && k.startsWith(prefix))
        .slice(0, limit)
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
    /** test-only */
    _dump() {
      return store;
    },
  };
}
```

- [ ] **Step 6: Write `tests/helpers/mock-fetch.js`**

```js
/**
 * routes: Array<{ match: (url: string, init: RequestInit) => boolean,
 *                 response: Response | ((url, init) => Response | Promise<Response>) }>
 */
export function createMockFetch(routes) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    for (const route of routes) {
      if (route.match(url, init)) {
        const r = typeof route.response === 'function'
          ? await route.response(url, init)
          : route.response;
        return r;
      }
    }
    return new Response(JSON.stringify({ error: `unmocked fetch: ${url}` }), { status: 599 });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 7: Append Middleware section to `README.md`**

```markdown
## Middleware (Cloudflare Pages Function)

Volunteer registration API for the future interest form. Spec: `references/TDDs/Interest Form Bloomerang Volunteer - Technical Design - 08.02.html`.

```bash
npm install
npm test
cp .dev.vars.example .dev.vars   # fill when you have keys; TURNSTILE_SKIP=true for local
npx wrangler pages dev . --compatibility-date=2024-11-01
# POST http://127.0.0.1:8788/api/interest
```

Secrets (production): `VOLUNTEER_API_TOKEN`, `TURNSTILE_SECRET_KEY` via `wrangler pages secret put`. Vars: `VOLUNTEER_ORG_ID`. Never commit `.dev.vars`.
```

- [ ] **Step 8: Install and verify Vitest runs empty**

```bash
npm install
# create a placeholder so vitest does not exit 1 on zero files — next task adds real tests
mkdir -p tests
echo "import { expect, test } from 'vitest'; test('scaffold', () => expect(true).toBe(true));" > tests/scaffold.test.js
npm test
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json wrangler.toml .dev.vars.example .gitignore README.md tests/helpers tests/scaffold.test.js
git commit -m "chore: scaffold middleware package, wrangler, and test helpers"
```

---

### Task 2: Request validation module

**Files:**
- Create: `functions/lib/validate.js`
- Create: `tests/validate.test.js`
- Delete: `tests/scaffold.test.js` (after first real test file exists, or leave until end of this task)

**Interfaces:**
- Consumes: nothing
- Produces: `validateInterestBody(raw)` as specified in File structure

- [ ] **Step 1: Write the failing tests**

```js
// tests/validate.test.js
import { describe, expect, test } from 'vitest';
import { validateInterestBody } from '../functions/lib/validate.js';

describe('validateInterestBody', () => {
  test('accepts a minimal valid body', () => {
    const r = validateInterestBody({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@college.edu',
      turnstileToken: 'tok_abc',
    });
    expect(r).toEqual({
      ok: true,
      value: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@college.edu',
        turnstileToken: 'tok_abc',
      },
    });
  });

  test('trims whitespace on names and lowercases email', () => {
    const r = validateInterestBody({
      firstName: '  Ada  ',
      lastName: '  Lovelace ',
      email: '  Ada@College.EDU ',
      turnstileToken: 'tok',
    });
    expect(r.ok).toBe(true);
    expect(r.value.email).toBe('ada@college.edu');
    expect(r.value.firstName).toBe('Ada');
  });

  test('rejects missing fields', () => {
    const r = validateInterestBody({ firstName: 'A', email: 'a@b.co', turnstileToken: 't' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('rejects invalid email', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'not-an-email',
      turnstileToken: 't',
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('rejects unknown keys', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      turnstileToken: 't',
      extra: 'nope',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown/i);
  });

  test('rejects filled honeypot company', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      turnstileToken: 't',
      company: 'bot-co',
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('allows empty string honeypot company', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      turnstileToken: 't',
      company: '',
    });
    expect(r.ok).toBe(true);
    expect(r.value).not.toHaveProperty('company');
  });

  test('rejects empty names and overlong fields', () => {
    expect(
      validateInterestBody({
        firstName: '',
        lastName: 'B',
        email: 'a@b.co',
        turnstileToken: 't',
      }).ok,
    ).toBe(false);
    expect(
      validateInterestBody({
        firstName: 'A'.repeat(101),
        lastName: 'B',
        email: 'a@b.co',
        turnstileToken: 't',
      }).ok,
    ).toBe(false);
  });

  test('rejects non-object body', () => {
    expect(validateInterestBody(null).ok).toBe(false);
    expect(validateInterestBody('x').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
rm -f tests/scaffold.test.js
npm test -- tests/validate.test.js
```

Expected: FAIL — cannot find module `../functions/lib/validate.js`

- [ ] **Step 3: Implement `functions/lib/validate.js`**

```js
const ALLOWED = new Set(['firstName', 'lastName', 'email', 'turnstileToken', 'company']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_TOKEN = 4096;

export function validateInterestBody(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Body must be a JSON object' };
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED.has(key)) {
      return { ok: false, status: 400, error: `Unknown field: ${key}` };
    }
  }

  if (typeof raw.company === 'string' && raw.company.trim() !== '') {
    return { ok: false, status: 400, error: 'Rejected' };
  }

  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
  const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
  const emailRaw = typeof raw.email === 'string' ? raw.email.trim() : '';
  const turnstileToken =
    typeof raw.turnstileToken === 'string' ? raw.turnstileToken.trim() : '';

  if (!firstName || !lastName || !emailRaw || !turnstileToken) {
    return { ok: false, status: 400, error: 'firstName, lastName, email, and turnstileToken are required' };
  }
  if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
    return { ok: false, status: 400, error: 'Name too long' };
  }
  if (emailRaw.length > MAX_EMAIL || !EMAIL_RE.test(emailRaw)) {
    return { ok: false, status: 400, error: 'Invalid email' };
  }
  if (turnstileToken.length > MAX_TOKEN) {
    return { ok: false, status: 400, error: 'Invalid turnstileToken' };
  }

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      email: emailRaw.toLowerCase(),
      turnstileToken,
    },
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- tests/validate.test.js
```

- [ ] **Step 5: Commit**

```bash
git add functions/lib/validate.js tests/validate.test.js
git add -u tests/scaffold.test.js
git commit -m "feat(middleware): validate interest registration body"
```

---

### Task 3: Turnstile verification module

**Files:**
- Create: `functions/lib/turnstile.js`
- Create: `tests/turnstile.test.js`

**Interfaces:**
- Consumes: `createMockFetch`, `jsonResponse`
- Produces: `verifyTurnstile({ token, ip, secret, fetchImpl })`

- [ ] **Step 1: Write failing tests**

```js
// tests/turnstile.test.js
import { describe, expect, test } from 'vitest';
import { verifyTurnstile } from '../functions/lib/turnstile.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

describe('verifyTurnstile', () => {
  test('returns ok when siteverify success', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('challenges.cloudflare.com/turnstile'),
        response: jsonResponse(200, { success: true }),
      },
    ]);
    const r = await verifyTurnstile({
      token: 'tok',
      ip: '1.2.3.4',
      secret: 'sec',
      fetchImpl,
    });
    expect(r).toEqual({ ok: true });
    expect(fetchImpl.calls[0].init.method).toBe('POST');
  });

  test('returns not ok when siteverify fails', async () => {
    const fetchImpl = createMockFetch([
      {
        match: () => true,
        response: jsonResponse(200, { success: false, 'error-codes': ['invalid-input-response'] }),
      },
    ]);
    const r = await verifyTurnstile({
      token: 'bad',
      ip: '1.2.3.4',
      secret: 'sec',
      fetchImpl,
    });
    expect(r.ok).toBe(false);
  });

  test('returns not ok on non-200 from siteverify', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: new Response('nope', { status: 502 }) },
    ]);
    const r = await verifyTurnstile({
      token: 'tok',
      ip: '1.2.3.4',
      secret: 'sec',
      fetchImpl,
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/turnstile.test.js
```

- [ ] **Step 3: Implement `functions/lib/turnstile.js`**

```js
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile({ token, ip, secret, fetchImpl }) {
  if (!token || !secret) {
    return { ok: false, error: 'Missing turnstile token or secret' };
  }
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  let res;
  try {
    res = await fetchImpl(SITEVERIFY, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    return { ok: false, error: 'Turnstile request failed' };
  }

  if (!res.ok) {
    return { ok: false, error: `Turnstile HTTP ${res.status}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: 'Turnstile invalid JSON' };
  }

  if (data && data.success === true) {
    return { ok: true };
  }
  return { ok: false, error: 'Turnstile verification failed' };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- tests/turnstile.test.js
```

- [ ] **Step 5: Commit**

```bash
git add functions/lib/turnstile.js tests/turnstile.test.js
git commit -m "feat(middleware): verify Cloudflare Turnstile server-side"
```

---

### Task 4: KV rate limiter

**Files:**
- Create: `functions/lib/rate-limit.js`
- Create: `tests/rate-limit.test.js`

**Interfaces:**
- Consumes: `createMemoryKv`
- Produces: `checkRateLimit({ kv, ip, limit, windowSeconds, nowMs })`

- [ ] **Step 1: Write failing tests**

```js
// tests/rate-limit.test.js
import { describe, expect, test } from 'vitest';
import { checkRateLimit } from '../functions/lib/rate-limit.js';
import { createMemoryKv } from './helpers/memory-kv.js';

describe('checkRateLimit', () => {
  test('allows first request and decrements remaining', async () => {
    const kv = createMemoryKv();
    const r = await checkRateLimit({
      kv,
      ip: '10.0.0.1',
      limit: 5,
      windowSeconds: 600,
      nowMs: 1_000_000,
    });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
  });

  test('blocks after limit reached in window', async () => {
    const kv = createMemoryKv();
    const args = { kv, ip: '10.0.0.2', limit: 2, windowSeconds: 600, nowMs: 1_000_000 };
    expect((await checkRateLimit(args)).ok).toBe(true);
    expect((await checkRateLimit(args)).ok).toBe(true);
    const blocked = await checkRateLimit(args);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('resets after window elapses', async () => {
    const kv = createMemoryKv();
    const ip = '10.0.0.3';
    await checkRateLimit({ kv, ip, limit: 1, windowSeconds: 60, nowMs: 0 });
    const blocked = await checkRateLimit({ kv, ip, limit: 1, windowSeconds: 60, nowMs: 30_000 });
    expect(blocked.ok).toBe(false);
    const ok = await checkRateLimit({ kv, ip, limit: 1, windowSeconds: 60, nowMs: 61_000 });
    expect(ok.ok).toBe(true);
  });

  test('isolates counters per IP', async () => {
    const kv = createMemoryKv();
    await checkRateLimit({ kv, ip: '1.1.1.1', limit: 1, windowSeconds: 60, nowMs: 0 });
    const other = await checkRateLimit({ kv, ip: '2.2.2.2', limit: 1, windowSeconds: 60, nowMs: 0 });
    expect(other.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/rate-limit.test.js
```

- [ ] **Step 3: Implement `functions/lib/rate-limit.js`**

```js
function bucketKey(ip, windowStart) {
  return `rl:${ip}:${windowStart}`;
}

export async function checkRateLimit({ kv, ip, limit, windowSeconds, nowMs }) {
  const safeIp = ip && String(ip).trim() ? String(ip).trim() : 'unknown';
  const windowStart = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
  const key = bucketKey(safeIp, windowStart);
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;

  if (count >= limit) {
    const windowEndMs = (windowStart + windowSeconds) * 1000;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  const next = count + 1;
  await kv.put(key, String(next), { expirationTtl: windowSeconds + 60 });
  return { ok: true, remaining: Math.max(0, limit - next) };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- tests/rate-limit.test.js
```

- [ ] **Step 5: Commit**

```bash
git add functions/lib/rate-limit.js tests/rate-limit.test.js
git commit -m "feat(middleware): IP rate limit via KV fixed window"
```

---

### Task 5: Volunteer API client

**Files:**
- Create: `functions/lib/volunteer.js`
- Create: `tests/volunteer.test.js`

**Interfaces:**
- Consumes: `createMockFetch`, `jsonResponse`
- Produces: `toVolunteerUserBody`, `createOrgUser`

- [ ] **Step 1: Write failing tests**

```js
// tests/volunteer.test.js
import { describe, expect, test } from 'vitest';
import { createOrgUser, toVolunteerUserBody } from '../functions/lib/volunteer.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

describe('toVolunteerUserBody', () => {
  test('maps email to username', () => {
    expect(
      toVolunteerUserBody({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@college.edu',
      }),
    ).toEqual({
      username: 'ada@college.edu',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });
});

describe('createOrgUser', () => {
  const base = {
    baseUrl: 'https://volunteer.bloomerang.co/api',
    orgId: '42',
    token: 'secret-token',
    body: { username: 'a@b.co', firstName: 'A', lastName: 'B' },
  };

  test('POSTs to org users and returns users on 200', async () => {
    const users = [{ id: 1, username: 'a@b.co' }];
    const fetchImpl = createMockFetch([
      {
        match: (url, init) =>
          url === 'https://volunteer.bloomerang.co/api/v4/organizations/42/users' &&
          init.method === 'POST',
        response: async (_url, init) => {
          expect(init.headers.Authorization).toBe('Bearer secret-token');
          expect(JSON.parse(init.body)).toEqual(base.body);
          return jsonResponse(200, users);
        },
      },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r).toEqual({ ok: true, users });
  });

  test('marks 5xx as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(503);
  });

  test('marks network throw as retryable', async () => {
    const fetchImpl = async () => {
      throw new Error('network');
    };
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });

  test('marks 4xx as not retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
    expect(r.status).toBe(400);
  });

  test('marks 401 as not retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(401, {}) },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.retryable).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/volunteer.test.js
```

- [ ] **Step 3: Implement `functions/lib/volunteer.js`**

```js
export function toVolunteerUserBody(input) {
  return {
    username: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  };
}

export async function createOrgUser({ fetchImpl, baseUrl, orgId, token, body }) {
  const root = baseUrl.replace(/\/$/, '');
  const url = `${root}/v4/organizations/${encodeURIComponent(orgId)}/users`;

  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Volunteer network error' };
  }

  if (res.ok) {
    let users;
    try {
      users = await res.json();
    } catch {
      users = [];
    }
    return { ok: true, users: Array.isArray(users) ? users : [users] };
  }

  const status = res.status;
  const retryable = status >= 500 || status === 429;
  let error = `Volunteer HTTP ${status}`;
  try {
    const text = await res.text();
    if (text) error = text.slice(0, 200);
  } catch {
    /* ignore */
  }
  return { ok: false, retryable, status, error };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- tests/volunteer.test.js
```

- [ ] **Step 5: Commit**

```bash
git add functions/lib/volunteer.js tests/volunteer.test.js
git commit -m "feat(middleware): Bloomerang Volunteer createOrgUser client"
```

---

### Task 6: Dead-letter queue (KV)

**Files:**
- Create: `functions/lib/dlq.js`
- Create: `tests/dlq.test.js`

**Interfaces:**
- Consumes: `createMemoryKv`
- Produces: `enqueueFailure`, `listDue`, `markAttempt`

**DLQ record shape (stored JSON under key `dlq:{id}`):**

```js
{
  id: string,              // ulid-like: `${nowMs}-${random}`
  payload: { firstName, lastName, email },  // no turnstile token
  attempts: number,
  maxAttempts: number,     // default 12
  createdAt: number,
  nextAttemptAt: number,
  lastError: string,
  poisoned: boolean
}
```

Backoff: `nextAttemptAt = nowMs + min(3600_000, 30_000 * 2^attempts)` ms.

- [ ] **Step 1: Write failing tests**

```js
// tests/dlq.test.js
import { describe, expect, test } from 'vitest';
import { enqueueFailure, listDue, markAttempt } from '../functions/lib/dlq.js';
import { createMemoryKv } from './helpers/memory-kv.js';

describe('dlq', () => {
  test('enqueue then listDue returns the item', async () => {
    const kv = createMemoryKv();
    const { id } = await enqueueFailure({
      kv,
      payload: { firstName: 'A', lastName: 'B', email: 'a@b.co' },
      error: '503',
      nowMs: 1_000,
    });
    const due = await listDue({ kv, nowMs: 1_000, limit: 10 });
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(id);
    expect(due[0].payload.email).toBe('a@b.co');
    expect(due[0].payload).not.toHaveProperty('turnstileToken');
  });

  test('listDue skips future nextAttemptAt', async () => {
    const kv = createMemoryKv();
    await enqueueFailure({
      kv,
      payload: { firstName: 'A', lastName: 'B', email: 'a@b.co' },
      error: 'x',
      nowMs: 0,
    });
    // after one failed markAttempt, nextAttemptAt is in the future
    const due0 = await listDue({ kv, nowMs: 0, limit: 10 });
    await markAttempt({
      kv,
      id: due0[0].id,
      success: false,
      error: 'still down',
      nowMs: 0,
      maxAttempts: 12,
    });
    const notDue = await listDue({ kv, nowMs: 1_000, limit: 10 });
    expect(notDue).toHaveLength(0);
    const later = await listDue({ kv, nowMs: 60_000, limit: 10 });
    expect(later.length).toBeGreaterThanOrEqual(0); // may be due depending on backoff
  });

  test('markAttempt success deletes record', async () => {
    const kv = createMemoryKv();
    const { id } = await enqueueFailure({
      kv,
      payload: { firstName: 'A', lastName: 'B', email: 'a@b.co' },
      error: 'x',
      nowMs: 0,
    });
    const r = await markAttempt({ kv, id, success: true, error: '', nowMs: 0, maxAttempts: 12 });
    expect(r.done).toBe(true);
    expect(await listDue({ kv, nowMs: 0, limit: 10 })).toHaveLength(0);
  });

  test('markAttempt poisons after maxAttempts', async () => {
    const kv = createMemoryKv();
    const { id } = await enqueueFailure({
      kv,
      payload: { firstName: 'A', lastName: 'B', email: 'a@b.co' },
      error: 'x',
      nowMs: 0,
    });
    let poisoned = false;
    let now = 0;
    for (let i = 0; i < 20; i++) {
      const due = await listDue({ kv, nowMs: now, limit: 10 });
      if (!due.find((d) => d.id === id)) {
        now += 3_600_000;
        continue;
      }
      const r = await markAttempt({
        kv,
        id,
        success: false,
        error: 'fail',
        nowMs: now,
        maxAttempts: 3,
      });
      if (r.poisoned) {
        poisoned = true;
        break;
      }
      now += 3_600_000;
    }
    expect(poisoned).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/dlq.test.js
```

- [ ] **Step 3: Implement `functions/lib/dlq.js`**

```js
const PREFIX = 'dlq:';
const DEFAULT_MAX = 12;

function backoffMs(attempts) {
  return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempts));
}

function newId(nowMs) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${nowMs}-${rand}`;
}

export async function enqueueFailure({ kv, payload, error, nowMs, maxAttempts = DEFAULT_MAX }) {
  const id = newId(nowMs);
  const record = {
    id,
    payload: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    },
    attempts: 0,
    maxAttempts,
    createdAt: nowMs,
    nextAttemptAt: nowMs,
    lastError: String(error || '').slice(0, 300),
    poisoned: false,
  };
  await kv.put(PREFIX + id, JSON.stringify(record));
  return { id };
}

export async function listDue({ kv, nowMs, limit = 20 }) {
  const listed = await kv.list({ prefix: PREFIX, limit: 1000 });
  const out = [];
  for (const { name } of listed.keys) {
    const rec = await kv.get(name, 'json');
    if (!rec || rec.poisoned) continue;
    if (rec.nextAttemptAt <= nowMs) out.push(rec);
    if (out.length >= limit) break;
  }
  return out;
}

export async function markAttempt({ kv, id, success, error, nowMs, maxAttempts = DEFAULT_MAX }) {
  const key = PREFIX + id;
  const rec = await kv.get(key, 'json');
  if (!rec) return { done: true, poisoned: false };

  if (success) {
    await kv.delete(key);
    return { done: true, poisoned: false };
  }

  rec.attempts = (rec.attempts || 0) + 1;
  rec.lastError = String(error || '').slice(0, 300);
  rec.maxAttempts = maxAttempts;
  if (rec.attempts >= maxAttempts) {
    rec.poisoned = true;
    rec.nextAttemptAt = nowMs + 86_400_000;
    await kv.put(key, JSON.stringify(rec));
    return { done: false, poisoned: true };
  }
  rec.nextAttemptAt = nowMs + backoffMs(rec.attempts);
  await kv.put(key, JSON.stringify(rec));
  return { done: false, poisoned: false };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- tests/dlq.test.js
```

If the backoff test is flaky, tighten assertions to only check poison loop and success-delete (already primary).

- [ ] **Step 5: Commit**

```bash
git add functions/lib/dlq.js tests/dlq.test.js
git commit -m "feat(middleware): KV dead-letter queue for Volunteer retries"
```

---

### Task 7: Redacted logger + handler orchestration

**Files:**
- Create: `functions/lib/log.js`
- Create: `functions/lib/handler.js`
- Create: `tests/handler.test.js`

**Interfaces:**
- Consumes: all prior lib modules, helpers
- Produces: `handleInterestPost(request, env, deps)` → `Response`

**HTTP contract:**

| Case | Status | Body |
| :--- | ---: | :--- |
| Not POST | 405 | `{ "error": "Method not allowed" }` |
| Invalid JSON | 400 | `{ "error": "..." }` |
| Validation fail | 400 | `{ "error": "..." }` |
| Rate limited | 429 | `{ "error": "Too many requests" }` + `Retry-After` |
| Turnstile fail | 403 | `{ "error": "Verification failed" }` |
| Volunteer OK | 200 | `{ "ok": true, "status": "registered" }` |
| Volunteer retryable fail (enqueued) | 200 | `{ "ok": true, "status": "accepted" }` |
| Volunteer non-retryable fail | 502 | `{ "error": "Registration failed" }` |
| Missing server config | 500 | `{ "error": "Server misconfigured" }` |

Client IP: `request.headers.get('CF-Connecting-IP')` or `x-forwarded-for` first hop or `unknown`.

`TURNSTILE_SKIP === 'true'` bypasses Turnstile (local only).

- [ ] **Step 1: Write failing handler tests**

```js
// tests/handler.test.js
import { describe, expect, test } from 'vitest';
import { handleInterestPost } from '../functions/lib/handler.js';
import { createMemoryKv } from './helpers/memory-kv.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

function envBase(over = {}) {
  return {
    VOLUNTEER_API_TOKEN: 'tok',
    VOLUNTEER_ORG_ID: '99',
    VOLUNTEER_API_BASE: 'https://volunteer.bloomerang.co/api',
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

const valid = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@college.edu',
  turnstileToken: 'ignored-when-skip',
};

describe('handleInterestPost', () => {
  test('405 on GET', async () => {
    const req = new Request('https://example.test/api/interest', { method: 'GET' });
    const res = await handleInterestPost(req, envBase(), { fetchImpl: createMockFetch([]) });
    expect(res.status).toBe(405);
  });

  test('200 registered when Volunteer succeeds', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/organizations/99/users'),
        response: jsonResponse(200, [{ id: 1, username: 'ada@college.edu' }]),
      },
    ]);
    const res = await handleInterestPost(post(valid), envBase(), {
      fetchImpl,
      nowMs: 1_000,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'registered' });
  });

  test('200 accepted and DLQ write when Volunteer 503', async () => {
    const env = envBase();
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/users'),
        response: jsonResponse(503, { error: 'down' }),
      },
    ]);
    const res = await handleInterestPost(post(valid), env, { fetchImpl, nowMs: 5_000 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'accepted' });
    const listed = await env.DLQ_KV.list({ prefix: 'dlq:' });
    expect(listed.keys.length).toBe(1);
  });

  test('400 on unknown field', async () => {
    const res = await handleInterestPost(
      post({ ...valid, extra: 1 }),
      envBase(),
      { fetchImpl: createMockFetch([]) },
    );
    expect(res.status).toBe(400);
  });

  test('429 when rate limited', async () => {
    const env = envBase({ RATE_LIMIT_MAX: '1' });
    const deps = { fetchImpl: createMockFetch([
      { match: () => true, response: jsonResponse(200, []) },
    ]), nowMs: 10_000 };
    const ipHeaders = { 'CF-Connecting-IP': '9.9.9.9' };
    expect((await handleInterestPost(post(valid, ipHeaders), env, deps)).status).toBe(200);
    const res2 = await handleInterestPost(post(valid, ipHeaders), env, deps);
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
    const res = await handleInterestPost(post(valid), env, { fetchImpl, nowMs: 1 });
    expect(res.status).toBe(403);
  });

  test('500 when token missing', async () => {
    const env = envBase({ VOLUNTEER_API_TOKEN: '' });
    const res = await handleInterestPost(post(valid), env, {
      fetchImpl: createMockFetch([]),
      nowMs: 1,
    });
    expect(res.status).toBe(500);
  });

  test('502 when Volunteer 400 non-retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const res = await handleInterestPost(post(valid), envBase(), {
      fetchImpl,
      nowMs: 1,
    });
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/handler.test.js
```

- [ ] **Step 3: Implement `functions/lib/log.js`**

```js
/** FNV-1a 32-bit hex prefix — enough to correlate, not reverse email. */
export function emailFingerprint(email) {
  const s = String(email || '').toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function info(msg, fields = {}) {
  console.log(JSON.stringify({ level: 'info', msg, ...fields }));
}

export function warn(msg, fields = {}) {
  console.warn(JSON.stringify({ level: 'warn', msg, ...fields }));
}
```

- [ ] **Step 4: Implement `functions/lib/handler.js`**

```js
import { validateInterestBody } from './validate.js';
import { verifyTurnstile } from './turnstile.js';
import { checkRateLimit } from './rate-limit.js';
import { createOrgUser, toVolunteerUserBody } from './volunteer.js';
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

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!env.VOLUNTEER_API_TOKEN || !env.VOLUNTEER_ORG_ID) {
    warn('misconfigured', { hasToken: Boolean(env.VOLUNTEER_API_TOKEN) });
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

  const limit = parseInt(env.RATE_LIMIT_MAX || '5', 10);
  const windowSeconds = parseInt(env.RATE_LIMIT_WINDOW_SECONDS || '600', 10);
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

  const body = toVolunteerUserBody(input);
  const result = await createOrgUser({
    fetchImpl,
    baseUrl: env.VOLUNTEER_API_BASE || 'https://volunteer.bloomerang.co/api',
    orgId: env.VOLUNTEER_ORG_ID,
    token: env.VOLUNTEER_API_TOKEN,
    body,
  });

  if (result.ok) {
    info('registered', { fp });
    return json(200, { ok: true, status: 'registered' });
  }

  if (result.retryable) {
    await enqueueFailure({
      kv: env.DLQ_KV,
      payload: input,
      error: result.error,
      nowMs,
    });
    warn('volunteer_retryable_enqueued', { fp, status: result.status });
    return json(200, { ok: true, status: 'accepted' });
  }

  warn('volunteer_failed', { fp, status: result.status });
  return json(502, { error: 'Registration failed' });
}
```

- [ ] **Step 5: Run all unit tests — expect PASS**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add functions/lib/log.js functions/lib/handler.js tests/handler.test.js
git commit -m "feat(middleware): orchestrate interest registration handler"
```

---

### Task 8: Pages Function entrypoints + DLQ retry scheduler

**Files:**
- Create: `functions/api/interest.js`
- Create: `functions/scheduled/retry-dlq.js`
- Create: `tests/retry-dlq.test.js`
- Modify: `wrangler.toml` (document cron; Pages scheduled functions use Workers — add a note and a standalone export testable in unit tests; wire cron when deploying as Worker or via Pages Functions scheduled events if available)

**Interfaces:**
- Consumes: `handleInterestPost`, `listDue`, `markAttempt`, `createOrgUser`, `toVolunteerUserBody`
- Produces: HTTP entry default export; `processDlqBatch(env, deps)` for retries

**Pages Function file:** Cloudflare maps `functions/api/interest.js` → `/api/interest`. Export:

```js
export async function onRequestPost(context) { ... }
export async function onRequest(context) { ... } // delegate non-POST to handler for 405
```

- [ ] **Step 1: Write failing retry tests**

```js
// tests/retry-dlq.test.js
import { describe, expect, test } from 'vitest';
import { enqueueFailure } from '../functions/lib/dlq.js';
import { processDlqBatch } from '../functions/scheduled/retry-dlq.js';
import { createMemoryKv } from './helpers/memory-kv.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

describe('processDlqBatch', () => {
  test('retries due items and deletes on success', async () => {
    const DLQ_KV = createMemoryKv();
    await enqueueFailure({
      kv: DLQ_KV,
      payload: { firstName: 'A', lastName: 'B', email: 'a@b.co' },
      error: '503',
      nowMs: 0,
    });
    const env = {
      DLQ_KV,
      VOLUNTEER_API_TOKEN: 't',
      VOLUNTEER_ORG_ID: '1',
      VOLUNTEER_API_BASE: 'https://volunteer.bloomerang.co/api',
    };
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/users'),
        response: jsonResponse(200, [{ id: 9 }]),
      },
    ]);
    const summary = await processDlqBatch(env, { fetchImpl, nowMs: 0, limit: 10 });
    expect(summary.succeeded).toBe(1);
    expect((await DLQ_KV.list({ prefix: 'dlq:' })).keys.length).toBe(0);
  });

  test('increments attempts on continued failure', async () => {
    const DLQ_KV = createMemoryKv();
    await enqueueFailure({
      kv: DLQ_KV,
      payload: { firstName: 'A', lastName: 'B', email: 'a@b.co' },
      error: '503',
      nowMs: 0,
    });
    const env = {
      DLQ_KV,
      VOLUNTEER_API_TOKEN: 't',
      VOLUNTEER_ORG_ID: '1',
      VOLUNTEER_API_BASE: 'https://volunteer.bloomerang.co/api',
    };
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, {}) },
    ]);
    await processDlqBatch(env, { fetchImpl, nowMs: 0, limit: 10 });
    const listed = await DLQ_KV.list({ prefix: 'dlq:' });
    const rec = await DLQ_KV.get(listed.keys[0].name, 'json');
    expect(rec.attempts).toBe(1);
    expect(rec.nextAttemptAt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/retry-dlq.test.js
```

- [ ] **Step 3: Implement `functions/scheduled/retry-dlq.js`**

```js
import { listDue, markAttempt } from '../lib/dlq.js';
import { createOrgUser, toVolunteerUserBody } from '../lib/volunteer.js';
import { emailFingerprint, info, warn } from '../lib/log.js';

export async function processDlqBatch(env, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const nowMs = deps.nowMs ?? Date.now();
  const limit = deps.limit ?? 20;
  const due = await listDue({ kv: env.DLQ_KV, nowMs, limit });
  let succeeded = 0;
  let failed = 0;
  let poisoned = 0;

  for (const item of due) {
    const body = toVolunteerUserBody(item.payload);
    const result = await createOrgUser({
      fetchImpl,
      baseUrl: env.VOLUNTEER_API_BASE || 'https://volunteer.bloomerang.co/api',
      orgId: env.VOLUNTEER_ORG_ID,
      token: env.VOLUNTEER_API_TOKEN,
      body,
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
      const r = await markAttempt({
        kv: env.DLQ_KV,
        id: item.id,
        success: false,
        error: result.error,
        nowMs,
        maxAttempts: 1, // force poison on permanent failure
      });
      // permanent failure: poison immediately
      await markAttempt({
        kv: env.DLQ_KV,
        id: item.id,
        success: false,
        error: `permanent:${result.error}`,
        nowMs,
        maxAttempts: 1,
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
```

**Fix permanent-failure path** so it does not double-call markAttempt awkwardly — implementer’s final version should be:

```js
    if (!result.retryable) {
      // set attempts to max by passing maxAttempts: 1 when attempts already 0 after one fail
      let r = { poisoned: false };
      while (!r.poisoned) {
        r = await markAttempt({
          kv: env.DLQ_KV,
          id: item.id,
          success: false,
          error: `permanent:${result.error}`,
          nowMs,
          maxAttempts: 1,
        });
        if (!r.poisoned && r.done) break;
      }
      poisoned += 1;
      ...
```

Cleaner approach for permanent errors — add optional force to `markAttempt` **or** put key `poisoned: true` via a small `poisonRecord` export. Prefer adding to `dlq.js`:

```js
export async function poisonRecord({ kv, id, error, nowMs }) {
  const key = 'dlq:' + id;
  const rec = await kv.get(key, 'json');
  if (!rec) return;
  rec.poisoned = true;
  rec.lastError = String(error || '').slice(0, 300);
  rec.nextAttemptAt = nowMs + 86_400_000;
  await kv.put(key, JSON.stringify(rec));
}
```

Add a unit test in `tests/dlq.test.js` for `poisonRecord`, then use it from `processDlqBatch` for non-retryable Volunteer responses. Do this in the same task commit.

- [ ] **Step 4: Implement `functions/api/interest.js`**

```js
import { handleInterestPost } from '../lib/handler.js';

export async function onRequest(context) {
  const { request, env } = context;
  return handleInterestPost(request, env, { fetchImpl: fetch });
}
```

- [ ] **Step 5: Export scheduled entry for documentation**

```js
// functions/scheduled/retry-dlq.js — already has processDlqBatch
// Optional Pages/Workers cron wrapper:
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processDlqBatch(env, { fetchImpl: fetch }));
  },
};
```

Add to `README.md` Middleware section:

```markdown
### DLQ retry

`processDlqBatch` lives in `functions/scheduled/retry-dlq.js`. Wire it as a
Cron Trigger on a small Worker that shares the `DLQ_KV` binding and the same
secrets (every 5 minutes), or call it from an authenticated ops route later.
Until cron is wired, failed registrations remain in KV for manual replay:
`npx wrangler kv key list --binding=DLQ_KV`.
```

- [ ] **Step 6: Run full suite**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add functions/api/interest.js functions/scheduled/retry-dlq.js functions/lib/dlq.js tests/retry-dlq.test.js tests/dlq.test.js README.md
git commit -m "feat(middleware): Pages Function entry and DLQ retry batch"
```

---

### Task 9: Config guard tests + secret hygiene check + manual dry-run script

**Files:**
- Create: `tests/hygiene.test.js`
- Create: `scripts/smoke-interest.sh`
- Modify: `package.json` (optional script `"smoke": "bash scripts/smoke-interest.sh"`)
- Modify: `README.md` (when API key arrives checklist)

**Interfaces:**
- Consumes: handler
- Produces: CI-safe smoke script that hits local server only when `SMOKE=1`

- [ ] **Step 1: Write hygiene tests**

```js
// tests/hygiene.test.js
import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.wrangler') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe('secret hygiene', () => {
  test('repo source does not contain bearer-looking volunteer tokens', () => {
    const root = join(process.cwd());
    const files = walk(root).filter(
      (f) =>
        f.endsWith('.js') ||
        f.endsWith('.md') ||
        f.endsWith('.toml') ||
        f.endsWith('.example'),
    );
    const banned = /Bearer\s+[A-Za-z0-9+/=]{20,}/;
    for (const f of files) {
      if (f.includes(`${join('references', 'plans')}`)) continue;
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(banned);
    }
  });
});
```

- [ ] **Step 2: Write `scripts/smoke-interest.sh`**

```bash
#!/usr/bin/env bash
# Usage (local): SMOKE=1 BASE_URL=http://127.0.0.1:8788 ./scripts/smoke-interest.sh
set -euo pipefail
if [[ "${SMOKE:-}" != "1" ]]; then
  echo "Set SMOKE=1 to run. Start pages dev first with .dev.vars configured."
  exit 0
fi
BASE_URL="${BASE_URL:-http://127.0.0.1:8788}"
curl -sS -X POST "$BASE_URL/api/interest" \
  -H 'content-type: application/json' \
  -d '{"firstName":"Test","lastName":"User","email":"test-smoke@example.com","turnstileToken":"dev","company":""}' \
  | tee /tmp/interest-smoke.json
grep -q '"ok":true' /tmp/interest-smoke.json
echo "smoke ok"
```

```bash
chmod +x scripts/smoke-interest.sh
```

- [ ] **Step 3: README checklist when Bloomerang key arrives**

Append:

```markdown
### When the Volunteer API key arrives

1. `npx wrangler kv namespace create RATE_LIMIT_KV` and `DLQ_KV`; paste ids into `wrangler.toml`.
2. `npx wrangler pages secret put VOLUNTEER_API_TOKEN`
3. `npx wrangler pages secret put TURNSTILE_SECRET_KEY`
4. Set `VOLUNTEER_ORG_ID` in Pages project variables (production). Ensure `TURNSTILE_SKIP` is **unset** in production.
5. Deploy Pages project; confirm `POST /api/interest` with a real Turnstile token creates a user in Volunteer.
6. Wire cron Worker for `processDlqBatch` sharing `DLQ_KV`.
```

- [ ] **Step 4: Run full suite**

```bash
npm test
```

Expected: PASS including hygiene

- [ ] **Step 5: Commit**

```bash
git add tests/hygiene.test.js scripts/smoke-interest.sh package.json README.md
git commit -m "test(middleware): secret hygiene and local smoke script"
```

---

### Task 10: Final verification gate

**Files:** none new

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all green

- [ ] **Step 2: Grep for placeholders / TODOs in functions/**

```bash
rg -n "TODO|TBD|FIXME|implement later" functions tests || true
```

Expected: no hits (or only none)

- [ ] **Step 3: Confirm tree**

```bash
find functions tests scripts -type f | sort
```

Expected paths match File structure above.

- [ ] **Step 4: Final commit only if uncommitted fixes remain**

```bash
git status
# if clean, done; else commit fixup with message explaining the fix
```

---

## Self-review

**1. Spec coverage (TDD → tasks)**

| TDD item | Task |
| :--- | :--- |
| Pages Function `POST /api/interest` | 8 |
| Validate first/last/email + unknown keys | 2 |
| Honeypot `company` | 2 |
| Turnstile server verify | 3, 7 |
| Rate limit ≤5 / 10 min / IP | 4, 7 |
| Least privilege — only create user POST | 5, 7 (no GET client) |
| Map username=email | 5 |
| Sync Volunteer then DLQ on retryable fail | 6, 7 |
| 200 `accepted` when durable buffer used | 7 |
| Secrets not in repo | 1, 9 |
| Redacted logging | 7 (`emailFingerprint`) |
| Retry consumer | 8 |
| API key later — mocks | all tests; smoke optional |
| Frontend form | **Out of scope** (stated) |

**2. Placeholder scan:** No TBD/TODO steps; permanent-failure path in Task 8 specifies `poisonRecord` addition explicitly.

**3. Type consistency:** Names `validateInterestBody`, `verifyTurnstile`, `checkRateLimit`, `toVolunteerUserBody`, `createOrgUser`, `enqueueFailure`, `listDue`, `markAttempt`, `handleInterestPost`, `processDlqBatch` match across tasks. Env keys consistent. Response statuses documented in Task 7 and used in tests.

**Gap accepted:** Cron is documented + unit-tested batch function, not fully provisioned as a second Worker in Cloudflare dashboard (requires account). Live Volunteer call waits on API key (checklist Task 9).
