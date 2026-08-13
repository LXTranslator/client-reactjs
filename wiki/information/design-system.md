# Design System — Silver Glass

A universal, dependency-free design system for static documentation sites.
It is intentionally **project-agnostic**: drop it (and the CSS/JS it describes)
into any repository to get a consistent, modern look. This document is the
source of truth for the visual language; individual sites add only their own
content and per-section styles.

**Aesthetic:** white, silver, and transparent — a light "glassmorphism" surface
treatment with translucent panels, hairline borders, soft shadows, and a subtle
silver gradient backdrop. Calm, airy, and neutral so it fits any brand.

---

## 1. Principles

1. **Self-contained.** No external fonts, scripts, stylesheets, CDNs, or runtime
   network calls. Everything ships in-repo; inline small assets as data URIs.
2. **Token-driven.** All color, spacing, radius, and shadow decisions come from
   CSS custom properties. Never hard-code a hex value in a component.
3. **Layered CSS.** Root tokens → shared layout → shared components →
   per-section overrides. A page pulls in exactly those layers plus its own.
4. **Progressive & accessible.** Semantic HTML first, native elements where
   possible (`<details>` for accordions), visible focus states, sufficient
   contrast, responsive down to ~360px.
5. **Runtime-composed chrome.** Header and footer are shared partials injected
   client-side, so navigation lives in one file and every page stays in sync.

---

## 2. Design tokens

Declared once on `:root` (see `css/main.css`). Reuse these names verbatim.

### Palette — white & silver

| Token | Value | Use |
|---|---|---|
| `--white` | `#ffffff` | Pure surfaces, button text on accent. |
| `--silver-050` | `#f6f8fb` | Lightest tint. |
| `--silver-100` | `#eef1f6` | Background top. |
| `--silver-200` | `#e2e7ee` | Background mid. |
| `--silver-300` | `#d2d9e3` | Backdrop blobs. |
| `--silver-400` | `#b9c2d0` | Muted fills. |
| `--silver-500` | `#9aa6b8` | Bar starts, dividers. |
| `--silver-600` | `#78859a` | Strong silver. |

### Ink — text

| Token | Value | Use |
|---|---|---|
| `--ink-900` | `#1b2430` | Headings, strong text. |
| `--ink-700` | `#333f4f` | Body text. |
| `--ink-500` | `#5a6676` | Secondary / lead text. |
| `--ink-400` | `#78859a` | Muted captions, eyebrows. |

### Accent & intent

| Token | Value | Use |
|---|---|---|
| `--accent` | `#5b7189` | Cool steel accent. |
| `--accent-strong` | `#3f5872` | Links, emphasis. |
| `--accent-soft` | `rgba(91,113,137,.12)` | Accent chip/active backgrounds. |
| `--sponsor` | `#d6336c` | Donation / call-to-heart accent. |
| `--sponsor-soft` | `rgba(214,51,108,.10)` | Sponsor backgrounds. |

Intent colors used by badges/callouts: success `#1f7a54`, warning `#9a6b16`,
danger reuses `--sponsor`.

### Transparent glass surfaces

| Token | Value | Use |
|---|---|---|
| `--glass` | `rgba(255,255,255,.62)` | Default panel/card fill. |
| `--glass-strong` | `rgba(255,255,255,.90)` | Header and buttons — stays readable even without blur. |
| `--glass-faint` | `rgba(255,255,255,.40)` | Subtle inset blocks. |
| `--glass-border` | `rgba(255,255,255,.75)` | Highlight (top) border. |
| `--hairline` | `rgba(120,133,154,.28)` | Divider / low-contrast border. |
| `--surface-solid` | `rgba(255,255,255,.98)` | Near-opaque fallback for content-covering overlays. |
| `--blur` | `saturate(160%) blur(14px)` | `backdrop-filter` for glass. |

