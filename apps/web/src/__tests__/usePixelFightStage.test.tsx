import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePixelFightStage } from '../hooks/usePixelFightStage.js';

const KEY = 'deck-monsters-pixel-fight-stage';

describe('usePixelFightStage', () => {
  beforeEach(() => localStorage.clear());

  it('is off until the player opts in', () => {
    const { result } = renderHook(() => usePixelFightStage());

    expect(result.current.pixelFightStageEnabled).toBe(false);
  });

  it('persists an opt-in and clears the key again on opt-out', () => {
    const { result } = renderHook(() => usePixelFightStage());

    act(() => result.current.setPixelFightStageEnabled(true));
    expect(result.current.pixelFightStageEnabled).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');

    act(() => result.current.setPixelFightStageEnabled(false));
    expect(result.current.pixelFightStageEnabled).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('reaches every caller, not just the one that flipped it', () => {
    // The toggle is in the account view and the stage is in the Ring pane; the workspace
    // layout can show both at once, so a per-caller useState would leave the pane stale.
    const toggle = renderHook(() => usePixelFightStage());
    const consumer = renderHook(() => usePixelFightStage());

    act(() => toggle.result.current.setPixelFightStageEnabled(true));

    expect(consumer.result.current.pixelFightStageEnabled).toBe(true);
  });

  it('follows the setting when another tab changes it', () => {
    const { result } = renderHook(() => usePixelFightStage());

    act(() => {
      localStorage.setItem(KEY, '1');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: '1' }));
    });

    expect(result.current.pixelFightStageEnabled).toBe(true);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => usePixelFightStage());

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'deck-monsters-theme', newValue: 'amber' }));
    });

    expect(result.current.pixelFightStageEnabled).toBe(false);
  });
});
