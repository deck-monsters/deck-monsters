// Tier derivation for the workshop items list. See docs/architecture/workshop-and-items.md.
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
  /**
   * The item's own action asks a question of its own (the Sorting Hat asks which team).
   * `game.useItem` runs on a prompt-free channel that rejects questions, so offering one of
   * these as usable here means confirming and then failing, every time. Optional so an
   * older cached payload without the field degrades to "not interactive" rather than
   * hiding a usable item.
   */
  requiresPrompt?: boolean;
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
export const REASON_NEEDS_A_CHOICE = 'Asks a question — use it from the console.';

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

  // An item that asks its own question cannot be used from here at all: the mutation's
  // channel rejects prompts. It is still owned and still usable elsewhere, so it dims with
  // a reason and a route out rather than vanishing.
  if (item.requiresPrompt) {
    return { item, source, tier: 2, reason: REASON_NEEDS_A_CHOICE };
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

/** Where a use would land. `character` carries no monster name — see the `useItem` procedure. */
export type UseTarget = { kind: 'character' } | { kind: 'monster'; monsterName: string };

/**
 * The valid targets for using this item right now, derived from the same facts that decided
 * its tier — so the button can never offer a target the engine will refuse.
 *
 * A monster's own carried item only ever targets that monster: once it is `inEncounter` the
 * engine narrows the usable pool to `monster.items`, and off the bench using one monster's
 * item on another is the "odd and likely a mistake" case §7 dims rather than forbids.
 *
 * A pocket item can have several targets, which is the ordinary case — a healing potion and
 * three benched monsters. Anything mid-fight is excluded: a fighting monster can only reach
 * what it carried in.
 */
export function resolveUseTargets(entry: TieredItem, monsters: TierMonsterState[]): UseTarget[] {
  if (entry.tier !== 1) return [];

  if (entry.source.kind === 'monster') {
    return [{ kind: 'monster', monsterName: entry.source.monsterName }];
  }

  const byName = new Map(monsters.map((monster) => [monster.name, monster]));
  const targets: UseTarget[] = [];

  if (entry.item.usableOnCharacter) targets.push({ kind: 'character' });

  for (const name of entry.item.usableOnMonsters) {
    const monster = byName.get(name);
    if (monster && !monster.inEncounter) targets.push({ kind: 'monster', monsterName: name });
  }

  return targets;
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
