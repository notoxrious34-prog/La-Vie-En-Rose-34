import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../storage/db';
import { requireAuth, requireRole } from '../middleware/auth';

export const variantsRouter = Router();
variantsRouter.use(requireAuth);

variantsRouter.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT v.id, v.product_id, p.name, v.size, v.color, v.barcode, v.sku,
             COALESCE(v.sale_price,p.sale_price) as sale_price,
             COALESCE(i.quantity,0) as quantity
      FROM product_variants v
      JOIN products p ON p.id=v.product_id
      LEFT JOIN inventory i ON i.variant_id=v.id
      WHERE v.active=1 AND p.active=1
      ORDER BY v.updated_at DESC
      LIMIT ?
    `
    )
    .all(limit);

  return res.json({ items: rows });
});

variantsRouter.get('/product/:productId', (req, res) => {
  const productId = req.params.productId;
  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT v.id, v.product_id, v.size, v.color, v.barcode, v.sku,
             COALESCE(v.sale_price,p.sale_price) as sale_price,
             i.quantity, i.low_stock_threshold
      FROM product_variants v
      JOIN products p ON p.id=v.product_id
      LEFT JOIN inventory i ON i.variant_id=v.id
      WHERE v.product_id=?
      ORDER BY v.created_at DESC
    `
    )
    .all(productId);

  return res.json({ items: rows });
});

const createVariantSchema = z.object({
  productId: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  salePrice: z.number().nonnegative().optional(),
  quantity: z.number().int().default(0),
  lowStockThreshold: z.number().int().default(2),
});

variantsRouter.post('/', requireRole(['admin']), (req, res) => {
  const parsed = createVariantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const now = Date.now();
  const id = nanoid();

  try {
    const tx = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO product_variants(id,product_id,size,color,barcode,sku,sale_price,active,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `
      ).run(
        id,
        parsed.data.productId,
        parsed.data.size ?? null,
        parsed.data.color ?? null,
        parsed.data.barcode ?? null,
        parsed.data.sku ?? null,
        parsed.data.salePrice ?? null,
        1,
        now,
        now
      );

      db.prepare(
        `
        INSERT INTO inventory(variant_id,quantity,low_stock_threshold,updated_at)
        VALUES (?,?,?,?)
      `
      ).run(id, parsed.data.quantity, parsed.data.lowStockThreshold, now);

      db.prepare('UPDATE products SET updated_at=? WHERE id=?').run(now, parsed.data.productId);
    });

    tx();
    return res.status(201).json({ id });
  } catch (e: any) {
    return res.status(500).json({ error: 'db_error', detail: String(e?.message ?? e) });
  }
});

const updateInventorySchema = z.object({
  quantity: z.number().int(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

variantsRouter.patch('/:variantId/inventory', requireRole(['admin']), (req, res) => {
  const variantId = req.params.variantId;
  const parsed = updateInventorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const now = Date.now();

  const existing = db.prepare('SELECT variant_id FROM inventory WHERE variant_id=?').get(variantId) as
    | { variant_id: string }
    | undefined;

  if (!existing) return res.status(404).json({ error: 'not_found' });

  db.prepare(
    `UPDATE inventory SET quantity=?, low_stock_threshold=COALESCE(?,low_stock_threshold), updated_at=? WHERE variant_id=?`
  ).run(parsed.data.quantity, parsed.data.lowStockThreshold ?? null, now, variantId);

  return res.json({ ok: true });
});

variantsRouter.get('/low-stock', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT v.id as variantId, p.name, v.size, v.color,
             i.quantity, i.low_stock_threshold
      FROM inventory i
      JOIN product_variants v ON v.id=i.variant_id
      JOIN products p ON p.id=v.product_id
      WHERE p.active=1 AND v.active=1 AND i.quantity <= i.low_stock_threshold
      ORDER BY i.quantity ASC
      LIMIT ?
    `
    )
    .all(limit);

  return res.json({ items: rows });
});

// DELETE variant (soft delete)
variantsRouter.delete('/:variantId', requireRole(['admin']), (req, res) => {
  const { variantId } = req.params;
  const db = getDb();
  const now = Date.now();

  const existing = db.prepare('SELECT id, product_id FROM product_variants WHERE id=?').get(variantId) as
    | { id: string; product_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'not_found' });

  // Check if this is the last variant of the product - prevent removing all variants
  const variantCount = (db.prepare('SELECT COUNT(*) as cnt FROM product_variants WHERE product_id=? AND active=1').get(existing.product_id) as { cnt: number }).cnt;
  if (variantCount <= 1) {
    return res.status(400).json({ error: 'cannot_delete_last_variant', message: 'Cannot delete the last variant. Delete the product instead.' });
  }

  db.prepare('UPDATE product_variants SET active=0, updated_at=? WHERE id=?').run(now, variantId);
  db.prepare('UPDATE products SET updated_at=? WHERE id=?').run(now, existing.product_id);

  return res.json({ ok: true });
});
