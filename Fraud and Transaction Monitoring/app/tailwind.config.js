/** @type {import('tailwindcss').Config} */
// `primary` reads CSS variables set per vertical (src/config/index.js), so one
// build can be teal, indigo or blue.
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: Object.fromEntries(shades.map((s) => [s, `rgb(var(--primary-${s}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
}
