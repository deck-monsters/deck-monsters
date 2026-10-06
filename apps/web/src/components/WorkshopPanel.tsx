import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { movedToMessage } from '../utils/moved-message.js';
import { anchorFor, restoreAnchor, type ScrollAnchor } from '../utils/keep-in-place.js';
import { surfaceDescription } from './surface-descriptions.js';
import InventoryPanel from './InventoryPanel.js';
import ItemsPanel from './ItemsPanel.js';
import ShopPanel, { type SellableGroup, type SellSelection, type ShopStockItem } from './ShopPanel.js';
import MonsterWorkshopPanel from './MonsterWorkshopPanel.js';
import CardDetailSheet from './CardDetailSheet.js';
import { stableCardName, type CardFactsView } from '../utils/cards.js';
import type { WorkshopCardLocation } from './CardSlot.js';
import GuidedStartBox from './GuidedStartBox.js';
import TrainWizard, { toTrainFailure, type TrainFailure, type TrainWizardInput } from './TrainWizard.js';
import { useGuidedStart } from '../hooks/useGuidedStart.js';
import { useDeckWorkshop } from '../hooks/useDeckWorkshop.js';
import { RingFeedContext, type TrackedRingFeedEvent } from '../hooks/useRingFeed.js';
import { cardRefusalReason, cardRefusalSentence, equipResultMessage } from '../lib/cardRefusal.js';
import { groupSelectionByCardName, isSameSource, toggleWorkshopSelection } from '../utils/workshop-selection.js';

export type SelectionState = {
  location: WorkshopCardLocation;
  cardName: string;
  selectionId: string;
};

export type WorkshopPanelProps = {
  roomId: string | undefined;
  headerActions?: ReactNode;
};

// The carousel peek plays once per page load (see the effect in WorkshopPanel).
let peekShown = false;

/** Test hook: lets each test start as a fresh page load. */
export function resetWorkshopPeekForTests() {
  peekShown = false;
}

