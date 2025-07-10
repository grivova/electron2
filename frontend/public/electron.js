const { app, BrowserWindow, protocol, ipcMain, globalShortcut } = require('electron');
const path = require('path');
require('dotenv').config({path: path.join(__dirname, 'config.env')})
const isDev = require('electron-is-dev');
const fs = require('fs');
const COM_PORT = process.env.COM_PORT;
const COM_SPEED = process.env.COM_SPEED;
const { SerialPort } = require('serialport');
const axios = require('axios');
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
        alwaysOnTop: false,
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

    mainWindow.on('close', (e) => {
        if (!global.allowClose) {
            e.preventDefault();
        }
    });

    mainWindow.on('minimize', (e) => {
        e.preventDefault();
    });
}

app.whenReady().then(() => {
    createWindow();
    global.allowMinimize = false;
    globalShortcut.register('Control+Alt+Backspace', () => {
        global.allowMinimize = true;
        if (mainWindow) mainWindow.minimize();
    });
    
    mainWindow.on('minimize', function (event) {
        if (global.allowMinimize) {
            global.allowMinimize = false;
            return;
        }
        event.preventDefault();
        setTimeout(() => {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
                mainWindow.focus();
            }
        }, 10);
    });
    globalShortcut.register('Control+Alt+Enter', () => {
        global.allowClose = true;
        app.quit();
    });

    globalShortcut.register('F11', () => {
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

//считыватель
SerialPort.list().then(ports => {
    console.log('Доступные порты:', ports.map(p => p.path));
}).catch(err => {
    console.error('Ошибка при получении списка портов:', err);
});
try {
    const port = new SerialPort({ path: COM_PORT, baudRate: parseInt(COM_SPEED, 10)});
    let buffer = '';
    port.on('open', () => {
        console.log(' Serial port открыт');
    });
    port.on('data', (data) => {
        console.log('RAW DATA:', data);
        buffer += data.toString('utf8');
        if (buffer.includes('\n')) {
            const lines = buffer.split('\n');
            lines.forEach((line, idx) => {
                if (idx < lines.length - 1) {
                    const uid = line.trim().replace(/\D/g, '');
                    if (uid) {
                        console.log(`UID карты: ${uid}`);
                        console.log('[DEBUG] Отправляю событие на admin-server:', {
                            event: 'CARD_PLACED',
                            uid: uid,
                            timestamp: Date.now()
                        });
                        // Логгируем в admin-server
                        axios.post('http://localhost:3005/api/card-event', {
                            event: 'CARD_PLACED',
                            uid: uid,
                            timestamp: Date.now()
                        }).catch(err => {
                            console.error('[ADMIN][CARD_LOG] Ошибка отправки:', err.message);
                        });
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('card-detected', uid);
                            console.log(` Отправка события 'card-detected' в рендерер с UID: ${uid}`);
                        } else {
                            console.warn('mainWindow или webContents не определены, событие не отправлено');
                        }
                    }
                }
            });
            buffer = lines[lines.length - 1];
        }
    });
    port.on('error', (err) => {
        console.error('Ошибка serialport:', err);
    });
} catch (err) {
    console.error('!!! FATAL: FAILED TO INITIALIZE SERIALPORT !!!', err);
}

//console.log("NFC disabled for testing");

ipcMain.handle('get-app-config', async (event) => {
  console.log('[IPC] Renderer requested app config. Sending:', appConfig);
  return appConfig;
});

app.whenReady().then(() => {
});