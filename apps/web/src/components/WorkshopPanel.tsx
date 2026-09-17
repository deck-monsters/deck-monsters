import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import InventoryPanel from './InventoryPanel.js';
import ItemsPanel from './ItemsPanel.js';
import ShopPanel, { type ShopStockItem } from './ShopPanel.js';
import MonsterWorkshopPanel from './MonsterWorkshopPanel.js';
import type { WorkshopCardLocation } from './CardSlot.js';
import { useDeckWorkshop } from '../hooks/useDeckWorkshop.js';
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

export default function WorkshopPanel({ roomId, headerActions }: WorkshopPanelProps) {
  const [selectedCards, setSelectedCards] = useState<SelectionState[]>([]);
  const [activeMonsterFilter, setActiveMonsterFilter] = useState<string | null>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const monsterRowRef = useRef<HTMLDivElement>(null);
  const [visibleMonsterIndex, setVisibleMonsterIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    monsters,
    unequippedDeck,
    cardCompatibility,
    items,
    shop,
    loading,
    busy,
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
    reviveMonster,
    sendMonsterToRing,
    useItem,
    buyShopItem,
    refresh,
  } = useDeckWorkshop(roomId);

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
    if (!roomId) return;
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
    if (!roomId || selection.length < 1) return;
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
    if (selectedCards.length < 1 || !roomId) return;
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
          <button className="btn" onClick={() => void refresh()} disabled={!roomId || loading || busy}>
            Sync
          </button>
          {headerActions}
        </div>
      </div>

      {message && <div className="success-msg" role="status" aria-live="polite">{message}</div>}
      {error && <div className="error-msg" role="alert">{error}</div>}
      {busy && <div className="workshop-banner">Applying changes…</div>}
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
          <p>No monsters yet — cards need a monster to live on.</p>
          <p className="workshop-empty-hint">
            Spawn one from the console with <code>spawn a monster</code>, then come back to
            build its deck.
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
