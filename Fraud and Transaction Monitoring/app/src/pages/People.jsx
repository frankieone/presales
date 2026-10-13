import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark, UserPlus, Users, Mail, Phone, Check, Clock,
  AlertTriangle, Building2, Info, Wand2, Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRisk } from '../context/RiskContext';
import { useDraft, memberLink } from '../services/journey';
import { vertical, storageKey } from '../config';
import {
  createOrganization, createPerson, updatePerson, linkToOrganization,
  runContactChecks, isFraudFlagged,
} from '../services/entities';
import { scenarioById, nextMember } from '../services/demoData';

const card = 'bg-white rounded-xl border border-gray-200 shadow-sm';
const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

/* ── member row ────────────────────────────────────────────────── */

function MemberRow({ member, onComplete, onInvite, busyId }) {
  const [open, setOpen] = useState(false);
  const [dob, setDob] = useState('');
  const complete = Boolean(member.dateOfBirth);
  const busy = busyId === member.entityId;

  return (
    <li className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
            complete ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {member.givenName?.[0]}
          {member.familyName?.[0]}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">
              {member.givenName} {member.familyName}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {member.roleLabel}
            </span>
            {/* Neutral on purpose: the reason is for the customer's team. */}
            {member.onHold && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Under review
              </span>
            )}
            {member.inviteSent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200 inline-flex items-center gap-1">
                <Send className="w-2.5 h-2.5" /> Confirmation link sent
              </span>
            )}
            {complete ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> Details complete
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Placeholder — awaiting details
              </span>
            )}
          </div>

          <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
            {member.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {member.email}
              </span>
            )}
            {member.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" /> {member.phone}
              </span>
            )}
            {member.dateOfBirth && <span>DOB {member.dateOfBirth}</span>}
          </div>

          {member.onHold && (
            <p className="text-[11px] text-gray-500 mt-1">
              We need to review this person's details before they can verify their identity. We'll be in touch.
            </p>
          )}

          {open && !complete && (
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1 max-w-[200px]">
                <label className={labelCls} htmlFor={`dob-${member.entityId}`}>
                  Date of birth
                </label>
                <input
                  id={`dob-${member.entityId}`}
                  type="date"
                  className={input}
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
              <button
                onClick={() => onComplete(member, dob).then(() => setOpen(false))}
                disabled={!dob || busy}
                className="rounded-lg bg-primary-600 text-white px-3 py-2 text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="shrink-0 flex gap-1.5">
          {!complete && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {open ? 'Cancel' : 'Add details'}
            </button>
          )}
          {/* The applicant verified at sign-up; everyone else is asked to. */}
          {!member.isApplicant && member.entityId && !member.onHold && (
            <button
              onClick={() => onInvite(member)}
              disabled={busy}
              className="text-xs px-2.5 py-1 rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              {member.inviteSent ? 'Resend link' : 'Send confirmation link'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

/**
 * The people the primary contact adds: fund members and trustees (SMSF) or
 * directors and signatories (business banking). Each is checked on email and
 * phone as they're added; a clean one is sent a confirmation link to verify on
 * their own phone, a flagged one is held.
 */
export default function People() {
  const { people } = vertical;
  const { user } = useAuth();
  const { demoContact } = useRisk();
  const navigate = useNavigate();

  // Kept per container, so going back to the application and returning keeps
  // the structure, the company and everyone already added.
  const draftKey = user?.fundId ? storageKey(`people.${user.fundId}`) : null;
  const [structureId, setStructureId] = useDraft(draftKey && `${draftKey}.structure`, null);
  // SMSF: the trustee structure decides everyone's role. Elsewhere one role
  // applies to all and there is nothing to choose.
  const structure = people.structures
    ? (structureId ? people.structures[structureId] : null)
    : { memberRole: people.role, needsCompany: false };
  const [company, setCompany] = useDraft(draftKey && `${draftKey}.company`, { name: '', acn: '', abn: '' });
  const [companyId, setCompanyId] = useDraft(draftKey && `${draftKey}.companyId`, null);
  const [members, setMembers] = useDraft(draftKey && `${draftKey}.list`, []);
  const [draft, setDraft] = useState({ givenName: '', familyName: '', email: '', phone: '', dateOfBirth: '' });
  const [busyId, setBusyId] = useState(null);
  // The same demo scenario chosen at sign-up, so the people belong together.
  const [scenario] = useState(() => {
    let id = null;
    try { id = localStorage.getItem(storageKey('scenario')); } catch { /* private mode */ }
    return scenarioById(id);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const fundId = user?.fundId;

  // The applicant already exists — they were created and linked at sign-up.
  useEffect(() => {
    if (!fundId || !user?.userId) return;
    setMembers((m) =>
      m.length
        ? m
        : [
            {
              entityId: user.userId,
              givenName: (user.entityName || '').split(' ')[0] || 'You',
              familyName: (user.entityName || '').split(' ').slice(1).join(' '),
              roleLabel: people.applicantLabel,
              isApplicant: true,
              dateOfBirth: 'in your application',
              email: null,
              phone: null,
            },
          ],
    );
  }, [fundId, user?.userId, user?.entityName]);

  // Only offers someone not already added, so repeated clicks walk the list.
  const candidate = nextMember(scenario, members);

  const fillMember = () => {
    if (!candidate) return;
    const { email, phone } = demoContact(candidate);
    setDraft({
      givenName: candidate.givenName, familyName: candidate.familyName,
      email, phone,
      // Filled, so the member's details are checked the moment they are added.
      // Clear it to show the placeholder path: the check then runs when the
      // date of birth is supplied.
      dateOfBirth: candidate.dateOfBirth,
    });
  };

  const fillCompany = () => setCompany(scenario.company);

  const guard = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const chooseStructure = (id) =>
    guard(async () => {
      setStructureId(id);
      setMembers((m) =>
        m.map((x) =>
          x.isApplicant
            ? { ...x, roleLabel: people.structures[id].memberRole.description }
            : x,
        ),
      );
    });

  const addCompany = () =>
    guard(async () => {
      setBusy(true);
      try {
        const id = await createOrganization({
          name: company.name.toUpperCase(),
          organizationType: 'COMPANY',
          registrations: [
            { number: company.abn, type: 'ABN' },
            { number: company.acn, type: 'ACN' },
          ],
          address: { streetNumber: '12', streetName: 'COLLINS', streetType: 'STREET', locality: 'MELBOURNE', state: 'VIC', postalCode: '3000' },
        });
        await linkToOrganization(fundId, {
          entityId: id,
          entityType: 'ORGANIZATION',
          role: { code: 'TRUSTEE', description: 'Corporate Trustee' },
        });
        setCompanyId(id);
      } finally {
        setBusy(false);
      }
    });

  /**
   * The email and phone checks on a member's details. Results land on the
   * entity for the back office — never on this screen, which is the customer's.
   * Returns whether the member should be held. Unlike the device workflow, this
   * one runs without a date of birth, so placeholders are checked too.
   */
  const checkMember = async (entityId) => {
    try {
      const summary = await runContactChecks(entityId);
      console.info('[People] Fraud result:', summary);
      return isFraudFlagged(summary);
    } catch (fraudErr) {
      console.warn('[People] Fraud checks failed:', fraudErr);
      return false;
    }
  };

  /**
   * Add a person. Only a name is required — the record is created in FrankieOne
   * straight away as a placeholder, so the structure is complete and on
   * file before anyone has chased the detail. Date of birth can follow later.
   */
  const addMember = () =>
    guard(async () => {
      setBusy(true);
      try {
        const entityId = await createPerson({
          givenName: draft.givenName.toUpperCase(),
          familyName: draft.familyName.toUpperCase(),
          dateOfBirth: draft.dateOfBirth || undefined,
          email: draft.email || undefined,
          phone: draft.phone || undefined,
        });

        // Linked to the container — or, for a corporate-trustee SMSF, to the
        // trustee company as a director.
        const parentId = structure.needsCompany && companyId ? companyId : fundId;
        await linkToOrganization(parentId, {
          entityId,
          entityType: 'INDIVIDUAL',
          role: structure.memberRole,
        });

        // Check the email and phone the primary contact entered for this
        // member. A flagged member is held: no verification link, so no ID
        // capture or KYC is spent on them until the customer's team has reviewed
        // it. Their own device is captured later, if they verify by text link.
        let onHold = false;
        onHold = await checkMember(entityId);

        setMembers((m) => [
          ...m,
          {
            entityId,
            givenName: draft.givenName.toUpperCase(),
            familyName: draft.familyName.toUpperCase(),
            email: draft.email,
            phone: draft.phone,
            dateOfBirth: draft.dateOfBirth || null,
            roleLabel: structure.memberRole.description,
            onHold,
          },
        ]);
        setDraft({ givenName: '', familyName: '', email: '', phone: '', dateOfBirth: '' });
      } finally {
        setBusy(false);
      }
    });

  /** Their details came back — fill the placeholder in. */
  const completeMember = (member, dob) =>
    guard(async () => {
      setBusyId(member.entityId);
      try {
        await updatePerson(member.entityId, { dateOfBirth: dob });
        const onHold = await checkMember(member.entityId);
        setMembers((m) =>
          m.map((x) => (x.entityId === member.entityId ? { ...x, dateOfBirth: dob, onHold } : x)),
        );
      } finally {
        setBusyId(null);
      }
    });

  /**
   * Send the person their confirmation link: a page on the customer's site, on
   * their own phone, where embedded OneSDK checks their device before they take
   * an ID photo and selfie. The customer would send it by its own SMS or email —
   * FrankieOne's SMS only carries hosted links, and the hosted flow returned no
   * device data in our testing. In the demo the link is shown, with a QR code,
   * in the presenter panel (Ctrl+Shift+R).
   */
  const inviteMember = (member) => {
    const link = memberLink(member.entityId, fundId);
    console.info(`[People] Confirmation link for ${member.givenName}:`, link);
    setMembers((m) =>
      m.map((x) => (x.entityId === member.entityId ? { ...x, inviteSent: true, link } : x)),
    );
  };

  if (!fundId) {
    return (
      <div className={`${card} p-6 max-w-lg`}>
        <p className="text-sm text-gray-600">
          Nothing on this session yet. Register to start an application.
        </p>
      </div>
    );
  }

  const pending = members.filter((m) => !m.dateOfBirth).length;
  const atCapacity = members.length >= people.max;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{people.heading}</h1>
        <p className="text-sm text-gray-500 mt-1">{people.intro}</p>
      </div>

      <section className={`${card} p-4 flex items-start gap-3`}>
        <div className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center shrink-0">
          <Landmark className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{user.fundName || vertical.container?.sidebarFallback}</p>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SMSF only: the trustee structure drives every member's role */}
      {!structure && (
        <section className={`${card} p-5`}>
          <h2 className="font-semibold text-gray-900 mb-1">How is your fund set up?</h2>
          <p className="text-xs text-gray-500 mb-4">
            Every member of an SMSF must be either a trustee of the fund or a
            director of its corporate trustee. Your answer decides which.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {Object.values(people.structures || {}).map((s) => (
              <button
                key={s.id}
                onClick={() => chooseStructure(s.id)}
                className="text-left rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50/40 p-4 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {s.needsCompany ? (
                    <Building2 className="w-4 h-4 text-primary-600" />
                  ) : (
                    <Users className="w-4 h-4 text-primary-600" />
                  )}
                  <span className="font-medium text-sm text-gray-900">{s.label}</span>
                </div>
                <p className="text-xs text-gray-500">{s.blurb}</p>
                <p className="text-[11px] text-gray-400 mt-2">
                  Members become <strong>{s.memberRole.description}</strong>
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* corporate trustee, when that structure was chosen */}
      {structure?.needsCompany && !companyId && (
        <section className={`${card} p-5`}>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Your corporate trustee</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            The trustee company is registered with ASIC, so unlike the fund it does
            have an ACN.
          </p>
          <button type="button" onClick={fillCompany}
            className="mb-3 w-full rounded-lg border border-dashed border-primary-300 text-primary-700 py-2 text-xs font-medium hover:bg-primary-50 inline-flex items-center justify-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" /> Fill with {scenario.company?.name}
          </button>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className={labelCls} htmlFor="co-name">Company name</label>
              <input id="co-name" className={input} value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                placeholder="SMITH SUPER PTY LTD" />
            </div>
            <div>
              <label className={labelCls} htmlFor="co-acn">ACN</label>
              <input id="co-acn" className={input} value={company.acn}
                onChange={(e) => setCompany({ ...company, acn: e.target.value })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="co-abn">ABN</label>
              <input id="co-abn" className={input} value={company.abn}
                onChange={(e) => setCompany({ ...company, abn: e.target.value })} />
            </div>
          </div>
          <button onClick={addCompany} disabled={busy || !company.name}
            className="mt-4 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {busy ? 'Creating…' : 'Add trustee company'}
          </button>
        </section>
      )}

      {/* the people */}
      {structure && (!structure.needsCompany || companyId) && (
        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              <h2 className="font-semibold text-gray-900">{people.listTitle}</h2>
            </div>
            <span className="text-xs text-gray-400">
              {members.length} of {people.max}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">{people.listBlurb}</p>

          <ul className="mb-4">
            {members.map((m) => (
              <MemberRow key={m.entityId} member={m} onComplete={completeMember}
                onInvite={inviteMember} busyId={busyId} />
            ))}
          </ul>

          {!atCapacity && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-600">Add someone</span>
                <button type="button" onClick={fillMember} disabled={!candidate}
                  className="text-xs text-primary-700 hover:text-primary-800 disabled:text-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />
                  {candidate
                    ? `Fill with ${candidate.givenName} ${candidate.familyName}`
                    : 'All demo people added'}
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="m-given">Given name</label>
                  <input id="m-given" className={input} value={draft.givenName}
                    onChange={(e) => setDraft({ ...draft, givenName: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="m-family">Family name</label>
                  <input id="m-family" className={input} value={draft.familyName}
                    onChange={(e) => setDraft({ ...draft, familyName: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="m-email">Email</label>
                  <input id="m-email" type="email" className={input} value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="m-phone">Mobile</label>
                  <input id="m-phone" className={input} value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="m-dob">
                    Date of birth <span className="text-gray-400">(optional for now)</span>
                  </label>
                  <input id="m-dob" type="date" className={input} value={draft.dateOfBirth}
                    onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })} />
                </div>
              </div>

              <button onClick={addMember}
                disabled={busy || !draft.givenName || !draft.familyName}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                <UserPlus className="w-4 h-4" />
                {busy ? 'Adding…' : `Add ${structure?.memberRole?.description?.toLowerCase() || 'person'}`}
              </button>
            </div>
          )}

          {pending > 0 && (
            <p className="mt-3 text-xs text-gray-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary-500" />
              {pending} {pending > 1 ? 'people are' : 'person is'} still to provide details.
              We'll confirm each identity once a date of birth is supplied.
            </p>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              You can come back and add or complete members at any time.
            </p>
            <button onClick={() => navigate('/application')}
              className="text-sm font-medium text-primary-700 hover:text-primary-800">
              Back to your application →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
