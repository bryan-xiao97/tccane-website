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

Interest submission API backed by a Google Sheets destination. Spec: `references/specs/Google Sheets Interest Submission Storage - Functional Spec - 08.05.html`.

```bash
npm install
npm test
cp .dev.vars.example .dev.vars   # fill when you have keys; TURNSTILE_SKIP=true for local
npx wrangler pages dev . --compatibility-date=2024-11-01 --compatibility-flags=nodejs_compat
# POST http://127.0.0.1:8788/api/interest
```

Secrets (production): `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_SPREADSHEET_ID`, `TURNSTILE_SECRET_KEY` via `wrangler pages secret put`. Vars: `GOOGLE_SHEET_TAB`. Never commit `.dev.vars`.

### DLQ retry

`processDlqBatch` lives in `functions/scheduled/retry-dlq.js`. Wire it as a
Cron Trigger on a small Worker that shares the `DLQ_KV` binding and the same
secrets (every 5 minutes), or call it from an authenticated ops route later.
Until cron is wired, failed submissions remain in KV for manual replay:
`npx wrangler kv key list --binding=DLQ_KV`.

### When Google service-account access arrives

1. In Google Cloud, create a service account and enable the Sheets API for the project.
2. Download its key, and `npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT` with the JSON contents.
3. Create the spreadsheet, add a `Submissions` tab with the headers `submissionId`, `submittedAtUtc`, `firstName`, `lastName`, `email` in row one, and share it with the service-account email as Editor.
4. `npx wrangler pages secret put GOOGLE_SPREADSHEET_ID`, and set `GOOGLE_SHEET_TAB` (default `Submissions`) in Pages project variables. Ensure `TURNSTILE_SKIP` is **unset** in production.
5. Deploy the Pages project; confirm `POST /api/interest` with a real Turnstile token appends one row per submission.
6. Wire the cron Worker for `processDlqBatch` sharing `DLQ_KV`.