### Shadows, geometry, type

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(27,36,48,.06), 0 2px 8px rgba(27,36,48,.05)` |
| `--shadow-md` | `0 6px 22px rgba(27,36,48,.10)` |
| `--shadow-lg` | `0 18px 48px rgba(27,36,48,.16)` |
| `--radius-sm` / `--radius` / `--radius-lg` | `10px` / `16px` / `22px` |
| `--maxw` | `1120px` (content max width) |
| `--header-h` | `64px` |
| `--font` | system UI stack (`-apple-system, "Segoe UI", Roboto, …`) |
| `--mono` | system mono stack (`ui-monospace, "JetBrains Mono", Consolas, …`) |

### Backdrop

The page background is a fixed, layered silver gradient — soft white highlights
top-left/right and a light silver wash toward the bottom over a
`linear-gradient(160deg, #eef1f6 → #dbe1ea)`. It is `background-attachment:
fixed` so content scrolls over a stable field.

---

## 3. Glass surface recipe

Every raised element follows the same recipe:

```css
background: var(--glass);
-webkit-backdrop-filter: var(--blur);
backdrop-filter: var(--blur);
border: 1px solid var(--glass-border);
box-shadow: var(--shadow-sm);
border-radius: var(--radius);
```

Interactive cards lift on hover: `transform: translateY(-4px)` +
`--shadow-lg`. Keep transitions short (`.15s–.2s ease`).

### Overlays that cover content — do not use translucent glass

The glass recipe is for surfaces that sit **over the fixed background**, not over
other page content. Any overlay that **fully covers page content** — the mobile
navigation panel, dropdown menus, modals — must use an **opaque** background and
**must not** rely on `backdrop-filter` blur for legibility:

```css
/* content-covering overlay */
background: #ffffff;         /* or var(--surface-solid) */
-webkit-backdrop-filter: none;
backdrop-filter: none;
box-shadow: var(--shadow-md);
```

Why: when such an overlay is nested inside another element that already has
`backdrop-filter` (e.g. a blurred sticky header), the child's background paint
can be **suppressed** in browsers or environments where `backdrop-filter` is
unsupported or disabled — letting the content behind bleed through. A blur over
content you are hiding adds nothing anyway, so make these overlays solid.

---

## 4. Components

Provided by `css/shared/components.css`. Use these class names as-is.

| Component | Class(es) | Notes |
|---|---|---|
| Hero banner | `.hero` | Large intro glass panel with soft radial glow. |
| Panel / section | `.panel`, `.section` | Grouped glass block. |
| Card grid | `.card-grid` > `.card` | Auto-fill min 248px; `a.card` is clickable, lifts on hover; inner `.card__icon/__title/__desc/__more`. |
| Feature list | `.feature-list` | Stacked highlighted rows. |
| Accordion | `details.acc` > `summary` + `.acc__body` | **Native `<details>`** — no JS. `+ / –` marker via CSS. Group in `.accordion`. |
| Code | `pre` / `code` | Dark `pre` (`#1c2431`), inline `code` tinted with accent. `.code-label` for a caption. |
| Table | `.table-wrap` > `table` | Always wrap tables in `.table-wrap` for horizontal scroll. |
| Badge / chip | `.badge` (`--accent/--ok/--warn`), `.chip` / `.chip-row` | Small status/labels. |
| Button | `.btn` (`--primary/--sponsor`), `.btn-row` | Pill buttons; primary/sponsor are gradient-filled. |
| Callout | `.callout` (`--info/--warn/--danger`) | Icon + body aside. |
| Definition list | `.deflist` > `.deflist__row` (`.deflist__term`) | Two-column term/description. |
| Eyebrow / lead | `.eyebrow`, `.lead` | Section kicker and intro paragraph. |
| Breadcrumbs | `.breadcrumbs` (`a`, `.sep`) | Page context trail. |

Prefer composing these over new CSS. Add a per-section stylesheet only for
genuinely page-specific layouts (e.g. a slot map, stat bars).

---

## 5. Layout & chrome

* **Container:** `.container` (max `--maxw`, centered). Add `.narrow` (max
  880px) for text-heavy reading pages.
* **Header:** sticky glass bar, `.site-header` > `.nav` with `.nav__brand`,
  `.nav__links` (`.nav__link`, active via `.is-active`), an optional
  `.nav__dd` dropdown, and a mobile `.nav__toggle`. A `.nav__spacer` item pushes
  the final link (e.g. a call-to-action) to the far right.
* **Footer:** `.site-footer` with a brand column and link columns.
* **Responsive:** below 900px the nav collapses into a toggled panel; grids use
  `auto-fit/auto-fill minmax()` so they reflow. The page body never scrolls
  horizontally — wide content scrolls inside its own container.

---

## 6. Runtime include system (portable)

The header/footer are injected at runtime so navigation lives in one place.
This pattern is repo-agnostic:

* **Partials:** `partials/header.html` and `partials/footer.html`. Internal
  links inside them use a `{{ROOT}}` token.
* **Loader:** `js/site.js` reads two globals the page sets in `<head>` —
  `window.SITE_ROOT` (relative path back to the site root, e.g. `""`, `"../"`,
  `"../../"`) and `window.PAGE_SECTION` (for active-nav highlighting). It fetches
  the partials, replaces `{{ROOT}}` with `SITE_ROOT`, wires the mobile menu and
  active link, injects a favicon, and stamps the footer year.
* **Mount points:** each page has `<div id="site-header"></div>` and
  `<div id="site-footer"></div>`.

Because it uses `fetch()`, always serve over HTTP when testing.

---

## 7. CSS file organization

```
css/
  main.css              # :root tokens + base element styles
  shared/
    layout.css          # header, nav, footer, breadcrumbs
    components.css       # cards, accordions, tables, badges, buttons, callouts
  <section>/
    <section>.css        # page-specific layout only
```

A page links, in order: `main.css` → `shared/layout.css` →
`shared/components.css` → `<section>/<section>.css`.

---

## 8. Reusing in another repository

1. Copy `css/main.css`, `css/shared/`, `js/site.js`, and `partials/` into the
   new repo's site root.
2. Rebrand by editing **tokens only** in `main.css` (palette, accent, radius,
   fonts) — components inherit automatically. To move off silver, adjust the
   `--silver-*`, `--accent*`, and the body background gradient; leave the
   `--glass-*`, shadow, and geometry tokens for a consistent feel.
3. Edit `partials/header.html` / `footer.html` for the new site's nav and
   branding (keep the `{{ROOT}}` tokens and `data-section` attributes).
4. Author pages against the components in §4; add a `<section>/<section>.css`
   only when a page needs bespoke layout.
5. Keep it self-contained (§1) and accessible (§1.4).

---

## 9. Accessibility checklist

* Semantic landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`) and heading
  order (one `<h1>` per page).
* Visible `:focus-visible` outline (provided in `main.css`).
* `aria-label` on nav and breadcrumb regions; decorative icons `aria-hidden`.
* Text/background contrast: body ink on glass over the silver field meets WCAG
  AA. Do not place body text directly on the `--glass-faint` tier without
  checking contrast.
* All interactive controls reachable and operable by keyboard (the accordion is
  native `<details>`, the dropdown opens on focus-within, the mobile menu is a
  real `<button>`).

---

## 10. Applying Silver Glass in this repository

Sections 1 to 9 above are the portable specification and are reproduced
verbatim. This section records how it is realised in `client-reactjs`, which is
a React single page application rather than a static documentation site.

### What is identical

* **Every token**, byte for byte, in `src/styles/main.css`.
* **The glass recipe** and the opaque-overlay rule in §3.
* **Every component class name** from §4, so markup written against the
  specification works here unchanged.
* **The layout and chrome classes** from §5, including the sub-900px nav
  collapse.
* **The accessibility checklist** in §9.

### The one deliberate deviation: §6

The runtime include system fetches `partials/header.html` and
`partials/footer.html` at page load so that navigation lives in one file. That
solves a problem a static multi-page site has and a single page application does
not: here the header and footer are mounted once and never re-fetched.

Fetching partials in this codebase would be strictly worse. It would add a
network round trip before the chrome could render, put HTML assembly outside
React's control, and reintroduce the duplication the pattern exists to remove
without gaining anything.

The **intent** of §6 is preserved exactly: navigation is defined once, in one
place, and every page stays in sync.

| Specification (§6) | This repository |
|---|---|
| `partials/header.html` | `src/components/layout/SiteHeader.jsx` |
| `partials/footer.html` | `src/components/layout/SiteFooter.jsx` |
| `js/site.js` loader | `src/components/layout/AppLayout.jsx` |
| `{{ROOT}}` token | React Router `<Link>`, which resolves paths itself |
| `window.PAGE_SECTION` | `<NavLink>` with its `isActive` render prop |
| `#site-header` / `#site-footer` mount points | `AppLayout` rendering both around an `<Outlet />` |

The mobile navigation panel is still a real `<button>` toggling a class, and it
still uses the opaque treatment §3 requires for a content-covering overlay.

### File layout

§7 describes a `css/` directory for a static site. Here the same layers live
under `src/styles/`, imported in the specified order by `src/main.jsx`:

```
src/styles/
  main.css                 # :root tokens + base element styles
  shared/
    layout.css             # header, nav, footer, breadcrumbs
    components.css         # cards, tables, badges, buttons, callouts, forms, modals
  auth/
    auth.css               # sign in, registration and recovery layout
  editor/
    editor.css             # translation editor, upload dropzone, key priority list
```

### Additions

Three component groups the specification does not cover, because a
documentation site has no forms:

* **Form fields** (`.field`, `.field__control`, `.field__error`,
  `.field__hint`, `.strength`) built from the existing tokens.
* **Modal dialogs** (`.modal-backdrop`, `.modal`) which follow §3's
  opaque-overlay rule exactly, since a modal covers page content.
* **Progress and spinner** (`.progress`, `.spinner`) for upload and
  translation states.

All three use only declared tokens, so a rebrand through §8 restyles them along
with everything else.
