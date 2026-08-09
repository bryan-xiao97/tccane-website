import { describe, expect, test } from 'vitest';
import { handleInterestPost } from '../functions/lib/handler.js';
import { GoogleAuthError } from '../functions/lib/google-token.js';
import { SHEET_HEADERS } from '../functions/lib/sheets.js';
import { createMemoryKv } from './helpers/memory-kv.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

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
      match: (url) => decodeURIComponent(url).includes("'Submissions'!A1:E1"),
      response: jsonResponse(200, { values: [SHEET_HEADERS] }),
    },
    {
      match: (url) => decodeURIComponent(url).includes("'Submissions'!A:A"),
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
    expect(await res.json()).toEqual({ error: 'Submission temporarily unavailable' });
  });

  test('502 when Sheets append is a permanent 400', async () => {
    const fetchImpl = sheetsFetch({ appendStatus: 400 });
    const res = await handleInterestPost(post(valid), envBase(), { fetchImpl, ...deps() });
    expect(res.status).toBe(502);
  });
});
