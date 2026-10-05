import { useEffect, useMemo, useState } from 'react';
import { formatRelativeFromNow } from '../utils/format-relative.js';
import CardSlot, { type WorkshopCardLocation } from './CardSlot.js';
import PresetControl from './PresetControl.js';
import LevelUpSheet, { type LevelUpGainsView } from './LevelUpSheet.js';
// Reusing the ring roster's own hp math/bands rather than re-deriving them here — the two
// bars must never drift apart on what counts as "hurt" vs "critical". Only the pure
// functions are imported; the markup below is its own copy (see the "why" note on the hp
// meter markup) rather than a shared `<HpMeter>` component, since RingRoster's contestant
// row bakes hp/ac/name text into the same block the bar lives in and splitting that out
// carried more refactor risk than the (small, now duplicated) bar/track markup was worth.
import { hpBand, hpRatio } from './RingRoster.js';

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
    hp: number;
    maxHp: number;
    // Epoch ms when a fallen monster's revival completes, or null when alive or when no
    // revival timer is running. See `InventoryMonsterSummary.revivesAt` in the server
    // router for why "dead with no timer" is a real, distinct case.
    revivesAt: number | null;
    battles: { wins: number; losses: number; total: number };
    // The next level above this monster's that opens any card, and what the next level
    // changes: both for the level-up details its XP bar opens (LevelUpSheet).
    nextCards?: { level: number; cards: string[] } | null;
    nextLevel?: LevelUpGainsView;
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
  /** `{Card} can't go on {Monster}: {reason}.` shown when the hint is 'ineligible'. */
  refusalSentence?: string;
  onToggleFilter?: () => void;
  /** Opens the card detail sheet for a card in this monster's deck. */
  onShowDetails?: (cardName: string, opener: HTMLElement) => void;
};

/**
 * `Fallen · back at 3:05 PM (in 12 min)`, then `Fallen · back in 40 s` for the last minute.
 * The clock time is the viewer's local time.
 */
