import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FeedLine } from '@deck-monsters/engine';
import { FeedEventBody } from '../components/FeedLines.js';
import {
  cardNameOf,
  composeFeedBlocks,
  feedBlocksOf,
  isBossArrivalEvent,
} from '../utils/feed-lines.js';
import { DEFAULT_FEED_METRICS, estimateFeedBlocksHeight, estimateFeedRowHeight } from '../utils/feed-row-height.js';

const roll = (over: Partial<Extract<FeedLine, { kind: 'roll' }>> = {}): FeedLine => ({
  kind: 'roll',
  text: 'Poirot rolled _20 +2 on 1d20_ vs Minotaur\'s ac (7) to determine if the hit was a success.',
  who: 'Poirot',
  die: '1d20',
  natural: 20,
  bonus: 2,
  total: 22,
  vs: 7,
  result: 'success',
  ...over,
});

const turnGroup = (hp1 = 24, hp2 = 7): FeedLine[] => [
  { kind: 'turn', text: '🎲  round 3, turn 2', round: 3, turn: 2 },
  { kind: 'standing', text: '🦄 Poirot (24 hp)', name: 'Poirot', hp: hp1, maxHp: 33 },
  { kind: 'standing', text: '🐂 Minotaur (7 hp)', name: 'Minotaur', hp: hp2, maxHp: 31 },
];

const text = (lines: FeedLine[], style: 'terminal' | 'millefleur') =>
  composeFeedBlocks(lines, style).map((b) => b.parts.map((p) => p.text).join('') || b.card?.title);

describe('composeFeedBlocks (terminal)', () => {
  it('is one block per line, in order, with the engine words', () => {
    const lines: FeedLine[] = [
      ...turnGroup(),
      roll(),
      { kind: 'verdict', text: '🎲 *22 v 7*', total: 22, vs: 7, result: 'success' },
      { kind: 'outcome', text: 'Hit!' },
    ];
    const blocks = composeFeedBlocks(lines, 'terminal');
    expect(blocks.map((b) => b.kind)).toEqual(['turn', 'standing', 'standing', 'roll', 'verdict', 'outcome']);
    expect(blocks.map((b) => b.parts[0]!.text)).toEqual(lines.map((l) => l.text));
    expect(blocks[5]!.indent).toBe(4);
  });

  it('keeps a card as a panel with its title and body', () => {
    const [block] = composeFeedBlocks(
      [{ kind: 'card', text: '👊  Hit  •\nA basic attack.', title: 'Hit  •' }],
      'terminal',
    );
    expect(block!.card).toEqual({ title: '👊  Hit  •', body: 'A basic attack.' });
  });
});

