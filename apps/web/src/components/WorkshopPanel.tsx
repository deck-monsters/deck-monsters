import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import InventoryPanel from './InventoryPanel.js';
import ItemsPanel from './ItemsPanel.js';
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    monsters,
    unequippedDeck,
    cardCompatibility,
    items,
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

      <div className="workshop-monster-row">
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

      <ItemsPanel items={items} monsters={monsters} />
    </div>
  );
}
