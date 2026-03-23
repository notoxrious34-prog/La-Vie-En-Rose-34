import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export function seedDemoData(database: Database.Database) {
  const enabled = String(process.env.LVER_SEED_DEMO ?? '').trim();
  if (enabled !== '1' && enabled.toLowerCase() !== 'true') return;

  const existing = database.prepare('SELECT id FROM products LIMIT 1').get() as { id: string } | undefined;
  if (existing) return;

  const now = Date.now();

  const tx = database.transaction(() => {
    const categoryId = nanoid();
    database.prepare('INSERT INTO categories(id,name,created_at) VALUES (?,?,?)').run(categoryId, 'Demo', now);

    const products = [
      {
        name: 'Demo Product',
        sku: 'DEMO-001',
        barcode: '0001',
        costPrice: 80,
        salePrice: 199.99,
        variants: [
          {
            size: 'M',
            color: 'Red',
            sku: 'DEMO-001-M-RED',
            barcode: '0001MRED',
            salePrice: 199.99,
            quantity: 10,
            lowStockThreshold: 2,
          },
        ],
      },
      {
        name: 'Demo Necklace',
        sku: 'DEMO-002',
        barcode: '0002',
        costPrice: 40,
        salePrice: 129.5,
        variants: [
          {
            size: undefined,
            color: 'Gold',
            sku: 'DEMO-002-GOLD',
            barcode: '0002GOLD',
            salePrice: 129.5,
            quantity: 5,
            lowStockThreshold: 1,
          },
        ],
      },
      {
        name: 'Demo Ring',
        sku: 'DEMO-003',
        barcode: '0003',
        costPrice: 25,
        salePrice: 89.0,
        variants: [
          {
            size: '7',
            color: 'Silver',
            sku: 'DEMO-003-7-SIL',
            barcode: '00037SIL',
            salePrice: 89.0,
            quantity: 12,
            lowStockThreshold: 2,
          },
        ],
      },
    ];

    for (const p of products) {
      const productId = nanoid();
      database
        .prepare(
          `
          INSERT INTO products(id,sku,barcode,name,description,category_id,image_url,cost_price,sale_price,active,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `
        )
        .run(
          productId,
          p.sku,
          p.barcode,
          p.name,
          null,
          categoryId,
          null,
          p.costPrice,
          p.salePrice,
          1,
          now,
          now
        );

      for (const v of p.variants) {
        const variantId = nanoid();
        database
          .prepare(
            `
            INSERT INTO product_variants(id,product_id,size,color,barcode,sku,sale_price,active,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
          `
          )
          .run(
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

        database
          .prepare(
            `
            INSERT INTO inventory(variant_id,quantity,low_stock_threshold,updated_at)
            VALUES (?,?,?,?)
          `
          )
          .run(variantId, v.quantity, v.lowStockThreshold, now);
      }
    }
  });

  tx();
}
