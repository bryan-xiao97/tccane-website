// tests/hygiene.test.js
import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.wrangler') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe('secret hygiene', () => {
  test('repo source does not contain bearer-looking volunteer tokens', () => {
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
      if (f.includes(`${join('references', 'plans')}`)) continue;
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(banned);
    }
  });
});
