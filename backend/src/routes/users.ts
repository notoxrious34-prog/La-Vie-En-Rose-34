import { Router } from 'express';
import { getDb } from '../storage/db';
import { requireAuth, requirePermission, getUserPermissions, type UserRole, type AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { getAdminAuth, getAdminFirestore } from '../lib/firebaseAdmin';
import { z } from 'zod';
import type { firestore } from 'firebase-admin';

export const usersRouter = Router();

type LocalUserMeRow = {
  id: string;
  username: string;
  role: UserRole;
  active?: number;
  created_at: number;
  last_login: number | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  language: string | null;
  theme: string | null;
};

function isFirebase(req: AuthRequest) {
  return req.user?.authProvider === 'firebase';
}

function isLocal(req: AuthRequest) {
  return req.user?.authProvider === 'local';
}

async function writeAuditLog(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: unknown;
}) {
  try {
    const fs = getAdminFirestore();
    await fs.collection('logs').add({
      actorUid: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
      createdAt: new Date(),
    });
  } catch {
    // ignore
  }
}

// Get user permissions by role (public)
usersRouter.get('/permissions/:role', async (req, res) => {
  const { role } = req.params as { role: UserRole };
  try {
    const fs = getAdminFirestore();
    const snap = await fs.collection('roles').doc(role).get();
    if (snap.exists) {
      const data = snap.data() as { permissions?: unknown };
      const permissions = Array.isArray(data.permissions) ? data.permissions.filter((p) => typeof p === 'string') : [];
      return res.json({ role, permissions, source: 'firestore' });
    }
  } catch {
    // ignore
  }

  const permissions = getUserPermissions(role);
  return res.json({ role, permissions, source: 'static' });
});

usersRouter.use(requireAuth);

// Get all users (admin only)
usersRouter.get('/', requirePermission('manage_users'), async (req: AuthRequest, res) => {
  if (isFirebase(req)) {
    try {
      const fs = getAdminFirestore();
      const snap = await fs.collection('users').orderBy('createdAt', 'desc').limit(200).get();
      const items = snap.docs.map((d: firestore.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as object) }));
      return res.json({ items, source: 'firestore' });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
    }
  }

  const db = getDb();
  const users = db
    .prepare(
      `
      SELECT u.id, u.username, u.role, u.active, u.created_at, u.last_login,
             up.full_name, up.email, up.phone, up.avatar_url, up.language
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      ORDER BY u.created_at DESC
    `
    )
    .all();
  return res.json({ items: users, source: 'sqlite' });
});

// Get current user profile
usersRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  if (isFirebase(req)) {
    try {
      const fs = getAdminFirestore();
      const snap = await fs.collection('users').doc(userId).get();
      const base = snap.exists ? (snap.data() as object) : {};
      return res.json({ id: userId, username: req.user!.username, role: req.user!.role, permissions: req.user!.permissions ?? [], ...base });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
    }
  }

  const db = getDb();
  const user = db
    .prepare(
      `
      SELECT u.id, u.username, u.role, u.active, u.created_at, u.last_login,
             up.full_name, up.email, up.phone, up.avatar_url, up.language, up.theme
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
    `
    )
    .get(userId) as LocalUserMeRow | undefined;

  const role = (user?.role ?? req.user?.role ?? 'employee') as UserRole;
  const permissions = getUserPermissions(role);
  return res.json({ ...(user ?? {}), role, permissions });
});

// Update current user profile
const updateMeSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120).nullable().optional(),
    email: z.string().trim().email().max(200).nullable().optional(),
    phone: z.string().trim().min(3).max(40).nullable().optional(),
    avatar_url: z.string().trim().url().max(500).nullable().optional(),
    language: z.string().trim().min(2).max(10).nullable().optional(),
    theme: z.enum(['light', 'dark']).nullable().optional(),
  })
  .strict();

