# 24 — Pixel Monsters Everywhere

**Category**: Product / UI
**Status**: In progress
**Branch**: `claude/improve-pixel-art-theme-gg6869`

After #170 the roster sprites were judged ready to graduate: "This actually looks great and
I'm thinking it's maybe time to a) make this the default with the setting becoming an
opt-out b) expand it to all themes c) potentially add some color variations so that, for
example, if there are multiple basilisks in the ring they don't all have the same color and
finally d) maybe even use these items every time the character is referenced (in battle
feed etc) on the web as long as we can do so without disrupting text layout rather than
using the existing emoji representations."

## Tasks

| # | Task | Status | Commit |
|---|---|---|---|
| T1 | Sprites on by default, the setting becomes an opt-out; every theme, not only SNES | Done | _this commit_ |
| T2 | Engine publishes each contestant's `appearance` in `ring.state` | Pending | — |
| T3 | Sprite palette derived from the monster's appearance text | Pending | — |
| T4 | Sprites inline in the Ring feed wherever a known monster is named | Pending | — |
| T5 | Browser verification sheet (themes × variations × feed at 2×/3×), docs folded back | Pending | — |

## Decisions

### Full colour on every theme, no per-theme tinting

The monochrome themes (Phosphor, Amber, Ember) already show full-colour emoji in the roster
and throughout the feed — `🐍`, `💪` and the rest ignore the theme entirely. A full-colour
sprite in the emoji's own box is therefore consistent with what those themes already look
like, not a break from it. Tinting sprites to the theme's foreground was considered and
rejected: it would erase exactly the colour variation T3 exists to add.

### Colour comes from the monster's appearance, not a random hue

Every monster already has a colour. The workshop's spawn form asks for **Appearance**
(required, free text — "gold and black", "slightly translucent blue"), the Discord and text
flows ask the same question, and bosses get a random colour name from `grab-color-names`.
It is stored as `options.color` and until now only fed the monster's prose description.

Driving the palette from it means a basilisk described as emerald actually renders green —
the variation *means* something, and a player controls it. The mapping takes the first
recognised colour word in the text; text with no colour word in it ("deceptively
glorious") falls back to the species' own palette. A small per-monster shift derived from
its name separates two monsters whose owners both wrote "green", so two basilisks in one
ring are never pixel-identical — the literal ask in (c).

### The opt-out keeps its storage key

The flag was `deck-monsters-pixel-fight-stage = '1'` for on, absent for off. Flipping the
default means absent must now mean *on*, so off is stored explicitly as `'0'`. Players who
opted in keep `'1'` and stay on; players who never touched it get the new default; nobody
who had chosen off exists yet in a way that matters, because off *was* the absent default —
there is no stored "I turned this off" to honour.

### Feed sprites: matched, never guessed

The feed is flat engine text with `${icon} ${givenName}` baked in (see
`creatures/base.ts` `identity`), shared with Discord, so the engine cannot emit web-only
markup. The web recognises the exact `icon + ' ' + name` pair of monsters the room has seen
in `ring.state` this session and swaps the icon for a static sprite. Anything it does not
recognise keeps its emoji, so the failure mode is "looks like today", never "wrong monster".

Icons are player-editable (`editSelf` offers "Icon/color"), so a monster's feed emoji is not
necessarily its species'. With the feature on, the sprite replaces it everywhere — in the
roster it already does — so a monster has one face. The opt-out restores the emoji.

### Only a monster's own emoji is replaced

`docs/voice-and-wording.md` treats emoji as part of the world's voice. The feed swap
replaces a monster's *identity* emoji — the icon before its name — and nothing else: card,
item, effect and Beastmaster emoji stay. Beastmasters have no sprites.

### The theme-feature mechanism is gone

`THEMES[].features`, `useThemeFeature` and the `data-theme-features` attribute existed only
to gate the sprites to the SNES theme. No stylesheet read the attribute. With the gate gone
they were dead code and were removed in T1; `applyTheme` clears the attribute for anyone
upgrading from a build that set it.

### Feed sprites are static

Up to a few dozen visible lines each naming one or two monsters: animating them would be
exactly the "distracting" that got the first version switched off (#166). The roster keeps
the motion; the feed gets a still portrait.

## Process

- Checkpoint commit per task; this table updated in the same commit.
- Every visual claim checked in headless Chromium before it is called done (the recipe in
  `docs/ring-roster-design.md`, "Rendering it without a device"), at the device pixel
  ratios the game is actually played at: 3× (iPhone) and 2× (iPad).
- Independent read-only review per code task, per `AGENTS.md`.
