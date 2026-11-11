import { MAX_CARD_COPIES_IN_HAND } from '@deck-monsters/engine';

/**
 * Which cards a preset needs that only the player's OTHER monsters hold, so the Workshop can
 * ask "Hit ×2 and Blast are on Brass. Take them from Brass for Stonefang?" before it calls
 * `loadPreset` with an explicit list. The Workshop already has every monster's hand and the
 * unequipped deck, so nothing here needs the server.
 *
 * This mirrors `Beastmaster.planPresetLoad` in the engine and must keep its order: slots and
 * the copy limit first, then the unequipped deck (the loading monster's own old hand counts,
 * since loading replaces it), then another monster. The engine is the authority and refuses a
 * stale list; this only decides what to ask. A donor in the ring or fighting is never
 * offered, and a card only such a donor holds is reported in `locked` so the player is told
 * why it was left.
 */
export interface PresetTakeView {
  cardName: string;
  fromMonsterName: string;
}

export interface PresetLoadPlan {
  /** Cards to take, one entry per copy, in preset order. */
  takes: PresetTakeView[];
  /** Cards that would be skipped only because their holder is in the ring or fighting. */
  locked: PresetTakeView[];
}

interface PlanMonster {
  name: string;
  cards: string[];
  cardSlots: number;
  inRing: boolean;
  inEncounter: boolean;
}

const key = (name: string) => name.trim().toLowerCase();

export function planPresetTakes(params: {
  monster: PlanMonster;
  presetCards: string[];
  monsters: PlanMonster[];
  unequippedDeck: string[];
  /** Whether `monsterName` can hold `cardName`; unknown cards count as holdable. */
  canHold: (cardName: string, monsterName: string) => boolean;
}): PresetLoadPlan {
  const { monster, presetCards, monsters, unequippedDeck, canHold } = params;
  const pool = [...unequippedDeck, ...monster.cards];
  const hands = new Map(monsters.filter((m) => m.name !== monster.name).map((m) => [m.name, [...m.cards]]));
  const eligible = (m: PlanMonster) => m.name !== monster.name && !m.inRing && !m.inEncounter;
  const takes: PresetTakeView[] = [];
  const locked: PresetTakeView[] = [];
  const chosen: string[] = [];

  for (const requested of presetCards) {
    if (chosen.length >= monster.cardSlots) continue;
    if (chosen.filter((name) => key(name) === key(requested)).length >= MAX_CARD_COPIES_IN_HAND) continue;
    if (!canHold(requested, monster.name)) continue;

    const poolIndex = pool.findIndex((name) => key(name) === key(requested));
    if (poolIndex >= 0) {
      chosen.push(pool.splice(poolIndex, 1)[0]!);
      continue;
    }

    const donor = monsters.find((m) => {
      if (!eligible(m)) return false;
      return (hands.get(m.name) ?? []).some((name) => key(name) === key(requested));
    });
    if (donor) {
      const hand = hands.get(donor.name)!;
      const [cardName] = hand.splice(hand.findIndex((name) => key(name) === key(requested)), 1);
      chosen.push(cardName!);
      takes.push({ cardName: cardName!, fromMonsterName: donor.name });
      continue;
    }

    const holder = monsters.find(
      (m) => m.name !== monster.name && !eligible(m) && (hands.get(m.name) ?? []).some((name) => key(name) === key(requested)),
    );
    if (holder) locked.push({ cardName: requested, fromMonsterName: holder.name });
  }

  return { takes, locked };
}
