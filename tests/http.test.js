import { describe, expect, test, vi } from 'vitest';
import { TimeoutError, fetchWithTimeout, withTimeout } from '../functions/lib/http.js';

describe('withTimeout', () => {
  test('returns a settled value', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 10, 'token')).resolves.toBe('ok');
  });

  test('rejects with a typed timeout', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 25, 'token');
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).rejects.toEqual(expect.objectContaining({
      name: 'TimeoutError',
      message: 'token timed out after 25ms',
    }));
    vi.useRealTimers();
  });
});

describe('fetchWithTimeout', () => {
  test('passes an AbortSignal to fetch', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response('ok');
    });
    expect((await fetchWithTimeout(fetchImpl, 'https://example.test', {}, 50)).status).toBe(200);
  });
});
