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
        onDropCard={() => Promise.resolve()}
        onTapSlot={onTapSlot}
        onSelectCard={onSelectCard}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    expect(onSelectCard).toHaveBeenCalledWith({ kind: 'inventory' }, 'Heal', 'inventory:1', 1);
    expect(onTapSlot).not.toHaveBeenCalled();
  });

  it('blocks card selection and the unequip drop zone while disabled', () => {
    const onSelectCard = vi.fn();
    const onTapSlot = vi.fn();
    const onDropCard = vi.fn();

    render(
      <InventoryPanel
        cards={['Hit']}
        selectedCards={[]}
        onDropCard={onDropCard}
        onTapSlot={onTapSlot}
        onSelectCard={onSelectCard}
        disabled
      />,
    );

    expect(screen.getByRole('button', { name: 'Hit' })).toBeDisabled();
    const dropZone = screen.getByRole('button', { name: 'Drop here to unequip from monster' });
    expect(dropZone).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(dropZone);
    expect(onTapSlot).not.toHaveBeenCalled();
    expect(onDropCard).not.toHaveBeenCalled();
  });
});
