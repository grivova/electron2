const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const logger = require('../config/logger');

router.get('/test', (req, res) => {
    res.send('Handbook test route works!');
});
router.get('/html', async (req, res) => {
    const docxPath = path.join(__dirname, '../../../frontend/public/handbook.docx');
    logger.info('Sea:', docxPath, fs.existsSync(docxPath));
    if (!fs.existsSync(docxPath)) {
        return res.status(404).send('Документ не найден');
    }
    try {
        const result = await mammoth.convertToHtml({ path: docxPath });
        res.send(result.value); 
    } catch (err) {
        res.status(500).send('Ошибка при конвертации документа');
    }
});

module.exports = router; 