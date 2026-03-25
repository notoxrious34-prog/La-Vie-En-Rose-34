import { Router } from 'express';
import { z } from 'zod';
import type { firestore } from 'firebase-admin';
import { getAdminFirestore } from '../lib/firebaseAdmin';
import { getDb } from '../storage/db';
import { requireAuth, requirePermission, ALL_PERMISSIONS, normalizePermissions, getUserPermissions, type AuthRequest } from '../middleware/auth';

export const rolesRouter = Router();

const roleIdSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i);
const upsertRoleSchema = z
  .object({
    id: roleIdSchema.optional(),
    name: z.string().trim().min(1).max(80),
    permissions: z.array(z.string()).default([]),
  })
  .strict();

function isReservedRoleId(id: string) {
  return id === 'admin' || id === 'manager' || id === 'employee';
}

function isFirebase(req: AuthRequest) {
  return req.user?.authProvider === 'firebase';
}

function roleDefaults(id: string) {
  const name = id === 'admin' ? 'Admin' : id === 'manager' ? 'Manager' : id === 'employee' ? 'Employee' : id;
  const permissions = isReservedRoleId(id) ? normalizePermissions(getUserPermissions(id as any)) : [];
  return { id, name, permissions, createdAt: 0 };
}

rolesRouter.use(requireAuth);
rolesRouter.use(requirePermission('manage_users'));

rolesRouter.get('/permissions', (_req, res) => {
  res.json({ items: ALL_PERMISSIONS });
});

rolesRouter.get('/', async (req: AuthRequest, res) => {
  if (!isFirebase(req)) {
    try {
      const db = getDb();
      const rows = db
        .prepare('SELECT id, name, permissions, created_at as createdAt, updated_at as updatedAt FROM roles ORDER BY id ASC')
        .all() as Array<{ id: string; name: string; permissions: string; createdAt: number; updatedAt: number }>;

      const items = rows
        .map((r) => {
          let perms: unknown = [];
          try {
            perms = JSON.parse(String(r.permissions || '[]'));
          } catch {
            perms = [];
          }
          return {
            id: String(r.id),
            name: String(r.name || r.id),
            permissions: normalizePermissions(perms),
            createdAt: r.createdAt,
          };
        })
        .filter((r) => Boolean(r.id));

      const map = new Map(items.map((r) => [String(r.id), r]));
      for (const id of ['admin', 'manager', 'employee']) {
        if (!map.has(id)) map.set(id, roleDefaults(id));
      }
      const merged = Array.from(map.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return res.json({ items: merged, source: 'sqlite' });
    } catch (e: unknown) {
      const items = ['admin', 'manager', 'employee'].map((id) => roleDefaults(id));
      return res.json({ items, source: 'static', error: String((e as any)?.message ?? e) });
    }
  }

  try {
    const fs = getAdminFirestore();
    const snap = await fs.collection('roles').orderBy('createdAt', 'asc').limit(200).get();
    const items = snap.docs.map((d: firestore.QueryDocumentSnapshot) => {
      const data = d.data() as { name?: unknown; permissions?: unknown; createdAt?: any };
      const createdAt = (data as any)?.createdAt ?? null;
      return {
        id: d.id,
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : d.id,
        permissions: normalizePermissions(data.permissions),
        createdAt,
      };
    });

    const map = new Map(items.map((r) => [String(r.id), r]));
    for (const id of ['admin', 'manager', 'employee']) {
      if (!map.has(id)) map.set(id, roleDefaults(id));
    }

    const merged = Array.from(map.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return res.json({ items: merged, source: 'firestore' });
  } catch (e: unknown) {
    const items = ['admin', 'manager', 'employee'].map((id) => roleDefaults(id));
    return res.json({ items, source: 'static', error: String((e as any)?.message ?? e) });
  }
});

rolesRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = upsertRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
  const id = String(parsed.data.id ?? '').trim().toLowerCase();
  if (!id) return res.status(400).json({ error: 'invalid_role_id' });

  const permissions = normalizePermissions(parsed.data.permissions);
  if (permissions.length === 0) return res.status(400).json({ error: 'empty_permissions' });

  if (!isFirebase(req)) {
    try {
      const db = getDb();
      const exists = db.prepare('SELECT id FROM roles WHERE id = ?').get(id) as { id: string } | undefined;
      if (exists) return res.status(409).json({ error: 'role_exists' });
      const now = Date.now();
      db.prepare('INSERT INTO roles(id,name,permissions,created_at,updated_at) VALUES (?,?,?,?,?)').run(
        id,
        parsed.data.name,
        JSON.stringify(permissions),
        now,
        now
      );
      return res.status(201).json({ id });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'db_error', detail: String((e as any)?.message ?? e) });
    }
  }

  try {
    const fs = getAdminFirestore();
    const ref = fs.collection('roles').doc(id);
    const snap = await ref.get();
    if (snap.exists) return res.status(409).json({ error: 'role_exists' });

    await ref.set({
      name: parsed.data.name,
      permissions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({ id });
  } catch (e: unknown) {
    return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
  }
});

rolesRouter.put('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id ?? '').trim().toLowerCase();
  const parsed = upsertRoleSchema.omit({ id: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });

  const permissions = normalizePermissions(parsed.data.permissions);
  if (permissions.length === 0) return res.status(400).json({ error: 'empty_permissions' });

  if (!isFirebase(req)) {
    try {
      const db = getDb();
      const now = Date.now();
      const existing = db.prepare('SELECT created_at FROM roles WHERE id = ?').get(id) as { created_at: number } | undefined;
      const createdAt = existing?.created_at ?? now;
      db.prepare('INSERT INTO roles(id,name,permissions,created_at,updated_at) VALUES (?,?,?,?,?)\n         ON CONFLICT(id) DO UPDATE SET name=excluded.name, permissions=excluded.permissions, updated_at=excluded.updated_at').run(
        id,
        parsed.data.name,
        JSON.stringify(permissions),
        createdAt,
        now
      );
      return res.json({ success: true });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'db_error', detail: String((e as any)?.message ?? e) });
    }
  }

  try {
    const fs = getAdminFirestore();
    const ref = fs.collection('roles').doc(id);
    const snap = await ref.get();
    const createdAt = snap.exists ? (snap.data() as any)?.createdAt ?? new Date() : new Date();

    await ref.set({
      name: parsed.data.name,
      permissions,
      createdAt,
      updatedAt: new Date(),
    });

    return res.json({ success: true });
  } catch (e: unknown) {
    return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
  }
});

rolesRouter.delete('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id ?? '').trim().toLowerCase();
  if (isReservedRoleId(id)) return res.status(400).json({ error: 'cannot_delete_reserved_role' });

  if (!isFirebase(req)) {
    try {
      const db = getDb();
      const assigned = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get(id) as { id: string } | undefined;
      if (assigned) return res.status(400).json({ error: 'role_assigned' });
      db.prepare('DELETE FROM roles WHERE id = ?').run(id);
      return res.json({ success: true });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'db_error', detail: String((e as any)?.message ?? e) });
    }
  }

  try {
    const fs = getAdminFirestore();

    const assignedSnap = await fs.collection('users').where('roleId', '==', id).limit(1).get();
    if (!assignedSnap.empty) return res.status(400).json({ error: 'role_assigned' });

    await fs.collection('roles').doc(id).delete();
    return res.json({ success: true });
  } catch (e: unknown) {
    return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
  }
});
