const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

function getCurrentVersion() {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
}

function normalizeVersionString(v) {
  const raw = String(v || '').trim();
  if (!raw) return '0.0.0';
  return raw.startsWith('v') ? raw.slice(1) : raw;
}

function checkForUpdates() {
  return new Promise((resolve) => {
    const currentVersion = normalizeVersionString(getCurrentVersion());
    try {
      autoUpdater
        .checkForUpdates()
        .then((result) => {
          const info = result?.updateInfo;
          const latest = normalizeVersionString(info?.version || currentVersion);
          resolve({
            updateAvailable: Boolean(info && info.version && isNewerVersion(String(latest))),
            currentVersion,
            latestVersion: latest,
            releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : String(info?.releaseNotes || ''),
          });
        })
        .catch((err) => {
          log.warn('checkForUpdates failed', err);
          resolve({
            updateAvailable: false,
            currentVersion,
            latestVersion: currentVersion,
            releaseNotes: '',
            error: String(err?.message || err),
          });
        });
    } catch (err) {
      log.warn('checkForUpdates threw', err);
      resolve({
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseNotes: '',
        error: String(err?.message || err),
      });
    }
  });
}

function isNewerVersion(latestVersion) {
  const normalize = (v) => {
    const noPrefix = normalizeVersionString(v || '0.0.0');
    const core = noPrefix.split('+')[0].split('-')[0];
    return core
      .split('.')
      .slice(0, 3)
      .map((x) => {
        const n = parseInt(String(x || '').replace(/\D/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
      });
  };

  const current = normalize(getCurrentVersion());
  const latest = normalize(latestVersion);
  
  for (let i = 0; i < Math.max(current.length, latest.length); i++) {
    const c = current[i] || 0;
    const l = latest[i] || 0;
    
    if (l > c) return true;
    if (l < c) return false;
  }
  
  return false;
}

// Verify update signature/checksum
function verifyUpdateSignature(data, expectedSignature, publicKey = null) {
  if (!expectedSignature) return false;
  
  // If we have a public key, verify with it
  if (publicKey) {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data);
      return verify.verify(publicKey, expectedSignature, 'hex');
    } catch (e) {
      return false;
    }
  }
  
  // Otherwise use checksum comparison
  const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
  return calculatedChecksum === expectedSignature;
}

// Download update with progress
function downloadUpdate(downloadUrl, onProgress) {
  const unused = { downloadUrl, onProgress };
  void unused;

  return new Promise((resolve, reject) => {
    try {
      autoUpdater
        .downloadUpdate()
        .then(() => resolve({ success: true }))
        .catch((err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// Install update (placeholder - in production would use electron-updater or similar)
function installUpdate(updateFilePath) {
  const unused = { updateFilePath };
  void unused;

  return new Promise((resolve, reject) => {
    try {
      autoUpdater.quitAndInstall();
      resolve({ success: true });
    } catch (err) {
      reject(err);
    }
  });
}

function getUpdateSettings() {
  const appDataPath = path.join(app.getPath('userData'), 'data');
  const settingsPath = path.join(appDataPath, 'update-settings.json');
  
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return getDefaultUpdateSettings();
    }
  }
  
  return getDefaultUpdateSettings();
}

function getDefaultUpdateSettings() {
  return {
    autoCheck: true,
    lastCheck: null,
    skipVersion: null,
    channel: 'stable',
    installMode: 'onQuit'
  };
}

function saveUpdateSettings(settings) {
  const appDataPath = path.join(app.getPath('userData'), 'data');
  const settingsPath = path.join(appDataPath, 'update-settings.json');
  
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

module.exports = {
  getCurrentVersion,
  checkForUpdates,
  verifyUpdateSignature,
  downloadUpdate,
  installUpdate,
  getUpdateSettings,
  saveUpdateSettings
};
