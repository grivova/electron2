const { logger } = require('../../backend/src/config/logger');
logger.info('[Preload] Script started.');
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    onCardDetected: (callback) => {
      ipcRenderer.on('card-detected', (event, uid) => callback(uid));
    },

    removeCardDetectedListeners: () => {
      ipcRenderer.removeAllListeners('card-detected');
    }
  }
);

logger.log('[Preload] Script finished. electronAPI exposed.');
window.dispatchEvent(new Event('electronApiReady'));