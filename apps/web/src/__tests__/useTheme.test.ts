import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { useTheme } from '../hooks/useTheme.js';

const STORAGE_KEY = 'deck-monsters-theme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-features');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-features');
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

  it('sets data-theme="street-fighter" and persists it', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('street-fighter'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('street-fighter');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('street-fighter');
  });

  it('sets data-theme="ember" and persists it', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('ember'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('ember');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ember');
  });

  it('includes ember in validThemes', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.validThemes).toContain('ember');
  });

  it('includes street-fighter in validThemes', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.validThemes).toContain('street-fighter');
  });

  it('clears a stale theme-features attribute left by an older build', () => {
    // The per-theme feature list was removed when the pixel sprites moved to every theme.
    document.documentElement.setAttribute('data-theme-features', 'pixel-art');
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('street-fighter'));

    expect(document.documentElement.getAttribute('data-theme-features')).toBeNull();
  });

  it('shares a same-tab theme change with every consumer', () => {
    function Switcher() {
      const { setTheme } = useTheme();
      return createElement('button', { onClick: () => setTheme('street-fighter') }, 'street fighter');
    }
    function Consumer() {
      return createElement('output', undefined, useTheme().theme);
    }

    render(createElement('div', undefined, createElement(Switcher), createElement(Consumer)));

    expect(screen.getByRole('status')).toHaveTextContent('phosphor');
    act(() => screen.getByRole('button', { name: 'street fighter' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('street-fighter');
  });
});
