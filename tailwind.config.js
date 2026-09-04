/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0F2D5B',
        blue: { DEFAULT: '#2865F6', strong: '#1E4FDC' },
        orange: { DEFAULT: '#F97316', strong: '#DC5F0A' },
        green: { DEFAULT: '#109861', strong: '#0C7C4F' },
        red: { DEFAULT: '#DC2626', strong: '#B91C1C' },
        ink: '#0F172A',
        slate: '#64748B',
        border: '#E2E8F0',
        bg: '#F8FAFC',
        surface: '#FFFFFF',
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
