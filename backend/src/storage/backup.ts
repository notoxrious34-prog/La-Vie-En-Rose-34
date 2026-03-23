import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDb } from './db';

function dataDir() {
  const explicit = process.env.LVER_DATA_DIR;
  if (explicit) return explicit;
  return path.join(process.cwd(), '.data');
}

function backupsDir() {
  return path.join(dataDir(), 'backups');
}

export async function runBackupNow(): Promise<{ success: boolean; outFile?: string; error?: string }> {
  try {
    const db = getDb();
    fs.mkdirSync(backupsDir(), { recursive: true });

    const ts = new Date();
    const stamp = ts.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outFile = path.join(backupsDir(), `store-${stamp}.sqlite`);

    // db.backup() returns a Promise in better-sqlite3
    await db.backup(outFile);

    pruneOldBackups(30);

    return { success: true, outFile };
  } catch (error) {
    console.error('[backup] Failed to create backup:', error);
    return { success: false, error: String(error) };
  }
}

function pruneOldBackups(keepDays: number) {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) return;

  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  try {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.sqlite')) continue;
      const full = path.join(dir, file);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
      } catch {
        // ignore individual file errors
      }
    }
  } catch {
    // ignore readdir errors
  }
}

export function startBackupScheduler(): void {
  // Dynamically require cron so the server starts even if cron is absent
  let cron: any;
  try {
    cron = require('node-cron');
  } catch {
    console.warn('[backup] node-cron not available — scheduled backups disabled');
    return;
  }

  // Every day at 02:00 local time
  cron.schedule('0 2 * * *', () => {
    void runBackupNow().then((r) => {
      if (r.success) {
        console.log('[backup] Daily backup completed:', r.outFile);
      } else {
        console.error('[backup] Daily backup failed:', r.error);
      }
    });
  });
}
