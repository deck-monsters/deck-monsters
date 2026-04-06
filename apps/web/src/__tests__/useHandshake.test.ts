import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHandshake } from '../hooks/useHandshake.js';
import type { GameEvent } from '@deck-monsters/server/types';

function makeHandshakeEvent(overrides: {
  protocolVersion?: number;
  buildVersion?: string;
}): GameEvent {
  return {
    id: 'handshake',
    roomId: 'test-room',
    timestamp: Date.now(),
    type: 'handshake',
    scope: 'private',
    targetUserId: 'user-1',
    text: '',
    payload: {
      protocolVersion: overrides.protocolVersion ?? 1,
      buildVersion: overrides.buildVersion ?? 'dev',
      serverTime: new Date().toISOString(),
      yourUserId: 'user-1',
    },
  };
}

describe('useHandshake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts in pending state', () => {
    const { result } = renderHook(() => useHandshake());
    expect(result.current.handshakeStatus.status).toBe('pending');
  });

  it('transitions to ok when protocol versions match', () => {
    const { result } = renderHook(() => useHandshake());
    act(() => {
      result.current.handleHandshakeEvent(makeHandshakeEvent({ protocolVersion: 1 }));
    });
    expect(result.current.handshakeStatus.status).toBe('ok');
  });

  it('transitions to reloading when server protocol is newer', () => {
    // jsdom does not allow spyOn(window.location, 'reload') — use defineProperty
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useHandshake());

    act(() => {
      result.current.handleHandshakeEvent(makeHandshakeEvent({ protocolVersion: 99 }));
    });
    expect(result.current.handshakeStatus.status).toBe('reloading');

    // Should call reload after 2s
    act(() => vi.advanceTimersByTime(2500));
    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it('transitions to version-mismatch when server protocol is older', () => {
    const { result } = renderHook(() => useHandshake());
    act(() => {
      result.current.handleHandshakeEvent(makeHandshakeEvent({ protocolVersion: 0 }));
    });
    expect(result.current.handshakeStatus.status).toBe('version-mismatch');
  });

  it('ignores non-handshake events', () => {
    const { result } = renderHook(() => useHandshake());
    const nonHandshake: GameEvent = {
      id: '1',
      roomId: 'r',
      timestamp: Date.now(),
      type: 'announce',
      scope: 'private',
      text: 'hello',
      payload: {},
    };
    act(() => {
      result.current.handleHandshakeEvent(nonHandshake);
    });
    expect(result.current.handshakeStatus.status).toBe('pending');
  });
});
