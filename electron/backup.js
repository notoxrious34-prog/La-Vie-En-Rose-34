const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getAppDataPath() {
  return path.join(app.getPath('userData'), 'data');
}

function getBackupPath() {
  const documentsPath = app.getPath('documents');
  return path.join(documentsPath, 'La-Vie-En-Rose-34', 'backups');
}

function getDbPath() {
  return path.join(getAppDataPath(), 'store.sqlite');
}

function ensureBackupDir() {
  const backupPath = getBackupPath();
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  return backupPath;
}

function createBackup() {
  return new Promise((resolve, reject) => {
    const dbPath = getDbPath();
    const backupDir = ensureBackupDir();
    
    if (!fs.existsSync(dbPath)) {
      return reject(new Error('Database file not found'));
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.sqlite`;
    const backupPath = path.join(backupDir, backupFileName);
    
    try {
      fs.copyFileSync(dbPath, backupPath);
      
      const stats = fs.statSync(backupPath);
      
      const backupInfo = {
        filename: backupFileName,
        path: backupPath,
        size: stats.size,
        createdAt: stats.mtime.getTime()
      };
      
      resolve(backupInfo);
    } catch (err) {
      reject(err);
    }
  });
}

function listBackups() {
  const backupDir = ensureBackupDir();
  
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sqlite'))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          path: filePath,
          size: stats.size,
          createdAt: stats.mtime.getTime()
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    
    return files;
  } catch (err) {
    return [];
  }
}

function restoreBackup(backupFilename) {
  return new Promise((resolve, reject) => {
    const backupDir = getBackupPath();
    const backupPath = path.join(backupDir, backupFilename);
    const dbPath = getDbPath();
    
    if (!fs.existsSync(backupPath)) {
      return reject(new Error('Backup file not found'));
    }
    
    try {
      fs.copyFileSync(backupPath, dbPath);
      resolve({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
      reject(err);
    }
  });
}

function deleteBackup(backupFilename) {
  return new Promise((resolve, reject) => {
    const backupDir = getBackupPath();
    const backupPath = path.join(backupDir, backupFilename);
    
    if (!fs.existsSync(backupPath)) {
      return reject(new Error('Backup file not found'));
    }
    
    try {
      fs.unlinkSync(backupPath);
      resolve({ success: true, message: 'Backup deleted successfully' });
    } catch (err) {
      reject(err);
    }
  });
}

function getBackupSettings() {
  const settingsPath = path.join(getAppDataPath(), 'backup-settings.json');
  
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return getDefaultBackupSettings();
    }
  }
  
  return getDefaultBackupSettings();
}

function getDefaultBackupSettings() {
  return {
    autoBackup: true,
    frequency: 'daily',
    maxBackups: 30,
    lastBackup: null
  };
}

function saveBackupSettings(settings) {
  const settingsPath = path.join(getAppDataPath(), 'backup-settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

module.exports = {
  getBackupPath,
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupSettings,
  saveBackupSettings,
  getDbPath
};
