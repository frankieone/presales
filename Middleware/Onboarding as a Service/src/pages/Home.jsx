import { useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, ArrowRight } from 'lucide-react';
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
      <p className="mt-2 text-xs text-slate-500">Tip: open a second browser tab and sign in as a different intermediary, to show them side by side.</p>

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
