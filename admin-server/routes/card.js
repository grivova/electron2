const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');

router.post('/card-event', cardController.cardEvent);
router.get('/card-logs', cardController.getCardLogs);

module.exports = router;
