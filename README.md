# tccane-website-v2

Static marketing site for the **Tzu Chi Collegiate Association, Northeast Region (TCCANE)** — a single-page, dependency-free website built with plain HTML, CSS, and vanilla JavaScript.

## Structure

- `index.html` — the full page (header, hero, aphorism, about, why-join, four missions, chapters, resources, get-involved, footer).
- `styles.css` — design tokens, base reset, keyframes, and component/hover classes.
- `app.js` — scroll-reveal animation (IntersectionObserver) and the mobile nav toggle, reduced-motion aware.
- `assets/` — SVG illustrations, icons, the TCCA emblem, and the social share card (`og-card.png`).
- `references/` — content source notes and a provenance archive of the original design export under `references/_source/`.

## Run locally

No build step. Serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

See `SUMMARY.md` for design notes and the conversion provenance.
