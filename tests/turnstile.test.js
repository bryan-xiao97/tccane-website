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

  test('fails closed when Siteverify times out', async () => {
    const fetchImpl = (_url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    const result = await verifyTurnstile({
      token: 'tok', ip: '1.2.3.4', secret: 'sec', fetchImpl, timeoutMs: 5,
    });
    expect(result).toEqual({ ok: false, error: 'Turnstile request failed' });
  });
});
