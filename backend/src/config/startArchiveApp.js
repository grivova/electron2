const { archiveLog } = require('./logger');
try {
  archiveLog();
  console.log('Архивация запущена');
} catch (err) {
  console.error('Ошибка архивации:', err.message);
}