const fs = require('fs-extra');
const path = require('path');
const logger = require('../logger');

const CARD_LOG_PATH = path.resolve(__dirname, '..', process.env.CARD_LOG_PATH);
const initCardLogs = async () => {
  try {
    await fs.ensureDir(path.dirname(CARD_LOG_PATH));
    if (!(await fs.pathExists(CARD_LOG_PATH))) {
      await fs.writeFile(CARD_LOG_PATH, '');
      logger.info(`Card log file created at: ${CARD_LOG_PATH}`);
    }
  } catch (err) {
    logger.error('Failed to initialize card logs:', err);
    throw err;
  }
};
initCardLogs().catch(err => {
  logger.error('Card logs initialization error:', err);
});

const cardEvent = (req, res) => {
    logger.info('[CARD EVENT] Received:', req.body);
    
    if (!req.body || !req.body.event) {
        logger.error('Invalid request body:', req.body);
        return res.status(400).json({ message: 'Missing required field: event' });
    }
    
    const { event, uid = 'N/A', timestamp = Date.now() } = req.body;
    const logLine = `[${new Date(timestamp).toISOString()}] [${event}] UID: ${uid}\n`;
    
    try {
        if (!fs.existsSync(CARD_LOG_PATH)) {
            initCardLogs();
        }
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
};
const getCardLogs = async (req, res) => { 
  try {
    if (!(await fs.pathExists(CARD_LOG_PATH))) {
      await initCardLogs();
      return res.status(200).type('text/plain').send('Card logs initialized');
    }
    const logs = await fs.readFile(CARD_LOG_PATH, 'utf-8');
    res.type('text/plain').send(logs);
  } catch (err) {
    logger.error('Error reading card logs:', err);
    res.status(500).json({ 
      error: err.message,
      path: CARD_LOG_PATH
    });
  }
};
module.exports = {
    cardEvent,
    getCardLogs,
    initCardLogs
};
