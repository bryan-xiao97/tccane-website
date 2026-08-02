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
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...store.keys()]
        .filter((k) => !k.endsWith('__meta') && k.startsWith(prefix))
        .slice(0, limit)
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
    /** test-only */
    _dump() {
      return store;
    },
  };
}
