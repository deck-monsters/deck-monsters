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

    it('labels the shop item pick "Buy n items", not the equip wording', () => {
      const onAnswer = vi.fn();
      render(
        <InlineChoices
          {...defaultProps}
          question={'Choose one or more of the following items to buy:\n\n0) Hit [1] - 5 coins'}
          onAnswer={onAnswer}
        />
      );
      expect(screen.getByText('Buy items')).toBeTruthy();
      expect(screen.queryByText(/Equip/)).toBeNull();

      fireEvent.click(screen.getByText('Hit'));
      const one = screen.getByText('Buy 1 item');
      expect(one.getAttribute('title')).toBe('Buy the items you picked.');
      fireEvent.click(screen.getByText('Blast'));
      fireEvent.click(screen.getByText('Buy 2 items'));
      expect(onAnswer).toHaveBeenCalledWith('req-1', '0, 2');
    });

    it('labels the shop card pick "Buy n cards"', () => {
      const onAnswer = vi.fn();
      render(
        <InlineChoices
          {...defaultProps}
          question={'Choose one or more of the following cards to buy:\n\n0) Hit [1] - 5 coins'}
          onAnswer={onAnswer}
        />
      );
      expect(screen.getByText('Buy cards')).toBeTruthy();
      expect(screen.queryByText(/Equip/)).toBeNull();

      fireEvent.click(screen.getByText('Hit'));
      const one = screen.getByText('Buy 1 card');
      expect(one.getAttribute('title')).toBe('Buy the cards you picked.');
      fireEvent.click(screen.getByText('Blast'));
      fireEvent.click(screen.getByText('Buy 2 cards'));
      expect(onAnswer).toHaveBeenCalledWith('req-1', '0, 2');
    });

    it('labels the Back Room pick "Buy n" with no noun, since it stocks cards and items', () => {
      const onAnswer = vi.fn();
      render(
        <InlineChoices
          {...defaultProps}
          question={'Choose one or more of the following to buy:\n\n0) Hit [1] - 5 coins'}
          onAnswer={onAnswer}
        />
      );
      const idle = screen.getByText('Buy');
      expect(idle.getAttribute('title')).toBe('Buy what you picked.');
      expect(screen.queryByText(/Equip/)).toBeNull();

      fireEvent.click(screen.getByText('Hit'));
      fireEvent.click(screen.getByText('Blast'));
      fireEvent.click(screen.getByText('Buy 2'));
      expect(onAnswer).toHaveBeenCalledWith('req-1', '0, 2');
    });

    it('keeps the equip wording for the sell and equip questions', () => {
      render(
        <InlineChoices
          {...defaultProps}
          question={'Choose one or more of the following cards:\n\n0) Hit [1]'}
        />
      );
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

    it('shows Done equipping when slots remain after a partial batch', () => {
      const onAnswer = vi.fn();
      render(
        <InlineChoices
          {...defaultProps}
          question={'You have 4 of 9 slots remaining, and the following cards:\n\n0) Hit [1]\n\nWhich card(s) would you like to equip next? (or reply "done" to finish with what you have)'}
          onAnswer={onAnswer}
        />
      );

      expect(screen.getByText('Done equipping')).toBeTruthy();
      fireEvent.click(screen.getByText('Done equipping'));
      expect(onAnswer).toHaveBeenCalledWith('req-1', 'done');
    });

    it('hides Done equipping on the first prompt (all slots still open)', () => {
      render(
        <InlineChoices
          {...defaultProps}
          question={'You have 9 of 9 slots remaining, and the following cards:\n\n0) Hit [1]\n\nWhich card(s) would you like to equip next?'}
        />
      );

      expect(screen.queryByText('Done equipping')).toBeNull();
    });
  });
});

describe('InlineChoices yes/no questions', () => {
  const base = {
    requestId: 'req-yn',
    choices: [] as string[],
    selectedAnswer: null as string | null,
    timedOut: false,
    cancelled: false,
    onAnswer: vi.fn(),
    onCancel: vi.fn(),
  };
  // The real shapes: the shop confirm, the Sorting Hat and the generic confirm.
  const questions = [
    'Lottery Ticket from The Affordable Wisp for 17 coins. Buy it? (yes/no)',
    'Put on the Sorting Hat? You choose a new team for Keleth, and the hat is used up. (yes/no)',
    'Are you sure? (yes/no)',
  ];

  it.each(questions)('offers Yes and No buttons for %s', (question) => {
    const onAnswer = vi.fn();
    render(<InlineChoices {...base} question={question} onAnswer={onAnswer} />);
    expect(screen.getByTitle('Answer yes').textContent).toBe('Yes');
    expect(screen.getByTitle('Answer no').textContent).toBe('No');
    fireEvent.click(screen.getByTitle('Answer yes'));
    expect(onAnswer).toHaveBeenLastCalledWith('req-yn', 'yes');
    fireEvent.click(screen.getByTitle('Answer no'));
    expect(onAnswer).toHaveBeenLastCalledWith('req-yn', 'no');
    expect(screen.getByTitle('Cancel this question')).toBeTruthy();
  });

  it('is never a multi-pick, even when an item name says item(s), and neither button looks pre-chosen', () => {
    render(<InlineChoices {...base} question={'Spare item(s) bundle from The Wisp for 5 coins. Buy it? (yes/no)'} />);
    expect(screen.getByTitle('Answer yes')).toBeTruthy();
    expect(screen.queryByText(/^Buy /)).toBeNull();
    expect(screen.queryByText(/^Equip /)).toBeNull();
    expect(screen.getByTitle('Answer yes').getAttribute('style')).toBe(screen.getByTitle('Answer no').getAttribute('style'));
  });

  it('locks the buttons once answered and drops Cancel', () => {
    render(<InlineChoices {...base} question="Are you sure? (yes/no)" selectedAnswer="yes" />);
    expect((screen.getByTitle('Answer yes') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle('Answer no') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTitle('Cancel this question')).toBeNull();
  });

  it('does not treat a menu, or a free-text question, as yes/no', () => {
    const { rerender } = render(<InlineChoices {...base} question="Pick one (yes/no)" choices={['a', 'b']} />);
    expect(screen.queryByTitle('Answer yes')).toBeNull();
    rerender(<InlineChoices {...base} question="What is its name?" />);
    expect(screen.queryByTitle('Answer yes')).toBeNull();
    expect(screen.getByTitle('Cancel this question')).toBeTruthy();
  });
});

describe('InlineChoices shop pick questions', () => {
  it.each([
    'Choose one or more of the following cards to buy:\n\n0) Basic Shield [1] - 87 coins\n1) Ecdysis [1] - 87 coins',
    'Choose one or more of the following to buy:\n\n0) Basic Shield [1] - 87 coins [own 1]\n1) Ecdysis [1] - 87 coins',
  ])('prints the question paragraph once', (question) => {
    render(
      <InlineChoices
        requestId="r"
        question={question}
        choices={['Basic Shield', 'Ecdysis']}
        selectedAnswer={null}
        timedOut={false}
        cancelled={false}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/Choose one or more of the following/)).toHaveLength(1);
  });
});
