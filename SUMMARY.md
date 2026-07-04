# TCCANE Website (v2) Project Summary

This document records the design, structure, and build notes for the **Tzu Chi Collegiate Association, Northeast Region (TCCANE)** website — version 2.

---

## Repository Structure

A flat, zero-dependency static site:

- **index.html** — Core structure and all page sections, with metadata, a favicon, and inline layout styles that reference the design tokens.
- **styles.css** — Merged Tzu Chi design tokens (color, typography, fonts, spacing, motion), base reset, the ambient cloud-drift keyframe, and the component + `:hover` classes.
- **app.js** — Vanilla JS controller. A single feature: scroll-triggered fade-and-rise reveals, fully reduced-motion aware.
- **assets/** — SVG illustrations (lotus-and-ship, bamboo bank, roofline, lotus mark), mission icons, and the `tcca-emblem.png` logo.
- **references/** — `WhyTCCA.md` and `TCCANE-policies.md` content notes, plus `_source/` (provenance archive — see below).

---

## Conversion Provenance

This site was converted from a **"Design Component" (DC) export** — a single `.dc.html` that only rendered through a proprietary React runtime (`support.js` + a design-system `_ds_bundle.js`) using non-standard elements (`<x-dc>`, `<helmet>`, `<sc-if>`, `<x-import>`) and a DC-only `style-hover` attribute.

The conversion removed the runtime entirely and produced a faithful, standards-only static site:

- `<x-import>` design-system components (Button, Card, Tag, Eyebrow, Stat, LotusMark) were expanded into plain HTML + the equivalent CSS classes.
- `<sc-if>` conditionals were resolved to the export's defaults: the **scene** hero layout and the aphorism band are shown; the alternate centered hero was dropped.
- `style-hover` attributes and the former JS hover handlers became real CSS `:hover` rules.
- The design-system token CSS files were merged into `styles.css`.

The complete original export is preserved for reference under **`references/_source/`** (the `.dc.html`, `support.js`, the `_ds/` bundle, design screenshots, and the original zip).

---

## Design Tokens

The palette is the derived Tzu Chi design-system set (no official Tzu Chi palette exists; these are harmonized from official imagery):

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--tc-navy` | `#1B2A4A` | Compassion Navy — primary, grounding |
| `--tc-navy-deep` | `#16223B` | Ink — body text on light |
| `--tc-sky` | `#4A78B0` | Sky Blue — secondary accent |
| `--tc-cloud` | `#DCE6F2` | Cloud Blue — soft fills, tints |
| `--tc-bamboo` | `#4E7A51` | Bamboo Green — primary CTA, eco accent |
| `--tc-paper` | `#FAF8F3` | Paper White — dominant background |
| `--tc-gold` | `#C9A24B` | Seed Gold — rare highlight (lotus mark heart) |

Type pairs a humanist serif for display (`Palatino Linotype` → `Spectral` fallback) with a quiet sans for body (`Segoe UI` → `Source Sans 3` fallback). Webfont fallbacks load from Google Fonts; CJK and platform faces resolve locally.

---

## Interactive Behavior

The client logic in `app.js` is pure vanilla JS with zero dependencies:

1. **Scroll reveals** — `[data-reveal]` sections (About, Why Join, Missions, Chapters, Resources) fade and rise into view via an `IntersectionObserver` (`threshold: 0.12`, slight bottom `rootMargin`, `0.7s` ease).
2. **Mobile navigation** — below 900px the header collapses to a hamburger toggle with an animated dropdown panel (`aria-expanded` managed, Escape closes, auto-resets on resize). The collapse is gated behind a `.no-js` class removed in `<head>`, so without JavaScript the nav simply wraps and stays reachable.
3. **Reduced motion** — when the OS requests reduced motion, or `IntersectionObserver` is unavailable, all content is shown immediately with no animation.
4. **No-JS safety** — the script only adds motion and the nav toggle; with JavaScript disabled, all content remains visible.

Ambient hero clouds drift via the CSS `tccaDrift` keyframe, are pinned above the headline zone, hidden on small screens (where they would cross the copy), and disabled under `prefers-reduced-motion`.

---

## Visual Polish Pass (July 2026)

A refinement pass over the original conversion:

- **Responsive header** — sticky bar no longer stacks three rows tall on phones; hamburger + dropdown below 900px.
- **Hero** — clouds constrained above the text zone; eyebrow switched to navy for contrast on the sky gradient (`.eyebrow--onSky`); CTAs go full-width on phones; hero art enlarged slightly; the lotus-ship sail redrawn as a curved sail with a gold pennant (the old triangle read as a mouse cursor).
- **Aphorism band** — added the original Chinese (口說好話 心想好意 身行好事 腳走好路) using the previously unused `--tc-font-brush` / `--tc-fs-aphorism-zh` tokens, with a gold rule above; each four-character phrase wraps as a unit. A character-subset Noto Serif TC webfont backs the local kai faces.
- **Grids** — missions, chapters, and stats now step 4 → 2 → 1 columns explicitly (auto-fit previously stranded one cell alone at tablet widths), with dividers that follow the layout.
- **Chapter cards** — now real links (mailto with a per-chapter subject) with a visible "Email to connect →" affordance, matching their interactive hover style.
- **Head/meta** — Google Fonts moved from a CSS `@import` to preconnected `<link>` tags; added Open Graph / Twitter card tags and a generated `assets/og-card.png` (1200×630) so shared links show a branded card; added `theme-color`.

---

## Local Review Instructions

No build step is required.

1. Serve the project folder:
   ```bash
   python -m http.server 8000
   ```
2. Open **http://localhost:8000**.
