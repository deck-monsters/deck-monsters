import { useEffect, useId, useRef, useState } from 'react';
import { presetTakeQuestion } from '../lib/cardRefusal.js';
import type { PresetLoadPlan, PresetTakeView } from '../lib/presetTakes.js';

/** The explicit list `loadPreset` takes: one entry per card and donor, with a copy count. */
export type PresetTakeFrom = Array<{ monsterName: string; cardName: string; count: number }>;

function toTakeFrom(takes: PresetTakeView[]): PresetTakeFrom {
  const entries: PresetTakeFrom = [];
  for (const { cardName, fromMonsterName } of takes) {
    const entry = entries.find((item) => item.monsterName === fromMonsterName && item.cardName === cardName);
    if (entry) entry.count += 1;
    else entries.push({ monsterName: fromMonsterName, cardName, count: 1 });
  }
  return entries;
}

interface PresetControlProps {
  monsterName: string;
  presets: Record<string, string[]>;
  /** `takeFrom` is set only when the player agreed to take cards off their other monsters. */
  onLoad: (presetName: string, takeFrom?: PresetTakeFrom) => Promise<void> | void;
  /**
   * Which cards the preset needs that only other monsters hold. When it names any, Load asks
   * first (see `presetTakes.ts`); without it Load goes straight through, as it always did.
   */
  planLoad?: (presetName: string) => PresetLoadPlan;
  onSave: (presetName: string) => Promise<void> | void;
  onDelete: (presetName: string) => Promise<void> | void;
  disabled?: boolean;
}

export default function PresetControl({
  monsterName,
  presets,
  onLoad,
  planLoad,
  onSave,
  onDelete,
  disabled = false,
}: PresetControlProps) {
  const baseId = useId();
  const selectId = `${baseId}-${monsterName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'monster'}-preset-select`;
  const [selectedPreset, setSelectedPreset] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  // The question waiting for an answer, or null. In-app rather than `window.confirm`, which a
  // phone shows as a browser dialog that cannot name cards or carry a third choice.
  const [pending, setPending] = useState<{ presetName: string; takes: PresetTakeView[] } | null>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const questionId = `${selectId}-take-question`;

  // The question is about one preset on one monster: choosing another preset retires it.
  useEffect(() => setPending(null), [selectedPreset, monsterName]);
  // Move focus to the safe-to-press first answer so the keyboard lands on the question.
  useEffect(() => {
    if (pending) yesRef.current?.focus();
  }, [pending]);

  const presetNames = Object.keys(presets).sort((a, b) => a.localeCompare(b));

  return (
    <div className="workshop-presets">
      <label className="workshop-subheading" htmlFor={selectId}>
        Presets
      </label>
      <div className="workshop-preset-row">
        <select
          id={selectId}
          className="workshop-select"
          value={selectedPreset}
          disabled={disabled}
          onChange={(event) => setSelectedPreset(event.target.value)}
        >
          <option value="">Select preset</option>
          {presetNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          title="Replace the monster's deck with this preset's cards. Asks first if a card is on another of your monsters" // DRAFT(39)
          type="button"
          className="btn"
          disabled={disabled || !selectedPreset}
          onClick={() => {
            const plan = planLoad?.(selectedPreset);
            if (plan && plan.takes.length > 0) {
              setPending({ presetName: selectedPreset, takes: plan.takes });
              return;
            }
            void onLoad(selectedPreset);
          }}
        >
          Load
        </button>
        <button
          title="Delete this preset. The cards stay where they are"
          type="button"
          className="btn"
          disabled={disabled || !selectedPreset}
          onClick={() => void onDelete(selectedPreset)}
        >
          Delete
        </button>
      </div>
      {pending && (
        <div
          role="group"
          aria-labelledby={questionId}
          className="workshop-preset-confirm"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setPending(null);
            }
          }}
        >
          <p id={questionId} className="workshop-preset-confirm-text">
            {presetTakeQuestion({ monsterName, takes: pending.takes })}
          </p>
          <div className="workshop-preset-confirm-actions">
            <button
              ref={yesRef}
              type="button"
              className="btn"
              title="Move these cards onto this monster and load the preset" // DRAFT(39)
              onClick={() => {
                const { presetName, takes } = pending;
                setPending(null);
                void onLoad(presetName, toTakeFrom(takes));
              }}
            >
              {pending.takes.length === 1 ? 'Yes, take it' : 'Yes, take them'}
            </button>
            <button
              type="button"
              className="btn"
              title="Load the preset with only the cards in your deck. Cards on your other monsters stay where they are" // DRAFT(39)
              onClick={() => {
                const { presetName } = pending;
                setPending(null);
                void onLoad(presetName);
              }}
            >
              No, leave {pending.takes.length === 1 ? 'it' : 'them'}
            </button>
            <button
              type="button"
              className="btn"
              title="Do nothing. The monster keeps its cards" // DRAFT(39)
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="workshop-preset-row">
        <input
          type="text"
          className="workshop-input"
          placeholder="Store as..."
          value={newPresetName}
          disabled={disabled}
          onChange={(event) => setNewPresetName(event.target.value)}
        />
        <button
          title="Save the monster's deck as a preset with this name"
          type="button"
          className="btn"
          disabled={disabled || newPresetName.trim().length < 1}
          onClick={async () => {
            const name = newPresetName.trim();
            if (!name) return;
            await onSave(name);
            setNewPresetName('');
            setSelectedPreset(name);
          }}
        >
          Store
        </button>
      </div>
    </div>
  );
}
