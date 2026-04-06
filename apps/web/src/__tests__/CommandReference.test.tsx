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
    // At least "spawn monster" should appear
    expect(screen.getByText('spawn monster')).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<CommandReference {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close command reference'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onInsertCommand when a command entry is clicked', () => {
    const onInsertCommand = vi.fn();
    render(<CommandReference {...defaultProps} onInsertCommand={onInsertCommand} />);
    // Click spawn monster
    fireEvent.click(screen.getByText('spawn monster'));
    expect(onInsertCommand).toHaveBeenCalledWith('spawn monster');
  });

  it('calls onInsertCommand with correct value for quick links', () => {
    const onInsertCommand = vi.fn();
    render(<CommandReference {...defaultProps} onInsertCommand={onInsertCommand} />);
    fireEvent.click(screen.getByText('Handbook'));
    expect(onInsertCommand).toHaveBeenCalledWith('look at player handbook');
  });
});
