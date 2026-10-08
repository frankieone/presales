import { createContext, useContext, useState, useCallback } from 'react';
import { FRAUD_EMAILS, DEMO_PHONES } from '../services/demoData';

const RiskContext = createContext(null);

const SUSPICIOUS_LOCATIONS = [
  { label: 'Russia (Moscow)', country: 'RUS', city: 'Moscow', ip: '185.220.101.42' },
  { label: 'North Korea (Pyongyang)', country: 'PRK', city: 'Pyongyang', ip: '175.45.176.3' },
  { label: 'Iran (Tehran)', country: 'IRN', city: 'Tehran', ip: '5.160.218.44' },
  { label: 'Nigeria (Lagos)', country: 'NGA', city: 'Lagos', ip: '105.112.78.91' },
  { label: 'China (Beijing)', country: 'CHN', city: 'Beijing', ip: '36.110.228.254' },
];

export { SUSPICIOUS_LOCATIONS };

export function RiskProvider({ children }) {
  const [vpnEnabled, setVpnEnabled] = useState(false);
  const [suspiciousLocation, setSuspiciousLocation] = useState(null); // index into SUSPICIOUS_LOCATIONS
  const [customAttributes, setCustomAttributes] = useState({});
  const [showPanel, setShowPanel] = useState(false);
  // Presenter-only: which test email / phone the autofill buttons use. Picked in
  // the hidden simulator panel so the customer screens never show fraud labels.
  // null keeps the scenario's own (clean) contact details.
  const [demoEmail, setDemoEmail] = useState(null); // index into FRAUD_EMAILS
  const [demoPhone, setDemoPhone] = useState(null); // index into DEMO_PHONES

  const togglePanel = useCallback(() => setShowPanel((v) => !v), []);

  const addCustomAttribute = useCallback((key, type, value) => {
    setCustomAttributes((prev) => ({ ...prev, [key]: { type, value } }));
  }, []);

  const removeCustomAttribute = useCallback((key) => {
    setCustomAttributes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setVpnEnabled(false);
    setSuspiciousLocation(null);
    setCustomAttributes({});
    setDemoEmail(null);
    setDemoPhone(null);
  }, []);

  /** The email and phone autofill should use for this person. */
  const demoContact = useCallback((person) => ({
    email: demoEmail !== null
      ? FRAUD_EMAILS[demoEmail].email(person.givenName, person.familyName)
      : person.email,
    phone: demoPhone !== null ? DEMO_PHONES[demoPhone].value : person.phone,
  }), [demoEmail, demoPhone]);

  // Build the customAttributes object for the FrankieOne activity API
  const buildRiskAttributes = useCallback(() => {
    const attrs = {};

    if (vpnEnabled) {
      attrs['vpn-detected'] = { type: 'BOOLEAN', value: 'true' };
      attrs['proxy-type'] = { type: 'STRING', value: 'VPN' };
    }

    if (suspiciousLocation !== null) {
      const loc = SUSPICIOUS_LOCATIONS[suspiciousLocation];
      attrs['ip-country'] = { type: 'STRING', value: loc.country };
      attrs['ip-city'] = { type: 'STRING', value: loc.city };
      attrs['ip-address'] = { type: 'STRING', value: loc.ip };
      attrs['suspicious-location'] = { type: 'BOOLEAN', value: 'true' };
    }

    // Merge in any manually added custom attributes
    Object.entries(customAttributes).forEach(([key, val]) => {
      attrs[key] = val;
    });

    return Object.keys(attrs).length > 0 ? attrs : null;
  }, [vpnEnabled, suspiciousLocation, customAttributes]);

  const hasActiveRisks = vpnEnabled || suspiciousLocation !== null || Object.keys(customAttributes).length > 0
    || demoEmail !== null || demoPhone !== null;

  const value = {
    vpnEnabled, setVpnEnabled,
    suspiciousLocation, setSuspiciousLocation,
    customAttributes, addCustomAttribute, removeCustomAttribute,
    showPanel, togglePanel,
    demoEmail, setDemoEmail, demoPhone, setDemoPhone, demoContact,
    buildRiskAttributes,
    clearAll,
    hasActiveRisks,
  };

  return <RiskContext.Provider value={value}>{children}</RiskContext.Provider>;
}

export function useRisk() {
  const context = useContext(RiskContext);
  if (!context) throw new Error('useRisk must be used within a RiskProvider');
  return context;
}
