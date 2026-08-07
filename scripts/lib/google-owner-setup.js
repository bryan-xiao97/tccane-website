import { DRIVE_FILE_SCOPE } from '../../functions/lib/google-token.js';
import { SHEET_HEADERS } from '../../functions/lib/sheets.js';

export const OWNER_REDIRECT_URI = 'http://127.0.0.1:53682/oauth2/callback';

export function createOwnerAuthUrl({ client, state }) {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_FILE_SCOPE],
    state,
  });
}

export async function createInterestSpreadsheet({
  fetchImpl, getAccessToken, title = 'TCCANE Interest Submissions',
}) {
  const token = await getAccessToken();
  const response = await fetchImpl('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [{
        properties: {
          title: 'Submissions',
          gridProperties: { rowCount: 1000, columnCount: 5, frozenRowCount: 1 },
        },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{ values: SHEET_HEADERS.map((header) => ({
            userEnteredValue: { stringValue: header },
            userEnteredFormat: { textFormat: { bold: true } },
          })) }],
        }],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Spreadsheet creation failed with HTTP ${response.status}`);
  const data = await response.json();
  return { spreadsheetId: data.spreadsheetId, sheetId: data.sheets[0].properties.sheetId };
}

export async function protectInterestSheet({
  fetchImpl, getAccessToken, spreadsheetId, sheetId,
}) {
  const token = await getAccessToken();
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          addProtectedRange: {
            protectedRange: {
              description: 'Application-managed interest submission columns',
              warningOnly: false,
              range: { sheetId, startColumnIndex: 0, endColumnIndex: 5 },
            },
          },
        }],
      }),
    },
  );
  if (!response.ok) throw new Error(`Spreadsheet protection failed with HTTP ${response.status}`);
}

export async function verifyInterestSpreadsheet({
  fetchImpl, getAccessToken, spreadsheetId,
}) {
  const token = await getAccessToken();
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent("'Submissions'!A1:E1")}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`Spreadsheet verification failed with HTTP ${response.status}`);
  const data = await response.json();
  const row = Array.isArray(data?.values) ? data.values[0] : undefined;
  if (JSON.stringify(row) !== JSON.stringify(SHEET_HEADERS)) {
    throw new Error('Spreadsheet header verification failed');
  }
}

export function mergeDevVars(current, values) {
  const removed = new Set(['GOOGLE_SERVICE_ACCOUNT', ...Object.keys(values)]);
  const retained = current
    .split('\n')
    .filter((line) => {
      const name = line.split('=', 1)[0].trim();
      return !removed.has(name);
    });
  for (const [name, value] of Object.entries(values)) {
    retained.push(`${name}=${JSON.stringify(value)}`);
  }
  return `${retained.join('\n')}\n`;
}
