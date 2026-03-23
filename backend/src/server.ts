import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { initDb } from './storage/db';
import { startBackupScheduler } from './storage/backup';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { customersRouter } from './routes/customers';
import { posRouter } from './routes/pos';
import { ordersPublicRouter } from './routes/orders-public';
import { repairsRouter } from './routes/repairs';
import { suppliersRouter } from './routes/suppliers';
import { purchasesRouter } from './routes/purchases';
import { analyticsRouter } from './routes/analytics';
import { variantsRouter } from './routes/variants';
import { usersRouter } from './routes/users';
import { activityRouter } from './routes/activity';
import { settingsRouter } from './routes/settings';
import { requestContext } from './middleware/requestContext';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logReq } from './lib/logger';

const app = express();
app.use(requestContext);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (e.g., curl, server-to-server) and
      // Electron renderer loaded via file:// (origin will be undefined or "null").
      if (!origin || origin === 'null') return callback(null, true);

      const allowed = new Set([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'http://localhost:5175',
        'http://127.0.0.1:5175',
        'http://localhost:8787',
        'http://127.0.0.1:8787',
      ]);

      if (allowed.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(
  morgan('dev', {
    stream: {
      write: (msg) => {
        // keep morgan format but ensure requestId is available in our logs too
        // eslint-disable-next-line no-console
        console.log(msg.trimEnd());
      },
    },
  })
);

app.use((req, res, next) => {
  res.on('finish', () => {
    const start = typeof (req as any).requestStartMs === 'number' ? (req as any).requestStartMs : undefined;
    const durationMs = start ? Date.now() - start : undefined;
    logReq(req, 'info', 'Request completed', {
      status: res.statusCode,
      durationMs,
    });
  });
  next();
});

const isProduction = process.env.NODE_ENV === 'production';
// In production: backend is at resources/backend/dist/server.js
// frontend is at resources/frontend/dist/index.html
const frontendDistPath = isProduction 
  ? path.join(__dirname, '..', '..', 'frontend', 'dist')
  : path.join(process.cwd(), '..', 'frontend', 'dist');

const adminPanelHtmlPath = isProduction
  ? path.join(__dirname, '..', '..', 'licensing', 'admin-panel', 'admin.html')
  : path.join(process.cwd(), '..', 'licensing', 'admin-panel', 'admin.html');

app.get('/admin-panel/admin', (_req, res) => {
  if (fs.existsSync(adminPanelHtmlPath)) {
    res.sendFile(adminPanelHtmlPath);
    return;
  }
  res.status(404).json({ error: 'Admin panel not found', path: adminPanelHtmlPath });
});

// Root route (dev/info only - in production SPA serves this)
app.get('/', (_req, res) => {
  res.json({ 
    name: 'la-vie-en-rose-34-backend', 
    version: '1.0.0',
    status: 'running',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/products',
      '/api/customers',
      '/api/pos',
      '/api/repairs',
      '/api/suppliers',
      '/api/purchases',
      '/api/analytics',
      '/api/variants'
    ]
  });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/pos', posRouter);
app.use('/api/public/orders', ordersPublicRouter);
app.use('/api/repairs', repairsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/variants', variantsRouter);
app.use('/api/users', usersRouter);
app.use('/api/activity', activityRouter);
app.use('/api/settings', settingsRouter);

// Serve frontend SPA AFTER all API routes to prevent catch-all from swallowing API 404s
if (isProduction && fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 404 + centralized error handler must be last
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 8787);

async function main() {
  try {
    // Initialize database with error handling
    console.log('[backend] Initializing database...');
    initDb();
    console.log('[backend] Database initialized successfully');
    
    // Start backup scheduler with error handling
    console.log('[backend] Starting backup scheduler...');
    startBackupScheduler();
    console.log('[backend] Backup scheduler started');

    // Start server with error handling
    const server = app.listen(port, () => {
      console.log(`[backend] Server listening on http://localhost:${port}`);
      console.log(`[backend] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[backend] Process ID: ${process.pid}`);
    });

    // Handle server errors
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[backend] Port ${port} is already in use`);
      } else {
        console.error('[backend] Server error:', err);
      }
      process.exit(1);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      console.log(`[backend] Received ${signal}, starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          console.error('[backend] Error during server shutdown:', err);
          process.exit(1);
        }
        
        console.log('[backend] Server closed successfully');
        
        // Close database connection
        try {
          const { getDb } = require('./storage/db');
          const db = getDb();
          db.close();
          console.log('[backend] Database connection closed');
        } catch (dbErr) {
          console.warn('[backend] Error closing database:', dbErr);
        }
        
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('[backend] Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('[backend] Uncaught exception:', err);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[backend] Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (err) {
    console.error('[backend] Failed to start server:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
