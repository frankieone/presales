/**
 * White labelling: each intermediary's console carries the intermediary's
 * own brand, not the platform's. A brand is a display name, logo, colour,
 * font and web address, plus whether to show "Powered by" the platform.
 * FrankieOne never appears in any intermediary's console either way.
 *
 * Defaults live here; the platform's Branding page saves overrides.
 */
import { PLATFORM, byId } from './config.mjs';
import { store } from './store.mjs';
import { ClientError } from './tier1.mjs';

export const FONTS = ['Inter', 'DM Sans', 'Manrope', 'Plus Jakarta Sans', 'Source Serif 4'];
const LOGO_STYLES = ['monogram', 'wordmark', 'image'];

const DEFAULTS = {
  northgate: { displayName: 'Northgate', tagline: 'Private Client Services', primary: '#1F3A5F', font: 'Source Serif 4', logoStyle: 'wordmark', domain: 'clients.northgate.com.au', poweredBy: false },
  bluewave: { displayName: 'Bluewave', tagline: 'Onboarding', primary: '#0E9F8E', font: 'DM Sans', logoStyle: 'monogram', domain: 'onboard.bluewave.app', poweredBy: true },
  kestrel: { displayName: 'Kestrel Wealth', tagline: 'Adviser portal', primary: '#5B21B6', font: 'Manrope', logoStyle: 'monogram', domain: 'portal.kestrelwealth.com.au', poweredBy: false },
};

/** The brand an intermediary's console uses: its own defaults, then any saved overrides. */
export function brandFor(id) {
  const im = byId[id];
  return {
    displayName: im?.name, tagline: 'Client onboarding', primary: im?.colour || '#2563EB', font: 'Inter',
    logoStyle: 'monogram', logoImage: null, domain: null, poweredBy: true, platform: PLATFORM.name,
    ...DEFAULTS[id], ...store.brand(id),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const DOMAIN = /^[a-z0-9.-]{3,80}$/i;

/** Save a brand from the platform's Branding page. Every field is checked; unknown ones are dropped. */
export function saveBrand(id, body) {
  if (!byId[id]) throw new ClientError(404, 'NOT_FOUND', 'No such intermediary.');
  const b = {};
  if (body.displayName !== undefined) b.displayName = String(body.displayName).trim().slice(0, 40) || byId[id].name;
  if (body.tagline !== undefined) b.tagline = String(body.tagline).trim().slice(0, 40);
  if (body.primary !== undefined) { if (!HEX.test(body.primary)) throw new ClientError(400, 'BAD_COLOUR', 'Use a colour like #1F3A5F.'); b.primary = body.primary; }
  if (body.font !== undefined) { if (!FONTS.includes(body.font)) throw new ClientError(400, 'BAD_FONT', 'Choose one of the listed fonts.'); b.font = body.font; }
  if (body.logoStyle !== undefined) { if (!LOGO_STYLES.includes(body.logoStyle)) throw new ClientError(400, 'BAD_LOGO', 'Unknown logo style.'); b.logoStyle = body.logoStyle; }
  if (body.logoImage !== undefined) {
    // A small PNG, JPEG or SVG logo as a data URL. SVG is shown in an <img>, so scripts in it never run.
    if (body.logoImage && (!/^data:image\/(png|jpeg|svg\+xml);base64,/.test(body.logoImage) || body.logoImage.length > 400_000)) {
      throw new ClientError(400, 'BAD_IMAGE', 'Use a PNG, JPEG or SVG logo under 300 KB.');
    }
    b.logoImage = body.logoImage || null;
  }
  if (body.domain !== undefined) { if (body.domain && !DOMAIN.test(body.domain)) throw new ClientError(400, 'BAD_DOMAIN', 'Use a web address like clients.example.com.au.'); b.domain = body.domain || null; }
  if (body.poweredBy !== undefined) b.poweredBy = !!body.poweredBy;
  store.setBrand(id, { ...store.brand(id), ...b });
  return brandFor(id);
}

export function resetBrand(id) {
  store.setBrand(id, null);
  return brandFor(id);
}
