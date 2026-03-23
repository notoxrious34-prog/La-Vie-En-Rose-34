const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const APP_NAME = 'La-Vie-En-Rose-34';
const TRIAL_DAYS = 14;
const TRIAL_KEY = 'TRIAL-LVR34-XXXX-XXXX-XXXX';
const LICENSE_SERVER_URL = 'https://lavieenrose34.com/api';

// Tamper detection - verify critical files haven't been modified
function verifyIntegrity() {
  const { app } = require('electron');
  const possiblePaths = [
    path.join(app.getPath('userData'), 'data'),
    path.join(process.resourcesPath || '', 'backend'),
    path.join(process.resourcesPath || '', 'frontend')
  ];

  // Check if running from expected location
  const exePath = app.getPath('exe');
  const appPath = path.dirname(exePath);

  // Verify app is running from installed location (not extracted)
  if (appPath.includes('AppData') && !appPath.includes('la-vie-en-rose-34-pos')) {
    return false;
  }
  return true;
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

function getWindowsMachineGuid() {
  // Stable across reboots; changes only on OS reinstall.
  const out = safeExec('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
  const match = out.match(/MachineGuid\s+REG_\w+\s+([0-9a-fA-F-]+)/);
  return match?.[1] ?? '';
}

function getWindowsCpuId() {
  // ProcessorId may be blank on some systems.
  const out = safeExec('wmic cpu get ProcessorId');
  return parseFirstNonHeaderLine(out).replace(/\s+/g, '');
}

function getWindowsDiskSerial() {
  // SerialNumber is not always present; we take first disk.
  const out = safeExec('wmic diskdrive get SerialNumber');
  return parseFirstNonHeaderLine(out).replace(/\s+/g, '');
}

function getMachineId() {
  const cpus = os.cpus();
  const cpuModel = cpus?.[0]?.model ?? '';
  const cpuCount = cpus?.length ?? 0;
  const totalMem = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
  const platform = os.platform();
  const release = os.release();

  // Network MAC is a weak signal but helps distinguish some machines.
  const networkInterfaces = os.networkInterfaces();
  let macAddress = '';
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name] ?? []) {
      if (iface && !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        macAddress = iface.mac;
        break;
      }
    }
    if (macAddress) break;
  }

  let machineGuid = '';
  let cpuId = '';
  let diskSerial = '';
  if (process.platform === 'win32') {
    machineGuid = getWindowsMachineGuid();
    cpuId = getWindowsCpuId();
    diskSerial = getWindowsDiskSerial();
  }

  const machineString = [
    machineGuid,
    cpuId,
    diskSerial,
    macAddress,
    cpuModel,
    String(cpuCount),
    String(totalMem),
    platform,
    release
  ].join('|');

  return crypto.createHash('sha256').update(machineString).digest('hex').substring(0, 16).toUpperCase();
}

function getAppDataPath() {
  return path.join(require('electron').app.getPath('userData'), 'data');
}

function getLicensePath() {
  return path.join(getAppDataPath(), 'license.json');
}

function getTrialPath() {
  return path.join(getAppDataPath(), 'trial.json');
}

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = 'LVR34-';
  
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    key += segment + '-';
  }
  
  return key.substring(0, key.length - 1);
}

function validateLicenseFormat(licenseKey) {
  const pattern = /^LVR34-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(licenseKey);
}

function calculateChecksum(licenseKey) {
  const base = licenseKey.replace('LVR34-', '');
  const hash = crypto.createHash('sha256').update(base + 'LAVIEENROSE34').digest('hex');
  return hash.substring(0, 8).toUpperCase();
}

function isValidChecksum(licenseKey, expectedChecksum) {
  const calculated = calculateChecksum(licenseKey);
  return calculated === expectedChecksum;
}

function createLicense(licenseKey, expirationDays = null) {
  const machineId = getMachineId();
  const checksum = calculateChecksum(licenseKey);
  
  const license = {
    key: licenseKey,
    checksum: checksum,
    machineId: machineId,
    activatedAt: Date.now(),
    expiresAt: expirationDays ? Date.now() + (expirationDays * 24 * 60 * 60 * 1000) : null,
    version: '1.0.0'
  };
  
  const licensePath = getLicensePath();
  const dataDir = getAppDataPath();
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const encrypted = encryptLicense(license);
  fs.writeFileSync(licensePath, JSON.stringify(encrypted, null, 2));
  
  return license;
}

function encryptLicense(license) {
  const key = crypto.scryptSync(getMachineId(), 'laviesalt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(JSON.stringify(license), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    data: encrypted
  };
}

