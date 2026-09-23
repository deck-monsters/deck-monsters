# Pixel Art Fight Animations (Theme-Gated)

> Historical record. Current code and documents linked from `docs/README.md` are
> authoritative. Any remaining work has been copied to the active roadmap.

> **Archived** — shipped; kept for the reasoning and constraints. Leftovers, if any, are tracked in [22 — Small Leftovers](../../roadmap/22-small-leftovers.md).

**Category**: Enhancement / UX  
**Priority**: Low — post-launch, fun  
**Status**: ✅ Shipped — `street-fighter` theme only  
**Depends on**: `09-graphics.md` (theme system), `06a-web-app.md` (web app theme CSS vars)  
**Reference**: [`docs/reference/pixel-art.md`](../../reference/pixel-art.md)

---

## Concept

Certain themes — specifically retro/SNES-style themes — add pixel art fight animations layered on top of the text ring feed. Every other theme stays clean and text-first. This is **progressive enhancement**: the text feed is always the baseline; animations are an opt-in visual layer that never replaces or delays the text.

The default "dungeon terminal" theme has no animations. A player switching to the SNES theme gets animated fight sequences on top of the same text feed everyone else sees.

---

## Scope

### In scope
- The existing `street-fighter` SNES theme activates a pixel art animation layer
- Per-event animations triggered by the public ring feed's real event types and combat payloads
- Monster sprites: one idle animation + one attack animation per monster type (5 types: Basilisk, Gladiator, Jinn, Minotaur, Weeping Angel)
- A `<canvas>` overlay that sits on top of the ring pane during a fight sequence, then fades out when narration resumes
- Theme selector in Account settings (already planned in Phase 3 of `06a-web-app.md`)

### Out of scope
- Animations in the default theme or any non-retro theme
- Replacing any text with animation — the narration always plays normally
- Mobile app (deferred)
- Sound effects (separate concern if ever)

---

## How It Fits the Architecture

The web app receives `GameEvent` objects from the tRPC subscription. The animation layer subscribes to the same event stream, but only activates when the active theme declares `supportsPixelArt: true`.

```
GameEvent stream
     │
     ├── text renderer (always)  →  ring pane text feed
     └── animation layer (theme-gated)  →  canvas overlay
```

The animation layer is a standalone module that the web app loads only when the active theme needs it — no bundle cost for users on the default theme.

---

## Implementation

See `docs/reference/pixel-art.md` for the full reference. Summary of choices for this feature:

### In-code pixel maps via Canvas API

`apps/web/src/animations/pixel-fight/sprites.ts` defines reviewable, testable 24×24
pixel maps for Basilisk, Gladiator, Jinn, Minotaur, and Weeping Angel, plus a
fallback silhouette. (They shipped at 16×16 and were redrawn — see the redraw note
below.) Each has idle, attack, hit, and faint frames; the renderer
mirrors frames for the opposing side and adds the hit flash. No asset pipeline exists
today, so in-code maps avoid an opaque generated artifact and network requests.

`drawSprite` remains the boundary between scene state and pixels. A later sprite-sheet
pipeline can replace these maps behind that same signature. The canvas disables image
smoothing, uses integer 3× sprites (2× below 480px), and is device-pixel-ratio aware.
Its requestAnimationFrame loop accumulates elapsed time rather than advancing per
browser repaint: idle frames run at 8 FPS and attack frames at 12 FPS. A wall-clock
deadline settles attack, hit, flee, and fade state even when no later feed event arrives.

### Event → animation mapping

| GameEvent type | `payload.combat.kind` | Animation triggered |
|----------------|-----------------------|---------------------|
| `ring.fight` with `payload.eventName: 'fightBegins'` | — | Contestants enter from opposite sides; idle loop begins |
| `card.played` | `card` | Actor plays the attack animation |
| `announce` | `hit` | Target plays a hit flash and its HP bar updates |
| `announce` | `miss` | Actor attacks; target stays idle |
| `announce` | `heal` | Target HP bar updates |
| `announce` | `death` | Target plays the faint animation |
| `ring.fled` | `flee` | Fleeing actor runs off screen |
| `ring.fight` with `payload.eventName: 'fightConcludes'` or `ring.fightResolved` | — | Fade the decorative layer after the fight resolves |

The layer reads `payload.combat`, never narration prose. It uses the shared
`RingFeedProvider` listener rather than opening another subscription. `ring.state` is
the authoritative roster/HP snapshot: combat DTOs animate intervening changes, while a
later state frame corrects the display.

### Canvas overlay positioning

The canvas is a lazy-loaded sibling of Virtuoso inside `RingPane`'s
`.pane-feed-area`, absolutely positioned over the top 200px of the feed. It is
`aria-hidden` and `pointer-events: none`; the text feed continues to scroll and accepts
input without waiting for any animation. It fades after the engine reports the fight
resolved.

### CSS fallback

For very small (`.terminal-slot` container ≤360px) or short (≤600px) viewports, the
canvas is hidden and the fight plays out as text only. Reduced-motion users receive one
static frame for each scene change, with no RAF loop or opacity transition. The canvas
is decorative and non-interactive, so these fallbacks have no functional impact.

---

## Theme System Hook

The existing theme system uses CSS custom properties and a `data-theme-features`
attribute on `<html>` to signal optional modules. One external theme store backs both
theme switchers and feature consumers, including same-tab changes; its `storage`
listener synchronizes other tabs.

```html
<!-- Default theme: no pixel art -->
<html>

<!-- SNES theme: pixel art module loads -->
<html data-theme="street-fighter" data-theme-features="pixel-art">
```

