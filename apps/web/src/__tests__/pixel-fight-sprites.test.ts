import { describe, expect, it, vi } from 'vitest';
import { drawSprite } from '../animations/pixel-fight/renderer.js';
import { SPRITES, SPRITE_ART, SPRITE_COLS, SPRITE_PAD, spriteFor } from '../animations/pixel-fight/sprites.js';

const CREATURE_TYPES = ['Basilisk', 'Gladiator', 'Jinn', 'Minotaur', 'Weeping Angel', 'Unicorn', 'fallback'];

function bounds(frame: readonly string[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  frame.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === '.') return;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }));
  return { width: maxX - minX + 1, height: maxY - minY + 1, minX, maxX, minY, maxY };
}

const opaque = (frame: readonly string[]) => frame.join('').replaceAll('.', '');

describe('pixel fight sprites', () => {
  it('keeps every pose frame on the padded grid, using only palette keys', () => {
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      for (const [animation, frames] of Object.entries(sprite.frames)) {
        for (const frame of frames) {
          expect(frame, `${creatureType} ${animation}`).toHaveLength(SPRITE_ART);
          for (const row of frame) {
            expect(row, `${creatureType} ${animation}`).toHaveLength(SPRITE_COLS);
            for (const pixel of row) {
              expect(
                pixel === '.' || pixel in sprite.palette,
                `${creatureType} ${animation} uses ${pixel}`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it('provides each required animation for every creature and the fallback', () => {
    for (const creatureType of CREATURE_TYPES) {
      const frames = SPRITES[creatureType].frames;
      expect(frames.idle).toHaveLength(2);
      expect(frames.attack).toHaveLength(2);
      expect(frames.hit).toHaveLength(1);
      expect(frames.faint).toHaveLength(1);
    }
  });

  it('never clips a pose off the edge of the grid', () => {
    // The whole reason the grid is wider than the art: a lean swings the top of the
    // sprite sideways, and on the old flush grid that silently ate wingtips and horns.
    // Every pose must keep exactly as many opaque pixels as the drawing it came from.
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      const drawn = opaque(sprite.frames.idle[0]).length;
      for (const [animation, frames] of Object.entries(sprite.frames)) {
        for (const frame of frames) {
          expect(opaque(frame).length, `${creatureType} ${animation} lost pixels`).toBe(drawn);
        }
      }
    }
  });

  it('draws the art inside its box, so a lean does not shove the fighter sideways', () => {
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      const box = bounds(sprite.frames.idle[0]);
      expect(box.minX, `${creatureType} art starts at the pad`).toBeGreaterThanOrEqual(SPRITE_PAD);
      expect(box.maxX, `${creatureType} art ends before the pad`).toBeLessThan(SPRITE_PAD + SPRITE_ART);
    }
  });

  it('actually changes pose: idle bobs, attack winds up then lunges, faint lies down', () => {
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      const { idle, attack, hit, faint } = sprite.frames;
      expect(idle[1], `${creatureType} idle bob`).not.toEqual(idle[0]);
      expect(attack[0], `${creatureType} attack wind-up`).not.toEqual(idle[0]);
      expect(attack[1], `${creatureType} attack lunge`).not.toEqual(attack[0]);
      expect(hit[0], `${creatureType} hit recoil`).not.toEqual(idle[0]);

      // A lean is a shear, not a translation: the head travels and the feet stay put.
      // Comparing only the top and bottom thirds catches a regression to whole-sprite
      // shifts, which is what made the first version look frozen.
      const topOf = (frame: readonly string[]) => bounds(frame.slice(0, 8)).minX;
      const bottomOf = (frame: readonly string[]) => bounds(frame.slice(16)).minX;
      expect(topOf(attack[1]), `${creatureType} lunges head-first`).toBeGreaterThan(topOf(idle[0]));
      expect(topOf(hit[0]), `${creatureType} recoils head-first`).toBeLessThan(topOf(idle[0]));
      expect(
        topOf(attack[1]) - topOf(idle[0]),
        `${creatureType} leans rather than translating`,
      ).toBeGreaterThan(bottomOf(attack[1]) - bottomOf(idle[0]));

      // Lying down = the standing pose turned on its side, so the box swaps axes.
      const standing = bounds(idle[0]);
      const fallen = bounds(faint[0]);
      expect(faint[0], `${creatureType} faint differs from idle`).not.toEqual(idle[0]);
      expect([fallen.width, fallen.height], `${creatureType} faint is the standing pose on its side`)
        .toEqual([standing.height, standing.width]);
    }
  });

  it('shades each monster with the full six-key ramp and enough body to read', () => {
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      expect(Object.keys(sprite.palette).sort(), `${creatureType} palette`)
        .toEqual(['A', 'B', 'C', 'D', 'E', 'O']);
      const used = new Set(opaque(sprite.frames.idle[0]));
      expect(used, `${creatureType} leaves part of its ramp unused`).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'O']));
      expect(opaque(sprite.frames.idle[0]).length, `${creatureType} is too sparse to read`)
        .toBeGreaterThanOrEqual(200);
    }
  });

  it('gives every monster its own silhouette', () => {
    // The 16x16 originals were near-identical blobs. Two monsters sharing a silhouette
    // is the failure this guards against.
    const seen = new Map<string, string>();
    for (const creatureType of CREATURE_TYPES) {
      const mask = SPRITES[creatureType].frames.idle[0]
        .map((row) => [...row].map((pixel) => (pixel === '.' ? '.' : '#')).join(''))
        .join('\n');
      expect(seen.has(mask), `${creatureType} and ${seen.get(mask)} share a silhouette`).toBe(false);
      seen.set(mask, creatureType);
    }
  });

  it('draws one rectangle for each opaque pixel', () => {
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      for (const frames of Object.values(sprite.frames)) {
        for (const frame of frames) {
          const fillRect = vi.fn();
          drawSprite({
            imageSmoothingEnabled: true,
            save: vi.fn(),
            restore: vi.fn(),
            fillRect,
          } as unknown as CanvasRenderingContext2D, frame, sprite.palette, 0, 0, 1, { mirror: false, flash: false });
          expect(fillRect, creatureType).toHaveBeenCalledTimes(opaque(frame).length);
        }
      }
    }
  });

  it('uses the generic beast for unknown creature types', () => {
    expect(spriteFor('Unknown monster')).toBe(SPRITES.fallback);
  });
});
