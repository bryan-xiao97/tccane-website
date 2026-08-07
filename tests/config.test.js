import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { onRequestGet } from '../functions/api/config.js';

describe('GET /api/config', () => {
  test('returns only the public Turnstile site key', async () => {
    const response = await onRequestGet({ env: {
      TURNSTILE_SITE_KEY: 'site-key',
      TURNSTILE_SECRET_KEY: 'must-not-leak',
      GOOGLE_OAUTH_REFRESH_TOKEN: 'must-not-leak',
    } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ turnstileSiteKey: 'site-key' });
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });

  test('fails closed when site key is missing', async () => {
    const response = await onRequestGet({ env: {} });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server misconfigured' });
  });
});

test('index contains the complete interest form contract', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const value of ['interest-form', 'interest-first-name', 'interest-last-name', 'interest-email', 'interest-company', 'interest-turnstile', 'interest-success']) {
    expect(html).toContain(`id="${value}"`);
  }
  expect(html).toContain('type="module" src="app.js"');
});
