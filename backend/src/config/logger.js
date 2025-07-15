const winston = require('winston');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const cron = require('node-cron');

const logDir = path.join(__dirname, '../../logs/');
const logFile = path.join(logDir, 'app.log');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'HH:mm:ss YYYY-MM-DD '
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ 
      filename: logFile,
      maxsize: 10 * 1024 * 1024, // 5MB
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const archiveLog = () => {
  if (!fs.existsSync(logFile)) return;

  const archiveName = `app-${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.log.gz`;
  const archivePath = path.join(logDir, archiveName);

  fs.createReadStream(logFile)
    .pipe(zlib.createGzip())
    .pipe(fs.createWriteStream(archivePath))
    .on('finish', () => {
      fs.writeFileSync(logFile, '');
      logger.info(`Логи архивированы в ${archiveName}`);
    })
    .on('error', (err) => {
      logger.error('Ошибка архивации:', err);
    });
};

cron.schedule('* * 1 * *', archiveLog);

module.exports = {
  logger,
  archiveLog
}