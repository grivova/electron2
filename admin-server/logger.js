const fs = require('fs');
const path = require('path');
const LOGS_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'admin.log');
const MAX_SIZE = 20 * 1024 * 1024; 

if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function rotateLogIfNeeded() {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const stats = fs.statSync(LOG_FILE);
            if (stats.size >= MAX_SIZE) {
                const date = new Date().toISOString().replace(/[:.]/g, '-');
                const archiveName = `admin-${date}.log`;
                const archivePath = path.join(LOGS_DIR, archiveName);
                fs.renameSync(LOG_FILE, archivePath);
            }
        }
    } catch (err) {
        console.error('[LOGGER] Ошибка ротации лога:', err);
    }
}

function format(level, message) {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
}

function log(level, ...args) {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const line = format(level, msg);
    rotateLogIfNeeded();
    try {
        fs.appendFileSync(LOG_FILE, line);
    } catch (err) {
        console.error('[LOGGER] Ошибка записи в лог:', err);
    }
    if (level === 'error') {
        console.error(line.trim());
    } else if (level === 'warn') {
        console.warn(line.trim());
    } else {
        console.log(line.trim());
    }
}

module.exports = {
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
}; 