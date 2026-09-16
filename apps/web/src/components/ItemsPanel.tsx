import { buildTieredItemList, type ItemSummary, type TierMonsterState, type TieredItem } from '../utils/item-tiers.js';

export type ItemsPanelMonster = TierMonsterState;

interface ItemsPanelProps {
  items: {
    character: ItemSummary[];
    monsters: Array<{ monsterName: string; items: ItemSummary[] }>;
  };
  monsters: ItemsPanelMonster[];
}

function sourceLabel(source: TieredItem['source']): string {
  return source.kind === 'character' ? 'Your pocket' : source.monsterName;
}

function tierTitle(entry: TieredItem): string {
  const parts = [entry.item.displayName, entry.item.stats];
  if (entry.reason) parts.push(entry.reason);
  return parts.join(' — ');
}

/**
 * The workshop's item list (roadmap/19-player-agency-and-items.md §7). One sorted list,
 * never a filter: everything a player owns stays visible, and what can actually be used
 * right now is unmistakable at a glance — the same visual language the card inventory
 * already uses for `.workshop-card-slot.incompatible` (dim + dashed border), plus a reason
 * for why, because a dimmed row with no reason reads as a bug.
 *
 * Display-only for now: there is no `use item` tRPC mutation yet (only the generic
 * `game.command` text pipeline), and the one-tap mid-fight affordance from §7 is explicitly
 * a later step (the ring pane, not the workshop). This panel gives the pre-fight stocking
 * decision — "what did I actually carry into the ring" — the visibility §6/§7 call for.
 */
export default function ItemsPanel({ items, monsters }: ItemsPanelProps) {
  const tiered = buildTieredItemList(items, monsters);
  const usableNowCount = tiered.filter((entry) => entry.tier === 1).length;
  const totalCount = tiered.length;

  return (
    <section className="workshop-items">
      <header className="workshop-section-header">
        <div>
          <h2>Your Items</h2>
          <p className="workshop-filter-summary">
            {usableNowCount} usable now ({totalCount} item{totalCount === 1 ? '' : 's'}).
          </p>
        </div>
      </header>

      {totalCount < 1 ? (
        <div className="workshop-empty-state">No items yet.</div>
      ) : (
        <ul className="workshop-item-list">
          {tiered.map((entry, index) => (
            <li
              key={`${sourceLabel(entry.source)}-${entry.item.displayName}-${index}`}
              className={[
                'workshop-item-row',
                `tier-${entry.tier}`,
                entry.tier !== 1 ? 'incompatible' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={tierTitle(entry)}
              aria-disabled={entry.tier !== 1}
            >
              <div className="workshop-item-row-main">
                <span className="workshop-item-name">{entry.item.displayName}</span>
                <span className="workshop-item-source">{sourceLabel(entry.source)}</span>
              </div>
              <div className="workshop-item-row-meta">
                <span className="workshop-item-stats">{entry.item.stats}</span>
                {entry.reason && <span className="workshop-item-reason">{entry.reason}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
