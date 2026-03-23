import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../storage/db';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';
import {
  sendBadRequest,
  sendCreated,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from '../lib/response';

export const productsRouter = Router();

productsRouter.use(requireAuth);

const createProductSchema = z.object({
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  imageUrl: z.string().optional(),
  costPrice: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().default(0),
  active: z.boolean().default(true),
  variants: z
    .array(
      z.object({
        size: z.string().optional(),
        color: z.string().optional(),
        barcode: z.string().optional(),
        sku: z.string().optional(),
        salePrice: z.number().nonnegative().optional(),
        quantity: z.number().int().default(0),
        lowStockThreshold: z.number().int().default(2),
      })
    )
    .default([]),
});

productsRouter.get('/catalog', (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const db = getDb();
    const like = `%${q}%`;

    const rows = db
      .prepare(
        `
        SELECT id, name, sku, barcode, sale_price
        FROM products
        WHERE active=1 AND (
          ? = '' OR name LIKE ? OR sku LIKE ? OR barcode LIKE ?
        )
        ORDER BY updated_at DESC
        LIMIT ?
      `
      )
      .all(q, like, like, like, limit);

    return res.json({ items: rows });
  } catch (error) {
    console.error('Error fetching products catalog:', error);
    return sendInternalError(req, res, 'Failed to fetch products catalog');
  }
});

