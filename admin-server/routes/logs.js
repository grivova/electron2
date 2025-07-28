const express = require('express');
const router = express.Router(); // Сначала инициализируем router
const logsController = require('../controllers/logsController');
const checkAuth = require('../middleware/checkAuth');
console.log('Imported router:', router.toString());

router.get('/', checkAuth, logsController.getLogs);
router.post('/clear', checkAuth, logsController.clearLogs);

module.exports = router;