/* Background banners for the Super Admin CRM. The page registers this worker. */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCblK72KXTNVLUWaUrEz4mAdFZLAFnUOI4',
  authDomain: 'sms-1085d.firebaseapp.com',
  projectId: 'sms-1085d',
  storageBucket: 'sms-1085d.firebasestorage.app',
  messagingSenderId: '157548521334',
  appId: '1:157548521334:web:36cbfc2f13cf917a9ffc57',
});

firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Catre';
  const body = payload.notification?.body || '';
  self.registration.showNotification(title, { body });
});
