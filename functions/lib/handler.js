import { validateInterestBody } from './validate.js';
import { verifyTurnstile } from './turnstile.js';
import { checkRateLimit } from './rate-limit.js';
import { newSubmissionId, writeSubmission } from './sheets.js';
import { createTokenProvider } from './google-token.js';
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
  const getAccessToken =
    deps.getAccessToken || createTokenProvider(env.GOOGLE_SERVICE_ACCOUNT);

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT || !env.GOOGLE_SPREADSHEET_ID) {
    warn('misconfigured', { hasServiceAccount: Boolean(env.GOOGLE_SERVICE_ACCOUNT) });
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

  const submission = {
    submissionId: newSubmissionId(deps.rng),
    submittedAtUtc: new Date(nowMs).toISOString(),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  };

  const result = await writeSubmission({
    fetchImpl,
    spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
    tab: env.GOOGLE_SHEET_TAB || 'Submissions',
    submission,
    getAccessToken,
  });

  if (result.ok) {
    info('recorded', { fp, submissionId: submission.submissionId });
    return json(200, { ok: true, status: 'recorded' });
  }

  if (result.retryable) {
    try {
      await enqueueFailure({
        kv: env.DLQ_KV,
        payload: submission,
        error: result.error,
        nowMs,
      });
    } catch (err) {
      warn('dlq_enqueue_failed', { fp, error: String(err?.message || err) });
      return json(503, { error: 'Registration temporarily unavailable' });
    }
    warn('sheets_retryable_enqueued', { fp, submissionId: submission.submissionId });
    return json(200, { ok: true, status: 'accepted' });
  }

  warn('sheets_failed', { fp, submissionId: submission.submissionId });
  return json(502, { error: 'Registration failed' });
}
