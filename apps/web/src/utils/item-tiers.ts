// Tier derivation for the workshop items list. Spec: docs/roadmap/19-player-agency-and-items.md §7.
//
// Sort, do not filter, and never add a mode. One list, three tiers:
//   1 — usable right now, on a target the engine will actually accept
//   2 — owned, but not reachable from here right now (dimmed, with a reason)
//   3 — expired ("used up")
//
// The subtlety this file exists to get right (the whole reason §3/§7 spell it out at
// length): a character-pocket item is NEVER usable on a monster that is mid-fight.
// `items/helpers/use.ts` only folds the character's own items into the usable pool when
// `!monster.inEncounter`; `items/helpers/transfer.ts` refuses to move items to/from an
// encountering monster. So "which list an item came from" (the character's pocket, vs. a
// specific monster's own carried items) plus that monster's `inEncounter` flag together
// decide reachability — `usableOnMonsters` alone (a pure `canUseItem` check, with no
// encounter awareness — see `canUseItemSafe` in packages/server/src/trpc/router.ts) is
// necessary but not sufficient.

export type ItemTier = 1 | 2 | 3;

export interface ItemSummary {
  displayName: string;
  expired: boolean;
  stats: string;
  usableOnMonsters: string[];
  usableOnCharacter: boolean;
}

/** The minimal per-monster state the tier classifier needs. */
export interface TierMonsterState {
  name: string;
  inRing: boolean;
  inEncounter: boolean;
}

export type ItemSource =
  | { kind: 'character' }
  | { kind: 'monster'; monsterName: string };

export interface TieredItem {
  item: ItemSummary;
  source: ItemSource;
  tier: ItemTier;
  /** Set only for tier 2 — a dimmed row with no reason reads as a bug, per §7. */
  reason: string | null;
}

// Exact reason strings shown on a dimmed (tier 2) row. Kept as named constants so tests -
// and any future ring-pane affordance - stay in sync with the copy rather than restating it.
export const REASON_NOT_IN_RING = 'Not in the ring.';
export const REASON_NOT_CARRIED_INTO_RING = 'Not carried into the ring.';
export const REASON_NOT_USABLE_RIGHT_NOW = 'Not usable right now.';

/**
 * Classify a single item summary into a tier, given the source list it came from and the
 * live state of the player's monsters.
 *
 * `monsters` should be the player's full monster roster (from `InventoryMonsterSummary` /
 * `myInventory`) — the classifier looks up targets by name, so a name missing from the
 * roster (e.g. a stale snapshot) degrades to "no valid target", never a thrown error.
 */
export function classifyItem(
  item: ItemSummary,
  source: ItemSource,
  monsters: TierMonsterState[],
): TieredItem {
  // Expired wins over everything else, even an item that would otherwise read as usable —
  // "used up" is a fact about the item, not about where it is right now.
  if (item.expired) {
    return { item, source, tier: 3, reason: null };
  }

  const byName = new Map(monsters.map((monster) => [monster.name, monster]));

  if (source.kind === 'monster') {
    const monster = byName.get(source.monsterName);

    // A monster's own carried item is only reachable while that monster is actually in the
    // ring. Off the bench, "using it" is technically fine (the monster isn't `inEncounter`)
    // but odd and likely a mistake (owner framing, §7) — so it dims rather than disappears.
    if (!monster || !monster.inRing) {
      return { item, source, tier: 2, reason: REASON_NOT_IN_RING };
    }

    if (item.usableOnMonsters.includes(source.monsterName)) {
      return { item, source, tier: 1, reason: null };
    }

    return { item, source, tier: 2, reason: REASON_NOT_USABLE_RIGHT_NOW };
  }

  // source.kind === 'character': usable on the character themself is always reachable
  // (the character is never `inEncounter`); usable on a monster only counts while that
  // monster is not mid-fight — a fighting monster can only reach what it is carrying.
  if (item.usableOnCharacter) {
    return { item, source, tier: 1, reason: null };
  }

  const targetMonsters = item.usableOnMonsters
    .map((name) => byName.get(name))
    .filter((monster): monster is TierMonsterState => monster != null);

  const reachableNow = targetMonsters.some((monster) => !monster.inEncounter);
  if (reachableNow) {
    return { item, source, tier: 1, reason: null };
  }

  if (targetMonsters.length > 0) {
    // Every named target exists but is mid-fight: this is the pocket-item-during-a-fight
    // case the doc calls out by name.
    return { item, source, tier: 2, reason: REASON_NOT_CARRIED_INTO_RING };
  }

  return { item, source, tier: 2, reason: REASON_NOT_USABLE_RIGHT_NOW };
}

/**
 * Sort comparator: tier ascending (1 before 2 before 3), then alphabetically by display
 * name within a tier, so re-renders don't jitter row order as unrelated state changes.
 */
export function compareTieredItems(a: TieredItem, b: TieredItem): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.item.displayName.localeCompare(b.item.displayName);
}

export function sortTieredItems(items: TieredItem[]): TieredItem[] {
  return [...items].sort(compareTieredItems);
}

/**
 * Convenience: classify and sort a full `myInventory` items payload in one pass. Character
 * items and every monster's own items are flattened into a single list, tagged with their
 * source, exactly as §7 specifies ("one list, sorted").
 */
export function buildTieredItemList(
  items: {
    character: ItemSummary[];
    monsters: Array<{ monsterName: string; items: ItemSummary[] }>;
  },
  monsters: TierMonsterState[],
): TieredItem[] {
  const tiered: TieredItem[] = [];

  // Defensive: a stale query cache, a mocked hook in a test, or a legacy snapshot missing
  // the `items` field entirely should render an empty list, never throw.
  for (const item of items?.character ?? []) {
    tiered.push(classifyItem(item, { kind: 'character' }, monsters));
  }

  for (const entry of items?.monsters ?? []) {
    for (const item of entry.items) {
      tiered.push(classifyItem(item, { kind: 'monster', monsterName: entry.monsterName }, monsters));
    }
  }

  return sortTieredItems(tiered);
}
