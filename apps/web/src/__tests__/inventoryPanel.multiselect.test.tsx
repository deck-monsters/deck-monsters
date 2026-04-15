import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InventoryPanel from '../components/InventoryPanel.js';

describe('InventoryPanel multi-select behavior', () => {
  it('keeps selecting inventory cards when selection source is inventory', () => {
    const onSelectCard = vi.fn();
    const onTapSlot = vi.fn();

    render(
      <InventoryPanel
        cards={['Hit', 'Heal']}
        selectedCards={[{ location: { kind: 'inventory' }, cardName: 'Hit', selectionId: 'inventory:0' }]}
        onDropCard={() => undefined}
        onTapSlot={onTapSlot}
        onSelectCard={onSelectCard}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    expect(onSelectCard).toHaveBeenCalledWith({ kind: 'inventory' }, 'Heal', 'inventory:1');
    expect(onTapSlot).not.toHaveBeenCalled();
  });

  it('treats inventory as destination when selection source is monster', () => {
    const onSelectCard = vi.fn();
    const onTapSlot = vi.fn();

    render(
      <InventoryPanel
        cards={['Hit']}
        selectedCards={[
          {
            location: { kind: 'monster', monsterName: 'Stonefang' },
            cardName: 'Hit',
            selectionId: 'Stonefang:0',
          },
        ]}
        onDropCard={() => undefined}
        onTapSlot={onTapSlot}
        onSelectCard={onSelectCard}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hit' }));
    expect(onTapSlot).toHaveBeenCalledTimes(1);
    expect(onSelectCard).not.toHaveBeenCalled();
  });
});
