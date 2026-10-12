import { NavLink } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * The small design system both consoles share: an app shell with a sidebar,
 * page headers, cards, status pills, tabs and empty states. Spacing and type
 * live here so the pages stay consistent.
 */

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '');
export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '—');
export const ago = (iso) => {
  if (!iso) return '';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(iso);
};

// ── shell ───────────────────────────────────────────────────────────
/**
 * Sidebar + content. `brand` is the block at the top of the sidebar, `nav`
 * a list of { to, label, icon, badge, end }, `footer` anything under it.
 */
export function Shell({ brand, nav, footer, dark, children }) {
  return (
    <div className="min-h-[calc(100vh-1.5rem)] flex">
      <aside className={`hidden lg:flex w-64 shrink-0 flex-col border-r ${dark ? 'bg-navy text-slate-300 border-navy' : 'bg-white text-slate-600 border-slate-200'}`}>
        <div className="sticky top-6 flex flex-col h-[calc(100vh-1.5rem)]">
          <div className="px-5 pt-6 pb-5">{brand}</div>
          <nav className="px-3 space-y-0.5 flex-1">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition ${isActive
                  ? dark ? 'bg-white/10 text-white font-medium' : 'bg-slate-100 text-slate-900 font-medium'
                  : dark ? 'hover:bg-white/5 hover:text-white' : 'hover:bg-slate-50 hover:text-slate-900'}`}>
                {n.icon && <n.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />}
                <span className="flex-1">{n.label}</span>
                {n.badge ? <span className="text-[11px] font-semibold min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center">{n.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
          {footer && <div className={`px-3 py-4 border-t ${dark ? 'border-white/10' : 'border-slate-100'}`}>{footer}</div>}
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {/* Compact bar for narrower screens: brand, sections and a menu for the sidebar's footer */}
        <div className={`lg:hidden sticky top-6 z-30 border-b ${dark ? 'bg-navy border-navy' : 'bg-white border-slate-200'}`}>
          <div className="px-4 pt-3 flex items-center justify-between gap-3">
            <div className="min-w-0 [&_p]:truncate">{brand}</div>
            {footer && (
              <details className="relative">
                <summary className={`list-none cursor-pointer px-3 py-1.5 rounded-lg text-sm ${dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>Menu</summary>
                <div className={`absolute right-0 mt-2 w-56 rounded-xl border p-2 shadow-lg ${dark ? 'bg-navy border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>{footer}</div>
              </details>
            )}
          </div>
          <nav className="px-4 py-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${isActive ? 'bg-brand text-white' : dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>
                {n.label}{n.badge ? ` (${n.badge})` : ''}
              </NavLink>
            ))}
          </nav>
        </div>
        <main className="px-5 md:px-8 lg:px-10 py-8 lg:py-10 max-w-[1240px]">{children}</main>
      </div>
    </div>
  );
}

export function SideButton({ icon: Icon, children, onClick, dark }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] ${dark ? 'hover:bg-white/5 hover:text-white' : 'hover:bg-slate-50 hover:text-slate-900'}`}>
      {Icon && <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />} {children}
    </button>
  );
}

// ── page structure ──────────────────────────────────────────────────
export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="mb-8">
      {eyebrow && <div className="mb-3">{eyebrow}</div>}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-2 text-[15px] text-slate-500 max-w-2xl">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, description, actions, children, padded = true, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {(title || actions) && (
        <header className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-slate-100">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-6' : ''}>{children}</div>
    </section>
  );
}

export function Section({ title, description, actions, children, className = '' }) {
  return (
    <section className={`mt-10 first:mt-0 ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500 max-w-2xl">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone, hint }) {
  const tones = { amber: 'text-amber-600', green: 'text-green-600', red: 'text-red-600', brand: 'text-brand' };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 px-5 py-4">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className={`mt-1 text-[28px] font-semibold tracking-tight ${tones[tone] || 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Label/value rows for a details card. */
export function Details({ rows }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.filter(Boolean).map(([label, value], i) => (
        <div key={i} className="py-3 first:pt-0 last:pb-0 flex items-baseline justify-between gap-4">
          <dt className="text-sm text-slate-500">{label}</dt>
          <dd className="text-sm text-slate-900 text-right min-w-0 break-words">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-6 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_#e2e8f0] [scrollbar-width:none]">
      {tabs.map(([k, label, count]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`pb-3 text-[14px] whitespace-nowrap border-b-2 transition ${value === k ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          {label}{count != null && <span className="ml-1.5 text-xs text-slate-400">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="py-12 text-center">
      {Icon && <Icon className="mx-auto w-8 h-8 text-slate-300" strokeWidth={1.5} />}
      {title && <p className="mt-3 text-[15px] font-medium text-slate-700">{title}</p>}
      {children && <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{children}</p>}
    </div>
  );
}

export function Loading({ children = 'Loading…' }) {
  return <p className="py-10 text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {children}</p>;
}

export function Callout({ icon: Icon, tone = 'slate', children }) {
  const tones = { slate: 'bg-slate-50 border-slate-200 text-slate-700', amber: 'bg-amber-50 border-amber-200 text-amber-900', blue: 'bg-blue-50/60 border-blue-100 text-slate-700' };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex gap-3 ${tones[tone]}`}>
      {Icon && <Icon className="w-[18px] h-[18px] shrink-0 mt-0.5 opacity-70" strokeWidth={1.75} />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ── status ──────────────────────────────────────────────────────────
const STATUS = {
  VERIFIED: ['Verified', 'bg-green-50 text-green-700 ring-green-600/15', 'bg-green-500'],
  IN_REVIEW: ['In review', 'bg-amber-50 text-amber-800 ring-amber-600/20', 'bg-amber-500'],
  ACTION_REQUIRED: ['Action required', 'bg-orange-50 text-orange-800 ring-orange-600/20', 'bg-orange-500'],
  DECLINED: ['Declined', 'bg-red-50 text-red-700 ring-red-600/15', 'bg-red-500'],
};
export const statusLabel = (s) => STATUS[s]?.[0] || s;

export function StatusPill({ status }) {
  const [label, cls, dot] = STATUS[status] || [status, 'bg-slate-50 text-slate-600 ring-slate-500/15', 'bg-slate-400'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
    </span>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-800',
    green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-700', violet: 'bg-violet-50 text-violet-700',
  };
  return <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition',
  secondary: 'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition',
  ghost: 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition',
};

export const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition';

export function Field({ label, hint, children, span = 1 }) {
  const spans = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 6: 'sm:col-span-6' };
  return (
    <label className={`block ${spans[span]}`}>
      <span className="block text-[13px] font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1.5 text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
