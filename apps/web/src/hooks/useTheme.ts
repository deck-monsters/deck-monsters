import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'deck-monsters-theme';
/**
 * `themeColor` is the theme's `--color-bg`, for `<meta name="theme-color">` (the phone's
 * status bar and the browser chrome). It is repeated in the inline pre-paint script in
 * index.html, which cannot import this file; `theme-prepaint.test.ts` fails if the two
 * drift apart, or from the theme stylesheets.
 */
export const THEMES = [
  { id: 'phosphor', label: 'Phosphor (green on black)', themeColor: '#0a0e0a' },
  { id: 'amber', label: 'Amber (orange on black)', themeColor: '#0a0800' },
  { id: 'ember', label: 'Ember (red on black)', themeColor: '#12060a' },
  { id: 'street-fighter', label: 'Street Fighter (SNES, 1992)', themeColor: '#060c1e' },
] as const satisfies ReadonlyArray<{ id: string; label: string; themeColor: string }>;

export type ThemeId = typeof THEMES[number]['id'];
export type Theme = ThemeId;

const VALID_THEMES = THEMES.map(({ id }) => id) as readonly ThemeId[];

function isValidTheme(value: string | null): value is Theme {
  return VALID_THEMES.includes(value as ThemeId);
}

function getPreferredTheme(): Theme {
  // localStorage throws in private windows and with blocked site data.
  // Fall back to the in-memory choice so a setTheme still sticks for the session.
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return currentTheme ?? 'phosphor';
  }
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

  // The status bar follows the theme. index.html's pre-paint script sets it before first
  // paint for a returning player; this keeps it right on every later change.
  const themeColor = THEMES.find(({ id }) => id === theme)?.themeColor;
  if (themeColor) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
  }

  // There used to be a per-theme `features` list here, mirrored onto a
  // `data-theme-features` attribute, whose only entry was the SNES theme's pixel art. The
  // sprites now show on every theme
  // (docs/architecture/ring-roster-and-pixel-monsters.md), so the
  // mechanism went with them; no stylesheet ever read the attribute. Clear it for anyone
  // whose document still carries it from before the upgrade.
  document.documentElement.removeAttribute('data-theme-features');
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
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not persisted; currentTheme still holds the choice for this session.
  }
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
