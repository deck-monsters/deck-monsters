import { useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import InventoryPanel from './InventoryPanel.js';
import ItemsPanel from './ItemsPanel.js';
import ShopPanel, { type ShopStockItem } from './ShopPanel.js';
import MonsterWorkshopPanel from './MonsterWorkshopPanel.js';
import type { WorkshopCardLocation } from './CardSlot.js';
import { useDeckWorkshop } from '../hooks/useDeckWorkshop.js';
import { RingFeedContext, type TrackedRingFeedEvent } from '../hooks/useRingFeed.js';
import { groupSelectionByCardName, isSameSource, toggleWorkshopSelection } from '../utils/workshop-selection.js';

// The engine stores a pronoun key (`helpers/pronouns.ts`); players think in pronouns, so
// the key is the value and the pronouns are the label.
const PRONOUN_LABELS: Record<string, string> = {
  male: 'he/him',
  female: 'she/her',
  androgynous: 'they/them',
};

export type SelectionState = {
  location: WorkshopCardLocation;
  cardName: string;
  selectionId: string;
};

export type WorkshopPanelProps = {
  roomId: string | undefined;
  headerActions?: ReactNode;
};

export default function WorkshopPanel({ roomId, headerActions }: WorkshopPanelProps) {
  const [selectedCards, setSelectedCards] = useState<SelectionState[]>([]);
  const [activeMonsterFilter, setActiveMonsterFilter] = useState<string | null>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const monsterRowRef = useRef<HTMLDivElement>(null);
  const [visibleMonsterIndex, setVisibleMonsterIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSpawn, setShowSpawn] = useState(false);

  const {
    monsters,
    unequippedDeck,
    cardCompatibility,
    items,
    shop,
    spawnOptions,
    hasCharacter,
    characterCreation,
    shuffleAvatars,
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
    reviveMonster,
    sendMonsterToRing,
    useItem,
    buyShopItem,
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

	async function handleCancelConsoleFlow() {
	  try {
		setError(null);
		await cancelConsoleFlow();
		setMessage('Cancelled the waiting console action. Workshop controls are available again.');
	  } catch (err) {
		setError(err instanceof Error ? err.message : 'Could not cancel the console action');
	  }
	}

  async function handleSpawn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setError(null);
      const result = await spawnMonster({
        type: Number(data.get('type')),
        gender: String(data.get('gender')) as 'male' | 'female' | 'androgynous',
        name: String(data.get('name') ?? '').trim(),
        color: String(data.get('color') ?? '').trim(),
        // Only sent on a first run; the server ignores it once a character exists.
        ...(needsCharacter
          ? {
              character: {
                name: String(data.get('characterName') ?? '').trim(),
                gender: String(data.get('characterGender')) as 'male' | 'female' | 'androgynous',
                avatar: String(data.get('avatar') ?? ''),
              },
            }
          : {}),
      });
      setMessage(`${result.monsterName} the ${result.monsterType} joined your stable.`);
      setShowSpawn(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not train that monster');
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
       * nothing changed.
       */
      setMessage(
        result?.applied === false
          ? `${itemName} had no effect${on} right now — it was not used up.`
          : `Used ${itemName}${on}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that item');
    }
  }

  async function handleBuyShopItem(item: ShopStockItem) {
    if (!shop) {
      setError('The shop is still loading. Try again in a moment.');
      return;
    }
    if (!window.confirm(`Buy ${item.displayName} for ${item.price} coins?`)) return;
    try {
      setError(null);
      const result = await buyShopItem({
        section: item.section,
        stockIndex: item.stockIndex,
        expectedItemType: item.displayName,
        expectedClosingTime: shop.closingTime,
      });
      setMessage(`Bought ${result.itemName} for ${result.price} coins. ${result.remainingCoins} coins remain.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that purchase');
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
        const skipped = result.skippedCards.length > 0 ? ` Skipped: ${result.skippedCards.join(', ')}.` : '';
        setMessage(
          `Equipped ${target.monsterName} (${result.equippedCount}/${result.requestedCount}).${skipped}`,
        );
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
      const skipped = result.skippedCards.length > 0 ? ` Skipped: ${result.skippedCards.join(', ')}.` : '';
      setMessage(`Equipped ${target.monsterName} (${result.equippedCount}/${result.requestedCount}).${skipped}`);
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
      setMessage(`Unequipped ${result.removedCount} cards from ${source.monsterName}.${skipped}`);
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
      setMessage(`Moved ${result.movedCount} cards to ${target.monsterName}.${skipped}`);
    }
  }

  function handleToggleMonsterFilter(monsterName: string) {
    setSelectedCards([]);
    const next = activeMonsterFilter === monsterName ? null : monsterName;
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
    if (selectedCards.length < 1 || !roomId || consoleFlowActive) return;
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
      setMessage(`Cleared ${result.monsterName} (${result.removedCount} cards returned).`);
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
      const skipped = result.skippedCards.length > 0 ? ` Skipped: ${result.skippedCards.join(', ')}.` : '';
      setMessage(
        `Loaded "${presetName}" on ${monsterName} (${result.equippedCount}/${result.requestedCount}).${skipped}`,
      );
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
    than one monster sees one panel and a ~44px sliver of the next. The sliver was the only
    hint that anything else existed, and cut mid-word it read as a rendering fault rather
    than an affordance. The dots say how many monsters there are and which one you are on.
    See docs/roadmap/20-workspace-layout.md §5g.
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

  return (
    <div className="workshop-view">
      <div className="workshop-header">
        <div>
          <h1>Deck Workshop</h1>
          <p>Manage equipped and unequipped cards in one view.</p>
        </div>
        <div className="workshop-header-actions">
          {/*
           * The coin balance used to be visible only inside the shop section, which the
           * player has to scroll past the monster row and inventory to reach. Surfacing it
           * here too means a player can see their wallet — and that it just moved after a
           * fight — without opening the shop at all. `shop` is undefined until the first
           * shop query resolves, so this renders nothing rather than a misleading "0 coins"
           * during that brief window.
           */}
          {shop && (
            <strong className="workshop-wallet" title="Coins">
              {shop.coins} {shop.coins === 1 ? 'coin' : 'coins'}
            </strong>
          )}
          <button className="btn" onClick={() => setShowSpawn((shown) => !shown)} disabled={!roomId || busy}>
            {showSpawn ? 'Cancel' : 'Train monster'}
          </button>
          <button className="btn" onClick={() => void refresh()} disabled={!roomId || loading || busy}>
            Sync
          </button>
          {headerActions}
        </div>
      </div>

      {message && <div className="success-msg" role="status" aria-live="polite">{message}</div>}
      {error && <div className="error-msg" role="alert">{error}</div>}
	  {consoleFlowActive && (
		<div className="workshop-flow-blocked" role="alert">
		  <div>
			<strong>Workshop controls are paused by a Console action.</strong>
			<p>{pendingPrompt ? 'Answer the waiting question in the Console, or cancel it here.' : 'The previous command is still processing. Workshop controls will unlock when it finishes.'}</p>
		  </div>
		  {pendingPrompt && <button className="btn" onClick={() => void handleCancelConsoleFlow()}>Cancel Console action</button>}
		</div>
	  )}
	  {busy && !consoleFlowActive && <div className="workshop-banner">Applying changes…</div>}
      {showSpawn && (
        <form className="workshop-spawn-form" onSubmit={(event) => void handleSpawn(event)}>
          {needsCharacter && (
            <fieldset className="workshop-spawn-character">
              <legend>About you</legend>
              <label>Your name<input name="characterName" required maxLength={40} autoComplete="off" defaultValue={characterCreation.suggestedName} key={characterCreation.suggestedName} /></label>
              <label>Pronouns<select name="characterGender" defaultValue="androgynous">{characterCreation.genders.map((gender) => <option key={gender} value={gender}>{PRONOUN_LABELS[gender] ?? gender}</option>)}</select></label>
              <fieldset className="workshop-avatar-choices">
                <legend>Avatar</legend>
                {characterCreation.avatars.map((avatar, index) => (
                  <label key={avatar} className="workshop-avatar-chip">
                    <input type="radio" name="avatar" value={avatar} defaultChecked={index === 0} />
                    <span>{avatar}</span>
                  </label>
                ))}
                {/* The list is generated per request, so a new one is just a refetch. */}
                <button type="button" className="btn workshop-inline-btn" onClick={() => void shuffleAvatars()}>Shuffle</button>
              </fieldset>
            </fieldset>
          )}
          <label>Type<select name="type" defaultValue={spawnOptions.types[0]?.index}>{spawnOptions.types.map((type) => <option key={type.index} value={type.index}>{type.label}</option>)}</select></label>
          <label>Gender<select name="gender" defaultValue="androgynous">{spawnOptions.genders.map((gender) => <option key={gender} value={gender}>{gender[0]?.toUpperCase()}{gender.slice(1)}</option>)}</select></label>
          <label>Name<input name="name" required maxLength={40} autoComplete="off" /></label>
          <label>Appearance<input name="color" required maxLength={100} placeholder="gold and black" /></label>
          <button type="submit" className="btn" disabled={busy}>Train</button>
        </form>
      )}
      {selectedCards.length > 0 && (
        <div className="workshop-mobile-hint">
          {selectedCards.length} selected: {selectedSummary}. Tap destination slot or inventory drop zone.
          {' '}
          <button type="button" className="btn workshop-inline-btn" onClick={() => setSelectedCards([])}>
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
            Train one here to start building its deck. The console command is <code>spawn a monster</code>.
          </p>
        </div>
      ) : (
      <div className="workshop-monster-row" ref={monsterRowRef} onScroll={handleMonsterRowScroll}>
        {monsters.map((monster) => (
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
            compatibilityHint={
              selectedInventoryCardName
                ? (isCardCompatibleWithMonster(selectedInventoryCardName, monster.name) ? 'eligible' : 'ineligible')
                : 'none'
            }
            onToggleFilter={() => handleToggleMonsterFilter(monster.name)}
          />
        ))}
      </div>
      )}

      {monsters.length > 1 && (
        <div className="workshop-monster-dots" role="tablist" aria-label="Monsters">
          {monsters.map((monster, index) => (
            <button
              key={monster.name}
              type="button"
              role="tab"
              className={`workshop-monster-dot${index === visibleMonsterIndex ? ' active' : ''}`}
              aria-selected={index === visibleMonsterIndex}
              aria-label={monster.name}
              onClick={() => scrollToMonster(index)}
            />
          ))}
        </div>
      )}

      <div ref={inventoryRef}>
      <InventoryPanel
        cards={unequippedDeck}
        selectedCards={selectedCards}
        activeMonsterFilterName={activeMonsterFilter}
        compatibleCardCount={compatibleCardCount}
        disabled={busy}
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
      <ShopPanel shop={shop} busy={busy} onBuy={(item) => void handleBuyShopItem(item)} />
    </div>
  );
}
