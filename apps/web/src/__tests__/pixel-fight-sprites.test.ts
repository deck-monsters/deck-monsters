import { describe, expect, it, vi } from 'vitest';
import { drawSprite } from '../animations/pixel-fight/renderer.js';
import { SPRITES, spriteFor } from '../animations/pixel-fight/sprites.js';

describe('pixel fight sprites', () => {
  it('keeps every monster frame as a 16 by 16 palette-key map', () => {
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      for (const [animation, frames] of Object.entries(sprite.frames)) {
        for (const frame of frames) {
          expect(frame, `${creatureType} ${animation}`).toHaveLength(16);
          for (const row of frame) {
            expect(row, `${creatureType} ${animation}`).toHaveLength(16);
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
    for (const creatureType of ['Basilisk', 'Gladiator', 'Jinn', 'Minotaur', 'Weeping Angel', 'fallback']) {
      const frames = SPRITES[creatureType].frames;
      expect(frames.idle).toHaveLength(2);
      expect(frames.attack).toHaveLength(2);
      expect(frames.hit).toHaveLength(1);
      expect(frames.faint).toHaveLength(1);
    }
  });

  it('actually moves: idle bobs, attack lunges, and faint lies down', () => {
    const bounds = (frame: readonly string[]) => {
      let minX = 16, maxX = -1, minY = 16, maxY = -1;
      frame.forEach((row, y) => [...row].forEach((pixel, x) => {
        if (pixel === '.') return;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }));
      return { width: maxX - minX + 1, height: maxY - minY + 1, minX, minY };
    };
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      const { idle, attack, faint } = sprite.frames;
      expect(idle[1], `${creatureType} idle bob`).not.toEqual(idle[0]);
      expect(attack[0], `${creatureType} attack lean`).not.toEqual(idle[0]);
      expect(attack[1], `${creatureType} attack lunge`).not.toEqual(attack[0]);
      // The lunge carries the sprite towards the opponent (right; the renderer mirrors).
      expect(bounds(attack[1]).minX, `${creatureType} lunge direction`).toBeGreaterThan(bounds(idle[0]).minX);
      // Lying down = the standing pose turned on its side, so the box swaps axes.
      const standing = bounds(idle[0]);
      const fallen = bounds(faint[0]);
      expect(faint[0], `${creatureType} faint differs from idle`).not.toEqual(idle[0]);
      expect([fallen.width, fallen.height], `${creatureType} faint is the standing pose on its side`)
        .toEqual([standing.height, standing.width]);
    }
  });

  it('uses dense outlined palettes and draws one rectangle for each opaque pixel', () => {
    for (const [creatureType, sprite] of Object.entries(SPRITES)) {
      for (const frames of Object.values(sprite.frames)) {
        for (const frame of frames) {
          const opaque = frame.join('').replaceAll('.', '');
          expect(opaque.length, creatureType).toBeGreaterThanOrEqual(60);
          expect(new Set(opaque).size, creatureType).toBeGreaterThanOrEqual(creatureType === 'fallback' ? 2 : 3);

          const fillRect = vi.fn();
          drawSprite({
            imageSmoothingEnabled: true,
            save: vi.fn(),
            restore: vi.fn(),
            fillRect,
          } as unknown as CanvasRenderingContext2D, frame, sprite.palette, 0, 0, 1, { mirror: false, flash: false });
          expect(fillRect, creatureType).toHaveBeenCalledTimes(opaque.length);
        }
      }
    }
  });

  it('uses the generic beast for unknown creature types', () => {
    expect(spriteFor('Unknown monster')).toBe(SPRITES.fallback);
  });
});
