import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GoogleAuthError } from '../functions/lib/google-token.js';
import { SHEET_HEADERS } from '../functions/lib/sheets.js';
import { enqueueFailure } from '../functions/lib/dlq.js';
import { processDlqBatch } from '../functions/scheduled/retry-dlq.js';
import { createMemoryKv } from './helpers/memory-kv.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

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

function headerRoute() {
  return {
    match: (url) => decodeURIComponent(url).includes("'Submissions'!A1:E1"),
    response: jsonResponse(200, { values: [SHEET_HEADERS] }),
  };
}

function idsRoute(values = []) {
  return {
    match: (url) => decodeURIComponent(url).includes("'Submissions'!A:A"),
    response: jsonResponse(200, { values }),
  };
}

function appendRoute(status = 200, body = { updates: { updatedRows: 1 } }) {
  return {
    match: (url) => url.includes(':append'),
    response: jsonResponse(status, body),
  };
}

function warnLog() {
  return (console.warn.mock.calls || [])
    .map((call) => String(call[0]))
    .join('\n');
}

function hasWarnEvent(event) {
  return warnLog().includes(`"event":"${event}"`);
}

describe('processDlqBatch', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('retries due items and deletes on success', async () => {
    const env = envBase();
    await queued({ kv: env.DLQ_KV });
    const fetchImpl = createMockFetch([
      headerRoute(),
      idsRoute(),
      appendRoute(),
    ]);
    const summary = await processDlqBatch(env, { fetchImpl, getAccessToken, nowMs: 0, limit: 10 });
    expect(summary.succeeded).toBe(1);
    expect((await env.DLQ_KV.list({ prefix: 'dlq:' })).keys.length).toBe(0);
  });

  test('deletes the record without appending when the ID is already in the sheet', async () => {
    const env = envBase();
    await queued({ kv: env.DLQ_KV });
    const fetchImpl = createMockFetch([
      headerRoute(),
      idsRoute([['sub-1']]),
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
      headerRoute(),
      idsRoute(),
      appendRoute(503, { error: 'down' }),
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
      headerRoute(),
      idsRoute(),
      appendRoute(400, { error: 'bad' }),
    ]);
    const summary = await processDlqBatch(env, { fetchImpl, getAccessToken, nowMs: 0, limit: 10 });
    expect(summary.poisoned).toBe(1);
    const listed = await env.DLQ_KV.list({ prefix: 'dlq:' });
    const rec = await env.DLQ_KV.get(listed.keys[0].name, 'json');
    expect(rec.poisoned).toBe(true);
    expect(rec.lastError).toMatch(/^permanent:/);
    expect(hasWarnEvent('dlq_poisoned')).toBe(true);
    expect(warnLog()).not.toContain('a@b.co');
  });

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
    expect(hasWarnEvent('google_auth_permanent')).toBe(true);
    expect(warnLog()).not.toContain('a@b.co');
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
    expect(hasWarnEvent('dlq_oldest_age_exceeded')).toBe(true);
    expect(warnLog()).not.toContain('a@b.co');
  });
});
