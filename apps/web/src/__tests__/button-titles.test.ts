/**
 * Every `<button>` in the web app must carry a `title` (roadmap 39 batch 3, task 7).
 *
 * Why: a phone never shows a title, but desktop hover and screen readers do, so a title is
 * the one-line answer to "what does this do?" for everyone who is not on a touchscreen. The
 * rule is only kept if it is enforced: a new button without a title fails here, so someone
 * has to decide what its line says. (On a phone the visible label must carry the meaning.)
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest runs with apps/web as the working directory (jsdom, so import.meta.url is not a file URL).
const SRC = join(process.cwd(), 'src');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      out.push(...tsxFiles(full));
    } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** If a line or block comment starts at `i`, the index just past it; otherwise -1. Comments may hold quotes. */
function skipComment(source: string, i: number): number {
  if (source[i] !== '/') return -1;
  if (source[i + 1] === '/') {
    const nl = source.indexOf('\n', i);
    return nl === -1 ? source.length : nl;
  }
  if (source[i + 1] === '*') {
    const close = source.indexOf('*/', i + 2);
    return close === -1 ? source.length : close + 1;
  }
  return -1;
}

/** Returns the opening tag text starting at `start` (just after `<button`), tracking `{}` depth and quotes. */
function openingTagEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (depth === 0) {
      // A `// comment` between attributes (used for DRAFT notes) can contain apostrophes.
      const past = skipComment(source, i);
      if (past !== -1) { i = past; continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '>') return i;
      continue;
    }
    // Inside a {...} expression: strings and template literals can hide braces.
    const past = skipComment(source, i);
    if (past !== -1) { i = past; continue; }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  return source.length;
}

/** Top-level attribute names of an opening tag's attribute text. */
function hasTitleAttribute(attrs: string): boolean {
  let depth = 0;
  let quote: string | null = null;
  let top = '';
  for (let i = 0; i < attrs.length; i++) {
    const ch = attrs[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    const past = skipComment(attrs, i);
    if (past !== -1) { i = past; continue; }
    if (ch === '"' || ch === "'" || (depth > 0 && ch === '`')) { quote = ch; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { depth--; continue; }
    if (depth === 0) top += ch;
  }
  return /(^|\s)title\s*=/.test(top);
}

describe('button titles', () => {
  it('every <button> has a title attribute', () => {
    const missing: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      const re = /<button(?=[\s>])/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) {
        const start = m.index + m[0].length;
        const end = openingTagEnd(source, start);
        if (!hasTitleAttribute(source.slice(start, end))) {
          const line = source.slice(0, m.index).split('\n').length;
          missing.push(`${relative(SRC, file)}:${line}`);
        }
      }
    }
    expect(missing, `buttons without a title:\n${missing.join('\n')}`).toEqual([]);
  });
});
