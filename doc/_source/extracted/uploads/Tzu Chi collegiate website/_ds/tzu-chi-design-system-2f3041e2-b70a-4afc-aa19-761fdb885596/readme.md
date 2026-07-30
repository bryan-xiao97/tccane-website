# Tzu Chi Design System

A researched, respectful **homage** design system inspired by the Buddhist Tzu Chi Foundation (佛教慈濟基金會). It packages the brand's serene, frugal visual language — derived colors, platform-font typography, original lotus/roofline/bamboo motifs, reusable React components, and a full homepage recreation — so design agents can produce well-branded Tzu Chi-style interfaces and artifacts.

> **Read this first — independent homage, not official.** This is an independent, researched interpretation. It is **not** an official Tzu Chi brand manual and is **not affiliated with or endorsed by** the Foundation. Tzu Chi does not publish a public brand guide, an official color palette, or a named typeface. Every color and font here is **derived from official imagery and public sources, then labeled approximate** — treat values as a starting point, not canon. The Foundation's logo is a registered mark and its photographs are copyrighted: **do not reproduce them.** All motifs in this system are original illustrations that evoke Tzu Chi's symbolism without copying the registered mark, and all photography is represented by clearly-marked placeholders. Verify any quoted aphorism, figure, or claim against an official source before production use.

## Sources

This system was built from materials the user provided. Explore them to do an even better job:

- **GitHub — design guidelines & sample homepage:** `https://github.com/bryan-xiao97/tc-design-system`
  - `tzu-chi-design-guidelines.md` — the full researched guideline this system is distilled from (colors, type, motifs, voice, sources).
  - `index.html` — a self-contained sample homepage; our `ui_kits/foundation-site/` is a componentized recreation of it.

The guideline cites public sources for each derived value (logo symbolism, the blue-and-white "藍天白雲" identity, Jing Si Hall architecture, the bamboo-bank origin, Jing Si Aphorisms, the Four Missions). See the "Sources" section of that file for the full list.

## Brand essence

Tzu Chi (慈濟, "compassion and relief") was founded in 1966 in Hualien, Taiwan by Dharma Master Cheng Yen. The visual system carries the feeling at the center of the organization: **serene, humble, warm and quietly resolute.** Beauty here is restraint and dignity, never spectacle.

Core ideas to express:
- **Great Love (大愛 / Da Ai)** — selfless compassion that crosses every border.
- **Four Missions, Eight Footprints** — Charity, Medicine, Education, Humanistic Culture; extended by disaster relief, bone marrow donation, environmental protection, community volunteering.
- **Truth, goodness and beauty (真善美)** — the documentary ethos: record real stories honestly.
- **Blue sky, white clouds (藍天白雲)** — the source of the blue-and-white identity.
- **Many drops make a river** — the bamboo-bank origin: small, daily, mindful giving.

---

## Content fundamentals

**Voice: humble, warm, plain, dignified.** Speak of service, not self-promotion. The brand gathers; it never boasts.

- **Active voice, plain words.** Say what an action does. "Become a volunteer," not "Volunteer sign-up." "Lend your hands to Great Love," not "Sign up now."
- **Specific over clever.** Describe real work in real words — relief parcels after a typhoon, a free clinic in session, sorting recyclables. Never sensational superlatives.
- **Giving framed as gathering.** Small acts accumulate into Great Love: "It gathers, drop by drop, from ordinary people who choose to give what they can."
- **"We," warmly.** The organization speaks as "we" about its missions ("We bring direct relief…"); it addresses the reader as "you" through gentle invitations ("Lend your hands…").
- **Dignity first.** Show recipients as capable people met with respect, never objects of pity.

**Casing & punctuation.** Sentence case for headlines and body. Eyebrows/labels are UPPERCASE with wide letter-spacing (~0.14em). Curly quotes for aphorisms. No exclamation marks, no urgency.

**Bilingual handling.** Lead in English; show select authentic Chinese terms respectfully — 慈濟, 大愛, 真善美, 靜思語, 藍天白雲. Pair an aphorism as Chinese brush calligraphy above a faithful English serif-italic translation, attributed to Dharma Master Cheng Yen.

