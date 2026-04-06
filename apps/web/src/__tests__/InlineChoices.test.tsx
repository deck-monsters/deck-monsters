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
    expect(screen.getByText(/\[0\] Hit/)).toBeTruthy();
    expect(screen.getByText(/\[1\] Heal/)).toBeTruthy();
    expect(screen.getByText(/\[2\] Blast/)).toBeTruthy();
  });

  it('sends the numeric index (not the label text) when a choice is clicked', () => {
    const onAnswer = vi.fn();
    render(<InlineChoices {...defaultProps} onAnswer={onAnswer} />);

    // Click the second choice (index 1 = "Heal")
    const healBtn = screen.getByText(/\[1\] Heal/);
    fireEvent.click(healBtn);

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
    it('shows checkboxes for questions containing "card(s)"', () => {
      render(<InlineChoices {...defaultProps} question="Which card(s) to equip?" />);
      expect(screen.getByText('Equip selected (0)')).toBeTruthy();
    });

    it('sends a comma-separated index list when multiple are selected and confirmed', () => {
      const onAnswer = vi.fn();
      render(
        <InlineChoices
          {...defaultProps}
          question="Which card(s) to equip?"
          onAnswer={onAnswer}
        />
      );

      fireEvent.click(screen.getByText(/\[0\] Hit/));
      fireEvent.click(screen.getByText(/\[2\] Blast/));
      fireEvent.click(screen.getByText(/Equip selected/));

      expect(onAnswer).toHaveBeenCalledWith('req-1', '0, 2');
    });
  });
});
