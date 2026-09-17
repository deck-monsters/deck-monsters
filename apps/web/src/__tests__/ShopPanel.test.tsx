import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ShopPanel, { type ShopSummary } from '../components/ShopPanel.js';

const shop: ShopSummary = {
  name: 'Moon Market', adjective: 'gilded', closingTime: '2030-01-01T00:00:00.000Z', coins: 75,
  items: [{
    stockIndex: 0, section: 'items', displayName: 'Potion of Healing', description: 'Heals 8 HP.',
    stats: 'Usable 1 time.', price: 80, affordable: false, ownedCount: 2,
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
});
