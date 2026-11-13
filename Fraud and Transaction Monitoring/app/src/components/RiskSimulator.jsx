import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X, Wifi, MapPin, Plus, Trash2, ToggleLeft, ToggleRight, Mail, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useRisk, SUSPICIOUS_LOCATIONS } from '../context/RiskContext';
import { useAuth } from '../context/AuthContext';
import { FRAUD_EMAILS, DEMO_PHONES } from '../services/demoData';
import { memberLink } from '../services/journey';
import { storageKey, vertical } from '../config';

/**
 * Presenter-only: each member's confirmation link, as a QR code to scan with a
 * phone. Stands in for the SMS or email the customer would send. Lists held
 * members too, so their page can still be shown — the customer's screen never
 * offers them a link.
 */
function MemberLinks() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user?.fundId) return;
    let members = [];
    try {
      members = JSON.parse(localStorage.getItem(`${storageKey(`people.${user.fundId}`)}.list`) || '[]');
    } catch { /* private mode */ }
    Promise.all(
      members
        .filter((m) => !m.isApplicant && m.entityId)
        .map(async (m) => {
          const link = m.link || memberLink(m.entityId, user.fundId);
          return { ...m, link, qr: await QRCode.toDataURL(link, { margin: 1, width: 220 }) };
        }),
    ).then(setRows);
  }, [user?.fundId]);

  if (!user?.fundId || !vertical.people.enabled) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <Smartphone className="w-4 h-4" />
        People's links
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-gray-500">Add people on the {vertical.people.navLabel} page; their links appear here.</p>
      )}
      {rows.map((m) => (
        <div key={m.entityId} className="p-3 rounded-lg bg-gray-800 border border-gray-700 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-200">{m.givenName} {m.familyName}</span>
            <span className="text-[11px] text-gray-400">
              {m.onHold ? 'Held — not offered a link' : m.inviteSent ? 'Link sent' : 'Not sent yet'}
            </span>
          </div>
          <img src={m.qr} alt={`QR code for ${m.givenName}'s link`} className="w-36 h-36 rounded bg-white mx-auto" />
          <a href={m.link} target="_blank" rel="noreferrer" className="block text-[11px] text-amber-400 break-all">{m.link}</a>
        </div>
      ))}
      <p className="text-xs text-gray-500">Scan with a phone on the same Wi-Fi as this laptop.</p>
    </div>
  );
}

