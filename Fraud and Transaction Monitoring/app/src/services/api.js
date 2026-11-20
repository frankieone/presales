/**
 * Connection settings, from .env.local (see env.example). Never commit that
 * file: the API key it holds ends up in the browser bundle, which is fine for
 * a demo on a trusted network and nowhere else.
 */
export function getEnvCredentials() {
  const env = import.meta.env;
  return {
    envName: env.VITE_ENV_LABEL || 'unknown',
    server: env.VITE_FRANKIE_API_URL || 'https://api.uat.frankie.one',
    customerId: env.VITE_FRANKIE_CUSTOMER_ID || '',
    customerChildId: env.VITE_FRANKIE_CUSTOMER_CHILD_ID || '',
    apiKey: env.VITE_FRANKIE_API_KEY || '',
    clientId: env.VITE_SARDINE_CLIENT_ID || '',
    sardineEnv: env.VITE_SARDINE_ENV || 'sandbox',
  };
}

const envCreds = getEnvCredentials();
console.log(`[demo] Environment: ${envCreds.envName}`);
console.log(`[demo] API Server: ${envCreds.server}`);

function getProxyUrl(path) {
  return `/api-proxy${path}`;
}

function buildHeaders() {
  const creds = getEnvCredentials();
  const headers = {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': creds.customerId,
    'api_key': creds.apiKey,
  };
  if (creds.customerChildId) {
    headers['X-Frankie-CustomerChildID'] = creds.customerChildId;
  }
  return headers;
}

/**
 * Create a Sardine-backed session for an individual. The returned sessionId is
 * the key that ties the browser's device payload to the activity evaluation.
 */
export async function createIndividualSession(entityId) {
  const response = await fetch(getProxyUrl(`/v2/individuals/${entityId}/sessions`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ session: { providerName: 'sardine' } }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Failed to create individual session: ${response.status} ${body.errorMsg || ''}`);
  }
  const result = await response.json();
  return result.session;
}

/** Record an activity (LOGIN, PASSWORD_CHANGE, etc.) for monitoring, under a session token. */
export async function recordActivity(userId, sessionToken, activityType, entityType = 'INDIVIDUAL', riskAttributes = null) {
  const detail = {
    activityType: 'EVENT',
    eventType: activityType,
  };
  // An empty customAttributes object makes the API return 500.
  if (riskAttributes && Object.keys(riskAttributes).length) {
    detail.customAttributes = riskAttributes;
  }

  const response = await fetch(getProxyUrl('/v2/activities'), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      activity: {
        session: { token: sessionToken },
        party: { entityId: userId, entityType },
        detail,
      },
    }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('[API] Record activity failed:', response.status, errorBody);
    throw new Error(`Failed to record activity: ${response.status} - ${errorBody.errorMsg || JSON.stringify(errorBody)}`);
  }
  return response.json();
}

/**
 * Send a payment out of the customer's account to FrankieOne as a transaction
 * activity. Monitoring runs over it on the platform: on the demo account a
 * Sardine rule rates anything over $10,000 high, and the monitoring workflow
 * raises an ACTIVITY_FRAUD issue for review. Nothing comes back to show the
 * customer.
 *
 * A bank transfer needs an account number (pan) on both sides, or the API
 * rejects it. These are fixed demo numbers, not real accounts.
 */
export async function recordTransaction(entityId, sessionToken, { amount, payee }) {
  const detail = {
    activityType: 'TRANSACTION',
    transaction: {
      amount,
      currency: 'AUD',
      currencyType: 'FIAT',
      transferMethod: 'BANK_TRANSFER',
      counterpartyAmount: amount,
      counterpartyCurrency: 'AUD',
      counterpartyCurrencyType: 'FIAT',
      counterpartyTransferMethod: 'BANK_TRANSFER',
      transactionType: 'WITHDRAWAL',
      transactionIdentifier: `TX-${Date.now().toString(36).toUpperCase()}`,
      account: { type: 'SAVINGS', pan: '331387321', maskedPan: '******321', name: 'Demo account', class: 'PERSONAL' },
    },
    counterparty: {
      entityName: payee || 'Unknown payee',
      account: { type: 'SAVINGS', pan: '123783133', maskedPan: '******133', name: payee || 'Payee account', class: 'PERSONAL' },
    },
  };

  const response = await fetch(getProxyUrl('/v2/activities'), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      activity: {
        session: { token: sessionToken },
        party: { entityId, entityType: 'INDIVIDUAL' },
        detail,
      },
    }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Failed to record transaction: ${response.status} - ${errorBody.errorMsg || JSON.stringify(errorBody)}`);
  }
  return response.json();
}

/**
 * The hosted ID photo and selfie, for a member who has just passed the device
 * check on the member page. No SMS: the same phone browser is sent straight on,
 * so the device that was checked is the device that captures the ID.
 */
// No successRedirectURL: plain http:// return addresses are rejected (403),
// which is all a local dev server has. The hosted flow shows its own
// completion screen instead.
export async function generateMemberIdvUrl(entityId) {
  const response = await fetch(getProxyUrl('/v2/individuals/hostedUrl'), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      entityId,
      consent: true,
      oneSDKFlowId: 'idv_daon',
      sendSMS: false,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Failed to generate ID verification link: ${response.status} - ${JSON.stringify(errorBody)}`);
  }
  return response.json();
}
