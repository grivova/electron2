const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const csurf = require('csurf');

const csrfProtection = csurf({ cookie: false });

router.post('/', authController.login);

module.exports = router;