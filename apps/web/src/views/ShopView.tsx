import { useParams, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { trpc } from '../lib/trpc.js';

interface ShopItem {
  name: string;
  cost: string;
  description: string;
}

function parseShopItems(text: string): ShopItem[] {
  const items: ShopItem[] = [];
  const lines = text.split('\n').filter(Boolean);
  let current: Partial<ShopItem> | null = null;

  for (const line of lines) {
    // Match "1) Item Name — 50 coins" or "1) Item Name (50 coins)"
    const headerMatch = /^\s*\d+[.)]\s+(.+?)\s*[—–-]\s*(\d+\s*coins?)/i.exec(line)
      ?? /^\s*\d+[.)]\s+(.+?)\s*\((\d+\s*coins?)\)/i.exec(line);
    if (headerMatch) {
      if (current?.name) items.push(current as ShopItem);
      current = { name: headerMatch[1]!.trim(), cost: headerMatch[2]!.trim(), description: '' };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('=')) {
        current.description = current.description
          ? `${current.description} ${trimmed}`
          : trimmed;
      }
    }
  }
  if (current?.name) items.push(current as ShopItem);
  return items;
}

export default function ShopView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
            const parsed = parseShopItems(next.join('\n'));
            if (parsed.length > 0) setItems(parsed);
            return next;
          });
        }
      },
    }
  );

  useEffect(() => {
    if (!roomId || fetchedRef.current) return;
    fetchedRef.current = true;
    sendCommand.mutate({ roomId, command: 'look at shop', isDM: true });
  }, [roomId]);

  function handleBuy(itemName: string) {
    if (!roomId) return;
    setError(null);
    setSuccess(null);
    sendCommand.mutate(
      { roomId, command: `buy ${itemName}`, isDM: true },
      { onSuccess: () => setSuccess(`Purchased ${itemName}!`) }
    );
  }

  if (!roomId) return <div className="empty-state">No room selected.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Shop</h1>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => navigate(`/ring/${roomId}`)}>
          Ring Feed
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {items.length === 0 && (
        <div className="empty-state">
          {sendCommand.isPending ? 'Loading shop…' : 'Shop is empty or could not load.'}
        </div>
      )}

      <div className="shop-grid">
        {items.map((item) => (
          <div key={item.name} className="shop-item">
            <p className="shop-item-name">{item.name}</p>
            <p className="shop-item-cost">{item.cost}</p>
            {item.description && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 10px' }}>
                {item.description}
              </p>
            )}
            <button className="btn btn-primary" onClick={() => handleBuy(item.name)}>
              Buy
            </button>
          </div>
        ))}
      </div>

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
