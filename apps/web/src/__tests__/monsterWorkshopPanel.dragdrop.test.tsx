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
  cards: [null] as Array<string | null>,
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
        selectedMonsterName={null}
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
        selectedMonsterName={null}
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
});
