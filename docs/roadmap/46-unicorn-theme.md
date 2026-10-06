---
type: Roadmap
title: A unicorn theme for the web app
description: The plan to build Millefleur, the watercolour unicorn theme whose design is final, on the web theme system.
status: draft
audience: internal
tags: [roadmap, web, theme, design, unicorn, accessibility]
---
# 46: a unicorn theme (Millefleur)

**Status:** the design is final (approved by the owner 2026-10-06). **Pass 46a (tasks 1 to 3) is
in progress** (tasks 1 and 2 done) on `claude/unicorn-monster-cards-cigpmw`. This page is the build plan and the pass
record: the task table in §9 carries status and commits.

- **The design:** [Millefleur design system](../reference/millefleur/design-system.md), with
  [the brief and artist statement](../reference/millefleur/README.md), [the final
  screens](../reference/millefleur/samples/) and [process and learnings](../reference/millefleur/process.md).
- **The history:** [iteration archive](../archive/studies/millefleur-theme/README.md): four
  rounds, the paint and tab studies, the other directions, and the first written proposal
  (inspirations, licensing research, palettes), which this page used to hold.

## Decisions

From the owner's reviews of rendered screens, 2026-10-05 to 2026-10-06:

- **Direction and name:** Millefleur, a light watercolour theme. The binder, botanical marks,
  handwriting and stickers of the first concept were cut as "kitchen sink".
- **Type:** Nunito for the interface, JetBrains Mono kept for the feed and Console. No display
  serif, no title-bar face.
- **The System 7 nod:** shapes only: sloped folder tabs, a soft pinstriped title bar and a
  close box on sheets, and the double ring around the primary button.
- **Shine:** the five-wash holo gradient, static, on a short list of moments (design system).
  No animated foil.
- **The other directions:** Holo Folder's soft rainbow became the holo fade. Gloaming (a dark
  sibling) is not planned; the owner did not favour it. Dream Desktop becomes its own theme,
  [roadmap 47](47-dream-desktop-theme.md).
- **Still open:** whether a phone set to light mode should start on Millefleur (today every new
  player gets phosphor, `useTheme.ts`), and painted portraits for the Workshop (a separate art
  pass).

## Implementation brief

### 1. What the theme system has today, and what stops a theme like this

The facts below were checked against the code on 2026-10-05.

- **Themes are colour tokens.** `apps/web/src/hooks/useTheme.ts` lists four themes
  (`phosphor`, `amber`, `ember`, `street-fighter`) and sets `data-theme` on `<html>`;
  phosphor is the bare `:root`. `theme-phosphor.css` also defines `--font-family` (JetBrains
  Mono), `--font-size` 14px, `--line-height` 1.4, spacing, and `--crt-scanline-opacity: 0`.
  The other three files set only colours, apart from the Street Fighter theme, which adds Press Start 2P pane headers, text glows,
  a double card border, and scanlines at 0.12 (`effects.css`).
- **Shape is not a token.** Almost nothing declares a radius (the scrollbar thumb is
  explicitly `0`; a few 2 px, 6 px, 50% and 999 px exceptions in `terminal.css`). Borders
  are 1 px literals. There are no shadows beyond two inset accent lines. A rounded theme
  either overrides dozens of selectors or adds tokens first.
- **One font token serves both the feed and the chrome.** `--font-family` is used 22
  times across the stylesheets and components.
- **The feed depends on monospace metrics.** `apps/web/src/utils/feed-row-height.ts`
  books unmeasured rows assuming 14 px × 1.4 lines and `FEED_CHAR_PX = 8.4` (JetBrains Mono's
  advance). Card frames in the feed are ASCII rules (`=====`, `-----`) inside a fence. A
  proportional feed font would break both: frames would go ragged, and wrong row guesses
  would make the viewport jump (bugs #196 and #159 in
  [10b](10b-bugs-fixed.md)). **So the feed must stay monospace, at a 0.6 em advance.**
- **`prefers-contrast: more` assumes a dark theme.** `base.css` sets `--color-bg: #000`,
  `--color-fg: #fff` and three more tokens on `:root`. It loads after the theme files with
  equal specificity, so it wins. Under a light theme it leaves `--color-input-bg` white
  under white text: **panels and the feed's card frames become unreadable.** This is a
  blocker.
