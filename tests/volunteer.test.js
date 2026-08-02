import { describe, expect, test } from 'vitest';
import { createOrgUser, toVolunteerUserBody } from '../functions/lib/volunteer.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

describe('toVolunteerUserBody', () => {
  test('maps email to username', () => {
    expect(
      toVolunteerUserBody({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@college.edu',
      }),
    ).toEqual({
      username: 'ada@college.edu',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });
});

describe('createOrgUser', () => {
  const base = {
    baseUrl: 'https://volunteer.bloomerang.co/api',
    orgId: '42',
    token: 'secret-token',
    body: { username: 'a@b.co', firstName: 'A', lastName: 'B' },
  };

  test('POSTs to org users and returns users on 200', async () => {
    const users = [{ id: 1, username: 'a@b.co' }];
    const fetchImpl = createMockFetch([
      {
        match: (url, init) =>
          url === 'https://volunteer.bloomerang.co/api/v4/organizations/42/users' &&
          init.method === 'POST',
        response: async (_url, init) => {
          expect(init.headers.Authorization).toBe('Bearer secret-token');
          expect(JSON.parse(init.body)).toEqual(base.body);
          return jsonResponse(200, users);
        },
      },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r).toEqual({ ok: true, users });
  });

  test('marks 5xx as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(503);
  });

  test('marks network throw as retryable', async () => {
    const fetchImpl = async () => {
      throw new Error('network');
    };
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });

  test('marks 4xx as not retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
    expect(r.status).toBe(400);
  });

  test('marks 401 as not retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(401, {}) },
    ]);
    const r = await createOrgUser({ ...base, fetchImpl });
    expect(r.retryable).toBe(false);
  });
});
