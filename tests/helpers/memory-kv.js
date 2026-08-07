/** Minimal KVNamespace stand-in for unit tests. */
export function createMemoryKv() {
  const store = new Map();

  return {
    async get(key, type = 'text') {
      const raw = store.get(key);
      if (raw === undefined) return null;
      if (type === 'json') return JSON.parse(raw);
      return raw;
    },
    async put(key, value, options = {}) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      if (options.expirationTtl) {
        // TTL ignored in unit tests unless a test asserts presence; keep metadata optional
        store.set(`${key}__meta`, JSON.stringify({ expirationTtl: options.expirationTtl }));
      }
    },
    async delete(key) {
      store.delete(key);
      store.delete(`${key}__meta`);
    },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const names = [...store.keys()]
        .filter((key) => !key.endsWith('__meta') && key.startsWith(prefix))
        .sort();
      const start = cursor ? Number(cursor) : 0;
      const page = names.slice(start, start + limit);
      const next = start + page.length;
      return {
        keys: page.map((name) => ({ name })),
        list_complete: next >= names.length,
        cursor: next >= names.length ? '' : String(next),
        cacheStatus: null,
      };
    },
    /** test-only */
    _expirationTtl(key) {
      const meta = store.get(`${key}__meta`);
      return meta ? JSON.parse(meta).expirationTtl : null;
    },
    /** test-only */
    _dump() {
      return store;
    },
  };
}
