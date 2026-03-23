const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8888;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'lvr34-admin-secret-2024';

// Database setup
const DB_PATH = path.join(__dirname, 'licenses.db');
let db;

function initDatabase() {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      checksum TEXT NOT NULL,
      product_id TEXT DEFAULT 'LVR34',
      status TEXT DEFAULT 'available',
      created_at INTEGER NOT NULL,
      activated_at INTEGER,
      expires_at INTEGER,
      machine_id TEXT,
      machine_name TEXT,
      activation_token TEXT,
      max_activations INTEGER DEFAULT 1,
      current_activations INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS activations (
      id TEXT PRIMARY KEY,
      license_id TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      machine_name TEXT,
      ip_address TEXT,
      activated_at INTEGER NOT NULL,
      deactivated_at INTEGER,
      FOREIGN KEY(license_id) REFERENCES licenses(id)
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT,
      admin_key TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  
  console.log('Database initialized at:', DB_PATH);
}

// License key generation
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

function generateActivationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware
app.use(cors());
app.use(express.json());

// Log admin actions
function logAdminAction(action, details, adminKey) {
  const stmt = db.prepare(`
    INSERT INTO admin_logs (id, action, details, admin_key, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(uuidv4(), action, JSON.stringify(details), adminKey, Date.now());
}

// ============ PUBLIC API ============

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Activate license
app.post('/api/activate', (req, res) => {
  const { licenseKey, machineId, machineName } = req.body;
  
  if (!licenseKey || !machineId) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  
  try {
    // Find license
    const license = db.prepare('SELECT * FROM licenses WHERE key = ?').get(licenseKey);
    
    if (!license) {
      return res.json({ success: false, error: 'invalid_license' });
    }
    
    // Verify checksum
    const expectedChecksum = calculateChecksum(licenseKey);
    if (expectedChecksum !== license.checksum) {
      return res.json({ success: false, error: 'invalid_checksum' });
    }
    
    // Check if already activated on this machine
    if (license.machine_id === machineId && license.status === 'active') {
      // Re-issue token for existing activation
      const token = generateActivationToken();
      db.prepare('UPDATE licenses SET activation_token = ? WHERE id = ?').run(token, license.id);
      
      return res.json({
        success: true,
        activated: true,
        token: token,
        expiresAt: license.expires_at
      });
    }
    
    // Check activation limit
    if (license.current_activations >= license.max_activations) {
      return res.json({ success: false, error: 'activation_limit_reached' });
    }
    
    // Check if expired
    if (license.expires_at && license.expires_at < Date.now()) {
      return res.json({ success: false, error: 'expired' });
    }
    
    // Activate
    const token = generateActivationToken();
    const now = Date.now();
    
    db.prepare(`
      UPDATE licenses SET 
        status = 'active',
        activated_at = ?,
        machine_id = ?,
        machine_name = ?,
        activation_token = ?,
        current_activations = current_activations + 1
      WHERE id = ?
    `).run(now, machineId, machineName || 'Unknown', token, license.id);
    
    // Log activation
    db.prepare(`
      INSERT INTO activations (id, license_id, machine_id, machine_name, activated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), license.id, machineId, machineName || 'Unknown', now);
    
    logAdminAction('activation', { licenseKey, machineId, machineName });
    
    res.json({
      success: true,
      activated: true,
      token: token,
      expiresAt: license.expires_at
    });
    
  } catch (err) {
    console.error('Activation error:', err);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// Validate license
app.post('/api/validate', (req, res) => {
  const { licenseKey, machineId, activationToken } = req.body;
  
  if (!licenseKey || !machineId) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  
  try {
    const license = db.prepare('SELECT * FROM licenses WHERE key = ?').get(licenseKey);
    
    if (!license) {
      return res.json({ valid: false, reason: 'invalid_license' });
    }
    
    // Verify token if provided
    if (activationToken && license.activation_token !== activationToken) {
      return res.json({ valid: false, reason: 'invalid_token' });
    }
    
    // Check machine binding
    if (license.machine_id !== machineId) {
      return res.json({ valid: false, reason: 'machine_mismatch' });
    }
    
    // Check expiration
    if (license.expires_at && license.expires_at < Date.now()) {
      return res.json({ valid: false, reason: 'expired' });
    }
    
    if (license.status !== 'active') {
      return res.json({ valid: false, reason: 'not_active' });
    }
    
    res.json({
      valid: true,
      expiresAt: license.expires_at,
      daysRemaining: license.expires_at ? Math.ceil((license.expires_at - Date.now()) / (86400000)) : null
    });
    
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ valid: false, error: 'server_error' });
  }
});