**Emoji: never.** Not part of this brand. Meaning is carried by the motif library and restrained type, not by emoji or decorative unicode.

Examples:
- ✓ "Since 1966, volunteers in blue and white have carried Great Love into the places that need it most."
- ✗ "Join the world's most impactful charity movement today."

---

## Visual foundations

**Overall vibe.** White-dominant, navy-grounded, serene. Roughly **70% paper/white, 20% navy, 10% accents.** The calm depends on generous empty space — one idea per section, generous vertical rhythm.

**Color.** Derived, approximate (no official palette exists). Navy grounds the page; sky blue, grey, and bamboo green support; gold and lotus pink appear rarely as a single quiet highlight. See `tokens/colors.css` and the Colors specimen cards.
- Body text: Navy Deep `#16223B` or Compassion Navy `#1B2A4A` on light. Ink Grey `#585C61` for secondary.
- Sky Blue and Seed Gold **fail** AA for normal body text on white — large headings, icons, decoration only.
- Bamboo buttons use white text on Bamboo Deep `#3F6B47` for a safe ratio. On navy, use Paper/White text and Cloud Blue for muted secondary.

**Typography.** Humanist serif display (calligraphic roots) for contemplative headlines; clean quiet sans for body/interface at ~17px / line-height 1.7; kai brush face reserved for Chinese aphorisms only; a ZH sans for inline Chinese terms. Headlines are large with slightly tight tracking; eyebrows are uppercase and letter-spaced. See `tokens/typography.css`.

**Backgrounds.** Predominantly flat Paper White. The single signature gradient is the **hero sky** (blue → pale cloud, with a soft water gradient and drifting cloud shapes at the base). The navy CTA band uses a subtle radial. No busy textures, no full-bleed photography in samples (placeholders only), no purple/AI gradients.

**Motifs over imagery.** Meaning is carried by original illustrations: the lotus-and-ship mark, the lotus pond hero, the "人" Jing Si roofline, the bamboo coin bank, and calm concentric water ripples. Use each where its meaning is honest, not as decoration. See `assets/` and the Brand → Motifs card.

**Motion.** Restraint is the brand — serenity reads as stillness. Concentrate ambient motion in a single signature moment (slowly drifting clouds / gentle pond ripple). Elsewhere: soft fade-and-rise reveals on scroll only. **No bounce, no sliding carousels, no attention-grabbing effects.** Easing is gentle (`cubic-bezier(0.4,0,0.2,1)`); always respect `prefers-reduced-motion`.

**Interaction states.**
- **Hover** — primary buttons darken (bamboo → bamboo-deep) and lift 1px; secondary/ghost fill softly; cards lift 4px with a slightly deeper shadow; nav links grow a bamboo underline.
- **Press / active** — no shrink; rely on the color shift.
- **Focus** — visible 3px sky-blue outline, offset 3px. Keyboard focus is always visible.

**Borders, radii, shadows.** Hairline stone borders (`#ECEAE3` / `#D7D5CE`). Gentle radii: 8 / 14 / 20px, with pill (999px) for buttons and tags. Shadows are **soft, low, and navy-tinted** (never black, never harsh) — three steps: soft → card → lift. Cards are white with a hairline border + soft shadow + 14px radius.

**Transparency & blur.** Used sparingly: the sticky header is translucent paper with a light backdrop blur; the donate modal scrim is a low navy wash with a slight blur. Imagery, where real, is documentary and warm (blue-and-white uniforms, hands at work, nature and water) — never heavily filtered or staged.

**Layout rules.** Content max-width ~1140px; text columns ~720px for comfortable reading. The sticky header is the one fixed element. Use the "人" roofline or a thin stone rule to separate major sections quietly.

---

## Iconography

