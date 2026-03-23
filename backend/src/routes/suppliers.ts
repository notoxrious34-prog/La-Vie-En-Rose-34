import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../storage/db';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

suppliersRouter.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const db = getDb();

  if (!q) {
    const rows = db.prepare('SELECT * FROM suppliers ORDER BY updated_at DESC LIMIT ?').all(limit);
    return res.json({ items: rows });
  }

  const like = `%${q}%`;
  const rows = db
    .prepare('SELECT * FROM suppliers WHERE name LIKE ? ORDER BY updated_at DESC LIMIT ?')
    .all(like, limit);
  return res.json({ items: rows });
});

suppliersRouter.post('/', requireRole(['admin']), (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const id = nanoid();
  const now = Date.now();

  try {
    db.prepare(
      `
      INSERT INTO suppliers(id,name,phone,email,address,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)
    `
    ).run(
      id,
      parsed.data.name,
      parsed.data.phone ?? null,
      parsed.data.email ?? null,
      parsed.data.address ?? null,
      parsed.data.notes ?? null,
      now,
      now
    );
    return res.status(201).json({ id });
  } catch (e: any) {
    return res.status(500).json({ error: 'db_error', detail: String(e?.message ?? e) });
  }
});

// PUT update supplier
suppliersRouter.put('/:id', requireRole(['admin']), (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const db = getDb();
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM suppliers WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const fields = parsed.data;
  const sets: string[] = ['updated_at=?'];
  const params: any[] = [now];

  if (fields.name !== undefined) { sets.unshift('name=?'); params.unshift(fields.name); }
  if (fields.phone !== undefined) { sets.unshift('phone=?'); params.unshift(fields.phone ?? null); }
  if (fields.email !== undefined) { sets.unshift('email=?'); params.unshift(fields.email ?? null); }
  if (fields.address !== undefined) { sets.unshift('address=?'); params.unshift(fields.address ?? null); }
  if (fields.notes !== undefined) { sets.unshift('notes=?'); params.unshift(fields.notes ?? null); }

  try {
    db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id=?`).run(...params, id);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'db_error', detail: String(e?.message ?? e) });
  }
});

// DELETE supplier
suppliersRouter.delete('/:id', requireRole(['admin']), (req: AuthRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM suppliers WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  db.prepare('DELETE FROM suppliers WHERE id=?').run(id);
  return res.json({ ok: true });
});
