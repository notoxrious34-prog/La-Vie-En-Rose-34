const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

const { ensureAuth, getDb, getFirebaseModules } = require('./firebase');
const cache = require('./license-cache');

async function fs() {
  const { fsMod } = await getFirebaseModules();
  return fsMod;
}

async function tryLogActivationEvent({ action, licenseKey, machineId }) {
  try {
    const db = await getDb();
    const { collection, addDoc, serverTimestamp, doc, setDoc } = await fs();

    await addDoc(collection(db, 'activations'), {
      licenseKey,
      machineId,
      action,
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, 'devices', machineId), {
      machineId,
      lastSeenAt: serverTimestamp(),
      lastLicenseKey: licenseKey
    }, { merge: true });
  } catch {
    // Telemetry must never block licensing.
  }
}

const LICENSE_COLLECTION = 'licenses';
const PRODUCT_PREFIX = 'LVR34';
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function graceDaysRemaining(lastOnlineAt) {
  if (!lastOnlineAt) return 0;
  const remainingMs = OFFLINE_GRACE_MS - (Date.now() - lastOnlineAt);
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 86400000);
}

function normalizeKey(key) {
  return String(key || '').trim().toUpperCase();
}

function validateLicenseFormat(licenseKey) {
  const pattern = new RegExp(`^${PRODUCT_PREFIX}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`);
  return pattern.test(normalizeKey(licenseKey));
}

function safeExec(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim();
  } catch {
    return '';
  }
}

function parseFirstNonHeaderLine(output) {
  if (!output) return '';
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return '';
  return lines[1] ?? '';
}

function getWindowsCpuId() {
  const out = safeExec('wmic cpu get ProcessorId');
  return parseFirstNonHeaderLine(out).replace(/\s+/g, '');
}

function getWindowsBaseboardId() {
  // Prefer SerialNumber; fallback to Product.
  const serialOut = safeExec('wmic baseboard get SerialNumber');
  const serial = parseFirstNonHeaderLine(serialOut).replace(/\s+/g, '');
  if (serial && serial.toLowerCase() !== 'to' && serial.toLowerCase() !== 'be' && serial.toLowerCase() !== 'filled' && serial.toLowerCase() !== 'by' && serial.toLowerCase() !== 'o.e.m.') {
    return serial;
  }

  const prodOut = safeExec('wmic baseboard get Product');
  return parseFirstNonHeaderLine(prodOut).replace(/\s+/g, '');
}

function getMachineId() {
  const username = os.userInfo()?.username ?? '';
  const platform = os.platform();
  const release = os.release();

  let cpuId = '';
  let baseboardId = '';
  if (process.platform === 'win32') {
    cpuId = getWindowsCpuId();
    baseboardId = getWindowsBaseboardId();
  }

  const machineString = [baseboardId, cpuId, username, platform, release].join('|');
  return crypto.createHash('sha256').update(machineString).digest('hex').substring(0, 16).toUpperCase();
}

function computePayloadSignature(payload, machineId) {
  const secret = process.env.LVR34_LOCAL_SIGNATURE_SECRET || 'LVR34_LOCAL_SIG_V1';
  const base = [
    payload.licenseKey,
    payload.machineId,
    String(payload.activationDate),
    payload.plan || '',
    String(payload.type || ''),
    String(payload.devicesAllowed || ''),
    String(payload.expiresAt || ''),
    String(payload.lastOnlineAt || '')
  ].join('|');
  return crypto.createHmac('sha256', crypto.scryptSync(machineId, secret, 32)).update(base).digest('hex');
}

function timestampToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

function normalizeLicenseType(t) {
  const v = String(t || '').trim().toLowerCase();
  if (v === 'lifetime') return 'lifetime';
  if (v === 'subscription') return 'subscription';
  return 'subscription';
}

function isSubscriptionExpired(expiresAt) {
  return Boolean(expiresAt && expiresAt < Date.now());
}

function subscriptionGraceDaysRemaining(expiresAt) {
  if (!expiresAt) return 0;
  const remainingMs = OFFLINE_GRACE_MS - (Date.now() - expiresAt);
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 86400000);
}

