import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../storage/db';
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth';

export const posRouter = Router();
posRouter.use(requireAuth);

function computeVipTier(lifetimeSpendTotal: number): 'none' | 'silver' | 'gold' | 'platinum' {
  if (lifetimeSpendTotal >= 1_000_000) return 'platinum';
  if (lifetimeSpendTotal >= 500_000) return 'gold';
  if (lifetimeSpendTotal >= 200_000) return 'silver';
  return 'none';
}

const listSalesSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const createSaleSchema = z.object({
  customerId: z.string().optional(),
  discountTotal: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
        discount: z.number().nonnegative().default(0),
      })
    )
    .min(1),
  payments: z
    .array(
      z.object({
        method: z.enum(['cash', 'cib', 'edahabia', 'transfer', 'mixed']),
        amount: z.number().nonnegative(),
        details: z.string().optional(),
      })
    )
    .min(1),
});

posRouter.post('/sales', requirePermission('use_pos'), (req: AuthRequest, res) => {
  const parsed = createSaleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const now = Date.now();
  const orderId = nanoid();
  const orderNumber = `S-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  try {
    let customerUpdate:
      | { pointsEarned: number; customerLoyaltyPoints: number; customerVipTier: 'none' | 'silver' | 'gold' | 'platinum' }
      | null = null;

    let computedTotals: { subtotal: number; total: number; paidTotal: number; changeDue: number } | null = null;

    const tx = db.transaction(() => {
      let subtotal = 0;
      let profitTotal = 0;

      db.prepare(
        `
        INSERT INTO orders(id,order_number,kind,status,customer_id,subtotal,discount_total,tax_total,total,paid_total,change_due,profit_total,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `
      ).run(
        orderId,
        orderNumber,
        'sale',
        'delivered',
        parsed.data.customerId ?? null,
        0,
        parsed.data.discountTotal,
        0,
        0,
        0,
        0,
        0,
        parsed.data.notes ?? null,
        now,
        now
      );

      for (const item of parsed.data.items) {
        const v = db
          .prepare(
            `
            SELECT v.id as variant_id, v.size, v.color, COALESCE(v.sale_price,p.sale_price) as sale_price,
                   p.id as product_id, p.name, p.cost_price
            FROM product_variants v
            JOIN products p ON p.id=v.product_id
            WHERE v.id=? AND v.active=1 AND p.active=1
          `
          )
          .get(item.variantId) as
          | {
              variant_id: string;
              size: string | null;
              color: string | null;
              sale_price: number;
              product_id: string;
              name: string;
              cost_price: number;
            }
          | undefined;

        if (!v) throw new Error('variant_not_found');

        const inv = db
          .prepare('SELECT quantity FROM inventory WHERE variant_id=?')
          .get(item.variantId) as { quantity: number } | undefined;
        const available = inv?.quantity ?? 0;
        if (available < item.quantity) throw new Error('insufficient_stock');

        const unitPrice = item.unitPrice ?? v.sale_price;
        const lineTotal = unitPrice * item.quantity - item.discount;
        subtotal += lineTotal;
        profitTotal += (unitPrice - (v.cost_price ?? 0)) * item.quantity;

        db.prepare(
          `
          INSERT INTO order_items(id,order_id,product_id,variant_id,name,size,color,quantity,unit_price,unit_cost,discount,total,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `
        ).run(
          nanoid(),
          orderId,
          v.product_id,
          v.variant_id,
          v.name,
          v.size,
          v.color,
          item.quantity,
          unitPrice,
          v.cost_price ?? 0,
          item.discount,
          lineTotal,
          now
        );

        db.prepare(
          `UPDATE inventory SET quantity=quantity-?, updated_at=? WHERE variant_id=?`
        ).run(item.quantity, now, item.variantId);
      }

      const total = Math.max(0, subtotal - parsed.data.discountTotal);
      const paidTotal = parsed.data.payments.reduce((s, p) => s + p.amount, 0);

      if (paidTotal + 1e-9 < total) throw new Error('insufficient_payment');

      const cashPaid = parsed.data.payments
        .filter((p) => p.method === 'cash')
        .reduce((s, p) => s + p.amount, 0);

      const nonCashPaid = Math.max(0, paidTotal - cashPaid);
      const remainingAfterNonCash = Math.max(0, total - nonCashPaid);
      const changeDue = Math.max(0, cashPaid - remainingAfterNonCash);

      computedTotals = { subtotal, total, paidTotal, changeDue };

      for (const p of parsed.data.payments) {
        db.prepare(
          `INSERT INTO payments(id,order_id,method,amount,details,created_at) VALUES (?,?,?,?,?,?)`
        ).run(nanoid(), orderId, p.method, p.amount, p.details ?? null, now);
      }

      db.prepare(
        `
        UPDATE orders SET subtotal=?, total=?, paid_total=?, change_due=?, profit_total=?, updated_at=?
        WHERE id=?
      `
      ).run(subtotal, total, paidTotal, changeDue, profitTotal, now, orderId);

      if (parsed.data.customerId) {
        const current = db
          .prepare('SELECT loyalty_points, lifetime_spend_total, vip_override_tier FROM customers WHERE id=?')
          .get(parsed.data.customerId) as
          | { loyalty_points: number; lifetime_spend_total: number; vip_override_tier: string | null }
          | undefined;
        if (current) {
          const pointsEarned = Math.floor(total / 100);
          const nextSpend = Number(current.lifetime_spend_total ?? 0) + total;
          const computedTier = computeVipTier(nextSpend);
          const effectiveTier = current.vip_override_tier ?? computedTier;
          const nextPoints = Math.max(0, Number(current.loyalty_points ?? 0) + pointsEarned);

          db.prepare(
            'UPDATE customers SET loyalty_points=?, lifetime_spend_total=?, vip=?, updated_at=? WHERE id=?'
          ).run(
            nextPoints,
            nextSpend,
            effectiveTier !== 'none' ? 1 : 0,
            now,
            parsed.data.customerId
          );

          customerUpdate = {
            pointsEarned,
            customerLoyaltyPoints: nextPoints,
            customerVipTier: effectiveTier as 'none' | 'silver' | 'gold' | 'platinum',
          };
        }
      }
    });

    tx();
    return res
      .status(201)
      .json({ id: orderId, orderNumber, loyalty: customerUpdate, ...(computedTotals ?? {}) });
  } catch (e: any) {
    return res.status(400).json({ error: 'sale_failed', detail: String(e?.message ?? e) });
  }
});

posRouter.get('/daily-summary', requirePermission('use_pos'), (req, res) => {
  try {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    const [y, m, d] = date.split('-').map((x) => Number(x));
    const dayStart = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
    const dayEnd = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).getTime();

    const db = getDb();
    const row = db
      .prepare(
        `
        SELECT
          COUNT(*) as ordersCount,
          COALESCE(SUM(total),0) as salesTotal,
          COALESCE(SUM(profit_total),0) as profitTotal
        FROM orders
        WHERE kind='sale' AND created_at BETWEEN ? AND ?
      `
      )
      .get(dayStart, dayEnd) as { ordersCount: number; salesTotal: number; profitTotal: number };

    return res.json({ date, ...row });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    return res.status(500).json({ error: 'db_error', message: 'Failed to fetch daily summary' });
  }
});

posRouter.get('/sales', requirePermission('use_pos'), (req, res) => {
  const parsed = listSalesSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query' });

  const db = getDb();

  try {
    const parseLocalDateRange = (s: string, endOfDay: boolean) => {
      const [y, m, d] = s.split('-').map((x) => Number(x));
      return endOfDay
        ? new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).getTime()
        : new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
    };

    const from = parsed.data.from ? parseLocalDateRange(parsed.data.from, false) : undefined;
    const to = parsed.data.to ? parseLocalDateRange(parsed.data.to, true) : undefined;
    const limit = parsed.data.limit;

    const where: string[] = ["kind='sale'"];
    const params: any[] = [];
    if (typeof from === 'number' && !Number.isNaN(from)) {
      where.push('created_at >= ?');
      params.push(from);
    }
    if (typeof to === 'number' && !Number.isNaN(to)) {
      where.push('created_at <= ?');
      params.push(to);
    }

    const rows = db
      .prepare(
        `
        SELECT id, order_number, subtotal, discount_total, total, paid_total, change_due, created_at
        FROM orders
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ?
      `
      )
      .all(...params, limit) as Array<{
      id: string;
      order_number: string;
      subtotal: number;
      discount_total: number;
      total: number;
      paid_total: number;
      change_due: number;
      created_at: number;
    }>;

    return res.json({
      items: rows.map((r) => ({
        id: r.id,
        orderNumber: r.order_number,
        subtotal: r.subtotal,
        discountTotal: r.discount_total,
        total: r.total,
        paidTotal: r.paid_total,
        changeDue: r.change_due,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return res.status(500).json({ error: 'db_error', message: 'Failed to fetch sales' });
  }
});

posRouter.get('/sales/:id', requirePermission('use_pos'), (req, res) => {
  try {
    const id = String(req.params.id || '');
    const db = getDb();

    const order = db
      .prepare(
        `
        SELECT id, order_number, subtotal, discount_total, total, paid_total, change_due, created_at
        FROM orders
        WHERE id=? AND kind='sale'
      `
      )
      .get(id) as
      | {
          id: string;
          order_number: string;
          subtotal: number;
          discount_total: number;
          total: number;
          paid_total: number;
          change_due: number;
          created_at: number;
        }
      | undefined;

    if (!order) return res.status(404).json({ error: 'not_found' });

    const items = db
      .prepare(
        `
        SELECT name, quantity, unit_price, discount, total
        FROM order_items
        WHERE order_id=?
        ORDER BY created_at ASC
      `
      )
      .all(id) as Array<{ name: string; quantity: number; unit_price: number; discount: number; total: number }>;

    const payments = db
      .prepare(
        `
        SELECT method, amount
        FROM payments
        WHERE order_id=?
        ORDER BY created_at ASC
      `
      )
      .all(id) as Array<{ method: 'cash' | 'cib' | 'edahabia' | 'transfer' | 'mixed' | 'card'; amount: number }>;

    return res.json({
      id: order.id,
      orderNumber: order.order_number,
      subtotal: order.subtotal,
      discountTotal: order.discount_total,
      total: order.total,
      paidTotal: order.paid_total,
      changeDue: order.change_due,
      createdAt: order.created_at,
      items: items.map((it) => ({
        name: it.name,
        unitPrice: it.unit_price,
        quantity: it.quantity,
        discount: it.discount,
        total: it.total,
      })),
      payments: payments.map((p) => ({
        method: p.method === 'card' ? 'cib' : p.method,
        amount: p.amount,
      })),
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    return res.status(500).json({ error: 'db_error', message: 'Failed to fetch sale' });
  }
});
