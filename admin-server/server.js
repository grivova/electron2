const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { app: electronApp, dialog } = require('electron');
const sql = require('mssql');
const { exec, spawn } = require('child_process');
const iconv = require('iconv-lite');
const WebSocket = require('ws');
const csurf = require('csurf');
require('dotenv').config({ path: path.join(__dirname, './config.env') });
require('dotenv').config({ path: __dirname + '/moders/config.env' });

const logger  = require('./logger');
const moderAuthRouter = require('./moders/routes/moderAuth');
const contentRouter = require('./moders/routes/content');
const moderDb = require('./moders/db');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3005; 
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY || 'mhmh4563463fds';
const LOGS_DIR = path.join(__dirname, process.env.LOGS_DIR);
const ADMIN_LOG_DIR = path.join(__dirname, process.env.ADMIN_LOG_DIR);
const CARD_LOG_PATH = path.join(LOGS_DIR, process.env.CARD_LOG_PATH);
const ADMIN_LOG = path.join(ADMIN_LOG_DIR, process.env.ADMIN_LOG);
const BACKEND_APP_LOG = path.join(__dirname, process.env.BACKEND_APP_LOG);
const CARD_LOG = path.join(__dirname, process.env.CARD_LOG);
const TEST_LOG_PATH = path.join(__dirname, 'logs', 'test.log'); 
const ADMIN_URL = process.env.ADMIN_URL;

const allowedOrigins = (process.env.ALLOWED_ORIGINS)
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS: Origin not allowed'), false);
    }
  },
  credentials: true
}));
app.use(morgan('dev')); 
app.use(express.json());

const sessionStore = new MySQLStore({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

sessionStore.on('error', function(error) {
  console.error('[SESSION STORE ERROR]', error);
});

app.use(session({
  secret: SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { secure: false, httpOnly: true, maxAge: 10 * 60 * 60 * 1000 }
}));

const csrfProtection = csurf({ cookie: false });

app.post('/moders/moder-login', moderAuthRouter.stack.find(r => r.route && r.route.path === '/moder-login' && r.route.methods.post).route.stack[0].handle);

// Глобальный csurf — исключаем только /login и /moders/moder-login
app.use((req, res, next) => {
  if (
    req.path === '/login' ||
    req.path === '/moders/moder-login'
  ) {
    return next();
  }
  return csrfProtection(req, res, next);
});

// Для выдачи токена — отдельный csurf middleware
app.get('/moders/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'CSRF token invalid' });
  }
  next(err);
});

app.use('/moders', moderAuthRouter);
app.use('/moders/content', contentRouter);
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

const parseEnv = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
};

