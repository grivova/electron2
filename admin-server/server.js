const fs = require('fs-extra');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
require('dotenv').config({ path: path.join(__dirname, './config.env') });
require('dotenv').config({ path: __dirname + '/moders/config.env' });
const logger  = require('./logger');
const moderAuthRouter = require('./moders/routes/moderAuth');
const moderContentRouter = require('./moders/routes/content');
const authRouter = require('./routes/auth');
const cardRouter = require('./routes/card');
const logsRouter = require('./routes/logs');
const settingsRouter = require('./routes/settings');
const modersRouter = require('./routes/moders');
const healthRouter = require('./routes/health');
const monitoringRouter = require('./routes/monitoring');
const setupWebSocket = require('./services/websocket');
const cardController = require('./controllers/cardController');
const app = express();
const server = require('http').createServer(app);

// Конфигурации
const corsConfig = require('./config/cors');
const sessionConfig = require('./config/session');

// Middleware
app.use(cors(corsConfig));
app.use(morgan('dev'));
app.use(express.json());
app.use(session(sessionConfig(session)));
// Роуты, которые не требуют CSRF
app.use('/api/auth', authRouter);
app.use(require('./middleware/csrf'));
// Статические файлы
app.use('/login.html', express.static(path.join(__dirname, 'public', 'login.html')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(__dirname + '/uploads'));

// Роуты
app.use('/api/card', cardRouter);
app.use('/api/logs', logsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/moders', modersRouter);
app.use('/api/health', healthRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/moders', moderAuthRouter);
app.use('/moders/content', moderContentRouter);
// Initialize card logs
(async () => {
  try {
    await cardController.initCardLogs();
    logger.info('Card logs initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize card logs:', err);
  }
})();

// WebSocket
setupWebSocket(server);

// Обработчик ошибок (должен быть последним!)
app.use(require('./middleware/errorHandler'));
app.get('/api/status', async (req, res) => {
    try {
        res.json({ status: 'online' }); // или другая логика проверки
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/config', async (req, res) => {
    try {
        const backendConfigPath = path.join(__dirname, '../backend/config.json');
        const backendConfig = await fs.readJson(backendConfigPath);
        const config = {
            payslipsPath: backendConfig.payslipsPath 
        };
        res.json(config);
    } catch (err) {
        logger.error('Ошибка чтения backend/config.json:', err);
        res.status(500).json({ error: 'Ошибка загрузки конфигурации' });
    }
});
// Добавьте рядом с существующим GET обработчиком
app.post('/api/config', async (req, res) => {
    try {
        const backendConfigPath = path.join(__dirname, '../backend/config.json');
        const currentConfig = await fs.readJson(backendConfigPath);
        
        // Обновляем только разрешенные поля
        if (req.body.payslipsPath) {
            currentConfig.payslipsPath = req.body.payslipsPath;
        }

        // Сохраняем обновленный конфиг
        await fs.writeJson(backendConfigPath, currentConfig, { spaces: 4 });
        
        res.json({ 
            success: true,
            message: 'Конфигурация успешно обновлена'
        });
    } catch (err) {
        logger.error('Ошибка сохранения конфигурации:', err);
        res.status(500).json({ 
            error: 'Ошибка сохранения конфигурации',
            details: err.message 
        });
    }
});
server.listen(process.env.PORT || 3005, () => {
  logger.info(`Server running on ${process.env.ADMIN_URL}`);
});