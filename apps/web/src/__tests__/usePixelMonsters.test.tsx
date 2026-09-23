import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePixelMonsters } from '../hooks/usePixelMonsters.js';

const KEY = 'deck-monsters-pixel-fight-stage';

describe('usePixelMonsters', () => {
  beforeEach(() => localStorage.clear());

  it('is on until the player opts out', () => {
    const { result } = renderHook(() => usePixelMonsters());

    expect(result.current.pixelMonstersEnabled).toBe(true);
  });

  it('keeps a player who opted in under the old default on', () => {
    // '1' was the opt-in value when the sprites were off by default. Those players made a
    // choice; the new default must not undo it.
    localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => usePixelMonsters());

    expect(result.current.pixelMonstersEnabled).toBe(true);
  });

  it('stores an opt-out explicitly and clears it again on opt-in', () => {
    const { result } = renderHook(() => usePixelMonsters());

    act(() => result.current.setPixelMonstersEnabled(false));
    expect(result.current.pixelMonstersEnabled).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('0');

    act(() => result.current.setPixelMonstersEnabled(true));
    expect(result.current.pixelMonstersEnabled).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('reaches every caller, not just the one that flipped it', () => {
    // The toggle is in the account view and the sprites are in the Ring pane; the workspace
    // layout can show both at once, so a per-caller useState would leave the pane stale.
    const toggle = renderHook(() => usePixelMonsters());
    const consumer = renderHook(() => usePixelMonsters());

    act(() => toggle.result.current.setPixelMonstersEnabled(false));

    expect(consumer.result.current.pixelMonstersEnabled).toBe(false);
  });

  it('follows the setting when another tab changes it', () => {
    const { result } = renderHook(() => usePixelMonsters());

    act(() => {
      localStorage.setItem(KEY, '0');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: '0' }));
    });

    expect(result.current.pixelMonstersEnabled).toBe(false);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => usePixelMonsters());

    act(() => {
      localStorage.setItem(KEY, '0');
      window.dispatchEvent(new StorageEvent('storage', { key: 'deck-monsters-theme', newValue: 'amber' }));
    });

    // The stored value changed but no event for *this* key arrived, so nothing re-rendered.
    expect(result.current.pixelMonstersEnabled).toBe(true);
  });
});
