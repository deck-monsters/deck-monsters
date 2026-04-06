import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'deck-monsters-theme';
const VALID_THEMES = ['phosphor', 'amber'] as const;
export type Theme = typeof VALID_THEMES[number];

function isValidTheme(value: string | null): value is Theme {
  return VALID_THEMES.includes(value as Theme);
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
