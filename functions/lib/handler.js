import { validateInterestBody } from './validate.js';
import { verifyTurnstile } from './turnstile.js';
import { checkRateLimit } from './rate-limit.js';
import { newSubmissionId, writeSubmission } from './sheets.js';
import { oauthConfigFromEnv, createTokenProvider, PERMANENT_CODES as PERMANENT_AUTH_CODES } from './google-token.js';
import { enqueueFailure } from './dlq.js';
import { info, warn } from './log.js';

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function permanentFailureEvent(code) {
  if (code === 'sheet_contract_invalid') return 'sheet_contract_invalid';
  if (PERMANENT_AUTH_CODES.has(code)) return 'google_auth_permanent';
  return 'submission_permanent_failure';
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

  const oauth = oauthConfigFromEnv(env);
  if (!oauth.ok || !env.GOOGLE_SPREADSHEET_ID) {
    warn('misconfigured', { missing: oauth.ok ? ['GOOGLE_SPREADSHEET_ID'] : oauth.missing });
    return json(500, { error: 'Server misconfigured' });
  }
  const getAccessToken = deps.getAccessToken || createTokenProvider(oauth.value);

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
    timeoutMs: deps.googleTimeoutMs ?? 8_000,
  });

  if (result.ok) {
    info('recorded', { submissionId: submission.submissionId });
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
      warn('dlq_enqueue_failed', { submissionId: submission.submissionId, error: String(err?.message || err) });
      return json(503, { error: 'Submission temporarily unavailable' });
    }
    warn('sheets_retryable_enqueued', { submissionId: submission.submissionId });
    return json(200, { ok: true, status: 'accepted' });
  }

  warn(permanentFailureEvent(result.code), { submissionId: submission.submissionId, code: result.code });
  return json(502, { error: 'Submission failed' });
}