async function activateLicense(licenseKey) {
  const key = normalizeKey(licenseKey);
  if (!validateLicenseFormat(key)) {
    return { success: false, error: 'invalid_format' };
  }

  const machineId = getMachineId();
  const db = await getDb();

  try {
    await ensureAuth();

    const { doc, runTransaction, serverTimestamp } = await fs();

    const result = await runTransaction(db, async (tx) => {
      const ref = doc(db, LICENSE_COLLECTION, key);
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        return { ok: false, error: 'not_found' };
      }

      const data = snap.data();
      const status = data.status;
      const plan = data.plan ?? 'unknown';
      const type = normalizeLicenseType(data.type);
      const devicesAllowed = Number(data.devicesAllowed ?? 1);
      const expiresAt = type === 'lifetime' ? null : timestampToMillis(data.expiresAt);
      const createdAt = timestampToMillis(data.createdAt);
      const activatedDevices = Array.isArray(data.activatedDevices) ? data.activatedDevices : [];

      if (status !== 'active') {
        return { ok: false, error: 'license_inactive' };
      }

      if (type === 'subscription' && isSubscriptionExpired(expiresAt)) {
        // Allow activation within subscription grace window, otherwise block.
        if (Date.now() - expiresAt > OFFLINE_GRACE_MS) {
          return { ok: false, error: 'expired' };
        }
      }

      const already = activatedDevices.includes(machineId);
      if (!already) {
        if (activatedDevices.length >= devicesAllowed) {
          return { ok: false, error: 'device_limit' };
        }
        const next = [...activatedDevices, machineId];
        tx.update(ref, {
          activatedDevices: next,
          lastActivationAt: serverTimestamp()
        });
      }

      return {
        ok: true,
        license: {
          key,
          licenseKey: key,
          machineId,
          activationDate: Date.now(),
          lastOnlineAt: Date.now(),
          plan,
          type,
          devicesAllowed,
          expiresAt,
          createdAt,
          status
        }
      };
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    const payload = result.license;
    payload.signature = computePayloadSignature(payload, machineId);
    cache.saveLicenseCache({ payload, machineId });

    await tryLogActivationEvent({ action: 'activate', licenseKey: key, machineId });

    return { success: true, license: payload };
  } catch (err) {
    const code = err?.code ? String(err.code) : (err?.original?.code ? String(err.original.code) : undefined);
    const message = err?.message ? String(err.message) : String(err);
    return {
      success: false,
      error: 'network_or_firestore_error',
      firebaseCode: code,
      details: message
    };
  }
}

async function validateOnline(licenseKey, machineId) {
  const db = await getDb();
  await ensureAuth();

  const { doc, getDoc } = await fs();

  const ref = doc(db, LICENSE_COLLECTION, normalizeKey(licenseKey));
  const snap = await getDoc(ref);
  if (!snap.exists()) return { valid: false, reason: 'not_found' };

  const data = snap.data();
  const status = data.status;
  const plan = data.plan ?? 'unknown';
  const type = normalizeLicenseType(data.type);
  const devicesAllowed = Number(data.devicesAllowed ?? 1);
  const expiresAt = type === 'lifetime' ? null : timestampToMillis(data.expiresAt);
  const activatedDevices = Array.isArray(data.activatedDevices) ? data.activatedDevices : [];

  if (status !== 'active') return { valid: false, reason: 'license_inactive' };

  if (type === 'subscription' && isSubscriptionExpired(expiresAt)) {
    if (Date.now() - expiresAt > OFFLINE_GRACE_MS) {
      return { valid: false, reason: 'expired' };
    }
    // still valid within grace window
  }

  if (!activatedDevices.includes(machineId)) return { valid: false, reason: 'device_not_registered' };

  return {
    valid: true,
    plan,
    type,
    expiresAt,
    devicesAllowed,
    deviceCount: activatedDevices.length
  };
}

async function getLicenseStatus() {
  const machineId = getMachineId();
  const cached = cache.loadLicenseCache({ machineId });
  if (!cached) {
    return { status: 'unlicensed', activated: false, machineId };
  }

  if (cached.machineId !== machineId) {
    return { status: 'invalid', activated: false, machineId, reason: 'machine_mismatch' };
  }

  const expectedSig = computePayloadSignature(cached, machineId);
  if (cached.signature !== expectedSig) {
    return { status: 'invalid', activated: false, machineId, reason: 'tampered' };
  }

  const cachedType = normalizeLicenseType(cached.type);
  const cachedExpiresAt = cachedType === 'lifetime' ? null : cached.expiresAt;

  if (cachedType === 'subscription' && isSubscriptionExpired(cachedExpiresAt)) {
    if (Date.now() - cachedExpiresAt > OFFLINE_GRACE_MS) {
      return { status: 'expired', activated: false, machineId, reason: 'expired' };
    }
  }

  const lastOnlineAt = typeof cached.lastOnlineAt === 'number' ? cached.lastOnlineAt : cached.activationDate;

  // Try online validation; if offline, allow.
  try {
    const online = await validateOnline(cached.licenseKey, machineId);
    if (!online.valid) {
      return { status: 'invalid', activated: false, machineId, reason: online.reason };
    }

    // Persist last successful online verification for offline grace.
    const updated = {
      ...cached,
      plan: online.plan ?? cached.plan,
      type: online.type ?? cached.type,
      expiresAt: online.expiresAt ?? cached.expiresAt,
      lastOnlineAt: Date.now()
    };
    updated.signature = computePayloadSignature(updated, machineId);
    cache.saveLicenseCache({ payload: updated, machineId });

    await tryLogActivationEvent({ action: 'validate', licenseKey: cached.licenseKey, machineId });

    return {
      status: 'licensed',
      activated: true,
      machineId,
      key: cached.licenseKey,
      plan: online.plan,
      type: online.type,
      devicesAllowed: online.devicesAllowed,
      deviceCount: online.deviceCount,
      expiresAt: online.expiresAt,
      activationDate: cached.activationDate,
      lastOnlineAt: updated.lastOnlineAt,
      offlineGraceDaysRemaining: graceDaysRemaining(updated.lastOnlineAt)
    };
  } catch {
    // Offline: enforce both offline grace and (for subscription) expiration grace.
    if (cachedType === 'subscription' && isSubscriptionExpired(cachedExpiresAt)) {
      if (Date.now() - cachedExpiresAt > OFFLINE_GRACE_MS) {
        return { status: 'expired', activated: false, machineId, reason: 'expired' };
      }
    }

    if (lastOnlineAt && Date.now() - lastOnlineAt > OFFLINE_GRACE_MS) {
      return {
        status: 'invalid',
        activated: false,
        machineId,
        reason: 'offline_grace_expired'
      };
    }
    return {
      status: 'licensed',
      activated: true,
      machineId,
      key: cached.licenseKey,
      plan: cached.plan,
      type: cachedType,
      devicesAllowed: cached.devicesAllowed,
      expiresAt: cachedType === 'lifetime' ? null : cached.expiresAt,
      offline: true
      ,
      activationDate: cached.activationDate,
      lastOnlineAt,
      offlineGraceDaysRemaining: graceDaysRemaining(lastOnlineAt)
    };
  }
}

async function getLicenseInfo() {
  const machineId = getMachineId();
  const cached = cache.loadLicenseCache({ machineId });

  const status = await getLicenseStatus();
  if (!status.activated || !cached) {
    return { activated: false, reason: status.reason || 'unlicensed', machineId: status.machineId };
  }

  const daysRemaining = status.expiresAt
    ? Math.ceil((status.expiresAt - Date.now()) / 86400000)
    : null;

  return {
    activated: true,
    key: status.key ? status.key.substring(0, 8) + '-XXXX-XXXX-XXXX' : undefined,
    plan: status.plan,
    type: status.type,
    devicesAllowed: status.devicesAllowed,
    deviceCount: status.deviceCount,
    expiresAt: status.expiresAt ?? null,
    daysRemaining,
    machineId: status.machineId,
    offline: Boolean(status.offline),
    activationDate: cached.activationDate,
    lastOnlineAt: typeof cached.lastOnlineAt === 'number' ? cached.lastOnlineAt : cached.activationDate,
    offlineGraceDaysRemaining: status.offlineGraceDaysRemaining,
    subscriptionGraceDaysRemaining: status.type === 'subscription' ? subscriptionGraceDaysRemaining(status.expiresAt ?? null) : null
  };
}

async function deactivateLicense() {
  const machineId = getMachineId();
  const cached = cache.loadLicenseCache({ machineId });
  if (!cached) {
    return { success: true };
  }

  try {
    await ensureAuth();
    const db = await getDb();

    const { doc, runTransaction } = await fs();

    await runTransaction(db, async (tx) => {
      const ref = doc(db, LICENSE_COLLECTION, normalizeKey(cached.licenseKey));
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const activatedDevices = Array.isArray(data.activatedDevices) ? data.activatedDevices : [];
      const next = activatedDevices.filter((d) => d !== machineId);
      tx.update(ref, { activatedDevices: next });
    });
  } catch {
    // ignore network errors for local deactivation
  }

  cache.removeLicenseCache();
  await tryLogActivationEvent({ action: 'deactivate', licenseKey: cached.licenseKey, machineId });
  return { success: true };
}

module.exports = {
  validateLicenseFormat,
  getMachineId,
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  getLicenseInfo
};