export default function WorkshopPanel({ roomId, headerActions }: WorkshopPanelProps) {
  const [selectedCards, setSelectedCards] = useState<SelectionState[]>([]);
  const [activeMonsterFilter, setActiveMonsterFilter] = useState<string | null>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const monsterRowRef = useRef<HTMLDivElement>(null);
  const [visibleMonsterIndex, setVisibleMonsterIndex] = useState(0);
  const [peeking, setPeeking] = useState(false);
  // The control the last click landed on, so a selection change cannot jump the page (bug 228).
  const scrollAnchorRef = useRef<ScrollAnchor | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSpawn, setShowSpawn] = useState(false);
  // The card whose details sheet is open, and the monster it is shown for: the monster whose
  // panel the card is in, or for a card in Your cards the highlighted monster. Null for a
  // card in Your cards with nothing highlighted, which shows a verdict for every monster.
  const [detail, setDetail] = useState<{ cardName: string; monsterName: string | null; opener: HTMLElement | null } | null>(null);

  const {
    monsters,
    // Defaults to [] for the same reason as cardCosts: older doubles lack it.
    cardFacts = [],
    unequippedDeck,
    // Defaults to {} — older test doubles and any stale cached payload predating this field
    // must not crash the sell-price preview, only show it as free (0 cost).
    cardCosts = {},
    cardCompatibility,
    items,
    shop,
    spawnOptions,
    hasCharacter,
    characterCreation,
    shuffleAvatars,
    monsterSlots,
    loading,
    busy,
	consoleFlowActive,
	pendingPrompt,
	cancelConsoleFlow,
    latestError,
    equipCards,
    unequipCard,
    unequipMany,
    unequipAll,
    moveCard,
    moveMany,
    reorderCards,
    savePreset,
    loadPreset,
    deletePreset,
    spawnMonster,
    suggestMonsterNames,
    reviveMonster,
    sendMonsterToRing,
    useItem,
    buyShopItem,
    sellShopItems,
    refresh,
  } = useDeckWorkshop(roomId);

  /*
   * A brand-new player's first workshop action is Train monster, and it used to dead-end
   * on "Create your character before training a monster" with nowhere to do that. The
   * spawn mutation creates the character too, but it runs on a prompt-free channel and so
   * cannot ask the questions the console's creation flow asks — hence the extra fieldset.
   * Compared against `false` explicitly: undefined means the inventory has not loaded yet.
   */
  const needsCharacter = hasCharacter === false;
  const guide = useGuidedStart(roomId);

  const factsByName = useMemo(() => {
    const map = new Map<string, CardFactsView>();
    for (const facts of cardFacts) map.set(facts.name, facts);
    return map;
  }, [cardFacts]);
  const closeDetail = useCallback(() => setDetail(null), []);

  // Places at the player's side. Absent while the inventory loads (and in older test
  // doubles), in which case no line is shown rather than a wrong count.
  const freePlaces =
    hasCharacter === true && typeof monsterSlots === 'number'
      ? Math.max(monsterSlots - monsters.length, 0)
      : undefined;
  const trainingFull = freePlaces === 0;
  // One primary per view: once there is a monster, the view's primary is Send to ring, so
  // Train monster steps down to a secondary button; it is the primary only while the player
  // has no monster to send.
  const quietTrain = monsters.length > 0;
  const trainLine =
    freePlaces === undefined
      ? null
      : freePlaces > 0
        ? `Train a new monster to fight at your side. You can train ${freePlaces} more.`
        : `Every place at your side is taken (${monsterSlots} ${monsterSlots === 1 ? 'monster' : 'monsters'}).`;

  /*
   * Bug: "I still see only 0 coins in the workshop view." Coins are awarded the instant a
   * fight resolves (`Game.awardFightCoins`, `packages/engine/src/game.ts`), but the wallet
   * only ever learned about it from `useDeckWorkshop`'s 30s `refetchInterval` — up to half
   * a minute of showing a stale (often zero, for a brand-new character) balance right after
   * the fight a player was watching for. The room already emits a private `ring.xp` event
   * to the fight's own participant the moment coins are granted (see
   * `Game.handleWinner`/`handleLoser`/`handlePermaDeath`/`handleFled`/`handleDraw`, and
   * `fight-stats-subscriber.ts`'s own comment on why that event carries `coinsGained`).
   * Reusing it here makes the wallet (and the rest of the workshop) live instead of
   * eventually-consistent, without inventing a second notification path.
   *
   * `RingFeedContext` is read directly (not `useRingFeedListener`, which throws outside a
   * provider) because `WorkshopPanel` renders in two places with different context: inside
   * a `Terminal` pane, which already wraps every pane in `RingFeedProvider`, and standalone
   * via `WorkshopView`'s full-page route. Both are legitimate; missing context just means
   * "no live feed here," so the workshop falls back to its existing poll rather than
   * throwing.
   */
  const ringFeed = useContext(RingFeedContext);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!ringFeed) return;
    return ringFeed.subscribe((tracked: TrackedRingFeedEvent) => {
      if (tracked.data.type === 'ring.xp') {
        void refreshRef.current();
      }
    });
  }, [ringFeed]);

  /*
   * No event reaches the web when a monster's revival timer fires (the engine's 'respawn'
   * is a creature-level emit, not a room event), so the Workshop schedules its own refresh
   * for the moment the soonest running revival completes. Without it the "Fallen · back in
   * 0 s" line stayed until the next 30 s poll.
   */
  const nextRevivalAt = monsters.reduce<number | undefined>((soonest, monster) => {
    const at = monster.dead && typeof monster.revivesAt === 'number' ? monster.revivesAt : undefined;
    if (at === undefined) return soonest;
    return soonest === undefined || at < soonest ? at : soonest;
  }, undefined);
  useEffect(() => {
    if (nextRevivalAt === undefined) return;
    // +1 s so the engine's own timer has fired before we ask; capped so a far-off revival
    // does not overflow setTimeout (the 30 s poll covers anything longer anyway).
    const delay = Math.min(Math.max(nextRevivalAt - Date.now() + 1_000, 1_000), 2_147_000_000);
    const timer = setTimeout(() => void refreshRef.current(), delay);
    return () => clearTimeout(timer);
  }, [nextRevivalAt]);

	async function handleCancelConsoleFlow() {
	  try {
		setError(null);
		await cancelConsoleFlow();
		setMessage('Cancelled the waiting console action. Workshop controls are available again.');
	  } catch (err) {
		setError(err instanceof Error ? err.message : 'Could not cancel the console action');
	  }
	}

  // The wizard owns the answers; this sends them and reports back, so a server error (a name
  // clash, say) shows in the wizard at the step at fault instead of closing it.
  async function handleSpawn(input: TrainWizardInput): Promise<TrainFailure | null> {
    try {
      setError(null);
      const result = await spawnMonster(input);
      setMessage(`${result.monsterName} the ${result.monsterType} answers your call.`);
      setShowSpawn(false);
      return null;
    } catch (err) {
      return toTrainFailure(err);
    }
  }

  async function handleRevive(monsterName: string) {
    try {
      setError(null);
      await reviveMonster({ monsterName });
      setMessage(`${monsterName} has begun to revive.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revive failed');
    }
  }

  async function handleSendToRing(monsterName: string) {
    if (!window.confirm(`Send ${monsterName} to the ring in this room?`)) return;
    try {
      setError(null);
      await sendMonsterToRing({ monsterName });
      setMessage(`${monsterName} was sent to the ring.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    }
  }

  async function handleUseItem({
    itemName,
    monsterName,
    itemSource,
  }: {
    itemName: string;
    monsterName?: string;
    itemSource: 'character' | 'monster';
  }) {
    // ItemsPanel already confirmed, which is what lets the server skip the engine's own
    // "Are you sure?" prompt — see `items/helpers/use.ts`.
    try {
      setError(null);
      const result = await useItem({ itemName, monsterName, itemSource });
      const on = monsterName ? ` on ${monsterName}` : '';
      /*
       * `applied` is false when the item's own conditions were not met — Spin Up on a
       * living monster, a healing potion on a dead one. The engine declines and does not
       * spend the item; saying "Used it" would be a lie, and the player would wonder why
       * nothing changed. (A declined action also emits no narration, so `announcements`
       * is empty in this branch anyway — the check is ordered first for clarity.)
       *
       * Otherwise, prefer the engine's own narration — e.g. TargetingScroll.action() names
       * the specific strategy it just set, HealingPotion.action() says how many hp it
       * restored — over a generic "Used X.", which told a web player an item worked without
       * ever saying what it did. Multiple announcements (an item can narrate more than one
       * line) are shown together, separated the same way the engine separates paragraphs
       * within one narration. Fall back to the generic line when the engine narrated
       * nothing on this channel (some flavor lines publish publicly instead — see
       * `announceNarration` — and never reach here).
       */
      if (result?.applied === false) {
        setMessage(`${itemName} had no effect${on} right now — it was not used up.`);
      } else if (result?.announcements && result.announcements.length > 0) {
        setMessage(result.announcements.join('\n\n'));
      } else {
        setMessage(`Used ${itemName}${on}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that item');
    }
  }

  async function handleBuyShopItem(item: ShopStockItem) {
    if (!shop) {
      setError('The shop is still loading. Try again in a moment.');
      return;
    }
    const isFree = item.price === 0;
    if (!window.confirm(isFree ? `Take the ${item.displayName}? It's free.` : `Buy ${item.displayName} for ${item.price} coins?`)) return;
    try {
      setError(null);
      const result = await buyShopItem({
        section: item.section,
        stockIndex: item.stockIndex,
        expectedItemType: item.displayName,
        expectedClosingTime: shop.closingTime,
      });
      setMessage(isFree ? `You took the ${result.itemName}. It was free.` : `Bought ${result.itemName} for ${result.price} coins. ${result.remainingCoins} coins remain.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that purchase');
    }
  }

  // Grouped by display name (same shape the shop's own stock groups into, `stockCount`)
  // so selling three Bandages is one row with a quantity, not three identical rows —
  // `items.character` and `unequippedDeck` are otherwise one entry per copy.
  const sellableItems = useMemo<SellableGroup[]>(() => {
    const groups = new Map<string, SellableGroup>();
    for (const item of items.character) {
      const existing = groups.get(item.displayName);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(item.displayName, { displayName: item.displayName, count: 1, cost: item.cost ?? 0 });
      }
    }
    return [...groups.values()];
  }, [items.character]);

  const sellableCards = useMemo<SellableGroup[]>(() => {
    const groups = new Map<string, SellableGroup>();
    for (const cardName of unequippedDeck) {
      const existing = groups.get(cardName);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(cardName, { displayName: cardName, count: 1, cost: cardCosts[cardName] ?? 0 });
      }
    }
    return [...groups.values()];
  }, [unequippedDeck, cardCosts]);

  async function handleSellShopItems(selection: SellSelection) {
    if (!shop) {
      setError('The shop is still loading. Try again in a moment.');
      return;
    }
    const group = (selection.section === 'items' ? sellableItems : sellableCards)
      .find((entry) => entry.displayName === selection.type);
    const unitPrice = Math.round((group?.cost ?? 0) * (shop.sellOffset ?? 0));
    const total = unitPrice * selection.count;
    const label = selection.count > 1 ? `${selection.count} ${selection.type}` : selection.type;
    if (!window.confirm(`Sell ${label} for ${total} coins?`)) return;
    try {
      setError(null);
      const result = await sellShopItems({
        expectedClosingTime: shop.closingTime,
        selections: [selection],
      });
      setMessage(`Sold ${label} for ${result.totalValue} coins. ${result.remainingCoins} coins remain.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that sale');
    }
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!latestError) return;
    setError(latestError);
  }, [latestError]);

  useEffect(() => {
    if (!activeMonsterFilter) return;
    if (monsters.some((monster) => monster.name === activeMonsterFilter)) return;
    setActiveMonsterFilter(null);
  }, [activeMonsterFilter, monsters]);

  const normalizedCompatibility = useMemo(() => {
    const all = new Map<string, Set<string>>();
    for (const [cardName, compatibleMonsters] of Object.entries(cardCompatibility)) {
      all.set(
        cardName.trim().toLowerCase(),
        new Set(compatibleMonsters.map((monsterName) => monsterName.trim().toLowerCase())),
      );
    }
    return all;
  }, [cardCompatibility]);

  const isCardCompatibleWithMonster = useCallback((cardName: string, monsterName: string): boolean => {
    const compatibleMonsters = normalizedCompatibility.get(cardName.trim().toLowerCase());
    if (!compatibleMonsters) return true;
    return compatibleMonsters.has(monsterName.trim().toLowerCase());
  }, [normalizedCompatibility]);

  useEffect(() => {
    if (!activeMonsterFilter) return;
    setSelectedCards((previous) =>
      previous.filter((entry) => {
        if (entry.location.kind !== 'inventory') return true;
        return isCardCompatibleWithMonster(entry.cardName, activeMonsterFilter);
      }),
    );
  }, [activeMonsterFilter, isCardCompatibleWithMonster]);

  const refusalFor = useCallback(
    (cardName: string, monster: { name: string; cards: string[]; cardSlots: number; inEncounter?: boolean }) =>
      cardRefusalReason({ cardName, monster, compatible: isCardCompatibleWithMonster(cardName, monster.name) }),
    [isCardCompatibleWithMonster],
  );

  const selectedInventoryCardName = useMemo(() => {
    if (selectedCards.length !== 1) return null;
    const selection = selectedCards[0];
    if (!selection || selection.location.kind !== 'inventory') return null;
    return selection.cardName;
  }, [selectedCards]);

  const compatibleCardCount = useMemo(() => {
    if (!activeMonsterFilter) return null;
    return unequippedDeck.filter((cardName) => isCardCompatibleWithMonster(cardName, activeMonsterFilter)).length;
  }, [activeMonsterFilter, isCardCompatibleWithMonster, unequippedDeck]);

  const selectedSummary = useMemo(() => {
    if (selectedCards.length < 1) return '';
    const grouped = selectedCards.reduce<Record<string, number>>((all, selection) => {
      all[selection.cardName] = (all[selection.cardName] ?? 0) + 1;
      return all;
    }, {});
    return Object.entries(grouped)
      .map(([cardName, count]) => (count > 1 ? `${cardName} x${count}` : cardName))
      .join(', ');
  }, [selectedCards]);

  async function handleDrop(
    source: WorkshopCardLocation,
    target: WorkshopCardLocation,
    cardName: string,
    sourceSelectionId?: string,
    targetSelectionId?: string,
  ) {
    if (!roomId || consoleFlowActive) return;
    setSelectedCards([]);

    try {
      setError(null);
      if (source.kind === 'inventory' && target.kind === 'monster') {
        const result = await equipCards({
          monsterName: target.monsterName,
          cardNames: [cardName],
          replaceAll: false,
        });
        setMessage(equipResultMessage({ monsterName: target.monsterName, cardNames: [cardName], result }));
        return;
      }

      if (source.kind === 'monster' && target.kind === 'inventory') {
        await unequipCard({
          monsterName: source.monsterName,
          cardName,
          count: 1,
        });
        setMessage(`Unequipped ${cardName} from ${source.monsterName}.`);
        return;
      }

      if (source.kind === 'monster' && target.kind === 'monster') {
        if (source.monsterName === target.monsterName) {
          const sourceIndex = Number.parseInt(sourceSelectionId?.split(':').pop() ?? '', 10);
          const targetIndex = Number.parseInt(targetSelectionId?.split(':').pop() ?? '', 10);
          if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex)) return;
          if (sourceIndex === targetIndex) return;
          await reorderCards({
            monsterName: source.monsterName,
            fromIndex: sourceIndex,
            toIndex: targetIndex,
          });
          setMessage(`Reordered ${source.monsterName}'s deck.`);
          return;
        }
        await moveCard({
          cardName,
          fromMonsterName: source.monsterName,
          toMonsterName: target.monsterName,
          count: 1,
        });
        setMessage(`Moved ${cardName} to ${target.monsterName}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function handleBatchMove(selection: SelectionState[], target: WorkshopCardLocation) {
    if (!roomId || consoleFlowActive || selection.length < 1) return;
    const source = selection[0].location;
    const grouped = groupSelectionByCardName(selection);

    if (source.kind === 'inventory' && target.kind === 'monster') {
      const result = await equipCards({
        monsterName: target.monsterName,
        cardNames: selection.map((entry) => entry.cardName),
        replaceAll: false,
      });
      setMessage(equipResultMessage({
        monsterName: target.monsterName,
        cardNames: selection.map((entry) => entry.cardName),
        result,
      }));
      return;
    }

    if (source.kind === 'monster' && target.kind === 'inventory') {
      const result = await unequipMany({
        monsterName: source.monsterName,
        cards: grouped,
      });
      const skipped = result.failures.length > 0
        ? ` Skipped: ${result.failures.map((f) => f.cardName).join(', ')}.`
        : '';
      setMessage(`Unequipped ${result.removedCount} ${result.removedCount === 1 ? 'card' : 'cards'} from ${source.monsterName}.${skipped}`);
      return;
    }

    if (source.kind === 'monster' && target.kind === 'monster') {
      if (source.monsterName === target.monsterName) return;

      const result = await moveMany({
        fromMonsterName: source.monsterName,
        toMonsterName: target.monsterName,
        cards: grouped,
      });
      const skipped = result.failures.length > 0
        ? ` Skipped: ${result.failures.map((f) => f.cardName).join(', ')}.`
        : '';
      setMessage(`${movedToMessage(result.movedCount, target.monsterName)}${skipped}`);
    }
  }

  function handleToggleMonsterFilter(monsterName: string) {
    showCardsFor(activeMonsterFilter === monsterName ? null : monsterName);
  }

  /** Filter Your cards to what this monster can use and bring them into view; null clears. */
  function showCardsFor(next: string | null) {
    setSelectedCards([]);
    setActiveMonsterFilter(next);

    // Tapping a monster filters the *inventory*, which sits below the monster row and is
    // off-screen on a phone — so the tap changed something the player could not see, and
    // read as doing nothing at all. Bring the thing that changed into view.
    if (!next) return;
    const reduceMotion =
      typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      inventoryRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }

  async function handleSlotClick(target: WorkshopCardLocation) {
    if (!roomId || consoleFlowActive) return;
    if (selectedCards.length < 1) {
      // An empty monster slot with nothing selected: a new player taps its [+] expecting to
      // add a card there, and the tap did nothing. It now does what tapping the monster's
      // name does: show the cards this monster can use (bug 226). Always on, never a toggle,
      // so a second tap on [+] does not hide them again.
      if (target.kind === 'monster') showCardsFor(target.monsterName);
      return;
    }
    const firstSource = selectedCards[0]?.location;
    if (firstSource && isSameSource(firstSource, target)) {
      setMessage('Selection unchanged. Tap cards to add/remove, then tap another zone to move.');
      return;
    }
    const payload = [...selectedCards];
    setSelectedCards([]);
    try {
      setError(null);
      await handleBatchMove(payload, target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  function handleSelect(location: WorkshopCardLocation, cardName: string, selectionId: string) {
    if (consoleFlowActive) return;
    setSelectedCards((previous) => toggleWorkshopSelection(previous, { location, cardName, selectionId }));
  }

  async function handleUnequipAll(monsterName: string) {
    if (!roomId) return;
    if (!window.confirm(`Unequip all cards from ${monsterName}?`)) return;
    try {
      setError(null);
      const result = await unequipAll({ monsterName });
      setSelectedCards([]);
      setMessage(`Cleared ${result.monsterName} (${result.removedCount} ${result.removedCount === 1 ? 'card' : 'cards'} returned).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear deck');
    }
  }

  async function handleSavePreset(monsterName: string, presetName: string) {
    if (!roomId) return;
    try {
      setError(null);
      await savePreset({ monsterName, presetName });
      setMessage(`Saved preset "${presetName}" for ${monsterName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save preset');
    }
  }

  async function handleLoadPreset(monsterName: string, presetName: string) {
    if (!roomId) return;
    try {
      setError(null);
      const result = await loadPreset({ monsterName, presetName });
      const requested = monsters.find((monster) => monster.name === monsterName)?.presets[presetName] ?? [];
      setMessage(equipResultMessage({ monsterName, cardNames: requested, result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load preset');
    }
  }

  async function handleDeletePreset(monsterName: string, presetName: string) {
    if (!roomId) return;
    try {
      setError(null);
      await deletePreset({ monsterName, presetName });
      setMessage(`Deleted preset "${presetName}" from ${monsterName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete preset');
    }
  }

  /*
    Below 900px the monster row becomes a scroll-snapped carousel, so a player with more
    than one monster sees one panel and a sliver of the next. The sliver alone read as a
    rendering fault, so the dots say how many monsters there are and which one you are on,
    and the next arrow and the peek say there is more to the right (10b #122, #224).
    See docs/architecture/web-workspace.md.
  */
  const handleMonsterRowScroll = useCallback(() => {
    const row = monsterRowRef.current;
    if (!row) return;
    // Nearest panel to the row's left edge, which is where scroll-snap parks them.
    let nearest = 0;
    let best = Infinity;
    for (const [index, panel] of [...row.children].entries()) {
      const distance = Math.abs((panel as HTMLElement).offsetLeft - row.scrollLeft - row.clientLeft);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    }
    setVisibleMonsterIndex(nearest);
  }, []);

  const scrollToMonster = useCallback((index: number) => {
    const panel = monsterRowRef.current?.children[index] as HTMLElement | undefined;
    if (!panel) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'start',
      block: 'nearest',
    });
  }, []);

  /*
    Peek once per page load, the first time the row has a monster off to the right. Only when
    the row actually overflows: on a wide screen it is a grid with every panel visible, and
    moving them would be noise. Once per load, not per visit to the Workshop, so switching
    tabs does not replay it.
  */
  const monsterCount = monsters.length;
  useEffect(() => {
    if (peekShown || monsterCount < 2) return;
    const row = monsterRowRef.current;
    if (!row) return;
    const tryPeek = () => {
      if (peekShown || row.scrollWidth <= row.clientWidth) return false;
      peekShown = true;
      setPeeking(true);
      return true;
    };
    if (tryPeek() || typeof ResizeObserver === 'undefined') return;
    // A Workshop in a hidden pane has no layout yet (both widths 0), so try again once it
    // gets a size rather than never peeking.
    const observer = new ResizeObserver(() => {
      if (tryPeek()) observer.disconnect();
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [monsterCount]);

  // React Router reuses this panel from /room/A/workshop to /room/B/workshop, so the index and
  // the row's sideways scroll would carry another room's position over: start at the first.
  useEffect(() => {
    setVisibleMonsterIndex(0);
    if (monsterRowRef.current) monsterRowRef.current.scrollLeft = 0;
  }, [roomId]);

  // The dots are keyed by name, so removing a monster can leave the index past the end with
  // no scroll event to correct it.
  const activeMonsterIndex = Math.min(visibleMonsterIndex, Math.max(0, monsters.length - 1));
  const atLastMonster = activeMonsterIndex >= monsters.length - 1;

  // Selecting or moving cards adds or removes hint lines in every monster panel, above Your
  // cards. Put the tapped card back under the finger before the browser paints.
  useLayoutEffect(() => {
    restoreAnchor(scrollAnchorRef.current);
    scrollAnchorRef.current = null;
  }, [selectedCards]);

  return (
    <div
      className="workshop-view"
      onClickCapture={(event) => {
        scrollAnchorRef.current = anchorFor(event.target);
      }}
    >
      <div className="workshop-header">
        <div>
          <div className="workshop-title-row">
            <h1>Workshop</h1>
            {/* Same fact as the train line below, at the heading's right: shown in every theme
                (the sentence below hides itself while the count is up). */}
            {freePlaces !== undefined && freePlaces > 0 && (
              <span className="workshop-train-count">You can train {freePlaces} more</span>
            )}
          </div>
          <p>{surfaceDescription('workshop')}</p>
        </div>
        <div className="workshop-header-actions">
          {headerActions}
        </div>
      </div>

      {/*
        Train monster has its own row. It used to sit beside the coin balance, and a new
        player read "196 coins  Train monster" as the price of levelling up the monster
        below. Coins now live in the Shop only. The line says how many places are free
        (`monsterSlots` from the inventory query); a first-run player has no character and
        so no places to count, and keeps the plain button.
      */}
      <div className="workshop-train-row">
        {trainLine && (
          <p className={`workshop-train-line${freePlaces ? ' workshop-train-line-count' : ''}`}>{trainLine}</p>
        )}
        <button
          title={showSpawn ? 'Close without training' : 'Choose a type, a name and a look for a new monster'}
          className={showSpawn || quietTrain ? 'btn' : 'btn btn-primary'}
          onClick={() => setShowSpawn((shown) => !shown)}
          disabled={!roomId || busy || (trainingFull && !showSpawn)}
        >
          {showSpawn ? 'Cancel' : 'Train monster'}
        </button>
      </div>

      {message && <div className="success-msg" role="status" aria-live="polite">{message}</div>}
      {error && <div className="error-msg" role="alert">{error}</div>}
	  {consoleFlowActive && (
		<div className="workshop-flow-blocked" role="alert">
		  <div>
			<strong>Workshop controls are paused by a Console action.</strong>
			<p>{pendingPrompt ? 'Answer the waiting question in the Console, or cancel it here.' : 'The previous command is still processing. Workshop controls will unlock when it finishes.'}</p>
		  </div>
		  {pendingPrompt && <button title="Cancel what the Console is asking, so the Workshop can make changes" className="btn" onClick={() => void handleCancelConsoleFlow()}>Cancel Console action</button>}
		</div>
	  )}
	  {busy && !consoleFlowActive && <div className="workshop-banner">Applying changes…</div>}
      {/* Same guide as the Console. Not on `spawn`: the first-run wizard already covers training. */}
      {!consoleFlowActive && guide.phase !== 'hidden' && guide.phase !== 'spawn' && (
        <GuidedStartBox surface="workshop" {...guide} />
      )}
      {showSpawn && (
        <TrainWizard
          types={spawnOptions.types}
          pronouns={spawnOptions.pronouns}
          needsCharacter={needsCharacter}
          characterCreation={characterCreation}
          shuffleAvatars={shuffleAvatars}
          busy={busy}
          suggestNames={async (input) => (await suggestMonsterNames(input)).names}
          onTrain={handleSpawn}
        />
      )}
      {selectedCards.length > 0 && (
        <div className="workshop-mobile-hint">
          {selectedCards.length} selected: {selectedSummary}. Tap destination slot or inventory drop zone.
          {' '}
          <button title="Deselect the cards you picked" type="button" className="btn workshop-inline-btn" onClick={() => setSelectedCards([])}>
            Clear
          </button>
        </div>
      )}

      {!loading && monsters.length === 0 ? (
        /*
          With no monsters the row collapsed to a 6px ghost strip — its container-query
          `padding-bottom` and nothing else — which read as a broken layout rather than an
          empty state. Worse, it is what a brand-new player sees first: a deck of cards and
          nothing to put them on, with no hint that spawning is the next step and no way to
          do it from here. Measured at 393px; see 10b-bugs-fixed.md #113.
        */
        <div className="workshop-empty-state workshop-no-monsters">
          <p>
            {needsCharacter
              ? "You don't have a character in this room yet. Train your first monster and we'll create one for you."
              : 'No monsters yet — cards need a monster to live on.'}
          </p>
          <p className="workshop-empty-hint">
            Train one here to start building its deck. The console command is <code>train a monster</code>.
          </p>
        </div>
      ) : (
      <div
        className={`workshop-monster-row${peeking ? ' peek' : ''}`}
        ref={monsterRowRef}
        onScroll={handleMonsterRowScroll}
        // A player who grabs the row mid-peek gets it back at once rather than fighting the slide.
        onPointerDown={() => setPeeking(false)}
        // animationend bubbles, so only the peek's own end clears it.
        onAnimationEnd={(event) => {
          if (event.animationName === 'workshop-monster-peek') setPeeking(false);
        }}
      >
        {monsters.map((monster) => {
          // Once per monster per render: the reason, then the sentence built from it.
          const reason = selectedInventoryCardName ? refusalFor(selectedInventoryCardName, monster) : null;
          const hint = {
            reason,
            sentence: selectedInventoryCardName && reason
              ? cardRefusalSentence(selectedInventoryCardName, monster.name, reason)
              : undefined,
          };
          return (
          <MonsterWorkshopPanel
            key={monster.name}
            monster={monster}
            selectedCards={selectedCards}
            showSelectionHint={selectedCards.length > 0}
            onDropCard={(source, cardName, sourceSelectionId, targetSelectionId) =>
              handleDrop(
                source,
                { kind: 'monster', monsterName: monster.name },
                cardName,
                sourceSelectionId,
                targetSelectionId,
              )
            }
            onTapSlot={(target) => {
              void handleSlotClick(target);
            }}
            onSelectCard={(location, cardName, selectionId) => handleSelect(location, cardName, selectionId)}
            onUnequipAll={() => {
              void handleUnequipAll(monster.name);
            }}
            onRevive={() => void handleRevive(monster.name)}
            onSendToRing={() => void handleSendToRing(monster.name)}
            anotherMonsterInRing={monsters.some((other) => other.inRing)}
            busy={busy}
            onSavePreset={(presetName) => {
              void handleSavePreset(monster.name, presetName);
            }}
            onLoadPreset={(presetName) => {
              void handleLoadPreset(monster.name, presetName);
            }}
            onDeletePreset={(presetName) => {
              void handleDeletePreset(monster.name, presetName);
            }}
            isFilterActive={Boolean(activeMonsterFilter)}
            isFilterTarget={activeMonsterFilter === monster.name}
            compatibilityHint={hint.reason === null ? (selectedInventoryCardName ? 'eligible' : 'none') : 'ineligible'}
            refusalSentence={hint.sentence}
            onToggleFilter={() => handleToggleMonsterFilter(monster.name)}
            onShowDetails={(cardName, opener) => setDetail({ cardName, monsterName: monster.name, opener })}
          />
          );
        })}
      </div>
      )}

      {monsters.length > 1 && (
        <div className="workshop-monster-nav">
          <div className="workshop-monster-dots" role="tablist" aria-label="Monsters">
            {monsters.map((monster, index) => (
              <button
                title={`Show ${monster.name}`}
                key={monster.name}
                type="button"
                role="tab"
                className={`workshop-monster-dot${index === activeMonsterIndex ? ' active' : ''}`}
                aria-selected={index === activeMonsterIndex}
                aria-label={monster.name}
                onClick={() => scrollToMonster(index)}
              />
            ))}
          </div>
          {/* Outside the tablist: a "next" button is not a tab. */}
          <button
            type="button"
            className="workshop-monster-next"
            aria-label="Next monster"
            title="Next monster"
            // aria-disabled, not disabled: a disabled button drops keyboard focus the moment
            // the last monster scrolls in.
            aria-disabled={atLastMonster}
            onClick={() => {
              if (!atLastMonster) scrollToMonster(activeMonsterIndex + 1);
            }}
          >
            <span className="workshop-monster-next-mark" aria-hidden="true">
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M2.5 1 L5.5 4 L2.5 7" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
          </button>
        </div>
      )}

      <div ref={inventoryRef}>
      <InventoryPanel
        cards={unequippedDeck}
        selectedCards={selectedCards}
        activeMonsterFilterName={activeMonsterFilter}
        compatibleCardCount={compatibleCardCount}
        disabled={busy}
        onShowDetails={(cardName, opener) => setDetail({ cardName, monsterName: activeMonsterFilter, opener })}
        onClearMonsterFilter={() => setActiveMonsterFilter(null)}
        isCardUnavailable={(cardName) =>
          activeMonsterFilter ? !isCardCompatibleWithMonster(cardName, activeMonsterFilter) : false
        }
        onDropCard={(source, cardName) => handleDrop(source, { kind: 'inventory' }, cardName)}
        onTapSlot={() => {
          void handleSlotClick({ kind: 'inventory' });
        }}
        onSelectCard={(location, cardName, selectionId) => handleSelect(location, cardName, selectionId)}
        onEquipSelected={
          activeMonsterFilter
            ? () => {
                void handleSlotClick({ kind: 'monster', monsterName: activeMonsterFilter });
              }
            : undefined
        }
      />
      </div>

      <ItemsPanel
        items={items}
        monsters={monsters}
        busy={busy}
        onUseItem={(input) => void handleUseItem(input)}
      />
      <ShopPanel
        shop={shop}
        busy={busy}
        onBuy={(item) => void handleBuyShopItem(item)}
        sellableItems={sellableItems}
        sellableCards={sellableCards}
        onSell={(selection) => void handleSellShopItems(selection)}
      />
      {detail && (
        <CardDetailSheet
          facts={factsByName.get(detail.cardName) ?? factsByName.get(stableCardName(detail.cardName)) ?? null}
          cardName={detail.cardName}
          opener={detail.opener}
          // One verdict, for the monster in view, or none. A line for every monster read
          // badly with six of them (bug 227); "Usable by" already says who can.
          monsters={detail.monsterName ? monsters.filter((monster) => monster.name === detail.monsterName) : []}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
