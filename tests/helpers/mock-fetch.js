/**
 * routes: Array<{ match: (url: string, init: RequestInit) => boolean,
 *                 response: Response | ((url, init) => Response | Promise<Response>) }>
 */
export function createMockFetch(routes) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    for (const route of routes) {
      if (route.match(url, init)) {
        const r = typeof route.response === 'function'
          ? await route.response(url, init)
          : route.response;
        return r;
      }
    }
    return new Response(JSON.stringify({ error: `unmocked fetch: ${url}` }), { status: 599 });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
