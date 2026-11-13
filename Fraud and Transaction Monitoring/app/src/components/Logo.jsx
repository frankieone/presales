import { vertical } from '../config';

/**
 * Placeholder wordmark: a lettered square and the brand name. Swap this for a
 * customer's real logo when tailoring a demo.
 */
export default function Logo({ tone = 'dark', size = 'md' }) {
  const text = tone === 'light' ? 'text-white' : 'text-gray-900';
  const box = size === 'lg' ? 'w-10 h-10 text-lg' : size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  const name = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${box} rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center`}>
        {vertical.brand.mark}
      </span>
      <span className={`${name} font-bold tracking-tight ${text}`}>{vertical.brand.name}</span>
    </span>
  );
}
