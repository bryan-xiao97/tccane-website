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

  test('poisons on permanent non-retryable Volunteer failure', async () => {
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
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const summary = await processDlqBatch(env, { fetchImpl, nowMs: 0, limit: 10 });
    expect(summary.poisoned).toBe(1);
    const listed = await DLQ_KV.list({ prefix: 'dlq:' });
    const rec = await DLQ_KV.get(listed.keys[0].name, 'json');
    expect(rec.poisoned).toBe(true);
    expect(rec.lastError).toMatch(/^permanent:/);
  });
});
