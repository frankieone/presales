'use client';

import { useState } from 'react';

interface GeneratedLink {
  sessionId: string;
  customerLink: string;
  urlExpiry: string;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [missingCreds, setMissingCreds] = useState<string[] | null>(null);
  const [links, setLinks] = useState<GeneratedLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setMissingCreds(null);

    try {
      const res = await fetch('/api/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'missing_credentials') {
          setMissingCreds(data.missing);
          return;
        }
        setError(data.error || 'Failed to generate link');
        return;
      }

      setLinks((prev) => [data, ...prev]);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function copyLink(link: string, id: string) {
    navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-brand-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/seahorse.png" alt="ACME Ltd" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="text-lg font-bold text-white">ACME Ltd</h1>
            <p className="text-xs text-brand-200">Onboarding Link Generator</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 px-6 py-5 text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-blue-900">FrankieOne v2 API — Example Implementation</h3>
            </div>
            <p className="text-sm text-blue-700 mb-4">
              This app demonstrates how to build a custom onboarding experience around FrankieOne&apos;s hosted IDV process and v2 APIs. It showcases:
            </p>
            <ul className="space-y-2.5 mb-4">
              <li className="flex gap-2.5 text-sm text-blue-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">1</span>
                <span><strong className="text-blue-800">Pre-screening forms</strong> — Capturing entity details (occupation, source of funds, citizenship) and attaching them as key-value pair custom attributes</span>
              </li>
              <li className="flex gap-2.5 text-sm text-blue-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">2</span>
                <span><strong className="text-blue-800">Dual verification paths</strong> — Letting the customer choose between ID verification (photo ID + selfie) or manually entering an alternative document (Medicare card, birth certificate)</span>
              </li>
              <li className="flex gap-2.5 text-sm text-blue-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">3</span>
                <span><strong className="text-blue-800">Step-up verification</strong> — If an alternative document check fails, the customer is prompted to complete ID verification instead, demonstrating an enhanced &ldquo;step up&rdquo; check</span>
              </li>
              <li className="flex gap-2.5 text-sm text-blue-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">4</span>
                <span><strong className="text-blue-800">Workflow results</strong> — Fetching and displaying the outcome of compliance checks (pass, review, or fail) with appropriate messaging</span>
              </li>
              <li className="flex gap-2.5 text-sm text-blue-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">5</span>
                <span><strong className="text-blue-800">Post-verification capture</strong> — Collecting additional information after the IDV process, showing how to build your own experience on either side of the FrankieOne flow</span>
              </li>
            </ul>
            <p className="text-xs text-blue-500">
              All data is submitted to FrankieOne via the v2 API for compliance checks to run.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-brand-100 p-6 text-center">
            <h2 className="text-lg font-bold text-brand-900 mb-2">Generate Onboarding Link</h2>
            <p className="text-sm text-gray-500 mb-6">
              Create a new verification link to send to a customer.
            </p>

            {missingCreds && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-left mb-4">
                <h3 className="text-sm font-bold text-amber-800 mb-2">API Credentials Not Configured</h3>
                <p className="text-sm text-amber-700 mb-3">
                  The following environment variables are missing or still set to placeholder values:
                </p>
                <ul className="text-xs font-mono bg-amber-100 rounded-lg px-3 py-2 mb-3 space-y-1">
                  {missingCreds.map((key) => (
                    <li key={key} className="text-amber-900">{key}</li>
                  ))}
                </ul>
                <p className="text-sm font-semibold text-amber-800 mb-1">To fix this:</p>
                <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
                  <li>Open the <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">.env</code> file in the project root</li>
                  <li>Replace the placeholder values with your FrankieOne API credentials</li>
                  <li>Restart the container: <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">docker compose down &amp;&amp; docker compose up -d</code></li>
                </ol>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 px-6 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Generating...' : 'Generate Onboarding Link'}
            </button>
          </div>

          {links.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-brand-900 mb-3">Generated Links</h2>
              <div className="space-y-3">
                {links.map((link) => (
                  <div key={link.sessionId} className="bg-white rounded-2xl shadow-sm border border-brand-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-400">
                        {link.sessionId.slice(0, 8)}...
                      </span>
                      <span className="text-xs text-gray-400">
                        Expires: {new Date(link.urlExpiry).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={link.customerLink}
                        className="flex-1 text-xs bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 text-gray-700 truncate font-mono"
                      />
                      <button
                        onClick={() => copyLink(link.customerLink, link.sessionId)}
                        className={`shrink-0 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          copied === link.sessionId
                            ? 'bg-green-100 text-green-700'
                            : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                        }`}
                      >
                        {copied === link.sessionId ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