const updateEnv = async (filePath, updates) => {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const keys = Object.keys(updates);
  const updated = new Set();
  const newLines = lines.map(line => {
    if (!line.trim() || line.trim().startsWith('#') || !line.includes('=')) return line;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    if (keys.includes(key)) {
      updated.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  // Добавить новые ключи, если их не было
  for (const key of keys) {
    if (!updated.has(key)) {
      newLines.push(`${key}=${updates[key]}`);
    }
  }
  await fs.writeFile(filePath, newLines.join('\n'), 'utf-8');
};

const configEnvPath = path.join(__dirname, 'config.env');
const modersEnvPath = path.join(__dirname, 'moders', 'config.env');

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
app.use('/uploads', express.static(__dirname + '/uploads'));

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

// Получить параметры MS SQL
app.get('/api/settings/mssql', checkAuth, async (req, res) => {
  try {
    const env = await parseEnv(configEnvPath);
    res.json({
      DB_USER: env.DB_USER || '',
      DB_PASSWORD: env.DB_PASSWORD || '',
      DB_SERVER: env.DB_SERVER || '',
      DB_NAME: env.DB_NAME || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения config.env:', e);
    res.status(500).json({ message: 'Ошибка чтения config.env' });
  }
});
// Обновить параметры MS SQL
app.post('/api/settings/mssql', checkAuth, async (req, res) => {
  const updates = req.body;
  // Не обновляем пароль, если он пришел пустой, но не был явно изменен
  if (updates.DB_PASSWORD === '') {
      delete updates.DB_PASSWORD;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Нет данных для обновления' });
  }
  try {
    await updateEnv(configEnvPath, updates);
    res.json({ message: 'Параметры MS SQL обновлены' });
  } catch (e) {
    logger.error('Ошибка записи config.env:', e);
    res.status(500).json({ message: 'Ошибка записи config.env' });
  }
});
// Получить параметры MySQL
app.get('/api/settings/mysql', checkAuth, async (req, res) => {
  try {
    const env = await parseEnv(modersEnvPath);
    res.json({
      MYSQL_HOST: env.MYSQL_HOST || '',
      MYSQL_PORT: env.MYSQL_PORT || '',
      MYSQL_USER: env.MYSQL_USER || '',
      MYSQL_PASSWORD: env.MYSQL_PASSWORD || '',
      MYSQL_DATABASE: env.MYSQL_DATABASE || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения moders/config.env:', e);
    res.status(500).json({ message: 'Ошибка чтения moders/config.env' });
  }
});
// Обновить параметры MySQL
app.post('/api/settings/mysql', checkAuth, async (req, res) => {
    const updates = req.body;
    if (updates.MYSQL_PASSWORD === '') {
        delete updates.MYSQL_PASSWORD;
    }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Нет данных для обновления' });
  }
  try {
    await updateEnv(modersEnvPath, updates);
    res.json({ message: 'Параметры MySQL обновлены' });
  } catch (e) {
    logger.error('Ошибка записи moders/config.env:', e);
    res.status(500).json({ message: 'Ошибка записи moders/config.env' });
  }
});

// --- CORS SETTINGS API ---
// Получить ALLOWED_ORIGINS
app.get('/api/settings/cors', checkAuth, async (req, res) => {
  try {
    const env = await parseEnv(configEnvPath);
    const origins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    res.json({ ALLOWED_ORIGINS: origins });
  } catch (e) {
    logger.error('Ошибка чтения ALLOWED_ORIGINS:', e);
    res.status(500).json({ message: 'Ошибка чтения ALLOWED_ORIGINS' });
  }
});
// Обновить ALLOWED_ORIGINS
app.post('/api/settings/cors', checkAuth, async (req, res) => {
  const { ALLOWED_ORIGINS } = req.body;
  if (!Array.isArray(ALLOWED_ORIGINS) || !ALLOWED_ORIGINS.length) {
    return res.status(400).json({ message: 'Список ALLOWED_ORIGINS обязателен' });
  }
  try {
    await updateEnv(configEnvPath, { ALLOWED_ORIGINS: ALLOWED_ORIGINS.join(', ') });
    res.json({ message: 'ALLOWED_ORIGINS обновлён' });
  } catch (e) {
    logger.error('Ошибка записи ALLOWED_ORIGINS:', e);
    res.status(500).json({ message: 'Ошибка записи ALLOWED_ORIGINS' });
  }
});

// --- ADMIN-SERVER PARAMS API ---
// Получить PORT и ADMIN_URL
app.get('/api/settings/admin-server', checkAuth, async (req, res) => {
  try {
    const env = await parseEnv(configEnvPath);
    res.json({
      PORT: env.PORT || '',
      ADMIN_URL: env.ADMIN_URL || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения config.env (admin-server):', e);
    res.status(500).json({ message: 'Ошибка чтения config.env' });
  }
});
// Обновить PORT и ADMIN_URL
app.post('/api/settings/admin-server', checkAuth, async (req, res) => {
  const { PORT, ADMIN_URL } = req.body;
  if (!PORT || !ADMIN_URL) {
    return res.status(400).json({ message: 'PORT и ADMIN_URL обязательны' });
  }
  try {
    await updateEnv(configEnvPath, { PORT, ADMIN_URL });
    res.json({ message: 'Параметры admin-server обновлены' });
  } catch (e) {
    logger.error('Ошибка записи config.env (admin-server):', e);
    res.status(500).json({ message: 'Ошибка записи config.env' });
  }
});

// --- BACKEND SERVER PARAMS API ---
const backendConfigPath = path.join(__dirname, '../backend/config.json');
// Получить host/port backend
app.get('/api/settings/backend-server', checkAuth, async (req, res) => {
  try {
    const config = await fs.readJson(backendConfigPath);
    res.json({
      host: config.server?.host || '',
      port: config.server?.port || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения backend/config.json:', e);
    res.status(500).json({ message: 'Ошибка чтения backend/config.json' });
  }
});
// Обновить host/port backend
app.post('/api/settings/backend-server', checkAuth, async (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) {
    return res.status(400).json({ message: 'host и port обязательны' });
  }
  try {
    const config = await fs.readJson(backendConfigPath);
    config.server = config.server || {};
    config.server.host = host;
    config.server.port = port;
    await fs.writeJson(backendConfigPath, config, { spaces: 4 });
    res.json({ message: 'Параметры backend-server обновлены' });
  } catch (e) {
    logger.error('Ошибка записи backend/config.json:', e);
    res.status(500).json({ message: 'Ошибка записи backend/config.json' });
  }
});

// --- MODERATORS MANAGEMENT API ---
// Получить список модераторов
app.get('/api/settings/moders', checkAuth, async (req, res) => {
  try {
    const [rows] = await moderDb.query('SELECT id, username FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (e) {
    logger.error('Ошибка получения списка модераторов:', e);
    res.status(500).json({ message: 'Ошибка получения списка модераторов' });
  }
});
// Добавить модератора
app.post('/api/settings/moders', checkAuth, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username и password обязательны' });
  }
  try {
    const [exists] = await moderDb.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length) {
      return res.status(409).json({ message: 'Пользователь с таким username уже существует' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await moderDb.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    res.json({ id: result.insertId, username });
  } catch (e) {
    logger.error('Ошибка добавления модератора:', e);
    res.status(500).json({ message: 'Ошибка добавления модератора' });
  }
});
// Сменить пароль модератора
app.put('/api/settings/moders/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: 'password обязателен' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await moderDb.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Модератор не найден' });
    }
    res.json({ message: 'Пароль обновлён' });
  } catch (e) {
    logger.error('Ошибка смены пароля модератора:', e);
    res.status(500).json({ message: 'Ошибка смены пароля модератора' });
  }
});
// Удалить модератора
app.delete('/api/settings/moders/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await moderDb.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Модератор не найден' });
    }
    res.json({ message: 'Модератор удалён' });
  } catch (e) {
    logger.error('Ошибка удаления модератора:', e);
    res.status(500).json({ message: 'Ошибка удаления модератора' });
  }
});
app.get('/api/monitoring/logs', checkAuth, async (req, res) => {
  const logSources = [
      { name: 'Admin', path: ADMIN_LOG },
      { name: 'Backend', path: BACKEND_APP_LOG },
      { name: 'CardReader', path: CARD_LOG }
  ];

  let allEvents = [];

  for (const source of logSources) {
      try {
          if (!fs.existsSync(source.path)) continue;

          const content = await fs.readFile(source.path, 'utf-8');
          const lines = content.split(/\r?\n/);

          lines.forEach(line => {
              if (!line) return;
              // Пробуем распарсить JSON-строку из winston
              try {
                  const jsonLog = JSON.parse(line);
                  if (['warn', 'error'].includes(jsonLog.level?.toLowerCase())) {
                      allEvents.push({
                          timestamp: jsonLog.timestamp || new Date().toISOString(),
                          level: jsonLog.level.toUpperCase(),
                          source: source.name,
                          message: jsonLog.message
                      });
                  }
                  return;
              } catch (e) {
                  // Не JSON, пробуем парсить как обычный текст
              }
              const match = line.match(/\[([^\]]+)\] \[([^\]]+)\] (.*)/);
              if (match) {
                  const level = match[2].toLowerCase();
                  if (['warn', 'error'].includes(level)) {
                      allEvents.push({
                          timestamp: new Date(match[1]).toISOString(),
                          level: level.toUpperCase(),
                          source: source.name,
                          message: match[3]
                      });
                  }
              }
          });
      } catch (err) {
          console.error(`Error reading or parsing log file ${source.path}:`, err);
          allEvents.push({
              timestamp: new Date().toISOString(),
              level: 'ERROR',
              source: 'Monitoring',
              message: `Could not read log file: ${source.name}`
          });
      }
  }

  // Сортировка по дате, самые новые вверху
  allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json(allEvents);
});
server.listen(PORT, () => {
    logger.info(`Admin server running on ${ADMIN_URL}:${PORT}`);
    logger.info(`Card logs path: ${CARD_LOG_PATH}`);
    logger.info(`Test logs path: ${TEST_LOG_PATH}`);
});