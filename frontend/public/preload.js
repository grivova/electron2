console.log('[Preload] Script started.');

const { contextBridge, ipcRenderer } = require('electron');

// Мы создаем безопасный "мост", предоставляя фронтенду только
// определенные функции, а не весь модуль ipcRenderer.
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // Функция для получения конфига (используется в App.tsx)
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),

    // Функция для прослушивания событий прикладывания карты
    onCardDetected: (callback) => {
      // (event, uid) => callback(uid) - мы убираем `event`, чтобы не передавать лишнего в рендерер
      ipcRenderer.on('card-detected', (event, uid) => callback(uid));
    },

    // Функция для очистки обработчика
    removeCardDetectedListeners: () => {
      ipcRenderer.removeAllListeners('card-detected');
    }
  }
);

console.log('[Preload] Script finished. electronAPI exposed.');

// Сообщаем окну, что API готово к использованию
window.dispatchEvent(new Event('electronApiReady'));