export function newSubmissionId(rng = () => crypto.randomUUID()) {
  return rng();
}

export function rowForSubmission(s) {
  return [s.submissionId, s.submittedAtUtc, s.firstName, s.lastName, s.email];
}

function apiUrl(spreadsheetId, range, suffix = '') {
  const root = 'https://sheets.googleapis.com/v4/spreadsheets';
  return `${root}/${encodeURIComponent(spreadsheetId)}/values/${range}${suffix}`;
}

async function classify(res, label) {
  const status = res.status;
  const retryable = status >= 500 || status === 429;
  let error = `Sheets ${label} HTTP ${status}`;
  try {
    const text = await res.text();
    if (text) error = text.slice(0, 200);
  } catch {
    /* ignore */
  }
  return { ok: false, retryable, status, error };
}

async function getBearerToken(getAccessToken) {
  let token;
  try {
    token = await getAccessToken();
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Google token error' };
  }
  return { ok: true, token };
}

export async function submissionExists({ fetchImpl, spreadsheetId, range, submissionId, getAccessToken }) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;

  let res;
  try {
    res = await fetchImpl(apiUrl(spreadsheetId, range), {
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    });
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Sheets network error' };
  }
  if (!res.ok) return classify(res, 'read');

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Sheets invalid JSON' };
  }
  const values = Array.isArray(data?.values) ? data.values : [];
  return { ok: true, found: values.some((row) => row && row[0] === submissionId) };
}

export async function appendSubmission({ fetchImpl, spreadsheetId, range, row, getAccessToken }) {
  const auth = await getBearerToken(getAccessToken);
  if (!auth.ok) return auth;

  const url = `${apiUrl(spreadsheetId, range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Sheets network error' };
  }
  if (res.ok) return { ok: true };
  return classify(res, 'append');
}

export async function writeSubmission({ fetchImpl, spreadsheetId, tab, submission, getAccessToken }) {
  const check = await submissionExists({
    fetchImpl,
    spreadsheetId,
    range: `${tab}!A:A`,
    submissionId: submission.submissionId,
    getAccessToken,
  });
  if (!check.ok) return check;
  if (check.found) return { ok: true, duplicate: true };

  const appended = await appendSubmission({
    fetchImpl,
    spreadsheetId,
    range: `${tab}!A:E`,
    row: rowForSubmission(submission),
    getAccessToken,
  });
  if (!appended.ok) return appended;
  return { ok: true, duplicate: false };
}