usersRouter.patch('/me', requireAuth, (req, res) => {
  if ((req as AuthRequest).user?.authProvider === 'firebase') {
    return res.status(501).json({ error: 'not_implemented', message: 'Profile updates via Firebase are not implemented yet.' });
  }

  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
  }

  const db = getDb();
  const userId = (req as any).user.id;
  const { full_name, email, phone, avatar_url, language, theme } = parsed.data;
  const now = Date.now();

  // Update or insert profile
  const existing = db.prepare('SELECT id FROM user_profiles WHERE user_id = ?').get(userId);
  
  if (existing) {
    db.prepare(`
      UPDATE user_profiles SET 
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        avatar_url = COALESCE(?, avatar_url),
        language = COALESCE(?, language),
        theme = COALESCE(?, theme),
        updated_at = ?
      WHERE user_id = ?
    `).run(full_name, email, phone, avatar_url, language, theme, now, userId);
  } else {
    db.prepare(`
      INSERT INTO user_profiles (id, user_id, full_name, email, phone, avatar_url, language, theme, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nanoid(), userId, full_name, email, phone, avatar_url, language || 'fr', theme || 'light', now, now);
  }

  // Log activity
  db.prepare(`
    INSERT INTO activity_logs (id, user_id, action, entity_type, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nanoid(), userId, 'profile_updated', 'user', JSON.stringify({ fields: Object.keys(parsed.data) }), now);

  res.json({ success: true });
});

// Change password
const changePasswordSchema = z
  .object({
    current_password: z.string().min(1).max(200),
    new_password: z.string().min(8).max(200),
  })
  .strict();

usersRouter.post('/me/password', requireAuth, (req, res) => {
  const db = getDb();
  const userId = (req as any).user.id;

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
  }

  const { current_password, new_password } = parsed.data;

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);

  // Log activity
  db.prepare(`
    INSERT INTO activity_logs (id, user_id, action, entity_type, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nanoid(), userId, 'password_changed', 'user', '{}', Date.now());

  res.json({ success: true });
});

// Create new user (admin only)
const createFirebaseUserSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.enum(['admin', 'manager', 'employee']).default('employee'),
  active: z.boolean().default(true),
});

usersRouter.post('/', requirePermission('manage_users'), async (req: AuthRequest, res) => {
  if (isFirebase(req)) {
    const parsed = createFirebaseUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });

    // Prevent privilege escalation: only admins can create admin accounts.
    if (parsed.data.roleId === 'admin' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden', message: 'Only admins can create admin accounts.' });
    }

    try {
      const auth = getAdminAuth();
      const fs = getAdminFirestore();

      const created = await auth.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        disabled: !parsed.data.active,
      });

      const now = new Date();
      await fs.collection('users').doc(created.uid).set(
        {
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          roleId: parsed.data.roleId,
          active: parsed.data.active,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: null,
        },
        { merge: true }
      );

      await writeAuditLog({
        actorId: req.user!.id,
        action: 'user_created',
        entityType: 'user',
        entityId: created.uid,
        details: { email: parsed.data.email, roleId: parsed.data.roleId },
      });

      return res.status(201).json({ id: created.uid });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
    }
  }

  if (!isLocal(req)) return res.status(400).json({ error: 'unsupported_auth' });

  const createLocalUserSchema = z.object({
    username: z.string().trim().min(2).max(60),
    password: z.string().min(8).max(200),
    role: z.enum(['admin', 'manager', 'employee']).default('employee'),
    full_name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().min(3).max(40).optional(),
  });

  const localParsed = createLocalUserSchema.safeParse(req.body);
  if (!localParsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: localParsed.error.issues });
  }

  // Prevent privilege escalation
  if (localParsed.data.role === 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only admins can create admin accounts.' });
  }

  const { username, password, role, full_name, email, phone } = localParsed.data;
  const db = getDb();
  const now = Date.now();
  const id = 'u_' + nanoid(8);
  const hash = bcrypt.hashSync(password, 10);

  try {
    db.prepare(
      `
      INSERT INTO users (id, username, password_hash, role, active, last_login, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, username, hash, role || 'employee', 1, null, now);

    db.prepare(
      `
      INSERT INTO user_profiles (id, user_id, full_name, email, phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(nanoid(), id, full_name, email, phone, now, now);

    const adminId = req.user!.id;
    db.prepare(
      `
      INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(nanoid(), adminId, 'user_created', 'user', id, JSON.stringify({ username, role }), now);

    return res.json({ id, username, role: role || 'employee' });
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'db_error', detail: String(e?.message ?? e) });
  }
});

