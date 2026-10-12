import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Check, Lock, Server, ShieldCheck, X } from 'lucide-react';
import { setSession } from '../api';

/** Presenter start page: sign in as an intermediary, or open the platform's own view. */
export default function Home({ demo }) {
  const navigate = useNavigate();
  const asIntermediary = (im) => { setSession({ role: 'intermediary', token: im.token, id: im.id }); navigate('/console'); };
  const asPlatform = () => { setSession({ role: 'platform', token: demo.operatorToken }); navigate('/platform'); };

  const steps = [
    { icon: Building2, title: 'Intermediaries', text: 'Advisers and brokers onboard clients, individuals or businesses, in their own console or through the API.', note: 'Each sees only its own clients.' },
    { icon: Server, title: `${demo.platform}`, text: 'Holds the only FrankieOne key, recognises people already on the network, runs each intermediary’s checks and replies with a fixed set of fields.', note: 'The middleware.', dark: true },
    { icon: Lock, title: 'One FrankieOne account', text: 'One record per person or business, a reference for each intermediary that holds them, and every verification and document.', note: 'Compliance works cases in the Portal.' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <p className="text-[13px] font-semibold tracking-wide text-brand">Middleware example · onboarding as a service</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{demo.platform}</h1>
      <p className="mt-4 text-lg text-slate-600 max-w-2xl leading-relaxed">
        One FrankieOne account serving all {demo.intermediariesConfigured} intermediaries on the platform. Each intermediary only ever sees its own clients.
      </p>

      <div className="mt-12 grid md:grid-cols-3 gap-4">
        {steps.map((s, i) => (
          <div key={i} className={`relative rounded-2xl p-6 ${s.dark ? 'bg-navy text-white' : 'bg-white border border-slate-200/80'}`}>
            <s.icon className={`w-6 h-6 ${s.dark ? 'text-brand' : 'text-slate-400'}`} strokeWidth={1.75} />
            <p className={`mt-4 text-[15px] font-semibold ${s.dark ? 'text-white' : 'text-slate-900'}`}>{s.title}</p>
            <p className={`mt-2 text-sm leading-relaxed ${s.dark ? 'text-slate-300' : 'text-slate-600'}`}>{s.text}</p>
            <p className={`mt-4 text-xs ${s.dark ? 'text-slate-400' : 'text-slate-500'}`}>{s.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6">
          <p className="text-[15px] font-semibold text-slate-900">An intermediary sees</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {['Its own clients, under its own reference', 'Status, risk band and what to do next', 'Its own verifications, documents and history'].map((t) => (
              <li key={t} className="flex gap-2.5"><Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />{t}</li>
            ))}
            {['FrankieOne, or other intermediaries', 'Whether a client is held elsewhere', 'Scores and data sources'].map((t) => (
              <li key={t} className="flex gap-2.5 text-slate-500"><X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6">
          <p className="text-[15px] font-semibold text-slate-900">The platform sees</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {['Every record across the network', 'Every relationship, and which intermediary each check was for', 'Possible duplicates to decide, and every merge', 'What each intermediary was shown, and when'].map((t) => (
              <li key={t} className="flex gap-2.5"><Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="mt-16 text-xl font-semibold text-slate-900">Sign in as an intermediary</h2>
      <p className="mt-1 text-sm text-slate-500">Open a second tab as a different intermediary to show them side by side.</p>
      <div className="mt-5 grid sm:grid-cols-3 gap-4">
        {demo.intermediaries.map((im) => (
          <button key={im.id} onClick={() => asIntermediary(im)}
            className="group text-left bg-white rounded-2xl border border-slate-200/80 p-6 hover:border-slate-300 hover:shadow-md transition">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: im.colour }}>
              <Building2 className="w-5 h-5" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-slate-900">{im.name}</p>
            <p className="text-sm text-slate-500">{im.kind}</p>
            <p className="mt-4 text-xs font-mono text-slate-400">{im.workflow}</p>
          </button>
        ))}
      </div>

      <button onClick={asPlatform}
        className="mt-6 w-full text-left bg-navy text-white rounded-2xl p-6 flex items-center justify-between gap-6 hover:opacity-95 transition">
        <span className="flex items-center gap-4">
          <span className="w-11 h-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0"><ShieldCheck className="w-6 h-6" /></span>
          <span>
            <span className="block text-[15px] font-semibold">Platform operations and compliance</span>
            <span className="block mt-0.5 text-sm text-slate-300">Every record, relationship and decision across the network. Never visible to intermediaries.</span>
          </span>
        </span>
        <ArrowRight className="w-5 h-5 shrink-0" />
      </button>
    </div>
  );
}
