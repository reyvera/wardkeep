'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';
export type PresetAccentTheme = 'midnight' | 'slate' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'mono';
export type AccentTheme = PresetAccentTheme | 'custom';

export const ACCENT_PRESETS: Record<PresetAccentTheme, { label: string; color: string }> = {
  midnight: { label: 'Midnight', color: '#4a9eff' },
  slate: { label: 'Slate', color: '#64748b' },
  ocean: { label: 'Ocean', color: '#0ea5e9' },
  forest: { label: 'Forest', color: '#10b981' },
  sunset: { label: 'Sunset', color: '#f97316' },
  lavender: { label: 'Lavender', color: '#8b5cf6' },
  mono: { label: 'Mono', color: '#475569' },
};

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  accentTheme: AccentTheme;
  customAccent: string;
  setAccentTheme: (accent: PresetAccentTheme) => void;
  setCustomAccent: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  accentTheme: 'midnight',
  customAccent: '#4a9eff',
  setAccentTheme: () => {},
  setCustomAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Theme provider that manages dark/light mode via CSS class on <html>.
 * Defaults to dark mode.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>('midnight');
  const [customAccent, setCustomAccentState] = useState('#4a9eff');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setThemeState(stored);
    }
    const storedAccent = localStorage.getItem('accent-theme') as AccentTheme | null;
    if (storedAccent === 'custom' || (storedAccent && storedAccent in ACCENT_PRESETS)) setAccentThemeState(storedAccent);
    const storedCustomAccent = localStorage.getItem('custom-accent');
    if (storedCustomAccent && /^#[0-9a-f]{6}$/i.test(storedCustomAccent)) setCustomAccentState(storedCustomAccent);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (resolved: 'dark' | 'light') => {
      root.classList.remove('dark', 'light');
      root.classList.add(resolved);
      setResolvedTheme(resolved);
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    const accent = accentTheme === 'custom' ? customAccent : ACCENT_PRESETS[accentTheme].color;
    document.documentElement.style.setProperty('--accent-blue', accent);
  }, [accentTheme, customAccent]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };
  const setAccentTheme = (newAccent: PresetAccentTheme) => {
    setAccentThemeState(newAccent);
    localStorage.setItem('accent-theme', newAccent);
  };
  const setCustomAccent = (color: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    setCustomAccentState(color);
    setAccentThemeState('custom');
    localStorage.setItem('accent-theme', 'custom');
    localStorage.setItem('custom-accent', color);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, accentTheme, customAccent, setAccentTheme, setCustomAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
