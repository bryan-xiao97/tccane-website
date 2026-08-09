// tests/hygiene.test.js
import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.wrangler' || name === 'references') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function activeFiles() {
  const root = join(process.cwd());
  return walk(root)
    .filter((file) => {
      if (file === join(root, 'README.md')) return true;
      if (!['.js', '.html', '.toml', '.example'].some((ext) => file.endsWith(ext))) return false;
      const relative = file.slice(root.length + 1);
      if (relative.startsWith('functions/')) return true;
      if (relative.startsWith('scripts/')) return true;
      if (relative.startsWith('tests/')) return true;
      return !relative.includes('/');
    })
    .filter((file) => file !== join(root, 'tests', 'hygiene.test.js'));
}

describe('secret hygiene', () => {
  test('repo source does not contain bearer-looking service credentials', () => {
    const root = join(process.cwd());
    const files = walk(root).filter(
      (f) =>
        f.endsWith('.js') ||
        f.endsWith('.md') ||
        f.endsWith('.toml') ||
        f.endsWith('.example'),
    );
    const banned = /Bearer\s+[A-Za-z0-9+/=]{20,}/;
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(banned);
    }
  });

  test('active source contains no service-account integration remnants', () => {
    const banned = [
      /GOOGLE_SERVICE_ACCOUNT/,
      /client_email/,
      /private_key/,
      /auth\/spreadsheets/,
      /emailFingerprint/,
    ];
    for (const file of activeFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of banned) expect(source, `${file}: ${pattern}`).not.toMatch(pattern);
    }
  });

  test('browser assets contain no Google owner secret names', () => {
    const browser = ['index.html', 'app.js', 'interest-form.js']
      .map((file) => readFileSync(join(process.cwd(), file), 'utf8'))
      .join('\n');
    expect(browser).not.toMatch(/GOOGLE_OAUTH_(CLIENT_SECRET|REFRESH_TOKEN)/);
    expect(browser).not.toMatch(/GOOGLE_SPREADSHEET_ID/);
  });
});