export default function RiskSimulator() {
  const {
    vpnEnabled, setVpnEnabled,
    suspiciousLocation, setSuspiciousLocation,
    customAttributes, addCustomAttribute, removeCustomAttribute,
    showPanel, togglePanel,
    demoEmail, setDemoEmail, demoPhone, setDemoPhone,
    clearAll,
    hasActiveRisks,
  } = useRisk();

  const navigate = useNavigate();
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrType, setNewAttrType] = useState('STRING');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Keyboard shortcut: Ctrl+Shift+R
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePanel]);

  const handleAddAttribute = () => {
    const key = newAttrKey.trim().replace(/[^a-zA-Z0-9-]/g, '-');
    if (!key || !newAttrValue.trim()) return;
    addCustomAttribute(key, newAttrType, newAttrValue.trim());
    setNewAttrKey('');
    setNewAttrValue('');
  };

  // Closed: only a faint corner button for the presenter — no "active" badge
  // or label, since it sits on the customer's screen while the audience
  // watches. Hidden on the member's own page, which is opened on a phone.
  if (!showPanel) {
    if (/^\/(m|device-check)\//.test(window.location.pathname)) return null;
    return (
      <button
        onClick={togglePanel}
        title="Presenter panel (Ctrl+Shift+R)"
        aria-label="Open presenter panel"
        className="fixed bottom-3 right-3 z-[90] w-8 h-8 rounded-full bg-gray-900/10 text-gray-500 opacity-30 hover:opacity-100 hover:bg-gray-900 hover:text-white transition flex items-center justify-center"
      >
        <ShieldAlert className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-[110] w-96 bg-gray-900 text-gray-100 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <h2 className="font-semibold text-lg">Risk Simulator</h2>
        </div>
        <button onClick={togglePanel} className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <p className="text-sm text-gray-400">
          Inject risk signals into activity API calls. These are sent as <code className="text-amber-400">customAttributes</code> on
          the activity payload to FrankieOne.
        </p>

        <MemberLinks />

        {/* Autofill contact details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Mail className="w-4 h-4" />
            Autofill contact details
          </div>
          <p className="text-xs text-gray-500">
            Used by the Fill buttons on sign-up and when adding members. The customer screen shows only the address.
          </p>
          <select
            value={demoEmail ?? ''}
            onChange={(e) => setDemoEmail(e.target.value === '' ? null : parseInt(e.target.value))}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Email: scenario default</option>
            {FRAUD_EMAILS.map((f, i) => (
              <option key={f.label} value={i}>Email: {f.label}{f.rule ? ` (${f.rule})` : ''}</option>
            ))}
          </select>
          <select
            value={demoPhone ?? ''}
            onChange={(e) => setDemoPhone(e.target.value === '' ? null : parseInt(e.target.value))}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Phone: scenario default</option>
            {DEMO_PHONES.map((ph, i) => (
              <option key={ph.value} value={i}>
                Phone: {ph.label} ({ph.value}){ph.needsRule ? ' — needs a live Sardine rule' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* VPN Toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Wifi className="w-4 h-4" />
            VPN / Proxy Detection
          </div>
          <button
            onClick={() => setVpnEnabled(!vpnEnabled)}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
              vpnEnabled
                ? 'bg-red-900/40 border-red-700 text-red-300'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            <span className="text-sm">
              {vpnEnabled ? 'VPN Detected — signals active' : 'VPN not detected'}
            </span>
            {vpnEnabled
              ? <ToggleRight className="w-6 h-6 text-red-400" />
              : <ToggleLeft className="w-6 h-6 text-gray-500" />
            }
          </button>
          {vpnEnabled && (
            <div className="text-xs text-gray-500 pl-1">
              Sends: <code className="text-amber-400">vpn-detected=true</code>, <code className="text-amber-400">proxy-type=VPN</code>
            </div>
          )}
        </div>

        {/* Suspicious Location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <MapPin className="w-4 h-4" />
            Suspicious Location
          </div>
          <select
            value={suspiciousLocation ?? ''}
            onChange={(e) => setSuspiciousLocation(e.target.value === '' ? null : parseInt(e.target.value))}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Normal (no location spoofing)</option>
            {SUSPICIOUS_LOCATIONS.map((loc, i) => (
              <option key={i} value={i}>{loc.label}</option>
            ))}
          </select>
          {suspiciousLocation !== null && (
            <div className="text-xs text-gray-500 pl-1 space-y-0.5">
              <div>Sends: <code className="text-amber-400">ip-country={SUSPICIOUS_LOCATIONS[suspiciousLocation].country}</code></div>
              <div><code className="text-amber-400">ip-address={SUSPICIOUS_LOCATIONS[suspiciousLocation].ip}</code></div>
              <div><code className="text-amber-400">suspicious-location=true</code></div>
            </div>
          )}
        </div>

        {/* Custom Attributes */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Plus className="w-4 h-4" />
            Custom Attributes
          </div>

          {Object.entries(customAttributes).length > 0 && (
            <div className="space-y-1">
              {Object.entries(customAttributes).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg text-sm">
                  <div>
                    <code className="text-amber-400">{key}</code>
                    <span className="text-gray-500 ml-1">({val.type})</span>
                    <span className="text-gray-300 ml-2">= {val.value}</span>
                  </div>
                  <button onClick={() => removeCustomAttribute(key)} className="p-1 hover:bg-gray-700 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2">
            <input
              type="text"
              value={newAttrKey}
              onChange={(e) => setNewAttrKey(e.target.value)}
              placeholder="key"
              className="p-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <select
              value={newAttrType}
              onChange={(e) => setNewAttrType(e.target.value)}
              className="p-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none"
            >
              <option value="STRING">STR</option>
              <option value="NUMBER">NUM</option>
              <option value="BOOLEAN">BOOL</option>
            </select>
            <input
              type="text"
              value={newAttrValue}
              onChange={(e) => setNewAttrValue(e.target.value)}
              placeholder="value"
              className="p-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <button
              onClick={handleAddAttribute}
              disabled={!newAttrKey.trim() || !newAttrValue.trim()}
              className="p-2 rounded bg-red-700 hover:bg-red-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 bg-gray-800 space-y-2">
        {hasActiveRisks && (
          <button
            onClick={clearAll}
            className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Clear All Risk Signals
          </button>
        )}
        <button
          onClick={() => { clearAll(); togglePanel(); navigate('/reset'); }}
          className="w-full py-2.5 bg-red-800 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Reset demo
        </button>
        <p className="text-xs text-gray-500 text-center">
          Wipes this demo's registration and drafts in this browser and signs out.
        </p>
        <p className="text-xs text-gray-500 text-center">
          Toggle with <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 text-xs">Ctrl+Shift+R</kbd>
        </p>
      </div>
    </div>
  );
}
