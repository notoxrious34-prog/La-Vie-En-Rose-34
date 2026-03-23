const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function programDataDir() {
  const base = process.env.ProgramData || 'C:\\ProgramData';
  return path.join(base, 'LaVieEnRose34');
}

function licenseFilePath() {
  return path.join(programDataDir(), 'license.dat');
}

function ensureDir() {
  const dir = programDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function deriveKeys(machineId) {
  const encKey = crypto.scryptSync(machineId, 'LVR34:enc', 32);
  const macKey = crypto.scryptSync(machineId, 'LVR34:mac', 32);
  return { encKey, macKey };
}

function encryptPayload(plaintext, machineId) {
  const { encKey, macKey } = deriveKeys(machineId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const checksum = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
  const hmac = crypto.createHmac('sha256', macKey).update(plaintext, 'utf8').digest('hex');

  return {
    v: 1,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: data.toString('hex'),
    checksum,
    hmac
  };
}

function decryptPayload(container, machineId) {
  if (!container || container.v !== 1) return null;
  const { encKey, macKey } = deriveKeys(machineId);

  const iv = Buffer.from(container.iv, 'hex');
  const tag = Buffer.from(container.tag, 'hex');
  const data = Buffer.from(container.data, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');

  const checksum = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
  if (checksum !== container.checksum) return null;

  const hmac = crypto.createHmac('sha256', macKey).update(plaintext, 'utf8').digest('hex');
  if (hmac !== container.hmac) return null;

  return plaintext;
}

function saveLicenseCache({ payload, machineId }) {
  ensureDir();
  const file = licenseFilePath();
  const container = encryptPayload(JSON.stringify(payload), machineId);
  fs.writeFileSync(file, JSON.stringify(container));
  return file;
}

function loadLicenseCache({ machineId }) {
  const file = licenseFilePath();
  if (!fs.existsSync(file)) return null;
  try {
    const container = JSON.parse(fs.readFileSync(file, 'utf8'));
    const plaintext = decryptPayload(container, machineId);
    if (!plaintext) return null;
    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}

function removeLicenseCache() {
  const file = licenseFilePath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = {
  licenseFilePath,
  saveLicenseCache,
  loadLicenseCache,
  removeLicenseCache
};
