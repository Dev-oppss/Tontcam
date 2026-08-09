/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900:'#0B0D12', 800:'#171A22', 700:'#2E3540', 600:'#4A525F', 500:'#6B7280' },
        paper: { 50:'#F5F6F8', 100:'#ECEEF2', 200:'#DEE1E7' },
        indigo: { 50:'#EEF0FD', 100:'#DBE0FB', 300:'#8D98EA', 400:'#6675DF', 500:'#4C5FD6', 600:'#3B4BB0', 700:'#2E3B8C' },
        bronze: { 50:'#FBF6EC', 100:'#F3E6C7', 300:'#D9BA79', 400:'#C39F52', 500:'#B08A3E', 600:'#8C6D2F' },
        emerald: { 50:'#E9F7F1', 100:'#C9EDDD', 400:'#2CAE86', 500:'#1F8A6F', 600:'#186B57' },
        ruby: { 50:'#FCEEEC', 100:'#F6D3CD', 400:'#D9694E', 500:'#C24E33' },
      },
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: { '2xl': '1.125rem', '3xl': '1.5rem' },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        glass: '0 8px 32px -8px rgba(11,13,18,.12)',
        'glass-lg': '0 20px 60px -16px rgba(11,13,18,.18)',
        'glow-indigo': '0 0 0 3px rgba(76,95,214,.14)',
      },
    },
  },
  plugins: [],
}