// Deactivate license
app.post('/api/deactivate', (req, res) => {
  const { licenseKey, machineId } = req.body;
  
  if (!licenseKey || !machineId) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  
  try {
    const license = db.prepare('SELECT * FROM licenses WHERE key = ?').get(licenseKey);
    
    if (!license) {
      return res.json({ success: false, error: 'invalid_license' });
    }
    
    if (license.machine_id !== machineId) {
      return res.json({ success: false, error: 'not_activated_on_this_machine' });
    }
    
    // Deactivate
    const now = Date.now();
    db.prepare(`
      UPDATE licenses SET 
        status = 'available',
        machine_id = NULL,
        machine_name = NULL,
        activation_token = NULL,
        activated_at = NULL
      WHERE id = ?
    `).run(license.id);
    
    // Log deactivation
    db.prepare(`
      UPDATE activations SET deactivated_at = ? 
      WHERE license_id = ? AND deactivated_at IS NULL
    `).run(now, license.id);
    
    logAdminAction('deactivation', { licenseKey, machineId });
    
    res.json({ success: true });
    
  } catch (err) {
    console.error('Deactivation error:', err);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// ============ ADMIN API ============

// Admin authentication middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Generate single license
app.post('/admin/generate', requireAdmin, (req, res) => {
  const { expirationDays = null, maxActivations = 1, notes = '' } = req.body;
  
  const key = generateLicenseKey();
  const checksum = calculateChecksum(key);
  const id = uuidv4();
  const now = Date.now();
  
  const expiresAt = expirationDays ? now + (expirationDays * 86400000) : null;
  
  db.prepare(`
    INSERT INTO licenses (id, key, checksum, status, created_at, expires_at, max_activations, notes)
    VALUES (?, ?, ?, 'available', ?, ?, ?, ?)
  `).run(id, key, checksum, now, expiresAt, maxActivations, notes);
  
  logAdminAction('generate', { key, expirationDays, maxActivations }, 'admin');
  
  res.json({
    success: true,
    license: {
      key,
      checksum,
      expiresAt,
      maxActivations,
      notes
    }
  });
});

// Generate bulk licenses
app.post('/admin/generate-bulk', requireAdmin, (req, res) => {
  const { count = 10, expirationDays = null, maxActivations = 1, notes = '' } = req.body;
  
  const licenses = [];
  const now = Date.now();
  const expiresAt = expirationDays ? now + (expirationDays * 86400000) : null;
  
  const insert = db.prepare(`
    INSERT INTO licenses (id, key, checksum, status, created_at, expires_at, max_activations, notes)
    VALUES (?, ?, ?, 'available', ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((count) => {
    for (let i = 0; i < count; i++) {
      const key = generateLicenseKey();
      const checksum = calculateChecksum(key);
      const id = uuidv4();
      insert.run(id, key, checksum, now, expiresAt, maxActivations, notes);
      licenses.push({ key, checksum });
    }
  });
  
  insertMany(count);
  
  logAdminAction('generate_bulk', { count, expirationDays, maxActivations }, 'admin');
  
  res.json({
    success: true,
    count,
    licenses
  });
});

// Get all licenses
app.get('/admin/licenses', requireAdmin, (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  
  let query = 'SELECT * FROM licenses';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const licenses = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM licenses' + (status ? ' WHERE status = ?' : '')).get(status || undefined);
  
  res.json({
    licenses,
    total: total.count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// Get license details
app.get('/admin/license/:key', requireAdmin, (req, res) => {
  const { key } = req.params;
  
  const license = db.prepare('SELECT * FROM licenses WHERE key = ?').get(key);
  
  if (!license) {
    return res.status(404).json({ error: 'License not found' });
  }
  
  const activations = db.prepare('SELECT * FROM activations WHERE license_id = ? ORDER BY activated_at DESC').all(license.id);
  
  res.json({ license, activations });
});

// Update license
app.patch('/admin/license/:key', requireAdmin, (req, res) => {
  const { key } = req.params;
  const { status, expiresAt, maxActivations, notes } = req.body;
  
  const updates = [];
  const params = [];
  
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (expiresAt !== undefined) {
    updates.push('expires_at = ?');
    params.push(expiresAt);
  }
  if (maxActivations !== undefined) {
    updates.push('max_activations = ?');
    params.push(maxActivations);
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    params.push(notes);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }
  
  params.push(key);
  
  db.prepare(`UPDATE licenses SET ${updates.join(', ')} WHERE key = ?`).run(...params);
  
  logAdminAction('update', { key, updates: req.body }, 'admin');
  
  res.json({ success: true });
});

// Delete license
app.delete('/admin/license/:key', requireAdmin, (req, res) => {
  const { key } = req.params;
  
  db.prepare('DELETE FROM licenses WHERE key = ?').run(key);
  
  logAdminAction('delete', { key }, 'admin');
  
  res.json({ success: true });
});

// Get activation logs
app.get('/admin/activations', requireAdmin, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  
  const activations = db.prepare(`
    SELECT a.*, l.key as license_key
    FROM activations a
    JOIN licenses l ON a.license_id = l.id
    ORDER BY a.activated_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const total = db.prepare('SELECT COUNT(*) as count FROM activations').get();
  
  res.json({
    activations,
    total: total.count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// Get admin logs
app.get('/admin/logs', requireAdmin, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  
  const logs = db.prepare(`
    SELECT * FROM admin_logs
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const total = db.prepare('SELECT COUNT(*) as count FROM admin_logs').get();
  
  res.json({
    logs,
    total: total.count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// Export licenses to CSV
app.get('/admin/export', requireAdmin, (req, res) => {
  const licenses = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all();
  
  const headers = ['Key', 'Checksum', 'Status', 'Created', 'Activated', 'Expires', 'Machine ID', 'Machine Name', 'Activations', 'Max', 'Notes'];
  const rows = licenses.map(l => [
    l.key,
    l.checksum,
    l.status,
    new Date(l.created_at).toISOString(),
    l.activated_at ? new Date(l.activated_at).toISOString() : '',
    l.expires_at ? new Date(l.expires_at).toISOString() : '',
    l.machine_id || '',
    l.machine_name || '',
    l.current_activations,
    l.max_activations,
    l.notes || ''
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=licenses.csv');
  res.send(csv);
});

// Stats
app.get('/admin/stats', requireAdmin, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM licenses').get();
  const active = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'active'").get();
  const available = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'available'").get();
  const expired = db.prepare('SELECT COUNT(*) as count FROM licenses WHERE expires_at < ? AND status = ?').get(Date.now(), 'active');
  const totalActivations = db.prepare('SELECT COUNT(*) as count FROM activations').get();
  
  res.json({
    total: total.count,
    active: active.count,
    available: available.count,
    expired: expired.count,
    totalActivations: totalActivations.count
  });
});

// Start server
initDatabase();
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   La Vie En Rose 34 - License Server                      ║
║   Running on http://localhost:${PORT}                        ║
║                                                           ║
║   Admin endpoints:                                        ║
║   - POST /admin/generate     (generate single key)        ║
║   - POST /admin/generate-bulk (generate multiple keys)    ║
║   - GET  /admin/licenses    (list all licenses)           ║
║   - GET  /admin/stats       (server statistics)           ║
║                                                           ║
║   Use header: Authorization: Bearer ${ADMIN_SECRET}       ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
