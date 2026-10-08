/**
 * The onboarding journey, the same in every vertical:
 *
 *   1. Website registration  — full name, email, mobile, password. Creates the
 *                              primary contact and, where the vertical has one,
 *                              a container (business, fund) with no name yet,
 *                              anchored by an application ID.
 *   2. Login                 — into the customer portal.
 *   3. Related people        — added by the primary contact (directors, fund
 *                              members); each verifies on their own phone.
 *   4. Application submitted — the container is named, the contact's record
 *                              completed, and the onboarding fraud workflow runs.
 *
 * Each step registers its own device session against the primary contact, so
 * the device and IP at every step sit on the one person, and every run of the
 * device workflow evaluates every session so far.
 */

import { useState, useEffect } from 'react';
import { createIndividualSession } from './api';
import { storageKey, vertical } from '../config';
import { setSardineSessionId, updateSardineConfig, waitForDeviceResponse } from './sardine';

/**
 * Register a device session for an entity and point the listener at it.
 * Returns the session token, which is what activities are sent with — not the
 * sessionId, which is a different value FrankieOne does not look devices up by.
 */
export async function registerDeviceSession(entityId, flow) {
  const session = await createIndividualSession(entityId);
  const token = session.token || session.sessionId;
  setSardineSessionId(token);
  await updateSardineConfig({ userIdHash: entityId, flow });
  // The activity or workflow can otherwise reach the server before the device.
  await waitForDeviceResponse(5000);
  return token;
}

/* ── the registration record ─────────────────────────────────────
 * The customer's own systems would hold this. The demo has no backend, so it
 * is kept in the browser — enough to log back in to the portal on one machine.
 */

const KEY = storageKey('registration');

export function readRegistration() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveRegistration(record) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* private mode — the session still works until the tab closes */
  }
  return record;
}

export async function hashPassword(password) {
  const bytes = new TextEncoder().encode(`fraud-demo:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newApplicationId() {
  return `APP-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * State that survives leaving the page — the application and the member list
 * are filled in over several visits, and moving between them must not wipe
 * either. Kept per fund; a null key keeps it in memory only.
 */
export function useDraft(key, initial) {
  const [value, setValue] = useState(() => {
    if (!key) return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  }, [key, value]);
  return [value, setValue];
}

/**
 * Forget the whole demo in this browser: the registration, the fund, every
 * application and member draft, the chosen family. Entities already created in
 * FrankieOne are untouched.
 */
export function resetDemo() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`fd.${vertical.id}.`))
      .forEach((k) => localStorage.removeItem(k));
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(`fd.${vertical.id}.`))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* private mode — nothing was kept */
  }
}

/**
 * The link a member opens on their own phone to confirm and verify themselves.
 * Points at the LAN address so it works from a phone on the same network.
 */
export function memberLink(entityId, fundId) {
  const host = import.meta.env.VITE_LAN_HOST || window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${host}${port}/m/${entityId}?f=${fundId}`;
}

/** The placeholder a fund carries until its name arrives with the application. */
export const PENDING_FUND_NAME = 'PENDING APPLICATION';
