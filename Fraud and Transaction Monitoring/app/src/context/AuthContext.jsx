import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { initializeSardine } from '../services/sardine';
import { storageKey } from '../config';

const AuthContext = createContext(null);

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// The container (business or fund) outlives a single session: one login is
// shared for the application and people may return days apart, so signing back
// in should land on it, not on nothing.
const CONTAINER_KEY = storageKey('container');

function readStoredContainer() {
  try {
    const raw = localStorage.getItem(CONTAINER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionToken] = useState(() => generateUUID());
  const [sdkReady, setSdkReady] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // The member page and the embedded OneSDK test page bring their own
    // Sardine, through OneSDK's device module; ours would collect twice.
    if (/^\/(device-check|m)\//.test(window.location.pathname)) {
      setSdkReady(true);
      return;
    }
    initializeSardine(sessionToken)
      .catch((error) => console.error('[AuthContext] Failed to initialize Sardine:', error))
      .finally(() => setSdkReady(true));
  }, [sessionToken]);

  // `container` carries the business or fund alongside the person: the session
  // belongs to the application, while device and behavioural signals stay
  // attributed to the person who signed in.
  const login = useCallback((userId, entityType = 'INDIVIDUAL', entityName = '', container = null) => {
    const resolved = container || readStoredContainer();
    if (container) {
      try { localStorage.setItem(CONTAINER_KEY, JSON.stringify(container)); } catch { /* private mode */ }
    }
    setUser({ userId, entityType, entityName, ...(resolved || {}) });
    setFailedAttempts(0);
    return sessionToken;
  }, [sessionToken]);

  const incrementFailedAttempts = useCallback(() => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    if (next >= 3) setIsLocked(true);
    return next;
  }, [failedAttempts]);

  const logout = useCallback(() => {
    setUser(null);
    setFailedAttempts(0);
    setIsLocked(false);
  }, []);

  const value = {
    user, sessionToken, sdkReady, failedAttempts, isLocked,
    login, logout, incrementFailedAttempts,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
