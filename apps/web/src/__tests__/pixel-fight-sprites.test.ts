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
