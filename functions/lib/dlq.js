const PREFIX = 'dlq:';
const DEFAULT_MAX = 12;

function backoffMs(attempts) {
  return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempts));
}

function newId(nowMs) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${nowMs}-${rand}`;
}

export async function enqueueFailure({ kv, payload, error, nowMs, maxAttempts = DEFAULT_MAX }) {
  const id = newId(nowMs);
  const record = {
    id,
    payload: {
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
  await kv.put(PREFIX + id, JSON.stringify(record));
  return { id };
}

export async function listDue({ kv, nowMs, limit = 20 }) {
  const listed = await kv.list({ prefix: PREFIX, limit: 1000 });
  const out = [];
  for (const { name } of listed.keys) {
    const rec = await kv.get(name, 'json');
    if (!rec || rec.poisoned) continue;
    if (rec.nextAttemptAt <= nowMs) out.push(rec);
    if (out.length >= limit) break;
  }
  return out;
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
    await kv.put(key, JSON.stringify(rec));
    return { done: false, poisoned: true };
  }
  rec.nextAttemptAt = nowMs + backoffMs(rec.attempts);
  await kv.put(key, JSON.stringify(rec));
  return { done: false, poisoned: false };
}

export async function poisonRecord({ kv, id, error, nowMs }) {
  const key = PREFIX + id;
  const rec = await kv.get(key, 'json');
  if (!rec) return;
  rec.poisoned = true;
  rec.lastError = String(error || '').slice(0, 300);
  rec.nextAttemptAt = nowMs + 86_400_000;
  await kv.put(key, JSON.stringify(rec));
}
