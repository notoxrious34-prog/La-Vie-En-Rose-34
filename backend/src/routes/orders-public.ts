import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../storage/db';
import { requireAuth, type AuthRequest } from '../middleware/auth';

export const ordersPublicRouter = Router();

ordersPublicRouter.get('/:orderNumber', (req, res) => {
  const orderNumber = req.params.orderNumber;
  const db = getDb();

  const row = db
    .prepare(
      `SELECT o.id, o.order_number, o.kind, o.status, o.total, o.created_at, o.updated_at,
              c.full_name as customer_name, c.phone as customer_phone
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.order_number=?`
    )
    .get(orderNumber) as
    | { id: string; order_number: string; kind: string; status: string; total: number; created_at: number; updated_at: number; customer_name: string; customer_phone: string }
    | undefined;

  if (!row) return res.status(404).json({ error: 'not_found' });

  const items = db
    .prepare(
      `SELECT name, quantity, unit_price, total FROM order_items WHERE order_id=?`
    )
    .all(row.id) as { name: string; quantity: number; unit_price: number; total: number }[];

  return res.json({
    orderNumber: row.order_number,
    kind: row.kind,
    status: row.status,
    total: row.total,
    customerName: row.customer_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items
  });
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'ready', 'completed']),
});

ordersPublicRouter.patch('/:orderNumber/status', requireAuth, (req: AuthRequest, res) => {
  const { orderNumber } = req.params;
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });
  const { status } = parsed.data;

  const db = getDb();
  const now = Date.now();
  
  db.prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE order_number = ?`)
    .run(status, now, orderNumber);

  res.json({ success: true, status });
});
