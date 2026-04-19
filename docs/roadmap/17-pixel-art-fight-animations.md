# Pixel Art Fight Animations (Theme-Gated)

**Category**: Enhancement / UX  
**Priority**: Low — post-launch, fun  
**Status**: Proposed  
**Depends on**: `09-graphics.md` (theme system), `06a-web-app.md` (web app theme CSS vars)  
**Reference**: [`docs/pixel-art-animations-in-js.md`](../pixel-art-animations-in-js.md)

---

## Concept

Certain themes — specifically retro/SNES-style themes — add pixel art fight animations layered on top of the text ring feed. Every other theme stays clean and text-first. This is **progressive enhancement**: the text feed is always the baseline; animations are an opt-in visual layer that never replaces or delays the text.

The default "dungeon terminal" theme has no animations. A player switching to the SNES theme gets animated fight sequences on top of the same text feed everyone else sees.

---

## Scope

### In scope
- A `snes` theme (or similar retro label) that activates a pixel art animation layer
- Per-event animations triggered by `GameEvent` types: `ring.fight`, `ring.card`, `ring.hit`, `ring.miss`, `ring.flee`, `ring.victory`
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

## Technical Approach

See `docs/pixel-art-animations-in-js.md` for the full reference. Summary of choices for this feature:

### Sprite sheets via Canvas API

Use the sprite sheet + `drawImage` approach for fight sequences. Each monster type has one sprite sheet with rows for: `idle`, `attack`, `hit`, `faint`.

```
16×16 or 32×32 source pixels, scaled 4× (64×64 or 128×128 displayed)
8 FPS for idle loops, 12 FPS for attack sequences
```

```ts
// Disable smoothing — required for pixel art to stay sharp
ctx.imageSmoothingEnabled = false

// Draw one frame
ctx.drawImage(
  spriteSheet,
  frame * FRAME_W, row * FRAME_H,   // source crop
  FRAME_W, FRAME_H,
  destX, destY,
  FRAME_W * SCALE, FRAME_H * SCALE  // scaled up
)
```

### Event → animation mapping

| GameEvent type | Animation triggered |
|---------------|---------------------|
| `ring.fight` starts | Both monsters enter frame from opposite sides, idle loop begins |
| `ring.card` (attacker plays card) | Attacker plays attack animation |
| `ring.hit` | Defender plays `hit` frame flash (2–3 frames), HP bar updates |
| `ring.miss` | Attacker plays miss animation, defender stays idle |
| `ring.flee` | Fleeing monster runs off screen |
| `ring.victory` | Winner plays victory loop, loser plays faint |

### Canvas overlay positioning

The canvas sits absolutely positioned over the ring pane, full-width, fixed height (~200px). It fades in when a fight event arrives and fades out when the text narration is complete. The text feed beneath continues to scroll normally — the animation never obscures the text that matters.

### CSS fallback

For very small viewports (narrow mobile in SNES theme), the canvas is hidden and the fight plays out as text only. The canvas is decorative and non-interactive, so hiding it has no functional impact.

---

## Theme System Hook

The existing theme system (CSS custom properties, class on `<body>`) needs one addition: a `data-theme-features` attribute or equivalent that signals to JS which optional modules to activate.

```html
<!-- Default theme: no pixel art -->
<body data-theme="terminal">

<!-- SNES theme: pixel art module loads -->
<body data-theme="snes" data-theme-features="pixel-art">
```

The animation module checks `document.body.dataset.themeFeatures` and self-initializes only when `pixel-art` is present. Theme switches (in Account settings) dynamically update both attributes, triggering the module to activate or teardown.

---

## Asset Pipeline

Sprites can be created via any combination of:

- **Aseprite** — standard pixel art editor; exports sprite sheets with JSON frame metadata
- **PixelLab** (pixellab.ai) — AI-assisted pixel art generation from text prompts; good for rapid prototyping of all 5 monster types
- **Box-shadow CSS** — for completely asset-free pixel art for simple monsters (see reference doc); no images, no requests, pure CSS

Start with PixelLab to rapidly generate candidate sprites for all 5 monster types. Refine in Aseprite. Use box-shadow as a fallback for any monster that doesn't have a sprite sheet yet — it degrades cleanly.

Sprite sheets live in `apps/web/public/sprites/` and are lazily loaded by the animation module only when the SNES theme is active.

---

## Implementation Order

When the time comes (post-launch), tackle in this order:

1. **Theme selector UI** (prerequisite — already in Phase 3 of `06a-web-app.md`): add SNES theme stub with `data-theme-features="pixel-art"`
2. **Animation module scaffold**: canvas overlay, event listener, theme-feature guard, teardown on theme change
3. **One monster sprite** (Basilisk): idle + attack + hit + faint; wire to `ring.fight` / `ring.hit` events
4. **Remaining 4 monster sprites** once the pipeline is proven
5. **Polish**: HP bar overlay on canvas, entry/exit transitions, victory sequence

Each step is independently shippable — the theme flag keeps it invisible until ready.

---

## Non-Goals

- Don't animate the default terminal theme — ever
- Don't block text narration waiting for an animation to finish
- Don't add animations to Discord (text-only connector)
- Don't require the animation module to load for users on other themes
