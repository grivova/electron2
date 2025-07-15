const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const { logger } = require('../config/logger');
require('dotenv').config({ path: path.join(__dirname, '../../config.env') });
router.get('/test', (req, res) => {
    res.send('Handbook test route works!');
});
router.get('/html', async (req, res) => {
    const docxPath = path.join(__dirname, process.env.DOCX_PATH);
    logger.info('Checking document', { 
        path: docxPath,
        exists: fs.existsSync(docxPath) 
    });
    
    if (!fs.existsSync(docxPath)) {
        logger.error('Document not found', { path: docxPath });
        return res.status(404).send('Документ не найден');
    }
    
    try {
        const result = await mammoth.convertToHtml({ path: docxPath });
        logger.info('Document converted successfully', { path: docxPath });
        res.send(result.value); 
    } catch (err) {
        logger.error('Conversion failed', { 
            path: docxPath,
            error: err.message,
            stack: err.stack 
        });
        res.status(500).send('Ошибка при конвертации документа');
    }
});

module.exports = router; 