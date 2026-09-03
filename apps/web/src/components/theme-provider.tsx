'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';
export type PresetAccentTheme =
  'midnight' | 'slate' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'mono';
export type AccentTheme = PresetAccentTheme | 'custom';

type AccentPreset = {
  label: string;
  color: string;
  variables: Record<string, string>;
  surfaces: {
    dark: [string, string, string, string, string, string];
    light: [string, string, string, string, string, string];
  };
};

const chartVariables = (colors: string[]) =>
  Object.fromEntries(colors.map((color, index) => [`--chart-${index + 1}`, color]));
const surfaceVariables = ([
  primary,
  secondary,
  elevated,
  input,
  border,
  hover,
]: AccentPreset['surfaces']['dark']) => ({
  '--bg-primary': primary,
  '--bg-secondary': secondary,
  '--bg-elevated': elevated,
  '--bg-input': input,
  '--border-default': border,
  '--border-hover': hover,
});

export const ACCENT_PRESETS: Record<PresetAccentTheme, AccentPreset> = {
  midnight: {
    label: 'Midnight',
    color: '#4a9eff',
    variables: {
      '--brand-gold': '#c9a84c',
      '--accent-purple': '#a78bfa',
      '--accent-orange': '#fb923c',
      '--font-display': 'var(--font-inter)',
      ...chartVariables([
        '#4a9eff',
        '#34d399',
        '#a78bfa',
        '#fb923c',
        '#f87171',
        '#fbbf24',
        '#2dd4bf',
        '#f472b6',
      ]),
    },
    surfaces: {
      dark: ['#0d0f12', '#151921', '#1c2230', '#1a1f2b', '#232a36', '#2f3845'],
      light: ['#ffffff', '#f8fafb', '#ffffff', '#f3f5f7', '#e5e8ec', '#d1d5db'],
    },
  },
  slate: {
    label: 'Slate',
    color: '#64748b',
    variables: {
      '--brand-gold': '#94a3b8',
      '--accent-purple': '#818cf8',
      '--accent-orange': '#94a3b8',
      '--font-display': 'var(--font-inter)',
      ...chartVariables([
        '#64748b',
        '#94a3b8',
        '#475569',
        '#cbd5e1',
        '#f87171',
        '#fbbf24',
        '#0f766e',
        '#a78bfa',
      ]),
    },
    surfaces: {
      dark: ['#10151c', '#17202a', '#1e2936', '#1b2632', '#2a3645', '#3c4a5d'],
      light: ['#f8fafc', '#f1f5f9', '#ffffff', '#e9eef4', '#d8e0ea', '#b9c6d6'],
    },
  },
  ocean: {
    label: 'Ocean',
    color: '#0ea5e9',
    variables: {
      '--brand-gold': '#38bdf8',
      '--accent-purple': '#22d3ee',
      '--accent-orange': '#14b8a6',
      '--font-display': 'ui-rounded, var(--font-inter)',
      ...chartVariables([
        '#0ea5e9',
        '#14b8a6',
        '#22d3ee',
        '#38bdf8',
        '#f87171',
        '#fbbf24',
        '#06b6d4',
        '#6366f1',
      ]),
    },
    surfaces: {
      dark: ['#071722', '#0b2330', '#10313f', '#0d2936', '#164252', '#20576a'],
      light: ['#f5fcff', '#edf9fe', '#ffffff', '#e3f5fc', '#cdebf7', '#a9dced'],
    },
  },
  forest: {
    label: 'Forest',
    color: '#10b981',
    variables: {
      '--brand-gold': '#a3e635',
      '--accent-purple': '#84cc16',
      '--accent-orange': '#d97706',
      '--font-display': 'ui-serif, Georgia, serif',
      ...chartVariables([
        '#10b981',
        '#84cc16',
        '#22c55e',
        '#a3e635',
        '#f87171',
        '#eab308',
        '#0d9488',
        '#65a30d',
      ]),
    },
    surfaces: {
      dark: ['#0b1710', '#112319', '#183025', '#14291e', '#254332', '#365943'],
      light: ['#f7fcf8', '#eef8f0', '#ffffff', '#e5f4e8', '#d2e9d7', '#afd2b8'],
    },
  },
  sunset: {
    label: 'Sunset',
    color: '#f97316',
    variables: {
      '--brand-gold': '#fbbf24',
      '--accent-purple': '#ec4899',
      '--accent-orange': '#fb7185',
      '--font-display': 'var(--font-inter)',
      ...chartVariables([
        '#f97316',
        '#fb7185',
        '#ec4899',
        '#fbbf24',
        '#ef4444',
        '#f59e0b',
        '#f43f5e',
        '#c084fc',
      ]),
    },
    surfaces: {
      dark: ['#1a100e', '#291713', '#382019', '#301b15', '#4a2a20', '#60392b'],
      light: ['#fff9f5', '#fff1e8', '#ffffff', '#ffeadc', '#f5d5c3', '#e7b89c'],
    },
  },
  lavender: {
    label: 'Lavender',
    color: '#8b5cf6',
    variables: {
      '--brand-gold': '#c4b5fd',
      '--accent-purple': '#c084fc',
      '--accent-orange': '#f0abfc',
      '--font-display': 'ui-serif, Georgia, serif',
      ...chartVariables([
        '#8b5cf6',
        '#a78bfa',
        '#c084fc',
        '#f0abfc',
        '#f87171',
        '#fbbf24',
        '#818cf8',
        '#e879f9',
      ]),
    },
    surfaces: {
      dark: ['#15101f', '#21182d', '#2c213b', '#271d35', '#3d2e52', '#503e68'],
      light: ['#fbfaff', '#f4f0fe', '#ffffff', '#eee9fb', '#dfd5f5', '#c7b8e8'],
    },
  },
  mono: {
    label: 'Mono',
    color: '#64748b',
    variables: {
      '--brand-gold': '#94a3b8',
      '--accent-purple': '#64748b',
      '--accent-orange': '#94a3b8',
      '--font-display': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      ...chartVariables([
        '#475569',
        '#64748b',
        '#94a3b8',
        '#cbd5e1',
        '#ef4444',
        '#eab308',
        '#334155',
        '#a8a29e',
      ]),
    },
    surfaces: {
      dark: ['#111315', '#191c1f', '#22262a', '#1d2125', '#30363d', '#454d56'],
      light: ['#fafafa', '#f2f2f2', '#ffffff', '#ececec', '#d7d7d7', '#bdbdbd'],
    },
  },
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
    if (storedAccent === 'custom' || (storedAccent && storedAccent in ACCENT_PRESETS))
      setAccentThemeState(storedAccent);
    const storedCustomAccent = localStorage.getItem('custom-accent');
    if (storedCustomAccent && /^#[0-9a-f]{6}$/i.test(storedCustomAccent))
      setCustomAccentState(storedCustomAccent);
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
    const root = document.documentElement;
    const preset = accentTheme === 'custom' ? ACCENT_PRESETS.midnight : ACCENT_PRESETS[accentTheme];
    root.style.setProperty('--accent-blue', accentTheme === 'custom' ? customAccent : preset.color);
    Object.entries(preset.variables).forEach(([name, value]) =>
      root.style.setProperty(name, value),
    );
    Object.entries(surfaceVariables(preset.surfaces[resolvedTheme])).forEach(([name, value]) =>
      root.style.setProperty(name, value),
    );
    root.style.setProperty('--font-theme', preset.variables['--font-display']);
  }, [accentTheme, customAccent, resolvedTheme]);

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
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        accentTheme,
        customAccent,
        setAccentTheme,
        setCustomAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
