import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommandReference from '../components/CommandReference.js';

describe('CommandReference', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onInsertCommand: vi.fn(),
  };

  it('is hidden when open is false', () => {
    const { container } = render(<CommandReference {...defaultProps} open={false} />);
    // Panel should be off-screen (translateX(100%)), not removed from DOM
    const panel = container.querySelector('[role="dialog"]');
    expect(panel).toBeTruthy();
    expect((panel as HTMLElement).style.transform).toBe('translateX(100%)');
  });

  it('renders command entries when open', () => {
    render(<CommandReference {...defaultProps} />);
    // The canonical training command should appear.
    expect(screen.getByText('train a monster')).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<CommandReference {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close Console commands'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onInsertCommand when a command entry is clicked', () => {
    const onInsertCommand = vi.fn();
    render(<CommandReference {...defaultProps} onInsertCommand={onInsertCommand} />);
    // Click the canonical training command.
    fireEvent.click(screen.getByText('train a monster'));
    expect(onInsertCommand).toHaveBeenCalledWith('train a monster');
  });

  it('has no guide shortcuts: the guides are in Help and guides (bug 230)', () => {
    render(<CommandReference {...defaultProps} />);
    expect(screen.queryByText('Handbook')).toBeNull();
    expect(screen.queryByText('Monster Manual')).toBeNull();
    expect(screen.queryByText('Card List')).toBeNull();
  });

  it('states that items can still be used mid-fight, and the catch', () => {
    render(<CommandReference {...defaultProps} />);
    // Both halves matter. The headline alone ("you can use items mid-fight") is what an
    // earlier draft said, and it sends a player to try a pocket potion that
    // items/helpers/use.ts will refuse — worse than saying nothing at all.
    expect(screen.getByText(/can still use items once a fight starts/)).toBeTruthy();
    expect(screen.getByText(/only ones it is\s+already carrying/)).toBeTruthy();
  });

  it('mentions targeting scrolls and where the current strategy shows up', () => {
    render(<CommandReference {...defaultProps} />);
    expect(screen.getByText(/Targeting scrolls change who a monster attacks/)).toBeTruthy();
  });

  it('lists the use-item-on-monster command', () => {
    render(<CommandReference {...defaultProps} />);
    expect(screen.getByText('use [item] on [monster]')).toBeTruthy();
  });
});
