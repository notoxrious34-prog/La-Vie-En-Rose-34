import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getDb } from '../storage/db';
import { normalizePermissions } from '../middleware/auth';

// Enhanced rate limiting with cleanup
const failedAttempts = new Map<string, { count: number; resetAt: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60_000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS, lastAttempt: now });
  } else {
    entry.count += 1;
    entry.lastAttempt = now;
  }
}

function clearFailures(ip: string): void {
  failedAttempts.delete(ip);
}

// Enhanced cleanup with logging
setInterval(() => {
  const now = Date.now();
  const beforeCount = failedAttempts.size;
  
  for (const [key, val] of failedAttempts.entries()) {
    if (now > val.resetAt) failedAttempts.delete(key);
  }
  
  const afterCount = failedAttempts.size;
  if (beforeCount !== afterCount) {
    console.log(`[auth] Cleaned up ${beforeCount - afterCount} expired rate limit entries`);
  }
}, WINDOW_MS).unref();

export const authRouter = Router();

function getJwtSecret(): string {
  const secret = process.env.LVER_JWT_SECRET;
  if (secret && secret.trim().length >= 32) return secret.trim();

  // In production, require a proper secret
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: LVER_JWT_SECRET must be set with at least 32 characters in production');
    throw new Error('JWT secret not configured for production');
  }

  // Dev fallback: keep deterministic secret to stay compatible with middleware verification.
  return 'dev-secret-change-me';
}

// Enhanced validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(255, 'Username too long'),
  password: z.string().min(1, 'Password is required').max(1000, 'Password too long'),
});

// Security headers for auth responses
function setSecurityHeaders(res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

authRouter.post('/login', (req, res) => {
  const clientIp = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0]!.trim();
  
  // Set security headers
  setSecurityHeaders(res);

  // Rate limiting check
  if (isRateLimited(clientIp)) {
    const entry = failedAttempts.get(clientIp);
    const resetTime = entry?.resetAt ? Math.ceil((entry.resetAt - Date.now()) / 60_000) : 15;
    
    return res.status(429).json({ 
      error: 'too_many_attempts', 
      message: `Too many failed login attempts. Try again in ${resetTime} minutes.`,
      resetIn: resetTime
    });
  }

  try {
    // Validate input
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      recordFailure(clientIp);
      return res.status(400).json({ 
        error: 'invalid_body', 
        message: 'Invalid input data',
        details: parsed.error.issues 
      });
    }

    const { username, password } = parsed.data;
    
    // Sanitize username to prevent injection
    const sanitizedUsername = username.trim().slice(0, 255);
    
    // Get user from database with error handling
    let row: any;
    try {
      const db = getDb();
      row = db
        .prepare('SELECT id, username, password_hash, role, active FROM users WHERE username = ?')
        .get(sanitizedUsername);
    } catch (dbErr) {
      console.error('[auth] Database error during login:', dbErr);
      return res.status(503).json({ 
        error: 'database_error', 
        message: 'Authentication service temporarily unavailable' 
      });
    }

    // User not found - use generic error message
    if (!row) {
      recordFailure(clientIp);
      console.warn(`[auth] Login attempt for non-existent user: ${sanitizedUsername} from IP: ${clientIp}`);
      return res.status(401).json({ 
        error: 'invalid_credentials',
        message: 'Invalid username or password'
      });
    }
    
    // Verify password with timing attack protection
    let passwordValid = false;
    try {
      passwordValid = bcrypt.compareSync(password, row.password_hash);
    } catch (bcryptErr) {
      console.error('[auth] bcrypt error:', bcryptErr);
      return res.status(503).json({ 
        error: 'authentication_error', 
        message: 'Authentication service temporarily unavailable' 
      });
    }
    
    if (!passwordValid) {
      recordFailure(clientIp);
      console.warn(`[auth] Invalid password for user: ${row.username} from IP: ${clientIp}`);
      return res.status(401).json({ 
        error: 'invalid_credentials',
        message: 'Invalid username or password'
      });
    }

    // Check if user is active
    const active = (row as any)?.active === undefined ? 1 : Number((row as any).active);
    if (!active) {
      recordFailure(clientIp);
      console.warn(`[auth] Login attempt for inactive user: ${row.username} from IP: ${clientIp}`);
      return res.status(403).json({ 
        error: 'inactive_user',
        message: 'Account is disabled'
      });
    }

    // Update last login timestamp
    try {
      const db = getDb();
      db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), row.id);
    } catch (updateErr) {
      // Non-critical error, log but continue
      console.warn('[auth] Failed to update last_login:', updateErr);
    }

    // Generate JWT token with error handling
    let token: string;
    let resolvedPermissions: string[] = [];
    try {
      let permissions: string[] = [];
      try {
        const db = getDb();
        const roleId = String(row.role ?? 'employee');
        const roleRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(roleId) as { permissions?: string } | undefined;
        let raw: unknown = [];
        try {
          raw = roleRow?.permissions ? JSON.parse(String(roleRow.permissions)) : [];
        } catch {
          raw = [];
        }
        permissions = normalizePermissions(raw);
      } catch {
        permissions = [];
      }

      resolvedPermissions = permissions;

      const payload = { 
        id: row.id, 
        username: row.username, 
        role: row.role,
        permissions: resolvedPermissions,
        iat: Math.floor(Date.now() / 1000)
      };
      
      token = jwt.sign(payload, getJwtSecret(), {
        expiresIn: '12h',
        algorithm: 'HS256',
      });
    } catch (jwtErr) {
      console.error('[auth] JWT generation error:', jwtErr);
      return res.status(500).json({ 
        error: 'token_generation_error', 
        message: 'Failed to generate authentication token' 
      });
    }

    // Clear failed attempts on successful login
    clearFailures(clientIp);
    
    console.log(`[auth] Successful login for user: ${row.username} from IP: ${clientIp}`);
    
    // Return success response
    res.json({ 
      token, 
      user: { 
        id: row.id, 
        username: row.username, 
        role: row.role,
        permissions: resolvedPermissions,
        active: Boolean(active)
      } 
    });
    
  } catch (error) {
    console.error('[auth] Unexpected login error:', error);
    recordFailure(clientIp);
    return res.status(500).json({ 
      error: 'internal_error', 
      message: 'An unexpected error occurred during login' 
    });
  }
});

// Add logout endpoint for token invalidation tracking
authRouter.post('/logout', (req, res) => {
  setSecurityHeaders(res);
  
  // In a stateless JWT setup, we can't directly invalidate tokens
  // But we can log the logout for auditing
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      console.log(`[auth] Logout for user: ${decoded.username}`);
    } catch {
      // Token was invalid, but that's okay for logout
    }
  }
  
  res.json({ message: 'Logged out successfully' });
});

// Token validation endpoint
authRouter.get('/validate', (req, res) => {
  setSecurityHeaders(res);
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }
  
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    res.json({ 
      valid: true, 
      user: { id: decoded.id, username: decoded.username, role: decoded.role }
    });
  } catch (jwtErr) {
    return res.status(401).json({ error: 'invalid_token' });
  }
});
