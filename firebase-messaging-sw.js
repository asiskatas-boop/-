importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBMsCKD2XexYnzfe1DXKF6mJMZ5P21k2Fw",
  authDomain: "filaki.firebaseapp.com",
  projectId: "filaki",
  storageBucket: "filaki.firebasestorage.app",
  messagingSenderId: "1067934466927",
  appId: "1:1067934466927:web:a22eaae83ebc4e2d975e9a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || '💋', {
    body: body || 'You got a kiss!',
    icon: '/icon.png',
    badge: '/icon.png'
  });
});