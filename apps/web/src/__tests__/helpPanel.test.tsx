import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HelpPanel from '../components/HelpPanel.js';
import AppShell from '../components/AppShell.js';
import { renderMarkdown } from '../lib/markdown.js';

vi.mock('../lib/auth-context.js', () => ({ useAuth: () => ({ user: null, signOut: vi.fn() }) }));
vi.mock('../lib/command-insert-context.js', () => ({ useCommandInsert: () => ({ insertCommand: vi.fn() }) }));

describe('HelpPanel', () => {
  it('shows the intro line above the sections', () => {
    render(<HelpPanel />);
    expect(
      screen.getByText('Everything the game does, written down. New here? Start with How to play.'),
    ).toBeTruthy();
  });

  it('opens on How to play and renders each guide\'s first heading', () => {
    render(<HelpPanel />);
    expect(screen.getByRole('heading', { name: 'Player Handbook' })).toBeTruthy();
    const cases: Array<[string, string]> = [
      ['Monsters', 'Monsters'],
      ['Cards', 'Cards'],
      ['Items', 'Items, Inventory, and the Shop'],
    ];
    for (const [button, heading] of cases) {
      fireEvent.click(screen.getByRole('button', { name: button }));
      expect(screen.getAllByRole('heading', { name: heading }).length).toBeGreaterThan(0);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commands' }));
    expect(screen.getByRole('heading', { name: 'Commands' })).toBeTruthy();
    expect(screen.getByText('train a monster')).toBeTruthy();
  });

  it('keeps guide tables inside a focusable scroll box, not the page', () => {
    const { container } = render(<HelpPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Items' }));
    const region = container.querySelector('.help-table-region');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region!.querySelector('table')).not.toBeNull();
  });

  it('offers "↑ Top" when scrolling back up from deep in a guide, not on the way down (bug 230)', () => {
    render(<HelpPanel />);
    const panel = document.querySelector('.help-panel') as HTMLElement;
    const scrollTo = vi.fn();
    panel.scrollTo = scrollTo as unknown as typeof panel.scrollTo;
    const scrollAt = (top: number) => {
      panel.scrollTop = top;
      fireEvent.scroll(panel);
    };
    scrollAt(3000); // reading down
    expect(screen.queryByRole('button', { name: '↑ Top' })).toBeNull();
    scrollAt(2900); // starting back up
    fireEvent.click(screen.getByRole('button', { name: '↑ Top' }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(screen.queryByRole('button', { name: '↑ Top' })).toBeNull();
    scrollAt(600);
    scrollAt(500); // near the top already: no button
    expect(screen.queryByRole('button', { name: '↑ Top' })).toBeNull();
  });

  it('switches section from a cross-guide link', () => {
    render(<HelpPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    fireEvent.click(screen.getAllByRole('link', { name: 'Items guide' })[0]!);
    expect(screen.getByRole('button', { name: 'Items' })).toHaveAttribute('aria-pressed', 'true');
  });

});

describe('AppShell menu', () => {
  it('links Help and guides to the room help route', () => {
    render(
      <MemoryRouter>
        <AppShell roomId="room-1"><div /></AppShell>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const links = screen.getAllByRole('link', { name: 'Help and guides' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/room/room-1/help');
  });

  it('has one Help item: the command list says Console commands, and the theme its name (bug 229)', () => {
    render(
      <MemoryRouter>
        <AppShell roomId="room-1"><div /></AppShell>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.queryByText(/Help \/ Commands/)).toBeNull();
    // The desktop ? and the phone menu item: both named Console commands.
    expect(screen.getAllByRole('button', { name: 'Console commands' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Theme: [A-Z]/ }).textContent).not.toContain('-');
  });

  it('lists Chat with the surface description as its title, in the room only', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppShell roomId="room-1"><div /></AppShell>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const links = screen.getAllByRole('link', { name: 'Chat' });
    expect(links.length).toBeGreaterThan(1);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/room/room-1/chat');
      expect(link).toHaveAttribute('title', 'Talk with everyone in this room, or send a message to one player.');
    }
    unmount();
    render(
      <MemoryRouter>
        <AppShell><div /></AppShell>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Chat' })).toBeNull();
  });

  it('links to /help outside a room', () => {
    render(
      <MemoryRouter>
        <AppShell><div /></AppShell>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link', { name: 'Help and guides' })[0]).toHaveAttribute('href', '/help');
  });
});

describe('renderMarkdown', () => {
  it('renders lists with indented continuation, without dropping text', () => {
    const { container } = render(<>{renderMarkdown('1. Train\n\n   `train a monster`\n\n2. Equip')}</>);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(container.querySelector('li code')?.textContent).toBe('train a monster');
  });
});
