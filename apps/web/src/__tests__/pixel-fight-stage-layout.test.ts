import { describe, expect, it } from 'vitest';
import { stageLayout, visibleFighters } from '../animations/pixel-fight/PixelFightLayer.js';
import type { FightFighter } from '../animations/pixel-fight/state.js';

function fighter(
  name: string,
  side: 'left' | 'right',
  lastActionAt: number,
): FightFighter {
  return {
    name,
    creatureType: 'Basilisk',
    side,
    hp: 10,
    maxHp: 10,
    anim: 'idle',
    animStartedAt: 0,
    lastActionAt,
  };
}

describe('pixel fight stage layout', () => {
  it('uses the full four-a-side board when there is room', () => {
    expect(stageLayout(900, 200)).toEqual({ scale: 3, perSide: 4 });
  });

  it('drops to a single duel when the band is narrow or short', () => {
    // Both of these used to hide the stage outright; a phone never saw the feature.
    expect(stageLayout(380, 200)).toEqual({ scale: 2, perSide: 1 });
    expect(stageLayout(900, 96)).toEqual({ scale: 2, perSide: 1 });
  });

  it('keeps roster order when everyone fits, so nobody hops between frames', () => {
    const fighters = [
      fighter('Aqim', 'left', 500),
      fighter('Bex', 'left', 10),
      fighter('Mara', 'right', 20),
    ];

    expect(visibleFighters(fighters, 4)).toEqual(fighters);
  });

  it('fields the pair in the current exchange when only a duel fits', () => {
    const fighters = [
      fighter('Aqim', 'left', 10),
      fighter('Bex', 'left', 900),
      fighter('Mara', 'right', 20),
      fighter('Nix', 'right', 800),
    ];

    expect(visibleFighters(fighters, 1).map((f) => f.name)).toEqual(['Bex', 'Nix']);
  });

  it('holds the chosen duel steady until a genuinely newer action lands', () => {
    const fighters = [
      fighter('Aqim', 'left', 10),
      fighter('Bex', 'left', 900),
      fighter('Mara', 'right', 800),
    ];
    expect(visibleFighters(fighters, 1).map((f) => f.name)).toEqual(['Bex', 'Mara']);

    const aqimActs = fighters.map((f) => (f.name === 'Aqim' ? { ...f, lastActionAt: 1_200 } : f));
    expect(visibleFighters(aqimActs, 1).map((f) => f.name)).toEqual(['Aqim', 'Mara']);
  });

  it('copes with a side that has nobody on it', () => {
    const fighters = [fighter('Aqim', 'left', 10)];

    expect(visibleFighters(fighters, 1).map((f) => f.name)).toEqual(['Aqim']);
  });
});