- **Light-theme health bar.** The palette test requires healthy to be the *brightest*
  stage and every stage to be ≥ 3:1 against the background. On a light page that means a
  mid-tone healthy (Millefleur's is 3.71:1), so the bar cannot be pastel. That is fine, but
  `terminal.css` also uses the HP tokens as **text** colours in the highlight tags
  (`.event-highlight-nat20 .highlight-tag` and the crit-fail tag), where 3.71:1 is under the
  4.5:1 that small text needs. These need their own text-safe tokens.
- **Tracks use the border colour.** `.roster-bar-track` is `var(--color-border)`. With
  Direction C's ink border the critical fill would sit at 1.29:1 on its track. A
  `--color-meter-track` token fixes this (Millefleur `#ece2f5`: healthy 3.14, hurt 4.39,
  critical 10.64).
- **Text on accent uses `--color-bg`** (`.terminal-tab-badge`). This works in every
  palette here (Millefleur 6.82) but should be a named `--color-on-accent`.
- **Tokens used but never defined.** `--color-bg-elevated` (`CatchUpBanner.tsx`,
  `.fight-log-card`), `--color-hover` (`CommandReference.tsx`), `--color-accent-muted`
  (`LeaderboardPanel.tsx`, falling back to a yellow `rgba(255,200,0,0.15)`),
  `--color-warning` (`terminal.css`) and `--font-mono` are read with fallbacks, but no theme
  sets them. In a pastel theme the yellow fallback would show up off-palette.
- **Hard-coded dark-theme colours:** the menu backdrop `rgba(0,0,0,0.7)` (`AppShell.tsx`),
  the command reference backdrop `rgba(0,0,0,0.5)`, a danger panel border
  `rgba(255,107,107,0.3)` (`RoomSettingsView.tsx`), the error and success tints in
  `base.css`, the team pips in `terminal.css`, and the error boundary's fallbacks in
  `main.tsx`. Backdrops are fine on light; the tints and pips need checking.
- **Inline header styles.** The app header's height, border and padding are an inline
  `style` in `AppShell.tsx`, so a theme cannot restyle the header without `!important`.
  Move them to a class first.
- **The first paint is always phosphor black.** `applyTheme` runs in a React effect, after
  first paint, and `index.html` hard-codes `<meta name="theme-color" content="#0a0e0a">`.
  With a light theme that is a black flash on every load and a black phone status bar.
  No stylesheet sets `color-scheme`, so native controls and scrollbars never match a theme.
- **The sprite hit flash paints white.** `animations/pixel-fight/renderer.ts` fills every
  pixel, outline included, with `#ffffff` for 130 ms. On a white panel a struck monster
  **vanishes** instead of flashing. `appearance-palette.ts` also notes it keeps bodies
  "clear of the near-black backgrounds every theme uses". That is no longer true with a
  light theme; the pale Unicorn (`#f7f5ff` lit body) relies on its outline alone.
- **Small copy bits (fixed with this proposal, bug 230).** The Account page called the
  setting "Terminal theme"; it is now "Theme". The desktop theme button's `title` and
  `aria-label` used the theme's *id* ("street-fighter"); they now use its name. The icon map
  (`THEME_ICON`) still needs an entry per theme.
- **No architecture doc for themes.** Nothing under `docs/architecture/` describes the theme
  system; this pass should add one.

### 2. Tokens to add

Every theme gets these, with defaults that reproduce today's look exactly, so the plumbing
PR changes no pixels in the four existing themes.

| Token | Default (today) | Millefleur |
|---|---|---|
| `--font-ui` | `var(--font-family)` | `'Nunito', system-ui, sans-serif` |
| `--font-mono` | `var(--font-family)` | `var(--font-family)` (JetBrains Mono, unchanged) |
| `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-pill` | `0` / `0` / `0` / `999px` | `6px` / `12px` / `24px` / `999px` (card 16px, slot 13px) |
| `--border-width` | `1px` | `1px` |
| `--color-border-strong` | `var(--color-border)` | `#8f7cbc` (`--mf-line-control`: fields and secondary buttons, 3.6:1) |
| `--shadow-page` | `none` | `0 14px 34px rgb(110 85 150 / 0.08)` |
| `--surface-texture` | `none` | the screen's baked watercolour WebP plus the grain tile (§5) |
| `--surface-titlebar` | `none` | the pinstripe gradient (sheets and dialogs only) |
| `--holo` | `none` | the five-wash gradient, on the moments the design system lists only |
| `--surface-page` | `var(--color-bg)` | `--mf-page` (translucent paper, design system) |
| `--color-meter-track` | `var(--color-border)` | `rgb(190 170 215 / 0.28)` |
| `--color-on-accent` | `var(--color-bg)` | `#ffffff` |
| `--color-highlight-good` / `-warn` | `var(--color-hp-healthy)` / `var(--color-hp-hurt)` | `#1f6b57` / `#8a2a5e` (text-safe, ≥ 4.5) |
| `--color-sprite-flash` | `#ffffff` | `#ff9fd2` (a pink flash that keeps the outline) |
| `--color-backdrop` | `rgb(0 0 0 / 0.7)` | `rgb(75 58 110 / 0.16 → 0.3)` (a top-to-bottom gradient) |
| `--color-bg-elevated`, `--color-hover`, `--color-accent-muted`, `--color-warning` | define in every theme (they are read today but never set) | `#ffffff`, `#f6ecfc`, `#efe4ff`, `#8a5a00` |
| `--wash-lilac`, `--wash-seafoam`, `--wash-blush`, `--wash-butter`, `--wash-sky` | `transparent` | the tints in the design system |
| `color-scheme` (property, not token) | `dark` | `light` |

Every colour value for Millefleur is in the [design system](../reference/millefleur/design-system.md#colour)
with its contrast ratios. The extended test in task 1 keeps them there.

### 3. Fonts

All candidates were checked on npm (`@fontsource/*`, version 5.3.0). Sizes are the latin
`woff2` subset. Fontsource CSS registers faces with `unicode-range`. A browser downloads a
face only when text uses it, so **players on other themes download no font files.** The
Fontsource CSS itself is loaded with the theme's lazy chunk (§4), not from `main.tsx`, so it
does not grow the shared stylesheet either.

| Role | Face | Licence | Latin woff2 |
|---|---|---|---|
| Interface | **Nunito** 400, 600, 700, 800 | OFL-1.1 | about 16 KB each |
| Feed and Console | **JetBrains Mono**, unchanged | OFL-1.1 | 0 KB (already loaded) |

Decided in the design rounds: two faces only. Fraunces (display), a title-bar face (Pixelify Sans
or ChicagoFLF) and Recursive Mono Casual were all tried or proposed and dropped as clutter; the
System 7 nod lives in shapes, not type. The archived [first proposal](../archive/studies/millefleur-theme/first-proposal.md)
keeps their licence research.

**Budget:** Nunito ×4 ≈ 65 KB, fetched only under Millefleur. Preload Nunito 400 when the
theme is active; load the rest with `font-display: swap`. The feed font does not change, so
font loading cannot move the feed.

### 4. Files to touch

| File | Change |
|---|---|
| `apps/web/src/styles/theme-millefleur.css` (new) | All colour tokens (the palette test's required list), the new tokens, and theme-scoped surface rules |
| `apps/web/src/styles/base.css`, `terminal.css` | Replace literal radii, border widths and shadows with tokens (defaults preserve today); split `--font-family` uses into feed (`--font-family`) and chrome (`--font-ui`); meter tracks to `--color-meter-track`; highlight tag text to `--color-highlight-*`; badge text to `--color-on-accent`; make the `prefers-contrast: more` block complete per theme (light themes get their own high-contrast block) |
| `apps/web/src/styles/effects.css` | Nothing: `--crt-scanline-opacity: 0` already turns the scanlines off, and Millefleur has no page animation |
| `apps/web/src/hooks/useTheme.ts` | The `THEMES` entry; set `<meta name="theme-color">` and `color-scheme` in `applyTheme` |
| `apps/web/index.html` | A small inline script that reads `deck-monsters-theme` and, before first paint, sets `data-theme` **and** updates `<meta name="theme-color">` from a tiny id → colour map (guarded with try/catch, as `localStorage` can throw). `applyTheme` only runs after React mounts, so leaving the meta to it would keep a black status bar through first paint (Codex on #426) |
| `apps/web/src/themes/millefleur.ts` (new) | Loaded with a dynamic `import()` from `applyTheme` the first time Millefleur is chosen: it brings `theme-millefleur.css` and the `@font-face` CSS. A static import in `main.tsx` would put those rules in the shared bundle for every player (Codex on #426); the font files themselves only download when a rule uses them |
| `apps/web/src/styles/base.css` (first-paint block) | **A lazily loaded theme still needs its first frame.** For a returning player the pre-paint script sets `data-theme="millefleur"` before React runs, but the lazy chunk arrives later, so without help the first paint uses phosphor's tokens: a dark flash instead of a black one. Keep a tiny `[data-theme='millefleur']` block in the shared CSS with only `--color-bg`, `--color-fg`, `--color-input-bg`, `--color-border` and `color-scheme: light` (well under 1 KB), and have the pre-paint script add a `<link rel="modulepreload">` for the chunk so it starts downloading at once. The page then paints as plain paper and ink, and the textures and fonts arrive with the chunk |
| `apps/web/src/components/AppShell.tsx` | Header inline styles to a class; `THEME_ICON` entry (🦄); backdrop to `--color-backdrop` |
| `apps/web/src/animations/pixel-fight/renderer.ts` | Flash colour from a parameter, read once from `--color-sprite-flash`; keep the outline key (`O`) unflashed |
| `apps/web/src/__tests__/theme-palettes.test.ts` | Extend: fg-dim, accent, system, error and success ≥ 4.5 on bg **and** input-bg; on-accent ≥ 4.5; meter fills ≥ 3 on their track; highlight text tokens ≥ 4.5 |
| `apps/web/src/__tests__/useTheme.test.ts` | The new id; meta theme-color updates |
| `docs/architecture/web-themes.md` (new) | How themes work, the token contract, what a light theme must define, and the "why" of each rule above. Link it from `AGENTS.md` and `docs/README.md` |
| `docs/reference/help-inventory.md` | The theme setting's label, if it changes |

### 5. Textures and motion

- **Watercolour:** the [paint recipe](../reference/millefleur/tools/paint.svg) (two wash
  filters, glazed with multiply) is for authoring, not runtime. Bake each composition once to a
  WebP at 2× (one per surface family: Workshop, Ring, Chat, sheets) and use it as the
  surface's background. **Never run these filters live** or apply `filter: url(#…)` to the feed
  scroller: they repaint on every scroll frame.
- **Paper:** the fibre and grain as one small tiled WebP (256 px), multiplied over the page.
- **Translucency:** pages and cards are translucent paper (`--surface-page`), so the paint
  shows through. No `backdrop-filter`.
- **Pinstripes:** `repeating-linear-gradient(to bottom, rgb(70 50 110 / .22) 0 1px, transparent 1px
  3px)`, fading at both ends, behind the title of sheets and dialogs only.
- **Holo:** the five-wash gradient, static, only where the design system lists it.
- **Motion:** none on the page. Sheets slide up as today; the Workshop peek (#224) is
  unchanged.

### 6. Pixel monsters in a soft theme

Keep them pixelated. [Pixel art](../reference/pixel-art.md) forbids smoothing, and a
pixel sprite is the theme's own Kare nod. Give them the **halo** (design system) instead of a
CRT treatment:

- The portrait sits in the halo: a blurred ring of the holo gradient around a pearl disc. A
  soft drop shadow (`drop-shadow(0 2px 3px rgb(110 85 150 / .35))`) on `.roster-sprite` and
  `.inline-sprite` lifts the sprite off the paper. Check at 1×, 2× and 3×, as
  [the roster doc](../architecture/ring-roster-and-pixel-monsters.md) asks of every theme.
- The hit flash in `--color-sprite-flash` (pink) with the outline kept dark, so a struck
  monster blinks rather than disappears.
- Check the palest bodies on paper: the Unicorn (`#f7f5ff`), the Weeping Angel
  (`#f4f0ff`), and any monster whose owner typed "white" or "ivory". The outline key
  carries them. If one reads weak, the soft lift and the halo's pearl disc are the fix; do not change species
  palettes per theme (#164 spaced their ramps by hand).

### 7. Accessibility and checks

- **Contrast:** every text pair in the [design system](../reference/millefleur/design-system.md#colour)
  is ≥ 4.5:1 on paper, page and the rose tab. The extended test (task 1) enforces this for all
  themes.
- **Non-text:** fields and secondary buttons use `--color-border-strong` (`#8f7cbc`, 3.6:1).
  Card, slot, tab and page edges are decorative; the controls are identified by their labels.
- **High contrast:** under `prefers-contrast: more`, Millefleur drops textures, holo and
  washes, goes to `#ffffff` / `#000000` with a 2 px black border, and keeps its radii.
- **Reduced motion:** nothing on the page moves anyway; sheets appear without sliding.
- **Colour is never alone:** the selected tab is also taller and joined to the page; card
  roles carry their word beside the dot; HP stages differ in luminance.
- **Focus:** a 2 px `--mf-rose` ring (6.7:1) with a 2 px offset.
- **Live checks:** 390 × 844 and 1440 × 900 in a real browser (jsdom lays nothing out; bug
  210), compared side by side with the [samples](../reference/millefleur/samples/). Screens: Ring mid-fight with a boss, Console with a prompt open, Workshop with three
  monsters (carousel), the card detail sheet, the level-up sheet, the Train wizard, Chat,
  Help, Leaderboard, Account. Throttle to Fast 3G once and scroll the Ring's history to
  catch font-swap jumps. Record frame timings while a fight scrolls on a mid-range phone
  profile (no long frames from blend modes or filters).

### 8. Performance budget

| Item | Budget |
|---|---|
| Fonts (only under this theme) | ≤ 70 KB latin, one preloaded |
| Textures | Four baked watercolour WebPs ≤ 40 KB each, one grain tile ≤ 10 KB, all in the lazy chunk |
| CSS | `theme-millefleur.css` ≤ 12 KB unminified |
| Other themes | No font or texture bytes. Millefleur's CSS and `@font-face` rules are a separate chunk loaded by dynamic `import()`; the shared bundle grows only by the `THEMES` entry, the pre-paint colour map, and the first-paint block (< 1 KB, §4). Pixel-identical before and after task 1 |
| Runtime | No `backdrop-filter`, no live SVG filters, no blend modes on scrolling rows; no layout shift (the feed font is unchanged) |

### 9. Task table

Two passes, so each PR stays at three or four tasks (see
[subagents budget](../agents/subagents.md#budget)). Tasks 1 and 2 must land first; the
rest can run in parallel only where noted.

| # | Pass | Task | Area / files | Acceptance | Can run beside | Status | Commit |
|---|---|---|---|---|---|---|---|
| 1 | 46a | **Theme plumbing, no visual change.** Shape, font, shadow, surface, meter-track, on-accent, highlight-text, backdrop and sprite-flash tokens with defaults equal to today; define the read-but-unset tokens in all four themes; `color-scheme`; pre-paint `data-theme` and `theme-color`; per-theme `prefers-contrast`; the header class; theme button label by name; extended palette test | `styles/*.css`, `useTheme.ts`, `index.html`, `AppShell.tsx`, `theme-palettes.test.ts`, `useTheme.test.ts`, `renderer.ts` (flash parameter) | Four themes pixel-identical at 390 and 1440; the extended palette test passes for all four; no black flash on a light theme in a smoke test | docs-only work | done | 673779d8, 0c11a733, and the checkpoint after |
| 2 | 46a | **Millefleur palette, type and components.** `theme-millefleur.css`, `THEMES` entry and icon, Nunito (the feed keeps JetBrains Mono), radii, buttons, fields, cards, banners; the lazy-loaded chunk, the first-paint block and the modulepreload, with a bundle check that other themes' CSS grew by under 1 KB | `theme-millefleur.css`, `themes/millefleur.ts` (lazy chunk), `base.css` (first-paint block), `index.html`, `useTheme.ts`, fonts and `OFL.txt` | Palette test green; card frames unchanged; a reload on Millefleur shows no dark frame; check at 390 and 1440 against the samples | — (after 1) | done | 21e639d9, 293590fa |
| 3 | 46a | **Millefleur surfaces.** Folder tabs joined to the page, the page and card, the halo, card slots with painted role dots, meters, the ruled Chat log, the Ring transcript, sheets with the painted header, soft title bar and close box, carousel dots | `theme-millefleur.css`, small class hooks in `terminal.css`/`base.css`, the tab markup in the workspace | Each surface matches the design system and samples, rendered side by side; tap targets unchanged | 4 if 4 avoids the same selectors | done | 66fde141, ca0eca5d, 2252866a, 7f84c2f9, 8353b11a |
| 3b | 46a | **Fidelity to the mocks.** The owner compared the app with the approved mocks at the same scale and found many differences (2026-10-06). Header spacing; the Ring's header, roster rows, card-frame tint and boss-arrival card; the Workshop's portrait, type, meters, slot ⓘ, heading count; Chat anchored to the bottom; the level-up badge, title and chips | `theme-millefleur.css`, small Millefleur-gated hooks in `RingPane`, `RingRoster`, `MonsterWorkshopPanel`, `WorkshopPanel`, `ChatPanel`, `LevelUpSheet` | Each screen beside its mock at 390 × 940 (`fid.mjs`) matches within reason; dark themes unchanged | — | done, in review | d2c8d594, 5c5352ae, a831d675, 8746fcba, c98f4c42 |
| 3c | 46a | **Theme-aware feed metrics.** Row-height estimates read the feed's type from CSS, so Millefleur's transcript can be 12.5 px on a 1.65 line as designed | `feed-row-height.ts`, `RingPane.tsx`, feed CSS tokens | Dark themes' estimates identical; no scroll jumps (#196) or lost bottom pin (#159) in a live scroll test under both themes | — (after 3b) | done | 408ff656, 8e77ff57 |
| 3d | 46a | **Backport what the mock did better.** Remove the Millefleur gate from the case-3 changes (see *Reading the mocks*) and style them for the four dark themes | the components above, `base.css`, `terminal.css` | A deliberate, reviewed change in the dark themes, compared before and after | — (after 3b) | proposed | — |
| 4 | 46a | **Paint and paper.** Bake the watercolour compositions and the grain tile; wire `--surface-texture`; holo only where listed | WebP assets in the lazy chunk, `theme-millefleur.css` | Budget in §8 met; no long frames while a fight scrolls | 3 (different selectors) | done | 795888c3, cc7e5a3d |
| 5 | 46a | **Pixel monsters on paper.** The halo, the soft lift, the pink hit flash; check pale species and white appearances at 1×/2×/3× | `terminal.css`, `renderer.ts`, `rosterSprite`/pixel tests | Struck monsters visibly flash; pale monsters read on paper; nothing smoothed | 4 | proposed | — |
| 6 | 46a | **Live check and docs.** Cursor-style checklist for the screens in §7; `docs/architecture/web-themes.md`; links from `AGENTS.md` and `docs/README.md`; roadmap status | docs | Check passed or findings filed in 10 | 4, 5 | proposed | — |
| 7 | 46a | **Structured feed lines from the engine.** Every feed announcement also publishes `payload.lines`: clean single lines, each with a `kind` and its facts (round, actor, card, roll, damage, HP). `text` stays byte-for-byte (Discord sends it verbatim; pacing sizes pauses from it) | `packages/engine/src/announcements/*`, `events/types.ts`, `helpers/card.ts`, `ring/index.ts` | A consistency test keeps `lines` equal to `text` without its layout; engine, server and Discord tests green | 3d | in progress | — |
| 8 | 46a | **The feed rendered from lines.** The web draws `lines` when present (falling back to `text` for older events), with spacing from CSS rather than baked whitespace; Millefleur restyles or replaces lines by kind (the round as a divider, a play's card name, the roll as a quieter second line); row-height guesses count lines | `RingPane`, `ConsolePane`, `format-event-text`, `feed-row-height.ts`, theme CSS | Live scroll test clean under every theme; each feed screen beside its mock | — (after 7) | proposed | — |
| 9 | 46a | **Flavour.** New narration in the house voice where the mock found room for it (arrivals, the crowd, fight openings), per `voice-and-wording.md`, in `text` and `lines` both | engine announcements, strings inventory | Owner reviews the lines | 8 | proposed | — |

### Reading the mocks

The owner's rule for every difference between the app and the mocks (2026-10-06): **matching the
mock and the brief is paramount**, and this theme may feel unlike the others (its pale lines are
the point; high contrast and the other themes serve people who need hard edges). Each
difference falls into one of three cases:

1. **The mock left out something the app needs.** Restore it in the design's language: the ⚙
   room settings link, surface subtitles (in-game help), the Train button, the roster's owner,
   level and AC, the BOSS pill and collapse toggle, presets, the card ⓘ, the feed's ASCII card
   frames (Discord shares them), the feed markers.
2. **The mock differs from the other themes, and that is right for this theme.** Millefleur
   only: folder tabs, washes, the halo, role dots, pill meters, ruled Chat paper, the 12.5 px
   transcript, the rose boss card, painted sheets, the pale lines.
3. **The mock found something better for every player.** Build it here first, then backport it
   (task 3d): a portrait of the monster in the Workshop; new cards as chips in the level-up
   sheet; the level badge and a "Level up" title; the card ⓘ in the slot's corner on phones;
   "You can train N more" beside the heading, with Train as the primary action only until the
   player has a monster; Chat anchored to the bottom with message times; the Ring header's meta
   as one group.

Two candidates were tested and set aside, both for reasons already in the code's history:

- **The card ⓘ in the slot's corner on phones.** The phone strip exists because a corner badge
  overlapped the card and swallowed drops (pass 44). Built again and measured with touch
  emulation on 83 px slots: a 44 px corner target covers the slot's centre, top and right
  edge, so the most natural tap opened the card's details instead of selecting it. Millefleur
  keeps the strip as the tile's quiet footer (case 1). Drops now land on the whole tile in every
  theme, the ⓘ included, because the drop handler moved from the slot button to its cell.
- **One line per roster entry** (portrait, name, bar, figure). Bug 169 gave the name line the
  row's width, with the figure and bar in a narrow right rail, so generated boss names stay
  whole (the narration uses them in full). With the bar in the middle, a long boss name broke
  mid-word over four lines at 390 px and the AC fell off the meta line. Millefleur restyles the
  rows and keeps their layout (case 1); the ▶ turn marker stays beside the turn wash.

**One PR.** The owner asked for everything about this theme, with the small fixes found along
the way, in a single PR, however large (2026-10-06): every task in the table ships together as
pass 46a, including what was planned as 46b. Dream Desktop (roadmap 47) is out of scope.

**The transcript.** Beside the mock, the Ring's transcript differed most: the mock's author wrote
flavour, swapped round announcements for dividers, and spaced lines evenly. The engine's text
still carries the Slack era's layout (indents, blank lines, ASCII rules) and bundles several
lines per event. The owner's plan (2026-10-06): structured lines with metadata from the engine
(task 7), browser-controlled spacing and per-kind styling or judicious replacement in the
renderer (task 8), and new flavour (task 9). Discord keeps the text it has today.

### Pass 46a record

- **Pixel check for task 1.** The four existing themes were compared screen by screen against
  `main` in Chromium (390 × 844 and 1440 × 900; Ring and Console, Workshop, Chat, Fights,
  Leaderboard, Account, Help, Rooms) on the local app, two Vite servers side by side. The only
  differences were intended: the stray feed marker (bug 231), and native controls drawn dark
  under `color-scheme: dark` (bug 232). Everything else was pixel-identical.
- **Palette test exemptions.** The extended contrast rules fail some pairs in today's dark
  themes (phosphor and amber `fg-dim` and `system`, Street Fighter's accent at 3.99:1, and
  every theme's critical HP against its track). Fixing them would change those themes, so the
  test lists them in `KNOWN_FAILURES` (it fails if one starts passing). Millefleur has none.
  Raising them is a follow-up for a later pass, not part of this theme.
- **Task 2.** Millefleur's lazy chunk is 10.6 KB of CSS plus Nunito 400/600/700/800 (about
  16 KB each); the shared CSS grew by under 1 KB (the first-paint stub and the new class hooks).
  HP ramp on paper: healthy `#2a8570` (gradient from `#2c8873`), hurt `#964214`, critical
  `#7a1838`, 3.40 to 8.24:1 on the track. The palette test is now direction-aware: on a light
  ground, contrast with the ground rises as health falls. `--color-danger-border` keeps the
  dark themes' danger panel identical. Reviewed; the fix round closed six should-fix findings.
- **Feed metrics stay put.** The design system sets the transcript at 12.5/1.65, but the Ring and
  Console feeds book row heights in JS from 14px × 1.4 (`utils/feed-row-height.ts`, bugs 159
  and 196). Millefleur restyles the feed's colours, separators and tags only, never its font
  size, line height or horizontal padding.
- **Deviation from §4:** the pre-paint script cannot name the lazy chunk (its file name is
  hashed), so instead of a `modulepreload` the chunk's import starts at the top of `main.tsx`,
  before React renders, whenever `data-theme` is already `millefleur`.

