import { describe, expect, it } from 'vitest';
import {
  buildTieredItemList,
  classifyItem,
  compareTieredItems,
  resolveUseTargets,
  REASON_NEEDS_A_CHOICE,
  REASON_NOT_CARRIED_INTO_RING,
  REASON_NOT_IN_RING,
  REASON_NOT_USABLE_RIGHT_NOW,
  REASON_NO_MONSTER_CAN_USE_IT,
  sortTieredItems,
  type ItemSummary,
  type TierMonsterState,
  type TieredItem,
} from './item-tiers.js';

const item = (overrides: Partial<ItemSummary> = {}): ItemSummary => ({
  displayName: 'Healing Potion',
  expired: false,
  stats: 'Usable 1 time.',
  usableOnMonsters: [],
  usableOnCharacter: false,
  ...overrides,
});

const monster = (overrides: Partial<TierMonsterState> = {}): TierMonsterState => ({
  name: 'Stonefang',
  inRing: true,
  inEncounter: true,
  ...overrides,
});

describe('classifyItem', () => {
  it('is tier 2 with a "not carried into the ring" reason for a pocket item during a fight', () => {
    // Item lives in the character's pocket, and its only usable target is currently
    // mid-fight — the whole rule §3/§7 exist to protect: a pocket item is NEVER usable on
    // a fighting monster, even though `usableOnMonsters` (a pure `canUseItem` check) says
    // it could apply.
    const fighting = monster({ name: 'Stonefang', inRing: true, inEncounter: true });
    const result = classifyItem(
      item({ usableOnMonsters: ['Stonefang'] }),
      { kind: 'character' },
      [fighting],
    );

    expect(result.tier).toBe(2);
    expect(result.reason).toBe(REASON_NOT_CARRIED_INTO_RING);
  });

  it('is tier 1 for the same pocket item when the monster is not mid-fight', () => {
    const idle = monster({ name: 'Stonefang', inRing: true, inEncounter: false });
    const result = classifyItem(
      item({ usableOnMonsters: ['Stonefang'] }),
      { kind: 'character' },
      [idle],
    );

    expect(result.tier).toBe(1);
    expect(result.reason).toBeNull();
  });

  it('is tier 1 for a pocket item even mid-fight if the monster is merely in the ring, not yet in an encounter', () => {
    // `use.ts` gates on `inEncounter`, not `inRing` — a monster queued in the ring before
    // the fight timer fires can still be given a pocket item.
    const queued = monster({ name: 'Stonefang', inRing: true, inEncounter: false });
    const result = classifyItem(
      item({ usableOnMonsters: ['Stonefang'] }),
      { kind: 'character' },
      [queued],
    );

    expect(result.tier).toBe(1);
  });

  it('is tier 1 for an item a carried, fighting monster carries itself', () => {
    const fighting = monster({ name: 'Stonefang', inRing: true, inEncounter: true });
    const result = classifyItem(
      item({ usableOnMonsters: ['Stonefang'] }),
      { kind: 'monster', monsterName: 'Stonefang' },
      [fighting],
    );

    expect(result.tier).toBe(1);
    expect(result.reason).toBeNull();
  });

  it('is tier 2 with a "not in the ring" reason for a benched monster\'s own item', () => {
    const benched = monster({ name: 'Stonefang', inRing: false, inEncounter: false });
    const result = classifyItem(
      item({ usableOnMonsters: ['Stonefang'] }),
      { kind: 'monster', monsterName: 'Stonefang' },
      [benched],
    );

    expect(result.tier).toBe(2);
    expect(result.reason).toBe(REASON_NOT_IN_RING);
  });

  it('is tier 2 with a generic reason for a monster carried item canUseItem no longer applies to', () => {
    const inRing = monster({ name: 'Stonefang', inRing: true, inEncounter: true });
    const result = classifyItem(
      item({ usableOnMonsters: [] }),
      { kind: 'monster', monsterName: 'Stonefang' },
      [inRing],
    );

    expect(result.tier).toBe(2);
    expect(result.reason).toBe(REASON_NOT_USABLE_RIGHT_NOW);
  });

  it('is tier 1 when usable directly on the character, regardless of monster state', () => {
    const fighting = monster({ name: 'Stonefang', inRing: true, inEncounter: true });
    const result = classifyItem(
      item({ usableOnCharacter: true }),
      { kind: 'character' },
      [fighting],
    );

    expect(result.tier).toBe(1);
    expect(result.reason).toBeNull();
  });

  it('is tier 2 with a generic reason for a pocket item with no valid target at all', () => {
    const result = classifyItem(item({ usableOnMonsters: [] }), { kind: 'character' }, []);

    expect(result.tier).toBe(2);
    expect(result.reason).toBe(REASON_NO_MONSTER_CAN_USE_IT);
  });

  it('is always tier 3 when expired, even when it would otherwise be tier 1', () => {
    const idle = monster({ name: 'Stonefang', inRing: true, inEncounter: false });
    const result = classifyItem(
      item({ expired: true, usableOnMonsters: ['Stonefang'], usableOnCharacter: true }),
      { kind: 'monster', monsterName: 'Stonefang' },
      [idle],
    );

    expect(result.tier).toBe(3);
    expect(result.reason).toBeNull();
  });

  it('degrades a target name missing from the roster to "no valid target" rather than throwing', () => {
    const result = classifyItem(
      item({ usableOnMonsters: ['Ghost Monster'] }),
      { kind: 'character' },
      [],
    );

    expect(result.tier).toBe(2);
    expect(result.reason).toBe(REASON_NO_MONSTER_CAN_USE_IT);
  });
});

