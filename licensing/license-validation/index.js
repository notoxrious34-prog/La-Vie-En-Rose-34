const crypto = require('crypto');

const PRODUCT_ID = 'LVR34';

function normalizeKey(key) {
  return String(key || '').trim().toUpperCase();
}

function validateLicenseFormat(licenseKey) {
  const k = normalizeKey(licenseKey);
  const pattern = new RegExp(`^${PRODUCT_ID}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`);
  return pattern.test(k);
}

function checksumSecret() {
  return process.env.LVR34_LICENSE_SECRET || 'LAVIEENROSE34';
}

function calculateChecksum(licenseKey) {
  const k = normalizeKey(licenseKey);
  const base = k.replace(`${PRODUCT_ID}-`, '');
  const hash = crypto.createHash('sha256').update(base + checksumSecret()).digest('hex');
  return hash.substring(0, 8).toUpperCase();
}

function verifyChecksum(licenseKey, checksum) {
  return calculateChecksum(licenseKey) === normalizeKey(checksum);
}

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = PRODUCT_ID + '-';

  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    key += segment + '-';
  }

  return key.substring(0, key.length - 1);
}

module.exports = {
  PRODUCT_ID,
  validateLicenseFormat,
  calculateChecksum,
  verifyChecksum,
  generateLicenseKey
};
