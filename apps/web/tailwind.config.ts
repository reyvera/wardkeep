import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '320px',
        '3xl': '2560px',
      },
    },
  },
  plugins: [],
};

export default config;
