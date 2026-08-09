import { fetchWithTimeout } from './http.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile({ token, ip, secret, fetchImpl, timeoutMs = 8_000 }) {
  if (!token || !secret) {
    return { ok: false, error: 'Missing turnstile token or secret' };
  }
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  let res;
  try {
    res = await fetchWithTimeout(fetchImpl, SITEVERIFY, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    }, timeoutMs);
  } catch (err) {
    return { ok: false, error: 'Turnstile request failed' };
  }

  if (!res.ok) {
    return { ok: false, error: `Turnstile HTTP ${res.status}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: 'Turnstile invalid JSON' };
  }

  if (data && data.success === true) {
    return { ok: true };
  }
  return { ok: false, error: 'Turnstile verification failed' };
}
