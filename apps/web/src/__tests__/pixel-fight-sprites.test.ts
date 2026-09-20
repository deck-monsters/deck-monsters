import { describe, expect, it } from 'vitest';
import { SPRITES } from '../animations/pixel-fight/sprites.js';

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
});
