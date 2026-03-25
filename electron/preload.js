const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  platform: process.platform,
  print: {
    receipt: () => ipcRenderer.invoke('print:receipt'),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
    isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
    onFullscreenChanged: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('window:fullscreen-changed', handler);
      return () => ipcRenderer.removeListener('window:fullscreen-changed', handler);
    },
  },
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },
  
  // License
  license: {
    validate: () => ipcRenderer.invoke('license:validate'),
    info: () => ipcRenderer.invoke('license:info'),
    activate: (key, days) => ipcRenderer.invoke('license:activate', key, days),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    generate: () => ipcRenderer.invoke('license:generate'),
    status: () => ipcRenderer.invoke('license:status'),
    trial: () => ipcRenderer.invoke('license:trial')
  },
  
  // Backup
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (filename) => ipcRenderer.invoke('backup:restore', filename),
    delete: (filename) => ipcRenderer.invoke('backup:delete', filename),
    getSettings: () => ipcRenderer.invoke('backup:getSettings'),
    saveSettings: (settings) => ipcRenderer.invoke('backup:saveSettings', settings),
    getPath: () => ipcRenderer.invoke('backup:getPath')
  },
  
  // Update
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    getVersion: () => ipcRenderer.invoke('update:getVersion'),
    getSettings: () => ipcRenderer.invoke('update:getSettings'),
    saveSettings: (settings) => ipcRenderer.invoke('update:saveSettings', settings),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
    onStatus: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('update:status', handler);
      return () => ipcRenderer.removeListener('update:status', handler);
    },
    requestStatus: () => ipcRenderer.send('update:status-request'),
    downloadUpdate: () => ipcRenderer.send('update:download')
  }
});
