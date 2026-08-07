function defaultLoadTurnstile(documentRef) {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  return new Promise((resolve, reject) => {
    const existing = documentRef.querySelector('script[data-interest-turnstile]');
    const script = existing || documentRef.createElement('script');
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.interestTurnstile = '';
      documentRef.head.append(script);
    }
    script.addEventListener('load', () => resolve(globalThis.turnstile), { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true });
  });
}

const ERROR_COPY = {
  400: 'Please check your information and try again.',
  403: 'Verification expired. Please complete it again.',
  429: 'Too many attempts. Please wait a few minutes and try again.',
  default: 'We could not send your information. Please try again or email an advisor.',
};

export async function initInterestForm({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  turnstileApi,
  loadTurnstile = defaultLoadTurnstile,
} = {}) {
  const form = documentRef?.getElementById('interest-form');
  if (!form) return null;
  const status = documentRef.getElementById('interest-form-status');
  const submit = documentRef.getElementById('interest-submit');
  const idleLabel = submit.querySelector('.interest-submit__idle');
  const busyLabel = submit.querySelector('.interest-submit__busy');
  const success = documentRef.getElementById('interest-success');
  const configResponse = await fetchImpl('/api/config', { headers: { Accept: 'application/json' } });
  const config = await configResponse.json().catch(() => null);
  if (!configResponse.ok || typeof config?.turnstileSiteKey !== 'string' || !config.turnstileSiteKey) {
    throw new Error('Turnstile configuration unavailable');
  }
  const api = turnstileApi || await loadTurnstile(documentRef);
  let token = '';
  let submitting = false;
  const widgetId = api.render('#interest-turnstile', {
    sitekey: config.turnstileSiteKey,
    callback: (value) => { token = value; status.textContent = ''; },
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; },
  });

  const setBusy = (busy) => {
    submitting = busy;
    submit.disabled = busy;
    submit.setAttribute('aria-busy', String(busy));
    idleLabel.hidden = busy;
    busyLabel.hidden = !busy;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!token) {
      status.dataset.state = 'error';
      status.textContent = 'Please complete the verification.';
      return;
    }
    setBusy(true);
    status.dataset.state = 'submitting';
    status.textContent = 'Sending your information…';
    const data = new FormData(form);
    try {
      const response = await fetchImpl('/api/interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          firstName: String(data.get('firstName') || ''),
          lastName: String(data.get('lastName') || ''),
          email: String(data.get('email') || ''),
          company: String(data.get('company') || ''),
          turnstileToken: token,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true || !['recorded', 'accepted'].includes(body.status)) {
        const failure = new Error('Submission failed');
        failure.status = response.status;
        throw failure;
      }
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (error) {
      token = '';
      api.reset(widgetId);
      status.dataset.state = 'error';
      status.textContent = ERROR_COPY[error?.status] || ERROR_COPY.default;
      setBusy(false);
    }
  };

  form.addEventListener('submit', onSubmit);
  return { destroy() { form.removeEventListener('submit', onSubmit); } };
}
