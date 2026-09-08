import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0a0f1e',
          900: '#0d1424',
          800: '#121b32',
          700: '#1a2540',
        },
        brand: {
          indigo: '#4f46e5',
          teal: '#0d9488',
          emerald: '#059669',
          amber: '#d97706',
          red: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
