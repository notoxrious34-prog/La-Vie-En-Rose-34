const { app, BrowserWindow, ipcMain, shell, Menu, globalShortcut } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const cron = require('node-cron');

const license = require('./license');
const licenseFs = require('./license-firestore');
const backup = require('./backup');
const updater = require('./update');
const log2 = require('electron-log');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
// isDev detection — must handle three scenarios:
//   1. `npm run electron`  → source tree, no frontend/dist  → isDev = true
//   2. `electron-builder --dir` (build:local) → unpacked, has frontend/dist, app.isPackaged=false → isDev = false
//   3. `electron-builder --win` (installer)   → packed asar, app.isPackaged=true                  → isDev = false
const _hasFrontendDist = (() => {
  try {
    const candidates = [
      path.join(process.resourcesPath || '', 'frontend', 'dist', 'index.html'),
      path.join(__dirname, '..', 'frontend', 'dist', 'index.html'),
      path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'),
    ];
    return candidates.some((p) => fs.existsSync(p));
  } catch {
    return false;
  }
})();
let isDev = !app.isPackaged && !_hasFrontendDist;
let backupScheduler = null;

let lastUpdateStatusPayload = null;

const SPLASH_MIN_DURATION_MS = 5200;
let splashShownAtMs = 0;
let splashSafetyTimerA = null;
let splashSafetyTimerB = null;

autoUpdater.logger = log2;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

const APP_NAME = 'La-Vie-En-Rose-34';

ipcMain.handle('print:receipt', async (event) => {
  requireTrustedIpc(event);
  if (!mainWindow) throw new Error('no_window');
  const wc = mainWindow.webContents;
  return await new Promise((resolve, reject) => {
    // Electron expects pageSize in microns when using custom dimensions.
    // 80mm roll width => 80000 microns. Height is arbitrary for roll.
    const roll80 = { width: 80000, height: 300000 };
    wc.print(
      {
        silent: false,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: roll80
      },
      (success, failureReason) => {
        if (!success) return reject(new Error(String(failureReason || 'print_failed')));
        return resolve(true);
      }
    );
  });
});

