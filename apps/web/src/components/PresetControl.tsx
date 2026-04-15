import { useId, useState } from 'react';

interface PresetControlProps {
  monsterName: string;
  presets: Record<string, string[]>;
  onLoad: (presetName: string) => Promise<void> | void;
  onSave: (presetName: string) => Promise<void> | void;
  onDelete: (presetName: string) => Promise<void> | void;
  disabled?: boolean;
}

export default function PresetControl({
  monsterName,
  presets,
  onLoad,
  onSave,
  onDelete,
  disabled = false,
}: PresetControlProps) {
  const baseId = useId();
  const selectId = `${baseId}-${monsterName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'monster'}-preset-select`;
  const [selectedPreset, setSelectedPreset] = useState('');
  const [newPresetName, setNewPresetName] = useState('');

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
          type="button"
          className="btn"
          disabled={disabled || !selectedPreset}
          onClick={() => void onLoad(selectedPreset)}
        >
          Load
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled || !selectedPreset}
          onClick={() => void onDelete(selectedPreset)}
        >
          Delete
        </button>
      </div>
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
