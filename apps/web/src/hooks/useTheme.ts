import { useCallback, useEffect, useSyncExternalStore } from 'react';

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

let currentTheme: Theme | undefined;
const listeners = new Set<() => void>();

function getTheme(): Theme {
  const storedTheme = getPreferredTheme();
  if (currentTheme !== storedTheme) currentTheme = storedTheme;
  return currentTheme;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function setStoredTheme(theme: Theme): void {
  currentTheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const next = isValidTheme(event.newValue) ? event.newValue : 'phosphor';
    if (next === currentTheme) return;
    currentTheme = next;
    applyTheme(next);
    notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setStoredTheme(next);
  }, []);

  return { theme, setTheme, validThemes: VALID_THEMES };
}

export function useThemeFeature(feature: ThemeFeature): boolean {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  const features = THEMES.find((candidate) => candidate.id === theme)?.features as
    | ReadonlyArray<ThemeFeature>
    | undefined;
  return features?.includes(feature) ?? false;
}
