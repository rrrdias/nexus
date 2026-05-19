/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1C2B4A', // Uso estratégico para autoridade institucional
          mid: '#243355',
          light: '#2E4070',
        },
        green: {
          DEFAULT: '#27AE60', // Ações e vitalidade
          light: '#2ECC71',
          pale: '#E8F8EF',
        },
        blue: {
          act: '#1976D2',
          pale: '#E3F0FB',
        },
        amber: {
          DEFAULT: '#F39C12',
          pale: '#FEF3E0',
        },
        red: {
          DEFAULT: '#E53935',
          pale: '#FEECEC',
        },
        teal: {
          DEFAULT: '#0097A7',
          pale: '#E0F5F7',
        },
        gray: {
          100: '#F4F5F7',
          200: '#E8EAED',
          400: '#9AA0AC',
          600: '#5F6775',
          900: '#1A1D23',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'], // Legibilidade em displays e interfaces densas
        mono: ['"DM Mono"', 'monospace'],  // Dados técnicos, IDs e códigos de matrícula
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
      }
    },
  },
  plugins: [
    require('tailwindcss-primeui')
  ],
}