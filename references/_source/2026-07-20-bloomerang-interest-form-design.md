# Bloomerang Interest Form — Design Spec

- **Date:** 2026-07-20
- **Status:** Approved (design); pending implementation plan
- **Feature:** Embed a student "interest form" in the TCCANE website that pushes submissions into the organization's Bloomerang CRM using Bloomerang.js.

---

## 1. Context & goal

`tccane-website-v2` is a single-page, zero-dependency static site (plain HTML/CSS/vanilla JS, no build step). Today the **Get Involved** section (`#involved`) offers only outbound contact paths: an `mailto:` advisor link plus Instagram and Discord.

**Goal:** let a prospective student express interest directly on the page and have that submission land in TCCANE's own Bloomerang account as a constituent with a timeline interaction — without adding a backend or a build step.

Bloomerang.js is a client-side library that submits form data to Bloomerang using a **public** API key (a string beginning with `pub_`, from *Settings → Integrations → API Keys v1.0*). The key is public by design — it can create records but not read them — which makes it appropriate for embedding in static client-side source. See references.

---

## 2. Chosen approach

**Approach B — Bloomerang.js, direct, with graceful fallback + spam protection.**

Our own design-matched HTML form, a small vanilla-JS module that maps fields to the Bloomerang API and posts them, plus two robustness additions:

