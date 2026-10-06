import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES } from '../hooks/useTheme.js';

/**
 * index.html carries an inline script that sets data-theme and <meta name="theme-color">
 * before first paint (applyTheme only runs after React mounts). It cannot import THEMES, so
 * it repeats the id -> colour map. These tests keep the copy honest, and run the script for
 * real, including the case where localStorage throws.
 */
const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;

const CSS_FILE: Record<string, string> = {
  phosphor: 'theme-phosphor.css',
  amber: 'theme-amber.css',
  ember: 'theme-ember.css',
  'street-fighter': 'theme-street-fighter.css',
};

function inlineMap(): Record<string, string> {
  const body = script.match(/var colors = \{([\s\S]*?)\};/)![1]!;
  const map: Record<string, string> = {};
  for (const m of body.matchAll(/'?([a-z-]+)'?\s*:\s*'(#[0-9a-f]{6})'/gi)) map[m[1]!] = m[2]!;
  return map;
}

describe('index.html pre-paint theme script', () => {
  it('has a colour for exactly the ids in THEMES, equal to their themeColor', () => {
    expect(inlineMap()).toEqual(Object.fromEntries(THEMES.map(({ id, themeColor }) => [id, themeColor])));
  });

  it('uses each theme stylesheet\'s --color-bg as its themeColor', () => {
    for (const { id, themeColor } of THEMES) {
      const file = CSS_FILE[id];
      expect(file, `add ${id} to CSS_FILE in this test`).toBeDefined();
      const css = readFileSync(join(process.cwd(), 'src/styles', file!), 'utf8');
      expect(css.match(/--color-bg:\s*(#[0-9a-f]{6})/i)![1], id).toBe(themeColor);
    }
  });

  describe('when run', () => {
    beforeEach(() => {
      localStorage.clear();
      document.documentElement.removeAttribute('data-theme');
      document.head.innerHTML = '<meta name="theme-color" content="#0a0e0a">';
    });
    afterEach(() => {
      localStorage.clear();
      document.documentElement.removeAttribute('data-theme');
    });

    const meta = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content');

    it('applies a stored theme and its colour', () => {
      localStorage.setItem('deck-monsters-theme', 'ember');
      new Function(script)();
      expect(document.documentElement.getAttribute('data-theme')).toBe('ember');
      expect(meta()).toBe('#12060a');
    });

    it('leaves phosphor as the bare :root', () => {
      localStorage.setItem('deck-monsters-theme', 'phosphor');
      new Function(script)();
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(meta()).toBe('#0a0e0a');
    });

    it('ignores an unknown stored id', () => {
      localStorage.setItem('deck-monsters-theme', 'toString');
      new Function(script)();
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(meta()).toBe('#0a0e0a');
    });

    it('survives localStorage throwing', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('blocked', 'SecurityError'); },
      });
      try {
        expect(() => new Function(script)()).not.toThrow();
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      } finally {
        Object.defineProperty(window, 'localStorage', original);
      }
    });
  });
});
