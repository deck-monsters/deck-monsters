import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MonsterWorkshopPanel from '../components/MonsterWorkshopPanel.js';

const baseMonster = {
  name: 'Stonefang',
  type: 'Basilisk',
  level: 3,
  inRing: true,
  inEncounter: false,
  cardSlots: 1,
  cards: [] as string[],
  presets: {},
};

describe('MonsterWorkshopPanel drag/drop lock behavior', () => {
  it('allows dropping into monster slots while in ring but not in encounter', async () => {
    const onDropCard = vi.fn(async () => undefined);
    render(
      <MonsterWorkshopPanel
        monster={{
          ...baseMonster,
          cards: [],
        }}
        showSelectionHint={false}
        selectedCard={null}
        onDropCard={onDropCard}
        onTapSlot={() => undefined}
        onSelectCard={() => undefined}
        onSavePreset={() => undefined}
        onLoadPreset={() => undefined}
        onDeletePreset={() => undefined}
      />,
    );

    const targetSlot = screen.getByRole('button', { name: 'Empty slot' });
    expect(targetSlot).not.toHaveAttribute('disabled');

    const dataTransfer = {
      store: {} as Record<string, string>,
      setData(type: string, value: string) {
        this.store[type] = value;
      },
      getData(type: string) {
        return this.store[type] ?? '';
      },
      effectAllowed: 'none',
    };
    dataTransfer.setData(
      'application/x-deck-monsters-card',
      JSON.stringify({ location: { kind: 'inventory' }, cardName: 'Hit' }),
    );

    fireEvent.dragOver(targetSlot, { dataTransfer });
    fireEvent.drop(targetSlot, { dataTransfer });

    expect(onDropCard).toHaveBeenCalledTimes(1);
    expect(onDropCard).toHaveBeenCalledWith({ kind: 'inventory' }, 'Hit');
  });

  it('keeps monster slots locked during an encounter', () => {
    const onDropCard = vi.fn(async () => undefined);
    render(
      <MonsterWorkshopPanel
        monster={{
          ...baseMonster,
          inRing: true,
          inEncounter: true,
          cards: [],
        }}
        showSelectionHint={false}
        selectedCard={null}
        onDropCard={onDropCard}
        onTapSlot={() => undefined}
        onSelectCard={() => undefined}
        onSavePreset={() => undefined}
        onLoadPreset={() => undefined}
        onDeletePreset={() => undefined}
      />,
    );

    const targetSlot = screen.getByRole('button', { name: 'Empty slot' });
    expect(targetSlot).toHaveAttribute('disabled');
  });

  it('treats occupied slot taps as destination taps when a card is selected', () => {
    const onTapSlot = vi.fn();
    const onSelectCard = vi.fn();
    render(
      <MonsterWorkshopPanel
        monster={{
          ...baseMonster,
          cards: ['Hit'],
        }}
        showSelectionHint
        selectedCard={{ location: { kind: 'inventory' }, cardName: 'Heal', selectionId: 'inventory:0' }}
        onDropCard={() => undefined}
        onTapSlot={onTapSlot}
        onSelectCard={onSelectCard}
        onSavePreset={() => undefined}
        onLoadPreset={() => undefined}
        onDeletePreset={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hit' }));
    expect(onTapSlot).toHaveBeenCalledWith({ kind: 'monster', monsterName: 'Stonefang' });
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  it('only highlights the selected slot when duplicate card names exist', () => {
    render(
      <MonsterWorkshopPanel
        monster={{
          ...baseMonster,
          cardSlots: 2,
          cards: ['Hit', 'Hit'],
        }}
        showSelectionHint={false}
        selectedCard={{
          location: { kind: 'monster', monsterName: 'Stonefang' },
          cardName: 'Hit',
          selectionId: 'Stonefang:0',
        }}
        onDropCard={() => undefined}
        onTapSlot={() => undefined}
        onSelectCard={() => undefined}
        onSavePreset={() => undefined}
        onLoadPreset={() => undefined}
        onDeletePreset={() => undefined}
      />,
    );

    const selectedButtons = document.querySelectorAll('.workshop-card-slot.selected');
    expect(selectedButtons).toHaveLength(1);
  });
});
