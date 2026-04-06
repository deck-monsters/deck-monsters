import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme.js';

const STORAGE_KEY = 'deck-monsters-theme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('defaults to phosphor theme when nothing is stored', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('phosphor');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('reads stored theme from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'amber');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('amber');
  });

  it('sets data-theme attribute on documentElement when theme is amber', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('amber'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('amber');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('amber');
  });

  it('removes data-theme attribute when switching back to phosphor', () => {
    localStorage.setItem(STORAGE_KEY, 'amber');
    document.documentElement.setAttribute('data-theme', 'amber');
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('phosphor'));
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('phosphor');
  });

  it('persists theme choice across re-renders', () => {
    const { result, rerender } = renderHook(() => useTheme());
    act(() => result.current.setTheme('amber'));
    rerender();
    expect(result.current.theme).toBe('amber');
  });
});