function createSplashWindow() {
  try {
    if (splashWindow && !splashWindow.isDestroyed()) return splashWindow;

    const splashPath = path.join(__dirname, 'splash', 'index.html');
    const preloadPath = path.join(__dirname, 'splash', 'preload.js');

    const resolveSplashLogoPath = () => {
      const candidates = [];
      if (isDev) {
        candidates.push({ kind: 'url', value: 'http://localhost:5173/brand-mark.png' });
      }

      candidates.push({ kind: 'file', value: path.join(process.resourcesPath, 'frontend', 'dist', 'brand-mark.png') });
      candidates.push({ kind: 'file', value: path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'brand-mark.png') });
      candidates.push({ kind: 'file', value: path.join(__dirname, '..', 'frontend', 'dist', 'brand-mark.png') });
      candidates.push({ kind: 'file', value: path.join(__dirname, '..', '..', 'frontend', 'dist', 'brand-mark.png') });
      candidates.push({ kind: 'file', value: path.join(__dirname, '..', 'frontend', 'public', 'brand-mark.png') });

      for (const c of candidates) {
        if (c.kind === 'url') return c.value;
        try {
          if (fs.existsSync(c.value)) return pathToFileURL(c.value).toString();
        } catch {
          // ignore
        }
      }
      return '';
    };

    const resolveSplashWordmarkPath = () => {
      const candidates = [];
      if (isDev) {
        candidates.push({ kind: 'url', value: 'http://localhost:5173/LVR34_0.png' });
      }

      candidates.push({ kind: 'file', value: path.join(process.resourcesPath, 'frontend', 'dist', 'LVR34_0.png') });
      candidates.push({ kind: 'file', value: path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'LVR34_0.png') });
      candidates.push({ kind: 'file', value: path.join(__dirname, '..', 'frontend', 'dist', 'LVR34_0.png') });
      candidates.push({ kind: 'file', value: path.join(__dirname, '..', '..', 'frontend', 'dist', 'LVR34_0.png') });
      candidates.push({ kind: 'file', value: path.join(__dirname, '..', 'frontend', 'public', 'LVR34_0.png') });

      for (const c of candidates) {
        if (c.kind === 'url') return c.value;
        try {
          if (fs.existsSync(c.value)) return pathToFileURL(c.value).toString();
        } catch {
          // ignore
        }
      }
      return '';
    };

    splashWindow = new BrowserWindow({
      width: 960,
      height: 540,
      resizable: false,
      movable: true,
      frame: false,
      transparent: false,
      show: false,
      alwaysOnTop: true,
      backgroundColor: '#000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: false,
        enableRemoteModule: false,
      },
    });

    try {
      Menu.setApplicationMenu(null);
      splashWindow.setMenuBarVisibility(false);
    } catch {
      // ignore
    }

    try {
      splashWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
          shell.openExternal(String(url));
        } catch {
          // ignore
        }
        return { action: 'deny' };
      });

      splashWindow.webContents.on('will-navigate', (event, url) => {
        try {
          const u = new URL(String(url));
          const allowed = u.protocol === 'file:' || u.protocol === 'app:';
          if (!allowed) {
            event.preventDefault();
            try {
              shell.openExternal(String(url));
            } catch {
              // ignore
            }
          }
        } catch {
          event.preventDefault();
        }
      });

      const ses = splashWindow.webContents.session;
      if (ses && typeof ses.setPermissionRequestHandler === 'function') {
        ses.setPermissionRequestHandler((_wc, _permission, callback) => {
          callback(false);
        });
      }
    } catch {
      // ignore
    }

    const logoUrl = resolveSplashLogoPath();
    const wordmarkUrl = resolveSplashWordmarkPath();
    splashWindow
      .loadFile(splashPath, {
        query: {
          minDurationMs: String(SPLASH_MIN_DURATION_MS),
          ...(logoUrl ? { logo: String(logoUrl) } : {}),
          ...(wordmarkUrl ? { wordmark: String(wordmarkUrl) } : {}),
        },
      })
      .catch((err) => {
        logError(err);
      });

    splashWindow.once('ready-to-show', () => {
      try {
        splashShownAtMs = Date.now();
        splashWindow.show();
      } catch {
        // ignore
      }

      try {
        if (splashSafetyTimerA) clearTimeout(splashSafetyTimerA);
        if (splashSafetyTimerB) clearTimeout(splashSafetyTimerB);
      } catch {
        // ignore
      }

      // Safety net A — fires just after the cinematic minimum.
      // Handles the case where splash:ready is never sent (renderer crash, IPC miss).
      const SPLASH_SAFETY_TIMEOUT_MS = SPLASH_MIN_DURATION_MS + 2000; // 7.2 s
      splashSafetyTimerA = setTimeout(() => {
        try {
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            log('[splash] Safety timeout A fired — showing main window');
            destroySplashWindow();
            showMainAfterSplash();
          }
        } catch {
          // ignore
        }
      }, SPLASH_SAFETY_TIMEOUT_MS);

      // Safety net B — absolute hard fallback (splash HTML itself fails to load).
      splashSafetyTimerB = setTimeout(() => {
        try {
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            log('[splash] Safety timeout B fired — forcing main window visible');
            destroySplashWindow();
            showMainAfterSplash();
          }
        } catch {
          // ignore
        }
      }, 12000);
    });

    splashWindow.on('closed', () => {
      splashWindow = null;
    });

    return splashWindow;
  } catch (err) {
    logError(err);
    return null;
  }
}

function requestCloseSplash() {
  try {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.webContents.send('splash:closeRequested');
  } catch {
    // ignore
  }
}

function destroySplashWindow() {
  try {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.destroy();
  } catch {
    // ignore
  } finally {
    splashWindow = null;
    try {
      if (splashSafetyTimerA) clearTimeout(splashSafetyTimerA);
      if (splashSafetyTimerB) clearTimeout(splashSafetyTimerB);
    } catch {
      // ignore
    }
    splashSafetyTimerA = null;
    splashSafetyTimerB = null;
  }
}

function showMainAfterSplash() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  } catch {
    // ignore
  }
}

ipcMain.on('splash:ready', (event) => {
  if (!isTrustedSplashIpcEvent(event)) return;
  try {
    destroySplashWindow();
  } catch {
    // ignore
  }
  showMainAfterSplash();
});
const BACKEND_PORT = 8787;

function getAppDataPath() {
  return path.join(app.getPath('userData'), 'data');
}

