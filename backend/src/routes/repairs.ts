import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { getDb } from '../storage/db';
import { requireAuth, type AuthRequest } from '../middleware/auth';

export const repairsRouter = Router();
repairsRouter.use(requireAuth);

const createSchema = z.object({
  kind: z.enum(['repair', 'reservation']),
  customerId: z.string().optional(),
  title: z.string().optional(),
  dueAt: z.number().int().optional(),
  priceEstimate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'ready', 'delivered']),
});

repairsRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const now = Date.now();
  const orderId = nanoid();
  const orderNumberPrefix = parsed.data.kind === 'repair' ? 'R' : 'RSV';
  const orderNumber = `${orderNumberPrefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
  const qrToken = nanoid(16);

  try {
    const tx = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO orders(id,order_number,kind,status,qr_token,customer_id,subtotal,discount_total,tax_total,total,paid_total,change_due,profit_total,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `
      ).run(
        orderId,
        orderNumber,
        parsed.data.kind,
        'pending',
        qrToken,
        parsed.data.customerId ?? null,
        0,
        0,
        0,
        parsed.data.priceEstimate ?? 0,
        0,
        0,
        0,
        parsed.data.notes ?? null,
        now,
        now
      );

      db.prepare(
        `INSERT INTO order_repairs(order_id,title,due_at,price_estimate) VALUES (?,?,?,?)`
      ).run(orderId, parsed.data.title ?? null, parsed.data.dueAt ?? null, parsed.data.priceEstimate ?? null);
    });

    tx();

    const publicBase = process.env.LVER_PUBLIC_BASE_URL ?? 'http://localhost:5173';
    const publicStatusUrl = `${publicBase}/public/orders/${encodeURIComponent(orderNumber)}`;
    const apiStatusUrl = `http://localhost:8787/api/public/orders/${encodeURIComponent(orderNumber)}`;

    try {
      const dataUrl = await QRCode.toDataURL(publicStatusUrl, { margin: 1, scale: 6 });
      return res.status(201).json({
        id: orderId,
        orderNumber,
        qrToken,
        publicStatusUrl,
        apiStatusUrl,
        qr: { url: publicStatusUrl, dataUrl },
      });
    } catch {
      return res.status(201).json({
        id: orderId,
        orderNumber,
        qrToken,
        publicStatusUrl,
        apiStatusUrl,
      });
    }
  } catch (e: any) {
    return res.status(500).json({ error: 'db_error', detail: String(e?.message ?? e) });
  }
});

repairsRouter.patch('/:orderId/status', (req, res) => {
  const orderId = req.params.orderId;
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const now = Date.now();

  const existing = db
    .prepare(`SELECT id, kind FROM orders WHERE id=? AND kind IN ('repair','reservation')`)
    .get(orderId) as { id: string; kind: 'repair' | 'reservation' } | undefined;

  if (!existing) return res.status(404).json({ error: 'not_found' });

  db.prepare('UPDATE orders SET status=?, updated_at=? WHERE id=?').run(parsed.data.status, now, orderId);
  return res.json({ ok: true });
});

repairsRouter.get('/', (req, res) => {
  const kind = String(req.query.kind ?? '').trim();
  const status = String(req.query.status ?? '').trim();
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const db = getDb();

  const where: string[] = ["o.kind IN ('repair','reservation')"];
  const params: any[] = [];

  if (kind === 'repair' || kind === 'reservation') {
    where.push('o.kind=?');
    params.push(kind);
  }
  if (status) {
    where.push('o.status=?');
    params.push(status);
  }

  const rows = db
    .prepare(
      `
      SELECT o.*, r.title, r.due_at, r.price_estimate
      FROM orders o
      LEFT JOIN order_repairs r ON r.order_id=o.id
      WHERE ${where.join(' AND ')}
      ORDER BY o.updated_at DESC
      LIMIT ?
    `
    )
    .all(...params, limit);

  return res.json({ items: rows });
});

repairsRouter.get('/:orderId/qr', async (req, res) => {
  const orderId = req.params.orderId;
  const db = getDb();
  const row = db.prepare('SELECT order_number FROM orders WHERE id=?').get(orderId) as
    | { order_number: string }
    | undefined;

  if (!row) return res.status(404).json({ error: 'not_found' });

  const publicBase = process.env.LVER_PUBLIC_BASE_URL ?? 'http://localhost:5173';
  const publicStatusUrl = `${publicBase}/public/orders/${encodeURIComponent(row.order_number)}`;
  const apiStatusUrl = `http://localhost:8787/api/public/orders/${encodeURIComponent(row.order_number)}`;

  try {
    const dataUrl = await QRCode.toDataURL(publicStatusUrl, { margin: 1, scale: 6 });
    return res.json({ url: publicStatusUrl, apiStatusUrl, dataUrl });
  } catch (e: any) {
    return res.status(500).json({ error: 'qr_failed', detail: String(e?.message ?? e) });
  }
});
