import { validateInterestBody } from './validate.js';
import { verifyTurnstile } from './turnstile.js';
import { checkRateLimit } from './rate-limit.js';
import { createOrgUser, toVolunteerUserBody } from './volunteer.js';
import { enqueueFailure } from './dlq.js';
import { emailFingerprint, info, warn } from './log.js';

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function clientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

export async function handleInterestPost(request, env, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const nowMs = deps.nowMs ?? Date.now();

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!env.VOLUNTEER_API_TOKEN || !env.VOLUNTEER_ORG_ID) {
    warn('misconfigured', { hasToken: Boolean(env.VOLUNTEER_API_TOKEN) });
    return json(500, { error: 'Server misconfigured' });
  }

  if (!env.RATE_LIMIT_KV || !env.DLQ_KV) {
    warn('misconfigured', { hasRateLimitKv: Boolean(env.RATE_LIMIT_KV), hasDlqKv: Boolean(env.DLQ_KV) });
    return json(500, { error: 'Server misconfigured' });
  }

  if (env.TURNSTILE_SKIP !== 'true' && !env.TURNSTILE_SECRET_KEY) {
    warn('misconfigured', { hasTurnstileSecret: false });
    return json(500, { error: 'Server misconfigured' });
  }

  let raw;
  try {
    raw = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const parsed = validateInterestBody(raw);
  if (!parsed.ok) {
    return json(parsed.status, { error: parsed.error });
  }
  const input = parsed.value;
  const fp = emailFingerprint(input.email);
  const ip = clientIp(request);

  let limit = parseInt(env.RATE_LIMIT_MAX || '5', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 5;
  let windowSeconds = parseInt(env.RATE_LIMIT_WINDOW_SECONDS || '600', 10);
  if (!Number.isFinite(windowSeconds) || windowSeconds < 1) windowSeconds = 600;
  const rl = await checkRateLimit({
    kv: env.RATE_LIMIT_KV,
    ip,
    limit,
    windowSeconds,
    nowMs,
  });
  if (!rl.ok) {
    return json(
      429,
      { error: 'Too many requests' },
      { 'Retry-After': String(rl.retryAfterSeconds) },
    );
  }

  if (env.TURNSTILE_SKIP !== 'true') {
    const ts = await verifyTurnstile({
      token: input.turnstileToken,
      ip,
      secret: env.TURNSTILE_SECRET_KEY,
      fetchImpl,
    });
    if (!ts.ok) {
      return json(403, { error: 'Verification failed' });
    }
  }

  const body = toVolunteerUserBody(input);
  const result = await createOrgUser({
    fetchImpl,
    baseUrl: env.VOLUNTEER_API_BASE || 'https://volunteer.bloomerang.co/api',
    orgId: env.VOLUNTEER_ORG_ID,
    token: env.VOLUNTEER_API_TOKEN,
    body,
  });

  if (result.ok) {
    info('registered', { fp });
    return json(200, { ok: true, status: 'registered' });
  }

  if (result.retryable) {
    try {
      await enqueueFailure({
        kv: env.DLQ_KV,
        payload: input,
        error: result.error,
        nowMs,
      });
    } catch (err) {
      warn('dlq_enqueue_failed', { fp, error: String(err?.message || err) });
      return json(503, { error: 'Registration temporarily unavailable' });
    }
    warn('volunteer_retryable_enqueued', { fp, status: result.status });
    return json(200, { ok: true, status: 'accepted' });
  }

  warn('volunteer_failed', { fp, status: result.status });
  return json(502, { error: 'Registration failed' });
}
