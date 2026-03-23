const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  splash: {
    ready: () => ipcRenderer.send('splash:ready'),
    onCloseRequested: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('splash:closeRequested', handler);
      return () => ipcRenderer.removeListener('splash:closeRequested', handler);
    },
  },
});
