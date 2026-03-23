import { Router } from 'express';
import { getDb } from '../storage/db';
import { requireAuth } from '../middleware/auth';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get('/sales/daily', (req, res) => {
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  // Use local time (not UTC) so Algeria (UTC+1) daily boundaries are correct
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
});

analyticsRouter.get('/sales/monthly', (req, res) => {
  const month = String(req.query.month ?? new Date().toISOString().slice(0, 7));
  const [ym, mm] = month.split('-').map((x) => Number(x));
  // Use local time boundaries for accurate daily grouping
  const start = new Date(ym, (mm || 1) - 1, 1, 0, 0, 0, 0);
  const next = new Date(ym, (mm || 1), 1, 0, 0, 0, 0);

  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        strftime('%Y-%m-%d', created_at/1000, 'unixepoch') as day,
        COALESCE(SUM(total),0) as total
      FROM orders
      WHERE kind='sale' AND created_at BETWEEN ? AND ?
      GROUP BY day
      ORDER BY day
    `
    )
    .all(start.getTime(), next.getTime()) as { day: string; total: number }[];

  return res.json({ month, items: rows });
});

analyticsRouter.get('/products/best-sellers', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 10), 50);
  const sinceDays = Math.min(Number(req.query.sinceDays ?? 30), 365);
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        oi.product_id as productId,
        oi.name as name,
        SUM(oi.quantity) as qty,
        SUM(oi.total) as total
      FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      WHERE o.kind='sale' AND o.created_at >= ?
      GROUP BY oi.product_id, oi.name
      ORDER BY qty DESC
      LIMIT ?
    `
    )
    .all(since, limit) as { productId: string | null; name: string; qty: number; total: number }[];

  return res.json({ sinceDays, items: rows });
});

analyticsRouter.get('/inventory/value', (_req, res) => {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(i.quantity * COALESCE(v.sale_price,p.sale_price)),0) as retailValue,
        COALESCE(SUM(i.quantity * COALESCE(p.cost_price,0)),0) as costValue
      FROM inventory i
      JOIN product_variants v ON v.id=i.variant_id
      JOIN products p ON p.id=v.product_id
      WHERE p.active=1 AND v.active=1
    `
    )
    .get() as { retailValue: number; costValue: number };

  return res.json(row);
});

analyticsRouter.get('/sales/by-category', (req, res) => {
  const sinceDays = Math.min(Number(req.query.sinceDays ?? 30), 365);
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const db = getDb();

  const rows = db
    .prepare(`
      SELECT
        c.name as category,
        SUM(oi.total) as total,
        SUM(oi.quantity) as qty
      FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      JOIN products p ON p.id=oi.product_id
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE o.kind='sale' AND o.created_at >= ?
      GROUP BY c.id, c.name
      ORDER BY total DESC
    `)
    .all(since) as { category: string; total: number; qty: number }[];

  return res.json({ sinceDays, items: rows });
});

analyticsRouter.get('/sales/profit', (req, res) => {
  const sinceDays = Math.min(Number(req.query.sinceDays ?? 30), 365);
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const db = getDb();

  const row = db
    .prepare(`
      SELECT
        COALESCE(SUM(total),0) as revenue,
        COALESCE(SUM(profit_total),0) as profit,
        COUNT(*) as ordersCount
      FROM orders
      WHERE kind='sale' AND created_at >= ?
    `)
    .get(since) as { revenue: number; profit: number; ordersCount: number };

  const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
  return res.json({ ...row, margin, sinceDays });
});

analyticsRouter.get('/sales/trends', (req, res) => {
  const days = Math.min(Number(req.query.days ?? 30), 90);
  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;
  const db = getDb();

  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') as date,
           SUM(total) as total, COUNT(*) as orders
    FROM orders WHERE kind='sale' AND created_at >= ?
    GROUP BY date ORDER BY date
  `).all(since) as { date: string; total: number; orders: number }[];

  if (rows.length < 2) return res.json({ trend: 'neutral', change: 0, data: rows });

  const firstHalf = rows.slice(0, Math.floor(rows.length / 2));
  const secondHalf = rows.slice(Math.floor(rows.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b.total, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b.total, 0) / secondHalf.length;
  const change = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  let trend = 'stable';
  if (change > 10) trend = 'increasing';
  else if (change < -10) trend = 'decreasing';

  return res.json({ trend, change: Math.round(change * 10) / 10, data: rows });
});

