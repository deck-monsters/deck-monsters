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
  selectedMonsterName: string | null;
  selectedCard: { location: WorkshopCardLocation; cardName: string } | null;
  onDropCard: (source: WorkshopCardLocation, cardName: string) => Promise<void> | void;
  onTapSlot: (target: WorkshopCardLocation) => void;
  onSelectCard: (location: WorkshopCardLocation, cardName: string) => void;
  onSavePreset: (presetName: string) => void;
  onLoadPreset: (presetName: string) => void;
  onDeletePreset: (presetName: string) => void;
};

export default function MonsterWorkshopPanel({
  monster,
  selectedMonsterName,
  selectedCard,
  onDropCard,
  onTapSlot,
  onSelectCard,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: MonsterPanelProps) {
  const locked = monster.inRing || monster.inEncounter;
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
          return (
            <CardSlot
              key={`${monster.name}-${idx}`}
              cardName={cardName}
              location={location}
              isDropActive={false}
              selected={
                !!selectedCard &&
                selectedCard.location.kind === 'monster' &&
                selectedCard.location.monsterName === monster.name &&
                selectedCard.cardName === cardName
              }
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
        onLoad={onLoadPreset}
        onSave={onSavePreset}
        onDelete={onDeletePreset}
        disabled={locked}
      />

      {selectedMonsterName === monster.name && (
        <div className="workshop-mobile-hint">
          Tap destination slot or inventory to move selected card.
        </div>
      )}
    </section>
  );
}
