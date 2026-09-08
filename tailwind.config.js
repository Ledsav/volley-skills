/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Each token reads from a CSS variable (defined per-theme in src/index.css)
      // via the rgb(var(...) / <alpha-value>) pattern, so bg-navy, text-ink, etc.
      // repaint automatically when the `dark` class toggles, and opacity
      // modifiers like bg-blue/10 keep working.
      colors: {
        navy: 'rgb(var(--color-navy) / <alpha-value>)',
        blue: {
          DEFAULT: 'rgb(var(--color-blue) / <alpha-value>)',
          strong: 'rgb(var(--color-blue-strong) / <alpha-value>)',
        },
        orange: {
          DEFAULT: 'rgb(var(--color-orange) / <alpha-value>)',
          strong: 'rgb(var(--color-orange-strong) / <alpha-value>)',
        },
        green: {
          DEFAULT: 'rgb(var(--color-green) / <alpha-value>)',
          strong: 'rgb(var(--color-green-strong) / <alpha-value>)',
        },
        red: {
          DEFAULT: 'rgb(var(--color-red) / <alpha-value>)',
          strong: 'rgb(var(--color-red-strong) / <alpha-value>)',
        },
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        slate: 'rgb(var(--color-slate) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { sm: '6px', md: '9px', lg: '14px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.06), 0 1px 0 rgba(15,23,42,.03)',
        pop: '0 8px 24px rgba(15,23,42,.14), 0 2px 6px rgba(15,23,42,.08)',
      },
    },
  },
  plugins: [],
};