function getLogPath() {
  return path.join(app.getPath('userData'), 'logs');
}

function getDbPath() {
  return path.join(getAppDataPath(), 'store.sqlite');
}

function ensureDirectories() {
  const dataDir = getAppDataPath();
  const logDir = getLogPath();
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function log(message) {
  const logFile = path.join(getLogPath(), 'startup.log');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (e) {
    console.error('Failed to write log:', e);
  }
  console.log(logMessage.trim());
}

function logError(error) {
  const logFile = path.join(getLogPath(), 'startup.log');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ERROR: ${error.stack || error}\n`;
  
  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (e) {
    console.error('Failed to write error log:', e);
  }
  console.error(logMessage.trim());
}

function isTrustedIpcEvent(event) {
  try {
    if (!event || !event.sender) return false;
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (event.sender.id !== mainWindow.webContents.id) return false;

    const frameUrl = String(event.senderFrame?.url || '');
    if (isDev) {
      return /^https?:\/\/localhost(?::\d+)?\//i.test(frameUrl);
    }

    return /^(file|app):\/\//i.test(frameUrl);
  } catch {
    return false;
  }
}

function requireTrustedIpc(event) {
  if (!isTrustedIpcEvent(event)) {
    throw new Error('untrusted_ipc_sender');
  }
}

function isTrustedSplashIpcEvent(event) {
  try {
    if (!event || !event.sender) return false;
    if (!splashWindow || splashWindow.isDestroyed()) return false;
    if (event.sender.id !== splashWindow.webContents.id) return false;

    const frameUrl = String(event.senderFrame?.url || '');
    return /^(file|app):\/\//i.test(frameUrl);
  } catch {
    return false;
  }
}

function sendUpdateStatus(payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      let currentVersion = '0.0.0';
      try {
        currentVersion = String(updater?.getCurrentVersion?.() || app.getVersion() || '0.0.0');
      } catch {
        // ignore
      }

      const info = payload?.info;
      const latestVersion = info?.version ? String(info.version) : undefined;
      const nextPayload = {
        currentVersion,
        latestVersion,
        info: info || undefined,
        progress: payload?.progress || undefined,
        error: payload?.error ? String(payload.error) : undefined,
        state: String(payload?.state || 'unknown'),
      };

      lastUpdateStatusPayload = nextPayload;

      mainWindow.webContents.send('update:status', nextPayload);
    }
  } catch {
    // ignore
  }
}

function sendWindowFullscreenChanged(isFullscreen) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:fullscreen-changed', { isFullscreen: Boolean(isFullscreen) });
    }
  } catch {
    // ignore
  }
}

function setupAutoUpdater() {
  autoUpdater.removeAllListeners();

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ state: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ state: 'available', info });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({ state: 'not_available', info });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({ state: 'downloading', progress });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', info });
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus({ state: 'error', error: err?.message || String(err) });
  });
}

function stopBackend() {
  return new Promise((resolve) => {
    try {
      if (!backendProcess) return resolve(true);
      const proc = backendProcess;
      backendProcess = null;

      const killTree = () => {
        try {
          if (!proc || typeof proc.pid !== 'number') return;
          // Best-effort: on Windows kill the entire process tree to avoid orphaned listeners on relaunch.
          if (process.platform === 'win32') {
            try {
              spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, shell: false });
              return;
            } catch {
              // fall through
            }
          }
          try {
            proc.kill();
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      };

      proc.once('close', () => resolve(true));
      killTree();

      setTimeout(() => resolve(true), 3000);
    } catch {
      resolve(true);
    }
  });
}

function applyAutoUpdaterSettings(updateSettings) {
  try {
    const installMode = updateSettings?.installMode === 'manual' ? 'manual' : 'onQuit';

    autoUpdater.allowPrerelease = false;
    autoUpdater.autoInstallOnAppQuit = installMode === 'onQuit';
  } catch {
    // ignore
  }
}

function sanitizeBackupSettings(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const autoBackup = raw.autoBackup === false ? false : Boolean(raw.autoBackup);
  const frequency = raw.frequency === 'weekly' ? 'weekly' : raw.frequency === 'monthly' ? 'monthly' : 'daily';
  const maxBackupsNum = Number(raw.maxBackups);
  const maxBackups = Number.isFinite(maxBackupsNum) ? Math.min(365, Math.max(1, Math.floor(maxBackupsNum))) : 30;
  const lastBackupNum = Number(raw.lastBackup);
  const lastBackup = Number.isFinite(lastBackupNum) && lastBackupNum > 0 ? lastBackupNum : null;
  return { autoBackup, frequency, maxBackups, lastBackup };
}

function sanitizeUpdateSettings(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const autoCheck = raw.autoCheck === false ? false : Boolean(raw.autoCheck);
  const lastCheckNum = Number(raw.lastCheck);
  const lastCheck = Number.isFinite(lastCheckNum) && lastCheckNum > 0 ? lastCheckNum : null;
  const skipVersion = raw.skipVersion ? String(raw.skipVersion).trim().slice(0, 64) : null;
  const channel = raw.channel === 'beta' ? 'beta' : 'stable';
  const installMode = raw.installMode === 'manual' ? 'manual' : 'onQuit';
  return { autoCheck, lastCheck, skipVersion, channel, installMode };
}

function waitForBackend(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      const req = http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          log('Backend is ready');
          resolve();
        } else {
          retry();
        }
      });
      
      req.on('error', () => {
        retry();
      });
    }
    
    function retry() {
      if (Date.now() - startTime > timeout) {
        log('Backend timeout - continuing anyway');
        resolve();
      } else {
        setTimeout(check, 500);
      }
    }
    
    check();
  });
}

function isBackendAlreadyRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(600, () => {
      try {
        req.destroy();
      } catch {
        // ignore
      }
      resolve(false);
    });
  });
}

function setupBackupScheduler() {
  const settings = backup.getBackupSettings();
  
  if (!settings.autoBackup) {
    log('Auto backup is disabled');
    return;
  }
  
  // Stop existing scheduler if any
  if (backupScheduler) {
    backupScheduler.stop();
  }
  
  // Schedule daily backup at 2 AM
  backupScheduler = cron.schedule('0 2 * * *', async () => {
    log('Running scheduled backup...');
    try {
      const result = await backup.createBackup();
      log('Scheduled backup created: ' + result.filename);
      
      // Clean old backups
      const allBackups = backup.listBackups();
      if (allBackups.length > settings.maxBackups) {
        const toDelete = allBackups.slice(settings.maxBackups);
        for (const b of toDelete) {
          backup.deleteBackup(b.filename);
          log('Deleted old backup: ' + b.filename);
        }
      }
    } catch (err) {
      log('Scheduled backup failed: ' + err.message);
    }
  });
  
  log('Backup scheduler started - frequency: ' + settings.frequency);
}

function startBackend() {
  return new Promise(async (resolve, reject) => {
    log('Starting backend server...');

    // Important: on relaunch, the previous backend process may still be alive (or the port may still be bound).
    // If we detect a healthy backend already running, do NOT spawn a second copy.
    try {
      const running = await isBackendAlreadyRunning();
      if (running) {
        log(`${isDev ? 'Dev' : 'Prod'} mode: backend already running on http://localhost:${BACKEND_PORT} - skipping spawn`);
        resolve();
        return;
      }
    } catch {
      // ignore
    }
    
    // In production, backend is at resources/backend (not app.asar.unpacked)
    const backendSrc = isDev 
      ? path.join(__dirname, '..', 'backend')
      : path.join(process.resourcesPath, 'backend');

    log(`Backend path: ${backendSrc}`);
    
    const dbPath = getDbPath();
    const env = { 
      ...process.env,
      SQLITE_DB_PATH: dbPath,
      // In dev, keep NODE_ENV=development so dev-only behavior (like local fallback default) works.
      // In production, keep NODE_ENV=production.
      NODE_ENV: isDev ? (process.env.NODE_ENV || 'development') : 'production',
      // Hybrid auth: allow local JWT fallback for offline resilience
      ...(isDev
        ? { LVER_ALLOW_LOCAL_FALLBACK: process.env.LVER_ALLOW_LOCAL_FALLBACK ?? 'true' }
        : { LVER_ALLOW_LOCAL_FALLBACK: process.env.LVER_ALLOW_LOCAL_FALLBACK ?? 'false' })
    };

    log(`Database path: ${dbPath}`);
    
    // In dev, use system Node to avoid native module ABI mismatch (better-sqlite3).
    // In production, use Electron's embedded Node runtime.
    const nodeCmd = isDev ? (process.env.npm_node_execpath || 'node') : process.execPath;
    const serverPath = path.join(backendSrc, 'dist', 'server.js');
    
    log(`Starting: ${nodeCmd} ${serverPath}`);
    
    try {
      // When using the Electron executable as a Node runtime, we must explicitly enable Node mode.
      // Otherwise Electron may try to treat server.js as an Electron app entry.
      if (!isDev) {
        env.ELECTRON_RUN_AS_NODE = env.ELECTRON_RUN_AS_NODE || '1';
      }

      backendProcess = spawn(nodeCmd, [serverPath], {
        cwd: backendSrc,
        env: env,
        stdio: isDev ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        detached: false
      });

      const spawned = backendProcess;

      backendProcess.on('error', (err) => {
        logError(err);
        reject(err);
      });

      if (!isDev) {
        // NOTE: Do NOT accumulate stdout into a string buffer — it grows forever
        // and causes a memory leak in long-running sessions. Just log each chunk.
        backendProcess.stdout.on('data', (data) => {
          log('[Backend] ' + data.toString().trim());
        });
        
        backendProcess.stderr.on('data', (data) => {
          log('[Backend Error] ' + data.toString().trim());
        });

        spawned.on('close', (code) => {
          log(`Backend process exited with code ${code}`);
          try {
            if (backendProcess === spawned) backendProcess = null;
          } catch {
            // ignore
          }
        });

        setTimeout(() => {
          waitForBackend()
            .then(resolve)
            .catch(() => resolve());
        }, 5000);
      } else {
        resolve();
      }
    } catch (err) {
      logError(err);
      reject(err);
    }
  });
}

