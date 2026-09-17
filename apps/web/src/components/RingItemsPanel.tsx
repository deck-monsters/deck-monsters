import { useState } from 'react';
import { trpc } from '../lib/trpc.js';

interface RingItemsPanelProps { roomId: string; monsterName: string }

/** The bounded live-combat lever: only items this monster carried into the fight. */
export default function RingItemsPanel({ roomId, monsterName }: RingItemsPanelProps) {
  const utils = trpc.useUtils();
  const [message, setMessage] = useState<string | null>(null);
  const inventory = trpc.game.myInventory.useQuery({ roomId }, { refetchInterval: 15_000 });
  const useItem = trpc.game.useItem.useMutation({
    onSuccess: async (result) => {
      setMessage(result.applied ? `Used ${result.itemName}.` : `${result.itemName} had no effect and was not used up.`);
      await Promise.all([
        utils.game.myInventory.invalidate({ roomId }),
        utils.game.ringState.invalidate({ roomId }),
      ]);
    },
    onError: (error) => setMessage(error.message),
  });
  const carried = inventory.data?.items.monsters.find((entry) => entry.monsterName === monsterName)?.items ?? [];
  const usable = carried.filter((item) => !item.expired && !item.requiresPrompt && item.usableOnMonsters.includes(monsterName));

  return <details className="ring-items">
    <summary>Use an item ({usable.length} ready)</summary>
    <p>Only items {monsterName} carried into this fight can be used now.</p>
    {message && <p role="status" className="ring-items-message">{message}</p>}
    {usable.length === 0 ? <p className="ring-items-empty">No carried items are usable right now.</p> : (
      <div className="ring-items-actions">{usable.map((item, index) => (
        <button key={`${item.displayName}:${index}`} type="button" className="btn"
          disabled={useItem.isPending}
          title={`${item.stats} Use on ${monsterName}`}
          onClick={() => {
            if (!window.confirm(`Use ${item.displayName} on ${monsterName}?`)) return;
            setMessage(null);
            useItem.mutate({ roomId, itemName: item.displayName, monsterName, itemSource: 'monster' });
          }}>{item.displayName}</button>
      ))}</div>
    )}
  </details>;
}

