/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lunardeli: {
          red: '#E5192C',
          deep: '#B01020',
          dark: '#1B1B1B',
          charcoal: '#333333',
          gray: '#F5F5F5',
          lightGray: '#E0E0E0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'mkt-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'mkt-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'mkt-fade-up': 'mkt-fade-up 0.7s ease-out both',
        'mkt-fade-in': 'mkt-fade-in 0.8s ease-out both',
      },
    },
  },
  plugins: [],
}
