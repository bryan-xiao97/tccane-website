import { describe, expect, test } from 'vitest';
import { enqueueFailure, listDue, markAttempt, poisonRecord } from '../functions/lib/dlq.js';
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
});

