import { describe, expect, test } from 'vitest';
import {
  appendSubmission,
  newSubmissionId,
  rowForSubmission,
  submissionExists,
  writeSubmission,
} from '../functions/lib/sheets.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

const getAccessToken = async () => 'fake-token';
const submission = {
  submissionId: 'sub-1',
  submittedAtUtc: '2026-08-05T12:00:00.000Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@college.edu',
};

describe('rowForSubmission', () => {
  test('returns five cells in contract order', () => {
    expect(rowForSubmission(submission)).toEqual([
      'sub-1',
      '2026-08-05T12:00:00.000Z',
      'Ada',
      'Lovelace',
      'ada@college.edu',
    ]);
  });
});

describe('newSubmissionId', () => {
  test('returns the injected rng result', () => {
    expect(newSubmissionId(() => 'opaque-id')).toBe('opaque-id');
  });
});

describe('submissionExists', () => {
  test('returns found when the ID column contains the id', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [['sub-1'], ['other']] }),
      },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, found: true });
  });

  test('returns not found when the id is absent', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('/values/Submissions!A:A'),
        response: jsonResponse(200, { values: [['x'], ['y']] }),
      },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, found: false });
  });

  test('treats empty values as not found', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, {}) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, found: false });
  });

  test('treats a 503 read as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(503);
  });

  test('treats a 400 read as permanent', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
  });

  test('treats a network throw as retryable', async () => {
    const fetchImpl = async () => {
      throw new Error('network');
    };
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });

  test('treats a token failure as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, { values: [] }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken: async () => {
        throw new Error('auth down');
      },
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });

  test('treats a 401 token failure as permanent', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, { values: [] }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken: async () => {
        const err = new Error('invalid_grant');
        err.response = { status: 401 };
        throw err;
      },
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
    expect(r.status).toBe(401);
  });

  test('treats a 503 token failure as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, { values: [] }) },
    ]);
    const r = await submissionExists({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:A',
      submissionId: 'sub-1',
      getAccessToken: async () => {
        const err = new Error('server error');
        err.response = { status: 503 };
        throw err;
      },
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(0);
  });
});

describe('appendSubmission', () => {
  test('POSTs a RAW INSERT_ROWS append with bearer token and correct body', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url, init) => url.includes(':append') && init.method === 'POST',
        response: async (_url, init) => {
          expect(init.headers.Authorization).toBe('Bearer fake-token');
          expect(JSON.parse(init.body).values).toEqual([rowForSubmission(submission)]);
          return jsonResponse(200, { updates: { updatedRows: 1 } });
        },
      },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r).toEqual({ ok: true });
    const call = fetchImpl.calls[0];
    expect(call.url).toContain('/spreadsheets/s1/values/Submissions!A:E:append');
    expect(call.url).toContain('valueInputOption=RAW');
    expect(call.url).toContain('insertDataOption=INSERT_ROWS');
  });

  test('treats a 503 append as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(503);
  });

  test('treats a 400 append as permanent', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(400, { error: 'bad' }) },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
  });

  test('treats a network throw as retryable', async () => {
    const fetchImpl = async () => {
      throw new Error('network');
    };
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });

  test('treats a token failure as retryable', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(200, {}) },
    ]);
    const r = await appendSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      range: 'Submissions!A:E',
      row: rowForSubmission(submission),
      getAccessToken: async () => {
        throw new Error('auth down');
      },
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });
});

describe('writeSubmission', () => {
  test('appends when the id is absent', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('!A:A'),
        response: jsonResponse(200, { values: [] }),
      },
      {
        match: (url) => url.includes(':append'),
        response: jsonResponse(200, { updates: { updatedRows: 1 } }),
      },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, duplicate: false });
    expect(fetchImpl.calls.filter((c) => c.url.includes(':append'))).toHaveLength(1);
  });

  test('skips the append when the id is already present', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('!A:A'),
        response: jsonResponse(200, { values: [['sub-1']] }),
      },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r).toEqual({ ok: true, duplicate: true });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  test('propagates a retryable read failure without appending', async () => {
    const fetchImpl = createMockFetch([
      { match: () => true, response: jsonResponse(503, { error: 'down' }) },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(fetchImpl.calls).toHaveLength(1);
  });

  test('propagates a permanent append failure', async () => {
    const fetchImpl = createMockFetch([
      {
        match: (url) => url.includes('!A:A'),
        response: jsonResponse(200, { values: [] }),
      },
      {
        match: (url) => url.includes(':append'),
        response: jsonResponse(400, { error: 'bad' }),
      },
    ]);
    const r = await writeSubmission({
      fetchImpl,
      spreadsheetId: 's1',
      tab: 'Submissions',
      submission,
      getAccessToken,
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
    expect(r.status).toBe(400);
  });
});
