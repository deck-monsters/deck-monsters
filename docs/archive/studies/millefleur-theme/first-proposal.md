---
type: Archive
title: Unicorn theme, first proposal (superseded)
description: The researched first proposal for the unicorn theme, with its inspirations, three directions and the reviewed Millefleur concept, kept as written before the design was finalised.
status: deprecated
audience: internal
tags: [archive, theme, design, unicorn]
---

> **Superseded (2026-10-06).** This is roadmap 46's design half as it stood before the owner
> reviewed rendered screens. The final design is in the
> [Millefleur design system](../../../reference/millefleur/design-system.md); the rounds between
> this text and that design are in [the iteration archive](README.md). Kept for its research
> (inspiration sources, licensing notes, the three directions and their checked palettes).
> Section numbers are the originals; section 4 (implementation) stayed in roadmap 46.

# 46 — A unicorn theme

**Status:** Proposed (2026-10-05), revised the same day after a second review the owner
forwarded (see "Revision" below). Nothing is built. The owner picks a direction and a name,
then this becomes a two-pass plan (46a, 46b) with the task table at the end.

**Revision (2026-10-05).** The first draft blended the four inspirations fairly evenly: title
bars everywhere, foil in four places, flowers and watercolour throughout. A second review
argued that this would read as a collection of references rather than one object, and
proposed giving each source one job. This revision adopts most of that review (the north
star, the layer table, the material system, three levels of shine, a quieter Ring, binder
tabs and pockets, a small botanical vocabulary, sparing hand-drawn marks, JetBrains Mono
first) and the dye-based spectrum, which we checked against The Met's own text. It keeps all
of the engineering in §4, and adds one fix of its own: a lazily loaded theme still needs its
first-paint colours in the shared bundle (§4.4). The working name is now **Millefleur**
(§5).

**Owner's request (2026-10-05):** "a new theme that goes with the new unicorn monster. I'm
thinking 90s trapper keeper, rounded edges and gradients and pastels and beautiful water
colors and textures, more of a departure from the terminal aesthetic than any other theme
though a bit of a nod could be nice, maybe macOS 6 or 7 rather than dos/cli, Lisa frank,
'the last unicorn', etc. … this should be really beautiful and more feminine."

## 1. Summary

Every theme today is a phosphor screen in a different colour: dark background, one bright
ink, monospace type, square boxes, optional scanlines. This theme is the first one that is
**not a screen at all**. It is an object: **a magical 1991 school binder that turns out to
open onto the unicorn's garden.** The tabs are binder dividers, the Workshop is a sticker
album with card pockets, the Ring is a quiet storybook page, and holographic shine is saved
for the moments that matter.

The nod to the computer is still there, but it is a **Macintosh, not DOS**: System 7 shows up
in the grammar of controls (outlined buttons, the default-button ring, close boxes, title bars
on real windows such as sheets and dialogs), not as a costume on every header. The feed and
the Console keep JetBrains Mono, so the game's old monospace transcript still shows through
the new paper, on purpose.

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

`packages/engine/src/monsters/unicorn.ts` and the [Unicorn strings](../../../reference/strings/unicorn.md)
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

