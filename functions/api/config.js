function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export async function onRequestGet({ env }) {
  if (typeof env.TURNSTILE_SITE_KEY !== 'string' || !env.TURNSTILE_SITE_KEY.trim()) {
    return json(500, { error: 'Server misconfigured' });
  }
  return json(200, { turnstileSiteKey: env.TURNSTILE_SITE_KEY.trim() }, {
    'cache-control': 'public, max-age=300',
  });
}
