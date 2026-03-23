import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getAdminAuth, getAdminFirestore } from '../lib/firebaseAdmin';

export type UserRole = 'admin' | 'manager' | 'employee';

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
  permissions?: string[];
  authProvider?: 'firebase' | 'local';
};

export type AuthRequest = Request & { user?: AuthUser };

// Permission definitions per role
const rolePermissions: Record<UserRole, string[]> = {
  admin: ['manage_products', 'manage_customers', 'manage_suppliers', 'access_analytics', 'manage_users', 'use_pos', 'manage_settings', 'view_activity', 'manage_repairs', 'manage_purchases'],
  manager: ['manage_products', 'manage_customers', 'manage_suppliers', 'access_analytics', 'use_pos', 'view_activity', 'manage_repairs'],
  employee: ['use_pos', 'manage_customers']
};

export function getUserPermissions(role: UserRole): string[] {
  return rolePermissions[role] || [];
}

export function hasPermission(role: UserRole, permission: string): boolean {
  return rolePermissions[role]?.includes(permission) || false;
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
    const permissions = Array.isArray(roleDoc.permissions) ? roleDoc.permissions.filter((p) => typeof p === 'string') : [];

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
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
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
