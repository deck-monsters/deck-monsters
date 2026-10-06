---
type: Architecture
title: Web themes
description: How the web app's themes work — the token contract, light versus dark themes, lazy-loaded themes and their first paint, high contrast, the feed's type, and the tests that hold it together.
status: stable
audience: internal
tags: [web, theme, css, accessibility, architecture]
---
# Web themes

A theme is a set of CSS custom properties on `<html>`, plus, for a theme that needs more than
colours, a stylesheet of rules scoped to `[data-theme='<id>']`. There are five themes: four
dark terminals (`phosphor`, `amber`, `ember`, `street-fighter`) and one light, painted theme
(`millefleur`, [roadmap 46](../roadmap/46-unicorn-theme.md), designed in the
[Millefleur design system](../reference/millefleur/design-system.md)).

## Where a theme lives

| Piece | File | Notes |
|---|---|---|
| The list | `apps/web/src/hooks/useTheme.ts` (`THEMES`) | `id`, the player-facing `label`, and `themeColor` (the theme's `--color-bg`, for the phone's status bar) |
| Defaults and phosphor | `apps/web/src/styles/theme-phosphor.css` | Phosphor is the bare `:root`: every token's default lives here |
| Other dark themes | `theme-amber.css`, `theme-ember.css`, `theme-street-fighter.css` | Colour overrides on `[data-theme='<id>']`; Street Fighter adds its pane headers, glows and scanlines |
| Millefleur | `apps/web/src/themes/millefleur.ts` → `styles/theme-millefleur.css` and the Nunito faces | A lazy chunk, see below |
| Pre-paint | `apps/web/index.html` | An inline script sets `data-theme` and `<meta name="theme-color">` before the first frame |
| Shared rules | `styles/base.css`, `styles/terminal.css` | Read tokens only; never a theme's literal colour |

Phosphor has no `data-theme` attribute; `applyTheme` removes it. The choice is stored in
`localStorage['deck-monsters-theme']`; every read and write is guarded, because storage can
throw (private windows, blocked site data). A failed read falls back to the in-memory choice.

## The token contract

Every rule in `base.css` and `terminal.css` draws with tokens, and **every token's default on
`:root` reproduces what the dark themes drew before the token existed**, so adding a token
changes no pixel in a theme that does not set it. Defaults that are `var(--color-…)` resolve
per element: a theme sets its colours on the same `<html>` element, and custom properties
compute after the cascade, so the theme's colours flow into the defaults. Do not move a theme's
colour overrides to another element.

