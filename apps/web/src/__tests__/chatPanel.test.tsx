import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@deck-monsters/server/types';

const chat = vi.hoisted(() => ({
  state: null as unknown as {
    messages: unknown[]; unread: number; lastReadId: number; loaded: boolean; markRead: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>; members: { userId: string; name: string }[];
  },
}));
vi.mock('../hooks/useChat.js', () => ({ useChat: () => chat.state }));
vi.mock('../lib/auth-context.js', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

import ChatPanel from '../components/ChatPanel.js';

function msg(id: number, o: Partial<ChatMessage> = {}): ChatMessage {
  return { id, roomId: 'r', senderUserId: 'ben', senderName: 'Ben', recipientUserId: null, recipientName: null, text: `hello ${id}`, fightNumber: null, source: 'web', createdAt: new Date().toISOString(), ...o };
}
function setChat(messages: ChatMessage[], lastReadId = 0, loaded = true) {
  chat.state = {
    messages, unread: 0, lastReadId, loaded, markRead: vi.fn(), send: vi.fn().mockResolvedValue(null),
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

  it('puts the time right after the sender, and leaves it out when the timestamp does not parse', () => {
    setChat([msg(1, { createdAt: '2026-10-06T12:05:00.000Z' }), msg(2, { createdAt: 'not a date' })]);
    const { container } = render(<ChatPanel roomId="r" />);
    const [first, second] = Array.from(container.querySelectorAll('.chat-message'));
    expect(first!.querySelector('.chat-sender')?.nextElementSibling?.className).toBe('chat-time');
    expect(first!.querySelector('.chat-time')?.getAttribute('datetime')).toBe('2026-10-06T12:05:00.000Z');
    expect(second!.querySelector('.chat-time')).toBeNull();
  });

  it('writes DMs the way the Console does, with no separate tag', () => {
    setChat([
      msg(1, { recipientUserId: 'me', recipientName: 'Ada', text: 'psst' }),
      msg(2, { senderUserId: 'me', senderName: 'Ada', recipientUserId: 'ben', recipientName: 'Ben', text: 'ok' }),
    ]);
    render(<ChatPanel roomId="r" />);
    expect(screen.getByText('✉️ Ben to you')).toBeTruthy();
    expect(screen.getByText('✉️ You to Ben')).toBeTruthy();
    expect(document.querySelector('.chat-dm-tag')).toBeNull();
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

  it('highlights the To picker when a player is chosen, with no separate To: line', async () => {
    setChat([]);
    render(<ChatPanel roomId="r" />);
    const picker = screen.getByLabelText('To');
    expect(picker).not.toHaveClass('dm-preview-name');
    fireEvent.change(picker, { target: { value: 'cal' } });
    expect(picker).toHaveClass('dm-preview-name');
    expect(screen.queryByText('To:', { exact: false })).toBeNull();
    fireEvent.change(picker, { target: { value: '' } });
    expect(picker).not.toHaveClass('dm-preview-name');
    fireEvent.change(picker, { target: { value: 'cal' } });
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

  it('clears the input when the send starts, and ignores a second Enter while in flight', async () => {
    setChat([]);
    let resolve!: (v: string | null) => void;
    chat.state.send.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<ChatPanel roomId="r" />);
    const input = screen.getByPlaceholderText('Message everyone…') as HTMLInputElement;
    const form = input.closest('form')!;
    fireEvent.change(input, { target: { value: 'one' } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(input.value).toBe('');
    expect(chat.state.send).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(null); });
  });

  it('gives the text back after a refusal unless the player has typed something newer', async () => {
    setChat([]);
    let resolve!: (v: string | null) => void;
    chat.state.send.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<ChatPanel roomId="r" />);
    const input = screen.getByPlaceholderText('Message everyone…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, { target: { value: 'second' } });
    await act(async () => { resolve('No.'); });
    expect(input.value).toBe('second');
    expect(screen.getByRole('alert').textContent).toBe('No.');
    // Edit clears the refusal.
    fireEvent.change(input, { target: { value: 'second!' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('puts the refused text back when nothing newer was typed', async () => {
    setChat([]);
    chat.state.send.mockResolvedValue('No.');
    render(<ChatPanel roomId="r" />);
    const input = screen.getByPlaceholderText('Message everyone…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByRole('alert');
    expect(input.value).toBe('first');
  });

  describe('opening', () => {
    it('waits for history before fixing the marker position', () => {
      // A live frame arrived before history: loaded is false, so no capture and no marker yet.
      setChat([msg(1), msg(2)], 0, false);
      const { rerender, container } = render(<ChatPanel roomId="r" />);
      expect(container.querySelector('.chat-divider-marker')).toBeNull();
      chat.state = { ...chat.state, lastReadId: 1, loaded: true };
      rerender(<ChatPanel roomId="r" />);
      expect(container.querySelector('.chat-divider-marker')?.nextElementSibling?.textContent).toContain('hello 2');
    });

    it('scrolls to the marker and holds mark read until the player is at the bottom', () => {
      const proto = HTMLElement.prototype;
      Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => 1000 });
      Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => 200 });
      Object.defineProperty(proto, 'offsetTop', { configurable: true, get: () => 300 });
      try {
        setChat([msg(1), msg(2), msg(3)], 1);
        const { container } = render(<ChatPanel roomId="r" />);
        const list = container.querySelector('.chat-list') as HTMLElement;
        // Marker at offsetTop 300 within a list at offsetTop 300 -> scrollTop 0 (minus slack), not the bottom.
        expect(list.scrollTop).not.toBe(1000);
        expect(chat.state.markRead).not.toHaveBeenCalled();
        // The cue says there is more below.
        expect(screen.getByRole('button', { name: /New messages/ })).toBeTruthy();
        // Reaching the bottom marks read.
        list.scrollTop = 800;
        fireEvent.scroll(list);
        expect(chat.state.markRead).toHaveBeenCalledWith(3);
      } finally {
        delete (proto as unknown as Record<string, unknown>).scrollHeight;
        delete (proto as unknown as Record<string, unknown>).clientHeight;
        delete (proto as unknown as Record<string, unknown>).offsetTop;
      }
    });
  });

  describe('jump cue', () => {
    it('appears when new messages arrive while scrolled up, and jumping hides it', () => {
      const proto = HTMLElement.prototype;
      Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => 1000 });
      Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => 200 });
      try {
        setChat([msg(1), msg(2)], 2);
        const { container, rerender } = render(<ChatPanel roomId="r" />);
        const list = container.querySelector('.chat-list') as HTMLElement;
        list.scrollTop = 100;
        fireEvent.scroll(list);
        expect(screen.queryByRole('button', { name: /New messages/ })).toBeNull();
        chat.state = { ...chat.state, messages: [msg(1), msg(2), msg(3)] };
        rerender(<ChatPanel roomId="r" />);
        const cue = screen.getByRole('button', { name: /New messages/ });
        expect(cue).toHaveAttribute('title', 'Jump to the newest messages');
        fireEvent.click(cue);
        expect(screen.queryByRole('button', { name: /New messages/ })).toBeNull();
        expect(chat.state.markRead).toHaveBeenCalledWith(3);
      } finally {
        delete (proto as unknown as Record<string, unknown>).scrollHeight;
        delete (proto as unknown as Record<string, unknown>).clientHeight;
      }
    });
  });

  it('recomputes Today and Yesterday after midnight', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 9, 1, 23, 59, 0));
      setChat([msg(1, { createdAt: new Date(2026, 9, 1, 23, 0).toISOString() })]);
      const { container } = render(<ChatPanel roomId="r" />);
      expect(container.querySelector('.chat-divider-time')?.textContent).toMatch(/^Today/);
      act(() => { vi.advanceTimersByTime(3 * 60 * 1000); });
      expect(container.querySelector('.chat-divider-time')?.textContent).toMatch(/^Yesterday/);
    } finally {
      vi.useRealTimers();
    }
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
