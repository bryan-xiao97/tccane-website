/** FNV-1a 32-bit hex prefix — enough to correlate, not reverse email. */
export function emailFingerprint(email) {
  const s = String(email || '').toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function info(msg, fields = {}) {
  console.log(JSON.stringify({ level: 'info', msg, ...fields }));
}

export function warn(msg, fields = {}) {
  console.warn(JSON.stringify({ level: 'warn', msg, ...fields }));
}
