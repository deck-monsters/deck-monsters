---
type: Roadmap
title: A unicorn theme for the web app
description: Proposal for a pastel, watercolour, Trapper Keeper and classic Mac OS theme to go with the Unicorn, with researched inspirations, three directions, checked palettes, and a task plan.
status: draft
audience: internal
tags: [roadmap, web, theme, design, unicorn, accessibility]
---
# 46 — A unicorn theme

**Status:** Proposed (2026-10-05). Nothing is built. The owner picks a direction (or the
recommended blend) and a name, then this becomes a two-pass plan (46a, 46b) with the task
table at the end.

**Owner's request (2026-10-05):** "a new theme that goes with the new unicorn monster. I'm
thinking 90s trapper keeper, rounded edges and gradients and pastels and beautiful water
colors and textures, more of a departure from the terminal aesthetic than any other theme
though a bit of a nod could be nice, maybe macOS 6 or 7 rather than dos/cli, Lisa frank,
'the last unicorn', etc. … this should be really beautiful and more feminine."

## 1. Summary

Every theme today is a phosphor screen in a different colour: dark background, one bright
ink, monospace type, square boxes, optional scanlines. This theme is the first one that is
**not a screen at all**. It is a page: watercolour paper, soft lilac and sea-foam washes,
rounded windows, a puffy sticker here and there, and a sheen of holographic foil saved for
the moments that matter (a natural 20, a level-up, the tab you are on).

The nod to the computer is still there, but it is a **Macintosh, not DOS**: pane headers drawn
as System 7 title bars, with pinstripes and a centred title. The feed and the Console keep a
monospace font, but a soft, gel-pen one, so the card frames still line up.

**Who it is for:** players who find the terminal look cold or "for someone else". The owner
wants it feminine and beautiful, and wants it to read as a choice in its own right, not a
light mode. It also suits the game's own Unicorn, who is gentler and stranger than the
inspirations (see §2.1).

**Goals**

1. Beautiful on a phone first (390 × 844), still lovely at 1440 × 900.
2. The biggest departure from the terminal of any theme: light, rounded, textured,
   proportional type in the chrome.
3. A light nod to classic Mac OS (System 6/7, with a touch of Platinum), not to the CLI.
4. No borrowed art. Lisa Frank, *The Last Unicorn*, and Apple are inspiration only.
5. It meets the bar the dark themes meet: the palette test, WCAG AA text, a health bar
   that reads without colour, reduced motion, high contrast, and no layout shift in the feed.
6. It costs the other themes nothing: no new bytes unless a player chooses it.

## 2. Inspiration board

### 2.1 The game's own Unicorn (the brief starts here)

`packages/engine/src/monsters/unicorn.ts` and the [Unicorn strings](../reference/strings/unicorn.md)
show that this Unicorn is not a sparkly pony. It is a bestiary animal that no two witnesses
agree on: Pliny's "most fell and furious beast", Ctesias's white body with a dark-red head
and a horn banded white, crimson and black, Marco Polo's "passing ugly beast". You find it
"in your garden, eating your roses", "asleep in your hayloft", its horn "tasted a little like
a candy cane". Its cards are Sticketh, Horn of Proof, Unconquerable Horn, Dissonant Voice and
Gloaming Rest. The pixel sprite (`apps/web/src/animations/pixel-fight/sprites.ts`) is a pale
coat with a lavender shadow (`#cfc8ec`, `#8f84bd`), an ivory horn (`#fde9a8`), and dark-blue
eyes.

**What the theme takes:** that same joke, sweetness with a wink. The look is a
schoolgirl's dream of a unicorn, and the copy stays what it is: an old book with a beast in
your back garden. The motifs come from the Unicorn's own details:

- **Roses and a scatter of small flowers** (the garden it raids; the millefleurs of the
  tapestries, §2.4).
- **A spiral horn** as the striped fill of the XP meter: ivory and pearl in a twist. It is
  the candy cane of the horn oddities.
- **Pomegranate and crimson** for danger and critical HP: the tapestry unicorn's red
  stains, and Ctesias's crimson horn tip.
- **Dusk lilac** for the dark sibling (§3.2): the gloaming it rests in.

### 2.2 Lisa Frank and the 90s Trapper Keeper

