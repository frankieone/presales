import { getEnvCredentials } from './api';

let sardineInitialized = false;
let appSessionToken = null;
let sardineContext = null;

function resolveSardineHost(environment) {
  if (environment === 'usaprod') return 'api.sardine.ai';
  if (environment === 'ausprod') return 'api.au.sardine.ai';
  return 'api.sandbox.sardine.ai';
}

function loadSardineScript(environment = 'sandbox') {
  return new Promise((resolve, reject) => {
    if (window._Sardine) {
      resolve();
      return;
    }

    const sardineHost = resolveSardineHost(environment);
    const script = document.createElement('script');
    script.src = `https://${sardineHost}/assets/loader.min.js`;
    script.async = true;

    script.onload = () => {
      setTimeout(() => {
        if (window._Sardine) resolve();
        else reject(new Error('Sardine script loaded but globals not available'));
      }, 100);
    };
    script.onerror = () => reject(new Error('Failed to load Sardine script'));
    document.head.appendChild(script);
  });
}

// Resolvers waiting for Sardine to report that it has collected the device.
let pendingDeviceResolvers = [];

/**
 * Point the running SDK at a different session key.
 *
 * Sardine boots with an app-level key, but an activity is evaluated against the
 * key it is sent with. Unless the SDK is re-keyed to the same session the
 * activity uses, the device and IP Sardine collected sit against a different
 * session and no device or location rule can fire — while every call still
 * returns 200.
 */
export function setSardineSessionId(sessionId) {
  if (!sardineInitialized || !sardineContext || !sessionId) return;
  appSessionToken = sessionId;
  sardineContext.updateConfig({ sessionKey: sessionId });
  console.log('[Sardine] Session key set to:', sessionId);
}

/**
 * Resolve once Sardine has sent the device payload, or after `timeoutMs`.
 * Without this the activity can reach the server before the device does and be
 * evaluated with no device context at all.
 */
export function waitForDeviceResponse(timeoutMs = 5000) {
  if (!sardineInitialized) return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => pendingDeviceResolvers.push(resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function initializeSardine(sessionToken) {
  if (sardineInitialized) return;

  appSessionToken = sessionToken;
  const creds = getEnvCredentials();
  const clientId = creds.clientId;
  const sardineEnv = creds.sardineEnv || 'sandbox';

  try {
    await loadSardineScript(sardineEnv);

    if (!clientId) {
      console.warn('[Sardine] No clientId configured, skipping');
      return;
    }

    sardineContext = window._Sardine.createContext({
      clientId,
      sessionKey: appSessionToken,
      environment: sardineEnv,
      parentElement: document.body,
      flow: 'login',
      onDeviceResponse: () => {
        console.log('[Sardine] Device response received');
        pendingDeviceResolvers.splice(0).forEach((r) => r());
      },
    });

    sardineInitialized = true;
    console.log('[Sardine] Initialized with session:', appSessionToken);
  } catch (error) {
    console.error('[Sardine] Initialization failed:', error);
    throw error;
  }
}

export async function updateSardineConfig(options) {
  if (!sardineInitialized || !sardineContext) return;

  const { userIdHash, flow } = options;
  try {
    sardineContext.updateConfig({
      userIdHash,
      sessionKey: appSessionToken,
      flow: flow || 'login',
    });
  } catch (error) {
    console.error('[Sardine] Failed to update config:', error);
  }
}

export function updateSardineFlow(flow) {
  if (!sardineContext) return;
  try {
    sardineContext.updateConfig({ flow });
    console.log('[Sardine] Flow updated to:', flow);
  } catch (error) {
    console.warn('[Sardine] Failed to update flow:', error);
  }
}
