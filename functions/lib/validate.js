const ALLOWED = new Set(['firstName', 'lastName', 'email', 'turnstileToken', 'company']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_TOKEN = 4096;

export function validateInterestBody(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Body must be a JSON object' };
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED.has(key)) {
      return { ok: false, status: 400, error: `Unknown field: ${key}` };
    }
  }

  if ('company' in raw) {
    if (typeof raw.company !== 'string' || raw.company.trim() !== '') {
      return { ok: false, status: 400, error: 'Rejected' };
    }
  }

  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
  const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
  const emailRaw = typeof raw.email === 'string' ? raw.email.trim() : '';
  const turnstileToken =
    typeof raw.turnstileToken === 'string' ? raw.turnstileToken.trim() : '';

  if (!firstName || !lastName || !emailRaw || !turnstileToken) {
    return { ok: false, status: 400, error: 'firstName, lastName, email, and turnstileToken are required' };
  }
  if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
    return { ok: false, status: 400, error: 'Name too long' };
  }
  if (emailRaw.length > MAX_EMAIL || !EMAIL_RE.test(emailRaw)) {
    return { ok: false, status: 400, error: 'Invalid email' };
  }
  if (turnstileToken.length > MAX_TOKEN) {
    return { ok: false, status: 400, error: 'Invalid turnstileToken' };
  }

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      email: emailRaw.toLowerCase(),
      turnstileToken,
    },
  };
}