- [Lisa Frank (Wikipedia)](https://en.wikipedia.org/wiki/Lisa_Frank): rainbow and neon
  colours, stylised airbrushed animals (dolphins, pandas, unicorns). The products were
  school supplies, Trapper Keepers and stickers. The brand peaked in the 1990s
  ([Click Americana](https://clickamericana.com/topics/featured/vintage-lisa-frank)). The
  characters include Markie the Unicorn and the leopard Hunter
  ([Primo Water blog](https://blog.primowater.com/lisa-frank-facts)). Many stickers were
  glitter and holographic.
- [Trapper Keeper (Wikipedia)](https://en.wikipedia.org/wiki/Trapper_Keeper) and
  [Mental Floss](https://www.mentalfloss.com/article/52726/history-trapper-keeper): Mead,
  1978. A wrap-around flap with a Velcro closure. 1988–1995 "Designer Series" covers had
  abstract and later computer-generated designs. Mead also licensed Lisa Frank.
- Sticker culture: puffy, prismatic, scratch-and-sniff, and Mrs. Grossman's stickers by
  the yard ([Click Americana](https://clickamericana.com/toys-and-games/vintage-stickers-from-the-80s)).

**Borrow:** the airbrush gradient (soft multi-stop, no hard edges), a rainbow ramp used as
an *edge* (the folder's binding), holographic foil as a material for special moments, the
die-cut white border and soft drop shadow of a puffy sticker, and the flap with its strap:
the bottom sheet's grab handle as a Velcro tab.

**Do not copy:** any Lisa Frank character, pattern, or lettering; the leopard spots;
"Lisa Frank" in any player-facing text. The brand is protected and its owners enforce it.
And **do not use neon at full saturation.** The owner asked for pastels. We take the
gradient technique and the foil, not the fluorescent palette.

### 2.3 *The Last Unicorn* (1982)

- [The Last Unicorn (film), Wikipedia](https://en.wikipedia.org/wiki/The_Last_Unicorn_(film)):
  Rankin/Bass, animated by Topcraft, the Japanese studio whose staff went on to Nausicaä and
  Studio Ghibli. The art design draws on the medieval Unicorn Tapestries, and the opening
  credits redraw images from *The Hunt of the Unicorn*.
- [Animation Obsessive, "The Making of The Last Unicorn"](https://animationobsessive.substack.com/p/the-making-of-the-last-unicorn):
  Tsuguyuki Kubo shaped the look; 75,000 drawings and 260 colours.
- [HCF Rewind](https://horrorcultfilms.co.uk/2011/07/hcf-rewindthe-last-unicorn-1982/) and
  [Alternate Ending](https://www.alternateending.com/2016/06/19/when-the-future-has-past-without-even-a-last-desperate-warning/):
  backgrounds described as "Disney mattes filtered through the emerging anime style", with
  stamping. The deep blue skies are often compared to Nausicaä. The Red Bull is "dark red
  and orange" against the unicorn's pale light.

**Borrow:** soft painted backgrounds with visible paper; a muted palette of lilac, silver,
sea-foam and night blue; the unicorn as the lightest thing in the frame; one hot, dark red
(the Bull) kept for danger only. In UI terms, the whole palette stays cool and soft so
that red means something.

**Do not copy:** Amalthea's design, film stills or frames as textures, the title lettering,
or any character likeness. The film and its designs are under copyright.

### 2.4 The Unicorn Tapestries (c. 1495–1505), public domain

- [The Unicorn Tapestries (Wikipedia)](https://en.wikipedia.org/wiki/The_Unicorn_Tapestries):
  seven tapestries, Southern Netherlands, now at The Cloisters. The *millefleurs* ground
  shows more than a hundred plants, 85 of them identified. In *The Unicorn in Captivity*
  (*The Unicorn Rests in a Garden*) the red marks on the white unicorn are pomegranate
  juice, not blood.
- The Met's Open Access programme releases public-domain images for unrestricted use
  ([Met object 467653](https://www.metmuseum.org/art/collection/search/467653), *The Unicorn
  Surrenders to a Maiden*). Before using any image, check that its object page shows the
  Open Access / Public Domain badge. The Met site could not be opened from this session.

**Borrow:** this is the source *The Last Unicorn* itself drew from, and it is free to
use. Take the millefleurs as a scattered motif (we draw our own five-petal flowers as tiny
SVG; we don't ship photographs), the circular fence as a frame idea for the empty
Workshop, and pomegranate red. The film can only be an inspiration; the tapestries are a
source we may use.

### 2.5 Classic Mac OS: System 6, System 7, a touch of Platinum

- [Chicago (typeface)](https://en.wikipedia.org/wiki/Chicago_(typeface)) and
  [Smithsonian on Susan Kare](https://www.smithsonianmag.com/innovation/how-susan-kare-designed-user-friendly-icons-for-first-macintosh-180973286/):
  Chicago (1984) was the bold system font, used in the Mac interface from 1984 to 1997.
  Kare limited its strokes to vertical, horizontal and 45°, with nine-pixel capitals, and
  drew icons on 16 × 16 and 32 × 32 grids in black and white.
- *Macintosh Human Interface Guidelines*, window anatomy (via
  [Apple developer archive](https://developer.apple.com/library/archive/documentation/mac/Toolbox/Toolbox-191.html)):
  title bar, close box, zoom box, size box, scroll bars. On colour screens "the racing
  stripes in the title bar and the scroll bars are gray", and the controls are tinted so
  they stand out.
- [Mac OS 8 Appearance Manager](https://system7today.com/appearance): Platinum, a
  greyscale 3D look, which System 7.1–7.6 machines could also install.
- [system.css](https://changelog.com/news/lOAY), an open-source CSS library modelled on
  System 6. It is useful as a reference for title-bar stripe spacing; we do not depend on it.

**Borrow:** the window. Pane headers become title bars with fine horizontal pinstripes on
either side of a centred title. Buttons become rounded rectangles; the primary action gets
the thick double outline of the System 7 default button. A 1 px ink outline frames each
window, with a hard 1–2 px drop shadow beneath it. A tiny dithered "desktop pattern" sits
behind the panes. The pixel monsters already carry the Kare spirit; keep them pixelated.

**Do not copy:** the Chicago font file, Apple icons (the Happy Mac, the Finder face, the
watch cursor), the Apple logo, or Platinum's exact bevel artwork. **Never draw a close
box where nothing closes.** A first-time player will press it (see
[player help](../../.cursor/skills/player-help-and-ux/SKILL.md)). Only real close
controls, such as the detail sheets' close button, get the close-box treatment, and they
keep their ✕ and their `title`.

### 2.6 Neighbours: Sanrio, holographic foil, and what is *not* 90s

- Sanrio's Little Twin Stars (1975): a soft pastel rainbow of pink, light purple, pale blue
  and yellow, blended smoothly, with stars and clouds
  ([Sanrio](https://corporate.sanrio.co.jp/en/business-info/brands/little_twin_star/),
  [Fun Japan](https://www.fun-japan.jp/en/articles/14555)). **Borrow:** the pastel rainbow
  order and its gentleness. This is the palette Lisa Frank's technique should be wearing.
- Holographic foil in CSS: Simon Goellner's
  [Pokémon card holo effects](https://poke-holo.simey.me/) and the
  [CSS-Tricks write-up](https://css-tricks.com/holographic-trading-card-effect/) layer
  linear, radial and conic gradients with `color-dodge` and `overlay` blend modes. We
  borrow the recipe on a much smaller scale (§4.5).
- Watercolour and paper in SVG: Sara Soueidan's Codrops series on
  [`feTurbulence`](https://tympanus.net/codrops/?p=37751)
  makes paper grain from fractal noise, and lighting turns it into rough paper.
- **Y2K is a different era.** Chrome, translucent "Frutiger Aero" glass, water droplets and
  McBling hot pink are late-90s to 2000s
  ([Frutiger Aero, Wikipedia](https://en.wikipedia.org/wiki/Frutiger_Aero),
  [daisyUI trends](https://trends.daisyui.com/trend/y2k/)). Keep them out. Our era is
  1988–1996: airbrush, foil, puffy stickers, the 1-bit Mac.

## 3. Three directions

All contrast ratios below were computed with the WCAG 2 relative-luminance formula that
`apps/web/src/__tests__/theme-palettes.test.ts` uses. **Panel** is `--color-input-bg`
(cards, panels, the card frame in the feed). **Sel** is `--color-choice-selected`. The HP
rows check the test's rules: luminance falls healthy → hurt → critical, each step ≥ 1.3:1,
and each stage ≥ 3:1 against `--color-bg`.

### 3.1 Direction A — "Holo Folder" (Trapper Keeper and stickers)

*The folder you were proud of on the first day of school.* Pearl-pink paper, a pastel
rainbow binding down the edge of every window, puffy stickers for chips and badges, foil
on anything special. The loudest of the three.

| Token | Hex | Role | on bg | on panel | on sel |
|---|---|---|---|---|---|
| `--color-bg` | `#fff6fb` | Pearl-pink page | — | — | — |
| `--color-input-bg` | `#ffffff` | Sticker-white panels | — | — | — |
| `--color-fg` | `#3d1f5e` | Grape ink, body text | 12.74 | 13.50 | 10.02 |
| `--color-fg-bright` | `#230f3d` | Deepest ink, emphasis | 16.42 | 17.40 | 12.92 |
| `--color-fg-dim` | `#6f4c8e` | Secondary text | 6.40 | 6.77 | 5.03 |
| `--color-accent` | `#b0166e` | Raspberry: links, timers, focus | 6.22 | 6.59 | 4.90 |
| `--color-system` | `#5a5c8c` | System lines | 5.93 | 6.28 | 4.66 |
| `--color-error` | `#b01230` | Errors | 6.66 | 7.06 | 5.24 |
| `--color-success` | `#0b6a50` | Success | 6.21 | 6.58 | 4.89 |
| `--color-border` | `#e3c4ee` | Soft lilac rule (decorative, 1.48) | | | |
| `--color-choice-hover` / `-selected` | `#fbe8ff` / `#f2d4fc` | | | | |
| HP healthy / hurt / critical | `#2a8f80` / `#b03f93` / `#741036` | Sea-foam → orchid → wine | 3.71 / 4.98 / 10.60 | steps 1.34, 2.13 | |

Decorative ramp (never behind small text): `#ff8fd0 #ffb38a #ffe680 #8ff0b8 #80d4ff #b59cff`.
The deepest ink stays ≥ 10.5:1 on every *pale* stop (`#ffb3de` … `#d4c4ff`), so a title
may sit on a washed-out version of the ramp.

- **Type:** Fredoka (rounded, OFL) for chrome and headings; the soft mono (§4.3) for the feed.
- **Shape:** large radii (14–18 px windows, pill buttons), 2 px white sticker border plus
  a soft shadow (`0 2px 0 #e3c4ee, 0 6px 14px rgb(176 22 110 / 0.12)`).
- **Texture:** a pastel rainbow binding (4 px gradient strip) on the left edge of each pane;
  foil on the active tab, nat-20 tags, the level-up sheet.
- **Motion:** foil drifts slowly (8 s) on hover or focus only; it is still under reduced
  motion.
- **Risk:** the most likely to tire on a long fight, and the closest to the Lisa Frank
  trade dress. Use it as a seasoning, not the meal.

### 3.2 Direction B — "Gloaming Wash" (*The Last Unicorn* at dusk)

*A painted evening sky with the unicorn as the only light in it.* A **dark** watercolour
theme: deep periwinkle night, silver-lilac text, sea-foam accents, Red Bull ember for
danger. Soft and feminine without leaving the dark-first family. It is the easiest to
build, because every existing assumption about a dark background still holds.

| Token | Hex | Role | on bg | on panel | on sel |
|---|---|---|---|---|---|
| `--color-bg` | `#1c1e3b` | Night wash | — | — | — |
| `--color-input-bg` | `#262a4d` | Panels | — | — | — |
| `--color-fg` | `#e8e3f6` | Moon silver | 12.90 | 11.01 | 8.29 |
| `--color-fg-bright` | `#fffaf0` | Unicorn white | 15.55 | 13.27 | 9.99 |
| `--color-fg-dim` | `#b2acd6` | Lilac haze | 7.52 | 6.42 | 4.83 |
| `--color-accent` | `#9ee6d2` | Sea-foam | 11.33 | 9.67 | 7.27 |
| `--color-system` | `#b4abcd` | | 7.43 | 6.34 | 4.77 |
| `--color-error` | `#ff8a7d` | Red Bull ember | 7.07 | 6.04 | 4.54 |
| `--color-success` | `#c4ecb0` | Spring green | 12.30 | 10.50 | 7.90 |
| `--color-border` | `#41467a` | (decorative, 1.83) | | | |
| `--color-choice-hover` / `-selected` | `#2d3159` / `#373c6b` | | | | |
| HP healthy / hurt / critical | `#f3effd` / `#e9a0c4` / `#e0473c` | Moonlight → rose → Bull red | 14.31 / 7.93 / 3.96 | steps 1.81, 2.00 | |

- **Type:** Fraunces italic for display, Nunito for chrome, the soft mono for the feed.
- **Shape:** medium radii (10–12 px), no hard shadows; edges are soft glows
  (`0 0 0 1px #41467a, 0 8px 24px rgb(0 0 0 / 0.35)`).
- **Texture:** two or three large watercolour blooms (radial gradients in lilac `#5b4f9e`
  and sea-foam `#2f6f73` at 25–35% opacity) on the body, behind everything, plus a faint
  paper grain.
- **Motion:** none ambient. A slow fade-in of the blooms on load at most.
- **Risk:** it is beautiful, but it is not the "biggest departure" the owner asked for. It
  makes a good second theme (task 7).

### 3.3 Direction C — "Dream Desktop" (System 7, pastel)

*A Macintosh Classic that a ten-year-old decorated with stickers.* Crisp ink outlines,
pinstriped title bars, rounded-rectangle buttons and a pastel dithered desktop. The most
Mac-like and the most legible.

| Token | Hex | Role | on bg | on panel | on sel |
|---|---|---|---|---|---|
| `--color-bg` | `#f3eefb` | Lavender desktop | — | — | — |
| `--color-input-bg` | `#ffffff` | Window white | — | — | — |
| `--color-fg` | `#1d1830` | Near-black ink | 15.04 | 17.13 | 11.81 |
| `--color-fg-bright` | `#000000` | 1-bit black | 18.43 | 21.00 | 14.48 |
| `--color-fg-dim` | `#575070` | | 6.61 | 7.54 | 5.20 |
| `--color-accent` | `#5b34c4` | Highlight violet | 6.74 | 7.68 | 5.30 |
| `--color-system` | `#5d5876` | | 5.90 | 6.72 | 4.64 |
| `--color-error` | `#b3122e` | | 6.06 | 6.90 | 4.76 |
| `--color-success` | `#0f6449` | | 6.27 | 7.14 | 4.93 |
| `--color-border` | `#1d1830` | 1 px window outline (15.04) | | | |
| `--color-choice-hover` / `-selected` | `#ece4fb` / `#ddd0fa` | Lavender selection | | | |
| HP healthy / hurt / critical | `#2f86c4` / `#9b3f8e` / `#5e0e2c` | Sky → plum → pomegranate | 3.46 / 5.27 / 11.70 | steps 1.52, 2.22 | |

- **Type:** a pixel face for title bars only (§4.3), Nunito for the rest of the chrome,
  the soft mono for the feed.
- **Shape:** windows with 6 px corners and a hard `2px 2px 0` ink shadow; rounded-rect
  buttons (8 px); the primary button gets a second 3 px outline 2 px out (System 7 default
  button).
- **Texture:** the desktop is a 4 × 4 two-tone dither (`#f3eefb` and `#e8def8`), drawn
  with CSS gradients rather than an image.
- **Motion:** none ambient. Menus and sheets open with a quick 120 ms "zoom rect" outline
  (a nod to the Finder's zoom), and simply appear under reduced motion.
- **Risk:** on its own it reads as retro-computing more than "feminine and beautiful".
  The ink-black border also breaks the HP and XP tracks, which use `--color-border`
  (see §4.1).

### 3.4 Recommended: "Licorne", a blend

**Paper and watercolour from B, the window from C, foil from A, kept for rare moments.**
A light theme. The page is lilac-white watercolour paper with a few soft blooms. Each pane
is a rounded window with a System 7 title bar in pastel pinstripes. Chips and badges are
puffy stickers. Holographic foil appears in four places only: the active tab's underline,
the nat-20 and kill highlight tags, the level-up sheet's header, and the Train wizard's
"Meet your monster" step. That way the shine stays special.

Why the blend:

- It is the largest departure (light, rounded, proportional chrome, textured) while staying
  calm enough for a ten-minute fight log.
- The Mac nod is structural (title bars, buttons, the default-button ring), not a font
  gimmick. It survives even if no Chicago-like font clears licensing.
- Foil reserved for highlights makes the moments players care about sparkle. If foil were
  everywhere, nothing would.
- B's palette works as a **dark sibling** later, the same theme family at night.

| Token | Hex | Role | on bg | on panel | on sel |
|---|---|---|---|---|---|
| `--color-bg` | `#fbf7fd` | Watercolour paper | — | — | — |
| `--color-input-bg` | `#ffffff` | Window | — | — | — |
| `--color-fg` | `#33204f` | Plum ink | 13.58 | 14.38 | 11.08 |
| `--color-fg-bright` | `#1d0f33` | Deepest ink | 16.97 | 17.97 | 13.85 |
| `--color-fg-dim` | `#66568a` | Faded ink | 6.08 | 6.44 | 4.96 |
| `--color-accent` | `#a3196b` | Rose madder: links, timers, focus | 6.82 | 7.22 | 5.56 |
| `--color-system` | `#5c5a85` | | 6.09 | 6.45 | 4.97 |
| `--color-error` | `#ad1131` | Pomegranate | 6.83 | 7.24 | 5.58 |
| `--color-success` | `#0b6f55` | Deep sea-foam | 5.80 | 6.14 | 4.73 |
| `--color-border` | `#d9c6ea` | Soft rule (decorative, 1.50) | | | |
| `--color-choice-hover` / `-selected` | `#f6ecfc` / `#ecdcfa` | | | | |
| `--color-hp-healthy` | `#2a8f80` | Sea-foam | 3.71 | | |
| `--color-hp-hurt` | `#a8418f` | Orchid | 5.19 | | |
| `--color-hp-critical` | `#5e0e2c` | Pomegranate seed | 12.59 | | |

HP steps: 1.40 and 2.42; luminance 0.217 → 0.141 → 0.029. It passes every rule in
`theme-palettes.test.ts`. Other pairs checked: accent on hover 6.30; badge text
(`--color-bg` on accent) 6.82; white on accent 7.22; white on `--color-fg` (a filled primary
button) 14.38; the focus ring (accent on bg) 6.82, well over the 3:1 needed for non-text.

**Watercolour washes** (`--wash-lilac #efe4ff`, `--wash-seafoam #dcf5ee`,
`--wash-blush #ffe3ee`, `--wash-butter #fff3d1`, `--wash-sky #e1efff`) are safe under text:
fg is 11.79–13.01, fg-dim 5.27–5.82 and accent 5.92–6.53 on each of them. They can tint
panels, role slots and sheets without a contrast exception.

#### How each surface looks in Licorne

- **App header** (`AppShell.tsx`): white, with a 3 px pastel rainbow binding along its bottom
  edge in place of the 1 px rule. The room name is in Fraunces italic 600. The nav buttons
  are rounded-rect buttons.
- **Tabs** (`.terminal-tab`): pill-topped folder tabs. The active one is white and joined
  to its pane, with a foil underline. Inactive tabs are `--wash-lilac`. The Chat unread
  badge (`.terminal-tab-badge`) is a puffy sticker: accent fill, white text, white ring.
- **Pane headers** (`.pane-header`): **System 7 title bars.** Two pinstripe fields
  (`repeating-linear-gradient` of 1 px `#d9c6ea` and 1 px transparent, six stripes) on
  either side of the centred title. The title sits in a white gap, in the title-bar face
  (§4.3), sentence case instead of today's uppercase tracking. Timers and actions
  stay at the right, outside the stripes.
- **The Ring feed:** paper background. The soft mono at the same 14 px / 1.4 metrics. Card
  frames (`.event-card-block`) become index cards: white, 10 px radius, a hairline border,
  and a faint ruled-line background (`repeating-linear-gradient` at the 19.6 px line
  pitch, so rules sit under text lines). Highlight rows keep their 3 px left bar,
  rounded at the ends; their tags are stickers. Narration stays plain ink: no glow, no
  shadow.
- **Roster** (`RingRoster.tsx`): sprites with a **die-cut sticker outline** (§4.6), names
  in Nunito 700. The acting row gets a `--wash-butter` highlight with rounded ends. HP bars
  become 6 px rounded pills on their own track token.
- **Console** (`ConsolePane.tsx`): a notebook page. The command dock is a white rounded
  field with an inner 1 px border. The `>` prompt glyph becomes accent-coloured and stays
  `>`, so the help text that mentions typing at the prompt still matches. Quick-action
  chips are puffy stickers.
- **Workshop monster panels** (`.workshop-monster-panel`): rounded windows with the
  title-bar header. Card slots get a role wash plus a role-coloured 2 px top edge (like a
  tab divider in a binder): attack and area on `--wash-blush` with an accent edge, heal on
  `--wash-seafoam` with a success edge, trick on `--wash-lilac` with an fg-bright edge.
  Today the slots tint only their border through `color-mix`, and that rule stays as the
  fallback. Disabled slots get a dotted border; incompatible ones a 45° hatching, not
  colour alone.
- **Meters:** HP stays the three-stage ramp. **XP is the unicorn's horn:** a pill track
  whose fill is a diagonal twist (`repeating-linear-gradient(135deg, #fff3d1 0 6px,
  #efe4ff 6px 12px)`) with a 1 px accent outline, so the fill still reads at 3:1 against the
  track by its edge, not by the pastel.
- **Bottom sheets** (`.card-detail-sheet`, `DetailSheet.tsx`, `LevelUpSheet.tsx`): the
  Trapper Keeper flap. The top corners are 20 px, and a 36 × 5 px rounded grab tab sits at
  the top in accent (decorative; the sheet still closes by its button and backdrop). The
  close button is a System 7 close box: a 1 px ink square holding ✕, inside a 44 px hit
  target. The level-up sheet's header gets the foil.
- **Buttons** (`.btn`, `.btn-primary`): rounded rectangles, 8 px radius, a 1 px
  `--color-fg` outline (14.38:1, so the control boundary passes the 3:1 non-text rule that
  the soft border cannot). Hover fills `--wash-lilac`. The primary button is the System 7
  default button: filled plum with white text, ringed by a second 2 px outline 2 px out.
- **Toasts:** the app has no toast component. The nearest are banners
  (`.connection-banner`, `.command-blocked-banner`, `.workshop-flash-error`,
  `CatchUpBanner.tsx`). In Licorne they are rounded wash strips with a sticker icon: error
  on `--wash-blush`, status on `--wash-sky`.
- **Carousel dots** (`.workshop-monster-dot`): today they are 10 px squares in accent. They
  become tiny five-petal flowers drawn with CSS `mask` (outline when inactive, filled when
  active). The next arrow stays a circle with a chevron. The 28 × 44 px tap targets are
  unchanged.
- **Empty Workshop** (`.workshop-no-monsters`): the tapestry's circular fence as a dashed
  rounded frame, with a single millefleur sprig. The copy is unchanged.

## 4. Implementation brief

### 4.1 What the theme system has today, and what stops a theme like this

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
  mid-tone healthy (Licorne's is 3.71:1), so the bar cannot be pastel. That is fine, but
  `terminal.css` also uses the HP tokens as **text** colours in the highlight tags
  (`.event-highlight-nat20 .highlight-tag` and the crit-fail tag), where 3.71:1 is under the
  4.5:1 that small text needs. These need their own text-safe tokens.
- **Tracks use the border colour.** `.roster-bar-track` is `var(--color-border)`. With
  Direction C's ink border the critical fill would sit at 1.29:1 on its track. A
  `--color-meter-track` token fixes this (Licorne `#ece2f5`: healthy 3.14, hurt 4.39,
  critical 10.64).
- **Text on accent uses `--color-bg`** (`.terminal-tab-badge`). This works in every
  palette here (Licorne 6.82) but should be a named `--color-on-accent`.
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

### 4.2 Tokens to add

Every theme gets these, with defaults that reproduce today's look exactly, so the plumbing
PR changes no pixels in the four existing themes.

| Token | Default (today) | Licorne |
|---|---|---|
| `--font-ui` | `var(--font-family)` | `'Nunito', system-ui, sans-serif` |
| `--font-display` | `var(--font-family)` | `'Fraunces', Georgia, serif` |
| `--font-titlebar` | `var(--font-family)` | the title-bar face (§4.3) or `--font-ui` 800 |
| `--font-mono` | `var(--font-family)` | the soft mono (also stays `--font-family` for the feed) |
| `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-pill` | `0` / `0` / `0` / `999px` | `6px` / `10px` / `18px` / `999px` |
| `--border-width` | `1px` | `1px` |
| `--color-border-strong` | `var(--color-border)` | `var(--color-fg)` (controls, 3:1+) |
| `--shadow-window` | `none` | `0 1px 0 #d9c6ea, 0 6px 18px rgb(51 32 79 / 0.08)` |
| `--shadow-sticker` | `none` | `0 0 0 2px #fff, 0 2px 6px rgb(163 25 107 / 0.18)` |
| `--surface-texture` | `none` | paper grain plus blooms (§4.5) |
| `--surface-titlebar` | `none` | the pinstripe gradient |
| `--foil` | `none` | the holo gradient stack (§4.5) |
| `--color-meter-track` | `var(--color-border)` | `#ece2f5` |
| `--color-on-accent` | `var(--color-bg)` | `#ffffff` |
| `--color-highlight-good` / `-warn` | `var(--color-hp-healthy)` / `var(--color-hp-hurt)` | `#0b6f55` / `#8e2f78` (text-safe, ≥ 4.5) |
| `--color-sprite-flash` | `#ffffff` | `#ff9fd2` (a pink flash that keeps the outline) |
| `--color-backdrop` | `rgb(0 0 0 / 0.7)` | `rgb(51 32 79 / 0.35)` |
| `--color-bg-elevated`, `--color-hover`, `--color-accent-muted`, `--color-warning` | define in every theme (they are read today but never set) | `#ffffff`, `#f6ecfc`, `#efe4ff`, `#8a5a00` |
| `--wash-lilac`, `--wash-seafoam`, `--wash-blush`, `--wash-butter`, `--wash-sky` | `transparent` | §3.4 |
| `color-scheme` (property, not token) | `dark` | `light` |

`#8e2f78` and `#8a5a00` are for text: 7.01 and 5.60 on the paper, 7.43 and 5.93 on a
white panel, 5.72 and 4.57 on the selection colour. The extended test in task 1 keeps
them there.

### 4.3 Fonts

All candidates were checked on npm (`@fontsource/*`, version 5.3.0). Sizes are the latin
`woff2` subset. Fontsource CSS registers faces with `unicode-range`. A browser downloads a
face only when text uses it, so **players on other themes download no font files.** The
Fontsource CSS itself is loaded with the theme's lazy chunk (§4.4), not from `main.tsx`, so it
does not grow the shared stylesheet either.

| Role | Recommendation | Licence | Latin woff2 | Why |
|---|---|---|---|---|
| Chrome / UI | **Nunito** 400, 700 | OFL-1.1 | 16.3 KB, 16.2 KB | Rounded terminals, friendly, very legible at 13–14 px. (Fredoka is the rounder alternative for Direction A, 16 KB a weight; Quicksand is too thin at 14 px.) |
| Display (room name, sheet and wizard headings) | **Fraunces** 600 italic | OFL-1.1 | 23.0 KB | A soft old-style serif with a storybook feel, close to the film's titles in spirit without copying them. Its variable build has a "SOFT" axis worth trying. Alternative: Cormorant Garamond (23 KB), more delicate but thin at small sizes. |
| Feed and Console | **Recursive Mono Casual** (Recursive with `MONO 1`, `CASL 1`), 400 and 700 | OFL-1.1 (Recursive Project Authors) | about 28 KB each as static instances | **Measured at a 600/1000 advance, the same 8.4 px at 14 px as JetBrains Mono**, so `FEED_CHAR_PX` and the card frames hold. The casual axis gives a gel-pen softness. Fontsource's variable subsets split `MONO` and `CASL` into separate files, and only the "full" file (305 KB) has both, so generate two static instances once (fontTools `instancer`) and commit them with `OFL.txt`. Fallback: **Victor Mono** 400 (OFL, 15.9 KB, also 600 units), which needs no build step. |
| Title-bar nod | **Option 1:** none; use Nunito 800, small. **Option 2:** Pixelify Sans 500 (OFL, 8.1 KB), a pixel face that is not Chicago. **Option 3:** ChicagoFLF | ChicagoFLF: placed in the public domain by its author, Robin Casady ([Wikipedia](https://en.wikipedia.org/wiki/Robin_Casady), [cufonfonts](https://www.cufonfonts.com/font/chicagoflf)); not on Google Fonts or Fontsource | — | The real Chicago is Apple's and must not ship. "Chicago Kare" (Duane King, 2024) and "ChiKareGo" could not have their licences confirmed from this session; treat them as unavailable until someone reads their licence files. ChicagoFLF's public-domain status rests on its author's statement. **Owner decision** (§5). |

**Budget:** Nunito ×2 + Fraunces ×1 + Rec Mono Casual ×2 ≈ 112 KB, fetched only under
Licorne. With Victor Mono instead of Rec Mono, ≈ 72 KB. For comparison, JetBrains Mono 400
is 21.2 KB. Preload only the mono and Nunito 400 when the theme is active; load the rest
with `font-display: swap`.

**Font loading must not move the feed.** A late swap changes line wrapping. Keep the mono's
`line-height` and size identical to today, give the fallback stack a `size-adjust` so that
Courier or the system mono also measures 0.6 em, and let Virtuoso remeasure. Check
by scrolling the Ring's history with throttled network (§4.7).

### 4.4 Files to touch

| File | Change |
|---|---|
| `apps/web/src/styles/theme-licorne.css` (new) | All colour tokens (the palette test's required list), the new tokens, and theme-scoped surface rules |
| `apps/web/src/styles/base.css`, `terminal.css` | Replace literal radii, border widths and shadows with tokens (defaults preserve today); split `--font-family` uses into feed (`--font-family`) and chrome (`--font-ui`); meter tracks to `--color-meter-track`; highlight tag text to `--color-highlight-*`; badge text to `--color-on-accent`; make the `prefers-contrast: more` block complete per theme (light themes get their own high-contrast block) |
| `apps/web/src/styles/effects.css` | Nothing for the scanlines: `--crt-scanline-opacity: 0` already turns them off. Add the foil keyframes here, inside `prefers-reduced-motion: no-preference` |
| `apps/web/src/hooks/useTheme.ts` | The `THEMES` entry; set `<meta name="theme-color">` and `color-scheme` in `applyTheme` |
| `apps/web/index.html` | A small inline script that reads `deck-monsters-theme` and, before first paint, sets `data-theme` **and** updates `<meta name="theme-color">` from a tiny id → colour map (guarded with try/catch, as `localStorage` can throw). `applyTheme` only runs after React mounts, so leaving the meta to it would keep a black status bar through first paint (Codex on #426) |
| `apps/web/src/themes/licorne.ts` (new) | Loaded with a dynamic `import()` from `applyTheme` the first time Licorne is chosen: it brings `theme-licorne.css` and the `@font-face` CSS. A static import in `main.tsx` would put those rules in the shared bundle for every player (Codex on #426); the font files themselves only download when a rule uses them |
| `apps/web/src/components/AppShell.tsx` | Header inline styles to a class; `THEME_ICON` entry (🦄); backdrop to `--color-backdrop` |
| `apps/web/src/animations/pixel-fight/renderer.ts` | Flash colour from a parameter, read once from `--color-sprite-flash`; keep the outline key (`O`) unflashed |
| `apps/web/src/__tests__/theme-palettes.test.ts` | Extend: fg-dim, accent, system, error and success ≥ 4.5 on bg **and** input-bg; on-accent ≥ 4.5; meter fills ≥ 3 on their track; highlight text tokens ≥ 4.5 |
| `apps/web/src/__tests__/useTheme.test.ts` | The new id; meta theme-color updates |
| `docs/architecture/web-themes.md` (new) | How themes work, the token contract, what a light theme must define, and the "why" of each rule above. Link it from `AGENTS.md` and `docs/README.md` |
| `docs/reference/help-inventory.md` | The theme setting's label, if it changes |

### 4.5 Textures, foil and motion

- **Paper grain:** one inline SVG `data:` URI using `feTurbulence type="fractalNoise"
  baseFrequency="0.8" numOctaves="3"` mapped to a 3–4% alpha plum. The SVG is tiled at
  256 px as `background-image` on `body` only. It is under 1 KB and is rasterised once,
  not filtered live. **Never apply `filter: url(#…)` to live content or to the feed
  scroller**: it repaints on every scroll frame.
- **Watercolour blooms:** three `radial-gradient`s on `body` (lilac top-left, sea-foam
  bottom-right, blush mid-right) at 35–55% of the wash colours, with `background-attachment:
  scroll`. `fixed` stutters on iOS Safari. If gradients look too clean, a single 512 px WebP
  bloom tile (budget 25 KB) may replace them.
- **Pinstripes:** `repeating-linear-gradient(to bottom, #d9c6ea 0 1px, transparent 1px
  3px)` in `--surface-titlebar`, masked out behind the title.
- **Foil:** `linear-gradient(115deg, #ffd1ec, #fff3c4, #c9f7e4, #cfe6ff, #e3d4ff, #ffd1ec)`
  at `background-size: 300% 100%`, with a `conic-gradient` overlay in `mix-blend-mode:
  soft-light`. Only on the four small elements listed in §3.4, never on a scrolling list
  row. Animate `background-position` over 8 s only under `prefers-reduced-motion:
  no-preference`, and only while hovered or focused (the active tab may shimmer once on
  change). The global reduced-motion rule in `base.css` already freezes it on its first
  frame, which still looks like foil.
- **Motion budget:** no ambient animation on the page. Sheets slide up 180 ms ease-out,
  as today. The Workshop peek (#224) is unchanged. Nothing animates `width`, `height` or
  `top`; only `transform`, `opacity` and `background-position`.

### 4.6 Pixel monsters in a soft theme

Keep them pixelated. [Pixel art](../reference/pixel-art.md) forbids smoothing, and a
pixel sprite is the theme's own Kare nod. Give them a **sticker** treatment instead of a
CRT one:

- A die-cut outline: `filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff)
  drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff) drop-shadow(0 2px 3px rgb(51 32
  79 / 0.25))` on `.roster-sprite` and `.inline-sprite` only (tiny canvases, so the filter
  is cheap). At 1× this is a 1 CSS-pixel border. Check at 1×, 2× and 3×, as
  [the roster doc](../architecture/ring-roster-and-pixel-monsters.md) asks of every theme.
- The hit flash in `--color-sprite-flash` (pink) with the outline kept dark, so a struck
  monster blinks rather than disappears.
- Check the palest bodies on paper: the Unicorn (`#f7f5ff`), the Weeping Angel
  (`#f4f0ff`), and any monster whose owner typed "white" or "ivory". The outline key
  carries them. If one reads weak, the sticker shadow is the fix; do not change species
  palettes per theme (#164 spaced their ramps by hand).

### 4.7 Accessibility and checks

- **Contrast:** every text pair in §3.4 is ≥ 4.5:1 on bg, panel and selection, and every
  wash. The HP ramp passes the palette test. The extended test (task 1) enforces this for
  all themes.
- **Non-text:** buttons and inputs use `--color-border-strong` (14.38:1). The soft
  `--color-border` (1.50:1) is for decorative rules only. The four dark themes' borders are
  decorative too (phosphor `#2a3a2a` on `#0a0e0a` is about 1.6:1), so this is not a new kind
  of exception, but Licorne should not add more of them.
- **High contrast:** under `prefers-contrast: more`, Licorne drops textures, foil and
  washes, goes to `#ffffff` / `#000000` with a 2 px black border, and keeps its radii.
- **Reduced motion:** no foil drift, no zoom-rect, sheets appear without sliding.
- **Colour is never alone:** role slots keep their text role and get a top edge, not only
  a wash. Incompatible slots get hatching. HP stages differ in luminance (§3.4).
- **Focus:** the 2 px accent ring (6.82:1) with a 2 px offset; on sticker chips, a white
  gap ring inside it.
- **Live checks:** 390 × 844 and 1440 × 900 in a real browser (jsdom lays nothing out; bug
  210). Screens: Ring mid-fight with a boss, Console with a prompt open, Workshop with three
  monsters (carousel), the card detail sheet, the level-up sheet, the Train wizard, Chat,
  Help, Leaderboard, Account. Throttle to Fast 3G once and scroll the Ring's history to
  catch font-swap jumps. Record frame timings while a fight scrolls on a mid-range phone
  profile (no long frames from blend modes or filters).

### 4.8 Performance budget

| Item | Budget |
|---|---|
| Fonts (only under this theme) | ≤ 115 KB latin, at most two preloaded |
| Textures | ≤ 1 KB inline SVG; ≤ 25 KB optional WebP bloom |
| CSS | `theme-licorne.css` ≤ 12 KB unminified |
| Other themes | 0 bytes more downloaded: Licorne's CSS and `@font-face` rules are a separate chunk loaded by dynamic `import()`, the fonts load only when used, and the shared bundle grows only by the theme's `THEMES` entry and the pre-paint colour map. Pixel-identical before and after task 1 |
| Runtime | No `backdrop-filter`, no live SVG filters, no blend modes on scrolling rows; layout shift from font swap ≈ 0 in the feed |

### 4.9 Task table

Two passes, so each PR stays at three or four tasks (see
[subagents budget](../agents/subagents.md#budget)). Tasks 1 and 2 must land first; the
rest can run in parallel only where noted.

| # | Pass | Task | Area / files | Acceptance | Can run beside | Status | Commit |
|---|---|---|---|---|---|---|---|
| 1 | 46a | **Theme plumbing, no visual change.** Shape, font, shadow, surface, meter-track, on-accent, highlight-text, backdrop and sprite-flash tokens with defaults equal to today; define the read-but-unset tokens in all four themes; `color-scheme`; pre-paint `data-theme` and `theme-color`; per-theme `prefers-contrast`; the header class; theme button label by name; extended palette test | `styles/*.css`, `useTheme.ts`, `index.html`, `AppShell.tsx`, `theme-palettes.test.ts`, `useTheme.test.ts`, `renderer.ts` (flash parameter) | Four themes pixel-identical at 390 and 1440; the extended palette test passes for all four; no black flash on a light theme in a smoke test | docs-only work | proposed | — |
| 2 | 46a | **Licorne palette, fonts and shapes.** `theme-licorne.css`, `THEMES` entry and icon, the three font roles, radii, buttons, inputs, sheets, banners; the lazy-loaded chunk, with a bundle check that other themes' CSS did not grow | `theme-licorne.css`, `themes/licorne.ts` (lazy chunk), `useTheme.ts`, fonts and `OFL.txt` | Palette test green; card frames still align; feed row-height test unchanged; check at 390 and 1440 | — (after 1) | proposed | — |
| 3 | 46a | **Licorne surfaces.** Title-bar pane headers, folder tabs, Workshop role washes and edges, horn XP meter, HP pills, flower dots, sticker chips and badges, the empty Workshop frame | `theme-licorne.css`, small class hooks in `terminal.css`/`base.css` | Every surface in §3.4 matches; no close box where nothing closes; tap targets unchanged | 4 if 4 avoids the same selectors | proposed | — |
| 4 | 46b | **Textures and foil.** Paper grain, blooms, pinstripes, foil on the four moments, motion and reduced motion | `theme-licorne.css`, `effects.css` | Budget in §4.8 met; no long frames while a fight scrolls; reduced motion is still | 3 (different selectors) | proposed | — |
| 5 | 46b | **Pixel monsters on paper.** Sticker outline, pink flash, check the pale species and white appearances at 1×/2×/3× | `terminal.css`, `renderer.ts`, `rosterSprite`/pixel tests | Struck monsters visibly flash; pale monsters read on paper; nothing smoothed | 4 | proposed | — |
| 6 | 46b | **Live check and docs.** Cursor-style checklist for the screens in §4.7; `docs/architecture/web-themes.md`; links from `AGENTS.md` and `docs/README.md`; roadmap status | docs | Check passed or findings filed in 10 | 4, 5 | proposed | — |
| 7 | later | **Optional: the dark sibling** from Direction B ("Gloaming"?) on the same tokens | `theme-<name>.css` | Palette test green; same checks | — | proposed | — |

## 5. Open questions for the owner

1. **Direction.** The recommended blend (Licorne), or one of A, B and C as written? B on
   its own is the most beautiful at night but is not the big departure you asked for.
2. **Name.** Suggestions, all original and all from the game's own Unicorn:
   - **Licorne** (recommended): Philemon Holland's 1601 English Pliny, already quoted in
     the Unicorn's description ("the Licorne or Monoceros"). It is soft, a little French,
     and nobody else's mark.
   - **Millefleur**: the flower-strewn ground of the tapestries, and the garden it raids.
   - **Gloaming**: dusk, and the Unicorn's own card Gloaming Rest. A lovely name for the
     dark sibling, but it may read as a link to that card. Ānhorn, the Old English word in
     the rare look line, is charming but hard to type.
   The menu shows the name without the parenthesis, so the list label could be
   "Licorne (pastel watercolour)".
3. **The Mac nod's font.** Use no special face (title bars in Nunito), a pixel face that is
   not Chicago (Pixelify Sans), or ChicagoFLF on its author's public-domain statement?
4. **Feed font.** Recursive Mono Casual (softer, two generated files, ~56 KB) or Victor
   Mono (plainer, no build step, ~16 KB)?
5. **How much foil.** Four moments (recommended), or also on rare items and boss names?
6. **Default for light-mode devices?** Today every new player gets phosphor regardless of
   `prefers-color-scheme` (`useTheme.ts`). Should a phone set to light mode start on
   Licorne?
7. **The dark sibling.** Build it right after (task 7), or wait for player feedback on
   Licorne first?
8. **Monster portraits.** Out of scope here, but the natural next step is a painted (not
   pixel) portrait for the Workshop panel in this theme. It would be a separate art pass
   with its own licence notes.

## Sources

- [Lisa Frank, Wikipedia](https://en.wikipedia.org/wiki/Lisa_Frank)
- [Vintage Lisa Frank, Click Americana](https://clickamericana.com/topics/featured/vintage-lisa-frank)
- [Lisa Frank facts (characters), Primo Water blog](https://blog.primowater.com/lisa-frank-facts)
- [Trapper Keeper, Wikipedia](https://en.wikipedia.org/wiki/Trapper_Keeper)
- [The history of the Trapper Keeper, Mental Floss](https://www.mentalfloss.com/article/52726/history-trapper-keeper)
- [80s stickers, Click Americana](https://clickamericana.com/toys-and-games/vintage-stickers-from-the-80s)
- [The Last Unicorn (film), Wikipedia](https://en.wikipedia.org/wiki/The_Last_Unicorn_(film))
- [The Making of The Last Unicorn, Animation Obsessive](https://animationobsessive.substack.com/p/the-making-of-the-last-unicorn)
- [The Last Unicorn, HCF Rewind](https://horrorcultfilms.co.uk/2011/07/hcf-rewindthe-last-unicorn-1982/)
- [The Last Unicorn, Alternate Ending](https://www.alternateending.com/2016/06/19/when-the-future-has-past-without-even-a-last-desperate-warning/)
- [The Unicorn Tapestries, Wikipedia](https://en.wikipedia.org/wiki/The_Unicorn_Tapestries)
- [The Unicorn Surrenders to a Maiden, The Met](https://www.metmuseum.org/art/collection/search/467653)
- [Chicago (typeface), Wikipedia](https://en.wikipedia.org/wiki/Chicago_(typeface))
- [How Susan Kare designed user-friendly icons, Smithsonian](https://www.smithsonianmag.com/innovation/how-susan-kare-designed-user-friendly-icons-for-first-macintosh-180973286/)
- [Inside Macintosh: Toolbox, window parts, Apple archive](https://developer.apple.com/library/archive/documentation/mac/Toolbox/Toolbox-191.html)
- [Appearance Manager and Platinum, System 7 Today](https://system7today.com/appearance)
- [system.css, Changelog](https://changelog.com/news/lOAY)
- [Robin Casady (ChicagoFLF), Wikipedia](https://en.wikipedia.org/wiki/Robin_Casady)
- [Little Twin Stars, Sanrio](https://corporate.sanrio.co.jp/en/business-info/brands/little_twin_star/)
- [Pokémon card holo CSS, Simon Goellner](https://poke-holo.simey.me/)
- [Holographic trading card effect, CSS-Tricks](https://css-tricks.com/holographic-trading-card-effect/)
- [Creating texture with feTurbulence, Codrops](https://tympanus.net/codrops/?p=37751)
- [Frutiger Aero, Wikipedia](https://en.wikipedia.org/wiki/Frutiger_Aero)
- [Y2K design trend, daisyUI](https://trends.daisyui.com/trend/y2k/)
- Font licences and sizes: the `@fontsource/*` 5.3.0 packages on the npm registry (Nunito,
  Fredoka, Quicksand, Fraunces, Cormorant Garamond, Pixelify Sans, Silkscreen, Victor Mono,
  `@fontsource-variable/recursive`), all OFL-1.1; advances measured with fontTools.
