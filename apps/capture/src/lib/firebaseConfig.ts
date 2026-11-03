// Public client config for crop-watch01 (CLAUDE.md Environment); safe to ship. Shared with the
// service worker, so it imports nothing from the DOM.
export const firebaseConfig = {
  apiKey: 'AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU',
  authDomain: 'crop-watch01.firebaseapp.com',
  projectId: 'crop-watch01',
  storageBucket: 'crop-watch01.firebasestorage.app',
  messagingSenderId: '24960589333',
  appId: '1:24960589333:web:cbe577be90032352c4f81c',
}

// FCM web-push (VAPID) public key from the Firebase console (Cloud Messaging → Web Push
// certificates). Public by design: browsers send it to the push service.
export const webPushPublicKey =
  'BKvyX4gUPtDav9yZ7v8YfEVvGrx1rkW2w94lgaFgh3mnoC1lyZkMlL-EQpKB0tkqq048C5WERI8Hk7Mb1qTs9d4'
