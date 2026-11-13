import { VERTICALS } from './verticals';

/**
 * The vertical this server is running as. The start script runs Vite with
 * `--mode banking|super|smsf`; VITE_VERTICAL in .env.local overrides it.
 */
export const vertical =
  VERTICALS[import.meta.env.VITE_VERTICAL] || VERTICALS[import.meta.env.MODE] || VERTICALS.smsf;

/** Which FrankieOne account and environment the demo talks to, for the banner. */
export const ENV_LABEL = import.meta.env.VITE_ENV_LABEL || 'FrankieOne UAT';

/** Placeholder palettes, as RGB triplets so Tailwind can apply opacity. */
const THEMES = {
  blue: {
    50: '240 247 252', 100: '219 238 250', 200: '184 220 242', 300: '121 180 216', 400: '75 155 203',
    500: '47 137 192', 600: '30 120 175', 700: '18 96 144', 800: '16 78 132', 900: '10 72 117', 950: '6 47 77',
  },
  teal: {
    50: '240 253 250', 100: '204 251 241', 200: '153 246 228', 300: '94 234 212', 400: '45 212 191',
    500: '20 184 166', 600: '13 148 136', 700: '15 118 110', 800: '17 94 89', 900: '19 78 74', 950: '4 47 46',
  },
  indigo: {
    50: '238 242 255', 100: '224 231 255', 200: '199 210 254', 300: '165 180 252', 400: '129 140 248',
    500: '99 102 241', 600: '79 70 229', 700: '67 56 202', 800: '55 48 163', 900: '49 46 129', 950: '30 27 75',
  },
};

/** Apply the vertical's palette and page title. Called once, before render. */
export function applyBranding() {
  const palette = THEMES[vertical.brand.theme] || THEMES.blue;
  const root = document.documentElement;
  Object.entries(palette).forEach(([shade, rgb]) => root.style.setProperty(`--primary-${shade}`, rgb));
  document.title = `${vertical.brand.name} — ${vertical.brand.product} (demo)`;
}

/** Storage keys, namespaced per vertical so the three demos never share state. */
export const storageKey = (name) => `fd.${vertical.id}.${name}`;