describe('compareTieredItems / sortTieredItems', () => {
  it('orders tier ascending, then alphabetically by display name within a tier', () => {
    const fighting = monster({ name: 'Stonefang', inRing: true, inEncounter: true });
    const idle = monster({ name: 'Idlewing', inRing: true, inEncounter: false });

    const tier3: TieredItem = classifyItem(
      item({ displayName: 'Zebra Scroll', expired: true }),
      { kind: 'character' },
      [],
    );
    const tier2: TieredItem = classifyItem(
      item({ displayName: 'Bravo Potion', usableOnMonsters: ['Stonefang'] }),
      { kind: 'character' },
      [fighting],
    );
    const tier1b: TieredItem = classifyItem(
      item({ displayName: 'Zulu Potion', usableOnMonsters: ['Idlewing'] }),
      { kind: 'character' },
      [idle],
    );
    const tier1a: TieredItem = classifyItem(
      item({ displayName: 'Alpha Potion', usableOnMonsters: ['Idlewing'] }),
      { kind: 'character' },
      [idle],
    );

    const sorted = sortTieredItems([tier3, tier2, tier1b, tier1a]);

    expect(sorted.map((entry) => entry.item.displayName)).toEqual([
      'Alpha Potion',
      'Zulu Potion',
      'Bravo Potion',
      'Zebra Scroll',
    ]);
  });

  it('is a stable, reusable comparator', () => {
    const a = classifyItem(item({ displayName: 'A' }), { kind: 'character' }, []);
    const b = classifyItem(item({ displayName: 'B' }), { kind: 'character' }, []);
    expect(compareTieredItems(a, b)).toBeLessThan(0);
    expect(compareTieredItems(b, a)).toBeGreaterThan(0);
    expect(compareTieredItems(a, a)).toBe(0);
  });
});

