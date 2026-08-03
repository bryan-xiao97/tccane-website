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
