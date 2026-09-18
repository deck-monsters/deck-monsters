import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ShopPanel, { type ShopSummary } from '../components/ShopPanel.js';

const shop: ShopSummary = {
  name: 'Moon Market', adjective: 'gilded', closingTime: '2030-01-01T00:00:00.000Z', coins: 75,
  items: [{
    stockIndex: 0, section: 'items', displayName: 'Potion of Healing', description: 'Heals 8 HP.',
    stats: 'Usable 1 time.', price: 80, affordable: false, ownedCount: 2,
  }],
  cards: [{
    stockIndex: 0, section: 'cards', displayName: 'Targeting Scroll', description: 'Aim a card.',
    stats: 'Usable 1 time.', price: 48, affordable: true, ownedCount: 1,
  }],
  backRoom: [{
    stockIndex: 0, section: 'backRoom', displayName: 'Sorting Hat', description: 'Choose a team.',
    stats: 'Usable 1 time.', price: 0, affordable: true, ownedCount: 0,
  }],
};

describe('ShopPanel', () => {
  it('shows room stock, ownership and affordability', () => {
    render(<ShopPanel shop={shop} onBuy={vi.fn()} />);
    expect(screen.getByText('Moon Market')).toBeInTheDocument();
    expect(screen.getByText('75 coins')).toBeInTheDocument();
    expect(screen.getByText('Own 2')).toBeInTheDocument();
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
});
