import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'deck-monsters-theme';
export const THEMES = [
  { id: 'phosphor', label: 'Phosphor (green on black)', features: [] },
  { id: 'amber', label: 'Amber (orange on black)', features: [] },
  { id: 'ember', label: 'Ember (red on black)', features: [] },
  { id: 'street-fighter', label: 'Street Fighter (SNES, 1992)', features: ['pixel-art'] },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  features: ReadonlyArray<'pixel-art'>;
}>;

export type ThemeId = typeof THEMES[number]['id'];
export type Theme = ThemeId;
export type ThemeFeature = 'pixel-art';

const VALID_THEMES = THEMES.map(({ id }) => id) as readonly ThemeId[];

function isValidTheme(value: string | null): value is Theme {
  return VALID_THEMES.includes(value as ThemeId);
}

function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isValidTheme(stored)) return stored;
  // Default to phosphor regardless of prefers-color-scheme — the entire app
  // is dark-first by design.
  return 'phosphor';
}

function applyTheme(theme: Theme): void {
  if (theme === 'phosphor') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }

  const features = THEMES.find((candidate) => candidate.id === theme)?.features ?? [];
  if (features.length === 0) {
    document.documentElement.removeAttribute('data-theme-features');
  } else {
    document.documentElement.setAttribute('data-theme-features', features.join(' '));
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getPreferredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    applyTheme(next);
  }, []);

  return { theme, setTheme, validThemes: VALID_THEMES };
}

export function useThemeFeature(feature: ThemeFeature): boolean {
  const { theme } = useTheme();
  return THEMES.find((candidate) => candidate.id === theme)?.features.includes(feature) ?? false;
}
