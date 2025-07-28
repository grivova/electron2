const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const checkAuth = require('../middleware/checkAuth');

router.get('/logs', checkAuth, logsController.getMonitoringLogs);

module.exports = router;