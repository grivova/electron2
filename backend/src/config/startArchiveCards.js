const { archiveLog } = require('./logger_cards');

try {
  archiveLog();
  console.log('Архивация запущена');
} catch (err) {
  console.error('Ошибка архивации:', err.message);
}