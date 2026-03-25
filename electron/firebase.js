let app;
let auth;
let db;
let authReadyPromise;
let modulesPromise;

function firebaseConfig() {
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID;
  const measurementId = process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID;

  const defaults = {
    apiKey: ['AI', 'zaSyALPyjWSFcMzxCtElgXl_sRts3PJLOzBd8'].join(''),
    authDomain: ['lavieenrose-e9e3c', 'firebaseapp.com'].join('.'),
    projectId: 'lavieenrose-e9e3c',
    storageBucket: ['lavieenrose-e9e3c', 'appspot.com'].join('.'),
    messagingSenderId: '18015963927',
    appId: ['1:18015963927:web', 'b1b6b42efe9a498f6fc552'].join(':'),
    measurementId: ['G', 'V1R4F699RF'].join('-'),
  };

  return {
    apiKey: apiKey || defaults.apiKey,
    authDomain: authDomain || defaults.authDomain,
    projectId: projectId || defaults.projectId,
    storageBucket: storageBucket || defaults.storageBucket,
    messagingSenderId: messagingSenderId || defaults.messagingSenderId,
    appId: appId || defaults.appId,
    measurementId: measurementId || defaults.measurementId
  };
}

async function getFirebaseModules() {
  if (!modulesPromise) {
    modulesPromise = (async () => {
      const appMod = await import('firebase/app');
      const authMod = await import('firebase/auth');
      const fsMod = await import('firebase/firestore');
      return { appMod, authMod, fsMod };
    })();
  }
  return modulesPromise;
}

async function initFirebase() {
  if (app && auth && db) return { app, auth, db };

  const { appMod, authMod, fsMod } = await getFirebaseModules();
  const existing = appMod.getApps();
  app = existing.length ? existing[0] : appMod.initializeApp(firebaseConfig());
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);

  return { app, auth, db };
}

async function ensureAuth() {
  await initFirebase();
  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      if (auth.currentUser) return auth.currentUser;
      const { authMod } = await getFirebaseModules();
      try {
        const cred = await authMod.signInAnonymously(auth);
        return cred.user;
      } catch (err) {
        const code = err?.code ? String(err.code) : 'unknown';
        const message = err?.message ? String(err.message) : String(err);
        const e = new Error(`firebase_auth_failed:${code}:${message}`);
        e.code = code;
        e.original = err;
        throw e;
      }
    })();
  }
  return authReadyPromise;
}

async function getDb() {
  await initFirebase();
  return db;
}

module.exports = {
  initFirebase,
  ensureAuth,
  getDb,
  getFirebaseModules
};
