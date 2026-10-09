import { ENV_LABEL, vertical } from '../config';

/**
 * Always-on strip at the top of every screen, so anyone watching knows which
 * FrankieOne account and environment the demo is calling, and that the brand
 * is a placeholder. Fixed and 1.5rem tall; App pads the page by the same.
 */
export default function EnvBanner() {
  return (
    <div className="fixed top-0 inset-x-0 z-[60] h-6 bg-amber-400 text-amber-950 text-[11px] sm:text-xs px-3 flex items-center justify-center font-medium truncate">
      <span className="truncate">
        Connected to <strong>{ENV_LABEL}</strong>
        <span className="hidden sm:inline"> · Demo — {vertical.brand.name} is placeholder branding</span>
      </span>
    </div>
  );
}
