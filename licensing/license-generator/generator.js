const crypto = require('crypto');

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

function calculateChecksum(licenseKey) {
  const base = licenseKey.replace('LVR34-', '');
  const hash = crypto.createHash('sha256').update(base + 'LAVIEENROSE34').digest('hex');
  return hash.substring(0, 8).toUpperCase();
}

function verifyChecksum(licenseKey, checksum) {
  return calculateChecksum(licenseKey) === checksum;
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

if (command === 'generate') {
  const count = parseInt(args[1]) || 1;
  const expirationDays = args[2] ? parseInt(args[2]) : null;
  
  console.log('\n🎫 Generated License Keys\n' + '='.repeat(50));
  console.log('Format: LVR34-XXXX-XXXX-XXXX');
  console.log('Checksum: SHA256(base + secret).substring(0, 8)\n');
  
  for (let i = 0; i < count; i++) {
    const key = generateLicenseKey();
    const checksum = calculateChecksum(key);
    console.log(`Key ${i + 1}: ${key}`);
    console.log(`Checksum: ${checksum}`);
    if (expirationDays) {
      const expires = new Date(Date.now() + expirationDays * 86400000);
      console.log(`Expires: ${expires.toISOString().split('T')[0]}`);
    }
    console.log('-'.repeat(50));
  }
  
  console.log(`\nTotal: ${count} license(s) generated`);
  
} else if (command === 'verify') {
  const key = args[1];
  
  if (!key) {
    console.log('Usage: node generator.js verify <LICENSE_KEY>');
    process.exit(1);
  }
  
  const checksum = calculateChecksum(key);
  const valid = verifyChecksum(key, checksum);
  
  console.log('\n🔍 License Verification\n' + '='.repeat(50));
  console.log(`Key: ${key}`);
  console.log(`Checksum: ${checksum}`);
  console.log(`Valid Format: ${/^LVR34-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key) ? '✅' : '❌'}`);
  console.log(`Valid Checksum: ${valid ? '✅' : '❌'}`);
  
} else if (command === 'batch') {
  const count = parseInt(args[1]) || 100;
  const fs = require('fs');
  
  const licenses = [];
  for (let i = 0; i < count; i++) {
    const key = generateLicenseKey();
    const checksum = calculateChecksum(key);
    licenses.push({ key, checksum });
  }
  
  const csv = ['key,checksum', ...licenses.map(l => `${l.key},${l.checksum}`)].join('\n');
  fs.writeFileSync('licenses.csv', csv);
  
  console.log(`\n✅ Exported ${count} licenses to licenses.csv`);
  
} else {
  console.log(`
🎫 La Vie En Rose 34 - License Key Generator

Usage:
  node generator.js generate [count] [expiration_days]
  node generator.js verify <LICENSE_KEY>
  node generator.js batch <count>

Examples:
  node generator.js generate 1 365     # Generate 1 key, expires in 365 days
  node generator.js generate 10        # Generate 10 keys, no expiration
  node generator.js verify LVR34-ABCD-EFGH-IJKL
  node generator.js batch 100          # Export 100 keys to CSV
`);
}