function decryptLicense(encrypted) {
  try {
    const key = crypto.scryptSync(getMachineId(), 'laviesalt', 32);
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

function loadLicense() {
  const licensePath = getLicensePath();
  
  if (!fs.existsSync(licensePath)) {
    return null;
  }
  
  try {
    const encrypted = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    return decryptLicense(encrypted);
  } catch (e) {
    return null;
  }
}

function validateLicense() {
  const license = loadLicense();
  
  if (!license) {
    return { valid: false, reason: 'no_license' };
  }
  
  if (!validateLicenseFormat(license.key)) {
    return { valid: false, reason: 'invalid_format' };
  }
  
  if (!isValidChecksum(license.key, license.checksum)) {
    return { valid: false, reason: 'invalid_checksum' };
  }
  
  if (license.expiresAt && license.expiresAt < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  
  const currentMachineId = getMachineId();
  if (license.machineId !== currentMachineId) {
    return { valid: false, reason: 'machine_mismatch' };
  }
  
  return { 
    valid: true, 
    license: license,
    daysRemaining: license.expiresAt ? Math.ceil((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)) : null
  };
}

function removeLicense() {
  const licensePath = getLicensePath();
  if (fs.existsSync(licensePath)) {
    fs.unlinkSync(licensePath);
  }
}

function getLicenseInfo() {
  const result = validateLicense();
  
  if (result.valid) {
    return {
      activated: true,
      key: result.license.key.substring(0, 8) + '-XXXX-XXXX-XXXX',
      activatedAt: result.license.activatedAt,
      expiresAt: result.license.expiresAt,
      daysRemaining: result.daysRemaining,
      version: result.license.version
    };
  }
  
  return {
    activated: false,
    reason: result.reason
  };
}

// Trial Mode Functions
function initTrial() {
  const trialPath = getTrialPath();
  const dataDir = getAppDataPath();
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(trialPath)) {
    const trial = {
      startedAt: Date.now(),
      expiresAt: Date.now() + (TRIAL_DAYS * 24 * 60 * 60 * 1000),
      machineId: getMachineId(),
      isActive: true
    };
    fs.writeFileSync(trialPath, JSON.stringify(trial, null, 2));
    return trial;
  }
  
  try {
    return JSON.parse(fs.readFileSync(trialPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function getTrialStatus() {
  const trialPath = getTrialPath();
  
  if (!fs.existsSync(trialPath)) {
    return { isActive: false, isTrial: false };
  }
  
  try {
    const trial = JSON.parse(fs.readFileSync(trialPath, 'utf8'));
    
    // Verify machine binding
    if (trial.machineId !== getMachineId()) {
      return { isActive: false, isTrial: true, reason: 'machine_mismatch' };
    }
    
    if (!trial.isActive) {
      return { isActive: false, isTrial: true, reason: 'expired' };
    }
    
    if (trial.expiresAt < Date.now()) {
      return { isActive: false, isTrial: true, reason: 'expired', expiredAt: trial.expiresAt };
    }
    
    const daysRemaining = Math.ceil((trial.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    
    return {
      isActive: true,
      isTrial: true,
      startedAt: trial.startedAt,
      expiresAt: trial.expiresAt,
      daysRemaining: daysRemaining
    };
  } catch (e) {
    return { isActive: false, isTrial: false };
  }
}

function disableTrial() {
  const trialPath = getTrialPath();
  if (fs.existsSync(trialPath)) {
    const trial = JSON.parse(fs.readFileSync(trialPath, 'utf8'));
    trial.isActive = false;
    fs.writeFileSync(trialPath, JSON.stringify(trial, null, 2));
  }
}

function getFullLicenseStatus() {
  // First check for valid license
  const licenseResult = validateLicense();
  if (licenseResult.valid) {
    return {
      status: 'licensed',
      activated: true,
      isTrial: false,
      key: licenseResult.license.key.substring(0, 8) + '-XXXX-XXXX-XXXX',
      daysRemaining: licenseResult.daysRemaining,
      expiresAt: licenseResult.license.expiresAt
    };
  }
  
  // Check trial status
  const trialResult = getTrialStatus();
  if (trialResult.isActive) {
    return {
      status: 'trial',
      activated: false,
      isTrial: true,
      daysRemaining: trialResult.daysRemaining,
      expiresAt: trialResult.expiresAt
    };
  }
  
  // Check if trial expired
  if (trialResult.isTrial && !trialResult.isActive) {
    return {
      status: 'expired',
      activated: false,
      isTrial: true,
      reason: 'trial_expired'
    };
  }
  
  // No license, no trial - needs activation
  return {
    status: 'unlicensed',
    activated: false,
    isTrial: false
  };
}

module.exports = {
  generateLicenseKey,
  validateLicenseFormat,
  createLicense,
  validateLicense,
  removeLicense,
  getLicenseInfo,
  getMachineId,
  verifyIntegrity,
  initTrial,
  getTrialStatus,
  disableTrial,
  getFullLicenseStatus,
  TRIAL_DAYS
};
