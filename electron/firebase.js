let app;
let auth;
let db;
let authReadyPromise;
let modulesPromise;

function firebaseConfig() {
  return {
    apiKey: 'AIzaSyALPyjWSFcMzxCtElgXl_sRts3PJLOzBd8',
    authDomain: 'lavieenrose-e9e3c.firebaseapp.com',
    projectId: 'lavieenrose-e9e3c',
    storageBucket: 'lavieenrose-e9e3c.appspot.com',
    messagingSenderId: '18015963927',
    appId: '1:18015963927:web:b1b6b42efe9a498f6fc552',
    measurementId: 'G-V1R4F699RF'
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
