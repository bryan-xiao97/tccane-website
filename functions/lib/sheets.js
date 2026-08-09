import { GoogleAuthError } from './google-token.js';
import { fetchWithTimeout } from './http.js';

export function newSubmissionId(rng = () => crypto.randomUUID()) {
  return rng();
}

export const SHEET_HEADERS = ['submissionId', 'submittedAtUtc', 'firstName', 'lastName', 'email'];
const RETRYABLE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'backendError']);

export function rowForSubmission(s) {
  return [s.submissionId, s.submittedAtUtc, s.firstName, s.lastName, s.email];
}

function a1(tab, cells) {
  const quoted = String(tab).replaceAll("'", "''");
  return `'${quoted}'!${cells}`;
}

function apiUrl(spreadsheetId, range, suffix = '') {
  const root = 'https://sheets.googleapis.com/v4/spreadsheets';
  return `${root}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${suffix}`;
}

async function classifyResponse(response, label) {
  let body = {};
  try { body = await response.json(); } catch { /* status remains authoritative */ }
  const reason = body?.error?.errors?.find((item) => typeof item?.reason === 'string')?.reason;
  const code = reason || `sheets_http_${response.status}`;
  const retryable = RETRYABLE_REASONS.has(code)
    || response.status === 408
    || response.status === 429
    || response.status >= 500;
  return { ok: false, retryable, status: response.status, code, error: `Sheets ${label} failed` };
}

async function getBearerToken(getAccessToken) {
  try {
    return { ok: true, token: await getAccessToken() };
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return {
        ok: false,
        retryable: error.retryable,
        status: error.status,
        code: error.code,
        error: 'Google authorization failed',
      };
    }
    return { ok: false, retryable: true, status: 0, code: 'token_network_error', error: 'Google authorization failed' };
  }
}

export async function submissionExists({ fetchImpl, spreadsheetId, range, submissionId, getAccessToken, timeoutMs = 8_000 }) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;

  let res;
  try {
    res = await fetchWithTimeout(fetchImpl, apiUrl(spreadsheetId, range), {
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    }, timeoutMs);
  } catch {
    return { ok: false, retryable: true, status: 0, code: 'sheets_network_error', error: 'Sheets request failed' };
  }
  if (!res.ok) return classifyResponse(res, 'read');

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, retryable: true, status: 0, code: 'sheets_invalid_json', error: 'Sheets request failed' };
  }
  const values = Array.isArray(data?.values) ? data.values : [];
  return { ok: true, found: values.some((row) => row && row[0] === submissionId) };
}

export async function appendSubmission({ fetchImpl, spreadsheetId, range, row, getAccessToken, timeoutMs = 8_000 }) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;

  const url = `${apiUrl(spreadsheetId, range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  let res;
  try {
    res = await fetchWithTimeout(fetchImpl, url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }, timeoutMs);
  } catch {
    return { ok: false, retryable: true, status: 0, code: 'sheets_network_error', error: 'Sheets request failed' };
  }
  if (res.ok) return { ok: true };
  return classifyResponse(res, 'append');
}

export async function verifySheetContract({
  fetchImpl, spreadsheetId, tab, getAccessToken, timeoutMs = 8_000,
}) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;
  let response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      apiUrl(spreadsheetId, a1(tab, 'A1:E1')),
      { headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' } },
      timeoutMs,
    );
  } catch {
    return { ok: false, retryable: true, status: 0, code: 'sheets_network_error', error: 'Sheets request failed' };
  }
  if (!response.ok) return classifyResponse(response, 'contract check');
  const data = await response.json().catch(() => null);
  if (JSON.stringify(data?.values?.[0]) !== JSON.stringify(SHEET_HEADERS)) {
    return { ok: false, retryable: false, status: 409, code: 'sheet_contract_invalid', error: 'Sheet contract invalid' };
  }
  return { ok: true };
}

export async function writeSubmission({
  fetchImpl, spreadsheetId, tab, submission, getAccessToken, timeoutMs = 8_000,
}) {
  const contract = await verifySheetContract({
    fetchImpl, spreadsheetId, tab, getAccessToken, timeoutMs,
  });
  if (!contract.ok) return contract;
  const check = await submissionExists({
    fetchImpl,
    spreadsheetId,
    range: a1(tab, 'A:A'),
    submissionId: submission.submissionId,
    getAccessToken,
    timeoutMs,
  });
  if (!check.ok) return check;
  if (check.found) return { ok: true, duplicate: true };
  const appended = await appendSubmission({
    fetchImpl,
    spreadsheetId,
    range: a1(tab, 'A:E'),
    row: rowForSubmission(submission),
    getAccessToken,
    timeoutMs,
  });
  if (!appended.ok) return appended;
  return { ok: true, duplicate: false };
}