function createWindow() {
  log('Creating main window...');
  const iconPath = path.join(process.resourcesPath, 'icon.ico');
  const devIconPath = path.join(__dirname, 'build', 'icon.ico');
  const resolvedIcon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(devIconPath) ? devIconPath : null);

  const DEV_FRONTEND_URL = String(process.env.LVER_DEV_FRONTEND_URL || 'http://localhost:5173').trim();

  const waitForFrontend = (url, timeout = 30000) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const ping = () => {
        const req = http.get(url, (res) => {
          const ok = (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 500;
          try {
            res.resume();
          } catch {
            // ignore
          }
          if (ok) return resolve(true);
          return retry();
        });

        req.on('error', retry);
        req.setTimeout(750, () => {
          try {
            req.destroy();
          } catch {
            // ignore
          }
          retry();
        });
      };

      const retry = () => {
        if (Date.now() - startTime > timeout) return resolve(false);
        setTimeout(ping, 350);
      };

      ping();
    });
  };

  const loadDevFrontend = async () => {
    log(`Dev mode: waiting for frontend on ${DEV_FRONTEND_URL}`);
    const ok = await waitForFrontend(DEV_FRONTEND_URL, 45000);
    if (!ok) {
      log(`Dev mode: frontend not reachable on ${DEV_FRONTEND_URL} after timeout`);
    }
    log(`Dev mode: loading frontend URL: ${DEV_FRONTEND_URL}`);
    await mainWindow.loadURL(DEV_FRONTEND_URL);
  };

  createSplashWindow();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'La Vie En Rose 34',
    autoHideMenuBar: true,
    fullscreen: false,
    frame: false,
    ...(resolvedIcon ? { icon: resolvedIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    show: false,
    backgroundColor: '#0d0d0d'
  });

  try {
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
  } catch {
    // ignore
  }

  try {
    // Electron v35+ emits a single params object; older versions emit (level, message, line, sourceId).
    mainWindow.webContents.on('console-message', (...args) => {
      try {
        const maybeParams = args[1];
        if (maybeParams && typeof maybeParams === 'object' && 'message' in maybeParams) {
          const p = maybeParams;
          const level = typeof p.level === 'number' ? p.level : 0;
          const line = typeof p.lineNumber === 'number' ? p.lineNumber : undefined;
          const sourceId = typeof p.sourceId === 'string' ? p.sourceId : undefined;
          log(`Console [${level}]: ${String(p.message)}${sourceId ? ` (${sourceId}${line ? `:${line}` : ''})` : ''}`);
          return;
        }
        const level = args[1];
        const message = args[2];
        const line = args[3];
        const sourceId = args[4];
        log(`Console [${String(level)}]: ${String(message)}${sourceId ? ` (${String(sourceId)}${line ? `:${String(line)}` : ''})` : ''}`);
      } catch {
        // ignore
      }
    });

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      logError(new Error(`render-process-gone: reason=${String(details?.reason || '')} exitCode=${String(details?.exitCode ?? '')}`));
    });
  } catch {
    // ignore
  }

  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    try {
      // Ask splash to exit with its own cinematic fade.
      requestCloseSplash();
    } catch {
      // ignore
    }

    // Ensure at least the cinematic minimum duration.
    const elapsed = splashShownAtMs ? (Date.now() - splashShownAtMs) : SPLASH_MIN_DURATION_MS;
    const remain = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed);
    setTimeout(() => {
      // Splash will fade out and respond with splash:ready, but we also guard.
      try {
        requestCloseSplash();
      } catch {
        // ignore
      }
    }, remain);
  });

  mainWindow.on('enter-full-screen', () => sendWindowFullscreenChanged(true));
  mainWindow.on('leave-full-screen', () => sendWindowFullscreenChanged(false));

  // In production, load from local files
  if (!isDev) {
    // In packaged app, resources are in resourcesPath
    // The frontend is at resources/frontend/dist/index.html
    const possiblePaths = [
      path.join(process.resourcesPath, 'frontend', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'index.html'),
      path.join(__dirname, '..', 'frontend', 'dist', 'index.html'),
      path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html')
    ];
    
    let frontendPath = null;
    for (const p of possiblePaths) {
      log(`Checking path: ${p}`);
      if (fs.existsSync(p)) {
        frontendPath = p;
        log(`Found frontend at: ${frontendPath}`);
        break;
      }
    }
    
    if (frontendPath) {
      mainWindow.loadFile(frontendPath).catch(err => {
        log('Error loading file: ' + err.message);
      });
    } else {
      log('Frontend not found - showing error page');
      mainWindow.loadURL(`data:text/html,
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #fce7f3; }
              h1 { color: #be185d; }
              .error { background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; }
              code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
              .path { font-size: 12px; color: #666; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>La Vie En Rose 34</h1>
              <p style="color: red; font-weight: bold;">Frontend files not found</p>
              <p>Please check the installation.</p>
              <div class="path">
                <p>process.resourcesPath: <code>%RESOURCES_PATH%</code></p>
              </div>
            </div>
          </body>
        </html>
      `.replace('%RESOURCES_PATH%', process.resourcesPath));
    }
  } else {
    const useDist = String(process.env.LVER_DEV_USE_DIST ?? '').trim().toLowerCase() === 'true';
    if (useDist) {
      const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
      if (fs.existsSync(distPath)) {
        log(`Dev mode: loading frontend from dist: ${distPath}`);
        mainWindow.loadFile(distPath).catch((err) => {
          log('Error loading dist file: ' + err.message);
          loadDevFrontend().catch(() => undefined);
        });
      } else {
        log('LVER_DEV_USE_DIST=true but frontend/dist not found. Falling back to Vite dev server.');
        loadDevFrontend().catch(() => undefined);
      }
    } else {
      log('Dev mode: loading frontend from Vite dev server (fixed port 5173). Set LVER_DEV_USE_DIST=true to load frontend/dist.');
      loadDevFrontend().catch(() => undefined);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    // Block unexpected top-level navigations (phishing / open redirects)
    mainWindow.webContents.on('will-navigate', (event, url) => {
      try {
        const u = new URL(String(url));
        const allowed =
          u.protocol === 'file:' ||
          (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) ||
          (u.protocol === 'https:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'));
        if (!allowed) {
          event.preventDefault();
          shell.openExternal(String(url));
        }
      } catch {
        event.preventDefault();
      }
    });

    // Default-deny permission requests from renderer
    const ses = mainWindow.webContents.session;
    if (ses && typeof ses.setPermissionRequestHandler === 'function') {
      ses.setPermissionRequestHandler((_wc, _permission, callback) => {
        callback(false);
      });
    }
  } catch {
    // ignore
  }
  
  // Log renderer errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log(`Failed to load: ${errorCode} - ${errorDescription}`);
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log(`Renderer process gone: ${details.reason}`);
  });
  
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // warning or error
      log(`Console [${level}]: ${message}`);
    }
  });
  
  log('Window created successfully');
}

