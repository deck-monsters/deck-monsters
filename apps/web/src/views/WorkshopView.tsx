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
} | null;

export default function WorkshopView() {
  const { roomId } = useParams<{ roomId: string }>();
  const [selected, setSelected] = useState<SelectionState>(null);
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
    if (!selected || selected.location.kind !== 'monster') return null;
    return selected.location.monsterName;
  }, [selected]);

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
        await equipCards({
          monsterName: target.monsterName,
          cardNames: [cardName],
          replaceAll: false,
        });
        setMessage(`Equipped ${cardName} on ${target.monsterName}.`);
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

  async function handleSlotClick(target: WorkshopCardLocation) {
    if (!selected || !roomId) return;
    const payload = selected;
    setSelected(null);
    await handleDrop(payload.location, target, payload.cardName);
  }

  function handleSelect(location: WorkshopCardLocation, cardName: string) {
    setSelected({ location, cardName });
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
            Refresh
          </button>
        </div>

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg">{error}</div>}
        {busy && <div className="workshop-banner">Applying changes…</div>}

        <div className="workshop-monster-row">
          {monsters.map((monster) => (
            <MonsterWorkshopPanel
              key={monster.name}
              monster={monster}
              selectedCard={selected}
              selectedMonsterName={selectedMonsterName}
              onDropCard={(source, cardName) =>
                handleDrop(source, { kind: 'monster', monsterName: monster.name }, cardName)
              }
              onTapSlot={(target) => {
                void handleSlotClick(target);
              }}
              onSelectCard={(location, cardName) => handleSelect(location, cardName)}
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
          selectedCard={selected}
          onDropCard={(source, cardName) => handleDrop(source, { kind: 'inventory' }, cardName)}
          onTapSlot={() => {
            void handleSlotClick({ kind: 'inventory' });
          }}
          onSelectCard={(location, cardName) => handleSelect(location, cardName)}
        />
      </div>
    </AppShell>
  );
}
