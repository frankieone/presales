import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, Users, Building2, ShieldCheck, AlertTriangle, Clock, Check,
  Loader2, RefreshCw, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loadStructure, loadChecks } from '../services/entities';
import { PENDING_FUND_NAME, readRegistration } from '../services/journey';
import { vertical } from '../config';

const card = 'bg-white rounded-xl border border-gray-200 shadow-sm';

/* ── onboarding progress ───────────────────────────────────────── */

function Stat({ icon: Icon, label, value, tone = 'default', hint }) {
  const tones = {
    default: 'bg-gray-50 text-gray-600',
    good: 'bg-green-50 text-green-700',
    warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function EntityRow({ node, level, checks }) {
  const isOrg = node.entityType === 'ORGANIZATION';
  const Icon = level === 0 ? Landmark : isOrg ? Building2 : Users;

  // A person without a date of birth is a placeholder — there is nothing for an
  // identity check to match on yet.
  const placeholder = !isOrg && !node.dateOfBirth;
  const verified = !isOrg && checks[node.entityId]?.kyc === 'PASS';

  return (
    <>
      <div
        className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0"
        style={{ paddingLeft: level * 18 }}
      >
        <div
          className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
            level === 0 ? 'bg-primary-600 text-white' : isOrg ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">
              {level === 0 && node.name === PENDING_FUND_NAME ? vertical.container?.pendingLabel : node.name}
            </span>
            {node.roles?.map((r) => (
              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{r}</span>
            ))}
            {placeholder && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Awaiting details
              </span>
            )}
            {verified && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> Identity verified
              </span>
            )}
          </div>
        </div>
      </div>

      {node.children?.map((c) => (
        <EntityRow
          key={`${c.entityType}-${c.entityId}`}
          node={c}
          level={level + 1}
          checks={checks}
        />
      ))}
    </>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

function flatten(node, out = []) {
  if (!node) return out;
  out.push(node);
  (node.children || []).forEach((c) => flatten(c, out));
  return out;
}

/** Super has no container: just the member's own application. */
function MembershipSummary() {
  const reg = readRegistration();
  return (
    <div className="max-w-xl bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h1 className="text-2xl font-bold text-gray-900">{vertical.overview.title}</h1>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <dt className="text-gray-500">Member</dt><dd className="text-gray-900 font-medium">{reg?.fullName}</dd>
        <dt className="text-gray-500">Reference</dt><dd className="text-gray-900">{reg?.applicationId}</dd>
        <dt className="text-gray-500">Status</dt>
        <dd className="text-gray-900">{reg?.submitted ? 'Being set up' : 'Application in progress'}</dd>
      </dl>
      {!reg?.submitted && (
        <Link to="/application" className="mt-5 inline-block text-sm font-medium text-primary-700">Continue your application →</Link>
      )}
    </div>
  );
}

export default function Overview() {
  if (!vertical.container) return <MembershipSummary />;
  return <ContainerOverview />;
}

function ContainerOverview() {
  const { user } = useAuth();
  const [tree, setTree] = useState(null);
  const [checks, setChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fundId = user?.fundId;

  const refresh = useCallback(async () => {
    if (!fundId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const t = await loadStructure(fundId);
      setTree(t);

      // Pull any checks that have already run, so a reload doesn't look like
      // nothing has ever been verified.
      const existing = {};
      await Promise.all(
        flatten(t).map(async (n) => {
          const c = await loadChecks(n.entityId, n.entityType).catch(() => null);
          if (c) existing[n.entityId] = c;
        }),
      );
      setChecks((prev) => ({ ...existing, ...prev }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fundId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!fundId) {
    return (
      <div className={`${card} p-6 max-w-lg`}>
        <h1 className="font-semibold text-gray-900 mb-1">Nothing on this session yet</h1>
        <p className="text-sm text-gray-600">
          Register to start an application.
        </p>
      </div>
    );
  }

  const all = flatten(tree);
  const people = all.filter((n) => n.entityType === 'INDIVIDUAL');
  const companies = all.filter((n) => n.entityType === 'ORGANIZATION' && n !== tree);
  const awaiting = people.filter((p) => !p.dateOfBirth).length;
  const verified = people.filter((p) => checks[p.entityId]?.kyc === 'PASS').length;
  const fundReg = tree?.registrations || [];

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.fundName || vertical.container.sidebarFallback}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {fundReg.length
              ? fundReg.map((r) => `${r.type} ${r.number}`).join(' · ')
              : 'No registration number recorded yet'}
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1.5 shrink-0 mt-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat icon={Users} label={vertical.people.navLabel} value={people.length} hint={`maximum of ${vertical.people.max}`} />
        <Stat
          icon={Clock}
          label="Awaiting details"
          value={awaiting}
          tone={awaiting ? 'warn' : 'good'}
          hint={awaiting ? 'held as placeholders' : 'all details in'}
        />
        <Stat
          icon={ShieldCheck}
          label="Identity verified"
          value={`${verified}/${people.length}`}
          tone={verified === people.length && people.length ? 'good' : 'default'}
        />
        <Stat icon={Building2} label="Companies" value={companies.length} hint={companies.length ? 'linked companies' : 'none linked'} />
      </div>

      {/* onboarding is the real work here, not a balance */}
      {awaiting > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              {awaiting} {awaiting > 1 ? 'people' : 'person'} still to provide details
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Each identity can be confirmed once a date of birth is
              provided.
            </p>
          </div>
          <Link
            to="/people"
            className="shrink-0 text-xs font-medium text-amber-900 hover:text-amber-950 inline-flex items-center gap-1"
          >
            Collect details <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-gray-900">{vertical.overview.structureTitle}</h2>
          </div>
          <Link to="/people" className="text-xs font-medium text-primary-700 hover:text-primary-800">
            Manage {vertical.people.navLabel.toLowerCase()}
          </Link>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {vertical.overview.structureBlurb}
        </p>

        {loading && !tree ? (
          <div className="py-8 text-center text-sm text-gray-400 inline-flex items-center gap-2 w-full justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : tree ? (
          <div>
            <EntityRow node={tree} level={0} checks={checks} />
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4">Nothing on record yet.</p>
        )}
      </section>
    </div>
  );
}