productsRouter.get('/', (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const db = getDb();

    const like = `%${q}%`;

    const rows = db
      .prepare(
        `
        SELECT
          v.id as id,
          p.name as name,
          COALESCE(v.sku,p.sku) as sku,
          COALESCE(v.barcode,p.barcode) as barcode,
          COALESCE(v.sale_price,p.sale_price) as sale_price
        FROM product_variants v
        JOIN products p ON p.id=v.product_id
        WHERE p.active=1 AND v.active=1
          AND (
            ? = '' OR
            p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR
            v.sku LIKE ? OR v.barcode LIKE ?
          )
        ORDER BY p.updated_at DESC, v.updated_at DESC
        LIMIT ?
      `
      )
      .all(q, like, like, like, like, like, limit);

    return res.json({ items: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    return sendInternalError(req, res, 'Failed to fetch products');
  }
});

productsRouter.get('/lookup', (req, res) => {
  try {
    const code = String(req.query.code ?? '').trim();
    if (!code) return sendBadRequest(req, res, 'missing_code');

    const db = getDb();
    const row = db
      .prepare(
        `
        SELECT v.id as id, p.name as name,
               COALESCE(v.sku,p.sku) as sku,
               COALESCE(v.barcode,p.barcode) as barcode,
               COALESCE(v.sale_price,p.sale_price) as sale_price
        FROM product_variants v
        JOIN products p ON p.id=v.product_id
        WHERE p.active=1 AND v.active=1 AND (
          v.barcode=? OR v.sku=? OR p.barcode=? OR p.sku=?
        )
        LIMIT 1
      `
      )
      .get(code, code, code, code) as
      | { id: string; name: string; sku: string | null; barcode: string | null; sale_price: number }
      | undefined;

    if (!row) return sendNotFound(req, res, 'Product not found');
    return sendSuccess(res, row);
  } catch (error) {
    console.error('Error looking up product:', error);
    return sendInternalError(req, res, 'Failed to lookup product');
  }
});

productsRouter.post('/', requireRole(['admin']), (req: AuthRequest, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(req, res, 'invalid_body');

  const db = getDb();
  const now = Date.now();
  const productId = nanoid();

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO products(id,sku,barcode,name,description,category_id,image_url,cost_price,sale_price,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `
    ).run(
      productId,
      parsed.data.sku ?? null,
      parsed.data.barcode ?? null,
      parsed.data.name,
      parsed.data.description ?? null,
      parsed.data.categoryId ?? null,
      parsed.data.imageUrl ?? null,
      parsed.data.costPrice,
      parsed.data.salePrice,
      parsed.data.active ? 1 : 0,
      now,
      now
    );

    for (const v of parsed.data.variants) {
      const variantId = nanoid();
      db.prepare(
        `
        INSERT INTO product_variants(id,product_id,size,color,barcode,sku,sale_price,active,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `
      ).run(
        variantId,
        productId,
        v.size ?? null,
        v.color ?? null,
        v.barcode ?? null,
        v.sku ?? null,
        v.salePrice ?? null,
        1,
        now,
        now
      );
      db.prepare(
        `
        INSERT INTO inventory(variant_id,quantity,low_stock_threshold,updated_at)
        VALUES (?,?,?,?)
      `
      ).run(variantId, v.quantity, v.lowStockThreshold, now);
    }
  });

  try {
    tx();
    return sendCreated(res, { id: productId });
  } catch (e: any) {
    return sendInternalError(req, res, 'Failed to create product');
  }
});

// GET single product with full details
productsRouter.get('/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `).get(productId) as any | undefined;

    if (!product) return sendNotFound(req, res);

    const variants = db.prepare(`
      SELECT v.*, COALESCE(i.quantity,0) as quantity, COALESCE(i.low_stock_threshold,2) as low_stock_threshold
      FROM product_variants v
      LEFT JOIN inventory i ON i.variant_id = v.id
      WHERE v.product_id = ?
      ORDER BY v.created_at ASC
    `).all(productId);

    return res.json({ ...product, variants });
  } catch (error) {
    console.error('Error fetching product:', error);
    return sendInternalError(req, res, 'Failed to fetch product');
  }
});

// PUT update product
productsRouter.put('/:productId', requireRole(['admin']), (req: AuthRequest, res) => {
  const { productId } = req.params;
  const parsed = createProductSchema.partial().safeParse(req.body);
  if (!parsed.success) return sendBadRequest(req, res, 'invalid_body');

  const db = getDb();
  const now = Date.now();

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!existing) return sendNotFound(req, res);

  const fields = parsed.data;
  const sets: string[] = [];
  const params: any[] = [];

  if (fields.name !== undefined) { sets.push('name=?'); params.push(fields.name); }
  if (fields.sku !== undefined) { sets.push('sku=?'); params.push(fields.sku ?? null); }
  if (fields.barcode !== undefined) { sets.push('barcode=?'); params.push(fields.barcode ?? null); }
  if (fields.description !== undefined) { sets.push('description=?'); params.push(fields.description ?? null); }
  if (fields.categoryId !== undefined) { sets.push('category_id=?'); params.push(fields.categoryId ?? null); }
  if (fields.imageUrl !== undefined) { sets.push('image_url=?'); params.push(fields.imageUrl ?? null); }
  if (fields.costPrice !== undefined) { sets.push('cost_price=?'); params.push(fields.costPrice); }
  if (fields.salePrice !== undefined) { sets.push('sale_price=?'); params.push(fields.salePrice); }
  if (fields.active !== undefined) { sets.push('active=?'); params.push(fields.active ? 1 : 0); }

  if (sets.length === 0) return sendBadRequest(req, res, 'no_fields_to_update');

  sets.push('updated_at=?');
  params.push(now, productId);

  try {
    db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id=?`).run(...params);
    return res.json({ ok: true });
  } catch (e: any) {
    return sendInternalError(req, res, 'Failed to update product');
  }
});

// DELETE product (soft delete)
productsRouter.delete('/:productId', requireRole(['admin']), (req: AuthRequest, res) => {
  const { productId } = req.params;
  const db = getDb();
  const now = Date.now();

  const existing = db.prepare('SELECT id FROM products WHERE id=?').get(productId);
  if (!existing) return sendNotFound(req, res);

  // Soft delete: set active=0 so historical data is preserved
  db.prepare('UPDATE products SET active=0, updated_at=? WHERE id=?').run(now, productId);
  db.prepare('UPDATE product_variants SET active=0, updated_at=? WHERE product_id=?').run(now, productId);

  return res.json({ ok: true });
});

// GET product categories
productsRouter.get('/meta/categories', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    return res.json({ items: rows });
  } catch (error) {
    return sendInternalError(req, res, 'Failed to fetch categories');
  }
});

// POST product category
productsRouter.post('/meta/categories', requireRole(['admin']), (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return sendBadRequest(req, res, 'name_required');
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  try {
    db.prepare('INSERT INTO categories(id,name,created_at) VALUES (?,?,?)').run(id, name.trim(), now);
    return sendCreated(res, { id, name: name.trim() });
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      return sendBadRequest(req, res, 'category_exists');
    }
    return sendInternalError(req, res, 'Failed to create category');
  }
});
