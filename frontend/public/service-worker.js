/**
 * Mindspace service worker — Web Push notification handler.
 *
 * Lives at /public/service-worker.js so Vite copies it to the build
 * output root and the SW scope is the application root ('/').
 *
 * Loaded by pushService.js after the user explicitly opts in via the
 * Settings page (never on initial page load).
 *
 * Handlers:
 *   - install:           activate immediately (don't wait for next reload)
 *   - activate:          take control of any open clients
 *   - push:              render the notification with the payload from backend
 *   - notificationclick: focus an existing Mindspace tab, or open one
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  // The backend always sends JSON (see notificationService._buildPushPayload),
  // but be defensive in case it ever changes.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      title: 'Mindspace',
      body: event.data ? event.data.text() : 'You have a new notification'
    };
  }

  const title = data.title || 'Mindspace';
  const body  = data.body  || 'You have a new notification';
  // Use the event name as a notification tag so repeat events of the
  // same type replace earlier ones rather than stacking up.
  const tag   = data.tag || (data.data && data.data.event) || undefined;

  const options = {
    body,
    icon:   '/icon-192.png',         // Optional — OS falls back if absent
    badge:  '/badge-72.png',         // Optional
    tag,
    data:   data.data || {},
    requireInteraction: false,
    silent: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Prefer focusing an existing Mindspace tab; otherwise open one.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('/');
        return null;
      })
  );
});
