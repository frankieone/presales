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
  const [links, setLinks] = useState<GeneratedLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
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
          <div className="bg-white rounded-2xl shadow-sm border border-brand-100 p-6 text-center">
            <h2 className="text-lg font-bold text-brand-900 mb-2">Generate Onboarding Link</h2>
            <p className="text-sm text-gray-500 mb-6">
              Create a new verification link to send to a customer.
            </p>

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
