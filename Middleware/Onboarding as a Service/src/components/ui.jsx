import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronRight, Loader2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

/**
 * The shared design system, in the style of a CRM: a collapsible sidebar,
 * a slim top bar with breadcrumbs, full-width lists, and record pages laid
 * out as attributes | activity | related items.
 */

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '');
export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '—');
export const ago = (iso) => {
  if (!iso) return '';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDate(iso);
};
const initials = (name) => String(name || '?').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// ── shell ───────────────────────────────────────────────────────────
const SIDEBAR_KEY = 'oaas.sidebar';
const readCollapsed = () => {
  try { const v = localStorage.getItem(SIDEBAR_KEY); return v ? v === 'collapsed' : window.innerWidth < 1100; } catch { return false; }
};

/** Collapsible sidebar + content. `nav` is a list of { to, label, icon, badge, end }. */
export function Shell({ brand, nav, footer, children }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'open'); } catch { /* private mode */ }
  };
  return (
    <div className="h-full flex bg-white text-slate-900">
      <aside className={`${collapsed ? 'w-[60px]' : 'w-[232px]'} shrink-0 border-r border-slate-200 bg-[#fafafa] flex flex-col transition-[width] duration-150`}>
        <div className={`h-14 shrink-0 flex items-center border-b border-slate-200 ${collapsed ? 'justify-center' : 'pl-3 pr-2 gap-2'}`}>
          {collapsed ? (
            <button onClick={toggle} title="Expand sidebar" className="w-9 h-9 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-200/60 hover:text-slate-900">
              <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>
          ) : (
            <>
              <div className="flex-1 min-w-0 flex items-center gap-2">{brand(false)}</div>
              <button onClick={toggle} title="Collapse sidebar" className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-200/60 hover:text-slate-900 shrink-0">
                <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} title={collapsed ? n.label : undefined}
              className={({ isActive }) => `relative flex items-center gap-2.5 h-8 rounded-md text-[13px] ${collapsed ? 'justify-center' : 'px-2.5'} ${isActive ? 'bg-white text-slate-900 font-medium shadow-[0_0_0_1px_#e5e7eb]' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`}>
              {n.icon && <n.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
              {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
              {n.badge ? (collapsed
                ? <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
                : <span className="text-[11px] font-medium text-orange-700 bg-orange-100 rounded px-1.5">{n.badge}</span>) : null}
            </NavLink>
          ))}
        </nav>
        {footer && <div className="border-t border-slate-200 p-2 space-y-0.5">{footer(collapsed)}</div>}
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}

export function SideButton({ icon: Icon, children, onClick, collapsed }) {
  return (
    <button onClick={onClick} title={collapsed ? children : undefined}
      className={`w-full flex items-center gap-2.5 h-8 rounded-md text-[13px] text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 ${collapsed ? 'justify-center' : 'px-2.5'}`}>
      {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />}{!collapsed && children}
    </button>
  );
}

/** The slim bar at the top of every page: breadcrumbs on the left, actions on the right. */
export function TopBar({ crumbs, actions }) {
  return (
    <header className="h-14 shrink-0 border-b border-slate-200 px-5 flex items-center justify-between gap-4">
      <nav className="flex items-center gap-1.5 min-w-0 text-[14px]">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            {c.to ? <Link to={c.to} className="text-slate-500 hover:text-slate-900 truncate">{c.label}</Link>
              : <span className="font-medium text-slate-900 truncate">{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </header>
  );
}

/** Scrolling page body under the top bar. */
export function Body({ children, padded = true }) {
  return <div className={`flex-1 min-h-0 overflow-y-auto ${padded ? 'px-5 py-5' : ''}`}>{children}</div>;
}

// ── lists ───────────────────────────────────────────────────────────
/** View tabs with counts, plus search, above a list. */
export function ListToolbar({ views, value, onChange, search, onSearch, placeholder = 'Search' }) {
  return (
    <div className="h-12 shrink-0 px-5 border-b border-slate-200 flex items-center justify-between gap-4">
      <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {views.map(([k, label, count]) => (
          <button key={k} onClick={() => onChange(k)}
            className={`h-7 px-2.5 rounded-md text-[13px] whitespace-nowrap flex items-center gap-1.5 ${value === k ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-900'}`}>
            {label}{count != null && <span className="text-slate-400 font-normal">{count}</span>}
          </button>
        ))}
      </div>
      {onSearch && (
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder}
          className="w-56 h-8 rounded-md border border-slate-200 px-3 text-[13px] placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
      )}
    </div>
  );
}

export const th = 'h-9 px-4 text-left text-[12px] font-medium text-slate-500 border-b border-slate-200 bg-[#fafafa] whitespace-nowrap sticky top-0 z-10';
export const td = 'h-12 px-4 text-[13px] border-b border-slate-100 whitespace-nowrap';

export function Avatar({ name, kind, size = 'md' }) {
  const s = size === 'lg' ? 'w-11 h-11 text-[14px] rounded-lg' : size === 'sm' ? 'w-6 h-6 text-[10px] rounded-md' : 'w-7 h-7 text-[11px] rounded-md';
  const tone = kind === 'BUSINESS' || kind === 'ORGANIZATION' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700';
  return <span className={`${s} ${tone} font-semibold flex items-center justify-center shrink-0`}>{initials(name)}</span>;
}

// ── record pages ────────────────────────────────────────────────────
/** Attributes | main | related. Each column scrolls on its own on wide screens. */
export function RecordLayout({ left, main, right }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <aside className="lg:w-[290px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 lg:overflow-y-auto">
        {left}
        {/* Below xl the related column folds into the left one. */}
        {right && <div className="xl:hidden border-t border-slate-200">{right}</div>}
      </aside>
      <section className="flex-1 min-w-0 lg:overflow-y-auto flex flex-col">{main}</section>
      {right && <aside className="hidden xl:block w-[320px] shrink-0 border-l border-slate-200 overflow-y-auto">{right}</aside>}
    </div>
  );
}

