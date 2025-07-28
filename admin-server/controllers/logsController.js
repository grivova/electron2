const fs = require('fs-extra');
const path = require('path');
const logger = require('../logger');

const ADMIN_LOG = path.resolve(__dirname, '..', process.env.ADMIN_LOG);
const BACKEND_APP_LOG = path.resolve(__dirname, '..', process.env.BACKEND_APP_LOG);
const CARD_LOG = path.resolve(__dirname, '..', process.env.CARD_LOG);

const getLogs = async (req, res) => {
    try {
        const logPath = path.join(__dirname, '..', '../backend/logs/app.log');
        const logs = await fs.readFile(logPath, 'utf-8');
        res.type('text/plain');
        res.send(logs);
    } catch (error) {
        logger.error('Error reading log file:', error);
        res.status(500).send('Could not read log file.');
    }
};

const clearLogs = async (req, res) => {
    try {
        const logPath = path.join(__dirname, '..', '../backend/logs/app.log');
        await fs.truncate(logPath, 0);
        res.status(200).json({ message: 'Logs cleared successfully' });
    } catch (error) {
        logger.error('Error clearing log file:', error);
        res.status(500).send('Could not clear log file.');
    }
};

const getMonitoringLogs = async (req, res) => {
    const logSources = [
        { name: 'Admin', path: ADMIN_LOG },
        { name: 'Backend', path: BACKEND_APP_LOG },
        { name: 'CardReader', path: CARD_LOG }
    ];

    let allEvents = [];

    for (const source of logSources) {
        try {
            if (!(await fs.pathExists(source.path))) {
                logger.warn(`Log file not found: ${source.path}`);
                continue;
            }

            const content = await fs.readFile(source.path, 'utf-8');
            const lines = content.split(/\r?\n/);

            lines.forEach(line => {
                if (!line) return;
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

    allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(allEvents);
};

module.exports = {
    getLogs,
    clearLogs,
    getMonitoringLogs
};