analyticsRouter.get('/products/turnover', (req, res) => {
  const sinceDays = Math.min(Number(req.query.sinceDays ?? 30), 90);
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const db = getDb();

  const rows = db.prepare(`
    SELECT p.id, p.name, p.sale_price, p.cost_price,
           COALESCE(sold.sold_qty, 0) as sold_qty,
           COALESCE(i.quantity, 0) as current_stock
    FROM products p
    LEFT JOIN (
      SELECT
        COALESCE(oi.product_id, pv.product_id) as product_id,
        SUM(oi.quantity) as sold_qty
      FROM order_items oi
      LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.kind='sale' AND o.created_at >= ?
      GROUP BY COALESCE(oi.product_id, pv.product_id)
    ) sold ON sold.product_id = p.id
    LEFT JOIN (
      SELECT pv.product_id, SUM(inv.quantity) as quantity
      FROM inventory inv
      JOIN product_variants pv ON pv.id = inv.variant_id
      GROUP BY pv.product_id
    ) i ON i.product_id = p.id
    WHERE p.active = 1
    GROUP BY p.id
    HAVING sold_qty > 0 OR current_stock > 0
    ORDER BY sold_qty DESC
  `).all(since) as { id: string; name: string; sale_price: number; cost_price: number; sold_qty: number; current_stock: number }[];

  const result = rows.map(r => ({
    ...r,
    turnover_rate: r.current_stock > 0 ? Math.round((r.sold_qty / r.current_stock) * 100) / 100 : 0,
    status: r.sold_qty === 0 ? 'slow' : r.sold_qty > 10 ? 'fast' : 'normal'
  }));

  return res.json({ sinceDays, items: result });
});

analyticsRouter.get('/products/low-stock-prediction', (_req, res) => {
  const db = getDb();
  const now = Date.now();
  const last30 = now - 30 * 24 * 60 * 60 * 1000;
  const last7 = now - 7 * 24 * 60 * 60 * 1000;

  const products = db.prepare(`
    SELECT p.id, p.name, p.sale_price, p.cost_price,
           COALESCE(i.quantity, 0) as stock,
           COALESCE(daily.avg_daily, 0) as avg_daily_sales,
           COALESCE(recent.weekly_sales, 0) as recent_sales
    FROM products p
    LEFT JOIN (
      SELECT pv.product_id, SUM(inv.quantity) as quantity
      FROM inventory inv
      JOIN product_variants pv ON pv.id = inv.variant_id
      GROUP BY pv.product_id
    ) i ON i.product_id = p.id
    LEFT JOIN (
      SELECT product_id, AVG(daily_total) as avg_daily FROM (
        SELECT
          COALESCE(oi.product_id, pv.product_id) as product_id,
          SUM(oi.quantity) as daily_total
        FROM order_items oi
        LEFT JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.kind='sale' AND o.created_at >= ?
        GROUP BY COALESCE(oi.product_id, pv.product_id), date(o.created_at/1000, 'unixepoch')
      ) GROUP BY product_id
    ) daily ON daily.product_id = p.id
    LEFT JOIN (
      SELECT
        COALESCE(oi.product_id, pv.product_id) as product_id,
        SUM(oi.quantity) as weekly_sales
      FROM order_items oi
      LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.kind='sale' AND o.created_at >= ?
      GROUP BY COALESCE(oi.product_id, pv.product_id)
    ) recent ON recent.product_id = p.id
    WHERE p.active = 1 AND COALESCE(i.quantity, 0) > 0
  `).all(last30, last7) as { id: string; name: string; sale_price: number; cost_price: number; stock: number; avg_daily_sales: number; recent_sales: number }[];

  const predictions = products.map(p => {
    const dailyRate = p.recent_sales > 0 ? p.recent_sales / 7 : p.avg_daily_sales;
    const daysLeft = dailyRate > 0 ? Math.round(p.stock / dailyRate) : null;
    return {
      ...p,
      days_remaining: daysLeft,
      prediction: daysLeft === null ? 'Insufficient data' : daysLeft <= 7 ? `May run out in ${daysLeft} days` : daysLeft <= 14 ? 'Stock running low' : 'Stock OK',
      urgency: daysLeft === null ? 'unknown' : daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'normal'
    };
  }).filter(p => p.avg_daily_sales > 0 || p.recent_sales > 0);

  return res.json({ items: predictions.sort((a, b) => (a.days_remaining ?? 999) - (b.days_remaining ?? 999)) });
});

