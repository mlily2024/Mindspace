/**
 * Client-side push notification manager.
 *
 * Wraps the browser's ServiceWorker + PushManager APIs behind a small,
 * predictable surface for the UI:
 *
 *   isSupported()      — true when the browser supports Web Push at all
 *   getStatus()        — 'unsupported' | 'denied' | 'granted' | 'default'
 *   getSubscription()  — current PushSubscription, or null
 *   enable()           — request permission, subscribe, sync with backend
 *   disable()          — unsubscribe from browser + backend
 *
 * All functions are async and return { ok, error?, ... } result objects
 * so the UI never has to wrap them in try/catch.
 *
 * MUST be called from a user-gesture event handler when triggering
 * enable() — browsers reject permission prompts otherwise.
 */

import { pushAPI } from './api';

const SERVICE_WORKER_URL = '/service-worker.js';

/** True when this browser supports Web Push. */
export const isSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager'   in window     &&
    'Notification'  in window
  );
};

/**
 * Returns one of: 'unsupported' | 'denied' | 'granted' | 'default'.
 * 'granted' means the user has previously granted permission (a current
 * subscription may or may not exist — use getSubscription() to check).
 */
export const getStatus = () => {
  if (!isSupported()) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
};

/** Return the currently-active PushSubscription, or null. */
export const getSubscription = async () => {
  if (!isSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (_) {
    return null;
  }
};

/**
 * Convert a URL-safe base64 VAPID public key into the Uint8Array that
 * PushManager.subscribe() expects in `applicationServerKey`.
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const arr     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

/**
 * Opt in: request permission, register the service worker, subscribe via
 * VAPID, and POST the subscription to the backend.
 *
 * MUST be called from a user-gesture handler (button onClick).
 *
 * @returns {Promise<{ok: boolean, error?: string, subscription?: PushSubscription}>}
 */
export const enable = async () => {
  if (!isSupported()) {
    return { ok: false, error: 'This browser does not support push notifications.' };
  }

  // 1. Permission prompt (browser only accepts within a user gesture).
  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    return { ok: false, error: 'Permission request failed: ' + err.message };
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'Permission was not granted.' };
  }

  // 2. Fetch VAPID public key from the backend.
  let publicKey;
  try {
    const res = await pushAPI.getVapidPublicKey();
    publicKey = res && res.data && res.data.publicKey;
    if (!publicKey) {
      return { ok: false, error: 'The server has no VAPID public key configured.' };
    }
  } catch (_) {
    return { ok: false, error: 'Could not reach the server to fetch the push key.' };
  }

  // 3. Register the service worker (idempotent).
  let registration;
  try {
    registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await navigator.serviceWorker.ready;
  } catch (err) {
    return { ok: false, error: 'Could not register the service worker: ' + err.message };
  }

  // 4. Subscribe via PushManager (reuse existing subscription if one is present).
  let subscription;
  try {
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
  } catch (err) {
    return { ok: false, error: 'Could not subscribe to push: ' + err.message };
  }

  // 5. Sync the subscription with the backend.
  try {
    const json = subscription.toJSON();
    await pushAPI.subscribe({ endpoint: json.endpoint, keys: json.keys });
  } catch (_) {
    return { ok: false, error: 'Could not register the subscription with the server.' };
  }

  return { ok: true, subscription };
};

/**
 * Opt out: tell the backend to drop the subscription, then unsubscribe
 * from PushManager. Best-effort — partial failures are recoverable
 * because the backend auto-prunes stale endpoints on later send attempts.
 *
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export const disable = async () => {
  if (!isSupported()) {
    return { ok: false, error: 'This browser does not support push notifications.' };
  }
  try {
    const subscription = await getSubscription();
    if (!subscription) return { ok: true }; // nothing to do

    // Tell the backend first so the DB row is gone even if browser unsubscribe fails.
    try {
      await pushAPI.unsubscribe({ endpoint: subscription.endpoint });
    } catch (_) {
      // Best-effort — auto-prune covers stragglers.
    }

    await subscription.unsubscribe();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

export default { isSupported, getStatus, getSubscription, enable, disable };
