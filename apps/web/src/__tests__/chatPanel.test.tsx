import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@deck-monsters/server/types';

const chat = vi.hoisted(() => ({
  state: null as unknown as {
    messages: unknown[]; unread: number; lastReadId: number; markRead: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>; members: { userId: string; name: string }[];
  },
}));
vi.mock('../hooks/useChat.js', () => ({ useChat: () => chat.state }));
vi.mock('../lib/auth-context.js', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

import ChatPanel from '../components/ChatPanel.js';

function msg(id: number, o: Partial<ChatMessage> = {}): ChatMessage {
  return { id, roomId: 'r', senderUserId: 'ben', senderName: 'Ben', recipientUserId: null, recipientName: null, text: `hello ${id}`, fightNumber: null, source: 'web', createdAt: new Date().toISOString(), ...o };
}
function setChat(messages: ChatMessage[], lastReadId = 0) {
  chat.state = {
    messages, unread: 0, lastReadId, markRead: vi.fn(), send: vi.fn().mockResolvedValue(null),
    members: [{ userId: 'ben', name: 'Ben' }, { userId: 'cal', name: 'Cal' }],
  };
}
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

describe('ChatPanel', () => {
  beforeEach(() => setVisibility('visible'));

  it('shows the heading, subtitle and empty state', () => {
    setChat([]);
    render(<ChatPanel roomId="r" />);
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeTruthy();
    expect(screen.getByText('Talk with everyone in this room, or send a message to one player.')).toBeTruthy();
    expect(screen.getByText('No messages yet. Say hello, or cheer on a fight.')).toBeTruthy();
  });

  it('tags DMs to you and from you', () => {
    setChat([
      msg(1, { recipientUserId: 'me', recipientName: 'Ada', text: 'psst' }),
      msg(2, { senderUserId: 'me', senderName: 'Ada', recipientUserId: 'ben', recipientName: 'Ben', text: 'ok' }),
    ]);
    render(<ChatPanel roomId="r" />);
    expect(screen.getByText('to you')).toBeTruthy();
    expect(screen.getByText('you to Ben')).toBeTruthy();
  });

  it('draws the new-since marker at the read position captured on open, not the live one', () => {
    setChat([msg(1), msg(2), msg(3)], 1);
    const { rerender, container } = render(<ChatPanel roomId="r" />);
    const marker = () => container.querySelector('.chat-divider-marker');
    expect(marker()?.nextElementSibling?.textContent).toContain('hello 2');
    // The player reads on: the live position moves, the marker must not.
    chat.state = { ...chat.state, lastReadId: 3 };
    rerender(<ChatPanel roomId="r" />);
    expect(marker()?.nextElementSibling?.textContent).toContain('hello 2');
  });

  it('sends to everyone, clears the text on success', async () => {
    setChat([]);
    render(<ChatPanel roomId="r" />);
    const input = screen.getByPlaceholderText('Message everyone…');
    fireEvent.change(input, { target: { value: 'hi all' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(chat.state.send).toHaveBeenCalledWith('hi all', undefined));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('sends a DM to the picked player and shows who it goes to', async () => {
    setChat([]);
    render(<ChatPanel roomId="r" />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'cal' } });
    const preview = document.querySelector('.dm-preview-name');
    expect(preview?.textContent).toBe('Cal');
    const input = screen.getByPlaceholderText('Message Cal…');
    fireEvent.change(input, { target: { value: 'gl' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(chat.state.send).toHaveBeenCalledWith('gl', 'cal'));
  });

  it('lists Everyone first then the members', () => {
    setChat([]);
    render(<ChatPanel roomId="r" />);
    expect(Array.from((screen.getByLabelText('To') as HTMLSelectElement).options).map((o) => o.text)).toEqual(['Everyone', 'Ben', 'Cal']);
  });

  it('shows a refusal in an alert and keeps the typed text', async () => {
    setChat([]);
    chat.state.send.mockResolvedValue('Easy there. Wait a few seconds before the next message.');
    render(<ChatPanel roomId="r" />);
    const input = screen.getByPlaceholderText('Message everyone…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'again' } });
    fireEvent.submit(input.closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('Easy there');
    expect(input.value).toBe('again');
  });

  describe('mark read', () => {
    it('marks the newest message read when visible and at the bottom', async () => {
      setChat([msg(1), msg(5)]);
      render(<ChatPanel roomId="r" />);
      await waitFor(() => expect(chat.state.markRead).toHaveBeenCalledWith(5));
    });

    it('does not when the panel is not the active surface', () => {
      setChat([msg(1), msg(5)]);
      render(<ChatPanel roomId="r" isActive={false} />);
      expect(chat.state.markRead).not.toHaveBeenCalled();
    });

    it('does not while the document is hidden, and does once it is visible', async () => {
      setVisibility('hidden');
      setChat([msg(1)]);
      render(<ChatPanel roomId="r" />);
      expect(chat.state.markRead).not.toHaveBeenCalled();
      setVisibility('visible');
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await waitFor(() => expect(chat.state.markRead).toHaveBeenCalledWith(1));
    });

    it('does not while scrolled up', () => {
      setChat([msg(1), msg(2)]);
      // Scrolled up before the first effect: not at the bottom.
      const proto = HTMLElement.prototype;
      const sh = Object.getOwnPropertyDescriptor(proto, 'scrollHeight');
      const ch = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
      Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => 1000 });
      Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => 200 });
      try {
        const { container } = render(<ChatPanel roomId="r" />);
        chat.state.markRead.mockClear();
        const list = container.querySelector('.chat-list')!;
        list.scrollTop = 100;
        fireEvent.scroll(list);
        chat.state = { ...chat.state, messages: [msg(1), msg(2), msg(3)] };
        // New message arrives while scrolled up.
        render(<ChatPanel roomId="r" />, { container });
        expect(chat.state.markRead).not.toHaveBeenCalledWith(3);
      } finally {
        if (sh) Object.defineProperty(proto, 'scrollHeight', sh); else delete (proto as unknown as Record<string, unknown>).scrollHeight;
        if (ch) Object.defineProperty(proto, 'clientHeight', ch); else delete (proto as unknown as Record<string, unknown>).clientHeight;
      }
    });
  });
});
