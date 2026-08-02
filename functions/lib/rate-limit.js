function bucketKey(ip, windowStart) {
  return `rl:${ip}:${windowStart}`;
}

export async function checkRateLimit({ kv, ip, limit, windowSeconds, nowMs }) {
  const safeIp = ip && String(ip).trim() ? String(ip).trim() : 'unknown';
  const windowStart = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
  const key = bucketKey(safeIp, windowStart);
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;

  if (count >= limit) {
    const windowEndMs = (windowStart + windowSeconds) * 1000;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  const next = count + 1;
  await kv.put(key, String(next), { expirationTtl: windowSeconds + 60 });
  return { ok: true, remaining: Math.max(0, limit - next) };
}
