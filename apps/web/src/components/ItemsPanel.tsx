import { useState } from 'react';
import {
  buildTieredItemList,
  resolveUseTargets,
  type ItemSummary,
  type TierMonsterState,
  type TieredItem,
  type UseTarget,
} from '../utils/item-tiers.js';

export type ItemsPanelMonster = TierMonsterState;

interface ItemsPanelProps {
  items: {
    character: ItemSummary[];
    monsters: Array<{ monsterName: string; items: ItemSummary[] }>;
  };
  monsters: ItemsPanelMonster[];
  busy?: boolean;
  onUseItem?: (input: {
    itemName: string;
    monsterName?: string;
    itemSource: 'character' | 'monster';
  }) => void;
}

function sourceLabel(source: TieredItem['source']): string {
  return source.kind === 'character' ? 'Your pocket' : source.monsterName;
}

function targetLabel(target: UseTarget): string {
  return target.kind === 'character' ? 'yourself' : target.monsterName;
}

function tierTitle(entry: TieredItem): string {
  const parts = [entry.item.displayName, entry.item.stats];
  if (entry.reason) parts.push(entry.reason);
  return parts.join(' — ');
}

function rowKey(entry: TieredItem, index: number): string {
  return `${sourceLabel(entry.source)}-${entry.item.displayName}-${index}`;
}

/**
 * The workshop's item list (docs/architecture/workshop-and-items.md). One sorted list,
 * never a filter: everything a player owns stays visible, and what can actually be used
 * right now is unmistakable at a glance — the same visual language the card inventory
 * already uses for `.workshop-card-slot.incompatible` (dim + dashed border), plus a reason
 * for why, because a dimmed row with no reason reads as a bug.
 *
 * Tier-1 rows now carry a real use button, backed by the `game.useItem` mutation. The
 * targets it offers come from `resolveUseTargets`, derived from the same facts that set the
 * tier, so the button cannot offer a target the engine will refuse. The confirm is what
 * lets the server pass `confirmed: true` and skip the engine's own prompt — see
 * `items/helpers/use.ts`.
 */
export default function ItemsPanel({ items, monsters, busy, onUseItem }: ItemsPanelProps) {
  const tiered = buildTieredItemList(items, monsters);
  const usableNowCount = tiered.filter((entry) => entry.tier === 1).length;
  const totalCount = tiered.length;
  // Only set for rows with more than one valid target; a single-target row needs no picker.
  const [chosenTarget, setChosenTarget] = useState<Record<string, string>>({});

  function handleUse(entry: TieredItem, target: UseTarget) {
    if (!onUseItem) return;
    const itemName = entry.item.displayName;
    if (!window.confirm(`Use ${itemName} on ${targetLabel(target)}?`)) return;
    onUseItem({
      itemName,
      monsterName: target.kind === 'monster' ? target.monsterName : undefined,
      // Which row was clicked. Both pools can hold the same item type, and without this the
      // engine's name match takes the monster's copy — spending one deliberately stocked.
      itemSource: entry.source.kind,
    });
  }

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
          {tiered.map((entry, index) => {
            const key = rowKey(entry, index);
            const targets = resolveUseTargets(entry, monsters);
            const selectedKey = chosenTarget[key] ?? (targets[0] ? targetLabel(targets[0]) : '');
            const target = targets.find((candidate) => targetLabel(candidate) === selectedKey) ?? targets[0];

            return (
              <li
                key={key}
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
                  {onUseItem && target && (
                    <span className="workshop-item-use">
                      {targets.length > 1 && (
                        <select
                          className="workshop-select"
                          aria-label={`Target for ${entry.item.displayName}`}
                          value={selectedKey}
                          disabled={busy}
                          onChange={(event) =>
                            setChosenTarget((current) => ({ ...current, [key]: event.target.value }))
                          }
                        >
                          {targets.map((candidate) => (
                            <option key={targetLabel(candidate)} value={targetLabel(candidate)}>
                              {targetLabel(candidate)}
                            </option>
                          ))}
                        </select>
                      )}
                      {/*
                        Visible text stays "Use" — the row already names the item — but a
                        screen reader hears a list of identical "Use" buttons without the
                        label, which is the classic ambiguous-button-name problem.
                      */}
                      <button
                        type="button"
                        className="btn workshop-inline-btn"
                        disabled={busy}
                        aria-label={`Use ${entry.item.displayName} on ${targetLabel(target)}`}
                        onClick={() => handleUse(entry, target)}
                      >
                        Use
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
