import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ShopPanel, { type SellableGroup, type ShopSummary } from '../components/ShopPanel.js';

const shop: ShopSummary = {
  name: 'Moon Market', adjective: 'gilded', closingTime: '2030-01-01T00:00:00.000Z', coins: 75,
  items: [{
    stockIndex: 0, stockCount: 2, section: 'items', displayName: 'Potion of Healing', description: 'Heals 8 HP.',
    stats: 'Usable 1 time.', price: 80, affordable: false, ownedCount: 2,
  }],
  cards: [{
    stockIndex: 0, stockCount: 1, section: 'cards', displayName: 'Targeting Scroll', description: 'Aim a card.',
    stats: 'Usable 1 time.', price: 48, affordable: true, ownedCount: 1,
  }],
  backRoom: [{
    stockIndex: 0, stockCount: 1, section: 'backRoom', displayName: 'Sorting Hat', description: 'Choose a team.',
    stats: 'Usable 1 time.', price: 0, affordable: true, ownedCount: 0,
  }],
  sellOffset: 0.8,
};

const sellableItems: SellableGroup[] = [{ displayName: 'Bandage', count: 2, cost: 10 }];
const sellableCards: SellableGroup[] = [{ displayName: 'Whiskey Shot', count: 1, cost: 30 }];

describe('ShopPanel', () => {
  it('shows room stock, ownership and affordability', () => {
    render(<ShopPanel shop={shop} onBuy={vi.fn()} />);
    expect(screen.getByText('Moon Market')).toBeInTheDocument();
    expect(screen.getByText('75 coins')).toBeInTheDocument();
    expect(screen.getByText('Own 2')).toBeInTheDocument();
	expect(screen.getByText('Potion of Healing ×2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '80 coins' })).toBeDisabled();
  });

  it('exposes rare stock and passes the exact stock token when buying', () => {
    const onBuy = vi.fn();
    render(<ShopPanel shop={shop} onBuy={onBuy} />);
    fireEvent.click(screen.getByText(/Back room/));
    fireEvent.click(screen.getByRole('button', { name: '0 coins' }));
    expect(onBuy).toHaveBeenCalledWith(shop.backRoom[0]);
  });

  // Regression: cards on sale (the console's "Cards" menu) never surfaced in the Workshop
  // shop at all, so a player using the web app saw a different — smaller — set of goods
  // than a player using the console. See docs/roadmap/10b-bugs-fixed.md.
  it('shows cards for sale at parity with items, and buys the exact stock token', () => {
    const onBuy = vi.fn();
    render(<ShopPanel shop={shop} onBuy={onBuy} />);
    expect(screen.getByText('Cards for sale')).toBeInTheDocument();
    expect(screen.getByText('Targeting Scroll')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '48 coins' }));
    expect(onBuy).toHaveBeenCalledWith(shop.cards[0]);
  });

  it('shows "Sold out." for cards when none are in stock', () => {
    render(<ShopPanel shop={{ ...shop, cards: [] }} onBuy={vi.fn()} />);
    expect(screen.getByText('Cards for sale')).toBeInTheDocument();
    expect(screen.getAllByText('Sold out.')).toHaveLength(1);
  });

  describe('selling', () => {
    it('shows a per-unit sell price for an owned item and card', () => {
      render(
        <ShopPanel shop={shop} onBuy={vi.fn()} sellableItems={sellableItems} sellableCards={sellableCards} onSell={vi.fn()} />,
      );
      // round(10 * 0.8) = 8 coins each, 2 owned — default quantity 1.
      expect(screen.getByText('8 coins each')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sell for 8 coins' })).toBeInTheDocument();
      // round(30 * 0.8) = 24 coins each.
      expect(screen.getByText('24 coins each')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sell for 24 coins' })).toBeInTheDocument();
    });

    // The confirmation step itself lives in the caller (WorkshopPanel — see
    // workshopPanel.sellShopItems.test.tsx), matching where the buy flow's confirm lives;
    // ShopPanel only reports the chosen quantity when its Sell button is pressed.
    it('reports the chosen quantity for a multi-copy item', () => {
      const onSell = vi.fn();
      render(
        <ShopPanel shop={shop} onBuy={vi.fn()} sellableItems={sellableItems} sellableCards={sellableCards} onSell={onSell} />,
      );

      fireEvent.change(screen.getByLabelText('How many Bandage to sell'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sell for 16 coins' }));

      expect(onSell).toHaveBeenCalledWith({ section: 'items', type: 'Bandage', count: 2 });
    });

    it('does not offer a quantity picker for a single owned copy', () => {
      render(
        <ShopPanel shop={shop} onBuy={vi.fn()} sellableItems={sellableItems} sellableCards={sellableCards} onSell={vi.fn()} />,
      );
      expect(screen.queryByLabelText('How many Whiskey Shot to sell')).not.toBeInTheDocument();
    });

    it('shows "Nothing to sell." when the character owns none of that kind', () => {
      render(<ShopPanel shop={shop} onBuy={vi.fn()} sellableCards={[]} onSell={vi.fn()} />);
      expect(screen.getAllByText('Nothing to sell.')).toHaveLength(2);
    });
  });
});
