import { useParams, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { trpc } from '../lib/trpc.js';

interface CardEntry {
  index: number;
  name: string;
}

function parseCards(text: string): CardEntry[] {
  const lines = text.split('\n').filter(Boolean);
  const cards: CardEntry[] = [];
  for (const line of lines) {
    const match = /^\s*(\d+)[.)]\s+(.+)$/.exec(line);
    if (match) {
      cards.push({ index: parseInt(match[1]!), name: match[2]!.trim() });
    }
  }
  return cards;
}

export default function DeckBuilderView() {
  const { roomId, monsterName } = useParams<{ roomId: string; monsterName: string }>();
  const navigate = useNavigate();
  const decodedName = monsterName ? decodeURIComponent(monsterName) : '';

  const [cards, setCards] = useState<CardEntry[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fetchedRef = useRef(false);

  const sendCommand = trpc.game.command.useMutation({
    onError: (err) => setError(err.message),
  });

  trpc.game.ringFeed.useSubscription(
    { roomId: roomId! },
    {
      enabled: !!roomId,
      onData(tracked) {
        const event = tracked.data;
        if (event.scope === 'private' && event.text) {
          setOutput((prev) => {
            const next = [...prev, event.text];
            const parsed = parseCards(next.join('\n'));
            if (parsed.length > 0) setCards(parsed);
            return next;
          });
        }
      },
    }
  );

  useEffect(() => {
    if (!roomId || !decodedName || fetchedRef.current) return;
    fetchedRef.current = true;
    sendCommand.mutate({
      roomId,
      command: `look at ${decodedName}'s cards`,
      isDM: true,
    });
  }, [roomId, decodedName]);

  // Drag-and-drop reorder
  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }
  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...cards];
    const [moved] = next.splice(dragIdx, 1);
    if (!moved) return;
    next.splice(targetIdx, 0, moved);
    setCards(next.map((c, i) => ({ ...c, index: i + 1 })));
    setDragIdx(null);
    setDragOverIdx(null);
  }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  function handleEquip() {
    if (!roomId || !decodedName) return;
    setError(null);
    setSuccess(null);
    // The engine's equip command walks through an interactive prompt;
    // navigate to ring feed where the multi-step flow will play out.
    sendCommand.mutate({ roomId, command: `equip ${decodedName}`, isDM: true });
    setSuccess('Equip prompt sent — check the ring feed or your DMs to complete the flow.');
  }

  if (!roomId || !decodedName) return <div className="empty-state">No monster selected.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn" onClick={() => navigate(`/monsters/${roomId}`)}>
          ← Monsters
        </button>
        <h1 style={{ margin: 0 }}>{decodedName}'s Deck</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {cards.length === 0 && (
        <div className="empty-state">
          {sendCommand.isPending ? 'Loading deck…' : 'No cards found for this monster.'}
        </div>
      )}

      {cards.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
            Drag cards to reorder your deck. The order shown is the order they'll be played.
          </p>

          <div className="deck-list">
            {cards.map((card, idx) => (
              <div
                key={card.index}
                className={[
                  'deck-card-row',
                  dragIdx === idx ? 'dragging' : '',
                  dragOverIdx === idx ? 'drag-over' : '',
                ].join(' ')}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
              >
                <span className="deck-card-handle">⠿</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11, minWidth: 20 }}>
                  {idx + 1}
                </span>
                <span className="deck-card-name">{card.name}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleEquip}>
              Equip new deck
            </button>
          </div>
        </>
      )}

      {output.length > 0 && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12 }}>
            Raw output
          </summary>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 12,
              marginTop: 8,
            }}
          >
            {output.join('\n')}
          </div>
        </details>
      )}
    </div>
  );
}
