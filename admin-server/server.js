const express = require('express');
const morgan = require('morgan');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const { app: electronApp, dialog } = require('electron');
const sql = require('mssql');
const { exec, spawn } = require('child_process');
const iconv = require('iconv-lite');
const WebSocket = require('ws');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY;
app.use(morgan('dev')); 
app.use(express.json()); 

// Настройка сессий
app.use(session({
    secret: SECRET_KEY, 
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } 
}));

const checkAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        res.status(200).send('Login successful');
    } else {
        res.status(401).send('Invalid password');
    }
});

app.use('/login.html', express.static(path.join(__dirname, 'public', 'login.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', checkAuth);

app.get('/api/browse', async (req, res) => {
    if (!electronApp.isReady()) {
        await electronApp.whenReady();
    }

    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        res.json({ path: result.filePaths[0] });
    } else {
        res.status(404).json({ message: 'No folder selected' });
    }
});

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Good connect to Web-socket');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                const ip = data.ip;
                
                if (!ip || !/^[a-zA-Z0-9\.\-_]+$/.test(ip)) {
                    ws.send(JSON.stringify({ type: 'error', data: 'Invalid IP address format' }));
                    return;
                }

                const pingProcess = spawn('ping', ['-t', ip]); 

                pingProcess.stdout.on('data', (data) => {
                    const decodedData = iconv.decode(data, 'cp866');
                    ws.send(JSON.stringify({ type: 'data', data: decodedData }));
                });

                pingProcess.stderr.on('data', (data) => {
                    const decodedData = iconv.decode(data, 'cp866');
                    ws.send(JSON.stringify({ type: 'error', data: decodedData }));
                });

                pingProcess.on('close', (code) => {
                    ws.send(JSON.stringify({ type: 'close', data: `Процесс завершен с кодом ${code}` }));
                });

                ws.on('close', () => {
                    pingProcess.kill(); 
                });
            }
        } catch (e) {
            console.error('WebSocket error:', e);
            ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
        }
    });
});

app.get('/api/check-db', async (req, res) => {

    let adminToDbStatus = { status: 'offline', message: 'Test not performed' };
    try {
        const dbConfig = {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true },
            pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
            requestTimeout: 5000
        };
        const pool = new sql.ConnectionPool(dbConfig);
        await pool.connect();
        await pool.query`SELECT 1`;
        adminToDbStatus = { status: 'online', message: 'Прямое подключение успешно' };
        await pool.close();
    } catch (error) {
        adminToDbStatus = { status: 'offline', message: `Ошибка прямого подключения: ${error.message}` };
    }

    let backendToDbStatus = { status: 'offline', message: 'Test not performed' };
    try {
        const response = await axios.get(`${process.env.BACKEND_URL}/api/db-status`, { timeout: 3000 });
        if (response.data.status === 'ok') {
            backendToDbStatus = { status: 'online', message: 'Бэкенд успешно подключен' };
        } else {
            backendToDbStatus = { status: 'offline', message: 'Бэкенд сообщил об ошибке' };
        }
    } catch (error) {
        backendToDbStatus = { status: 'offline', message: 'Не удалось связаться с бэкендом' };
    }

    res.json({
        adminToDb: adminToDbStatus,
        backendToDb: backendToDbStatus
    });
});

app.get('/api/status', async (req, res) => {
    try {
        await axios.get(`${process.env.BACKEND_URL}/api/test`, { timeout: 2000 });
        res.json({ status: 'online' });
    } catch (error) {
        res.json({ status: 'offline' });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const logPath = path.join(__dirname, '../backend/logs/app.log');
        const logs = await fs.readFile(logPath, 'utf-8');
        res.type('text/plain');
        res.send(logs);
    } catch (error) {
        console.error('Error reading log file:', error);
        res.status(500).send('Could not read log file.');
    }
});

app.post('/api/logs/clear', async (req, res) => {
    try {
        const logPath = path.join(__dirname, '../backend/logs/app.log');
        await fs.truncate(logPath, 0); 
        res.status(200).json({ message: 'Logs cleared successfully' });
    } catch (error) {
        console.error('Error clearing log file:', error);
        res.status(500).send('Could not clear log file.');
    }
});

const configPath = path.join(__dirname, '../backend/config.json');
app.get('/api/config', async (req, res) => {
    try {
        const config = await fs.readJson(configPath);
        res.json(config);
    } catch (error) {
        console.error('Error reading config file:', error);
        res.status(500).json({ message: 'Could not read config file.' });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        const newConfig = req.body;
        await fs.writeJson(configPath, newConfig, { spaces: 4 });
        res.json({ message: 'Config updated successfully' });
    } catch (error) {
        console.error('Error writing config file:', error);
        res.status(500).json({ message: 'Could not write config file.' });
    }
});

server.listen(PORT, () => {
    console.log(`Admin server on http://localhost:${PORT}`);
}); 