1. **Spam gate** — a dependency-free honeypot field and submission time-trap (no third-party CAPTCHA script for now).
2. **Graceful fallback** — if Bloomerang.js fails to load or the post errors, the form reveals the advisor `mailto:` (pre-filled with the user's message) so no lead is lost.

Rejected alternatives:

- **A — minimal Bloomerang.js:** no fallback or spam guard. A failed post silently loses the lead and the public key invites bot spam. Rejected as too fragile.
- **C — hosted/iframe form:** least code, but Bloomerang's hosted forms are donation-oriented and the iframe cannot match the site's navy design system. Off-brand and not the stated goal.

---

## 3. Functional requirements

1. The Get Involved section presents an inline **form card** collecting:
   - **First name** (required)
   - **Last name** (required)
   - **Email** (required, format-validated)
   - **What interests you?** — free-text message (optional)
2. The Instagram / Discord / advisor-email links remain, as secondary options beneath the card.
3. On valid submit, a constituent + interaction is created in Bloomerang (see §5).
4. On success, the card is replaced by an inline confirmation ("Thanks — a Northeast advisor will reach out").
5. On failure (script missing or post error), the advisor email + a pre-filled `mailto:` is revealed as a fallback.
6. Bot submissions (honeypot filled, or submitted faster than the time threshold) are silently discarded.

### Non-goals / out of scope

- No donations or payments (no Spreedly/PCI, no Fund/Campaign/Appeal).
- No custom Bloomerang fields — the message goes into the interaction **note** (custom fields would require prior setup in the account).
- No backend, database, or build step.
- No reCAPTCHA in v1 (documented as a future upgrade if spam appears).

---

## 4. Architecture & files

| File | Change |
| :--- | :--- |
| `index.html` | Replace the inner content of `#involved` with the form card + secondary links; add `<script defer>` for Bloomerang.js and for `interest-form.js` before `</body>`. |
| `interest-form.js` *(new)* | Feature module: validation, spam gate, Bloomerang mapping/post, success + fallback UI. Kept separate from `app.js` (which only does scroll-reveal). |
| `styles.css` | Form styles from existing design tokens: inputs, `:focus-visible`, button hover/active, error text, success state, visually-hidden honeypot. |
| `app.js` | Untouched. |

### Module shape (`interest-form.js`)

Pure, independently testable helpers, plus a thin adapter/handler:

- `validateEmail(value): boolean`
- `isLikelyBot({ honeypot, elapsedMs }): boolean` — true if honeypot non-empty or `elapsedMs` below threshold (~2500ms).
- `buildInteractionPayload(fields, now): { account, interaction }` — returns a plain object (no Bloomerang dependency), e.g.
  ```
  {
    account:     { firstName, lastName, emailHome },
    interaction: { date, subject: "Website interest form",
                   channel: "Website", purpose: "Other",
                   inbound: true, note }
  }
  ```
- `postToBloomerang(payload): Promise<void>` — thin adapter that applies the payload via the Bloomerang API (see §5) and resolves/rejects.
- A `submit` handler that orchestrates: validate → spam gate → build → post → success/fallback UI.

Config constant at the top of the module:

```js
const BLOOMERANG_PUBLIC_KEY = "pub_XXXXXXXX"; // paste TCCANE's public key
```

---

## 5. Bloomerang mapping

Initialize once, set account + interaction, then post. Function names per Bloomerang.js docs (to be confirmed against in-account docs — see §9):

```js
Bloomerang.init(BLOOMERANG_PUBLIC_KEY);

Bloomerang.Account.firstName(firstName);
Bloomerang.Account.lastName(lastName);
Bloomerang.Account.setEmailHome(email);

Bloomerang.Interaction.date(today);          // "yyyy-mm-dd"
Bloomerang.Interaction.subject("Website interest form");
Bloomerang.Interaction.channel("Website");
Bloomerang.Interaction.purpose("Other");
Bloomerang.Interaction.inbound(true);
Bloomerang.Interaction.note(message);        // the "What interests you?" text
Bloomerang.Interaction.post();
```

Bloomerang de-duplicates constituents by email, so a repeat submitter updates rather than duplicates.

---

## 6. Data flow

1. **Submit** intercepted (`preventDefault`).
2. **Validate** — first/last name present, email valid; invalid fields show inline errors wired via `aria-describedby`.
3. **Spam gate** — `isLikelyBot(...)`; if true, show the normal success UI (to not tip off bots) but do **not** post.
4. **Build** — `buildInteractionPayload(fields, new Date())`.
5. **Post** — `postToBloomerang(payload)`.
6. **Success** — replace card with `aria-live` confirmation; move focus to it.
7. **Failure** (script absent or post rejects) — reveal advisor email + pre-filled `mailto:` (subject/body seeded from the message); log a console error for debugging.

---

## 7. Spam protection

- **Honeypot:** a visually-hidden, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"` text input (e.g. named `company`). Any value ⇒ discard.
- **Time-trap:** record page/form load time; discard submissions faster than ~2500ms.
- Both are dependency-free and invisible to real users. reCAPTCHA (`Bloomerang.setCaptchaResponse`) is a documented future upgrade only if spam materializes.

---

## 8. Cross-cutting requirements

**Security**
- The `pub_` key is public by design and lives in a clearly-labeled config constant — not a secret leak.
- No user HTML is injected; message text is only sent to Bloomerang and inserted into `mailto:` via `encodeURIComponent`.

**Accessibility**
- Real `<label>` per input; fully keyboard-operable.
- `:focus-visible` focus rings; visible error text associated via `aria-describedby`.
- `aria-live="polite"` status region for success/error; focus moved to confirmation on success.
- WCAG-AA contrast on the light card; motion respects `prefers-reduced-motion`.

**Performance**
- Bloomerang.js and `interest-form.js` loaded with `defer`.
- Space reserved for the confirmation to avoid layout shift (CLS).
- Small CSS delta; comfortably within the microsite budget (JS < 80 kb, CSS < 15 kb).

---

## 9. To verify against in-account Bloomerang docs before building

1. Exact `<script src="…">` URL for Bloomerang.js (not published on the public docs page).
2. What `Interaction.post()` returns — callback vs. promise, and how errors surface. This drives the success/fallback branch in `postToBloomerang`.
3. That `purpose:"Other"` is accepted and no Fund/Campaign is required for a bare interaction.
4. (Optional) Whether TCCANE wants submissions tagged to a specific campaign/appeal or a custom field for reporting — would add one setter.

---

## 10. Testing plan

- **Unit** (Node built-in `node --test`, zero new deps) on the pure helpers:
  - `validateEmail` — valid/invalid addresses.
  - `isLikelyBot` — honeypot filled, and elapsed-time boundaries.
  - `buildInteractionPayload` — correct field mapping, date format, static subject/channel/purpose/inbound.
- **Fallback path** — simulate a missing `Bloomerang` global and assert the `mailto:` fallback is revealed.
- **Manual visual** — 320 / 768 / 1024 / 1440 breakpoints; no overflow; focus states.
- **End-to-end (once, manual)** — a real test submission into TCCANE's Bloomerang account confirming the constituent + interaction land as expected.

---

## References

- Bloomerang.js docs — https://bloomerang.com/product/integrations-data-management/api/bloomerang-js/
- Bloomerang API overview — https://bloomerang.co/product/integrations-data-management/api/
