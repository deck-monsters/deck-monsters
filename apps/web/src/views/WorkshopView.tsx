import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.js';
import InventoryPanel from '../components/InventoryPanel.js';
import MonsterWorkshopPanel from '../components/MonsterWorkshopPanel.js';
import type { WorkshopCardLocation } from '../components/CardSlot.js';
import { useDeckWorkshop } from '../hooks/useDeckWorkshop.js';

type SelectionState = {
  location: WorkshopCardLocation;
  cardName: string;
  selectionId: string;
};

export default function WorkshopView() {
  const { roomId } = useParams<{ roomId: string }>();
  const [selectedCards, setSelectedCards] = useState<SelectionState[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    roomName,
    monsters,
    unequippedDeck,
    loading,
    busy,
    latestError,
    equipCards,
    unequipCard,
    unequipAll,
    moveCard,
    savePreset,
    loadPreset,
    deletePreset,
    refresh,
  } = useDeckWorkshop(roomId);

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

  const selectedMonsterName = useMemo(() => {
    if (selectedCards.length < 1) return null;
    const first = selectedCards[0];
    if (first.location.kind !== 'monster') return null;
    const firstMonsterName = first.location.monsterName;
    const sameMonster = selectedCards.every(
      (selection) =>
        selection.location.kind === 'monster' &&
        selection.location.monsterName === firstMonsterName,
    );
    return sameMonster ? firstMonsterName : null;
  }, [selectedCards]);

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

  function groupSelectionByCardName(selection: SelectionState[]): Array<{ cardName: string; count: number }> {
    const grouped = selection.reduce<Record<string, number>>((all, entry) => {
      all[entry.cardName] = (all[entry.cardName] ?? 0) + 1;
      return all;
    }, {});
    return Object.entries(grouped).map(([cardName, count]) => ({ cardName, count }));
  }

  async function handleDrop(
    source: WorkshopCardLocation,
    target: WorkshopCardLocation,
    cardName: string,
  ) {
    if (!roomId) return;
    if (source.kind === 'monster' && target.kind === 'monster' && source.monsterName === target.monsterName) {
      return;
    }

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
      let removedCount = 0;
      for (const { cardName, count } of grouped) {
        const result = await unequipCard({
          monsterName: source.monsterName,
          cardName,
          count,
        });
        removedCount += result.removedCount;
      }
      setMessage(`Unequipped ${removedCount} cards from ${source.monsterName}.`);
      return;
    }

    if (source.kind === 'monster' && target.kind === 'monster') {
      if (source.monsterName === target.monsterName) return;

      let movedCount = 0;
      for (const { cardName, count } of grouped) {
        const result = await moveCard({
          cardName,
          fromMonsterName: source.monsterName,
          toMonsterName: target.monsterName,
          count,
        });
        movedCount += result.movedCount;
      }
      setMessage(`Moved ${movedCount} cards to ${target.monsterName}.`);
    }
  }

  function isSameSource(a: WorkshopCardLocation, b: WorkshopCardLocation): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'inventory') return true;
    return b.kind === 'monster' && a.monsterName === b.monsterName;
  }

  async function handleSlotClick(target: WorkshopCardLocation) {
    if (selectedCards.length < 1 || !roomId) return;
    const firstSource = selectedCards[0]?.location;
    if (firstSource && isSameSource(firstSource, target)) {
      setSelectedCards([]);
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
    setSelectedCards((previous) => {
      const existing = previous.find((entry) => entry.selectionId === selectionId);
      if (existing) {
        return previous.filter((entry) => entry.selectionId !== selectionId);
      }

      if (previous.length < 1) {
        return [{ location, cardName, selectionId }];
      }

      const first = previous[0];
      const sameKind = first.location.kind === location.kind;
      const sameMonsterSource =
        first.location.kind !== 'monster' ||
        (location.kind === 'monster' && first.location.monsterName === location.monsterName);

      if (!sameKind || !sameMonsterSource) {
        return [{ location, cardName, selectionId }];
      }

      return [...previous, { location, cardName, selectionId }];
    });
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
    <AppShell roomName={roomName} roomId={roomId}>
      <div className="workshop-view">
        <div className="workshop-header">
          <div>
            <h1>Deck Workshop</h1>
            <p>Manage equipped and unequipped cards in one view.</p>
          </div>
          <button className="btn" onClick={() => void refresh()} disabled={!roomId || loading || busy}>
            Sync
          </button>
        </div>

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg">{error}</div>}
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
              showSelectionHint={selectedCards.length > 0 && selectedMonsterName === monster.name}
              onDropCard={(source, cardName) =>
                handleDrop(source, { kind: 'monster', monsterName: monster.name }, cardName)
              }
              onTapSlot={(target) => {
                void handleSlotClick(target);
              }}
              onSelectCard={(location, cardName, selectionId) => handleSelect(location, cardName, selectionId)}
              onUnequipAll={() => {
                void handleUnequipAll(monster.name);
              }}
              onSavePreset={(presetName) => {
                void handleSavePreset(monster.name, presetName);
              }}
              onLoadPreset={(presetName) => {
                void handleLoadPreset(monster.name, presetName);
              }}
              onDeletePreset={(presetName) => {
                void handleDeletePreset(monster.name, presetName);
              }}
            />
          ))}
        </div>

        <InventoryPanel
          cards={unequippedDeck}
          selectedCards={selectedCards}
          onDropCard={(source, cardName) => handleDrop(source, { kind: 'inventory' }, cardName)}
          onTapSlot={() => {
            void handleSlotClick({ kind: 'inventory' });
          }}
          onSelectCard={(location, cardName, selectionId) => handleSelect(location, cardName, selectionId)}
        />
      </div>
    </AppShell>
  );
}