- **Line icons, ~2px stroke, rounded caps and joins, single-color (navy).** The brand's iconography is quiet and geometric — see the Four Missions icons (`charity`, `medicine`, `education`, `culture`) in `assets/icons/`. They are built into the `MissionCard` component and also available as standalone SVGs.
- **Motif illustrations are the brand's signature "icons,"** carrying meaning: lotus-and-ship mark, "人" roofline, bamboo bank, water ripples. These live in `assets/` as original SVGs. Use them where their symbolism fits.
- **No icon font, no emoji, no decorative unicode.** If a project needs UI glyphs beyond what ships here, substitute a quiet, evenly-weighted CDN line set (e.g. Lucide / Phosphor at ~2px stroke) and keep them navy and single-color to match. *(Flagged: no such set ships with this system — the missions/UI icons here are hand-built SVGs matching the source.)*
- **Logo handling.** The `LotusMark` component and `assets/lotus-mark*.svg` are **original** marks that evoke, never reproduce, the registered logo. Keep them monochrome with the single gold seed accent; never recolor, stretch, or add drop shadows.

---

## Fonts — substitution notice

No official Tzu Chi typeface exists. To stay frugal and offline, the system is built on **platform fonts** with **webfont fallbacks** so the contemplative voice survives on machines that lack the platform faces:

| Role | Token | Platform-first stack | Webfont fallback (flagged substitution) |
| --- | --- | --- | --- |
| Display serif | `--tc-font-display` | Palatino Linotype, Iowan Old Style, Book Antiqua | **Spectral** (Google) — nearest contemplative humanist serif |
| Body sans | `--tc-font-body` | Segoe UI, system-ui | **Source Sans 3** (Google) — quiet humanist sans near Segoe |
| Brush (aphorisms) | `--tc-font-brush` | STKaiti, KaiTi, BiauKai, DFKai-SB | platform only (CJK webfonts are heavy; Noto Serif TC last in stack) |
| Inline Chinese | `--tc-font-zh` | Microsoft JhengHei, PingFang TC | platform only |

⚠️ **Flagged substitutions / asks:** Spectral and Source Sans 3 are *approximations* loaded from Google Fonts. The CJK brush/inline faces rely on the viewer's platform fonts (no webfont ships, to avoid multi-MB downloads). If you have licensed display or CJK fonts you'd prefer, **upload them and I'll wire up `@font-face` rules** — the token stacks already list the target family first.

---

## Index / manifest

**Root**
- `styles.css` — global entry point (consumers link this one file). `@import`s every token file.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills-compatible front matter for use in Claude Code.

**`tokens/`** — CSS custom properties (`--tc-*`)
- `colors.css` — base palette + semantic aliases (surfaces, text, borders, actions).
- `typography.css` — font families, fluid scale, weights, line-heights, tracking (loads webfont fallbacks).
- `spacing.css` — 4px spacing scale, layout widths, radii, shadow system.
- `motion.css` — durations and gentle easings.

**`assets/`** — original SVG motifs & icons
- `lotus-mark.svg`, `lotus-mark-blue.svg`, `lotus-ship-hero.svg`, `roofline.svg`, `bamboo-bank.svg`
- `icons/` — `mission-charity/medicine/education/culture.svg`, `image-placeholder.svg`

**`components/`** — reusable React primitives (namespace `window.TzuChiDesignSystem_2f3041`)
- `core/` — `Button`, `Tag`, `Eyebrow`, `Card`, `Stat`
- `brand/` — `LotusMark`, `Roofline`, `Aphorism`, `MissionCard`

**`guidelines/`** — foundation specimen cards (Design System tab): Colors, Type, Spacing, Brand.

**`ui_kits/foundation-site/`** — interactive homepage recreation (`index.html` + `Header/Hero/Missions/Story/Gallery/Footer` screens + `kit.css`). Demonstrates nav, scroll-reveal, and a donate flow built from the components.

---

## Using the system

- **Consumers** link `styles.css` for tokens/fonts, then mount components from `window.TzuChiDesignSystem_2f3041` after loading `_ds_bundle.js` (auto-generated).
- **For throwaway artifacts** (slides, mocks): copy the assets you need and build static HTML using the tokens.
- **Always** present output as an independent homage, keep the tone respectful of a living humanitarian organization, use placeholders for photography, and never reproduce the registered logo.
