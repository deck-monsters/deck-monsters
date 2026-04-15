import { useMemo } from 'react';
import CardSlot, { type WorkshopCardLocation } from './CardSlot.js';
import PresetControl from './PresetControl.js';

type MonsterPanelProps = {
  monster: {
    name: string;
    type: string;
    level: number;
    inRing: boolean;
    inEncounter: boolean;
    cardSlots: number;
    cards: string[];
    presets: Record<string, string[]>;
  };
  showSelectionHint: boolean;
  selectedCards: Array<{ location: WorkshopCardLocation; cardName: string; selectionId: string }>;
  onDropCard: (source: WorkshopCardLocation, cardName: string) => Promise<void> | void;
  onTapSlot: (target: WorkshopCardLocation) => void;
  onSelectCard: (location: WorkshopCardLocation, cardName: string, selectionId: string) => void;
  onUnequipAll: () => void;
  onSavePreset: (presetName: string) => void;
  onLoadPreset: (presetName: string) => void;
  onDeletePreset: (presetName: string) => void;
};

export default function MonsterWorkshopPanel({
  monster,
  showSelectionHint,
  selectedCards,
  onDropCard,
  onTapSlot,
  onSelectCard,
  onUnequipAll,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: MonsterPanelProps) {
  const locked = monster.inEncounter;
  const slots = useMemo(() => {
    const total = Math.max(monster.cardSlots, 1);
    return Array.from({ length: total }, (_, idx) => monster.cards[idx] ?? null);
  }, [monster.cardSlots, monster.cards]);
  const usagePct = Math.min(100, Math.round((monster.cards.length / Math.max(monster.cardSlots, 1)) * 100));

  return (
    <section className={`workshop-monster-panel${monster.inRing ? ' in-ring' : ''}${locked ? ' locked' : ''}`}>
      <div className="workshop-monster-header">
        <div>
          <h3>{monster.name}</h3>
          <p>
            {monster.type}, L{monster.level}
          </p>
        </div>
        <div className="workshop-slot-meter" aria-label={`${monster.cards.length} of ${monster.cardSlots} slots used`}>
          <div style={{ width: `${usagePct}%` }} />
          <span>{monster.cards.length}/{monster.cardSlots} slots</span>
        </div>
      </div>
      <div className="workshop-monster-actions">
        <button
          type="button"
          className="btn workshop-btn-icon"
          disabled={locked || monster.cards.length < 1}
          title={`Unequip all cards from ${monster.name}`}
          aria-label={`Unequip all cards from ${monster.name}`}
          onClick={() => onUnequipAll()}
        >
          ⟲
        </button>
      </div>

      {locked && (
        <p className="workshop-warning">
          {monster.name} is currently fighting. Changes apply after they return.
        </p>
      )}

      <div className="workshop-slot-grid">
        {slots.map((cardName, idx) => {
          const location: WorkshopCardLocation = {
            kind: 'monster',
            monsterName: monster.name,
          };
          const selectionId = `${monster.name}:${idx}`;
          return (
            <CardSlot
              key={`${monster.name}-${idx}`}
              cardName={cardName}
              location={location}
              selectionId={selectionId}
              isDropActive={false}
              selected={selectedCards.some((selectedCard) => selectedCard.selectionId === selectionId)}
              disabled={locked}
              onSelectCard={onSelectCard}
              onTapSlot={onTapSlot}
              onDropCard={onDropCard}
            />
          );
        })}
      </div>

      <PresetControl
        presets={monster.presets ?? {}}
        monsterName={monster.name}
        onLoad={onLoadPreset}
        onSave={onSavePreset}
        onDelete={onDeletePreset}
        disabled={locked}
      />

      {showSelectionHint && (
        <div className="workshop-mobile-hint">
          Tap destination slot (or inventory) to move selected cards.
        </div>
      )}
    </section>
  );
}
