import { Router } from 'express';
import { getDb } from '../storage/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { nanoid } from 'nanoid';

export const activityRouter = Router();

// Get activity logs with advanced filtering
activityRouter.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const { limit = 50, offset = 0, action, user_id, entity_type, from, to } = req.query;
  
  let query = `
    SELECT al.*, u.username
    FROM activity_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (action) {
    query += ` AND al.action = ?`;
    params.push(action);
  }
  if (user_id) {
    query += ` AND al.user_id = ?`;
    params.push(user_id);
  }
  if (entity_type) {
    query += ` AND al.entity_type = ?`;
    params.push(entity_type);
  }
  if (from) {
    query += ` AND al.created_at >= ?`;
    params.push(Number(from));
  }
  if (to) {
    query += ` AND al.created_at <= ?`;
    params.push(Number(to));
  }
  
  query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));
  
  const items = db.prepare(query).all(...params);
  // Count with the same filters (minus LIMIT/OFFSET)
  const countParams = params.slice(0, params.length - 2);
  const countQuery = query.replace(/ORDER BY.*$/, '').replace(/SELECT al\.\*, u\.username/, 'SELECT COUNT(*) as count');
  const totalRow = db.prepare(countQuery).get(...countParams) as { count: number };
  
  res.json({ items, total: totalRow.count });
});

// Get unique action types for filtering
activityRouter.get('/actions', requireAuth, (_req, res) => {
  const db = getDb();
  const actions = db.prepare(`
    SELECT DISTINCT action FROM activity_logs ORDER BY action
  `).all() as { action: string }[];
  res.json({ actions: actions.map(a => a.action) });
});

// Get unique entity types for filtering
activityRouter.get('/entity-types', requireAuth, (_req, res) => {
  const db = getDb();
  const types = db.prepare(`
    SELECT DISTINCT entity_type FROM activity_logs WHERE entity_type IS NOT NULL ORDER BY entity_type
  `).all() as { entity_type: string }[];
  res.json({ entity_types: types.map(t => t.entity_type) });
});

// Log activity (internal use)
export function logActivity(db: any, userId: string | null, action: string, entityType?: string, entityId?: string, details?: object) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nanoid(), userId, action, entityType, entityId, details ? JSON.stringify(details) : null, now);
}

// Get activity stats
activityRouter.get('/stats', requireAuth, (_req, res) => {
  const db = getDb();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  const today = db.prepare(`
    SELECT COUNT(*) as count FROM activity_logs WHERE created_at > ?
  `).get(now - day) as { count: number };
  
  const actions = db.prepare(`
    SELECT action, COUNT(*) as count 
    FROM activity_logs 
    WHERE created_at > ?
    GROUP BY action
    ORDER BY count DESC
    LIMIT 10
  `).all(now - day);
  
  res.json({ today: today.count, actions });
});

// Clear old logs (admin only)
activityRouter.delete('/cleanup', requireRole(['admin']), (req, res) => {
  const db = getDb();
  const rawDays = Number(req.body?.days ?? 30);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30;
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  db.prepare(`DELETE FROM activity_logs WHERE created_at < ?`).run(cutoff);
  
  res.json({ success: true, deleted: 'old logs' });
});
