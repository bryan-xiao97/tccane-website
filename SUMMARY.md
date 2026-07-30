# TCCANE Website (v2) Project Summary

This document records the design, structure, and build notes for the **Tzu Chi Collegiate Association, Northeast Region (TCCANE)** website — version 2.

---

## Repository Structure

A flat, zero-dependency static site:

- **index.html** — Core structure and all page sections, with metadata, a favicon, and inline layout styles that reference the design tokens.
- **styles.css** — Merged Tzu Chi design tokens (color, typography, fonts, spacing, motion), base reset, the ambient cloud-drift keyframe, and the component + `:hover` classes.
- **app.js** — Vanilla JS controller. A single feature: scroll-triggered fade-and-rise reveals, fully reduced-motion aware.
- **assets/** — SVG illustrations (lotus-and-ship, bamboo bank, roofline, lotus mark), mission icons, the `tcca-emblem.png` logo, and photography under `photos/` (web derivatives only; masters are git-ignored).
- **tools/** — `build-photos.py`, which regenerates those derivatives. Authoring only; not part of serving the site.
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

## Copy and Layout Conventions

**No em dashes in page copy.** Every em dash in `index.html` was replaced with
punctuation chosen for what the dash was doing: a colon where it introduced a
list or a restatement, a comma for an appositive. Two lines were reworded
because a bare comma read badly, one of them the Why Join community item, where
a comma would have produced a doubled "and". The single en dash that remains is
the numeric range in "Give 2 to 4 weeks' notice" and should stay. Keep new copy
free of em dashes.

**Section headings are uncapped.** Four Missions, In the chapters and Chapters
previously capped their heading blocks at 56 to 60ch, with a further 52 to 62ch
cap on the description, which held the copy in a narrow column and left most of
the container empty. Those caps are gone: the blocks keep their original
stacked order and alignment, Four Missions still centred and the other two
still left, but the text now runs to the full 1140px wrap.

A two-column variant was tried first, with the heading on the left and the
description on the right. It was rejected on looks. The tradeoff of the current
version is a long measure on the descriptions at desktop width; the wrap itself
is the only constraint holding them.

## Photography

Photography was added after the original DC conversion, which shipped illustration
only. The illustrated hero and the bamboo bank are the brand's voice and were
deliberately left in place; photography does a different job — evidence that the
claims elsewhere on the page are real.

Six of seven supplied photos are published, in three placements:

| Placement | Photo | Reasoning |
| :--- | :--- | :--- |
| Why Join, left column | Leadership planning workshop | A candid answers "what would I actually do here?" better than a posed group shot. Sits opposite the leadership-development claim. |
| Four Missions, one per cell | Philippines, Nepal ×2, Japan | Tzu Chi's global work, illustrating the four founding missions. |
| Life in the chapters (band) | Spring Retreat ×2, Giving Café ×2 | One destination, mixing posed (legitimacy) with candid (texture). |
| Resources, beside heading | Graduation ceremony | "Resources that carry beyond college" — the ceremony is the literal picture of that sentence. It went here rather than About because About's bamboo-bank illustration is load-bearing content, referenced by the callout directly beneath it. |

Spring Retreat 1 is archived but unpublished: backs of heads dominate the
foreground and no crop rescues it.

**Two registers of photography.** The chapter's own photos (band, Why Join,
Resources) are the page's "this is us." The Four Missions photos are Tzu Chi
official imagery of global work — Philippines disaster relief, Nepal medical
relief and vocational training, a Japanese earthquake survivor. They are
deliberately smaller and on paper rather than navy, so the band stays the
page's photography moment and the sequencing reads global mission → local
chapter life rather than two competing galleries.

**Mission cells.** Each cell carries a 3:2 photo where its line-art icon used
to sit; the icon survives as a 54px medallion straddling the photo's lower
edge. That overlap is the point — it adds the layering the flat icon-and-rule
version lacked while keeping the design-system icons in play.

Two mission descriptions were rewritten because the photos contradicted them.
Education previously read "tutoring, mentorship, and scholarships … for
underserved students" against a photo of adult women's vocational sewing
training; Humanistic Culture read "recording real stories" against a photo of
volunteers comforting a survivor. Both now lead with what the photograph
actually shows, and Humanistic Culture keeps "truth, goodness, and beauty"
verbatim since that is Tzu Chi's own formulation.

The Nepal medical master is only 566px wide, below the 800px tier. It is
published at native width rather than upscaled. At the rendered cell size
(~222px desktop, ~295px mobile) that still clears 2× density.

**Band layout.** An asymmetric grid on `--tc-navy`, placed between Missions and
Chapters. Navy because photos read better on a dark ground, it makes a deliberate
gallery-wall moment rather than a third paper section, and it sets up the navy CTA
further down as a motif. Every source is 4:3 with people filling the frame, so all
cells resolve to gentle landscape crops — the three upper cells to 3:2, the lower
strip to 5:2 — which is why the busy, horizontally-composed Giving Café candid
takes the wide cell and the fifteen-person group shot does not. An aggressive
letterbox across a group portrait cuts heads.

Band captions are overlaid on the images rather than set beneath them. This is
structural, not decorative: captions below the frames would add an unknown height
to each grid row and break the hand-off that lets the anchor cell size its two
neighbours.

**No JavaScript.** The band is static markup. Rendering images through JS would
defeat the browser's preload scanner, hide them from link-preview scrapers, and —
most importantly — invert the invariant documented below, since the photos are the
page's social proof and an empty band is the one failure mode worth avoiding. Class
names (`.photo-band__cell--anchor`, `.photo-figure`, and so on) are consistent
enough that a manifest-driven rewrite later is mechanical.

**Pipeline.** `tools/build-photos.py` emits the widths each photo is actually
rendered at, in WebP and JPEG, and strips all EXIF, verifying afterwards that none
survived. That check is not ceremonial: one master carried GPS coordinates for a
private home. Requested widths are capped at each master's native width so nothing
is ever upscaled. Large placements get 800 and 1600; the mission cells never render
wider than ~295px, so a second tier there would only be dead weight in the repo.
Masters stay out of git — see README.

**Provenance.** The chapter photographs are TCCANE's own. The four Four Missions
photographs are Tzu Chi official imagery, used as an official chapter; no per-photo
credit line is required.

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
