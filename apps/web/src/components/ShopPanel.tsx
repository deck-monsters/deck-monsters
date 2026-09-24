import { useState } from 'react';

export type ShopStockItem = {
  stockIndex: number;
  stockCount: number;
  section: 'items' | 'backRoom' | 'cards';
  displayName: string;
  description: string;
  stats: string;
  price: number;
  affordable: boolean;
  ownedCount: number;
};

export type ShopSummary = {
  name: string;
  adjective: string;
  closingTime: string;
  coins: number;
  items: ShopStockItem[];
  cards: ShopStockItem[];
  backRoom: ShopStockItem[];
  // What `sellToShop` pays per unit of `cost`, right now — see `ItemSummary.cost` /
  // `InventorySummary.cardCosts` in the server router and `sell-pricing.ts` in the engine.
  sellOffset?: number;
};

// A group of identical owned cards or pocket items the player could sell, grouped by
// display name the same way the shop's own stock groups identical listings
// (`StockList`/`summarizeStock`) — selling 3 Bandages is one row with a quantity, not
// three separate rows.
export type SellableGroup = { displayName: string; count: number; cost: number };

export type SellSelection = { section: 'items' | 'cards'; type: string; count: number };

interface ShopPanelProps {
  shop?: ShopSummary;
  busy?: boolean;
  onBuy: (item: ShopStockItem) => void;
  sellableItems?: SellableGroup[];
  sellableCards?: SellableGroup[];
  onSell?: (selection: SellSelection) => void;
}

function StockList({ items, busy, onBuy }: { items: ShopStockItem[]; busy?: boolean; onBuy: (item: ShopStockItem) => void }) {
  if (items.length === 0) return <p className="workshop-empty-state">Sold out.</p>;
  return <ul className="shop-stock-list">{items.map((item) => (
    <li key={`${item.section}:${item.stockIndex}:${item.displayName}`} className="shop-stock-row">
      <div className="shop-stock-copy">
        <strong>{item.displayName}{item.stockCount > 1 && ` ×${item.stockCount}`}</strong>
        {item.ownedCount > 0 && <span className="shop-owned">Own {item.ownedCount}</span>}
        {item.description && <span>{item.description}</span>}
        {item.stats && <span className="workshop-item-stats">{item.stats}</span>}
      </div>
      <button type="button" className="btn workshop-inline-btn shop-buy-button"
        disabled={busy || !item.affordable}
        title={item.affordable ? `Buy ${item.displayName}` : `Need ${item.price} coins`}
        onClick={() => onBuy(item)}>{item.price} coins</button>
    </li>
  ))}</ul>;
}

/**
 * A row per owned card/item type the player could sell, with a quantity picker (default 1,
 * capped at how many they own) so selling several of the same type is one click, not one
 * click per copy. Pressing "Sell" hands the chosen quantity straight up — the confirmation
 * step (naming the item, quantity, and coins, same safety the console's yes/no step gives)
 * lives in the caller (`WorkshopPanel`), matching where `handleBuyShopItem`'s confirm lives.
 */
function SellList({
  section,
  groups,
  sellOffset,
  busy,
  onSell,
}: {
  section: 'items' | 'cards';
  groups: SellableGroup[];
  sellOffset: number;
  busy?: boolean;
  onSell?: (selection: SellSelection) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (groups.length === 0) {
    return <p className="workshop-empty-state">Nothing to sell.</p>;
  }

  return <ul className="shop-stock-list">{groups.map((group) => {
    const quantity = Math.min(Math.max(quantities[group.displayName] ?? 1, 1), group.count);
    const unitPrice = Math.round(group.cost * sellOffset);
    const total = unitPrice * quantity;

    return (
      <li key={`${section}:${group.displayName}`} className="shop-stock-row">
        <div className="shop-stock-copy">
          <strong>{group.displayName}{group.count > 1 && ` ×${group.count}`}</strong>
          <span className="workshop-item-stats">{unitPrice} {unitPrice === 1 ? 'coin' : 'coins'} each</span>
        </div>
        <span className="shop-sell-controls">
          {group.count > 1 && (
            <input
              type="number"
              className="shop-sell-qty"
              aria-label={`How many ${group.displayName} to sell`}
              min={1}
              max={group.count}
              value={quantity}
              disabled={busy}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantities((current) => ({
                  ...current,
                  [group.displayName]: Number.isFinite(next) ? next : 1,
                }));
              }}
            />
          )}
          <button
            type="button"
            className="btn workshop-inline-btn shop-buy-button"
            disabled={busy || !onSell}
            title={`Sell ${quantity > 1 ? `${quantity} ${group.displayName}` : group.displayName}`}
            onClick={() => onSell?.({ section, type: group.displayName, count: quantity })}
          >
            Sell for {total} {total === 1 ? 'coin' : 'coins'}
          </button>
        </span>
      </li>
    );
  })}</ul>;
}

/** Room-scoped merchant inventory with direct, prompt-free purchases and sales. */
export default function ShopPanel({ shop, busy, onBuy, sellableItems, sellableCards, onSell }: ShopPanelProps) {
  if (!shop) return null;
  const closing = new Date(shop.closingTime);
  const sellOffset = shop.sellOffset ?? 0;
  return <section className="workshop-shop">
    <header className="workshop-section-header shop-heading">
      <div>
        <h2>The Shop</h2>
        <p><strong>{shop.name}</strong> waits behind a {shop.adjective} door.</p>
        <p className="workshop-filter-summary">Stock rotates at <time dateTime={closing.toISOString()}>{closing.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>. This room has its own merchant.</p>
      </div>
      <strong className="shop-wallet">{shop.coins} coins</strong>
    </header>
    <h3>On the shelves</h3>
    <StockList items={shop.items} busy={busy} onBuy={onBuy} />
    <h3>Cards for sale</h3>
    <StockList items={shop.cards} busy={busy} onBuy={onBuy} />
    <details className="shop-back-room">
      <summary>Back room ({shop.backRoom.length})</summary>
      <p>Rare stock costs more and may not return soon.</p>
      <StockList items={shop.backRoom} busy={busy} onBuy={onBuy} />
    </details>
    <details className="shop-sell-section" open>
      <summary>Sell to the shop</summary>
      <h3>Your items</h3>
      <SellList section="items" groups={sellableItems ?? []} sellOffset={sellOffset} busy={busy} onSell={onSell} />
      <h3>Your cards</h3>
      <SellList section="cards" groups={sellableCards ?? []} sellOffset={sellOffset} busy={busy} onSell={onSell} />
    </details>
  </section>;
}
