/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#416ebe',
          'blue-light': '#00aff0',
          yellow: '#ffeb00',
          dark: '#46464b',
          'bg-light': '#e6f0fa',
          'blue-pale': '#cddcf0',
        },
      },
      fontFamily: {
        lato: ['Lato', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
