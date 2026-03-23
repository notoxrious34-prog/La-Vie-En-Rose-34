import { Router } from 'express';
import { getDb } from '../storage/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const storeSettingsUpdateSchema = z
  .object({
    store_name: z.string().trim().min(1).max(160).nullable().optional(),
    owner_name: z.string().trim().min(1).max(160).nullable().optional(),
    store_logo: z.string().trim().min(1).max(2000).nullable().optional(),
    address: z.string().trim().min(1).max(300).nullable().optional(),
    city: z.string().trim().min(1).max(120).nullable().optional(),
    postal_code: z.string().trim().min(1).max(30).nullable().optional(),
    phone: z.string().trim().min(3).max(40).nullable().optional(),
    email: z.string().trim().email().max(200).nullable().optional(),
    currency: z.string().trim().min(2).max(10).nullable().optional(),
    currency_symbol: z.string().trim().min(1).max(10).nullable().optional(),
    tax_rate: z.coerce.number().min(0).max(100).nullable().optional(),
    tax_label: z.string().trim().min(1).max(30).nullable().optional(),
    invoice_footer: z.string().trim().min(1).max(2000).nullable().optional(),
    qr_code_enabled: z.coerce.boolean().nullable().optional(),
    business_hours: z.string().trim().min(1).max(500).nullable().optional(),
    invoice_prefix: z.string().trim().min(1).max(20).nullable().optional(),
    auto_backup: z.coerce.boolean().nullable().optional(),
    nif: z.string().trim().min(1).max(40).nullable().optional(),
    nis: z.string().trim().min(1).max(40).nullable().optional(),
    rc: z.string().trim().min(1).max(40).nullable().optional(),
    art: z.string().trim().min(1).max(40).nullable().optional(),
    article_tva: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .strict();

const invoiceQrSchema = z
  .object({
    invoice_number: z.string().trim().min(1).max(60),
    date: z.string().trim().min(1).max(40),
    total_amount: z.coerce.number().finite().min(0).max(1_000_000_000),
  })
  .strict();

// Get store settings
settingsRouter.get('/store', (_req, res) => {
  const db = getDb();
  let settings = db.prepare('SELECT * FROM store_settings WHERE id = ?').get('default');
  
  if (!settings) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO store_settings (id, store_name, currency, currency_symbol, tax_rate, tax_label, qr_code_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('default', 'La Vie En Rose 34', 'DZD', 'DA', 0, 'TVA', 1, now, now);
    settings = db.prepare('SELECT * FROM store_settings WHERE id = ?').get('default');
  }
  
  res.json(settings);
});

// Update store settings
settingsRouter.put('/store', requireRole(['admin']), (req, res) => {
  const db = getDb();

  const parsed = storeSettingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
  }

  const {
    store_name,
    owner_name,
    store_logo,
    address,
    city,
    postal_code,
    phone,
    email,
    currency,
    currency_symbol,
    tax_rate,
    tax_label,
    invoice_footer,
    qr_code_enabled,
    business_hours,
    invoice_prefix,
    auto_backup,
    nif,
    nis,
    rc,
    art,
    article_tva,
  } = parsed.data;
  const now = Date.now();

  const dbQrEnabled = qr_code_enabled == null ? undefined : (qr_code_enabled ? 1 : 0);
  const dbAutoBackup = auto_backup == null ? undefined : (auto_backup ? 1 : 0);

  db.prepare(`
    UPDATE store_settings SET 
      store_name = COALESCE(?, store_name),
      owner_name = COALESCE(?, owner_name),
      store_logo = COALESCE(?, store_logo),
      address = COALESCE(?, address),
      city = COALESCE(?, city),
      postal_code = COALESCE(?, postal_code),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      currency = COALESCE(?, currency),
      currency_symbol = COALESCE(?, currency_symbol),
      tax_rate = COALESCE(?, tax_rate),
      tax_label = COALESCE(?, tax_label),
      invoice_footer = COALESCE(?, invoice_footer),
      qr_code_enabled = COALESCE(?, qr_code_enabled),
      business_hours = COALESCE(?, business_hours),
      invoice_prefix = COALESCE(?, invoice_prefix),
      auto_backup = COALESCE(?, auto_backup),
      nif = COALESCE(?, nif),
      nis = COALESCE(?, nis),
      rc = COALESCE(?, rc),
      art = COALESCE(?, art),
      article_tva = COALESCE(?, article_tva),
      updated_at = ?
    WHERE id = 'default'
  `).run(
    store_name,
    owner_name,
    store_logo,
    address,
    city,
    postal_code,
    phone,
    email,
    currency,
    currency_symbol,
    tax_rate,
    tax_label,
    invoice_footer,
    dbQrEnabled,
    business_hours,
    invoice_prefix,
    dbAutoBackup,
    nif,
    nis,
    rc,
    art,
    article_tva,
    now
  );

  // Log activity
  const userId = (req as any).user?.id;
  if (userId) {
    db.prepare(`
      INSERT INTO activity_logs (id, user_id, action, entity_type, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nanoid(), userId, 'settings_updated', 'store', JSON.stringify(Object.keys(parsed.data)), now);
  }

  res.json({ success: true });
});

// Get notifications for current user
settingsRouter.get('/notifications', requireAuth, (req, res) => {
  const db = getDb();
  const userId = (req as any).user.id;
  const { limit = 20, unread_only } = req.query;
  
  let query = `SELECT * FROM notifications WHERE user_id = ?`;
  if (unread_only === 'true') {
    query += ` AND read = 0`;
  }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  
  const items = db.prepare(query).all(userId, Number(limit));
  const unread = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`).get(userId) as { count: number };
  
  res.json({ items, unread_count: unread.count });
});

// Mark notification as read
settingsRouter.patch('/notifications/:id/read', requireAuth, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const userId = (req as any).user.id;
  
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`).run(id, userId);
  res.json({ success: true });
});

// Mark all notifications as read
settingsRouter.post('/notifications/read-all', requireAuth, (req, res) => {
  const db = getDb();
  const userId = (req as any).user.id;
  
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(userId);
  res.json({ success: true });
});

// Create notification (internal)
export function createNotification(db: any, userId: string | null, type: string, title: string, message?: string) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nanoid(), userId, type, title, message, now);
}

// Get backups
settingsRouter.get('/backups', requireRole(['admin']), (_req, res) => {
  const db = getDb();
  const items = db.prepare(`SELECT * FROM backups ORDER BY created_at DESC LIMIT 20`).all();
  res.json({ items });
});

// Create manual backup
settingsRouter.post('/backups', requireRole(['admin']), (req, res) => {
  void req;
  return res.status(501).json({
    error: 'not_implemented',
    code: 'backup_electron_only',
    message: 'Backups are managed by the Electron app. Use the Electron backup API instead of the backend endpoint.',
  });
});

// Restore backup
settingsRouter.post('/backups/:filename/restore', requireRole(['admin']), (req, res) => {
  void req;
  return res.status(501).json({
    error: 'not_implemented',
    code: 'restore_electron_only',
    message: 'Restore is managed by the Electron app to safely stop the backend before replacing the database.',
  });
});

// Get invoice number (auto-increment based on sales count for current year)
settingsRouter.get('/invoice/next-number', requireAuth, (_req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT invoice_prefix FROM store_settings WHERE id = ?').get('default') as { invoice_prefix: string } | undefined;
  const prefix = settings?.invoice_prefix || 'LVR';
  const now = new Date();
  const year = now.getFullYear();
  // Count all sales this year to derive next sequential invoice number
  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0).getTime();
  const yearEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0).getTime();
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM orders WHERE kind='sale' AND created_at >= ? AND created_at < ?`
  ).get(yearStart, yearEnd) as { cnt: number } | undefined;
  const nextNum = (row?.cnt ?? 0) + 1;
  const invoiceNumber = `${prefix}-${year}-${String(nextNum).padStart(5, '0')}`;
  res.json({ invoice_number: invoiceNumber, next: nextNum });
});

// Get store settings for invoices (includes legal info)
settingsRouter.get('/store/for-invoice', requireAuth, (_req, res) => {
  const db = getDb();
  const settings = db.prepare(`
    SELECT store_name, owner_name, store_logo, address, city, postal_code, phone, email,
           nif, nis, rc, art, article_tva, currency_symbol, tax_rate, tax_label
    FROM store_settings WHERE id = ?
  `).get('default');
  res.json(settings);
});

// Generate QR code data for invoice
settingsRouter.post('/invoice/qrcode', requireAuth, (req, res) => {
  const parsed = invoiceQrSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
  }

  const { invoice_number, date, total_amount } = parsed.data;
  
  // QR code data format: Invoice number | Date | Total amount
  const qrData = `${invoice_number}|${date}|${total_amount}`;
  
  // Return the data that can be used to generate QR code on frontend
  res.json({ qr_data: qrData, format: 'INV|DATE|AMOUNT' });
});
