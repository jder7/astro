/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './advanced.html', './esoteric.html', './education.html', './src/**/*.{svelte,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        display: [
          '"Space Grotesk"',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"Segoe UI Symbol"',
          '"Apple Symbols"',
          '"Noto Sans Symbols 2"',
          '"Noto Sans Symbols"',
          'Menlo',
          'Monaco',
          'Consolas',
          '"DejaVu Sans"',
          '"Symbola"',
          'sans-serif',
        ],
        body: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"Segoe UI Symbol"',
          '"Apple Symbols"',
          '"Noto Sans Symbols 2"',
          '"Noto Sans Symbols"',
          'Menlo',
          'Monaco',
          'Consolas',
          '"DejaVu Sans"',
          '"Symbola"',
          'sans-serif',
        ],
      },
      colors: {
        nebula: {
          50: '#e6f7ff',
          100: '#c9edff',
          500: '#38bdf8',
          700: '#0ea5e9',
        },
        aurora: {
          100: '#fbcfe8',
          300: '#f472b6',
          500: '#db2777',
          700: '#be185d',
        },
        verdant: {
          100: '#d1fae5',
          300: '#6ee7b7',
          500: '#34d399',
          700: '#059669',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56,189,248,0.35), 0 12px 45px rgba(15,23,42,0.65)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
