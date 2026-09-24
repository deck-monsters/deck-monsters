import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ItemsPanel from '../components/ItemsPanel.js';
import type { ItemSummary, TierMonsterState } from '../utils/item-tiers.js';

const item = (overrides: Partial<ItemSummary> = {}): ItemSummary => ({
  displayName: 'Healing Potion',
  expired: false,
  stats: 'Usable 1 time.',
  usableOnMonsters: [],
  usableOnCharacter: false,
  ...overrides,
});

const benched: TierMonsterState = { name: 'Emberclaw', inRing: false, inEncounter: false };
const fighting: TierMonsterState = { name: 'Stonefang', inRing: true, inEncounter: true };

const noItems = { character: [] as ItemSummary[], monsters: [] as Array<{ monsterName: string; items: ItemSummary[] }> };

/**
 * Until `game.useItem` existed this panel was display-only, which made the game's one
 * mid-fight lever unreachable from the browser. See
 * docs/architecture/workshop-and-items.md.
 */
describe('ItemsPanel use affordance', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a pocket item on the only monster that can take it', () => {
    const onUseItem = vi.fn();
    render(
      <ItemsPanel
        items={{ ...noItems, character: [item({ usableOnMonsters: ['Emberclaw'] })] }}
        monsters={[benched]}
        onUseItem={onUseItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use Healing Potion on Emberclaw/i }));

    expect(onUseItem).toHaveBeenCalledWith({
      itemName: 'Healing Potion',
      monsterName: 'Emberclaw',
      itemSource: 'character',
    });
  });

  it('sends no monsterName when the target is the player themself', () => {
    // The engine skips the monster lookup entirely on a falsy monsterName, which is what
    // keeps the character path prompt-free too.
    const onUseItem = vi.fn();
    render(
      <ItemsPanel
        items={{ ...noItems, character: [item({ displayName: 'Lottery Ticket', usableOnCharacter: true })] }}
        monsters={[]}
        onUseItem={onUseItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use Lottery Ticket/i }));

    expect(onUseItem).toHaveBeenCalledWith({
      itemName: 'Lottery Ticket',
      monsterName: undefined,
      itemSource: 'character',
    });
  });

  it('asks before spending an item, which is what lets the server skip the engine prompt', () => {
    const onUseItem = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <ItemsPanel
        items={{ ...noItems, character: [item({ usableOnMonsters: ['Emberclaw'] })] }}
        monsters={[benched]}
        onUseItem={onUseItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use Healing Potion/i }));

    expect(onUseItem).not.toHaveBeenCalled();
  });

  it('offers a target picker when more than one monster can take it', () => {
    const onUseItem = vi.fn();
    const other: TierMonsterState = { name: 'Grix', inRing: false, inEncounter: false };
    render(
      <ItemsPanel
        items={{ ...noItems, character: [item({ usableOnMonsters: ['Emberclaw', 'Grix'] })] }}
        monsters={[benched, other]}
        onUseItem={onUseItem}
      />,
    );

    const picker = screen.getByRole('combobox', { name: /Target for Healing Potion/i });
    fireEvent.change(picker, { target: { value: 'Grix' } });
    fireEvent.click(screen.getByRole('button', { name: /Use Healing Potion on Grix/i }));

    expect(onUseItem).toHaveBeenCalledWith({
      itemName: 'Healing Potion',
      monsterName: 'Grix',
      itemSource: 'character',
    });
  });

  it('offers no button on a row that cannot be used right now', () => {
    // A pocket item while the only target is mid-fight — dimmed with a reason, not actionable.
    render(
      <ItemsPanel
        items={{ ...noItems, character: [item({ usableOnMonsters: ['Stonefang'] })] }}
        monsters={[fighting]}
        onUseItem={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Use/i })).toBeNull();
    expect(screen.getByText(/a monster can use only what it carries/i)).toBeTruthy();
  });

  it('stays display-only when no handler is supplied', () => {
    // The panel renders in contexts that cannot mutate; it must not imply otherwise.
    render(
      <ItemsPanel
        items={{ ...noItems, character: [item({ usableOnMonsters: ['Emberclaw'] })] }}
        monsters={[benched]}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Use/i })).toBeNull();
  });

  it('disables use while another workshop operation is in flight', () => {
    render(
      <ItemsPanel
        items={{ ...noItems, character: [item({ usableOnMonsters: ['Emberclaw'] })] }}
        monsters={[benched]}
        busy
        onUseItem={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Use Healing Potion/i }).hasAttribute('disabled')).toBe(true);
  });
});

/**
 * Both pools can hold the same item type, and the engine's name match takes the monster's
 * copy first — so a click on the pocket row without a source spends the one deliberately
 * stocked on the monster. Codex review on #372.
 */
describe('the clicked row decides which copy is spent', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the monster as the source when the monster's own row is used", () => {
    const onUseItem = vi.fn();
    const inRing: TierMonsterState = { name: 'Stonefang', inRing: true, inEncounter: true };
    render(
      <ItemsPanel
        items={{
          character: [],
          monsters: [
            { monsterName: 'Stonefang', items: [item({ displayName: 'Carried Bandage', usableOnMonsters: ['Stonefang'] })] },
          ],
        }}
        monsters={[inRing]}
        onUseItem={onUseItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use Carried Bandage on Stonefang/i }));

    expect(onUseItem).toHaveBeenCalledWith({
      itemName: 'Carried Bandage',
      monsterName: 'Stonefang',
      itemSource: 'monster',
    });
  });
});

/**
 * The Sorting Hat's own action asks which team. `game.useItem` runs on a channel that
 * rejects questions, so offering it here meant confirming and then failing every time.
 * Codex review on #372.
 */
describe('items that ask their own question are not offered here', () => {
  it('dims an interactive item and says where it can be used', () => {
    render(
      <ItemsPanel
        items={{
          ...noItems,
          character: [item({ displayName: 'Sorting Hat', usableOnCharacter: true, requiresPrompt: true })],
        }}
        monsters={[]}
        onUseItem={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Use/i })).toBeNull();
    expect(screen.getByText(/Asks a question/i)).toBeTruthy();
  });

  it('still offers a non-interactive item beside it', () => {
    render(
      <ItemsPanel
        items={{
          ...noItems,
          character: [
            item({ displayName: 'Sorting Hat', usableOnCharacter: true, requiresPrompt: true }),
            item({ displayName: 'Lottery Ticket', usableOnCharacter: true }),
          ],
        }}
        monsters={[]}
        onUseItem={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Use Lottery Ticket/i })).toBeTruthy();
  });
});

describe('the use controls fit the row (#123)', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8');
  const rule = css.slice(css.indexOf('.workshop-item-use {'));

  // The target picker plus the button is the widest thing in a row. `.workshop-select`
  // carries `min-width: min(100%, 12rem)` at phone width, which with the button overflowed
  // the row and hung the button outside the panel border — measured in Chromium at 393px.
  it('lets the group wrap rather than overflow', () => {
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/flex-wrap:\s*wrap/);
  });

  it('lets the target picker shrink instead of holding 12rem', () => {
    const selectRule = css.slice(css.indexOf('.workshop-item-use .workshop-select {'));
    expect(selectRule.slice(0, selectRule.indexOf('}'))).toMatch(/min-width:\s*0/);
  });
});
