import { listDue, markAttempt, poisonRecord } from '../lib/dlq.js';
import { writeSubmission } from '../lib/sheets.js';
import { createTokenProvider } from '../lib/google-token.js';
import { emailFingerprint, info, warn } from '../lib/log.js';

export async function processDlqBatch(env, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const nowMs = deps.nowMs ?? Date.now();
  const limit = deps.limit ?? 20;
  const getAccessToken = deps.getAccessToken || createTokenProvider(env.GOOGLE_SERVICE_ACCOUNT);
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
    const fp = emailFingerprint(item.payload.email);
    if (result.ok) {
      await markAttempt({
        kv: env.DLQ_KV,
        id: item.id,
        success: true,
        error: '',
        nowMs,
      });
      succeeded += 1;
      info('dlq_retry_ok', { fp });
      continue;
    }
    if (!result.retryable) {
      await poisonRecord({
        kv: env.DLQ_KV,
        id: item.id,
        error: `permanent:${result.error}`,
        nowMs,
      });
      poisoned += 1;
      warn('dlq_poison_permanent', { fp, status: result.status });
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
    if (r.poisoned) poisoned += 1;
    else failed += 1;
  }

  return { processed: due.length, succeeded, failed, poisoned };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processDlqBatch(env, { fetchImpl: fetch }));
  },
};
