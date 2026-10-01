import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const chatState = vi.hoisted(() => ({ unread: 0 }));
vi.mock('../hooks/useChat.js', () => ({ useChat: () => ({ unread: chatState.unread }) }));
// The registry imports every panel; only its labels and badge hooks matter here.
vi.mock('../components/RingPane.js', () => ({ default: () => null }));
vi.mock('../components/ConsolePane.js', () => ({ default: () => null }));
vi.mock('../components/ChatPanel.js', () => ({ default: () => null }));
vi.mock('../components/WorkshopPanel.js', () => ({ default: () => null }));
vi.mock('../components/FightLogPanel.js', () => ({ default: () => null }));
vi.mock('../components/LeaderboardPanel.js', () => ({ default: () => null }));

import PaneSelector from '../components/PaneSelector.js';

function options() {
  return screen.getAllByRole('option').map((o) => o.textContent);
}

describe('PaneSelector Chat option (side by side has no tab bar)', () => {
  it('reads plain Chat with nothing unread', () => {
    chatState.unread = 0;
    render(<PaneSelector value="ring" excludeSurfaceId="console" onChange={() => undefined} slotLabel="left pane" />);
    expect(options()).toContain('Chat');
  });

  it('reads Chat · {n} unread, capped at 99+', () => {
    chatState.unread = 4;
    const { unmount } = render(<PaneSelector value="ring" excludeSurfaceId="console" onChange={() => undefined} slotLabel="left pane" />);
    expect(options()).toContain('Chat · 4 unread');
    unmount();
    chatState.unread = 120;
    render(<PaneSelector value="ring" excludeSurfaceId="console" onChange={() => undefined} slotLabel="left pane" />);
    expect(options()).toContain('Chat · 99+ unread');
  });
});
