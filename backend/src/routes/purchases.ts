import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../storage/db';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';

export const purchasesRouter = Router();
purchasesRouter.use(requireAuth);

const createSchema = z.object({
  supplierId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string(),
        quantity: z.number().int().positive(),
        unitCost: z.number().nonnegative(),
      })
    )
    .min(1),
});

purchasesRouter.post('/', requireRole(['admin']), (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const now = Date.now();
  const purchaseId = nanoid();

  try {
    const tx = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO purchases(id,supplier_id,invoice_number,subtotal,total,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)
      `
      ).run(
        purchaseId,
        parsed.data.supplierId ?? null,
        parsed.data.invoiceNumber ?? null,
        0,
        0,
        parsed.data.notes ?? null,
        now,
        now
      );

      let subtotal = 0;
      for (const item of parsed.data.items) {
        const row = db
          .prepare(
            `
            SELECT v.id as variant_id, p.id as product_id, p.name
            FROM product_variants v
            JOIN products p ON p.id=v.product_id
            WHERE v.id=?
          `
          )
          .get(item.variantId) as { variant_id: string; product_id: string; name: string } | undefined;

        if (!row) throw new Error('variant_not_found');

        const total = item.unitCost * item.quantity;
        subtotal += total;

        db.prepare(
          `
          INSERT INTO purchase_items(id,purchase_id,product_id,variant_id,name,quantity,unit_cost,total,created_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `
        ).run(
          nanoid(),
          purchaseId,
          row.product_id,
          row.variant_id,
          row.name,
          item.quantity,
          item.unitCost,
          total,
          now
        );

        db.prepare('UPDATE inventory SET quantity=quantity+?, updated_at=? WHERE variant_id=?').run(
          item.quantity,
          now,
          item.variantId
        );
      }

      db.prepare('UPDATE purchases SET subtotal=?, total=?, updated_at=? WHERE id=?').run(
        subtotal,
        subtotal,
        now,
        purchaseId
      );
    });

    tx();
    return res.status(201).json({ id: purchaseId });
  } catch (e: any) {
    return res.status(400).json({ error: 'purchase_failed', detail: String(e?.message ?? e) });
  }
});

// GET list purchases
purchasesRouter.get('/', (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const from = req.query.from ? Number(req.query.from) : undefined;
    const to = req.query.to ? Number(req.query.to) : undefined;

    const where: string[] = [];
    const params: any[] = [];

    if (from && Number.isFinite(from)) { where.push('p.created_at >= ?'); params.push(from); }
    if (to && Number.isFinite(to)) { where.push('p.created_at <= ?'); params.push(to); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const rows = db.prepare(`
      SELECT p.id, p.invoice_number, p.subtotal, p.total, p.notes, p.created_at, p.updated_at,
             s.name as supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(...params, limit);

    return res.json({ items: rows });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return res.status(500).json({ error: 'db_error' });
  }
});

// GET single purchase with items
purchasesRouter.get('/:purchaseId', (req, res) => {
  try {
    const { purchaseId } = req.params;
    const db = getDb();

    const purchase = db.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = ?
    `).get(purchaseId) as any | undefined;

    if (!purchase) return res.status(404).json({ error: 'not_found' });

    const items = db.prepare(`
      SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY created_at ASC
    `).all(purchaseId);

    return res.json({ ...purchase, items });
  } catch (error) {
    return res.status(500).json({ error: 'db_error' });
  }
});
