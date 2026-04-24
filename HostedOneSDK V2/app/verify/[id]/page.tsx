'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface SessionData {
  id: string;
  hostedUrl: string;
  urlExpiry: string;
  status: string;
}

type Phase = 'loading' | 'expired' | 'not_found' | 'pre' | 'doc_choice' | 'alt_doc_choice' | 'alt_doc_state' | 'alt_doc_upload' | 'alt_doc_form' | 'alt_personal' | 'idv_info' | 'idv_consent' | 'idv' | 'post' | 'complete';

type AltDocType = 'medicare' | 'birth_cert' | null;

const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

const OCCUPATIONS = [
  'Accountant', 'Architect', 'Business Owner', 'Consultant', 'Designer',
  'Doctor', 'Engineer', 'Farmer', 'Financial Advisor', 'Government Employee',
  'Lawyer', 'Manager', 'Nurse', 'Real Estate Agent', 'Retired',
  'Sales Professional', 'Student', 'Teacher', 'Tradesperson', 'Other',
];

const SOURCE_OF_FUNDS = [
  'Employment / Salary',
  'Business Income',
  'Investments',
  'Inheritance',
  'Savings',
  'Government Benefits',
  'Other',
];

const CITIZENSHIP_OPTIONS = [
  'Australian Citizen',
  'Permanent Resident',
  'Temporary Visa Holder',
  'New Zealand Citizen',
  'Other',
];

const POST_QUESTIONS = [
  {
    key: 'experience',
    title: 'How was that?',
    subtitle: 'Rate your verification experience.',
    type: 'options' as const,
    options: ['Very easy', 'Easy', 'Neutral', 'Difficult'],
  },
  {
    key: 'additional_products',
    title: 'One more thing',
    subtitle: 'Are you interested in any additional products?',
    type: 'options' as const,
    options: ['Credit card', 'Business loan', 'Insurance', 'Not at this time'],
  },
  {
    key: 'communication',
    title: 'How should we reach you?',
    subtitle: 'Select your preferred communication method.',
    type: 'options' as const,
    options: ['Email', 'SMS', 'Phone call', 'App notifications'],
  },
];


function OccupationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = OCCUPATIONS.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base transition-all flex items-center justify-between ${
          value
            ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
            : 'border-gray-100 text-gray-400'
        }`}
      >
        <span>{value || 'Select your occupation'}</span>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border-2 border-gray-100 shadow-lg z-10 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-brand-600 transition-colors placeholder:text-gray-300"
            />
          </div>
          <div className="max-h-64 overflow-y-auto px-2 pb-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-3">No results</p>
            ) : (
              filtered.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => { onChange(occ); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-colors ${
                    value === occ
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-700 active:bg-gray-50'
                  }`}
                >
                  {occ}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [preSlide, setPreSlide] = useState(0); // 0-3 for the 4 pre-questions
  const [postSlide, setPostSlide] = useState(0); // 0-2 for the 3 post-questions
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Alt flow state
  const [altDocType, setAltDocType] = useState<AltDocType>(null);
  const [altState, setAltState] = useState('');
  const [altPhoto, setAltPhoto] = useState<string | null>(null); // base64
  const [altPhotoPreview, setAltPhotoPreview] = useState<string | null>(null);
  const [altDocFields, setAltDocFields] = useState<Record<string, string>>({});
  const [altPersonal, setAltPersonal] = useState<Record<string, string>>({});
  const [checkResult, setCheckResult] = useState<'pass' | 'fail' | 'review' | null>(null);

  useEffect(() => {
    fetch(`/api/session/${sessionId}`)
      .then((res) => {
        if (res.status === 404) { setPhase('not_found'); return null; }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setSession(data);
        if (new Date(data.urlExpiry) < new Date()) {
          setPhase('expired');
        } else if (data.status === 'complete') {
          setPhase('complete');
        } else if (data.status === 'idv_complete') {
          setPhase('post');
        } else if (data.status === 'pre_complete') {
          setPhase('doc_choice');
        } else {
          setPhase('pre');
        }
      })
      .catch(() => setPhase('not_found'));
  }, [sessionId]);

  const handleIframeMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'frankieone:complete' ||
        event.data?.type === 'onesdk:complete' ||
        event.data === 'onesdk:complete') {
      fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'idv_complete' }),
      }).then(() => {
        setTimeout(() => setPhase('post'), 2000);
      });
    }
  }, [sessionId]);

  useEffect(() => {
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [handleIframeMessage]);

  function setAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function advancePreSlide(overrideAnswers?: Record<string, string>) {
    if (preSlide < 3) {
      setPreSlide(preSlide + 1);
    } else {
      setSubmitting(true);
      await fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAnswers: overrideAnswers ?? answers }),
      });
      setPhase('doc_choice');
      setSubmitting(false);
    }
  }

  async function advancePostSlide(overrideAnswers?: Record<string, string>) {
    if (postSlide < POST_QUESTIONS.length - 1) {
      setPostSlide(postSlide + 1);
    } else {
      setSubmitting(true);
      const src = overrideAnswers ?? answers;
      const postAnswers: Record<string, string> = {};
      POST_QUESTIONS.forEach((q) => { postAnswers[q.key] = src[q.key]; });
      await fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postAnswers }),
      });
      setPhase('complete');
      setSubmitting(false);
    }
  }

  function selectAndAdvancePre(key: string, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    advancePreSlide(next);
  }

  function selectAndAdvancePost(key: string, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    advancePostSlide(next);
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAltPhotoPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get raw base64
      setAltPhoto(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }

  function setAltDocField(key: string, value: string) {
    setAltDocFields((prev) => ({ ...prev, [key]: value }));
  }

  function setAltPersonalField(key: string, value: string) {
    setAltPersonal((prev) => ({ ...prev, [key]: value }));
  }

  function autoFillTestData() {
    if (altDocType === 'birth_cert') {
      setAltState('WA');
      setAltDocFields({
        registrationNumber: '146612361',
        certificateNumber: '87654321',
        registrationDate: '1972-01-19',
        dateOfPrint: '1999-12-31',
      });
      setAltPersonal({
        givenName: 'Stacy',
        middleName: 'S',
        familyName: 'Testthirty',
        dateOfBirth: '1979-01-01',
        streetNumber: '11',
        streetName: 'Station',
        streetType: 'Street',
        locality: 'Yarloop',
        subdivision: 'WA',
        postalCode: '6218',
      });
      return;
    }
    setAltDocFields({
      cardNumber: '6603984391',
      cardType: 'G',
      reference: '1',
      expiryDate: '2030-01',
      middleNameOnCard: 'A',
    });
    setAltPersonal({
      givenName: 'James',
      middleName: 'A',
      familyName: 'Testone',
      dateOfBirth: '1950-01-01',
      streetNumber: 'U 1/35',
      streetName: 'Conn',
      streetType: 'Street',
      locality: 'Ferntree Gully',
      subdivision: 'VIC',
      postalCode: '3156',
    });
  }

  async function submitAltFlow() {
    setSubmitting(true);
    try {
      const personal = {
        givenName: altPersonal.givenName || '',
        middleName: altPersonal.middleName || '',
        familyName: altPersonal.familyName || '',
        dateOfBirth: altPersonal.dateOfBirth || '',
        streetNumber: altPersonal.streetNumber || '',
        streetName: altPersonal.streetName || '',
        streetType: altPersonal.streetType || '',
        locality: altPersonal.locality || '',
        subdivision: altPersonal.subdivision || '',
        postalCode: altPersonal.postalCode || '',
      };

      let document: Record<string, unknown>;
      if (altDocType === 'medicare') {
        document = {
          type: 'NATIONAL_HEALTH_ID',
          cardNumber: altDocFields.cardNumber || '',
          cardType: altDocFields.cardType || 'G',
          subdivision: altState,
          expiryDate: (altDocFields.expiryDate || '') + (altDocFields.expiryDate?.length === 7 ? '-01' : ''),
          reference: altDocFields.reference || '',
          middleNameOnCard: altDocFields.middleNameOnCard || '',
          attachmentBase64: altPhoto || undefined,
        };
      } else {
        document = {
          type: 'BIRTH_CERT',
          registrationNumber: altDocFields.registrationNumber || '',
          certificateNumber: altDocFields.certificateNumber || '',
          subdivision: altState,
          registrationDate: altDocFields.registrationDate || '',
          dateOfPrint: altDocFields.dateOfPrint || '',
          attachmentBase64: altPhoto || undefined,
        };
      }

      const payload = {
        sessionId,
        personal,
        document,
        workflowName: 'AUS-Basic2V-TwoPlus',
      };
      console.log('Submitting payload:', JSON.stringify(payload, (k, v) => k === 'attachmentBase64' && v ? `<${v.length} chars>` : v, 2));

      const res = await fetch('/api/create-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        // Extract check result from workflow response
        // Response structure: data.workflowResult.workflowResult.status (PASS/FAIL/REVIEW)
        const wr = data.workflowResult;
        const status = wr?.workflowResult?.status || wr?.status;
        if (status) {
          const upper = (typeof status === 'string' ? status : '').toUpperCase();
          if (upper === 'PASS' || upper === 'CLEAR') setCheckResult('pass');
          else if (upper === 'FAIL') setCheckResult('fail');
          else if (upper === 'REVIEW' || upper === 'INCOMPLETE') setCheckResult('review');
        }
        console.log('[Workflow Result]', JSON.stringify(wr, null, 2));
        setPhase('post');
      } else {
        console.error('Create entity failed:', JSON.stringify(data, null, 2));
        alert(`Verification failed: ${data.error || 'Unknown error'}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function markIdvComplete() {
    fetch(`/api/session/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'idv_complete' }),
    }).then(() => {
      setTimeout(() => setPhase('post'), 2000);
    });
  }

  // Progress calculation
  const isAltFlow = altDocType !== null;
  const ALT_TOTAL = 14; // 4 pre + doc_choice + alt_doc_choice + state + upload + form + personal + 3 post + complete
  const IDV_TOTAL = 11; // 4 pre + doc_choice + info + consent + idv + 3 post + complete
  const totalSlides = isAltFlow ? ALT_TOTAL : IDV_TOTAL;

  const currentSlide =
    phase === 'pre' ? preSlide + 1 :
    phase === 'doc_choice' ? 5 :
    // IDV path
    phase === 'idv_info' ? 6 :
    phase === 'idv_consent' ? 7 :
    phase === 'idv' ? 8 :
    // Alt path
    phase === 'alt_doc_choice' ? 6 :
    phase === 'alt_doc_state' ? 7 :
    phase === 'alt_doc_upload' ? 8 :
    phase === 'alt_doc_form' ? 9 :
    phase === 'alt_personal' ? 10 :
    // Shared
    phase === 'post' ? (totalSlides - 3) + postSlide :
    phase === 'complete' ? totalSlides : 0;

  const progressPercent = totalSlides > 0 ? (currentSlide / totalSlides) * 100 : 0;

  // --- Status screens ---

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white gap-6">
        <div className="flex items-center gap-2.5">
          <img src="/seahorse.png" alt="ACME Ltd" className="w-10 h-10 object-contain" />
          <span className="text-lg font-bold text-brand-900">ACME Ltd</span>
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-100 border-t-brand-600" />
      </div>
    );
  }

  if (phase === 'not_found') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link not found</h1>
          <p className="text-gray-500 text-sm">This verification link is invalid or has already been used.</p>
        </div>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired</h1>
          <p className="text-gray-500 text-sm">This verification link has expired. Please request a new one.</p>
        </div>
      </div>
    );
  }

  // --- Main flow ---

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Brand header — hidden during IDV */}
      {phase !== 'idv' && (
        <div className="shrink-0 px-6 pt-6 pb-4 flex items-center gap-2.5">
          <img src="/seahorse.png" alt="ACME Ltd" className="w-8 h-8 object-contain" />
          <span className="text-sm font-bold text-brand-900">ACME Ltd</span>
        </div>
      )}

      {/* Progress bar — hidden during IDV */}
      {phase !== 'idv' && (
        <div className="h-1 bg-gray-100 shrink-0">
          <div
            className="h-full bg-brand-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Pre-IDV slides */}
      {phase === 'pre' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          {/* Slide 0: First name */}
          {preSlide === 0 && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-600 mb-2">Step 1 of 4</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Please confirm your first name
                </h1>
                <p className="text-gray-500 text-sm mb-8">
                  We&apos;ll use this throughout your verification.
                </p>
                <input
                  type="text"
                  value={answers.first_name || ''}
                  onChange={(e) => setAnswer('first_name', e.target.value)}
                  placeholder="Enter your first name"
                  autoFocus
                  className="w-full text-lg px-4 py-4 border-b-2 border-gray-200 focus:border-brand-600 outline-none transition-colors bg-transparent placeholder:text-gray-300"
                />
              </div>
              <button
                onClick={() => advancePreSlide()}
                disabled={!answers.first_name?.trim()}
                className="w-full py-4 sticky bottom-6 bg-brand-600 text-white font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          )}

          {/* Slide 1: Source of funds */}
          {preSlide === 1 && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-600 mb-2">Step 2 of 4</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Source of funds
                </h1>
                <p className="text-gray-500 text-sm mb-8">
                  What is your primary source of funds?
                </p>
                <div className="space-y-3">
                  {SOURCE_OF_FUNDS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => selectAndAdvancePre('source_of_funds', opt)}
                      className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base transition-all active:scale-[0.98] ${
                        answers.source_of_funds === opt
                          ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                          : 'border-gray-100 text-gray-700 active:bg-gray-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Slide 2: Citizenship status */}
          {preSlide === 2 && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-600 mb-2">Step 3 of 4</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Citizenship status
                </h1>
                <p className="text-gray-500 text-sm mb-8">
                  What is your current citizenship or residency status?
                </p>
                <div className="space-y-3">
                  {CITIZENSHIP_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => selectAndAdvancePre('citizenship', opt)}
                      className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base transition-all active:scale-[0.98] ${
                        answers.citizenship === opt
                          ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                          : 'border-gray-100 text-gray-700 active:bg-gray-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Slide 3: Occupation dropdown */}
          {preSlide === 3 && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-600 mb-2">Step 4 of 4</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Your occupation
                </h1>
                <p className="text-gray-500 text-sm mb-8">
                  Select the option that best describes what you do.
                </p>
                <OccupationPicker
                  value={answers.occupation || ''}
                  onChange={(v) => selectAndAdvancePre('occupation', v)}
                />
              </div>
              {submitting && (
                <p className="w-full py-4 mt-6 text-center text-gray-500 text-sm">Saving...</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Document choice — Passport/DL or alternative? */}
      {phase === 'doc_choice' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Do you have a Passport or Australian Driver&apos;s Licence?
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              These are the quickest way to verify your identity.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setPhase('idv_info')}
                className="w-full text-left px-5 py-4 rounded-2xl border-2 border-gray-100 text-base text-gray-700 transition-all active:scale-[0.98] active:bg-gray-50"
              >
                <span className="font-medium">Yes</span>
                <span className="text-gray-400 text-sm ml-2">— I have a Passport or Driver&apos;s Licence</span>
              </button>
              <button
                onClick={() => setPhase('alt_doc_choice')}
                className="w-full text-left px-5 py-4 rounded-2xl border-2 border-gray-100 text-base text-gray-700 transition-all active:scale-[0.98] active:bg-gray-50"
              >
                <span className="font-medium">No</span>
                <span className="text-gray-400 text-sm ml-2">— I&apos;ll use another document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alt doc choice — Medicare or Birth Certificate */}
      {phase === 'alt_doc_choice' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Which document do you have?
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Select the identity document you&apos;d like to use for verification.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setAltDocType('medicare'); setPhase('alt_doc_state'); }}
                className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base transition-all active:scale-[0.98] ${
                  altDocType === 'medicare'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                    : 'border-gray-100 text-gray-700 active:bg-gray-50'
                }`}
              >
                <div className="font-medium">Medicare Card</div>
                <div className="text-sm text-gray-400 mt-0.5">Australian government health card</div>
              </button>
              <button
                onClick={() => { setAltDocType('birth_cert'); setPhase('alt_doc_state'); }}
                className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base transition-all active:scale-[0.98] ${
                  altDocType === 'birth_cert'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                    : 'border-gray-100 text-gray-700 active:bg-gray-50'
                }`}
              >
                <div className="font-medium">Australian Birth Certificate</div>
                <div className="text-sm text-gray-400 mt-0.5">Issued by a state or territory registry</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alt doc state selection */}
      {phase === 'alt_doc_state' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Which state or territory?
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              {altDocType === 'medicare'
                ? 'Select the state where your Medicare card was issued.'
                : 'Select the state where your birth was registered.'}
            </p>
            <div className="space-y-3">
              {AU_STATES.map((s) => (
                <button
                  key={s.code}
                  onClick={() => { setAltState(s.code); setPhase('alt_doc_upload'); }}
                  className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base transition-all active:scale-[0.98] ${
                    altState === s.code
                      ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-100 text-gray-700 active:bg-gray-50'
                  }`}
                >
                  {s.name} <span className="text-gray-400">({s.code})</span>
                  {s.code === 'WA' && <span className="ml-2 text-yellow-500">&#9733; Example</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alt doc photo upload */}
      {phase === 'alt_doc_upload' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Take a photo of your {altDocType === 'medicare' ? 'Medicare Card' : 'Birth Certificate'}
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Make sure the entire document is visible and the text is readable.
            </p>

            {altPhotoPreview ? (
              <div className="relative mb-4">
                <img src={altPhotoPreview} alt="Document preview" className="w-full rounded-2xl border-2 border-brand-200" />
                <button
                  onClick={() => { setAltPhoto(null); setAltPhotoPreview(null); }}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-brand-300 transition-colors">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600">Tap to take a photo or upload</p>
                  <p className="text-xs text-gray-400 mt-1">JPG or PNG</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <button
            onClick={() => setPhase('alt_doc_form')}
            disabled={!altPhoto}
            className="w-full py-4 mt-6 sticky bottom-6 bg-brand-600 text-white font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      )}

      {/* Alt doc details form — Medicare */}
      {phase === 'alt_doc_form' && altDocType === 'medicare' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">Medicare Card details</h1>
              <button
                onClick={autoFillTestData}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-600 transition-colors"
              >
                Auto-fill demo
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-8">Enter the details exactly as they appear on your card.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Card number</label>
                <input
                  type="text"
                  value={altDocFields.cardNumber || ''}
                  onChange={(e) => setAltDocField('cardNumber', e.target.value)}
                  placeholder="10 digit number e.g. 1234 56789 0"
                  maxLength={12}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Card colour</label>
                <div className="flex gap-3">
                  {[
                    { code: 'G', label: 'Green', color: 'bg-green-500' },
                    { code: 'B', label: 'Blue', color: 'bg-blue-500' },
                    { code: 'Y', label: 'Yellow', color: 'bg-yellow-400' },
                  ].map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setAltDocField('cardType', c.code)}
                      className={`flex-1 py-3.5 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        altDocFields.cardType === c.code
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-gray-100 text-gray-600'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.color}`} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Individual reference number (IRN)</label>
                <input
                  type="text"
                  value={altDocFields.reference || ''}
                  onChange={(e) => setAltDocField('reference', e.target.value)}
                  placeholder="1-5 (shown next to your name)"
                  maxLength={1}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiry date</label>
                <input
                  type="month"
                  value={altDocFields.expiryDate || ''}
                  onChange={(e) => setAltDocField('expiryDate', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Middle name on card <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={altDocFields.middleNameOnCard || ''}
                  onChange={(e) => setAltDocField('middleNameOnCard', e.target.value)}
                  placeholder="Initial or name as shown"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                />
              </div>
            </div>
          </div>
          <button
            onClick={() => setPhase('alt_personal')}
            disabled={!altDocFields.cardNumber || !altDocFields.cardType || !altDocFields.expiryDate}
            className="w-full py-4 mt-6 bg-brand-600 text-white font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      )}

      {/* Alt doc details form — Birth Certificate */}
      {phase === 'alt_doc_form' && altDocType === 'birth_cert' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">Birth Certificate details</h1>
              <button
                onClick={autoFillTestData}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-600 transition-colors"
              >
                Auto-fill demo
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-8">Enter the details exactly as they appear on your certificate.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Registration number</label>
                <input
                  type="text"
                  value={altDocFields.registrationNumber || ''}
                  onChange={(e) => setAltDocField('registrationNumber', e.target.value)}
                  placeholder="As shown on your certificate"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Certificate number <span className="text-gray-400 font-normal">(if shown)</span></label>
                <input
                  type="text"
                  value={altDocFields.certificateNumber || ''}
                  onChange={(e) => setAltDocField('certificateNumber', e.target.value)}
                  placeholder="Certificate number"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Registration date</label>
                <input
                  type="date"
                  value={altDocFields.registrationDate || ''}
                  onChange={(e) => setAltDocField('registrationDate', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of print <span className="text-gray-400 font-normal">(if shown)</span></label>
                <input
                  type="date"
                  value={altDocFields.dateOfPrint || ''}
                  onChange={(e) => setAltDocField('dateOfPrint', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base"
                />
              </div>
            </div>
          </div>
          <button
            onClick={() => setPhase('alt_personal')}
            disabled={!altDocFields.registrationNumber}
            className="w-full py-4 mt-6 bg-brand-600 text-white font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      )}

      {/* Alt personal details */}
      {phase === 'alt_personal' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1 overflow-y-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your details</h1>
            <p className="text-gray-500 text-sm mb-8">Please enter your personal information exactly as it appears on your identity documents.</p>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
                  <input
                    type="text"
                    value={altPersonal.givenName || ''}
                    onChange={(e) => setAltPersonalField('givenName', e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Middle name</label>
                  <input
                    type="text"
                    value={altPersonal.middleName || ''}
                    onChange={(e) => setAltPersonalField('middleName', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
                <input
                  type="text"
                  value={altPersonal.familyName || ''}
                  onChange={(e) => setAltPersonalField('familyName', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of birth</label>
                <input
                  type="date"
                  value={altPersonal.dateOfBirth || ''}
                  onChange={(e) => setAltPersonalField('dateOfBirth', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-base"
                />
              </div>

              <div className="pt-2">
                <p className="text-sm font-semibold text-gray-900 mb-4">Residential address</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Street no.</label>
                      <input
                        type="text"
                        value={altPersonal.streetNumber || ''}
                        onChange={(e) => setAltPersonalField('streetNumber', e.target.value)}
                        className="w-full px-3 py-3 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-sm placeholder:text-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Street name</label>
                      <input
                        type="text"
                        value={altPersonal.streetName || ''}
                        onChange={(e) => setAltPersonalField('streetName', e.target.value)}
                        className="w-full px-3 py-3 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-sm placeholder:text-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <input
                        type="text"
                        value={altPersonal.streetType || ''}
                        onChange={(e) => setAltPersonalField('streetType', e.target.value)}
                        placeholder="St, Rd..."
                        className="w-full px-3 py-3 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-sm placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Suburb / City</label>
                      <input
                        type="text"
                        value={altPersonal.locality || ''}
                        onChange={(e) => setAltPersonalField('locality', e.target.value)}
                        className="w-full px-3 py-3 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-sm placeholder:text-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                      <select
                        value={altPersonal.subdivision || ''}
                        onChange={(e) => setAltPersonalField('subdivision', e.target.value)}
                        className="w-full px-3 py-3 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-sm bg-white"
                      >
                        <option value="">--</option>
                        {AU_STATES.map((s) => (
                          <option key={s.code} value={s.code}>{s.code}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Postcode</label>
                      <input
                        type="text"
                        value={altPersonal.postalCode || ''}
                        onChange={(e) => setAltPersonalField('postalCode', e.target.value)}
                        maxLength={4}
                        className="w-full px-3 py-3 rounded-xl border-2 border-gray-100 focus:border-brand-600 outline-none transition-colors text-sm placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={submitAltFlow}
            disabled={submitting || !altPersonal.givenName || !altPersonal.familyName || !altPersonal.dateOfBirth || !altPersonal.streetNumber || !altPersonal.streetName || !altPersonal.locality || !altPersonal.subdivision || !altPersonal.postalCode}
            className="w-full py-4 mt-6 bg-brand-600 text-white font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {submitting ? 'Submitting...' : 'Submit for verification'}
          </button>
        </div>
      )}

      {/* IDV info slide */}
      {phase === 'idv_info' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              What happens next
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              To verify your identity, you&apos;ll need to complete a short ID verification process. Here&apos;s what to expect:
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Take a photo of your ID</p>
                  <p className="text-sm text-gray-500 mt-0.5">You&apos;ll be asked to photograph your driver&apos;s licence, passport, or other government-issued ID.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Take a selfie</p>
                  <p className="text-sm text-gray-500 mt-0.5">A quick photo of your face to match against your ID document.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Verified via the DVS</p>
                  <p className="text-sm text-gray-500 mt-0.5">Your ID details will be checked against the Document Verification Service (DVS), the Australian Government&apos;s system for verifying identity documents.</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setPhase('idv_consent')}
            className="w-full py-4 mt-6 bg-brand-600 text-white font-semibold rounded-2xl transition-all active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      )}

      {/* IDV consent slide */}
      {phase === 'idv_consent' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          <div className="flex-1">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Your consent
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              Before we proceed, please review and agree to the following:
            </p>

            <div className="space-y-4 mb-8">
              <label className="flex gap-3 items-start cursor-pointer group">
                <input
                  type="checkbox"
                  checked={answers.consent_id === 'true'}
                  onChange={(e) => setAnswer('consent_id', e.target.checked ? 'true' : '')}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-600 shrink-0 accent-brand-600"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  I consent to having my identity document photographed and my personal information collected for the purpose of verifying my identity.
                </span>
              </label>

              <label className="flex gap-3 items-start cursor-pointer group">
                <input
                  type="checkbox"
                  checked={answers.consent_dvs === 'true'}
                  onChange={(e) => setAnswer('consent_dvs', e.target.checked ? 'true' : '')}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-600 shrink-0 accent-brand-600"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  I consent to my identity information being checked against the Document Verification Service (DVS) managed by the Australian Government.
                </span>
              </label>

              <label className="flex gap-3 items-start cursor-pointer group">
                <input
                  type="checkbox"
                  checked={answers.consent_biometric === 'true'}
                  onChange={(e) => setAnswer('consent_biometric', e.target.checked ? 'true' : '')}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-600 shrink-0 accent-brand-600"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  I consent to a biometric comparison being performed between my selfie and my ID photo to confirm my identity.
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={() => setPhase('idv')}
            disabled={answers.consent_id !== 'true' || answers.consent_dvs !== 'true' || answers.consent_biometric !== 'true'}
            className="w-full py-4 bg-brand-600 text-white font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            I agree — start verification
          </button>
        </div>
      )}

      {/* IDV iframe — full screen, no branding */}
      {phase === 'idv' && session && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <iframe
              src={session.hostedUrl}
              className="absolute inset-0 w-full h-full border-0"
              allow="camera; microphone"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
            />
          </div>
          <div className="px-6 py-3 shrink-0 text-center border-t border-gray-100">
            <button
              onClick={markIdvComplete}
              className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              I&apos;ve completed the verification
            </button>
          </div>
        </div>
      )}

      {/* Post-IDV slides */}
      {phase === 'post' && (
        <div className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-lg mx-auto w-full">
          {POST_QUESTIONS.map((q, i) => {
            if (postSlide !== i) return null;
            return (
              <div key={q.key} className="flex-1 flex flex-col">
                <div className="flex-1">
                  {i === 0 && (
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <p className="text-sm font-medium text-brand-600 mb-2">
                    Almost done - {i + 1} of {POST_QUESTIONS.length}
                  </p>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{q.title}</h1>
                  <p className="text-gray-500 text-sm mb-8">{q.subtitle}</p>
                  <div className="space-y-3">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => selectAndAdvancePost(q.key, opt)}
                        disabled={submitting}
                        className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base transition-all active:scale-[0.98] disabled:opacity-50 ${
                          answers[q.key] === opt
                            ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                            : 'border-gray-100 text-gray-700 active:bg-gray-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {submitting && i === POST_QUESTIONS.length - 1 && (
                  <p className="w-full py-4 mt-6 text-center text-gray-500 text-sm">Finishing up...</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Complete */}
      {phase === 'complete' && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            {checkResult === 'pass' && (
              <>
                <img src="/success.png" alt="Verification Passed" className="w-20 h-20 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-green-900 mb-3">Verification Passed</h1>
                <p className="text-gray-500">
                  Your identity has been successfully verified. You&apos;re all set to get started with ACME Ltd.
                </p>
              </>
            )}
            {checkResult === 'fail' && (
              <>
                <img src="/failure.png" alt="Verification Failed" className="w-20 h-20 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-red-900 mb-3">Verification Failed</h1>
                <p className="text-gray-500">
                  We were unable to verify your identity. Please contact ACME Ltd support for assistance.
                </p>
              </>
            )}
            {checkResult === 'review' && (
              <>
                <img src="/review.png" alt="Under Review" className="w-20 h-20 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-amber-900 mb-3">Under Review</h1>
                <p className="text-gray-500">
                  Your verification requires further review. ACME Ltd will be in touch shortly with an update.
                </p>
              </>
            )}
            {!checkResult && (
              <>
                <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-brand-900 mb-3">You&apos;re all set!</h1>
                <p className="text-gray-500">
                  Thank you for completing your verification with ACME Ltd. We&apos;ll review your information and be in touch shortly.
                </p>
              </>
            )}
            <button
              onClick={() => window.location.href = '/'}
              className="mt-8 px-6 py-3 text-sm font-medium text-brand-600 border-2 border-brand-200 rounded-2xl hover:bg-brand-50 transition-colors"
            >
              Start again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
