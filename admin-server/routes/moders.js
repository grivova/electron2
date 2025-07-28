const express = require('express');
const router = express.Router();
const modersController = require('../controllers/modersController');
const checkAuth = require('../middleware/checkAuth');

router.get('/', checkAuth, modersController.getModers);
router.post('/', checkAuth, modersController.addModer);
router.put('/:id', checkAuth, modersController.changePassword);
router.delete('/:id', checkAuth, modersController.deleteModer);

module.exports = router;
