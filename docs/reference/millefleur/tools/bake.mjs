// Bake Millefleur's watercolour from the approved samples into the images the app uses.
//
// Usage (from this folder): node bake.mjs [outDir]
//   default outDir: ../../../../apps/web/src/themes/millefleur-paint
//
// Why baked: the paint is SVG filters (two-scale warp, cloud-noise pigment, an eroded rim where
// the wash dried, multiply glazing). Run live they repaint on every scroll frame (roadmap 46 §5),
// and approximating them in CSS gradients gave an "amorphous blurry gradient" the owner rejected
// (2026-10-06). So the app shows the samples' own paint, rendered once here:
//
// - one wash image per surface (ring, workshop, chat): each sample's wash layers only, over its
//   paper colour, at 2x. The paper's fibre and grain are left out of these, because a baked grain
//   scales with the image and goes soft on a wide screen.
// - sheet: the level-up sample's painted header (its washes and grain, as drawn there), at 2x.
// - grain: the samples' fibre and grain as one 256px tile that repeats crisply at any width.
//
// Needs Playwright and Chromium, as render.mjs does (see its header). Re-run after changing a
// sample's paint, then look at the results (and the app) before committing them.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const samples = resolve(here, '../samples');
const out = resolve(process.argv[2] ?? resolve(here, '../../../../apps/web/src/themes/millefleur-paint'));
mkdirSync(out, { recursive: true });

function loadPlaywright() {
  const roots = [import.meta.url];
  try { roots.push(`${execSync('npm root -g').toString().trim()}/`); } catch { /* no npm */ }
  for (const root of roots) {
    try { return createRequire(root)('playwright'); } catch { /* next */ }
  }
  console.error('Playwright not found. Run: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}
const { chromium } = loadPlaywright();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await (await browser.newContext({ viewport: { width: 400, height: 960 }, deviceScaleFactor: 2 })).newPage();

/** Pull the first `<svg aria-hidden="true" …>…</svg>` that has the given width/height out of a sample. */
function sampleSvg(name, width, height) {
  const html = readFileSync(resolve(samples, `${name}.html`), 'utf8');
  const re = new RegExp(`<svg aria-hidden="true" width="${width}" height="${height}"[\\s\\S]*?</svg>`);
  const m = html.match(re);
  if (!m) throw new Error(`${name}: no ${width}x${height} paint svg`);
  return m[0].replace(/style="[^"]*"/, '');
}

/** Drop the grain and fibre rects (the paper), keeping only the washes. */
const washesOnly = (svg) => svg.replace(/<rect[^>]*filter="url\(#\w+[fg]\)"[^>]*>(<\/rect>)?/g, '');

async function bake(file, svg, w, h, paper, quality = 0.84) {
  await page.setContent(
    `<!doctype html><body style="margin:0;background:${paper}">` +
      `<div id="b" style="width:${w}px;height:${h}px;background:${paper};isolation:isolate">${svg}</div></body>`,
  );
  await page.waitForTimeout(300);
  const png = await page.locator('#b').screenshot({ type: 'png' });
  // Encode WebP in the browser (Chromium's encoder), so no image tooling is needed here.
  const webp = await page.evaluate(async ([b64, q]) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = `data:image/png;base64,${b64}`; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', q).split(',')[1];
  }, [png.toString('base64'), quality]);
  const buf = Buffer.from(webp, 'base64');
  writeFileSync(resolve(out, file), buf);
  console.log(`${file}\t${w * 2}x${h * 2}\t${(buf.length / 1024).toFixed(1)} KB`);
}

const PAPER = '#fbf8f5';
for (const name of ['ring', 'workshop', 'chat']) {
  await bake(`${name}.webp`, washesOnly(sampleSvg(name, 390, 940)), 390, 940, PAPER);
}
await bake('sheet.webp', sampleSvg('level-up', 390, 520), 390, 520, '#fdfaf6');

// The paper: fibre and grain from the ring sample, on a 128 CSS px square rendered at 2x (a
// 256px image), shown at 128px so the grain keeps the samples' scale. The grain's turbulence
// stitches its tiles; the fibre's does not, so look at a tiled render for a seam after re-baking.
const ring = sampleSvg('ring', 390, 940);
const defs = ring.match(/<defs>[\s\S]*?<\/defs>/)[0];
const paperRects = (ring.match(/<rect[^>]*filter="url\(#\w+[fg]\)"[^>]*>(<\/rect>)?/g) ?? [])
  .map((r) => r.replace(/width="\d+"/, 'width="128"').replace(/height="\d+"/, 'height="128"').replace(/style="[^"]*"/, 'style="mix-blend-mode:multiply"'));
await bake('grain.webp', `<svg width="128" height="128">${defs}${paperRects.join('')}</svg>`, 128, 128, '#ffffff', 0.8);

await browser.close();