describe('composeFeedBlocks (millefleur)', () => {
  it('draws a round as a divider', () => {
    const [block] = composeFeedBlocks([{ kind: 'round', text: '🏁  round 3', round: 3 }], 'millefleur');
    expect(block).toMatchObject({ divider: true, kind: 'round' });
    expect(block!.parts[0]!.text).toBe('Round 3');
  });

  it('composes a turn and its standings into one summary, bloodied in the danger rose', () => {
    const blocks = composeFeedBlocks(turnGroup(), 'millefleur');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('summary');
    expect(text(turnGroup(), 'millefleur')[0]).toBe(
      'Round 3, turn 2. 🦄 Poirot is at 24/33 hp. 🐂 Minotaur is at 7/31 hp, bloodied.',
    );
    expect(blocks[0]!.parts.filter((p) => p.danger).map((p) => p.text)).toEqual([', bloodied']);
  });

  it('falls back to the lines own text when a creature has no hp', () => {
    const lines = turnGroup();
    (lines[2] as { hp?: number }).hp = undefined;
    const blocks = composeFeedBlocks(lines, 'millefleur');
    expect(blocks.map((b) => b.kind)).toEqual(['turn', 'standing', 'standing']);
  });

  it('composes a play from the actor and the card frame that follows, and keeps the frame', () => {
    const blocks = composeFeedBlocks(
      [
        { kind: 'play', text: '🦄 Poirot lays down the following card:', actor: 'Poirot', card: 'GloamingRest' },
        { kind: 'card', text: '🌙  Gloaming Rest  •\nA quiet heal.', title: 'Gloaming Rest  •' },
      ],
      'millefleur',
    );
    expect(blocks.map((b) => b.kind)).toEqual(['play', 'card']);
    expect(blocks[0]!.parts.map((p) => p.text).join('')).toBe('🦄 Poirot plays Gloaming Rest');
    expect(cardNameOf('Hit  •')).toBe('Hit');
  });

  it('keeps the play line as is when no card follows', () => {
    const line: FeedLine = { kind: 'play', text: '🦄 Poirot lays down a card', actor: 'Poirot', card: 'X' };
    expect(text([line], 'millefleur')).toEqual(['🦄 Poirot lays down a card']);
  });

  it.each([
    [roll(), 'Hit!', 'Poirot rolled 20 +2 = 22 vs 7 · hit'],
    [roll({ result: 'nat20' }), 'Hit!', 'Poirot rolled 20 +2 = 22 vs 7 · natural 20!'],
    [roll({ natural: 5, bonus: 0, total: 5, result: 'fail' }), 'Miss...', 'Poirot rolled 5 vs 7 · misses'],
    // A tie that the card judged a success is a success: the result is never recomputed.
    [roll({ natural: 6, bonus: 1, total: 7, vs: 7, result: 'success' }), 'Hit!', 'Poirot rolled 6 +1 = 7 vs 7 · hit'],
    [roll({ natural: 6, bonus: 1, total: 7, vs: 7, result: 'fail' }), 'Miss... Tie goes to the defender.', 'Poirot rolled 6 +1 = 7 vs 7 · misses. Tie goes to the defender.'],
    [roll({ result: 'nat1', natural: 1, bonus: 0, total: 1 }), undefined, 'Poirot rolled 1 vs 7 · critical failure!'],
    [roll({ result: 'nat20' }), 'Hit! Max damage!', 'Poirot rolled 20 +2 = 22 vs 7 · natural 20! Hit! Max damage!'],
    [roll({ result: 'nat1', natural: 1, bonus: 0, total: 1 }), 'The attack is reflected back at Poirot.', 'Poirot rolled 1 vs 7 · critical failure! The attack is reflected back at Poirot.'],
  ])('composes a roll: %#', (line, outcome, expected) => {
    const lines: FeedLine[] = [line, { kind: 'verdict', text: '🎲', total: 1, result: 'success' }];
    if (outcome) lines.push({ kind: 'outcome', text: outcome });
    const blocks = composeFeedBlocks(lines, 'millefleur');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.parts[0]!.text).toBe(expected);
  });

  it.each([
    { natural: undefined, total: undefined, result: undefined },
    { natural: undefined },
    { bonus: undefined },
    { total: undefined },
    { natural: Number.NaN },
  ])('keeps original roll, verdict and outcome blocks with incomplete numeric facts: %#', (over) => {
    const lines: FeedLine[] = [
      roll({ ...over, text: 'Blink rolled _2 & 9_ to steal potential energy.' }),
      { kind: 'verdict', text: '🎲 *2 (hp) & 9 (xp)*' },
      { kind: 'outcome', text: 'Blink steals potential energy.' },
    ];
    expect(text(lines, 'millefleur')).toEqual(lines.map((line) => line.text));
    expect(composeFeedBlocks(lines, 'millefleur').map((block) => block.kind)).toEqual(['roll', 'verdict', 'outcome']);
  });

  it('books and draws all special-roll outcomes through the shared block composition', () => {
    const outcome = 'Hit! Max damage! The attack is reflected back at Poirot, who takes the full damage.';
    const lines: FeedLine[] = [roll({ result: 'nat20' }), { kind: 'outcome', text: outcome }];
    const blocks = composeFeedBlocks(lines, 'millefleur');
    const { container } = render(<FeedEventBody text="" payload={{ lines }} style="millefleur" />);
    expect(container.querySelector('.feed-line-roll-result')!.textContent).toBe(blocks[0]!.parts[0]!.text);
    expect(blocks[0]!.parts[0]!.text).toContain(outcome);
    const columns = 30;
    const rows = Math.ceil(blocks[0]!.parts[0]!.text.length / (columns - blocks[0]!.indent));
    const height = DEFAULT_FEED_METRICS.rowChromePx + rows * DEFAULT_FEED_METRICS.linePx;
    expect(estimateFeedBlocksHeight(blocks, columns, DEFAULT_FEED_METRICS)).toBe(height);
    expect(estimateFeedRowHeight('', columns, DEFAULT_FEED_METRICS, blocks)).toBe(height);
  });

  it('states a damage roll with its reason and no verdict', () => {
    const blocks = composeFeedBlocks(
      [
        roll({ die: '1d6', natural: 5, bonus: 2, total: 7, vs: undefined, reason: 'for damage.', text: 'x' }),
        { kind: 'verdict', text: '🎲 *7*', total: 7, result: 'success' },
      ],
      'millefleur',
    );
    expect(blocks[0]!.parts[0]!.text).toBe('Poirot rolled 5 +2 = 7 on 1d6 for damage');
  });

  it('marks an hp line bloodied and leaves other kinds on their own text', () => {
    const lines: FeedLine[] = [
      { kind: 'hp', text: '🐂 *Minotaur has 7HP.*', name: 'Minotaur', hp: 7, maxHp: 31, bloodied: true },
      { kind: 'hit', text: '🦄 Poirot trounces Minotaur for 3 damage.', target: 'Minotaur', damage: 3 },
    ];
    const blocks = composeFeedBlocks(lines, 'millefleur');
    expect(blocks[0]!.parts.map((p) => p.text)).toEqual(['🐂 *Minotaur has 7HP*', ', bloodied', '.']);
    expect(blocks[1]!.parts[0]!.text).toBe(lines[1]!.text);
  });

  it('leaves a threshold hp line that already says bloodied', () => {
    const text = '🐂 *Minotaur is now bloodied. Minotaur has only 17HP.*';
    const blocks = composeFeedBlocks(
      [{ kind: 'hp', text, name: 'Minotaur', hp: 17, maxHp: 31, bloodied: true }],
      'millefleur',
    );
    expect(blocks[0]!.parts.map((p) => p.text)).toEqual([text]);
  });
});

