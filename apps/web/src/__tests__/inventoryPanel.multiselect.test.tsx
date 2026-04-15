import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InventoryPanel from '../components/InventoryPanel.js';

describe('InventoryPanel multi-select behavior', () => {
  it('always uses card taps for selection state updates', () => {
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
});
