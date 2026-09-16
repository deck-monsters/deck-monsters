import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InventoryPanel from '../components/InventoryPanel.js';

const noop = () => undefined;

function renderPanel(overrides: Record<string, unknown> = {}) {
  const props = {
    cards: ['Hit', 'Heal'],
    selectedCards: [],
    onDropCard: noop,
    onTapSlot: noop,
    onSelectCard: noop,
    ...overrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<InventoryPanel {...(props as any)} />);
}

const selection = [{ location: { kind: 'inventory' }, cardName: 'Hit', selectionId: 'inventory:0' }];

describe('InventoryPanel: explicit equip button', () => {
  // Drag-and-drop and tap-a-slot both worked, but neither announces itself. On a phone the
  // only discoverable way to equip was to already know the gesture.
  it('offers the button once a monster is highlighted and cards are selected', () => {
    renderPanel({
      selectedCards: selection,
      activeMonsterFilterName: 'Stonefang',
      onEquipSelected: noop,
    });

    expect(screen.getByRole('button', { name: 'Equip 1 to Stonefang' })).toBeTruthy();
  });

  it('stays hidden with no monster highlighted', () => {
    renderPanel({ selectedCards: selection, onEquipSelected: noop });
    expect(screen.queryByRole('button', { name: /^Equip/ })).toBeNull();
  });

  it('stays hidden with nothing selected', () => {
    renderPanel({ activeMonsterFilterName: 'Stonefang', onEquipSelected: noop });
    expect(screen.queryByRole('button', { name: /^Equip/ })).toBeNull();
  });

  it('counts the selection, so the button says what it will do', () => {
    renderPanel({
      selectedCards: [
        ...selection,
        { location: { kind: 'inventory' }, cardName: 'Heal', selectionId: 'inventory:1' },
      ],
      activeMonsterFilterName: 'Stonefang',
      onEquipSelected: noop,
    });
    expect(screen.getByRole('button', { name: 'Equip 2 to Stonefang' })).toBeTruthy();
  });

  it('equips on click', () => {
    const onEquipSelected = vi.fn();
    renderPanel({
      selectedCards: selection,
      activeMonsterFilterName: 'Stonefang',
      onEquipSelected,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Equip 1 to Stonefang' }));
    expect(onEquipSelected).toHaveBeenCalledTimes(1);
  });
});
