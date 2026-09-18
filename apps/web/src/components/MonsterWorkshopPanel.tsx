import { useMemo } from 'react';
import CardSlot, { type WorkshopCardLocation } from './CardSlot.js';
import PresetControl from './PresetControl.js';

type MonsterCompatibilityHint = 'none' | 'eligible' | 'ineligible';

type MonsterPanelProps = {
  monster: {
    name: string;
    type: string;
    level: number;
    xpIntoLevel: number;
    xpNeededForLevel: number;
    dead: boolean;
    inRing: boolean;
    inEncounter: boolean;
    cardSlots: number;
    cards: string[];
    presets: Record<string, string[]>;
  };
  showSelectionHint: boolean;
  selectedCards: Array<{ location: WorkshopCardLocation; cardName: string; selectionId: string }>;
  onDropCard: (
    source: WorkshopCardLocation,
    cardName: string,
    sourceSelectionId?: string,
    targetSelectionId?: string,
  ) => Promise<void> | void;
  onTapSlot: (target: WorkshopCardLocation) => void;
  onSelectCard: (location: WorkshopCardLocation, cardName: string, selectionId: string) => void;
  onUnequipAll: () => void;
  onRevive: () => void;
  onSendToRing: () => void;
  busy?: boolean;
  /**
   * Whether ANY of this player's monsters is already a contestant — not just this one.
   * `Beastmaster.sendMonsterToTheRing` rejects on `contestants.filter(c => c.character ===
   * character)`, so one monster in the ring blocks every other, and a dead contestant
   * awaiting cleanup blocks too. Without this the button stayed enabled, asked for
   * confirmation, and then failed. See 10b-bugs-fixed.md #115.
   */
  anotherMonsterInRing?: boolean;
  onSavePreset: (presetName: string) => void;
  onLoadPreset: (presetName: string) => void;
  onDeletePreset: (presetName: string) => void;
  isFilterActive?: boolean;
  isFilterTarget?: boolean;
  compatibilityHint?: MonsterCompatibilityHint;
  onToggleFilter?: () => void;
};

export default function MonsterWorkshopPanel({
  monster,
  showSelectionHint,
  selectedCards,
  onDropCard,
  onTapSlot,
  onSelectCard,
  onUnequipAll,
  onRevive,
  onSendToRing,
  busy = false,
  anotherMonsterInRing = false,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  isFilterActive = false,
  isFilterTarget = false,
  compatibilityHint = 'none',
  onToggleFilter,
}: MonsterPanelProps) {
  const locked = monster.inEncounter;
  const slots = useMemo(() => {
    const total = Math.max(monster.cardSlots, 1);
    return Array.from({ length: total }, (_, idx) => monster.cards[idx] ?? null);
  }, [monster.cardSlots, monster.cards]);
  const usagePct = Math.min(100, Math.round((monster.cards.length / Math.max(monster.cardSlots, 1)) * 100));
  const xpNeeded = Math.max(monster.xpNeededForLevel, 1);
  const xpPct = Math.min(100, Math.max(0, Math.round((monster.xpIntoLevel / xpNeeded) * 100)));

  return (
    <section
      className={[
        'workshop-monster-panel',
        monster.inRing ? 'in-ring' : '',
        locked ? 'locked' : '',
        isFilterActive ? 'filter-active' : '',
        isFilterTarget ? 'filter-target' : '',
        compatibilityHint === 'eligible' ? 'compatibility-eligible' : '',
        compatibilityHint === 'ineligible' ? 'compatibility-ineligible' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="workshop-monster-header">
        <div className="workshop-monster-title">
          <button
            type="button"
            className={`workshop-monster-filter-btn${isFilterTarget ? ' active' : ''}`}
            onClick={() => onToggleFilter?.()}
            aria-pressed={isFilterTarget}
            title={
              isFilterTarget
                ? `Clear inventory filter for ${monster.name}`
                : `Filter inventory cards for ${monster.name}`
            }
          >
            <span>{monster.name}</span>
          </button>
          <p>
            {monster.type}, L{monster.level}
          </p>
        </div>
        {/*
          The count sits beside the bar, not on top of it. Overlaid, it was drawn in
          `--color-fg-bright` over an `--color-accent` fill — 1.02:1 contrast in the
          phosphor theme, i.e. invisible, and worst at a full deck where the fill reaches
          the whole label. See 10b-bugs-fixed.md #120.
        */}
        <div className="workshop-slot-meter">
          <span>{monster.cards.length}/{monster.cardSlots} slots</span>
          <div
            className="workshop-slot-meter-track"
            role="progressbar"
            aria-valuenow={monster.cards.length}
            aria-valuemin={0}
            aria-valuemax={monster.cardSlots}
            aria-label={`${monster.cards.length} of ${monster.cardSlots} slots used`}
          >
            <div style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      </div>
      {/*
        Same "label beside the track, never on it" rule as the slot meter above (and the
        same reason — 10b-bugs-fixed.md #120): a variable-width fill under white text on
        the accent colour is unreadable at a full bar. Progress feedback was the #1 ask
        in the Sept 2026 "levelling feels slow/invisible" feedback (see
        docs/roadmap/11-balance-and-mechanics.md), so this is worth its own row rather
        than folding into the slot meter — the two fill at unrelated rates.
      */}
      <div className="workshop-xp-meter">
        <span>Lvl {monster.level} · {monster.xpIntoLevel}/{xpNeeded} xp</span>
        <div
          className="workshop-xp-meter-track"
          role="progressbar"
          aria-valuenow={monster.xpIntoLevel}
          aria-valuemin={0}
          aria-valuemax={xpNeeded}
          aria-label={`${monster.name} has ${monster.xpIntoLevel} of ${xpNeeded} xp toward level ${monster.level + 1}`}
        >
          <div style={{ width: `${xpPct}%` }} />
        </div>
      </div>
      <div className="workshop-monster-actions">
        {monster.dead ? (
          <button type="button" className="btn" disabled={busy || monster.inEncounter} onClick={onRevive}>
            Revive
          </button>
        ) : !monster.inRing ? (
          <button
            type="button"
            className="btn"
            disabled={busy || anotherMonsterInRing || monster.cards.length < monster.cardSlots}
            // A disabled control with no reason reads as a bug rather than a rule, so say
            // which rule is stopping you.
            title={
              anotherMonsterInRing
                ? 'You already have a monster in the ring — only one at a time.'
                : monster.cards.length < monster.cardSlots
                  ? `${monster.name} needs a full deck before entering the ring.`
                  : `Send ${monster.name} to the ring`
            }
            onClick={onSendToRing}
          >
            Send to ring
          </button>
        ) : null}
        <button
          type="button"
          className="btn workshop-btn-icon"
          disabled={busy || locked || monster.cards.length < 1}
          title={`Unequip all cards from ${monster.name}`}
          aria-label={`Unequip all cards from ${monster.name}`}
          onClick={() => onUnequipAll()}
        >
          ⟲
        </button>
      </div>

      {isFilterTarget && <p className="workshop-filter-hint">Inventory filtered for {monster.name}.</p>}

      {compatibilityHint === 'eligible' && (
        <p className="workshop-compatibility-hint eligible">Can use selected inventory card.</p>
      )}
      {compatibilityHint === 'ineligible' && (
        <p className="workshop-compatibility-hint ineligible">Cannot use selected inventory card.</p>
      )}

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
              onDropCard={(source, droppedCardName, sourceSelectionId) =>
                onDropCard(source, droppedCardName, sourceSelectionId, selectionId)
              }
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
