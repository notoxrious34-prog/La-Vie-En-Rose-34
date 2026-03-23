import { Router } from 'express';
import { getDb } from '../storage/db';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const startTime = Date.now();
  let dbOk = false;
  let dbError: string | null = null;
  let dbPath: string | null = null;
  
  try {
    const db = getDb();
    const result = db.prepare('SELECT 1 as test').get();
    dbOk = !!(result && typeof result === 'object' && (result as any).test === 1);
    
    // Get database file info
    const dbFile = (db as any).name;
    if (dbFile) {
      dbPath = dbFile;
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    dbOk = false;
  }

  const responseTime = Date.now() - startTime;
  const status = dbOk ? 200 : 503;
  
  const healthData = {
    ok: dbOk,
    name: 'la-vie-en-rose-34-backend',
    version: '2.0.0',
    ts: Date.now(),
    uptime: Math.floor(process.uptime()),
    responseTime: `${responseTime}ms`,
    db: {
      status: dbOk ? 'ok' : 'unavailable',
      error: dbError,
      path: dbPath
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version
  };

  res.status(status).json(healthData);
});

// Detailed health endpoint for diagnostics
healthRouter.get('/detailed', (_req, res) => {
  const startTime = Date.now();
  let dbOk = false;
  let dbError: string | null = null;
  let dbStats: any = null;
  
  try {
    const db = getDb();
    
    // Test basic connectivity
    db.prepare('SELECT 1').get();
    dbOk = true;
    
    // Get database statistics
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      const stats: any = { tables: {} };
      
      for (const table of tables) {
        try {
          const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
          stats.tables[table.name] = count.count;
        } catch (tableErr) {
          stats.tables[table.name] = 'error';
        }
      }
      
      dbStats = stats;
    } catch (statsErr) {
      console.warn('Could not fetch database stats:', statsErr);
    }
    
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    dbOk = false;
  }

  const responseTime = Date.now() - startTime;
  const status = dbOk ? 200 : 503;
  
  res.status(status).json({
    ok: dbOk,
    name: 'la-vie-en-rose-34-backend',
    version: '2.0.0',
    ts: Date.now(),
    uptime: Math.floor(process.uptime()),
    responseTime: `${responseTime}ms`,
    db: {
      status: dbOk ? 'ok' : 'unavailable',
      error: dbError,
      stats: dbStats
    },
    memory: process.memoryUsage(),
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version,
    env: {
      nodeEnv: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production'
    }
  });
});
