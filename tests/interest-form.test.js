// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { initInterestForm } from '../interest-form.js';

function fixture() {
  document.body.innerHTML = `
    <form id="interest-form">
      <input name="firstName" value="Ada" required>
      <input name="lastName" value="Lovelace" required>
      <input name="email" type="email" value="ada@college.edu" required>
      <input name="company" value="">
      <div id="interest-turnstile"></div>
      <p id="interest-form-status"></p>
      <button id="interest-submit" type="submit"><span class="interest-submit__idle">Send</span><span class="interest-submit__busy" hidden>Sending</span></button>
    </form>
    <section id="interest-success" tabindex="-1" hidden><h3>Thanks</h3></section>`;
}

function turnstileFake() {
  let options;
  return {
    render: vi.fn((_container, next) => { options = next; return 'widget-1'; }),
    reset: vi.fn(),
    solve(token = 'turnstile-token') { options.callback(token); },
  };
}

beforeEach(() => fixture());

test('prevents page navigation while form setup is still pending', () => {
  const fetchImpl = vi.fn(() => new Promise(() => {}));
  initInterestForm({ documentRef: document, fetchImpl });

  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
  const notCanceled = document.getElementById('interest-form').dispatchEvent(submitEvent);

  expect(notCanceled).toBe(false);
});

test.each(['recorded', 'accepted'])('%s replaces the form with persistent success', async (status) => {
  const turnstileApi = turnstileFake();
  const fetchImpl = vi.fn(async (url, init) => {
    if (url === '/api/config') return new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 });
    expect(url).toBe('/api/interest');
    expect(JSON.parse(init.body)).toEqual({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@college.edu', company: '', turnstileToken: 'turnstile-token',
    });
    return new Response(JSON.stringify({ ok: true, status }), { status: 200 });
  });
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  turnstileApi.solve();
  document.getElementById('interest-form').requestSubmit();
  await vi.waitFor(() => expect(document.getElementById('interest-success').hidden).toBe(false));
  expect(document.getElementById('interest-form').hidden).toBe(true);
  expect(turnstileApi.reset).not.toHaveBeenCalled();
});

test('permanent failure retains fields, resets Turnstile and permits retry', async () => {
  const turnstileApi = turnstileFake();
  const fetchImpl = vi.fn(async (url) => url === '/api/config'
    ? new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 })
    : new Response(JSON.stringify({ error: 'Submission failed' }), { status: 502 }));
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  turnstileApi.solve();
  document.getElementById('interest-form').requestSubmit();
  await vi.waitFor(() => expect(turnstileApi.reset).toHaveBeenCalledWith('widget-1'));
  expect(document.querySelector('[name="email"]').value).toBe('ada@college.edu');
  expect(document.getElementById('interest-submit').disabled).toBe(false);
  expect(document.getElementById('interest-success').hidden).toBe(true);
  expect(document.getElementById('interest-form-status').dataset.state).toBe('error');
});

test('submitting state ignores a second submit', async () => {
  const turnstileApi = turnstileFake();
  let resolvePost;
  const fetchImpl = vi.fn(async (url) => {
    if (url === '/api/config') return new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 });
    return new Promise((resolve) => { resolvePost = resolve; });
  });
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  turnstileApi.solve();
  const form = document.getElementById('interest-form');
  form.requestSubmit();
  form.requestSubmit();
  expect(fetchImpl.mock.calls.filter(([url]) => url === '/api/interest')).toHaveLength(1);
  resolvePost(new Response(JSON.stringify({ ok: true, status: 'recorded' }), { status: 200 }));
});

test('missing Turnstile token shows the verification prompt and never posts', async () => {
  const turnstileApi = turnstileFake();
  const fetchImpl = vi.fn(async (url) => url === '/api/config'
    ? new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 })
    : new Response(JSON.stringify({ ok: true, status: 'recorded' }), { status: 200 }));
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  const form = document.getElementById('interest-form');
  form.requestSubmit();
  await vi.waitFor(() => expect(document.getElementById('interest-form-status').textContent).toBe('Please complete the verification.'));
  expect(document.getElementById('interest-form-status').dataset.state).toBe('error');
  expect(fetchImpl.mock.calls.filter(([url]) => url === '/api/interest')).toHaveLength(0);
  expect(form.hidden).toBe(false);
  expect(document.getElementById('interest-success').hidden).toBe(true);
});

test.each([403, 429, 503])('%s keeps the form available and resets Turnstile', async (statusCode) => {
  const turnstileApi = turnstileFake();
  const fetchImpl = vi.fn(async (url) => url === '/api/config'
    ? new Response(JSON.stringify({ turnstileSiteKey: 'site-key' }), { status: 200 })
    : new Response(JSON.stringify({ error: 'nope' }), { status: statusCode }));
  await initInterestForm({ documentRef: document, fetchImpl, turnstileApi });
  turnstileApi.solve();
  const form = document.getElementById('interest-form');
  form.requestSubmit();
  await vi.waitFor(() => expect(turnstileApi.reset).toHaveBeenCalledWith('widget-1'));
  expect(form.hidden).toBe(false);
  expect(document.getElementById('interest-submit').disabled).toBe(false);
  expect(document.getElementById('interest-success').hidden).toBe(true);
  expect(document.getElementById('interest-form-status').dataset.state).toBe('error');
});
