const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/check-db', healthController.checkDb);
router.get('/status', healthController.checkStatus);

module.exports = router;