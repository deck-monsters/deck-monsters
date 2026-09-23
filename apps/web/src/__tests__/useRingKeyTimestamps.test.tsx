import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRingKeyTimestamps } from '../hooks/useRingKeyTimestamps.js';

const KEY = 'deck-monsters-ring-key-timestamps';

describe('useRingKeyTimestamps', () => {
  beforeEach(() => localStorage.clear());

  it('is off until the player turns it on', () => {
    const { result } = renderHook(() => useRingKeyTimestamps());

    expect(result.current.ringKeyTimestampsEnabled).toBe(false);
  });

  it('keeps its stored format: "1" for on, no key for off', () => {
    // Unchanged by the move onto createStoredFlag, so existing players keep their setting.
    const { result } = renderHook(() => useRingKeyTimestamps());

    act(() => result.current.setRingKeyTimestampsEnabled(true));
    expect(localStorage.getItem(KEY)).toBe('1');

    act(() => result.current.setRingKeyTimestampsEnabled(false));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('reaches every caller, not just the one that flipped it', () => {
    // The bug this fixes: a per-caller useState left the Ring pane on the old value while
    // the Account toggle beside it (the workspace layout shows both) had changed.
    const toggle = renderHook(() => useRingKeyTimestamps());
    const pane = renderHook(() => useRingKeyTimestamps());

    act(() => toggle.result.current.setRingKeyTimestampsEnabled(true));

    expect(pane.result.current.ringKeyTimestampsEnabled).toBe(true);
  });
});
