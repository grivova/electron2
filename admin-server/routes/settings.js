const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const checkAuth = require('../middleware/checkAuth');

router.get('/mssql', checkAuth, settingsController.getMssqlSettings);
router.post('/mssql', checkAuth, settingsController.updateMssqlSettings);

router.get('/mysql', checkAuth, settingsController.getMysqlSettings);
router.post('/mysql', checkAuth, settingsController.updateMysqlSettings);

router.get('/cors', checkAuth, settingsController.getCorsSettings);
router.post('/cors', checkAuth, settingsController.updateCorsSettings);

router.get('/admin-server', checkAuth, settingsController.getAdminServerSettings);
router.post('/admin-server', checkAuth, settingsController.updateAdminServerSettings);

router.get('/backend-server', checkAuth, settingsController.getBackendServerSettings);
router.post('/backend-server', checkAuth, settingsController.updateBackendServerSettings);

module.exports = router;
