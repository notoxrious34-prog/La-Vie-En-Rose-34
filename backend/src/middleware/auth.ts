import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getAdminAuth, getAdminFirestore } from '../lib/firebaseAdmin';

export type UserRole = 'admin' | 'manager' | 'employee' | (string & {});

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
  permissions?: string[];
  authProvider?: 'firebase' | 'local';
};

export type AuthRequest = Request & { user?: AuthUser };

export const ALL_PERMISSIONS = [
  'manage_products',
  'manage_customers',
  'manage_suppliers',
  'access_analytics',
  'manage_users',
  'use_pos',
  'manage_settings',
  'view_activity',
  'manage_repairs',
  'manage_purchases',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export function normalizePermissions(input: unknown): Permission[] {
  const allowed = new Set<string>(ALL_PERMISSIONS);
  if (!Array.isArray(input)) return [];
  const out: Permission[] = [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== 'string') continue;
    const p = v.trim();
    if (!allowed.has(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p as Permission);
  }
  return out;
}

// Permission definitions per role
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: normalizePermissions([
    'manage_products',
    'manage_customers',
    'manage_suppliers',
    'access_analytics',
    'manage_users',
    'use_pos',
    'manage_settings',
    'view_activity',
    'manage_repairs',
    'manage_purchases',
  ]),
  manager: normalizePermissions([
    'manage_products',
    'manage_customers',
    'manage_suppliers',
    'access_analytics',
    'use_pos',
    'view_activity',
    'manage_repairs',
  ]),
  employee: normalizePermissions(['use_pos', 'manage_customers']),
};

export function getUserPermissions(role: UserRole): string[] {
  if (role === 'admin' || role === 'manager' || role === 'employee') return rolePermissions[role] || [];
  return [];
}

export function hasPermission(role: UserRole, permission: string): boolean {
  if (role === 'admin' || role === 'manager' || role === 'employee') {
    return rolePermissions[role]?.includes(permission as any) || false;
  }
  return false;
}

function getJwtSecret() {
  const secret = process.env.LVER_JWT_SECRET;
  if (secret && secret.trim().length >= 32) return secret.trim();

  // In production, do NOT allow a weak or missing secret.
  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  return 'dev-secret-change-me';
}

function isLocalFallbackEnabled() {
  const raw = String(process.env.LVER_ALLOW_LOCAL_FALLBACK ?? '').trim().toLowerCase();
  // In development, default to enabled to support offline/local hybrid auth.
  if (process.env.NODE_ENV !== 'production') {
    if (raw === 'false') return false;
    return true;
  }
  return raw === 'true';
}

async function tryFirebaseAuth(token: string): Promise<AuthUser | null> {
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    const uid = decoded.uid;
    const email = typeof decoded.email === 'string' ? decoded.email : undefined;
    const displayName = typeof decoded.name === 'string' ? decoded.name : undefined;

    const fs = getAdminFirestore();

    const userSnap = await fs.collection('users').doc(uid).get();
    const userDoc = userSnap.exists ? (userSnap.data() as { roleId?: unknown; active?: unknown }) : {};

    const active = userDoc.active === undefined ? true : Boolean(userDoc.active);
    if (!active) return null;

    const roleId = (typeof userDoc.roleId === 'string' ? userDoc.roleId : 'employee') as UserRole;
    const roleSnap = await fs.collection('roles').doc(roleId).get();
    const roleDoc = roleSnap.exists ? (roleSnap.data() as { permissions?: unknown }) : {};
    const permissions = normalizePermissions(roleDoc.permissions);

    return {
      id: uid,
      username: displayName || email || uid,
      role: roleId,
      permissions,
      authProvider: 'firebase',
    };
  } catch {
    return null;
  }
}

function tryLocalJwt(token: string): AuthUser | null {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as AuthUser;
    return { ...payload, authProvider: 'local' };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = String(req.headers.authorization ?? '').trim();
  const match = header.match(/^Bearer\s+(.+?)\s*$/i);
  const token = match?.[1] ? String(match[1]).trim() : '';
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  void (async () => {
    const firebaseUser = await tryFirebaseAuth(token);
    if (firebaseUser) {
      req.user = firebaseUser;
      next();
      return;
    }

    if (isLocalFallbackEnabled()) {
      const localUser = tryLocalJwt(token);
      if (localUser) {
        req.user = localUser;
        next();
        return;
      }
    }

    res.status(401).json({ error: 'unauthorized' });
  })();
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const permList = Array.isArray(req.user.permissions) && req.user.permissions.length > 0 ? req.user.permissions : getUserPermissions(req.user.role);
    if (!permList.includes(permission)) {
      return res.status(403).json({ error: 'forbidden', message: `Missing permission: ${permission}` });
    }
    return next();
  };
}
