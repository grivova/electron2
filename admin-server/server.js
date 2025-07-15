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

const logger  = require('./logger');

const app = express();
const PORT = process.env.PORT || 3005; 
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY;
const LOGS_DIR = path.join(__dirname, process.env.LOGS_DIR);
const CARD_LOG_PATH = path.join(LOGS_DIR, process.env.CARD_LOG_PATH);
const TEST_LOG_PATH = path.join(__dirname, 'logs', 'test.log'); 

app.use(cors());
app.use(morgan('dev')); 
app.use(express.json());
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
        logger.info(`Created logs directory at: ${LOGS_DIR}`);
    } catch (err) {
        logger.error('Failed to create logs directory:', err);
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
        logger.info('Login successful');
        res.status(200).send('Login successful');
    } else {
        res.status(401).send('Invalid password');
        logger.warn('Неверный пароль');
    }
});

app.use('/login.html', express.static(path.join(__dirname, 'public', 'login.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/card-event', (req, res) => {
    logger.info('[CARD EVENT] Received:', req.body);
    
    if (!req.body || !req.body.event) {
        logger.error('Invalid request body:', req.body);
        return res.status(400).json({ message: 'Missing required field: event' });
    }
    
    const { event, uid = 'N/A', timestamp = Date.now() } = req.body;
    const logLine = `[${new Date(timestamp).toISOString()}] [${event}] UID: ${uid}\n`;
    
    try {
        fs.appendFileSync(CARD_LOG_PATH, logLine);
        logger.info('[CARD EVENT] Log written to:', CARD_LOG_PATH);
        return res.status(200).json({ message: 'OK', path: CARD_LOG_PATH });
    } catch (err) {
        logger.error('[CARD EVENT] Failed to write log:', err);
        return res.status(500).json({ 
            message: 'Failed to write log',
            error: err.message,
            path: CARD_LOG_PATH
        });
    }
});

app.post('/test-log', (req, res) => {
    logger.info('Test log request:', req.body);
    try {
        fs.appendFileSync(TEST_LOG_PATH, `${new Date().toISOString()} ${JSON.stringify(req.body)}\n`);
        res.send('OK');
    } catch (err) {
        logger.error('Test log error:', err);
        res.status(500).send('Error writing test log');
    }
});

app.get('/api/card-logs', (req, res) => {
    try {
        if (!fs.existsSync(CARD_LOG_PATH)) {
            return res.status(404).send('Log file not found');
        }
        const logs = fs.readFileSync(CARD_LOG_PATH, 'utf-8');
        res.type('text/plain').send(logs);
    } catch (err) {
        logger.error('Error reading logs:', err);
        res.status(500).send('Error reading log file');
    }
});

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    logger.info('Good connect to Web-socket');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                const ip = data.ip;
                
                if (!ip || !/^[a-zA-Z0-9\.-_]+$/.test(ip)) {
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
            logger.error('WebSocket error:', e);
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
        logger.error('Error reading log file:', error);
        res.status(500).send('Could not read log file.');
    }
});

app.post('/api/logs/clear', async (req, res) => {
    try {
        const logPath = path.join(__dirname, '../backend/logs/app.log');
        await fs.truncate(logPath, 0); 
        res.status(200).json({ message: 'Logs cleared successfully' });
    } catch (error) {
        logger.error('Error clearing log file:', error);
        res.status(500).send('Could not clear log file.');
    }
});

const configPath = path.join(__dirname, '../backend/config.json');
app.get('/api/config', async (req, res) => {
    try {
        const config = await fs.readJson(configPath);
        res.json(config);
    } catch (error) {
        logger.error('Error reading config file:', error);
        res.status(500).json({ message: 'Could not read config file.' });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        const newConfig = req.body;
        await fs.writeJson(configPath, newConfig, { spaces: 4 });
        res.json({ message: 'Config updated successfully' });
    } catch (error) {
        logger.error('Error writing config file:', error);
        res.status(500).json({ message: 'Could not write config file.' });
    }
});

server.listen(PORT, () => {
    logger.info(`Admin server running on ${ADMIN_URL}:${PORT}`);
    logger.info(`Card logs path: ${CARD_LOG_PATH}`);
    logger.info(`Test logs path: ${TEST_LOG_PATH}`);
});