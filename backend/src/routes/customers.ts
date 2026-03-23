import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../storage/db';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';
import {
  sendBadRequest,
  sendCreated,
  sendError,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from '../lib/response';

export const customersRouter = Router();
customersRouter.use(requireAuth);

const VIP_TIERS = ['none', 'silver', 'gold', 'platinum'] as const;
type VipTier = (typeof VIP_TIERS)[number];

function computeVipTier(lifetimeSpendTotal: number): VipTier {
  if (lifetimeSpendTotal >= 1_000_000) return 'platinum';
  if (lifetimeSpendTotal >= 500_000) return 'gold';
  if (lifetimeSpendTotal >= 200_000) return 'silver';
  return 'none';
}

const upsertSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  vip: z.boolean().default(false),
  vipOverrideTier: z.enum(VIP_TIERS).optional(),
});

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  vip: z.boolean().optional(),
  vipOverrideTier: z.enum(VIP_TIERS).nullable().optional(),
});

const adjustPointsSchema = z.object({
  delta: z.number().int(),
  reason: z.string().optional(),
});

customersRouter.get('/', (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const db = getDb();

    if (!q) {
      const rows = db
        .prepare(
          `
          SELECT id, full_name, phone, email, notes,
                 loyalty_points, lifetime_spend_total,
                 vip, vip_override_tier,
                 created_at, updated_at
          FROM customers
          ORDER BY updated_at DESC
          LIMIT ?
        `
        )
        .all(limit) as any[];

      const items = rows.map((r) => {
        const computed = computeVipTier(Number(r.lifetime_spend_total ?? 0));
        const tier = (r.vip_override_tier as VipTier | null) ?? computed;
        return {
          ...r,
          vipTier: tier,
          vip: tier !== 'none' ? 1 : 0,
        };
      });

      return res.json({ items });
    }

    const like = `%${q}%`;
    const rows = db
      .prepare(
        `
        SELECT id, full_name, phone, email, notes,
               loyalty_points, lifetime_spend_total,
               vip, vip_override_tier,
               created_at, updated_at
        FROM customers
        WHERE full_name LIKE ? OR phone LIKE ?
        ORDER BY updated_at DESC
        LIMIT ?
      `
      )
      .all(like, like, limit) as any[];

    const items = rows.map((r) => {
      const computed = computeVipTier(Number(r.lifetime_spend_total ?? 0));
      const tier = (r.vip_override_tier as VipTier | null) ?? computed;
      return {
        ...r,
        vipTier: tier,
        vip: tier !== 'none' ? 1 : 0,
      };
    });

    return res.json({ items });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return sendInternalError(req, res, 'Failed to fetch customers');
  }
});

customersRouter.post('/', requireRole(['admin', 'employee']), (req: AuthRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(req, res, 'invalid_body');

  const db = getDb();
  const id = nanoid();
  const now = Date.now();

  try {
    db.prepare(
      `
      INSERT INTO customers(id,full_name,phone,email,notes,loyalty_points,lifetime_spend_total,vip,vip_override_tier,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `
    ).run(
      id,
      parsed.data.fullName,
      parsed.data.phone ?? null,
      parsed.data.email ?? null,
      parsed.data.notes ?? null,
      0,
      0,
      parsed.data.vip ? 1 : 0,
      parsed.data.vipOverrideTier ?? null,
      now,
      now
    );
    return sendCreated(res, { id });
  } catch (e: any) {
    return sendInternalError(req, res, 'Failed to create customer');
  }
});

customersRouter.patch('/:id', requireRole(['admin', 'employee']), (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return sendBadRequest(req, res, 'invalid_body');

    const db = getDb();
    const now = Date.now();
    const cur = db
      .prepare(
        'SELECT id, full_name, phone, email, notes, loyalty_points, lifetime_spend_total, vip, vip_override_tier FROM customers WHERE id=?'
      )
      .get(id) as any;
    if (!cur) return sendNotFound(req, res);

    const next = {
      full_name: parsed.data.fullName ?? cur.full_name,
      phone: parsed.data.phone ?? cur.phone,
      email: parsed.data.email ?? cur.email,
      notes: parsed.data.notes ?? cur.notes,
      vip: typeof parsed.data.vip === 'boolean' ? (parsed.data.vip ? 1 : 0) : Number(cur.vip ?? 0),
      vip_override_tier:
        parsed.data.vipOverrideTier === undefined ? cur.vip_override_tier : parsed.data.vipOverrideTier,
    };

    db.prepare(
      `
      UPDATE customers
      SET full_name=?, phone=?, email=?, notes=?, vip=?, vip_override_tier=?, updated_at=?
      WHERE id=?
    `
    ).run(
      next.full_name,
      next.phone ?? null,
      next.email ?? null,
      next.notes ?? null,
      next.vip,
      next.vip_override_tier,
      now,
      id
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('Error updating customer:', e);
    return sendInternalError(req, res, 'Failed to update customer');
  }
});

customersRouter.post('/:id/loyalty/adjust', requireRole(['admin', 'employee']), (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const parsed = adjustPointsSchema.safeParse(req.body);
    if (!parsed.success) return sendBadRequest(req, res, 'invalid_body');

    const db = getDb();
    const now = Date.now();
    const cur = db.prepare('SELECT loyalty_points FROM customers WHERE id=?').get(id) as { loyalty_points: number } | undefined;
    if (!cur) return sendNotFound(req, res);

    const next = Math.max(0, Number(cur.loyalty_points ?? 0) + parsed.data.delta);
    db.prepare('UPDATE customers SET loyalty_points=?, updated_at=? WHERE id=?').run(next, now, id);
    return res.json({ ok: true, loyaltyPoints: next });
  } catch (e: any) {
    console.error('Error adjusting loyalty points:', e);
    return sendInternalError(req, res, 'Failed to adjust loyalty points');
  }
});

// DELETE customer
customersRouter.delete('/:id', requireRole(['admin']), (req: AuthRequest, res) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM customers WHERE id=?').get(id);
  if (!existing) return sendNotFound(req, res);

  // Check if customer has orders - if so, only soft-delete by clearing their personal data
  const orderCount = (db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE customer_id=?').get(id) as { cnt: number }).cnt;

  if (orderCount > 0) {
    // Anonymize instead of hard delete to preserve order history
    const now = Date.now();
    db.prepare(`
      UPDATE customers SET
        full_name = 'Client supprimé',
        phone = NULL,
        email = NULL,
        notes = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(now, id);
    return res.json({ ok: true, anonymized: true });
  }

  db.prepare('DELETE FROM customers WHERE id=?').run(id);
  return res.json({ ok: true, deleted: true });
});
