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
// Needs Playwright (globally installed here; `npm i -g playwright` elsewhere).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(`${execSync('npm root -g').toString().trim()}/`);
const { chromium } = require('playwright');

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

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale })).newPage();
await page.goto(`file://${tmp}`);
await page.evaluate(() => document.fonts.ready);
const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
console.log('fonts loaded:', [...new Set(loaded)].join(', ') || 'none (fallbacks in use)');
const jpeg = out.endsWith('.jpg') || out.endsWith('.jpeg');
await page.screenshot({ path: out, ...(jpeg ? { type: 'jpeg', quality: 82 } : {}) });
await browser.close();
execSync(`rm -f "${tmp}"`);
