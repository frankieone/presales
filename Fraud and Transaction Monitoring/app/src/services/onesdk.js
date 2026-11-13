import { getEnvCredentials } from './api';

// OneSDK's session server for the environment. UAT accounts use the
// kycaml.uat backend; override in .env.local for other environments.
const ONESDK_BFF = import.meta.env.VITE_FRANKIE_BFF_URL || 'https://backend.kycaml.uat.frankiefinancial.io';

async function getMachineSession(reference, entityId) {
  const creds = getEnvCredentials();
  const authParts = [creds.customerId];
  if (creds.customerChildId) {
    authParts.push(creds.customerChildId);
  }
  authParts.push(creds.apiKey);
  const authString = btoa(authParts.join(':'));

  const bffServer = ONESDK_BFF;
  console.log('[OneSDK] Using BFF server:', bffServer);

  const response = await fetch(`${bffServer}/auth/v2/machine-session`, {
    method: 'POST',
    headers: {
      'authorization': `machine ${authString}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      permissions: {
        preset: 'one-sdk',
        reference,
        // Binds the OneSDK session to an existing person, so what it collects
        // is held against them.
        ...(entityId ? { entityId } : {}),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get machine session: ${response.status}`);
  }
  return response.json();
}

function loadOneSDKScript() {
  return new Promise((resolve, reject) => {
    if (typeof window.OneSDK === 'function') {
      resolve(window.OneSDK);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://assets.frankiefinancial.io/one-sdk/v1/oneSdk.umd.js';
    script.async = true;

    script.onload = () => {
      setTimeout(() => {
        const sdk = window.OneSdk || window.OneSDK || window.oneSdk;
        if (typeof sdk === 'function') {
          resolve(sdk);
        } else {
          reject(new Error('OneSDK loaded but function not available'));
        }
      }, 500);
    };

    script.onerror = () => reject(new Error('Failed to load OneSDK script'));
    document.head.appendChild(script);
  });
}

/**
 * Embedded OneSDK, device module only, for one existing person.
 *
 * The test this exists for: does device data collected by OneSDK running in
 * our own page reach the person's onboarding fraud workflow? The hosted flow
 * (idv_daon_device) left the device step at BAD_DATA_DEVICE, even when re-run
 * ten minutes later. `onEvent(name, payload)` reports every device event.
 */
export async function startEmbeddedDevice(entityId, onEvent = () => {}) {
  const creds = getEnvCredentials();
  const OneSDK = await loadOneSDKScript();
  onEvent('script_loaded');
  const session = await getMachineSession(`device-check-${entityId}`, entityId);
  onEvent('session_created', { entityId: session?.entityId || null });
  const sdk = await OneSDK({
    session,
    mode: 'development',
    recipe: {
      deviceCharacteristics: {
        provider: { name: 'sardine', clientID: creds.clientId, environment: creds.sardineEnv || 'sandbox' },
      },
    },
  });
  const device = sdk.component('device', { activityType: 'REGISTRATION' });
  [
    'configuration_loaded', 'vendor_sdk_loaded', 'vendor_sdk_failed_loading', 'session_data_generated',
    'activity_started', 'device_characteristics_extracted', 'completed', 'error',
    'DEVICE:MOUNT', 'DEVICE:MOUNT:ERROR',
  ].forEach((name) => device.on(name, (payload) => onEvent(name, payload)));
  device.start();
  return sdk;
}
