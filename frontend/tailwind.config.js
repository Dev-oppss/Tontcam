/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f3f7fb',
          100: '#e8f0f8',
          200: '#d5e3f0',
          300: '#adc8df',
          400: '#6f98bd',
          500: '#3b6ea5',
          600: '#315d8c',
          700: '#274b72',
          800: '#172b4a',
          900: '#0d1a2b',
          950: '#061122',
        },
        gold: {
          300: '#e5edf5',
          400: '#d9e3ee',
          500: '#8fa8bd',
          600: '#64748b',
        },
        surface: {
          50:  '#f6f8fb',
          100: '#eef3f7',
          200: '#d9e3ee',
        },
        ink: {
          900: '#0f1724',
          800: '#162033',
          700: '#243044',
          600: '#385066',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,.06), 0 4px 16px -4px rgba(0,0,0,.08)',
        'card-hover': '0 4px 8px 0 rgba(0,0,0,.08), 0 12px 32px -8px rgba(0,0,0,.14)',
        'inner-sm': 'inset 0 1px 3px rgba(0,0,0,.08)',
        'glow-green': '0 0 0 3px rgba(18,181,113,.15)',
        'glow-gold':  '0 0 0 3px rgba(232,168,0,.12)',
        'glow-blue':  '0 0 0 3px rgba(59,97,145,.12)',
      },
    },
  },
  plugins: [],
}
