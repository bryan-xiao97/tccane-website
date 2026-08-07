import { listDue, markAttempt, poisonRecord, queueHealth } from '../lib/dlq.js';
import { writeSubmission } from '../lib/sheets.js';
import { createTokenProvider, oauthConfigFromEnv } from '../lib/google-token.js';
import { info, warn } from '../lib/log.js';

const OLDEST_AGE_THRESHOLD_MS = 15 * 60 * 1000;
const PERMANENT_AUTH_CODES = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client']);

export async function processDlqBatch(env, deps = {}) {
  const oauth = oauthConfigFromEnv(env);
  if (!oauth.ok || !env.GOOGLE_SPREADSHEET_ID || !env.DLQ_KV) {
    warn('retry_worker_misconfigured', {
      missing: oauth.ok ? ['GOOGLE_SPREADSHEET_ID or DLQ_KV'] : oauth.missing,
    });
    return { processed: 0, succeeded: 0, failed: 0, poisoned: 0, queued: 0, oldestAgeMs: 0 };
  }
  const fetchImpl = deps.fetchImpl || fetch;
  const nowMs = deps.nowMs ?? Date.now();
  const limit = deps.limit ?? 20;
  const getAccessToken = deps.getAccessToken || createTokenProvider(oauth.value);
  const due = await listDue({ kv: env.DLQ_KV, nowMs, limit });
  let succeeded = 0;
  let failed = 0;
  let poisoned = 0;

  for (const item of due) {
    const result = await writeSubmission({
      fetchImpl,
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      tab: env.GOOGLE_SHEET_TAB || 'Submissions',
      submission: item.payload,
      getAccessToken,
    });
    const submissionId = item.payload.submissionId;
    if (result.ok) {
      await markAttempt({
        kv: env.DLQ_KV,
        id: item.id,
        success: true,
        error: '',
        nowMs,
      });
      succeeded += 1;
      info('dlq_retry_ok', { submissionId });
      continue;
    }
    if (!result.retryable) {
      await poisonRecord({
        kv: env.DLQ_KV,
        id: item.id,
        error: `permanent:${result.code}`,
        nowMs,
      });
      poisoned += 1;
      if (PERMANENT_AUTH_CODES.has(result.code)) {
        warn('google_auth_permanent', { submissionId, code: result.code });
      } else if (result.code === 'sheet_contract_invalid') {
        warn('sheet_contract_invalid', { submissionId, code: result.code });
      }
      warn('dlq_poisoned', { submissionId });
      continue;
    }
    const r = await markAttempt({
      kv: env.DLQ_KV,
      id: item.id,
      success: false,
      error: result.error,
      nowMs,
      maxAttempts: item.maxAttempts || 12,
    });
    if (r.poisoned) {
      poisoned += 1;
      warn('dlq_poisoned', { submissionId });
    } else {
      failed += 1;
    }
  }

  const health = await queueHealth({ kv: env.DLQ_KV, nowMs });
  if (health.oldestAgeMs > OLDEST_AGE_THRESHOLD_MS) {
    warn('dlq_oldest_age_exceeded', { oldestAgeMs: health.oldestAgeMs });
  }

  return {
    processed: due.length,
    succeeded,
    failed,
    poisoned,
    queued: health.queued,
    oldestAgeMs: health.oldestAgeMs,
  };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processDlqBatch(env, { fetchImpl: fetch }));
  },
};
