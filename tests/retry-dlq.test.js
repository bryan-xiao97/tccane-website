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
