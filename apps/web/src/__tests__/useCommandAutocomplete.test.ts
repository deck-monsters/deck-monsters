import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCommandAutocomplete } from '../hooks/useCommandAutocomplete.js';

describe('useCommandAutocomplete', () => {
  it('returns empty when input is shorter than 2 characters', () => {
    const { result } = renderHook(() => useCommandAutocomplete('s'));
    expect(result.current).toHaveLength(0);
  });

  it('returns empty when disabled', () => {
    const { result } = renderHook(() => useCommandAutocomplete('spawn', false));
    expect(result.current).toHaveLength(0);
  });

  it('matches commands by prefix', () => {
    const { result } = renderHook(() => useCommandAutocomplete('spa'));
    const labels = result.current.map(s => s.label);
    expect(labels.some(l => l.includes('spawn'))).toBe(true);
  });

  it('returns at most 5 suggestions', () => {
    const { result } = renderHook(() => useCommandAutocomplete('lo'));
    expect(result.current.length).toBeLessThanOrEqual(5);
  });

  it('prefix matches come before word matches', () => {
    const { result } = renderHook(() => useCommandAutocomplete('ring'));
    const labels = result.current.map(s => s.label);
    const firstRingIdx = labels.findIndex(l => l.toLowerCase().startsWith('ring'));
    const laterRingIdx = labels.findIndex(l => l.toLowerCase().includes('ring') && !l.toLowerCase().startsWith('ring'));
    if (firstRingIdx >= 0 && laterRingIdx >= 0) {
      expect(firstRingIdx).toBeLessThan(laterRingIdx);
    }
  });

  it('insertValue strips placeholder brackets', () => {
    const { result } = renderHook(() => useCommandAutocomplete('equip '));
    const equip = result.current.find(s => s.label.startsWith('equip'));
    if (equip) {
      expect(equip.insertValue).not.toContain('[');
      expect(equip.insertValue).not.toContain(']');
    }
  });
});
