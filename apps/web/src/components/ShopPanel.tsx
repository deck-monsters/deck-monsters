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
};

interface ShopPanelProps { shop?: ShopSummary; busy?: boolean; onBuy: (item: ShopStockItem) => void }

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

/** Room-scoped merchant inventory with direct, prompt-free purchases. */
export default function ShopPanel({ shop, busy, onBuy }: ShopPanelProps) {
  if (!shop) return null;
  const closing = new Date(shop.closingTime);
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
    <p className="shop-console-note">To sell cards or pocket items, use <code>sell to the shop</code> in the console.</p>
  </section>;
}
