import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Millefleur's stylesheet and Nunito are a lazy chunk (themes/millefleur.ts). Importing the
 * module is what loads them, so the tests mock it and count evaluations: the factory runs
 * once, on the first dynamic import, however many times the theme is applied.
 */
const evaluated = vi.hoisted(() => ({ count: 0 }));
vi.mock('../themes/millefleur.js', () => {
  evaluated.count += 1;
  return {};
});

import { useTheme, loadThemeAssets } from '../hooks/useTheme.js';

describe('lazy theme chunk', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('does not load the Millefleur chunk for the dark themes', async () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('amber'));
    await loadThemeAssets('amber');
    expect(evaluated.count).toBe(0);
  });

  it('loads it the first time Millefleur is applied, and only once', async () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('millefleur'));
    await loadThemeAssets('millefleur');
    expect(evaluated.count).toBe(1);
    expect(document.documentElement.getAttribute('data-theme')).toBe('millefleur');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#fbf8f5');

    act(() => result.current.setTheme('ember'));
    act(() => result.current.setTheme('millefleur'));
    await loadThemeAssets('millefleur');
    expect(evaluated.count).toBe(1);
  });
});
