const PREFIX = 'dlq:';
const DEFAULT_MAX = 12;
const RECORD_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_RETRY_AGE_MS = 24 * 60 * 60 * 1000;

function backoffMs(attempts) {
  return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempts));
}

function newId(nowMs) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${nowMs}-${rand}`;
}

async function scanRecords(kv, visit) {
  let cursor;
  do {
    const page = await kv.list({ prefix: PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const { name } of page.keys) {
      const record = await kv.get(name, 'json');
      if (record) await visit(record);
    }
    cursor = page.list_complete ? '' : page.cursor;
  } while (cursor);
}

export async function enqueueFailure({ kv, payload, error, nowMs, maxAttempts = DEFAULT_MAX }) {
  const id = newId(nowMs);
  const record = {
    id,
    payload: {
      submissionId: payload.submissionId,
      submittedAtUtc: payload.submittedAtUtc,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    },
    attempts: 0,
    maxAttempts,
    createdAt: nowMs,
    nextAttemptAt: nowMs,
    lastError: String(error || '').slice(0, 300),
    poisoned: false,
  };
  await kv.put(PREFIX + id, JSON.stringify(record), { expirationTtl: RECORD_TTL_SECONDS });
  return { id };
}

export async function listDue({ kv, nowMs, limit = 20 }) {
  const due = [];
  await scanRecords(kv, async (rec) => {
    if (nowMs - rec.createdAt > MAX_RETRY_AGE_MS) {
      rec.poisoned = true;
      rec.nextAttemptAt = nowMs + 86_400_000;
      await kv.put(PREFIX + rec.id, JSON.stringify(rec), { expirationTtl: RECORD_TTL_SECONDS });
      return;
    }
    if (rec.poisoned) return;
    if (rec.nextAttemptAt <= nowMs) due.push(rec);
  });
  due.sort((a, b) => (
    a.nextAttemptAt - b.nextAttemptAt
    || a.createdAt - b.createdAt
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  ));
  return due.slice(0, limit);
}

export async function queueHealth({ kv, nowMs }) {
  let queued = 0;
  let poisoned = 0;
  let oldestAgeMs = 0;
  await scanRecords(kv, (rec) => {
    if (rec.poisoned) poisoned += 1;
    else queued += 1;
    const age = nowMs - rec.createdAt;
    if (age > oldestAgeMs) oldestAgeMs = age;
  });
  return { queued, poisoned, oldestAgeMs };
}

export async function markAttempt({ kv, id, success, error, nowMs, maxAttempts = DEFAULT_MAX }) {
  const key = PREFIX + id;
  const rec = await kv.get(key, 'json');
  if (!rec) return { done: true, poisoned: false };

  if (success) {
    await kv.delete(key);
    return { done: true, poisoned: false };
  }

  rec.attempts = (rec.attempts || 0) + 1;
  rec.lastError = String(error || '').slice(0, 300);
  rec.maxAttempts = maxAttempts;
  if (rec.attempts >= maxAttempts) {
    rec.poisoned = true;
    rec.nextAttemptAt = nowMs + 86_400_000;
    await kv.put(key, JSON.stringify(rec), { expirationTtl: RECORD_TTL_SECONDS });
    return { done: false, poisoned: true };
  }
  rec.nextAttemptAt = nowMs + backoffMs(rec.attempts);
  await kv.put(key, JSON.stringify(rec), { expirationTtl: RECORD_TTL_SECONDS });
  return { done: false, poisoned: false };
}

export async function poisonRecord({ kv, id, error, nowMs }) {
  const key = PREFIX + id;
  const rec = await kv.get(key, 'json');
  if (!rec) return;
  rec.poisoned = true;
  rec.lastError = String(error || '').slice(0, 300);
  rec.nextAttemptAt = nowMs + 86_400_000;
  await kv.put(key, JSON.stringify(rec), { expirationTtl: RECORD_TTL_SECONDS });
}