`useTheme.ts` owns a typed `THEMES` registry. The `street-fighter` entry declares
`pixel-art`. Theme switches update both attributes on `<html>` and unmount the layer when
the feature is absent.

The theme feature is no longer the *only* gate: `usePixelFightStage` adds a player opt-in
that defaults off (#166), so the module loads only for someone on the theme who has asked
for it. Anything reasoning about "are the sprites showing" must check both.

**The canvas band described in this plan no longer exists.** It duplicated the Ring
roster's HP bars and cost 96–200px of viewport; the sprites now draw inside the roster rows
(#167), and the scene model — sides, per-side caps, the `active` flag, the fade timer and
the `inEncounter` adoption — went with it. See
[`docs/roadmap/23-pixel-fight-stage.md`](../../architecture/ring-roster-and-pixel-monsters.md). The
sections below are kept as the record of how the feature was first built.

---

## Asset Pipeline

The initial release deliberately has no image assets. The in-code maps are easy to
review and their 16×16 shape/palette contract has a unit test. If art direction later
requires Aseprite/PixelLab sheets, the renderer can adopt them without changing scene
reduction or feed wiring.

---

## Implementation order (completed)

1. Added the typed theme registry and `data-theme-features` attribute; Account radios
   now derive from the same registry.
2. Added the reducer, in-code sprites, renderer, canvas layer, and focused tests.
3. Mounted the layer lazily in `RingPane` under the `pixel-art` feature flag, using the
   existing shared ring-feed listener and roster frame.
4. Added CSS positioning, small/short viewport fallbacks, and reduced-motion handling.

## Gotchas learned live (keep when touching the layer)

- **Time-driven transitions must re-arm.** `setTimeout` is clamped to whole ms while
  `performance.now()` is sub-ms, so a timer can wake a fraction early; if `settle()` then
  returns the same scene, React skips the render and the `[scene]` effect never re-runs.
  The band sat "active" for ~90 s live until an unrelated feed event arrived (bug #162).
  `PixelFightLayer` loops until the deadline has genuinely passed — do not simplify it back
  to a single timeout.
- **The roster empties inside the fade.** The `ring.state` frame that clears the ring lands
  within the 2.5 s fade window after `fightConcludes`; the reducer holds the fighters while
  `fadeOutAt` is set so the fallen pose is actually seen.
- **One literal map per monster; poses are transforms.** `sprites.ts` derives the idle bob,
  attack wind-up/lunge, hit recoil and the sideways fallen pose from a single hand-drawn
  24×24 map. A redraw that ships six identical frames passes the shape test but animates
  nothing — the sprite test asserts frames differ, the lunge moves toward the opponent, and
  the fallen box swaps axes.
- **The stage is a docked band, not an overlay (#165).** It began as an absolutely
  positioned canvas across the top of the feed, so sprites sat on top of the narration —
  the one thing this layer must never obscure, since the text *is* the game. It is now a
  flex sibling above the feed that collapses to zero height between fights.
- **`inEncounter` is how you join a fight already running (#165).** `fightBegins` is a
  one-shot live event; opening a room mid-fight or returning to a backgrounded phone tab
  never replays it, so the stage stayed dark until the *next* fight. `ring.state` already
  carries `inEncounter` (whole-fight, set by `Ring.startEncounter`/`endEncounter`), so the
  reducer adopts it. It is **optional on the wire** — treat `undefined` as *unknown*, never
  as "no fight", or a payload that omits it collapses a live stage.
- **The 16×16 redraw (#164).** The maps shipped at 16×16 and every monster came out as the
  same rounded blob; poses were whole-sprite translations, so nothing appeared to move. The
  art is now 24×24 on a six-key ramp, poses shear about the feet instead of translating, and
  frames render on a padded grid so a lean cannot clip a horn or a wingtip. The sprite test
  gained a silhouette-collision check, a no-clipping check and a shear-not-translation check
  so none of the three can come back quietly. `docs/reference/pixel-art.md` ("Common
  Pitfalls") records the general lessons.
- **Live-verify in the phone layout.** The layer hides when the pane container is under
  360 px wide or the viewport under 600 px tall, and drops to 3× sprites under 480 px; the
  Cursor Cloud Chrome window is narrow, so raise the right window (`xdotool windowraise`)
  before an `x11grab` capture or the recording silently shows another Chrome window.

## Known gaps (no combat DTO yet)

These follow-ups need engine-side payloads; the layer tolerates the available omissions
without delaying the feed.

- Fully absorbed melee hits only narrate in `packages/engine/src/creatures/health.ts`.
- Delayed Hit's payoff has a hit/miss DTO but no new card DTO in
  `packages/engine/src/cards/delayed-hit.ts`.
- Bad Batch's poison trigger has a hit DTO but no card DTO in
  `packages/engine/src/cards/bad-batch.ts`.
- Immobilize status ticks and freedom rolls have no combat DTO in
  `packages/engine/src/cards/immobilize.ts`.
- Non-HP curses/modifiers publish no structured target in
  `packages/engine/src/cards/curse.ts` and
  `packages/engine/src/announcements/modifier.ts`.
- Failed flee rolls have no combat DTO in `packages/engine/src/cards/flee.ts` and
  `packages/engine/src/announcements/stay.ts`.

---

## Non-Goals

- Don't animate the default terminal theme — ever
- Don't block text narration waiting for an animation to finish
- Don't add animations to Discord (text-only connector)
- Don't require the animation module to load for users on other themes
