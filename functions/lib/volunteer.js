export function toVolunteerUserBody(input) {
  return {
    username: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  };
}

export async function createOrgUser({ fetchImpl, baseUrl, orgId, token, body }) {
  const root = baseUrl.replace(/\/$/, '');
  const url = `${root}/v4/organizations/${encodeURIComponent(orgId)}/users`;

  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, retryable: true, status: 0, error: 'Volunteer network error' };
  }

  if (res.ok) {
    let users;
    try {
      users = await res.json();
    } catch {
      users = [];
    }
    return { ok: true, users: Array.isArray(users) ? users : [users] };
  }

  const status = res.status;
  const retryable = status >= 500 || status === 429;
  let error = `Volunteer HTTP ${status}`;
  try {
    const text = await res.text();
    if (text) error = text.slice(0, 200);
  } catch {
    /* ignore */
  }
  return { ok: false, retryable, status, error };
}
