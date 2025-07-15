const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { connectDB, sql } = require('./config/db');
const { logger } = require('./config/logger');
const handbookRoutes = require('./routes/handbook');
const employeeRoutes = require('./routes/employee');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });
async function connectToNetworkShare(config) {
    if (config.networkCredentials && config.networkCredentials.username) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            const payslipsPath = config.payslipsPath;
            const username = config.networkCredentials.username;
            const password = config.networkCredentials.password;
            const domain = config.networkCredentials.domain;
            const netUseCommand = `net use \\${payslipsPath} ${password} /user:${domain ? domain + '\\' : ''}${username}`;
            
            logger.info(`Attempting to connect to network share with credentials`);
            const { stdout, stderr } = await execAsync(netUseCommand);
            
            if (stderr) {
                logger.warn(`Network share connection warning: ${stderr}`);
            }
            
            logger.info(`Network share connection result: ${stdout}`);
            return true;
        } catch (error) {
            logger.error('Failed to connect to network share', { error: error.message });
            return false;
        }
    }
    return true; 
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/handbook', handbookRoutes);
app.use('/api/employee', employeeRoutes);
app.get('/api/test', (req, res) => {
    res.json({ message: 'API работает' });
});

app.get('/api/test-network', async (req, res) => {
    try {
        const configPath = path.join(__dirname, '../config.json');
        const config = await fs.readJson(configPath);
        const payslipBasePath = config.payslipsPath;

        logger.info(`Testing network connection to: ${payslipBasePath}`);

        const networkConnected = await connectToNetworkShare(config);
        logger.info(`Network share connection successful: ${networkConnected}`);

        const testResults = {
            basePath: payslipBasePath,
            basePathExists: false,
            basePathAccessible: false,
            basePathContents: [],
            networkConnected: networkConnected,
            error: null
        };

        try {
            testResults.basePathExists = await fs.pathExists(payslipBasePath);
            logger.info(`Base path exists: ${testResults.basePathExists}`);

            if (testResults.basePathExists) {
                const stats = await fs.stat(payslipBasePath);
                testResults.basePathAccessible = stats.isDirectory();
                logger.info(`Base path is directory: ${testResults.basePathAccessible}`);

                if (testResults.basePathAccessible) {
                    testResults.basePathContents = await fs.readdir(payslipBasePath);
                    logger.info(`Base path contents: ${JSON.stringify(testResults.basePathContents)}`);
                }
            }
        } catch (error) {
            testResults.error = error.message;
            logger.error('Network test error', { error: error.message, stack: error.stack });
        }

        res.json(testResults);
    } catch (err) {
        logger.error('Error in network test', { error: err.message, stack: err.stack });
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/payslip/:period/:fileName', async (req, res) => {
    try {
        const { period, fileName } = req.params;
        const configPath = path.join(__dirname, '../config.json');
        const config = await fs.readJson(configPath);
        const payslipBasePath = config.payslipsPath;

        logger.info(`Payslip request - Period: ${period}, File: ${fileName}`);
        logger.info(`Base path from config: ${payslipBasePath}`);

        const networkConnected = await connectToNetworkShare(config);
        logger.info(`Network share connection for payslip: ${networkConnected}`);

        let finalPayslipPath;
        if (path.isAbsolute(payslipBasePath)) {
            finalPayslipPath = path.join(payslipBasePath, period, fileName);
        } else {
            const projectRoot = path.resolve(__dirname, '../../');
            finalPayslipPath = path.join(projectRoot, payslipBasePath, period, fileName);
        }
        
        logger.info(`Final payslip path: ${finalPayslipPath}`);

        try {
            const basePathExists = await fs.pathExists(payslipBasePath);
            logger.info(`Base path exists: ${basePathExists}`);
            
            if (basePathExists) {
                const basePathStats = await fs.stat(payslipBasePath);
                logger.info(`Base path stats: ${JSON.stringify({
                    isDirectory: basePathStats.isDirectory(),
                    permissions: basePathStats.mode,
                    size: basePathStats.size
                })}`);

                const basePathContents = await fs.readdir(payslipBasePath);
                logger.info(`Base path contents: ${JSON.stringify(basePathContents)}`);

                const periodPath = path.join(payslipBasePath, period);
                const periodPathExists = await fs.pathExists(periodPath);
                logger.info(`Period path exists: ${periodPathExists} (${periodPath})`);
                
                if (periodPathExists) {
                    const periodPathContents = await fs.readdir(periodPath);
                    logger.info(`Period path contents: ${JSON.stringify(periodPathContents)}`);
                }
            }
        } catch (basePathError) {
            logger.error('Error checking base path', { 
                error: basePathError.message, 
                stack: basePathError.stack 
            });
        }

        if (await fs.pathExists(finalPayslipPath)) {
            logger.info(`Payslip found, sending file: ${finalPayslipPath}`);
            res.sendFile(finalPayslipPath);
        } else {
            logger.warn(`Payslip not found: ${finalPayslipPath}`);
            res.status(404).json({ 
                message: 'Расчетный листок не найден',
                path: finalPayslipPath,
                period: period,
                fileName: fileName,
                basePath: payslipBasePath,
                networkConnected: networkConnected
            });
        }
    } catch (err) {
        logger.error('Error getting payslip', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.get('/api/payslip/:fileName', async (req, res) => {
    try {
        const { fileName } = req.params;
        const configPath = path.join(__dirname, '../config.json');
        const config = await fs.readJson(configPath);
        const payslipBasePath = config.payslipsPath;

        let finalPayslipPath;
        if (path.isAbsolute(payslipBasePath)) {
            finalPayslipPath = path.join(payslipBasePath, fileName);
        } else {
            const projectRoot = path.resolve(__dirname, '../../');
            finalPayslipPath = path.join(projectRoot, payslipBasePath, fileName);
        }
        
        logger.info(`Attempting to find payslip at resolved path: ${finalPayslipPath}`);

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

app.get('/api/db-status', async (req, res) => {
    try {
        await sql.query`SELECT 1`;
        res.status(200).json({ status: 'ok', message: 'DB connection successful' });
    } catch (err) {
        logger.error('Database connection check failed', { error: err.message, stack: err.stack });
        res.status(500).json({ status: 'error', message: 'DB connection failed' });
    }
});

async function startServer() {
    try {
        const configPath = path.join(__dirname, '../config.json');
        const config = await fs.readJson(configPath);
        const { host, port } = config.server;

        await connectDB();
        app.listen(port, host, () => {
            logger.info(`Server is running on http://${host}:${port}`);
        });
    } catch (err) {
        if (logger) {
            logger.error('Failed to start server:', { error: err.message, stack: err.stack });
        } else {
        logger.error('Failed to start server:', err);
        }
    }
}

startServer(); 