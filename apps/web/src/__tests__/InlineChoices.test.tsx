import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InlineChoices from '../components/InlineChoices.js';

describe('InlineChoices', () => {
  const defaultProps = {
    requestId: 'req-1',
    question: 'Which card?',
    choices: ['Hit', 'Heal', 'Blast'],
    selectedAnswer: null,
    timedOut: false,
    cancelled: false,
    onAnswer: vi.fn(),
  };

  it('renders all choices as buttons', () => {
    render(<InlineChoices {...defaultProps} />);
    expect(screen.getByText('Hit')).toBeTruthy();
    expect(screen.getByText('Heal')).toBeTruthy();
    expect(screen.getByText('Blast')).toBeTruthy();
  });

  it('sends the numeric index (not the label text) when a choice is clicked', () => {
    const onAnswer = vi.fn();
    render(<InlineChoices {...defaultProps} onAnswer={onAnswer} />);

    // Click the second choice (index 1 = "Heal")
    fireEvent.click(screen.getByText('Heal'));

    expect(onAnswer).toHaveBeenCalledWith('req-1', '1');
    expect(onAnswer).not.toHaveBeenCalledWith('req-1', 'Heal');
  });

  it('disables buttons when an answer has been given', () => {
    render(<InlineChoices {...defaultProps} selectedAnswer="0" />);
    const buttons = screen.getAllByRole('option').map(li => li.querySelector('button'));
    for (const btn of buttons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('shows a timeout message when timedOut is true', () => {
    render(<InlineChoices {...defaultProps} timedOut={true} />);
    expect(screen.getByText(/timed out/i)).toBeTruthy();
  });

  it('shows a cancelled message when cancelled is true', () => {
    render(<InlineChoices {...defaultProps} cancelled={true} />);
    expect(screen.getByText(/cancelled/i)).toBeTruthy();
  });

  describe('multi-select mode', () => {
    it('shows equip button for questions containing "card(s)"', () => {
      render(<InlineChoices {...defaultProps} question="Which card(s) to equip?" />);
      expect(screen.getByText('Equip cards')).toBeTruthy();
    });

    it('sends indices in selection order (not sorted) when confirmed', () => {
      const onAnswer = vi.fn();
      render(
        <InlineChoices
          {...defaultProps}
          question="Which card(s) to equip?"
          onAnswer={onAnswer}
        />
      );

      // Select Blast first (idx 2), then Hit (idx 0) — order should be preserved
      fireEvent.click(screen.getByText('Blast'));
      fireEvent.click(screen.getByText('Hit'));
      fireEvent.click(screen.getByText(/Equip 2 cards/));

      // Answer should be in selection order: Blast first (2), Hit second (0)
      expect(onAnswer).toHaveBeenCalledWith('req-1', '2, 0');
    });

    it('deselecting a card renumbers remaining slots', () => {
      const onAnswer = vi.fn();
      render(
        <InlineChoices
          {...defaultProps}
          question="Which card(s) to equip?"
          onAnswer={onAnswer}
        />
      );

      // Select all three, then deselect the middle one (Heal, idx 1)
      fireEvent.click(screen.getByText('Hit'));
      fireEvent.click(screen.getByText('Heal'));
      fireEvent.click(screen.getByText('Blast'));
      fireEvent.click(screen.getByText('Heal')); // deselect

      fireEvent.click(screen.getByText(/Equip 2 cards/));

      // Should send Hit (0) then Blast (2) in that order
      expect(onAnswer).toHaveBeenCalledWith('req-1', '0, 2');
    });

    it('shows a live order summary as cards are selected', () => {
      render(
        <InlineChoices
          {...defaultProps}
          question="Which card(s) to equip?"
        />
      );

      fireEvent.click(screen.getByText('Blast'));
      fireEvent.click(screen.getByText('Hit'));

      // Order summary should show Blast → Hit
      expect(screen.getByText(/Blast.*→.*Hit/)).toBeTruthy();
    });
  });
});