function revivalStatus(revivesAt: number, now: number): string {
  const remainingMs = revivesAt - now;
  if (remainingMs <= 0) return 'Fallen · almost back';
  // Under 60 s left, count seconds; clamp so rounding up never shows "60 s".
  if (remainingMs < 60_000) return `Fallen · back in ${Math.min(59, Math.ceil(remainingMs / 1000))} s`;
  const time = new Date(revivesAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Fallen · back at ${time} (${formatRelativeFromNow(revivesAt, now)})`;
}

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
  refusalSentence,
  onToggleFilter,
  onShowDetails,
}: MonsterPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  // The XP bar that opened the level-up details, or null while they are closed.
  const [levelSheetOpener, setLevelSheetOpener] = useState<HTMLElement | null>(null);
  const locked = monster.inEncounter;
  const slots = useMemo(() => {
    const total = Math.max(monster.cardSlots, 1);
    return Array.from({ length: total }, (_, idx) => monster.cards[idx] ?? null);
  }, [monster.cardSlots, monster.cards]);
  const xpNeeded = Math.max(monster.xpNeededForLevel, 1);
  const xpPct = Math.min(100, Math.max(0, Math.round((monster.xpIntoLevel / xpNeeded) * 100)));

  // One tag, in priority order — a monster can technically be flagged more than one of
  // these at once (e.g. a boss variant mid-fight while also marked dead pending cleanup),
  // and showing all three would crowd the title row for no added information: "in the
  // ring" already implies "not benched", and either ring state already implies "not what
  // you'd do next with this monster right now" the way "fallen" does.
  const statusTag = monster.inRing
    ? { key: 'in-ring', label: 'in the ring' }
    : monster.inEncounter
      ? { key: 'fighting', label: 'fighting' }
      : monster.dead
        ? { key: 'fallen', label: 'fallen' }
        : null;

  // Required props can still be absent in vi.mock test doubles.
  const hp = Number.isFinite(monster.hp) ? monster.hp : 0;
  const maxHp = Number.isFinite(monster.maxHp) ? monster.maxHp : 1;
  const battles = monster.battles ?? { wins: 0, losses: 0, total: 0 };
  const revivesAt =
    typeof monster.revivesAt === 'number' && Number.isFinite(monster.revivesAt)
      ? monster.revivesAt
      : undefined;

  // In the last minute the label counts seconds, so the clock has to tick every second
  // there; before that a 30 s tick is plenty for a minutes label. `now` is not a dependency
  // of the interval itself, only the boolean flip is, so the timer is restarted once.
  const inLastMinute = revivesAt !== undefined && revivesAt - now < 60_000;
  useEffect(() => {
    if (revivesAt === undefined) return;

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), inLastMinute ? 1_000 : 30_000);
    // Wake exactly when the last minute begins instead of waiting for the next 30 s tick,
    // which could leave a "(in 1 min)" label up for up to 30 s of the final minute.
    const untilLastMinute = revivesAt - 60_000 - Date.now() + 1;
    const flip =
      !inLastMinute && untilLastMinute > 0 && untilLastMinute < 2_147_000_000
        ? setTimeout(() => setNow(Date.now()), untilLastMinute)
        : undefined;
    return () => {
      clearInterval(interval);
      if (flip !== undefined) clearTimeout(flip);
    };
  }, [revivesAt, inLastMinute]);

  const hpRatioValue = hpRatio(hp, maxHp);
  // Same "force critical when dead" rule as `RingRoster`'s `ContestantRow` — a dead
  // monster's hp is already clamped to 0 server-side, so the ratio alone would already
  // land in the critical band, but this keeps the two bars' banding logic identical on
  // its face rather than relying on that clamp never changing.
  const hpBandValue = monster.dead ? 'critical' : hpBand(hpRatioValue);
  // `revivesAt` is set only once a revival has started (`respawn()` in the engine runs from
  // Beastmaster.reviveMonster, the Spin Up potion, or a restore), never merely because the
  // monster died — so its presence is what turns Revive into "Reviving…".
  const reviving = monster.dead && revivesAt !== undefined;
  const hpLabel = monster.dead
    ? revivesAt !== undefined
      ? revivalStatus(revivesAt, now)
      : 'Fallen'
    : `HP ${hp}/${maxHp}`;

  const deckNeedsMore = Math.max(0, monster.cardSlots - monster.cards.length);
  const deckLabel = `Deck ${monster.cards.length}/${monster.cardSlots}`;

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
          <div className="workshop-monster-title-row">
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
            {statusTag && (
              <span className={`workshop-status-tag workshop-status-${statusTag.key}`}>
                {statusTag.label}
              </span>
            )}
          </div>
          <p>
            {monster.type} · Lvl {monster.level}
          </p>
        </div>
      </div>
      {/*
        HP replaces the old deck-slot bar as the primary meter: a 9/9 deck-slot count is
        full almost all the time and tells a beastmaster nothing about whether to revive,
        send to the ring, or wait, while current HP is the one number that answers all
        three. See 10b-bugs-fixed.md (workshop HP-not-shown entry). Same "label beside the
        track, never on top of it" rule as the old slot/xp meters (10b-bugs-fixed.md #120)
        — a variable-width fill under fixed-colour text is unreadable at a full bar.
      */}
      <div className="workshop-hp-meter">
        <span>{hpLabel}</span>
        <div
          className="roster-bar-track"
          role="meter"
          aria-valuenow={Math.max(0, hp)}
          aria-valuemin={0}
          aria-valuemax={Math.max(maxHp, 0)}
          aria-label={`${monster.name} health`}
        >
          <div
            className={`roster-bar-fill roster-bar-${hpBandValue}`}
            style={{ width: `${monster.dead ? 0 : Math.round(hpRatioValue * 100)}%` }}
          />
        </div>
      </div>
      {/*
        The XP bar is a button: it opens what the next level brings (LevelUpSheet, bug 225).
        That replaced an "At level 3: Pound and Vengeful Rampage." line under the type, which
        named cards with no context. `Lvl N ›` at the end says the bar opens something; the
        accessible name carries the XP figures, since a button's content is not read as a
        progress bar.
      */}
      <button
        type="button"
        className="workshop-xp-meter"
        aria-haspopup="dialog"
        aria-label={`${monster.name} has ${monster.xpIntoLevel} of ${xpNeeded} xp toward level ${monster.level + 1}. See what level ${monster.level + 1} brings`}
        title={`What level ${monster.level + 1} brings ${monster.name}`}
        onClick={(event) => setLevelSheetOpener(event.currentTarget)}
      >
        <span>XP {monster.xpIntoLevel}/{xpNeeded}</span>
        <span className="workshop-xp-meter-track" aria-hidden="true">
          <span style={{ width: `${xpPct}%` }} />
        </span>
        <span className="workshop-xp-next" aria-hidden="true">Lvl {monster.level + 1} ›</span>
      </button>
      {levelSheetOpener && (
        <LevelUpSheet
          monsterName={monster.name}
          xpIntoLevel={monster.xpIntoLevel}
          xpNeededForLevel={xpNeeded}
          nextLevel={monster.nextLevel}
          nextCards={monster.nextCards}
          opener={levelSheetOpener}
          onClose={() => setLevelSheetOpener(null)}
        />
      )}
      <div className="workshop-monster-actions">
        {monster.dead ? (
          <button title={reviving ? `${monster.name} is on the way back` : `Bring ${monster.name} back. Above level 0 it takes a few minutes`} type="button" className="btn" disabled={busy || monster.inEncounter || reviving} onClick={onRevive}>
            {reviving ? 'Reviving…' : 'Revive'}
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
          className="btn"
          disabled={busy || locked || monster.cards.length < 1}
          // No aria-label: the visible words are the accessible name, so voice control's
          // "click Unequip all" works (WCAG 2.5.3); the title adds the detail.
          title={`Move all of ${monster.name}'s cards back to your cards`}
          onClick={() => onUnequipAll()}
        >
          Unequip all
        </button>
      </div>

      {isFilterTarget && <p className="workshop-filter-hint">Inventory filtered for {monster.name}.</p>}

      {compatibilityHint === 'eligible' && (
        <p className="workshop-compatibility-hint eligible">Can use selected inventory card.</p>
      )}
      {compatibilityHint === 'ineligible' && (
        <p className="workshop-compatibility-hint ineligible">{refusalSentence ?? 'Cannot use selected inventory card.'}</p>
      )}

      {locked && (
        <p className="workshop-warning">
          {monster.name} is in a fight. Cards unlock when it ends.
        </p>
      )}

      {/*
        Deck size as text, not a bar — see the hp-meter comment above for why a
        near-always-full bar carries no information. It sits right above the slots it counts
        (bug 226): above the action buttons, "needs 9 more" was a line away from the empty
        slots it meant, and a new player could not tell what it was counting. It stays out of
        the actions row so "Send to ring" / "Revive" are not crowded at a 375px phone width.
      */}
      <div className="workshop-deck-status">
        <span className="workshop-deck-count">
          {deckLabel}
          {deckNeedsMore > 0 && (
            <span className="workshop-deck-needs-more"> · needs {deckNeedsMore} more to enter the ring</span>
          )}
        </span>
        <span className="workshop-fights-count">
          {battles.wins}W {battles.losses}L
        </span>
      </div>

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
              disabled={busy || locked}
              onSelectCard={onSelectCard}
              onShowDetails={onShowDetails}
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
        disabled={busy || locked}
      />

      {showSelectionHint && (
        <div className="workshop-mobile-hint">
          Tap destination slot (or inventory) to move selected cards.
        </div>
      )}
    </section>
  );
}