// Delete user (admin only)
usersRouter.delete('/:id', requirePermission('manage_users'), async (req: AuthRequest, res) => {
  const id = String(req.params.id ?? '');
  if (id === req.user!.id) return res.status(400).json({ error: 'cannot_delete_self' });

  if (isFirebase(req)) {
    try {
      const auth = getAdminAuth();
      const fs = getAdminFirestore();

      // Managers can manage users, but cannot delete admin accounts.
      if (req.user?.role !== 'admin') {
        const targetSnap = await fs.collection('users').doc(id).get();
        const targetRole = targetSnap.exists ? String((targetSnap.data() as any)?.roleId ?? 'employee') : 'employee';
        if (targetRole === 'admin') {
          return res.status(403).json({ error: 'forbidden', message: 'Only admins can delete admin accounts.' });
        }
      }

      await auth.deleteUser(id);
      await fs.collection('users').doc(id).delete().catch(() => undefined);
      await writeAuditLog({ actorId: req.user!.id, action: 'user_deleted', entityType: 'user', entityId: id, details: {} });
      return res.json({ success: true });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
    }
  }

  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  const adminId = req.user!.id;
  db.prepare(
    `
    INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(nanoid(), adminId, 'user_deleted', 'user', id, JSON.stringify({ deleted_id: id }), Date.now());
  return res.json({ success: true });
});

const setActiveSchema = z.object({ active: z.boolean() });

const setRoleSchema = z.object({ roleId: z.enum(['admin', 'manager', 'employee']) });

usersRouter.patch('/:id/active', requirePermission('manage_users'), async (req: AuthRequest, res) => {
  const id = String(req.params.id ?? '');
  if (id === req.user!.id) return res.status(400).json({ error: 'cannot_change_self' });
  const parsed = setActiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });

  if (isFirebase(req)) {
    try {
      const auth = getAdminAuth();
      const fs = getAdminFirestore();

      // Managers can manage users, but cannot deactivate/activate admin accounts.
      if (req.user?.role !== 'admin') {
        const targetSnap = await fs.collection('users').doc(id).get();
        const targetRole = targetSnap.exists ? String((targetSnap.data() as any)?.roleId ?? 'employee') : 'employee';
        if (targetRole === 'admin') {
          return res.status(403).json({ error: 'forbidden', message: 'Only admins can modify admin accounts.' });
        }
      }

      await auth.updateUser(id, { disabled: !parsed.data.active });
      await fs.collection('users').doc(id).set({ active: parsed.data.active, updatedAt: new Date() }, { merge: true });
      await writeAuditLog({ actorId: req.user!.id, action: parsed.data.active ? 'user_activated' : 'user_deactivated', entityType: 'user', entityId: id });
      return res.json({ success: true });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
    }
  }

  if (!isLocal(req)) return res.status(400).json({ error: 'unsupported_auth' });

  const db = getDb();
  const now = Date.now();

  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) as { id: string; role: UserRole } | undefined;
  if (!target) return res.status(404).json({ error: 'not_found' });

  if (req.user?.role !== 'admin' && target.role === 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only admins can modify admin accounts.' });
  }

  try {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(parsed.data.active ? 1 : 0, id);
    db.prepare(
      `
      INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      nanoid(),
      req.user!.id,
      parsed.data.active ? 'user_activated' : 'user_deactivated',
      'user',
      id,
      JSON.stringify({ active: parsed.data.active }),
      now
    );
    return res.json({ success: true });
  } catch (e: unknown) {
    return res.status(500).json({ error: 'db_error', detail: String((e as any)?.message ?? e) });
  }
});

usersRouter.patch('/:id/role', requirePermission('manage_users'), async (req: AuthRequest, res) => {
  const id = String(req.params.id ?? '');
  if (id === req.user!.id) return res.status(400).json({ error: 'cannot_change_self' });
  const parsed = setRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });

  if (isFirebase(req)) {
    try {
      const fs = getAdminFirestore();

      // Managers can manage users, but cannot assign admin role.
      if (req.user?.role !== 'admin' && parsed.data.roleId === 'admin') {
        return res.status(403).json({ error: 'forbidden', message: 'Only admins can assign admin role.' });
      }

      // Managers can manage users, but cannot modify admin accounts.
      if (req.user?.role !== 'admin') {
        const targetSnap = await fs.collection('users').doc(id).get();
        const targetRole = targetSnap.exists ? String((targetSnap.data() as any)?.roleId ?? 'employee') : 'employee';
        if (targetRole === 'admin') {
          return res.status(403).json({ error: 'forbidden', message: 'Only admins can modify admin accounts.' });
        }
      }

      await fs
        .collection('users')
        .doc(id)
        .set({ roleId: parsed.data.roleId, updatedAt: new Date() }, { merge: true });

      await writeAuditLog({
        actorId: req.user!.id,
        action: 'user_role_changed',
        entityType: 'user',
        entityId: id,
        details: { roleId: parsed.data.roleId },
      });

      return res.json({ success: true });
    } catch (e: unknown) {
      return res.status(500).json({ error: 'firebase_error', detail: String((e as any)?.message ?? e) });
    }
  }

  if (!isLocal(req)) return res.status(400).json({ error: 'unsupported_auth' });

  const db = getDb();
  const now = Date.now();

  // Managers can manage users, but cannot assign admin role.
  if (req.user?.role !== 'admin' && parsed.data.roleId === 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only admins can assign admin role.' });
  }

  // Managers can manage users, but cannot modify admin accounts.
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) as { id: string; role: UserRole } | undefined;
  if (!target) return res.status(404).json({ error: 'not_found' });

  if (req.user?.role !== 'admin' && target.role === 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only admins can modify admin accounts.' });
  }

  try {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(parsed.data.roleId, id);
    db.prepare(
      `
      INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      nanoid(),
      req.user!.id,
      'user_role_changed',
      'user',
      id,
      JSON.stringify({ roleId: parsed.data.roleId }),
      now
    );
    return res.json({ success: true });
  } catch (e: unknown) {
    return res.status(500).json({ error: 'db_error', detail: String((e as any)?.message ?? e) });
  }
});