describe('buildTieredItemList', () => {
  it('flattens character and per-monster items into one sorted list', () => {
    const fighting = monster({ name: 'Stonefang', inRing: true, inEncounter: true });
    const benched = monster({ name: 'Emberclaw', inRing: false, inEncounter: false });

    const list = buildTieredItemList(
      {
        character: [item({ displayName: 'Pocket Elixir', usableOnMonsters: ['Stonefang'] })],
        monsters: [
          {
            monsterName: 'Stonefang',
            items: [item({ displayName: 'Carried Bandage', usableOnMonsters: ['Stonefang'] })],
          },
          {
            monsterName: 'Emberclaw',
            items: [item({ displayName: 'Benched Charm', usableOnMonsters: ['Emberclaw'] })],
          },
        ],
      },
      [fighting, benched],
    );

    expect(list).toHaveLength(3);
    // tier 1 first: the fighting monster's own carried item.
    expect(list[0]).toMatchObject({ tier: 1, item: { displayName: 'Carried Bandage' } });
    // tier 2, alphabetical: Benched Charm before Pocket Elixir.
    expect(list[1]).toMatchObject({
      tier: 2,
      reason: REASON_NOT_IN_RING,
      item: { displayName: 'Benched Charm' },
    });
    expect(list[2]).toMatchObject({
      tier: 2,
      reason: REASON_NOT_CARRIED_INTO_RING,
      item: { displayName: 'Pocket Elixir' },
    });
  });

  /**
   * The button must never offer a target the engine will refuse, so targets come from the
   * same facts that set the tier rather than from a second reading of the rules.
   */
  describe('resolveUseTargets', () => {
    const benched: TierMonsterState = { name: 'Emberclaw', inRing: false, inEncounter: false };
    const fighting: TierMonsterState = { name: 'Stonefang', inRing: true, inEncounter: true };

    it('offers nothing for an item that is not usable now', () => {
      const entry = classifyItem(item({ expired: true }), { kind: 'character' }, [benched]);
      expect(resolveUseTargets(entry, [benched])).toEqual([]);
    });

    it("targets only the carrying monster for that monster's own item", () => {
      // Mid-fight the engine narrows the pool to `monster.items`, so there is no other target.
      const entry = classifyItem(
        item({ displayName: 'Carried Bandage', usableOnMonsters: ['Stonefang', 'Emberclaw'] }),
        { kind: 'monster', monsterName: 'Stonefang' },
        [fighting, benched],
      );
      expect(resolveUseTargets(entry, [fighting, benched])).toEqual([
        { kind: 'monster', monsterName: 'Stonefang' },
      ]);
    });

    it('offers the character for a pocket item usable on them', () => {
      const entry = classifyItem(item({ usableOnCharacter: true }), { kind: 'character' }, []);
      expect(resolveUseTargets(entry, [])).toEqual([{ kind: 'character' }]);
    });

    it('offers every benched monster for a pocket item — the ordinary case', () => {
      const other: TierMonsterState = { name: 'Grix', inRing: false, inEncounter: false };
      const entry = classifyItem(
        item({ usableOnMonsters: ['Emberclaw', 'Grix'] }),
        { kind: 'character' },
        [benched, other],
      );
      expect(resolveUseTargets(entry, [benched, other])).toEqual([
        { kind: 'monster', monsterName: 'Emberclaw' },
        { kind: 'monster', monsterName: 'Grix' },
      ]);
    });

    it('excludes a monster that is mid-fight, which can only reach what it carried in', () => {
      const entry = classifyItem(
        item({ usableOnMonsters: ['Stonefang', 'Emberclaw'] }),
        { kind: 'character' },
        [fighting, benched],
      );
      expect(resolveUseTargets(entry, [fighting, benched])).toEqual([
        { kind: 'monster', monsterName: 'Emberclaw' },
      ]);
    });

    it('offers both the character and a monster when the item suits either', () => {
      const entry = classifyItem(
        item({ usableOnCharacter: true, usableOnMonsters: ['Emberclaw'] }),
        { kind: 'character' },
        [benched],
      );
      expect(resolveUseTargets(entry, [benched])).toEqual([
        { kind: 'character' },
        { kind: 'monster', monsterName: 'Emberclaw' },
      ]);
    });
  });

  /**
   * An item whose own action asks a question cannot run on the prompt-free channel
   * `game.useItem` uses, so it must not read as usable here. Codex review on #372.
   */
  describe('items that ask their own question', () => {
    it('dims them with a reason rather than offering them', () => {
      const entry = classifyItem(
        item({ displayName: 'Sorting Hat', usableOnCharacter: true, requiresPrompt: true }),
        { kind: 'character' },
        [],
      );

      expect(entry.tier).toBe(2);
      expect(entry.reason).toBe(REASON_NEEDS_A_CHOICE);
    });

    it('offers no targets for one', () => {
      const entry = classifyItem(
        item({ usableOnCharacter: true, requiresPrompt: true }),
        { kind: 'character' },
        [],
      );

      expect(resolveUseTargets(entry, [])).toEqual([]);
    });

    it('still shows a spent one as spent — expired outranks everything', () => {
      const entry = classifyItem(
        item({ expired: true, requiresPrompt: true }),
        { kind: 'character' },
        [],
      );

      expect(entry.tier).toBe(3);
    });

    it('treats a payload without the field as non-interactive', () => {
      // An older cached `myInventory` response predates `requiresPrompt`; degrading to
      // "not interactive" keeps ordinary items usable rather than hiding all of them.
      const entry = classifyItem(item({ usableOnCharacter: true }), { kind: 'character' }, []);

      expect(entry.tier).toBe(1);
    });
  });
});