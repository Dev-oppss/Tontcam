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
          50:  '#eef4ff',
          100: '#dbe6ff',
          200: '#bfd0ff',
          300: '#93b0ff',
          400: '#5f86ee',
          500: '#2c5bd0',
          600: '#2147a6',
          700: '#18377f',
          800: '#132c63',
          900: '#10224d',
          950: '#09142a',
        },
        gold: {
          300: '#f8e7ab',
          400: '#f0cf6b',
          500: '#d9a629',
          600: '#b57f13',
        },
        surface: {
          50:  '#fbfaf7',
          100: '#f3eee6',
          200: '#e4d8c8',
        },
        ink: {
          900: '#101827',
          800: '#1f2b42',
          700: '#35405a',
          600: '#55617c',
        },
        earth: {
          50:  '#fff8e6',
          100: '#f9eab8',
          200: '#efd57d',
          300: '#dfb94d',
          400: '#c7921f',
          500: '#a87312',
          600: '#84590e',
          700: '#61420c',
          800: '#402b09',
          900: '#261a05',
        },
      },
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1.125rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        'card': '0 18px 40px -24px rgba(16,32,27,.35)',
        'card-hover': '0 24px 56px -24px rgba(16,32,27,.42)',
        'inner-sm': 'inset 0 1px 3px rgba(16,32,27,.08)',
        'glow-green': '0 0 0 3px rgba(47,141,105,.16)',
        'glow-gold':  '0 0 0 3px rgba(201,146,45,.16)',
        'glow-blue':  '0 0 0 3px rgba(47,141,105,.12)',
      },
    },
  },
  plugins: [],
}