process.on('uncaughtException', (error) => {
  logError(error);
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logError(new Error(String(reason)));
});

// ─── Single-instance lock ────────────────────────────────────────────────────
// Without this, every click on the .exe spawns a new Electron process,
// giving the illusion of multiple windows opening simultaneously.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // A second instance tried to launch — focus the existing one and quit.
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance: bring existing window to front.
    if (mainWindow) {
      if (mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
// ────────────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log('Application starting...');
  
  try {
    createSplashWindow();
    ensureDirectories();
    log('Directories ensured');
    
    // Setup automatic backup scheduler
    setupBackupScheduler();
    
    // Check license validation (skip in development mode)
    if (!isDev) {
      try {
        const status = await licenseFs.getLicenseStatus();
        if (status.status === 'licensed') {
          log('License valid');
        } else if (status.status === 'expired') {
          log('License expired');
        } else if (status.status === 'invalid') {
          log('License invalid: ' + (status.reason || 'unknown'));
        } else {
          log('No license found');
        }
      } catch (e) {
        log('License check failed (offline?): ' + (e?.message || String(e)));
      }
    } else {
      log('Development mode - skipping license check');
    }
    
    await startBackend();
    log('Backend started');
    
    createWindow();
    log('Window created');

    // Fullscreen control (optional, user-triggered)
    ipcMain.on('toggle-fullscreen', (event) => {
      if (!isTrustedIpcEvent(event)) return;
      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      if (!win || win.isDestroyed()) return;
      win.setFullScreen(!win.isFullScreen());
    });

    ipcMain.on('window:minimize', (event) => {
      if (!isTrustedIpcEvent(event)) return;
      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      if (!win || win.isDestroyed()) return;
      win.minimize();
    });

    ipcMain.on('window:toggleMaximize', (event) => {
      if (!isTrustedIpcEvent(event)) return;
      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      if (!win || win.isDestroyed()) return;
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    });

    ipcMain.on('window:close', (event) => {
      if (!isTrustedIpcEvent(event)) return;
      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      if (!win || win.isDestroyed()) return;
      win.close();
    });

    ipcMain.handle('window:isFullscreen', (event) => {
      requireTrustedIpc(event);
      if (!mainWindow || mainWindow.isDestroyed()) return false;
      return mainWindow.isFullScreen();
    });

    try {
      globalShortcut.register('F11', () => {
        const win = BrowserWindow.getFocusedWindow() || mainWindow;
        if (!win || win.isDestroyed()) return;
        win.setFullScreen(!win.isFullScreen());
      });
    } catch {
      // ignore
    }
  } catch (err) {
    logError(err);
    createWindow();
  }

  try {
    setupAutoUpdater();
    const updateSettings = updater.getUpdateSettings ? updater.getUpdateSettings() : { autoCheck: true };
    applyAutoUpdaterSettings(updateSettings);
    if (!isDev && updateSettings?.autoCheck !== false) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  } catch (err) {
    log('Auto updater init failed: ' + (err?.message || err));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle('update:quitAndInstall', (event) => {
  requireTrustedIpc(event);
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log('Application quitting...');
  try {
    globalShortcut.unregisterAll();
  } catch {
    // ignore
  }
  if (backendProcess) {
    backendProcess.kill();
  }
});

ipcMain.handle('get-app-path', (event) => {
  requireTrustedIpc(event);
  return app.getPath('userData');
});

ipcMain.handle('get-backend-url', (event) => {
  requireTrustedIpc(event);
  return `http://localhost:${BACKEND_PORT}`;
});

ipcMain.handle('get-db-path', (event) => {
  requireTrustedIpc(event);
  return getDbPath();
});

// License handlers
ipcMain.handle('license:validate', (event) => {
  requireTrustedIpc(event);
  return licenseFs.getLicenseStatus();
});

ipcMain.handle('license:info', (event) => {
  requireTrustedIpc(event);
  return licenseFs.getLicenseInfo();
});

ipcMain.handle('license:activate', async (event, licenseKey) => {
  requireTrustedIpc(event);
  return await licenseFs.activateLicense(licenseKey);
});

ipcMain.handle('license:deactivate', async (event) => {
  requireTrustedIpc(event);
  return await licenseFs.deactivateLicense();
});

ipcMain.handle('license:generate', (event) => {
  requireTrustedIpc(event);
  return license.generateLicenseKey();
});

ipcMain.handle('license:status', (event) => {
  requireTrustedIpc(event);
  return licenseFs.getLicenseStatus();
});

ipcMain.handle('license:trial', (event) => {
  requireTrustedIpc(event);
  return license.getTrialStatus();
});

// Backup handlers
ipcMain.handle('backup:create', async (event) => {
  requireTrustedIpc(event);
  try {
    await stopBackend();
    const result = await backup.createBackup();
    try {
      await startBackend();
    } catch {
      // ignore
    }
    return { success: true, backup: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:list', (event) => {
  requireTrustedIpc(event);
  return backup.listBackups();
});

ipcMain.handle('backup:restore', async (event, filename) => {
  requireTrustedIpc(event);
  // Sanitize filename: prevent path traversal
  const safeFilename = String(filename || '').replace(/[/\\]/g, '');
  if (!safeFilename || !safeFilename.endsWith('.sqlite')) {
    return { success: false, error: 'invalid_filename' };
  }
  try {
    await stopBackend();
    await backup.restoreBackup(safeFilename);
    try {
      await startBackend();
    } catch {
      // ignore restart errors
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:delete', async (event, filename) => {
  requireTrustedIpc(event);
  // Sanitize filename: prevent path traversal
  const raw = String(filename || '');
  const safeFilename = raw.replace(/[/\\]/g, '');
  if (!safeFilename || safeFilename !== raw || !safeFilename.endsWith('.sqlite')) {
    return { success: false, error: 'invalid_filename' };
  }
  try {
    await backup.deleteBackup(safeFilename);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:getSettings', (event) => {
  requireTrustedIpc(event);
  return backup.getBackupSettings();
});

ipcMain.handle('backup:saveSettings', (event, settings) => {
  requireTrustedIpc(event);
  const next = sanitizeBackupSettings(settings);
  backup.saveBackupSettings(next);
  try {
    setupBackupScheduler();
  } catch {
    // ignore
  }
  return { success: true };
});

ipcMain.handle('backup:getPath', (event) => {
  requireTrustedIpc(event);
  return backup.getBackupPath();
});

// Update handlers
ipcMain.handle('update:check', async (event) => {
  requireTrustedIpc(event);
  return await updater.checkForUpdates();
});

ipcMain.handle('update:getVersion', (event) => {
  requireTrustedIpc(event);
  return updater.getCurrentVersion();
});

ipcMain.handle('update:getSettings', (event) => {
  requireTrustedIpc(event);
  return updater.getUpdateSettings();
});

ipcMain.handle('update:saveSettings', (event, settings) => {
  requireTrustedIpc(event);
  const next = sanitizeUpdateSettings(settings);
  updater.saveUpdateSettings(next);
  applyAutoUpdaterSettings(next);
  return { success: true };
});

ipcMain.handle('update:download', async (event, downloadUrl) => {
  requireTrustedIpc(event);
  try {
    if (downloadUrl !== undefined && downloadUrl !== null && String(downloadUrl).trim() !== '') {
      return { success: false, error: 'invalid_args' };
    }
    const result = await updater.downloadUpdate();
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:install', async (event, filePath) => {
  requireTrustedIpc(event);
  try {
    if (filePath !== undefined && filePath !== null && String(filePath).trim() !== '') {
      return { success: false, error: 'invalid_args' };
    }
    const result = await updater.installUpdate();
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('update:status-request', (event) => {
  if (!isTrustedIpcEvent(event)) return;
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (lastUpdateStatusPayload) {
      mainWindow.webContents.send('update:status', lastUpdateStatusPayload);
      return;
    }
    sendUpdateStatus({ state: 'idle' });
  } catch {
    // ignore
  }
});

ipcMain.on('update:download', async (event) => {
  if (!isTrustedIpcEvent(event)) return;
  try {
    // Triggers download using the configured provider (GitHub) and release artifacts.
    // Progress will be emitted via the autoUpdater listeners.
    await autoUpdater.downloadUpdate();
  } catch (err) {
    sendUpdateStatus({ state: 'error', error: err?.message || String(err) });
  }
});
