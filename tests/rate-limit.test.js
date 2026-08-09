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
