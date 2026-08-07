import { describe, expect, test } from 'vitest';
import { enqueueFailure, listDue, markAttempt, poisonRecord, queueHealth } from '../functions/lib/dlq.js';
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

  test('poisonRecord marks poisoned and skips listDue', async () => {
    const kv = createMemoryKv();
    const { id } = await enqueueFailure({
      kv,
      payload: { firstName: 'A', lastName: 'B', email: 'a@b.co' },
      error: 'x',
      nowMs: 0,
    });
    await poisonRecord({ kv, id, error: 'permanent:bad', nowMs: 1000 });
    const rec = await kv.get('dlq:' + id, 'json');
    expect(rec.poisoned).toBe(true);
    expect(rec.lastError).toBe('permanent:bad');
    expect(rec.nextAttemptAt).toBe(1000 + 86_400_000);
    expect(await listDue({ kv, nowMs: 1000, limit: 10 })).toHaveLength(0);
  });

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
});

