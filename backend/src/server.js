const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { connectDB, sql } = require('./config/db');
const logger = require('./config/logger');
const handbookRoutes = require('./routes/handbook');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/handbook', handbookRoutes);
// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API работает' });
});

// Получение информации о сотруднике по ID
app.get('/api/employee/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sql.query`
            SELECT 
                id,
                causeObject,
                tnom,
                famaly,
                ima,
                otch,
                category,
                organization,
                identNumber
            FROM dbo.mk570
            WHERE id = ${id}
        `;

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Сотрудник не найден' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        logger.error('Error in /api/employee/:id', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Ошибка сервера', error: err.message });
    }
});

// Эндпоинт для получения расчетного листка
app.get('/api/payslip/:fileName', async (req, res) => {
    try {
        const { fileName } = req.params;
        const configPath = path.join(__dirname, '../config.json');
        const config = await fs.readJson(configPath);
        const payslipBasePath = config.payslipsPath;

        let finalPayslipPath;

        // Если путь в конфиге не абсолютный, считаем его от корня проекта
        if (path.isAbsolute(payslipBasePath)) {
            finalPayslipPath = path.join(payslipBasePath, fileName);
        } else {
            // Корень проекта - это ../../ от текущего файла (src/server.js)
            const projectRoot = path.resolve(__dirname, '../../');
            finalPayslipPath = path.join(projectRoot, payslipBasePath, fileName);
        }
        
        logger.info(`Attempting to find payslip at resolved path: ${finalPayslipPath}`);

        // Проверка на существование файла
        if (await fs.pathExists(finalPayslipPath)) {
            res.sendFile(finalPayslipPath);
        } else {
            logger.warn(`Payslip not found: ${finalPayslipPath}`);
            res.status(404).json({ message: 'Расчетный листок не найден' });
        }
    } catch (err) {
        logger.error('Error getting payslip', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Эндпоинт для проверки статуса БД
app.get('/api/db-status', async (req, res) => {
    try {
        await sql.query`SELECT 1`;
        res.status(200).json({ status: 'ok', message: 'Database connection successful' });
    } catch (err) {
        logger.error('Database connection check failed', { error: err.message, stack: err.stack });
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});

// Подключение к БД и запуск сервера
async function startServer() {
    try {
        // Загружаем конфиг в самом начале
        const configPath = path.join(__dirname, '../config.json');
        const config = await fs.readJson(configPath);
        const { host, port } = config.server;

        await connectDB();
        app.listen(port, host, () => {
            logger.info(`Server is running on http://${host}:${port}`);
        });
    } catch (err) {
        // Используем logger, если он уже инициализирован
        if (logger) {
            logger.error('Failed to start server:', { error: err.message, stack: err.stack });
        } else {
            console.error('Failed to start server:', err);
        }
    }
}

startServer(); 