The groups (see the comments in `theme-phosphor.css` for each one's reason):

- **Colours:** `--color-bg`, `-fg`, `-fg-bright`, `-fg-dim`, `-accent`, `-system`, `-error`,
  `-success`, `-border`, `-input-bg`, the choice states, and the HP ramp
  (`--color-hp-healthy`, `-hurt`, `-critical`). Also `--color-bg-elevated`, `--color-hover`,
  `--color-accent-muted` and `--color-warning`, which components read and no theme set until
  46a (their defaults are what the old fallbacks drew).
- **Type:** `--font-ui` for the chrome (buttons, tabs, forms, headings) and `--font-mono` for
  the feed, the Console and transcripts. A theme may change `--font-ui` freely; `--font-mono`
  must stay monospace, because the row-height guess still wraps by column and events
  without lines still draw the ASCII card frame. Events that carry `payload.lines` draw a
  card as a title, a CSS rule and the body. Millefleur also replaces some of those lines
  with composed sentences; every other theme draws the engine's words
  ([web workspace: Card frames](web-workspace.md#card-frames)). The feed's
  own size, line height and letter spacing are `--feed-font-size`, `--feed-line-height` and
  `--feed-letter-spacing`; the Ring's row-height guess measures them from the live CSS
  ([web workspace: Ring feed row heights](web-workspace.md#ring-feed-row-heights)).
- **Shape:** `--radius-sm/-md/-lg/-pill`, `--border-width`, `--color-border-strong` (edges
  that identify a control), `--shadow-page`.
- **Surfaces:** `--surface-page`, `--surface-texture`, `--surface-titlebar`, `--holo`, and the
  five `--wash-*` tints. All `none` or transparent by default.
- **Meters and text on fills:** `--color-meter-track` (a track must contrast with every HP
  stage; the border colour only works on a dark page), `--color-on-accent`, and text-safe
  `--color-highlight-good/-warn` for the feed's highlight tags (small text needs 4.5:1, a bar
  only 3:1).
- **Odds and ends:** `--color-danger-border`, `--color-backdrop` and `--color-backdrop-light`,
  and `--color-sprite-flash` (the hit flash; the renderer reads it once per theme, because a
  white flash on a light page made a struck monster vanish).

`color-scheme` is part of the theme: `dark` on `:root`, `light` on Millefleur. Without it the
browser drew native controls (radios, an unstyled field, the Workshop's role glyphs) for a
light page on the dark themes (bug 232).

## Light themes

A light theme must set, besides its colours:

- `color-scheme: light`;
- its own `--color-meter-track`, `--color-on-accent` and `--color-highlight-*` (the defaults
  assume a dark page);
- its own `--color-sprite-flash` (Millefleur flashes pink and keeps the outline);
- its own **high-contrast block**. The shared `@media (prefers-contrast: more)` block in
  `base.css` forces black and white for the dark themes only
  (`:root:not([data-theme='millefleur'])`): applied to a light theme it put white text on a
  white field. Add a new light theme's id to that selector and give it its own block.

The palette test treats a theme as light when its background's luminance is above 0.5, and
then checks that the HP ramp's contrast with the page rises as health falls (on a dark page it
falls).

## Lazy themes and the first paint

A theme with its own stylesheet and fonts is a separate chunk, loaded with a dynamic `import()`
the first time it is applied (`LAZY_THEMES` in `useTheme.ts`), so players on other themes
download none of it. Never import such a module statically; that puts it in every player's
bundle.

The first frame needs care. For a returning player the pre-paint script sets `data-theme`
before React runs, but the chunk arrives later. So:

- `base.css` carries a **first-paint stub** for the theme: the handful of colour tokens and
  `color-scheme` a frame of plain page and text needs (under 1 KB; the palette test keeps it
  equal to the chunk's values);
- `main.tsx` starts the chunk's import before React renders when `data-theme` is already set
  (a hashed chunk cannot be named from `index.html`, so this replaces the `modulepreload` the
  roadmap first planned);
- the pre-paint script also sets `<meta name="theme-color">`, so a phone's status bar is right
  from the first frame. Its id-to-colour map duplicates `THEMES`; `theme-prepaint.test.ts`
  checks they agree.

`themeAssetsReady(theme)` says whether a lazy theme's stylesheet has settled; the Ring waits
for it before measuring the feed's type, and gives up waiting after a few seconds rather than
leaving the feed empty.

## Tests

- `theme-palettes.test.ts` parses every theme file and checks text pairs (4.5:1 on the page
  and on fields), on-accent text, highlight text, the HP ramp's order and steps, and each meter
  stop on its track (blending translucent colours over the page). Pairs that the dark themes
  failed before 46a, and that could not change without changing those themes, are listed in
  `KNOWN_FAILURES` with their ratios; the test fails if one of them starts passing. Millefleur
  has none. High-contrast blocks are split out and checked as their own palettes.
- `theme-prepaint.test.ts` runs the inline script in jsdom (including storage that throws and
  an unknown id) and checks the first-paint stub against the chunk.
- `useTheme.test.ts` and `useTheme-lazy.test.ts` cover switching, the theme-colour meta,
  blocked storage and the lazy import.
- jsdom does no layout. A visual change to a theme is checked in a real browser, before and
  after, for every theme it could touch (bug 210).

## Adding a theme

1. Add it to `THEMES` (with `themeColor`) and to the pre-paint map in `index.html`.
2. Set every colour token; run the palette test and fix what fails rather than adding to
   `KNOWN_FAILURES`.
3. Light, or with its own stylesheet and fonts? Follow the two sections above.
4. Give the desktop header's theme button an icon (`THEME_ICON` in `AppShell.tsx`).
5. Check it in a browser at 390 and 1440 against its design, and the other themes before and
   after if any shared rule changed.

A theme with a design of its own keeps that design in `docs/reference/` (as Millefleur does),
and how to read its mocks against the app is in its roadmap entry: restore what a mock left
out, keep what is right only for that theme, and backport what it did better.
