/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      screens: {
        'mobile': {'max': '900px'},
      },
      colors: {
        brand: {
          DEFAULT: '#6C5FEA',
          hover:   '#5B4FE8',
          muted:   '#4A3FD4',
          glow:    'rgba(108,95,234,0.25)',
        },
        dark: {
          900: '#0F0F13',
          800: '#141418',
          700: '#1C1C24',
          600: '#2A2A38',
          500: '#3A3A4E',
        },
        panel: {
          left:  '#3730C4',
          orb1:  '#4F44E0',
          orb2:  '#2920A8',
        },
        text: {
          primary: '#FFFFFF',
          muted:   '#8B8B9E',
          label:   '#9090A0',
        }
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['Merriweather', 'serif'],
      },
      fontSize: {
        'label': ['0.65rem', { letterSpacing: '0.12em', fontWeight: '600' }],
      },
      borderRadius: {
        'input': '0.625rem',
        'btn':   '0.625rem',
        'card':  '1rem',
        'icon':  '0.5rem',
      },
      height: {
        'input': '3rem',
        'btn':   '3.25rem',
      },
      keyframes: {
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        }
      },
      animation: {
        shake: 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
      }
    },
  },
  plugins: [],
}