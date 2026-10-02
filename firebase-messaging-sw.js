// Legacy cleanup worker.
// Firebase Cloud Messaging is no longer used by this app; OneSignal owns push delivery.
// Keeping this file briefly lets browsers with an old registration fetch the update and unregister it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(self.registration.unregister());
});