/** A titled block inside a side panel. */
export function Panel({ title, count, action, children }) {
  return (
    <section className="px-5 py-4 border-b border-slate-200 last:border-b-0">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-semibold text-slate-500">{title}{count != null && <span className="ml-1.5 text-slate-400 font-normal">{count}</span>}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label/value attribute rows, as in a CRM record's sidebar. */
export function Attributes({ rows }) {
  return (
    <dl className="space-y-3">
      {rows.filter(Boolean).map(([label, value], i) => (
        <div key={i} className="grid grid-cols-[104px_1fr] gap-3 items-baseline">
          <dt className="text-[13px] text-slate-500">{label}</dt>
          <dd className="text-[13px] text-slate-900 min-w-0 break-words">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="h-11 px-5 border-b border-slate-200 flex items-end gap-5 overflow-x-auto [scrollbar-width:none] shrink-0">
      {tabs.map(([k, label, count]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`pb-2.5 text-[13px] whitespace-nowrap border-b-2 ${value === k ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
          {label}{count != null && <span className="ml-1 text-slate-400 font-normal">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="py-14 text-center">
      {Icon && <Icon className="mx-auto w-7 h-7 text-slate-300" strokeWidth={1.5} />}
      {title && <p className="mt-2 text-[13px] font-medium text-slate-700">{title}</p>}
      {children && <p className="mt-1 text-[13px] text-slate-500 max-w-xs mx-auto">{children}</p>}
    </div>
  );
}

export function Loading({ children = 'Loading…' }) {
  return <p className="py-12 text-[13px] text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {children}</p>;
}

/** A small dropdown anchored to a button. Items with data-close shut it. */
export function Menu({ label, children, align = 'right', className, width = 'min-w-[200px]' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={className || btn.secondary}>{label}</button>
      {open && (
        <div onClick={(e) => e.target.closest('[data-close]') && setOpen(false)}
          className={`absolute z-30 mt-1 ${align === 'right' ? 'right-0' : 'left-0'} ${width} rounded-lg border border-slate-200 bg-white shadow-lg p-1`}>
          {children}
        </div>
      )}
    </div>
  );
}
export const menuItem = 'w-full text-left flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-slate-700 hover:bg-slate-100';

// ── status ──────────────────────────────────────────────────────────
const STATUS = {
  VERIFIED: ['Verified', 'text-green-700 bg-green-50', 'bg-green-500'],
  IN_REVIEW: ['In review', 'text-amber-800 bg-amber-50', 'bg-amber-500'],
  ACTION_REQUIRED: ['Action required', 'text-orange-800 bg-orange-50', 'bg-orange-500'],
  DECLINED: ['Declined', 'text-red-700 bg-red-50', 'bg-red-500'],
};
export const statusLabel = (s) => STATUS[s]?.[0] || s;

export function StatusPill({ status }) {
  const [label, cls, dot] = STATUS[status] || [status, 'text-slate-600 bg-slate-100', 'bg-slate-400'];
  return (
    <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-[12px] font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
    </span>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-800',
    green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-700', violet: 'bg-violet-50 text-violet-700',
  };
  return <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[12px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition',
  secondary: 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition',
  ghost: 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition',
};

export const input = 'w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition';

export function Field({ label, hint, children, span = 1 }) {
  const spans = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 6: 'sm:col-span-6' };
  return (
    <label className={`block ${spans[span]}`}>
      <span className="block text-[12px] font-medium text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[12px] text-slate-400">{hint}</span>}
    </label>
  );
}
