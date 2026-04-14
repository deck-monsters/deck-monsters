# Pixel Art Animations in JavaScript for the Browser

A practical reference for adding pixel art flair to web apps. Covers Canvas sprite animation, CSS-only techniques, box-shadow pixel painting, and tips for keeping things crisp at any resolution. Designed to be read by an LLM so it can generate pixel art enhancements on your behalf.

## Table of Contents

1. [Crisp Rendering Fundamentals](#crisp-rendering-fundamentals)
2. [Canvas Sprite Sheet Animation](#canvas-sprite-sheet-animation)
3. [CSS-Only Sprite Animation](#css-only-sprite-animation)
4. [Box-Shadow Pixel Painting](#box-shadow-pixel-painting)
5. [Inline Pixel Art with Data URIs](#inline-pixel-art-with-data-uris)
6. [Quick-Add Patterns for Web Apps](#quick-add-patterns-for-web-apps)
7. [Libraries and Frameworks](#libraries-and-frameworks)
8. [Common Pitfalls](#common-pitfalls)
9. [References](#references)

---

## Crisp Rendering Fundamentals

Pixel art looks wrong when the browser applies bilinear or bicubic smoothing during upscaling. Two properties fix this.

### CSS: `image-rendering`

Apply to any element that displays pixel art (images, canvases, backgrounds):

```css
.pixel-art {
  image-rendering: pixelated;          /* Chrome, Edge, Safari */
  image-rendering: crisp-edges;        /* Firefox */
  -ms-interpolation-mode: nearest-neighbor; /* legacy IE */
}
```

### Canvas: `imageSmoothingEnabled`

Disable smoothing on the 2D context before any `drawImage` call:

```javascript
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
```

### Sizing Rule

Scale pixel art by integer multiples (2x, 3x, 4x) to keep every source pixel mapping to an exact grid of screen pixels. Non-integer factors cause uneven pixel sizes, especially on high-DPI screens where `devicePixelRatio` is not a whole number.

```css
/* A 16x16 sprite scaled 4x */
.sprite {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
}
```

---

## Canvas Sprite Sheet Animation

The workhorse technique. A single image contains all animation frames in a grid. You draw one frame at a time using `drawImage` with source-rectangle arguments.

### Sprite Sheet Layout

```
┌────┬────┬────┬────┐
│ f0 │ f1 │ f2 │ f3 │  ← row 0: idle
├────┼────┼────┼────┤
│ f4 │ f5 │ f6 │ f7 │  ← row 1: walk
├────┼────┼────┼────┤
│ f8 │ f9 │f10 │f11 │  ← row 2: jump
└────┴────┴────┴────┘
Each cell is frameWidth × frameHeight pixels.
```

### Minimal Animation Loop

```javascript
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const sprite = new Image();
sprite.src = 'character-sheet.png';

const FRAME_W = 16;
const FRAME_H = 16;
const SCALE = 4;
const COLS = 4;        // frames per row
const FPS = 8;         // animation speed
const FRAME_MS = 1000 / FPS;

let currentFrame = 0;
let row = 0;           // 0=idle, 1=walk, 2=jump
let totalFrames = 4;   // frames in current row
let lastFrameTime = 0;

canvas.width = FRAME_W * SCALE;
canvas.height = FRAME_H * SCALE;

function animate(timestamp) {
  if (timestamp - lastFrameTime >= FRAME_MS) {
    currentFrame = (currentFrame + 1) % totalFrames;
    lastFrameTime = timestamp;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    sprite,
    currentFrame * FRAME_W, row * FRAME_H,   // source x, y
    FRAME_W, FRAME_H,                         // source size
    0, 0,                                     // dest x, y
    FRAME_W * SCALE, FRAME_H * SCALE          // dest size
  );

  requestAnimationFrame(animate);
}

sprite.onload = () => requestAnimationFrame(animate);
```

### Switching Animations

Change `row` and `totalFrames` to switch between animation strips:

```javascript
function setAnimation(name) {
  const anims = {
    idle:  { row: 0, frames: 4 },
    walk:  { row: 1, frames: 4 },
    jump:  { row: 2, frames: 2 },
  };
  const anim = anims[name];
  row = anim.row;
  totalFrames = anim.frames;
  currentFrame = 0;
}
```

---

## CSS-Only Sprite Animation

No JavaScript needed. Use `background-position` with `steps()` timing.

### HTML

```html
<div class="pixel-sprite coin-spin"></div>
```

### CSS

```css
.pixel-sprite {
  image-rendering: pixelated;
  background-repeat: no-repeat;
}

.coin-spin {
  width: 16px;
  height: 16px;
  transform: scale(4);
  transform-origin: top left;
  background-image: url('coin-sheet.png');   /* 4 frames, 64px × 16px total */
  animation: spin 0.5s steps(4) infinite;
}

@keyframes spin {
  from { background-position: 0 0; }
  to   { background-position: -64px 0; }    /* -(frames × frameWidth) */
}
```

The `steps(4)` timing function jumps between exactly 4 positions, so each frame shows for the same duration with no interpolation between them.

### Multi-Row Sprite Sheets

Use separate `@keyframes` blocks that shift `background-position-y` for different animation rows.

---

## Box-Shadow Pixel Painting

Draw pixel art entirely in CSS using `box-shadow`. Each shadow is one pixel. No images, no external requests.

### Basic Pattern

```css
.pixel-heart {
  --px: 8px;           /* pixel scale factor */
  width: var(--px);
  height: var(--px);
  background: transparent;
  box-shadow:
    /* row 1 */
    calc(2 * var(--px)) 0 0 #e74c3c,
    calc(3 * var(--px)) 0 0 #e74c3c,
    calc(5 * var(--px)) 0 0 #e74c3c,
    calc(6 * var(--px)) 0 0 #e74c3c,
    /* row 2 */
    calc(1 * var(--px)) var(--px) 0 #e74c3c,
    calc(2 * var(--px)) var(--px) 0 #e74c3c,
    calc(3 * var(--px)) var(--px) 0 #e74c3c,
    calc(4 * var(--px)) var(--px) 0 #e74c3c,
    calc(5 * var(--px)) var(--px) 0 #e74c3c,
    calc(6 * var(--px)) var(--px) 0 #e74c3c,
    calc(7 * var(--px)) var(--px) 0 #e74c3c,
    /* ... more rows for the full heart shape */
    calc(4 * var(--px)) calc(5 * var(--px)) 0 #e74c3c;
}
```

### Animating Box-Shadow Art

Swap between two shadow sets using keyframes:

```css
.pixel-character {
  animation: walk 0.6s steps(1) infinite;
}

@keyframes walk {
  0%  { box-shadow: /* frame 1 shadow pixels */ ; }
  50% { box-shadow: /* frame 2 shadow pixels */ ; }
}
```

The `steps(1)` per keyframe segment produces an instant swap, no tweening.

### Generating Box-Shadow Strings Programmatically

For LLMs or build tools, generate the `box-shadow` value from a 2D array:

```javascript
function pixelArtToBoxShadow(grid, pxSize = 8) {
  const shadows = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x];
      if (color) {
        shadows.push(`${x * pxSize}px ${y * pxSize}px 0 ${color}`);
      }
    }
  }
  return shadows.join(',\n    ');
}

// Usage — a tiny 3x3 smiley
const smiley = [
  ['#000', null,  '#000'],
  [null,   null,  null  ],
  ['#000', '#000','#000'],
];
console.log(pixelArtToBoxShadow(smiley));
```

---

## Inline Pixel Art with Data URIs

For tiny decorative sprites (icons, bullets, cursors), encode them as data URIs. No network request, no external file.

### From a Small Canvas

```javascript
function createPixelSprite(grid, pixelSize = 1) {
  const w = grid[0].length;
  const h = grid.length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c.toDataURL();
}

// Use it as a CSS background
const star = [
  [null,    null,    '#ff0', null,    null   ],
  [null,    '#ff0',  '#ff0', '#ff0',  null   ],
  ['#ff0',  '#ff0',  '#ff0', '#ff0',  '#ff0' ],
  [null,    '#ff0',  '#ff0', '#ff0',  null   ],
  [null,    null,    '#ff0', null,    null   ],
];
const dataUrl = createPixelSprite(star);
document.querySelector('.star-icon').style.backgroundImage = `url(${dataUrl})`;
```

The resulting 5x5 PNG is under 200 bytes. Apply `image-rendering: pixelated` and scale with CSS for a crisp look at any size.

---

## Quick-Add Patterns for Web Apps

Practical copy-paste patterns for adding pixel art touches.

### Animated Loading Spinner

A small pixelated hourglass or spinner, CSS-only:

```html
<style>
  .pixel-loader {
    width: 8px; height: 8px;
    transform: scale(4);
    transform-origin: top left;
    image-rendering: pixelated;
    background: url('loader-sheet.png') 0 0 no-repeat;
    animation: loader-spin 1s steps(6) infinite;
  }
  @keyframes loader-spin {
    to { background-position: -48px 0; }
  }
</style>
<div class="pixel-loader"></div>
```

### Pixel Art Cursor

```css
.retro-cursor {
  cursor: url('data:image/png;base64,...') 0 0, auto;
  /* Generate the base64 from a tiny canvas using createPixelSprite() */
}
```

### Pixel Art Favicon (Dynamic)

```javascript
function setPixelFavicon(grid) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d');
  const px = 16 / grid.length;
  grid.forEach((row, y) =>
    row.forEach((color, x) => {
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * px, y * px, px, px);
      }
    })
  );
  const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
  link.rel = 'icon';
  link.href = c.toDataURL();
  document.head.appendChild(link);
}
```

### Hover-Reveal Pixel Art

Reveal a hidden sprite on hover using CSS transitions on `opacity` with a `steps(1)` timing:

```css
.pixel-reveal {
  opacity: 0;
  transition: opacity 0s steps(1);
}
.trigger:hover .pixel-reveal {
  opacity: 1;
}
```

### Pixel Art Toast / Notification

Combine a box-shadow character with a slide-in animation:

```css
.pixel-toast {
  position: fixed;
  bottom: 20px; right: 20px;
  padding: 16px 16px 16px 80px;  /* room for the pixel character */
  background: #222;
  color: #0f0;
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  border: 3px solid #0f0;
  animation: toast-slide 0.3s steps(6) forwards;
}
@keyframes toast-slide {
  from { transform: translateY(100px); }
  to   { transform: translateY(0); }
}
```

---

## Libraries and Frameworks

### NES.css

An 8-bit CSS framework providing styled containers, buttons, icons, and text inputs. Pair with a retro font like "Press Start 2P" for full effect.

```html
<link href="https://unpkg.com/nes.css/css/nes.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">

<div class="nes-container is-rounded with-title">
  <p class="title">Status</p>
  <p>All systems operational</p>
  <progress class="nes-progress is-success" value="80" max="100"></progress>
</div>
```

NES.css is decoration only — it styles standard HTML elements and does not include animation or game logic.

Homepage: [nostalgic-css.github.io/NES.css](https://nostalgic-css.github.io/NES.css/)

### Phaser

A full 2D game framework with built-in sprite sheet parsing, animation management, physics, and input handling. Useful when your pixel art needs are closer to a minigame than a decoration.

```javascript
// Phaser 3: load and animate a sprite sheet
this.load.spritesheet('cat', 'cat-sheet.png', { frameWidth: 32, frameHeight: 32 });

this.anims.create({
  key: 'walk',
  frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 3 }),
  frameRate: 8,
  repeat: -1
});

this.add.sprite(100, 100, 'cat').play('walk');
```

### Aseprite (Authoring Tool)

The standard pixel art editor. Exports sprite sheets with JSON frame data that Phaser, Pixi.js, and custom loaders can consume directly. If you are creating original pixel art assets, this is the tool to use.

### PixelLab (AI Generation)

AI-powered pixel art generator for characters, animations, tilesets, and UI elements. Generates sprite sheets with rotations and animations from text prompts. Useful for rapid prototyping when you need assets quickly.

Homepage: [pixellab.ai](https://www.pixellab.ai/)

---

## Common Pitfalls

**Blurry upscaling.** Forgot `image-rendering: pixelated` on the element, or forgot `ctx.imageSmoothingEnabled = false` on the canvas context. Both are needed for their respective rendering paths.

**Non-integer scaling.** Scaling a 16px sprite to 50px (3.125x) causes uneven pixel sizes. Stick to integer multiples: 32, 48, 64, 80, etc.

**Canvas size vs CSS size.** Set the `<canvas>` element's `width`/`height` attributes to the native sprite resolution, then use CSS to scale it up. If you set the canvas attributes to the display size, you're rendering at high resolution and lose the pixel art look.

```html
<!-- Correct: small canvas, CSS scales it up -->
<canvas width="64" height="64" style="width: 256px; height: 256px;"></canvas>
```

**`devicePixelRatio` artifacts.** On high-DPI displays, `image-rendering: pixelated` can produce uneven pixels when the effective scale isn't an integer. If this matters, render to a small offscreen canvas and use `drawImage` to blit it to the display canvas at a computed integer scale.

**Large box-shadow lists.** Box-shadow pixel art with hundreds of shadows can cause layout jank. Keep box-shadow art small (under ~20x20 pixels) or render to canvas and use the result as an image.

**Animation frame timing.** `requestAnimationFrame` fires at display refresh rate (typically 60Hz or higher). Don't advance the sprite frame on every RAF call or the animation will be too fast. Use a frame timer as shown in the canvas example above.

**Sprite sheet padding.** Some sprite sheet tools add 1px padding between frames to prevent bleeding during filtering. Account for this in your source coordinates or disable it in the export settings.

---

## References

- [MDN: Crisp pixel art look with image-rendering](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look)
- [Ben Nadel: Pixel Art with Alpine.js](https://bennadel.github.io/JavaScript-Demos/demos/pixel-art-alpine/index.htm)
- [Gina Moffit: Creating and Animating Pixel Art in JavaScript + Phaser](https://medium.com/geekculture/creating-and-animating-pixel-art-in-javascript-phaser-54b18699442d)
- [NES.css: NES-style CSS Framework](https://nostalgic-css.github.io/NES.css/)
- [kbravh: Interactive Pixel Spritesheet Animation with CSS](https://www.kbravh.dev/interactive-pixel-spritesheet-animations-with-css)
- [CSS3 Shapes: Re-creating 8-Bit Characters with CSS](https://css3shapes.com/re-creating-8-bit-video-game-characters-with-css/)
- [Muffin Man: CSS-only sprite animations](https://muffinman.io/blog/css-only-sprite-animations/)
- [Alec Horner: Animating Sprites with CSS and React](https://alechorner.com/blog/animating-pixel-sprites-with-css)
- [PixelLab: AI Pixel Art Generator](https://www.pixellab.ai/)
