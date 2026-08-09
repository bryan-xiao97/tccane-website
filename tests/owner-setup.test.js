import { describe, expect, test, vi } from 'vitest';
import {
  OWNER_REDIRECT_URI,
  createInterestSpreadsheet,
  createOwnerAuthUrl,
  mergeDevVars,
  protectInterestSheet,
  verifyInterestSpreadsheet,
} from '../scripts/lib/google-owner-setup.js';
import { SHEET_HEADERS } from '../functions/lib/sheets.js';
import { createMockFetch, jsonResponse } from './helpers/mock-fetch.js';

describe('createOwnerAuthUrl', () => {
  test('requests offline drive.file access with state and explicit consent', () => {
    const client = { generateAuthUrl: vi.fn(() => 'https://accounts.example/auth') };
    expect(createOwnerAuthUrl({ client, state: 'state-123' })).toBe('https://accounts.example/auth');
    expect(client.generateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      state: 'state-123',
    });
    expect(OWNER_REDIRECT_URI).toBe('http://127.0.0.1:53682/oauth2/callback');
  });
});

describe('spreadsheet provisioning', () => {
  test('creates the fixed title, tab, frozen header and five columns', async () => {
    const fetchImpl = createMockFetch([{
      match: (url, init) => url.endsWith('/v4/spreadsheets') && init.method === 'POST',
      response: async (_url, init) => {
        const body = JSON.parse(init.body);
        expect(body.properties.title).toBe('TCCANE Interest Submissions');
        expect(body.sheets[0].properties).toEqual(expect.objectContaining({
          title: 'Submissions',
          gridProperties: expect.objectContaining({ columnCount: 5, frozenRowCount: 1 }),
        }));
        expect(body.sheets[0].data[0].rowData[0].values.map(
          (cell) => cell.userEnteredValue.stringValue,
        )).toEqual(SHEET_HEADERS);
        return jsonResponse(200, {
          spreadsheetId: 'sheet-1', sheets: [{ properties: { sheetId: 42 } }],
        });
      },
    }]);
    await expect(createInterestSpreadsheet({
      fetchImpl,
      getAccessToken: async () => 'token',
      title: 'TCCANE Interest Submissions',
    })).resolves.toEqual({ spreadsheetId: 'sheet-1', sheetId: 42 });
  });

  test('protects the raw A:E integration range', async () => {
    const fetchImpl = createMockFetch([{
      match: (url) => url.endsWith('/sheet-1:batchUpdate'),
      response: async (_url, init) => {
        expect(JSON.parse(init.body)).toEqual({ requests: [{ addProtectedRange: {
          protectedRange: {
            description: 'Application-managed interest submission columns',
            warningOnly: false,
            range: { sheetId: 42, startColumnIndex: 0, endColumnIndex: 5 },
          },
        } }] });
        return jsonResponse(200, {});
      },
    }]);
    await expect(protectInterestSheet({
      fetchImpl,
      getAccessToken: async () => 'token',
      spreadsheetId: 'sheet-1',
      sheetId: 42,
    })).resolves.toBeUndefined();
  });

  test('verifies the exact header row', async () => {
    const fetchImpl = createMockFetch([{
      match: (url) => decodeURIComponent(url).includes("'Submissions'!A1:E1"),
      response: jsonResponse(200, { values: [SHEET_HEADERS] }),
    }]);
    await expect(verifyInterestSpreadsheet({
      fetchImpl,
      getAccessToken: async () => 'token',
      spreadsheetId: 'sheet-1',
    })).resolves.toBeUndefined();
  });
});

describe('mergeDevVars', () => {
  test('preserves unrelated values and replaces every Google owner value', () => {
    const obsolete = ['GOOGLE', 'SERVICE_ACCOUNT'].join('_');
    const merged = mergeDevVars(
      `TURNSTILE_SKIP=true\nUNRELATED_KEY=value\n${obsolete}=old\n`,
      {
        GOOGLE_OAUTH_CLIENT_ID: 'client-id',
        GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
        GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh-token',
        GOOGLE_SPREADSHEET_ID: 'sheet-1',
        GOOGLE_SHEET_TAB: 'Submissions',
      },
    );
    expect(merged).toContain('TURNSTILE_SKIP=true');
    expect(merged).toContain('UNRELATED_KEY=value');
    expect(merged).not.toContain(obsolete);
    expect(merged).toContain('GOOGLE_OAUTH_REFRESH_TOKEN="refresh-token"');
  });
});
