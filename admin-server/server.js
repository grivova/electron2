const cors = require('cors');
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
const PORT = process.env.PORT || 3005; // Исправлено на 3005
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY;

// Константы путей
const LOGS_DIR = path.join(__dirname, 'logs');
const CARD_LOG_PATH = path.join(LOGS_DIR, 'card-reader.log');
const TEST_LOG_PATH = path.join(LOGS_DIR, 'test.log');

// Middleware
app.use(cors());
app.use(morgan('dev')); 
app.use(express.json());

// Настройка сессий
app.use(session({
    secret: SECRET_KEY, 
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } 
}));

// Проверка и создание папки для логов
if (!fs.existsSync(LOGS_DIR)) {
    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
        console.log(`Created logs directory at: ${LOGS_DIR}`);
    } catch (err) {
        console.error('Failed to create logs directory:', err);
        process.exit(1);
    }
}

const checkAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
};

// Маршруты
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

// Card Event Endpoint (без checkAuth для тестирования)
app.post('/api/card-event', (req, res) => {
    console.log('[DEBUG] Received card event:', req.body);
    
    if (!req.body || !req.body.event) {
        console.error('Invalid request body:', req.body);
        return res.status(400).json({ message: 'Missing required field: event' });
    }
    
    const { event, uid = 'N/A', timestamp = Date.now() } = req.body;
    const logLine = `[${new Date(timestamp).toISOString()}] [${event}] UID: ${uid}\n`;
    
    try {
        fs.appendFileSync(CARD_LOG_PATH, logLine);
        console.log('[SUCCESS] Log written to:', CARD_LOG_PATH);
        return res.status(200).json({ message: 'OK', path: CARD_LOG_PATH });
    } catch (err) {
        console.error('[ERROR] Failed to write log:', err);
        return res.status(500).json({ 
            message: 'Failed to write log',
            error: err.message,
            path: CARD_LOG_PATH
        });
    }
});

// Test Log Endpoint
app.post('/test-log', (req, res) => {
    console.log('Test log request:', req.body);
    try {
        fs.appendFileSync(TEST_LOG_PATH, `${new Date().toISOString()} ${JSON.stringify(req.body)}\n`);
        res.send('OK');
    } catch (err) {
        console.error('Test log error:', err);
        res.status(500).send('Error writing test log');
    }
});

// Получение логов
app.get('/api/card-logs', (req, res) => {
    try {
        if (!fs.existsSync(CARD_LOG_PATH)) {
            return res.status(404).send('Log file not found');
        }
        const logs = fs.readFileSync(CARD_LOG_PATH, 'utf-8');
        res.type('text/plain').send(logs);
    } catch (err) {
        console.error('Error reading logs:', err);
        res.status(500).send('Error reading log file');
    }
});
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
    console.log(`Admin server running on http://localhost:${PORT}`);
    console.log(`Card logs path: ${CARD_LOG_PATH}`);
    console.log(`Test logs path: ${TEST_LOG_PATH}`);
});