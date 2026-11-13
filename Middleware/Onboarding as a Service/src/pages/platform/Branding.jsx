import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Lock, Plus, RotateCcw, Users, UserPlus } from 'lucide-react';
import { getBrands, resetBrand, saveBrand } from '../../api';
import { Avatar, BrandLogo, Field, Loading, StatusPill, TopBar, btn, input, themeStyle } from '../../components/ui';

const SWATCHES = ['#1F3A5F', '#0E9F8E', '#5B21B6', '#B91C1C', '#C2410C', '#15803D', '#0F172A', '#DB2777'];

/**
 * White labelling: each intermediary's console carries its own brand. The
 * platform sets it up here; the preview is the intermediary's console as
 * its staff see it, at its own web address.
 */
export default function Branding() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getBrands().then((d) => { setData(d); setSelected(d.brands[0].id); setDraft(d.brands[0].brand); }).catch((e) => setError(e.message));
  }, []);
  if (!data) return <><TopBar crumbs={[{ label: 'Branding' }]} />{error ? <p className="p-5 text-[13px] text-red-700">{error}</p> : <Loading />}</>;

  const current = data.brands.find((b) => b.id === selected);
  const pick = (b) => { setSelected(b.id); setDraft(b.brand); setNote(''); setError(''); };
  const set = (k) => (e) => setDraft({ ...draft, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const store = (id, brand) => setData({ ...data, brands: data.brands.map((b) => (b.id === id ? { ...b, brand } : b)) });
  const save = async () => {
    setBusy('save'); setError(''); setNote('');
    try { const b = await saveBrand(selected, draft); store(selected, b); setDraft(b); setNote('Saved. The console picks it up next time it loads.'); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const reset = async () => {
    setBusy('reset');
    try { const b = await resetBrand(selected); store(selected, b); setDraft(b); setNote('Back to the default brand.'); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const upload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 300 * 1024) { setError('Use a logo under 300 KB.'); return; }
    const r = new FileReader();
    r.onload = () => setDraft({ ...draft, logoStyle: 'image', logoImage: String(r.result) });
    r.readAsDataURL(f);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(current.brand);

  return (
    <>
      <TopBar crumbs={[{ label: 'Branding' }]} actions={
        <a href={`/?as=${selected}`} target="_blank" rel="noreferrer" className={btn.secondary}><ExternalLink className="w-4 h-4" /> Open {current.name}'s console</a>
      } />
      <div className="flex-1 min-h-0 flex">
        <ul className="w-64 shrink-0 border-r border-slate-200 overflow-y-auto py-2">
          {data.brands.map((b) => (
            <li key={b.id}>
              <button onClick={() => pick(b)} className={`w-full text-left px-4 py-3 flex items-center gap-3 ${b.id === selected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                <BrandLogo brand={b.brand} compact />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-slate-900 truncate">{b.name}</span>
                  <span className="block text-[12px] text-slate-500 truncate">{b.brand.domain || 'No custom address'}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-4 py-3 text-[12px] text-slate-400">The other 297 intermediaries use a default brand built from their name and colour.</li>
        </ul>

        <div className="w-[360px] shrink-0 border-r border-slate-200 overflow-y-auto px-5 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display name" span={2}><input className={input} value={draft.displayName || ''} onChange={set('displayName')} /></Field>
            <Field label="Tagline" span={2}><input className={input} value={draft.tagline || ''} onChange={set('tagline')} /></Field>
          </div>

          <div>
            <p className="text-[12px] font-medium text-slate-600 mb-1.5">Logo</p>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100">
              {[['monogram', 'Monogram'], ['wordmark', 'Wordmark'], ['image', 'Image']].map(([k, l]) => (
                <button key={k} onClick={() => set('logoStyle')(k)} className={`h-7 px-3 rounded-md text-[13px] ${draft.logoStyle === k ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500'}`}>{l}</button>
              ))}
            </div>
            {draft.logoStyle === 'image' && (
              <label className="mt-2 flex items-center gap-2 h-9 rounded-md border border-dashed border-slate-300 px-3 text-[13px] text-slate-500 cursor-pointer hover:border-slate-400">
                <Plus className="w-4 h-4" /> {draft.logoImage ? 'Replace logo' : 'Upload a PNG, JPEG or SVG'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={upload} className="sr-only" />
              </label>
            )}
          </div>

          <div>
            <p className="text-[12px] font-medium text-slate-600 mb-1.5">Brand colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button key={c} onClick={() => set('primary')(c)} title={c}
                  className={`w-7 h-7 rounded-full ring-offset-2 ${draft.primary?.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-slate-900' : ''}`} style={{ background: c }} />
              ))}
              <label className="relative w-7 h-7 rounded-full border border-dashed border-slate-300 flex items-center justify-center cursor-pointer" title="Custom colour">
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                <input type="color" value={draft.primary} onChange={set('primary')} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <span className="font-mono text-[12px] text-slate-500">{draft.primary}</span>
            </div>
          </div>

          <Field label="Font">
            <select className={input} value={draft.font} onChange={set('font')} style={{ fontFamily: themeStyle(draft).fontFamily }}>
              {data.fonts.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>

          <Field label="Web address" hint="The console is served at the intermediary's own address. Point the domain at the platform; no app changes are needed.">
            <input className={`${input} font-mono`} value={draft.domain || ''} onChange={set('domain')} placeholder="clients.example.com.au" />
          </Field>

          <label className="flex items-start gap-2.5 text-[13px] text-slate-700">
            <input type="checkbox" checked={!!draft.poweredBy} onChange={set('poweredBy')} className="mt-0.5 w-4 h-4 rounded border-slate-300" />
            <span>Show “Powered by {draft.platform}”<span className="block text-[12px] text-slate-500">Off makes the console fully the intermediary’s own. FrankieOne is never shown either way.</span></span>
          </label>

          <div className="pt-2 flex items-center gap-2">
            <button onClick={save} disabled={!!busy || !dirty} className={btn.primary} style={themeStyle(draft)}>{busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" />} Save brand</button>
            <button onClick={reset} disabled={!!busy} className={btn.ghost}><RotateCcw className="w-4 h-4" /> Reset</button>
          </div>
          {note && <p className="text-[13px] text-green-700">{note}</p>}
          {error && <p className="text-[13px] text-red-700">{error}</p>}
        </div>

        <div className="flex-1 min-w-0 overflow-auto bg-slate-100 p-6">
          <p className="mb-3 text-[12px] font-medium text-slate-500">Preview: what {current.name}'s staff see</p>
          <Preview brand={draft} />
        </div>
      </div>
    </>
  );
}

/** A miniature of the intermediary console in a browser window at its own address. */
function Preview({ brand }) {
  const rows = [['JAMES A TESTONE', 'Individual', 'VERIFIED', 'NG-11'], ['TESTONE FAMILY TRUST', 'Trust · 2 people', 'ACTION_REQUIRED', 'NG-1001'], ['GEOFF E TESTSEVEN', 'Individual', 'IN_REVIEW', 'NG-12']];
  return (
    <div className="max-w-[820px] rounded-xl overflow-hidden shadow-xl ring-1 ring-slate-900/10 bg-white">
      <div className="h-10 bg-slate-200/80 flex items-center gap-3 px-3">
        <span className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-amber-400" /><span className="w-3 h-3 rounded-full bg-green-400" /></span>
        <span className="flex-1 h-6 rounded-md bg-white flex items-center gap-1.5 px-2.5 text-[12px] text-slate-600">
          <Lock className="w-3 h-3 text-slate-400" /> {brand.domain || 'your-address.example.com'}
        </span>
      </div>
      <div className="flex h-[400px]" style={themeStyle(brand)}>
        <div className="w-48 shrink-0 bg-[#fafafa] border-r border-slate-200 flex flex-col">
          <div className="h-14 px-3 flex flex-col justify-center border-b border-slate-200">
            {brand.logoStyle === 'monogram'
              ? <span className="flex items-center gap-2"><BrandLogo brand={brand} size={24} /><span className="text-[13px] font-semibold text-slate-900 truncate">{brand.displayName}</span></span>
              : <BrandLogo brand={brand} size={24} />}
            {brand.tagline && <span className="mt-0.5 text-[10px] text-slate-500 truncate">{brand.tagline}</span>}
          </div>
          <div className="p-2 space-y-0.5 flex-1">
            <span className="flex items-center gap-2 h-7 px-2 rounded-md bg-brand/10 text-brand text-[12px] font-medium"><Users className="w-3.5 h-3.5" /> Clients</span>
            <span className="flex items-center gap-2 h-7 px-2 rounded-md text-slate-600 text-[12px]"><UserPlus className="w-3.5 h-3.5" /> New client</span>
          </div>
          {brand.poweredBy && <p className="px-3 pb-3 text-[10px] text-slate-400">Powered by {brand.platform}</p>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-12 px-4 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-900">Clients</span>
            <span className={btn.primary}><Plus className="w-3.5 h-3.5" /> New client</span>
          </div>
          <div className="h-10 px-4 border-b border-slate-200 flex items-center gap-1 text-[12px]">
            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-900 font-medium">All clients 3</span>
            <span className="px-2 py-1 text-slate-500">Action required 1</span>
            <span className="px-2 py-1 text-slate-500">In review 1</span>
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              {rows.map(([n, t, s, r]) => (
                <tr key={n} className="border-b border-slate-100">
                  <td className="h-11 px-4"><span className="flex items-center gap-2"><Avatar name={n} kind={t === 'Individual' ? 'INDIVIDUAL' : 'BUSINESS'} size="sm" /><span className="font-medium text-slate-900">{n}</span></span></td>
                  <td className="px-2 text-slate-500">{t}</td>
                  <td className="px-2"><StatusPill status={s} /></td>
                  <td className="px-4 font-mono text-slate-500">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