analyticsRouter.get('/products/restock-recommendations', (_req, res) => {
  const db = getDb();
  const now = Date.now();
  const last30 = now - 30 * 24 * 60 * 60 * 1000;
  const last7 = now - 7 * 24 * 60 * 60 * 1000;

  const products = db.prepare(`
    SELECT p.id, p.name, p.sale_price, p.cost_price,
           COALESCE(i.quantity, 0) as stock,
           COALESCE(recent.weekly_sales, 0) as recent_sales,
           COALESCE(daily.avg_daily, 0) as avg_daily
    FROM products p
    LEFT JOIN (
      SELECT pv.product_id, SUM(inv.quantity) as quantity
      FROM inventory inv
      JOIN product_variants pv ON pv.id = inv.variant_id
      GROUP BY pv.product_id
    ) i ON i.product_id = p.id
    LEFT JOIN (
      SELECT
        COALESCE(oi.product_id, pv.product_id) as product_id,
        SUM(oi.quantity) as weekly_sales
      FROM order_items oi
      LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.kind='sale' AND o.created_at >= ?
      GROUP BY COALESCE(oi.product_id, pv.product_id)
    ) recent ON recent.product_id = p.id
    LEFT JOIN (
      SELECT product_id, AVG(daily_total) as avg_daily FROM (
        SELECT
          COALESCE(oi.product_id, pv.product_id) as product_id,
          SUM(oi.quantity) as daily_total
        FROM order_items oi
        LEFT JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.kind='sale' AND o.created_at >= ?
        GROUP BY COALESCE(oi.product_id, pv.product_id), date(o.created_at/1000, 'unixepoch')
      ) GROUP BY product_id
    ) daily ON daily.product_id = p.id
    WHERE p.active = 1
  `).all(last7, last30) as { id: string; name: string; sale_price: number; cost_price: number; stock: number; recent_sales: number; avg_daily: number }[];

  const recommendations = products.map(p => {
    const demandTrend = p.recent_sales > p.avg_daily * 7 * 1.2 ? 'increasing' : p.recent_sales < p.avg_daily * 7 * 0.8 ? 'decreasing' : 'stable';
    const recommendedQty = Math.max(10, Math.ceil(p.avg_daily * 14));
    const priority = p.stock < p.avg_daily * 7 ? 'high' : p.stock < p.avg_daily * 14 ? 'medium' : 'low';
    return {
      product_id: p.id,
      name: p.name,
      current_stock: p.stock,
      avg_daily_sales: Math.round(p.avg_daily * 10) / 10,
      recent_sales: p.recent_sales,
      demand_trend: demandTrend,
      recommended_restock: recommendedQty,
      priority,
      message: `Recommended restock: ${recommendedQty} units of ${p.name}`
    };
  }).filter(p => p.recent_sales > 0 || p.avg_daily_sales > 0)
    .sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));

  return res.json({ items: recommendations });
});

analyticsRouter.get('/products/profit-analysis', (req, res) => {
  const sinceDays = Math.min(Number(req.query.sinceDays ?? 30), 90);
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const db = getDb();

  const rows = db.prepare(`
    SELECT p.id, p.name, p.sale_price, p.cost_price,
           COALESCE(SUM(oi.quantity), 0) as sold_qty,
           COALESCE(SUM(oi.total), 0) as revenue,
           COALESCE(SUM(oi.quantity * (oi.unit_price - COALESCE(p.cost_price, 0))), 0) as profit
    FROM products p
    JOIN order_items oi ON oi.product_id = p.id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.kind='sale' AND o.created_at >= ? AND p.active = 1
    GROUP BY p.id
  `).all(since) as { id: string; name: string; sale_price: number; cost_price: number; sold_qty: number; revenue: number; profit: number }[];

  const withMargin = rows.map(r => ({
    ...r,
    margin: r.revenue > 0 ? Math.round((r.profit / r.revenue) * 100) : 0,
    profit_per_unit: r.sold_qty > 0 ? Math.round(r.profit / r.sold_qty) : 0
  }));

  const top = withMargin.filter(p => p.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const low = withMargin.filter(p => p.profit > 0).sort((a, b) => a.profit - b.profit).slice(0, 5);

  return res.json({ sinceDays, top_profitable: top, low_profitable: low, all: withMargin });
});

analyticsRouter.get('/sales/forecast', (_req, res) => {
  const db = getDb();
  const now = Date.now();
  const last90 = now - 90 * 24 * 60 * 60 * 1000;

  const rows = db.prepare(`
    SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') as month,
           SUM(total) as total
    FROM orders WHERE kind='sale' AND created_at >= ?
    GROUP BY month ORDER BY month
  `).all(last90) as { month: string; total: number }[];

  if (rows.length < 2) return res.json({ forecast: null, message: 'Insufficient data for forecast' });

  const avgGrowth = rows.slice(1).reduce((acc, r, i) => {
    const prev = rows[i].total;
    return acc + (prev > 0 ? (r.total - prev) / prev : 0);
  }, 0) / (rows.length - 1);

  const lastMonth = rows[rows.length - 1].total;
  const forecast = Math.round(lastMonth * (1 + avgGrowth));

  return res.json({
    historical: rows,
    forecast,
    avg_growth: Math.round(avgGrowth * 100),
    confidence: rows.length >= 4 ? 'high' : rows.length >= 2 ? 'medium' : 'low'
  });
});
