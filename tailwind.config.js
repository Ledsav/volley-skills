/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Each token reads from a CSS variable (defined per-theme in src/index.css)
      // via the rgb(var(...) / <alpha-value>) pattern, so bg-surface, text-ink, etc.
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
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          2: 'rgb(var(--color-ink-2) / <alpha-value>)',
          3: 'rgb(var(--color-ink-3) / <alpha-value>)',
        },
        'on-ink': 'rgb(var(--color-on-ink) / <alpha-value>)',
        'destructive-fill': 'rgb(var(--color-destructive-fill) / <alpha-value>)',
        separator: 'rgb(var(--color-separator) / <alpha-value>)',
        focus: 'rgb(var(--color-focus) / <alpha-value>)',
        sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
        // Legacy aliases, removed in increment 6.
        slate: 'rgb(var(--color-slate) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          2: 'rgb(var(--color-surface-2) / <alpha-value>)',
          3: 'rgb(var(--color-surface-3) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Type roles from design system section 3, in rem so the browser text size scales the layout.
      fontSize: {
        'large-title': ['var(--fs-large-title)', { lineHeight: 'var(--lh-large-title)', letterSpacing: '-0.022em', fontWeight: '700' }],
        'title-1': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        'title-2': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.017em', fontWeight: '600' }],
        'title-3': ['1.1875rem', { lineHeight: '1.5rem', letterSpacing: '-0.012em', fontWeight: '600' }],
        headline: ['1rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.005em', fontWeight: '400' }],
        callout: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.003em', fontWeight: '400' }],
        footnote: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em', fontWeight: '500' }],
        stat: ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.03em', fontWeight: '700' }],
        score: ['var(--fs-score)', { lineHeight: 'var(--lh-score)', letterSpacing: '-0.04em', fontWeight: '700' }],
        display: ['2.75rem', { lineHeight: '2.875rem', letterSpacing: '-0.035em', fontWeight: '700' }],
        // Legacy roles, removed in increment 6.
        title: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        section: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '22px' },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: '0 8px 32px rgba(0,0,0,.12)',
        sheet: '0 -8px 40px rgba(0,0,0,.18)',
      },
      transitionTimingFunction: {
        'out-strong': 'var(--ease-out)',
        drawer: 'var(--ease-drawer)',
      },
    },
  },
  plugins: [],
};