- **The dyes.** The Met's description of the set says chemical analysis found the colours
  came from three plants, **weld** (yellow), **madder** (red) and **woad** (blue), which the
  weavers blended into a wide spectrum and highlighted with **silver and gilt thread**
  ([The Met, object 467640](https://www.metmuseum.org/art/collection/search/467640); also
  quoted by [Wikipedia](https://en.wikipedia.org/wiki/The_Unicorn_Tapestries)). The
  materials line reads "wool warp with wool, silk, silver, and gilt wefts".

**Borrow:** this is the source *The Last Unicorn* itself drew from, and it is free to use.
Take:

- **The dye spectrum** as the theme's rainbow (§3.4): madder rose, weld butter, woad sky,
  woad-and-weld sea-foam, woad-and-madder lilac. It gives the Trapper Keeper rainbow a
  historical reason to look the way it does, and keeps it soft rather than fluorescent.
- **Metal thread as the ancestor of foil.** The holographic shine is the binder's version of
  the tapestries' silver and gilt highlights.
- **A small vocabulary of plants**, drawn by us as tiny ink marks (§3.4), not a generic
  five-petal flower and never a photograph.
- **The circular fence** of *The Unicorn in Captivity* as the theme's recurring enclosure
  shape (§3.4), and pomegranate red for danger.

The film can only be an inspiration; the tapestries are a source we may use.

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

**Borrow:** the grammar, not the costume. Outlined controls with a strong 1 px ink edge;
rounded-rectangle buttons; the thick double outline of the System 7 default button on the
primary action; a compact square close box on things that really close; a 1–2 px hard
shadow, used occasionally; classic selection-rectangle logic; a few pixels of dither in tiny
places. **Pinstriped title bars only where there is a real window title**: the detail sheets,
dialogs, the Train wizard's steps. Pane headers such as `THE RING · boss in ~5m · 3 summons
left` carry live information on the right and on a phone have no room for a centred title,
so they do not become title bars. The pixel monsters already carry the Kare spirit; keep them
pixelated.

**Do not copy:** the Chicago font file, Apple icons (the Happy Mac, the Finder face, the
watch cursor), the Apple logo, or Platinum's exact bevel artwork. **Never draw a close
box where nothing closes.** A first-time player will press it (see
[player help](../../../../.cursor/skills/player-help-and-ux/SKILL.md)). Only real close
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

- **Type:** Fredoka (rounded, OFL) for chrome and headings; JetBrains Mono for the feed (§4.3).
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

- **Type:** Fraunces italic for display, Nunito for chrome, JetBrains Mono for the feed.
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
  JetBrains Mono for the feed.
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

### 3.4 Recommended: "Millefleur", the binder and the garden

A light theme built from all three directions, but not as an even blend. Each source has one
job, and the rules below say where each is allowed.

**North star: magic leaking through office supplies.** Ordinary interaction is binder,
stationery and System 7: calm, tidy, a little mundane. Magic intrudes at the moments that
earn it. XP is a spiralling horn. A natural 20 throws a tiny rainbow across an otherwise plain
index card. A level-up turns a window title to foil. A newly trained monster gets a white
sticker halo. Flowers grow into an empty panel. Pomegranate red appears only when something
is in danger. When a design choice is unclear, ask which side of that line it is on. This
also suits the game's tone: a strange bestiary living inside a deliberately ordinary UI.

**Who does what**

| Layer | Source | It controls |
|---|---|---|
| World | Watercolour and the tapestries | Paper, palette, washes, the botanical marks |
| Object | The Trapper Keeper | Tabs as dividers, pockets, labels, sheets, physical layering |
| Interface grammar | System 6/7 | Borders, buttons, the default ring, close boxes, title bars on real windows, selection and focus |
| Magic and reward | Holographic sticker culture | Level-ups, crits, rare things, the newly made |
| Character | The game's own Unicorn | Roses, the spiral horn, pomegranate, the gloaming |

**Feminine, not "pink UI".** The softness comes from material, ornament and editorial
composition, not from maximising pink. Woad blue and sea-foam carry at least as much of the
palette as blush; plum ink replaces black. Sanrio's Little Twin Stars is a useful check here:
its identity moves among light blue, pink, mint and purple and leans on gentleness, not one
colour.

#### The dye spectrum

The theme's rainbow is the tapestries' three dyes and their mixtures, diluted to washes.
These are the same five wash tokens as below, which already pass contrast under text:

| Dye | Wash token | Hex |
|---|---|---|
| Madder (red), diluted | `--wash-blush` | `#ffe3ee` |
| Weld (yellow) | `--wash-butter` | `#fff3d1` |
| Woad (blue) | `--wash-sky` | `#e1efff` |
| Woad + weld | `--wash-seafoam` | `#dcf5ee` |
| Woad + madder | `--wash-lilac` | `#efe4ff` |

Where a rainbow appears (the foil, a binding edge), it runs in this order rather than the
generic pink-to-purple ramp, and the foil plays the part of the silver and gilt thread.

#### Materials, and where each may appear

| Material | What it is | Allowed on | Not on |
|---|---|---|---|
| **Paper** | Pearl page, faint grain, one or two washes | The page behind everything; the Ring and Console; Help and Chat | Controls |
| **Window** | White, rounded, 1 px ink outline, occasional hard shadow | Sheets, dialogs, the Train wizard, Workshop monster panels | Every pane header (see §2.5) |
| **Divider** | A tab that sticks out of the binder, pale wash, joins the page when selected | The surface tabs only | Buttons |
| **Pocket** | Translucent card pocket or album mount: warm white, stitched or dotted edge, small role label | Workshop card slots, Your cards | Lists of text |
| **Label** | A small paper label pasted over a rule | Chat's "During fight #58", date separators, section labels | Anything clickable that is not a chip |
| **Sticker** | Die-cut white border and soft shadow | Chips, badges, the unread count, pixel monsters in the roster | Body text, long lists |
| **Shine** | Pearlescent, prismatic or holographic (below) | See the shine table | Scrolling rows, anything always on screen with motion |

**Three levels of shine**, so the rare ones stay rare:

| Level | What | Motion | Where |
|---|---|---|---|
| Pearlescent | A static, low-contrast gradient sheen | None | Fairly often: the selected divider's edge, the default button, the XP horn |
| Prismatic | A static spectral edge (the dye spectrum) | None | Selected rare things: a rare item, the nat-20 and kill tags, a boss's name label |
| Holographic | The animated, angle-shifting holo (§4.5) | Only on payoff moments; still under reduced motion | Level-up (the sheet's title bar), a newly trained monster (the wizard's last step) |

The first draft put full foil on the active tab. That is on screen nearly all the time, so it
would stop being special; it is pearlescent now.

#### Marks: a botanical vocabulary and a little handwriting

Five tiny ink marks, 8–16 px, drawn by us as static SVG. Not botanical illustrations; small
doodles with fixed meanings:

| Mark | Meaning |
|---|---|
| Rose | The Unicorn and monster-related moments (it eats your roses) |
| Pomegranate leaf and seed | Danger, defeat, critical |
| Iris | Story and chapter breaks: a boss summoned, a fight won |
| Carnation or a small star flower | Neutral scatter: empty states, quiet decoration |
| A sprig | An empty state's single ornament |

The tapestries' own plants include iris, carnation and pomegranate among the 85 identified,
so the vocabulary is borrowed from the source, not invented cuteness.

**Handwriting, as marks only.** Never a handwriting font for text. A very few static,
hand-drawn SVG marks give the binder its owner: a pencil circle behind a newly unlocked card
in the level-up sheet, a small heart or star by "Meet your monster", one hand-drawn underline
under the level-up title. No more than one on screen at a time.

**The fence.** The low circular fence of *The Unicorn in Captivity* becomes the theme's
enclosure shape: a circular medallion behind the level badge, an oval sticker halo around a
newly trained monster, faint curved fence marks in the empty Workshop, and a ring-shaped
loading state. Always abstract (a dashed or stitched curve), never a literal medieval fence.

**One airbrush gesture.** Behind everything, besides the washes: a single, very faint
airbrushed ribbon or arc crossing one corner of the page, in woad, like the soft clouds and
ribbons of a period binder cover. It is the cheapest thing in the theme and the most
specifically 1991.

#### The palette

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

#### How each surface looks in Millefleur

- **App header** (`AppShell.tsx`): white paper with a 3 px dye-spectrum binding along its
  bottom edge in place of the 1 px rule. The room name is in Fraunces italic 600. The nav
  buttons are System 7 rounded rectangles with an ink outline.
- **Tabs** (`.terminal-tab`): **the star of the theme.** Each is a binder divider sticking up
  from the page, in a very pale wash (not a saturated colour each). The selected divider is
  white and joins the paper below it, with a thin pearlescent top edge; the existing
  underline goes away, because the layering already says which tab you are on. On a phone
  the row already scrolls sideways and clips at the right edge, which now reads as dividers
  going on past the edge of the binder. The Chat unread badge is a puffy sticker.
- **Pane headers** (`.pane-header`): plain labels on the paper, sentence case, with the
  timers and actions where they are today. No title-bar stripes (§2.5).
- **The Ring feed: the calmest surface.** Warm pearl paper, almost no shadow, faint grain.
  JetBrains Mono in plum ink. The `=====` and `-----` card frames stay, drawn in faint
  lavender: the terminal underneath the notebook, showing through on purpose. Narrative and
  mechanics keep the distinction they have now. Ornament appears only at chapter-like moments
  (boss summoned, fight won, level-up, new monster), as one iris or rose mark. The **boss
  introduction** becomes a **bestiary clipping**: a slightly different paper stock pasted onto
  the page, with two tiny botanical corner marks. Highlight rows keep their 3 px left bar,
  rounded at the ends; their tags are prismatic stickers.
- **Roster** (`RingRoster.tsx`): sprites as die-cut stickers (§4.6), names in Nunito 700. The
  acting row gets a `--wash-butter` highlight with rounded ends. HP bars are 6 px rounded
  pills on their own track token.
- **Console** (`ConsolePane.tsx`): a notebook page, as calm as the Ring. The command dock is a
  white System 7 field with an inner 1 px border; Send is the default button with its double
  ring. The `>` prompt glyph stays `>`, in accent, so help text that mentions the prompt still
  matches. Quick-action chips are stickers.
- **Chat** (`ChatPanel.tsx`): lightly ruled stationery, **not** pastel speech bubbles (too
  contemporary). Room messages are ink on paper. A DM gets a small die-cut envelope sticker
  around its envelope icon, not a whole bubble. Date separators are quiet: `— ✿ Thu, Oct 1 at
  4:41 PM ✿ —`. "During fight #58" is a small lilac paper label pasted over the rule. The
  composer is a white System 7 control area with Send as the default button.
- **Workshop: the showcase.** Each monster panel is a white album page (window material). The
  monster's name is in Fraunces; `Gladiator · Lvl 2` stays small Nunito. HP and XP are small
  jewel-like pieces on the page. The botanical marks gather around the monster, never among
  the controls. The carousel reads as the pages of an album; the sliver of the next panel
  helps the illusion.
- **Card slots: binder pockets.** The nine empty `[+]` boxes, today big anonymous black
  squares, become card pockets: a warm white interior with a faint woad speckle or ruling, a
  dotted or stitched edge, and a tiny role label tab along the top (attack and area in
  madder, heal in sea-foam, trick in lilac). An equipped card sits in its pocket. Incompatible
  slots get diagonal pencil hatching, disabled ones a dotted edge, so colour is never alone.
  Today's `color-mix` border tint stays as the fallback.
- **Meters:** HP stays the three-stage ramp. **XP is the unicorn's horn:** a pill track whose
  fill is a pearlescent diagonal twist (`repeating-linear-gradient(135deg, #fff3d1 0 6px,
  #efe4ff 6px 12px)`) with a 1 px accent outline, so the fill still reads at 3:1 against the
  track by its edge, not by the pastel.
- **Sheets and dialogs** (`DetailSheet.tsx` and the sheets that use it, the Train wizard):
  **here the Mac title bar belongs.** The sheet is a window: a pinstriped title bar with the
  title centred in a white gap, a System 7 close box (a 1 px ink square holding ✕ inside a
  44 px hit target) on the real close control, and the Trapper Keeper flap shape (20 px top
  corners). The level-up sheet's title bar is holographic.
- **Buttons** (`.btn`, `.btn-primary`): rounded rectangles, 8 px radius, a 1 px `--color-fg`
  outline (14.38:1, so the control boundary passes the 3:1 non-text rule that the soft border
  cannot). Hover (on devices that hover, bug 230) fills `--wash-lilac`. The primary button is
  the System 7 default button: filled plum with white text, ringed by a second 2 px outline
  2 px out, with a pearlescent sheen.
- **Banners** (there is no toast component): `.connection-banner`, `.command-blocked-banner`,
  `.workshop-flash-error`, `CatchUpBanner.tsx` become rounded wash strips with a sticker icon:
  error on `--wash-blush`, status on `--wash-sky`.
- **Carousel dots** (`.workshop-monster-dot`): the "one flower" mark, outline when inactive and
  filled when active. The next arrow stays a circle with a chevron. The 28 × 44 px tap targets
  are unchanged.
- **Empty Workshop** (`.workshop-no-monsters`): faint curved fence marks and a single sprig.
  The copy is unchanged.
- **Help** (`HelpPanel.tsx`): paper, with the section buttons as small dividers like the main
  tabs; the guides in Nunito with Fraunces headings, code in JetBrains Mono.


## 5. Open questions for the owner

1. **Direction.** The recommended Millefleur (the binder and the garden, §3.4), or one of
   A, B and C as written? B on its own is the most beautiful at night but is not the big
   departure you asked for.
2. **Name.** Suggestions, all original and all from the game's own Unicorn or its sources:
   - **Millefleur** (recommended): the flower-strewn ground of the tapestries, and the
     garden the Unicorn raids. It names what makes this version special (garden, paper,
     ornament) rather than just "unicorn", and pairs well with **Gloaming** for the dark
     sibling.
   - **Licorne**: Philemon Holland's 1601 English Pliny, already quoted in the Unicorn's
     description ("the Licorne or Monoceros"). Elegant, but it mostly says "unicorn" and may
     pull toward a faux-French luxury look.
   - **Prism Garden** (more explicitly 90s) or **Moonflower** (softer, less grounded).
   - **Gloaming**: keep it for the dark sibling; it echoes the Unicorn's card Gloaming Rest.
   The menu shows the name without the parenthesis, so the list label could be
   "Millefleur (pastel watercolour)".
3. **The Mac nod's font**, for sheet and dialog title bars only: no special face (Nunito
   800, small), a pixel face that is not Chicago (Pixelify Sans), or ChicagoFLF on its
   author's public-domain statement?
4. **Feed font.** Keep JetBrains Mono (recommended for v1, the terminal showing through), and
   try Recursive Mono Casual later as task 8?
5. **How much shine.** The three levels in §3.4, with holographic only for the level-up and a
   new monster (recommended), or also for rare items and boss names?
6. **Default for light-mode devices?** Today every new player gets phosphor regardless of
   `prefers-color-scheme` (`useTheme.ts`). Should a phone set to light mode start on
   Millefleur?
7. **The dark sibling.** Build it right after (task 7), or wait for player feedback on
   Millefleur first?
8. **Handwriting marks.** In (a very few static hand-drawn marks, §3.4), or leave them out
   of v1?
9. **Monster portraits.** Out of scope here, but the natural next step is a painted (not
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
- [The Unicorn Tapestries, The Met object 467640 (dyes and metal threads)](https://www.metmuseum.org/art/collection/search/467640)
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
