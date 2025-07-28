const logger = require('../logger')
module.exports = (err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  logger.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
};