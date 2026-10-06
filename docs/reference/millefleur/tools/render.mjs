// Render a Millefleur mockup to an image, so a design change is looked at before it is shown.
//
// Usage (from this folder):
//   node render.mjs ../samples/workshop.html workshop.png [width] [height] [scale]
//
// Why this exists: rounds v1 to v3 were published without anyone rendering them, and every
// round had faults that only show in pixels (round blobs, bubbly tabs, chat text sitting
// across the ruled lines, a clipped tab). Render, look, fix, render again.
//
// Fonts: Chromium in the cloud sandbox cannot always reach Google Fonts. If the render shows
// fallback fonts, download the woff2 files the page's Google Fonts link names into a local
// fonts/ folder with a fonts.css beside them, and set FONTS_CSS=/abs/path/to/fonts.css; the
// script then swaps the Google link for that file.
//
// Setup: Playwright is not a workspace dependency (this is a design tool, not part of the app),
// so install it once wherever you run this:
//   npm i -g playwright && npx playwright install chromium
// The script looks for Playwright beside this file first, then in the global npm root. If a
// Chromium is already installed elsewhere (the cloud container has one at
// /opt/pw-browsers/chromium), set CHROMIUM_PATH to it and skip `playwright install`.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadPlaywright() {
  const roots = [import.meta.url];
  try {
    roots.push(`${execSync('npm root -g').toString().trim()}/`);
  } catch {
    // no npm on PATH; only the local lookup is possible
  }
  for (const root of roots) {
    try {
      return createRequire(root)('playwright');
    } catch {
      // try the next root
    }
  }
  console.error('Playwright not found. Run: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}
const { chromium } = loadPlaywright();

const [src, out, w = '390', h = '940', scale = '2'] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node render.mjs <page.html> <out.png|out.jpg> [width] [height] [scale]');
  process.exit(1);
}
let html = readFileSync(src, 'utf8');
if (process.env.FONTS_CSS) {
  html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, `<link rel="stylesheet" href="file://${process.env.FONTS_CSS}">`);
}
const tmp = resolve(`${out}.tmp.html`);
writeFileSync(tmp, html);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale })).newPage();
await page.goto(`file://${tmp}`);
await page.evaluate(() => document.fonts.ready);
const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
console.log('fonts loaded:', [...new Set(loaded)].join(', ') || 'none (fallbacks in use)');
const jpeg = out.endsWith('.jpg') || out.endsWith('.jpeg');
await page.screenshot({ path: out, ...(jpeg ? { type: 'jpeg', quality: 82 } : {}) });
await browser.close();
execSync(`rm -f "${tmp}"`);
