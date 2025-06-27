const { app, BrowserWindow, protocol, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { NFC } = require('nfc-pcsc');
const fs = require('fs');

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);

if (!Promise.withResolvers) {
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

let mainWindow;
let appConfig = {};
const configPath = isDev 
    ? path.join(__dirname, '../src/config.json') 
    : path.join(process.resourcesPath, 'config.json');

try {
    console.log(`[Config] Trying to load config from: ${configPath}`);
    if (fs.existsSync(configPath)) {
        appConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log('[Config] External config loaded successfully:', appConfig);
    } else {
        console.log('[Config] External config file not found. Using default values.');
    }
} catch (error) {
    console.error('[Config] Could not load external config file:', error);
}

global.allowClose = false;

function createWindow() {
    const preloadPath = path.join(__dirname, 'preload.js');
    try {
        fs.accessSync(preloadPath);
        console.log(`[DEBUG] Preload script found at: ${preloadPath}`);
    } catch (e) {
        console.error(`[FATAL] Preload script not found at: ${preloadPath}`);
        app.quit();
        return;
    }

    mainWindow = new BrowserWindow({
        kiosk: true,
        titleBarStyle:'hidden',
        alwaysOnTop: true,
        webPreferences: {
            preload: preloadPath,  
            contextIsolation: true, 
            nodeIntegration: false   
            
        },
    });

    mainWindow.loadURL(
        isDev
            ? 'http://localhost:3000'
            : `file://${path.join(__dirname, '../build/index.html')}`
    );

    // Отключаем стандартное закрытие
    mainWindow.on('close', (e) => {
        if (!global.allowClose) {
            e.preventDefault();
        }
    });

    // Отключаем сворачивание
    mainWindow.on('minimize', (e) => {
        e.preventDefault();
    });
}

app.whenReady().then(() => {
    createWindow();

    // Скрыть окно по Ctrl+Alt+Backspace
    globalShortcut.register('Control+Alt+Backspace', () => {
        if (mainWindow) mainWindow.minimize();
    });

    // Закрыть окно по Ctrl+Alt+Delete
    globalShortcut.register('Control+Alt+Enter', () => {
        global.allowClose = true;
        app.quit();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// --- NFC/PC-SC Integration ---

// ВРЕМЕННО ОТКЛЮЧАЕМ NFC ДЛЯ ТЕСТИРОВАНИЯ
/*
try {
    const nfc = new NFC(); // Создаем новый экземпляр

    nfc.on('reader', reader => {
        console.log(`${reader.reader.name}  device attached`);

        reader.on('card', card => {
            console.log(`${reader.reader.name}  card detected`, card);
            // UID карты обычно находится в card.uid
            if (card.uid) {
                // Отправляем UID в рендерер-процесс (в наше React-приложение)
                mainWindow.webContents.send('card-detected', card.uid);
            }
        });

        reader.on('card.off', card => {
            console.log(`${reader.reader.name}  card removed`, card);
        });

        reader.on('error', err => {
            console.log(`${reader.reader.name}  an error occurred`, err);
        });

        reader.on('end', () => {
            console.log(`${reader.reader.name}  device removed`);
        });
    });

    nfc.on('error', err => {
        console.log('an error occurred', err);
    });

} catch (e) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! FATAL: FAILED TO INITIALIZE NFC-PCSC !!!");
    console.error(e);
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}
*/

console.log("NFC temporarily disabled for testing");

ipcMain.handle('get-app-config', async (event) => {
  console.log('[IPC] Renderer requested app config. Sending:', appConfig);
  return appConfig;
});

app.whenReady().then(() => {
});