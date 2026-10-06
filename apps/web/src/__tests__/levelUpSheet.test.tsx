import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LevelUpSheet from '../components/LevelUpSheet.js';

// The sheet's top line ("Level up") and its heading: the line is decoration for assistive tech
// (aria-hidden), the h2 names the dialog.
describe('LevelUpSheet', () => {
  it('draws the Level up line in every theme, and the dialog is named by its heading', () => {
    render(
      <LevelUpSheet
        monsterName="Poirot"
        xpIntoLevel={1}
        xpNeededForLevel={37}
        nextLevel={{ level: 2, hp: 3, ac: 1, str: 1, dex: 1, int: 1 }}
        nextCards={{ level: 2, cards: ['Blast II'] }}
        onClose={vi.fn()}
      />,
    );
    const pill = document.querySelector('.card-detail-pill');
    expect(pill?.textContent).toBe('Level up');
    expect(pill?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Poirot at level 2' })).toBeTruthy();
    expect(document.querySelector('.level-up-chip')?.textContent).toBe('Blast II');
  });
});
