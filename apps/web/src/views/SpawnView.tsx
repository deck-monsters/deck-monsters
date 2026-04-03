import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '../lib/trpc.js';

const MONSTER_TYPES = [
  { value: 'basilisk', label: 'Basilisk', description: 'Cunning serpent. Balanced stats.' },
  { value: 'gladiator', label: 'Gladiator', description: 'Armored warrior. High AC, strong melee.' },
  { value: 'jinn', label: 'Jinn', description: 'Magical spirit. High INT, unpredictable.' },
  { value: 'minotaur', label: 'Minotaur', description: 'Brutal brute. High STR, low DEX.' },
  { value: 'weeping angel', label: 'Weeping Angel', description: 'Terrifying stalker. Fast and deadly.' },
];

export default function SpawnView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('');
  const [monsterName, setMonsterName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sendCommand = trpc.game.command.useMutation({
    onSuccess: () => {
      setSuccess(`${monsterName || 'Your monster'} has been spawned! Head to Monsters to see them.`);
      setMonsterName('');
      setSelectedType('');
    },
    onError: (err) => setError(err.message),
  });

  function handleSpawn(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !selectedType || !monsterName.trim()) return;
    setError(null);
    setSuccess(null);
    sendCommand.mutate({
      roomId,
      command: `spawn a ${selectedType} named ${monsterName.trim()}`,
      isDM: true,
    });
  }

  if (!roomId) return <div className="empty-state">No room selected.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn" onClick={() => navigate(`/monsters/${roomId}`)}>
          ← Monsters
        </button>
        <h1 style={{ margin: 0 }}>Spawn a Monster</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <form onSubmit={handleSpawn}>
        <div className="form-group">
          <label>Monster name</label>
          <input
            type="text"
            value={monsterName}
            onChange={(e) => setMonsterName(e.target.value)}
            placeholder="e.g. Fang, Blaze, Shadow…"
            required
          />
        </div>

        <div className="form-group">
          <label>Monster type</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8,
            }}
          >
            {MONSTER_TYPES.map((mt) => (
              <div
                key={mt.value}
                className={`monster-card ${selectedType === mt.value ? 'selected' : ''}`}
                onClick={() => setSelectedType(mt.value)}
              >
                <p className="monster-card-name">{mt.label}</p>
                <p className="monster-card-meta">{mt.description}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={sendCommand.isPending || !selectedType || !monsterName.trim()}
          style={{ marginTop: 8 }}
        >
          {sendCommand.isPending ? 'Spawning…' : 'Spawn monster'}
        </button>
      </form>
    </div>
  );
}
