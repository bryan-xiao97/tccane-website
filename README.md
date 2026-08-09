# tccane-website-v2

Static marketing site for the **Tzu Chi Collegiate Association, Northeast Region (TCCANE)** — a single-page, dependency-free website built with plain HTML, CSS, and vanilla JavaScript.

## Structure

- `index.html` — the full page (header, hero, aphorism, about, why-join, four missions, life-in-the-chapters, chapters, resources, get-involved, footer).
- `styles.css` — design tokens, base reset, keyframes, and component/hover classes.
- `app.js` — scroll-reveal animation (IntersectionObserver), reduced-motion aware.
- `assets/` — SVG illustrations, icons, the TCCA emblem, and photography under `assets/photos/`.
- `tools/build-photos.py` — regenerates the photo derivatives. Not part of serving the site.
- `doc/` — content source notes and a provenance archive of the original design export under `doc/_source/`.

## Photos

`assets/photos/` holds only web derivatives — two widths (800, 1600) in two
formats (WebP, JPEG) per photo, all committed. The camera masters live in
`assets/photos/_originals/`, which is **git-ignored on purpose**: they run
~33 MB, git never forgets a blob that size, and one master carries GPS
coordinates for a private home. Masters are archived in the chapter Drive.

To add or replace a photo: drop the master in `_originals/`, add a
`master → slug` entry to `SLUGS` in `tools/build-photos.py`, run it, and hand-write
the `<picture>` block in `index.html` following an existing one. The script
strips all EXIF and fails loudly if any survives.

```bash
python3 -m pip install Pillow   # one-time, local only
./tools/build-photos.py
```

Pillow is an authoring dependency for that script alone. The published site
still ships no dependencies and no build step.

## Run locally

No build step. Serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

See `SUMMARY.md` for design notes and the conversion provenance.

## Middleware (Cloudflare Pages Function)

Interest submission API backed by a Google Sheets destination owned by the designated personal Google account. Spec: `references/specs/Embedded Interest Form and Personal Google Sheets Access - Functional Spec - 08.06.html`.

Access uses OAuth with the `https://www.googleapis.com/auth/drive.file` scope only. The one-time local setup and production runtime share the same OAuth client ID, client secret and refresh token. Never commit `.dev.vars` and never print or embed secret values.

### Local owner setup

Create a Web OAuth client in Google Cloud with authorized redirect URI `http://127.0.0.1:53682/oauth2/callback`. The OAuth consent screen must be **Production**, not Testing. Set the client ID and secret in the shell, then run:

```bash
export GOOGLE_OAUTH_CLIENT_ID="..."
export GOOGLE_OAUTH_CLIENT_SECRET="..."
npm run setup:google
```

The command opens a loopback callback on `127.0.0.1:53682`, validates state in constant time, creates the `TCCANE Interest Submissions` spreadsheet with the `Submissions` tab and protected five-column header, and writes the deployment values to git-ignored `.dev.vars`.

### Local development

Copy `.dev.vars.example` to `.dev.vars`, retaining Cloudflare's test Turnstile pair. Run:

```bash
npm run pages:dev
```

Verify the form at `http://127.0.0.1:8788/#involved`.

### Pages secrets

Install `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_SPREADSHEET_ID` and `TURNSTILE_SECRET_KEY` as Pages secrets. Configure `TURNSTILE_SITE_KEY` and `GOOGLE_SHEET_TAB=Submissions` as Pages variables. Ensure `TURNSTILE_SKIP` is **unset** in production.

When smoke testing against a production secret, mint a widget token from the live form and pass it with `TURNSTILE_TOKEN=<token>`; against staging or locally where `TURNSTILE_SKIP=true` the script falls back to `dev`.

### Retry Worker

Confirm the `DLQ_KV` namespace IDs match in `wrangler.toml` and `wrangler.retry.toml`. Install the same four Google values (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_SPREADSHEET_ID`) with `npx wrangler secret put NAME --config wrangler.retry.toml`. Deploy via `npm run retry:deploy` and verify the five-minute Cron Trigger.

### Reauthorization

Pause or hide the form, rerun `npm run setup:google` with the designated owner, update the Pages and Worker secrets, smoke test both services, then restore the form. Revoked access produces visitor failure and a `google_auth_permanent` event rather than queued success.

### Sheet contract

`Submissions` is append-only. Columns A:E and row one are application-managed. Staff must use a separate tab for notes or reporting and must not sort partial ranges in the application-managed columns.

### Retention

Retry and poisoned KV records expire from KV after 30 days. Retries stop after 24 hours (older records become poisoned). Sheet rows older than 12 months are reviewed and deleted quarterly.

### Monitoring

Alert on `google_auth_permanent`, `sheet_contract_invalid`, `dlq_poisoned` and `dlq_oldest_age_exceeded`. The queue-age threshold is 15 minutes.

### Delivery semantics

Delivery is at least once with practical duplicate suppression: each submission keeps one opaque `submissionId`, and queued deliveries deduplicate on it. Rare duplicates remain possible after concurrent or client-level ambiguous failures.

### Deployment commands

```bash
npx wrangler pages secret put GOOGLE_OAUTH_CLIENT_ID --project-name tccane-website
npx wrangler pages secret put GOOGLE_OAUTH_CLIENT_SECRET --project-name tccane-website
npx wrangler pages secret put GOOGLE_OAUTH_REFRESH_TOKEN --project-name tccane-website
npx wrangler pages secret put GOOGLE_SPREADSHEET_ID --project-name tccane-website
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name tccane-website

npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID --config wrangler.retry.toml
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --config wrangler.retry.toml
npx wrangler secret put GOOGLE_OAUTH_REFRESH_TOKEN --config wrangler.retry.toml
npx wrangler secret put GOOGLE_SPREADSHEET_ID --config wrangler.retry.toml
npm run retry:deploy
```

