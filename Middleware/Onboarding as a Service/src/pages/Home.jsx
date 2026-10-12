import { useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, ArrowRight, Server, Lock } from 'lucide-react';
import { setSession } from '../api';

/** Presenter start page: sign in as an intermediary, or open the platform's own view. */
export default function Home({ demo }) {
  const navigate = useNavigate();
  const asIntermediary = (im) => { setSession({ role: 'intermediary', token: im.token, id: im.id }); navigate('/console'); };
  const asPlatform = () => { setSession({ role: 'platform', token: demo.operatorToken }); navigate('/platform'); };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase">Middleware example · onboarding as a service</p>
      <h1 className="mt-2 text-3xl font-bold text-navy">{demo.platform}</h1>
      <p className="mt-3 text-slate-600 max-w-2xl">
        One FrankieOne account serves all {demo.intermediariesConfigured} intermediaries on the platform. Each intermediary
        works in its own console and only ever sees its own clients. The platform holds the FrankieOne key, recognises
        investors already on the network, and builds every response from a fixed list of permitted fields.
      </p>

      <h2 className="mt-10 text-sm font-semibold text-slate-500 uppercase tracking-wide">How it works</h2>
      <div className="mt-3 grid md:grid-cols-[1fr_auto_1.3fr_auto_1fr] gap-3 items-stretch">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <Building2 className="w-5 h-5 text-slate-500" />
          <p className="mt-2 font-semibold text-slate-900">Intermediaries</p>
          <p className="text-sm text-slate-600">Advisers and brokers onboard their clients (individuals, or businesses and the people behind them) in their own console, or from their own systems through the platform's API.</p>
          <p className="mt-2 text-xs text-slate-400">Each sees only its own clients.</p>
        </div>
        <ArrowRight className="hidden md:block self-center w-5 h-5 text-slate-300" />
        <div className="bg-navy text-white rounded-xl p-4">
          <Server className="w-5 h-5 text-brand" />
          <p className="mt-2 font-semibold">{demo.platform}: the middleware</p>
          <ul className="mt-1 text-sm text-slate-300 space-y-1 list-disc pl-4">
            <li>Holds the only FrankieOne API key</li>
            <li>Recognises an investor another intermediary already has, and keeps one record for them</li>
            <li>Runs each intermediary's own checks</li>
            <li>Replies with a fixed set of fields, and logs what each intermediary saw</li>
          </ul>
        </div>
        <ArrowRight className="hidden md:block self-center w-5 h-5 text-slate-300" />
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <Lock className="w-5 h-5 text-slate-500" />
          <p className="mt-2 font-semibold text-slate-900">One FrankieOne account</p>
          <p className="text-sm text-slate-600">One record per investor, with a reference for each intermediary that holds them, and one verification per onboarding.</p>
          <p className="mt-2 text-xs text-slate-400">The platform's compliance team works cases in the FrankieOne Portal.</p>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr><th className="text-left px-4 py-2">Who</th><th className="text-left px-4 py-2">Sees</th><th className="text-left px-4 py-2">Never sees</th></tr>
          </thead>
          <tbody className="text-slate-600">
            <tr className="border-t border-slate-100"><td className="px-4 py-2 font-medium text-slate-800">An intermediary</td><td className="px-4 py-2">Its own clients: status, risk band, actions, its own reference</td><td className="px-4 py-2">FrankieOne, other intermediaries, whether a client is held elsewhere, scores, data sources</td></tr>
            <tr className="border-t border-slate-100"><td className="px-4 py-2 font-medium text-slate-800">The platform</td><td className="px-4 py-2">Every investor across the network, every relationship, what each intermediary was shown</td><td className="px-4 py-2">—</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-slate-500 uppercase tracking-wide">Sign in as an intermediary</h2>
      <div className="mt-3 grid sm:grid-cols-3 gap-4">
        {demo.intermediaries.map((im) => (
          <button key={im.id} onClick={() => asIntermediary(im)}
            className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 hover:shadow-sm transition">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: im.colour }}>
              <Building2 className="w-5 h-5" />
            </span>
            <p className="mt-3 font-semibold text-slate-900">{im.name}</p>
            <p className="text-sm text-slate-500">{im.kind}</p>
            <p className="mt-2 text-xs text-slate-400">Workflow: {im.workflow}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">Tip: open a second browser tab and sign in as a different intermediary, to show them side by side. Keep a third tab on the platform view to narrate what happens behind each submission.</p>

      <h2 className="mt-10 text-sm font-semibold text-slate-500 uppercase tracking-wide">The platform's own view</h2>
      <button onClick={asPlatform}
        className="mt-3 w-full text-left bg-navy text-white rounded-xl p-5 flex items-center justify-between hover:opacity-95">
        <span className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-brand" />
          <span>
            <span className="block font-semibold">Platform operations and compliance</span>
            <span className="block text-sm text-slate-300">One record per investor across every intermediary, and what each intermediary was shown. Never visible to intermediaries.</span>
          </span>
        </span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
