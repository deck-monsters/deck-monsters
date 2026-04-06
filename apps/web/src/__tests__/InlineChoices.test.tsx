import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InlineChoices from '../components/InlineChoices.js';

const defaultProps = {
  requestId: 'req-1',
  question: 'What is your monster type?',
  choices: ['Basilisk', 'Gladiator', 'Jinn'],
  selectedAnswer: null,
  timedOut: false,
  cancelled: false,
  onAnswer: vi.fn(),
};

describe('InlineChoices', () => {
  it('renders the question', () => {
    render(<InlineChoices {...defaultProps} />);
    expect(screen.getByText('What is your monster type?')).toBeTruthy();
  });

  it('renders all choices as buttons', () => {
    render(<InlineChoices {...defaultProps} />);
    expect(screen.getByText('[0] Basilisk')).toBeTruthy();
    expect(screen.getByText('[1] Gladiator')).toBeTruthy();
    expect(screen.getByText('[2] Jinn')).toBeTruthy();
  });

  it('calls onAnswer with the correct requestId and choice when clicked', () => {
    const onAnswer = vi.fn();
    render(<InlineChoices {...defaultProps} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('[1] Gladiator'));
    expect(onAnswer).toHaveBeenCalledWith('req-1', 'Gladiator');
  });

  it('disables buttons when a selection has been made', () => {
    render(<InlineChoices {...defaultProps} selectedAnswer="Basilisk" />);
    const buttons = screen.getAllByRole('option');
    for (const btn of buttons) {
      const button = btn.querySelector('button');
      expect(button?.disabled).toBe(true);
    }
  });

  it('shows a timeout tombstone when timedOut is true', () => {
    render(<InlineChoices {...defaultProps} timedOut={true} />);
    expect(screen.getByText(/timed out/i)).toBeTruthy();
    expect(screen.queryByText('What is your monster type?')).toBeNull();
  });

  it('shows a cancel tombstone when cancelled is true', () => {
    render(<InlineChoices {...defaultProps} cancelled={true} />);
    expect(screen.getByText(/cancelled/i)).toBeTruthy();
    expect(screen.queryByText('What is your monster type?')).toBeNull();
  });
});