describe('events without lines', () => {
  it('has no blocks, and the body renders its text as it always has', () => {
    expect(feedBlocksOf({}, 'terminal')).toBeNull();
    expect(feedBlocksOf({ lines: [] }, 'millefleur')).toBeNull();
    expect(feedBlocksOf({ lines: 'nope' }, 'millefleur')).toBeNull();
    const { container } = render(
      <FeedEventBody text={'before\n```\nA | B\n```\n*bold*'} payload={{}} style="millefleur" />,
    );
    expect(container.querySelector('.feed-lines')).toBeNull();
    expect(container.querySelector('.event-card-block')!.textContent).toBe('\nA | B\n');
    expect(container.querySelector('strong')!.textContent).toBe('bold');
  });

  it('books the old estimate for text-only events', () => {
    expect(estimateFeedRowHeight('one line', 48, DEFAULT_FEED_METRICS, null)).toBe(
      estimateFeedRowHeight('one line', 48, DEFAULT_FEED_METRICS),
    );
  });
});

describe('boss arrival', () => {
  it('reads the arrival line, falling back to the old payload', () => {
    const lines: FeedLine[] = [{ kind: 'arrival', text: 'x', name: 'N', boss: true }];
    expect(isBossArrivalEvent({}, lines)).toBe(true);
    expect(isBossArrivalEvent({ contestant: { isBoss: true } }, lines.map((l) => ({ ...l, boss: false })) as FeedLine[])).toBe(false);
    expect(isBossArrivalEvent({ contestant: { isBoss: true } }, null)).toBe(true);
    expect(isBossArrivalEvent({}, null)).toBe(false);
  });
});

describe('FeedEventBody renders the blocks', () => {
  const lines: FeedLine[] = [
    { kind: 'round', text: '🏁  round 2', round: 2 },
    ...turnGroup(),
    { kind: 'play', text: '🦄 Poirot lays down the following card:', actor: 'Poirot', card: 'HitCard' },
    { kind: 'card', text: '👊  Hit  •\nA basic attack, the staple of all good monsters.', title: 'Hit  •' },
    roll(),
    { kind: 'verdict', text: '🎲 *22 v 7*', total: 22, vs: 7, result: 'success' },
    { kind: 'outcome', text: 'Hit!' },
    { kind: 'narration', text: 'The crowd *roars*.' },
  ];

  it.each(['terminal', 'millefleur'] as const)('draws one block per composed block (%s)', (style) => {
    const { container } = render(<FeedEventBody text="" payload={{ lines }} style={style} />);
    const drawn = Array.from(container.querySelectorAll('.feed-lines > .feed-line'));
    const blocks = composeFeedBlocks(lines, style);
    expect(drawn).toHaveLength(blocks.length);
    drawn.forEach((el, i) => {
      expect(el.getAttribute('data-kind')).toBe(blocks[i]!.divider || blocks[i]!.card ? el.getAttribute('data-kind') : blocks[i]!.kind);
    });
    expect(container.querySelector('.feed-line-narration strong')!.textContent).toBe('roars');
  });

  it.each(['terminal', 'millefleur'] as const)(
    'books a lines row from what is drawn: the estimate equals a re-count of the DOM (%s)',
    (style) => {
      const metrics = { ...DEFAULT_FEED_METRICS, lineGapPx: 2, dividerChromePx: 10 };
      const columns = 40;
      const { container } = render(<FeedEventBody text="" payload={{ lines }} style={style} />);
      const drawn = Array.from(container.querySelectorAll<HTMLElement>('.feed-lines > .feed-line'));
      // The jsdom stand-in for layout: a block is as tall as its drawn text wraps, plus the
      // chrome the theme's CSS gives that kind of block.
      let height = metrics.rowChromePx + metrics.lineGapPx * (drawn.length - 1);
      for (const el of drawn) {
        const indent = Number(el.style.getPropertyValue('--feed-indent') || 0);
        if (el.classList.contains('feed-divider')) {
          height += metrics.linePx + metrics.dividerChromePx;
          continue;
        }
        const isCard = el.classList.contains('event-card-block');
        const content = isCard
          ? Array.from(el.children).map((c) => c.textContent).join('\n')
          : el.textContent ?? '';
        const wrap = isCard ? columns : columns - indent;
        const rows = content.split('\n').reduce((n, l) => n + Math.ceil(Math.max(l.length, 1) / wrap), 0);
        height += rows * metrics.linePx + (isCard ? metrics.cardChromePx : 0);
      }
      const blocks = composeFeedBlocks(lines, style);
      // Sprites are off here, so the DOM text is the blocks' text (markup removed adds a few
      // characters to the estimate, never subtracts); the heights must agree to the line.
      expect(estimateFeedBlocksHeight(blocks, columns, metrics)).toBeCloseTo(height, 5);
      expect(estimateFeedRowHeight('', columns, metrics, blocks)).toBeCloseTo(height, 5);
    },
  );
});
