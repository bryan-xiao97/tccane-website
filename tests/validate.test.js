// tests/validate.test.js
import { describe, expect, test } from 'vitest';
import { validateInterestBody } from '../functions/lib/validate.js';

describe('validateInterestBody', () => {
  test('accepts a minimal valid body', () => {
    const r = validateInterestBody({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@college.edu',
      turnstileToken: 'tok_abc',
    });
    expect(r).toEqual({
      ok: true,
      value: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@college.edu',
        turnstileToken: 'tok_abc',
      },
    });
  });

  test('trims whitespace on names and lowercases email', () => {
    const r = validateInterestBody({
      firstName: '  Ada  ',
      lastName: '  Lovelace ',
      email: '  Ada@College.EDU ',
      turnstileToken: 'tok',
    });
    expect(r.ok).toBe(true);
    expect(r.value.email).toBe('ada@college.edu');
    expect(r.value.firstName).toBe('Ada');
  });

  test('rejects missing fields', () => {
    const r = validateInterestBody({ firstName: 'A', email: 'a@b.co', turnstileToken: 't' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('rejects invalid email', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'not-an-email',
      turnstileToken: 't',
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('rejects unknown keys', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      turnstileToken: 't',
      extra: 'nope',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown/i);
  });

  test('rejects filled honeypot company', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      turnstileToken: 't',
      company: 'bot-co',
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('rejects non-string honeypot company', () => {
    const base = {
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      turnstileToken: 't',
    };
    expect(validateInterestBody({ ...base, company: 1 }).ok).toBe(false);
    expect(validateInterestBody({ ...base, company: true }).ok).toBe(false);
    expect(validateInterestBody({ ...base, company: 1 }).status).toBe(400);
    expect(validateInterestBody({ ...base, company: true }).error).toBe('Rejected');
  });

  test('allows empty string honeypot company', () => {
    const r = validateInterestBody({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      turnstileToken: 't',
      company: '',
    });
    expect(r.ok).toBe(true);
    expect(r.value).not.toHaveProperty('company');
  });

  test('rejects empty names and overlong fields', () => {
    expect(
      validateInterestBody({
        firstName: '',
        lastName: 'B',
        email: 'a@b.co',
        turnstileToken: 't',
      }).ok,
    ).toBe(false);
    expect(
      validateInterestBody({
        firstName: 'A'.repeat(101),
        lastName: 'B',
        email: 'a@b.co',
        turnstileToken: 't',
      }).ok,
    ).toBe(false);
  });

  test('rejects non-object body', () => {
    expect(validateInterestBody(null).ok).toBe(false);
    expect(validateInterestBody('x').ok).toBe(false);
  });
});
