import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '320px',
        '3xl': '2560px',
      },
      colors: {
        // Surface / Background
        surface: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          elevated: 'var(--bg-elevated)',
          input: 'var(--bg-input)',
        },
        // Text
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        // Borders
        edge: {
          DEFAULT: 'var(--border-default)',
          hover: 'var(--border-hover)',
        },
        // Accents
        accent: {
          blue: 'var(--accent-blue)',
          green: 'var(--accent-green)',
          red: 'var(--accent-red)',
          yellow: 'var(--accent-yellow)',
          purple: 'var(--accent-purple)',
          orange: 'var(--accent-orange)',
        },
        // Chart palette
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
          7: 'var(--chart-7)',
          8: 'var(--chart-8)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'hero': ['2.5rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        'page-title': ['1.5rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.02em' }],
        'section': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'card-title': ['0.75rem', { lineHeight: '1.5', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        card: '12px',
        pill: '6px',
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '64px',
      },
      maxWidth: {
        content: '1200px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.12)',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'skeleton': 'skeleton-pulse 1.5s ease-in-out infinite',
        'slide-in': 'slide-in-right 200ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
