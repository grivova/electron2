const express = require('express');
const router = express.Router();
const { sql } = require('../config/db');
const { logger } = require('../config/logger_cards');

// Поиск по номеру карты
router.get('/card/:cardNumber', async (req, res) => {
    try {
        const { cardNumber } = req.params;
        logger.info(`[SEARCH] Поиск сотрудника по номеру карты: ${cardNumber}`);
        
        const query = await sql.query`
            SELECT 
                mk570.id,
                mk570.cardNumber,
                mk570.tnom,
                mk501.famaly,
                mk501.ima,
                mk501.otch,
                mk503.nameprof AS profession,
                my501.pm AS category,
                my401.name AS departmentName,
                mk503.cex AS departmentCode,
                mk570.organization,
                mk570.identNumber
            FROM [ASU].[dbo].[mk570]
            JOIN [ASU].[dbo].[mk501] ON mk570.tnom = mk501.tnom
            LEFT JOIN [ASU].[dbo].[mk503] ON mk501.kod_sht = mk503.kod_sht AND mk501.tnom = mk503.tnom
            LEFT JOIN [ASU].[dbo].[my501] ON mk503.id_my501 = my501.id
            LEFT JOIN [ASU].[dbo].[my401] ON mk501.cex = my401.cex
            WHERE mk570.cardNumber = ${cardNumber}`;
        
        if (query.recordset.length === 0) {
            logger.warn(`[SEARCH] Сотрудник с номером карты ${cardNumber} не найден`);
            return res.status(404).json({ message: 'Сотрудник не найден' });
        }
        
        const result = query.recordset[0];
        logger.info(`[SEARCH] Найден сотрудник с номером карты ${cardNumber} : ${result.famaly} ${result.ima} ${result.otch} (Id: ${result.id}, tnom: ${result.tnom})`);
        res.json({
            ...result,
            category: result.category || null,
            departmentName: result.departmentName || null,
            departmentCode: result.departmentCode || null
        });
        
    } catch (err) {
        logger.error('[SQL ERROR]', err);
        res.status(500).json({ 
            message: 'Ошибка сервера',
            error: err.message
        });
    }
});

// Поиск по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        logger.info(`[SEARCH] Поиск сотрудника по id: ${id}`);
        
        const query = await sql.query`
            SELECT 
                mk570.id,
                mk570.cardNumber,
                mk570.tnom,
                mk501.famaly,
                mk501.ima,
                mk501.otch,
                mk503.nameprof AS profession,
                my501.pm AS category,
                my401.name AS departmentName,
                mk503.cex AS departmentCode,
                mk570.organization,
                mk570.identNumber
            FROM [ASU].[dbo].[mk570]
            JOIN [ASU].[dbo].[mk501] ON mk570.tnom = mk501.tnom
            LEFT JOIN [ASU].[dbo].[mk503] ON mk501.kod_sht = mk503.kod_sht AND mk501.tnom = mk503.tnom
            LEFT JOIN [ASU].[dbo].[my501] ON mk503.id_my501 = my501.id
            LEFT JOIN [ASU].[dbo].[my401] ON mk501.cex = my401.cex
            WHERE mk570.id = ${id}`;
        
        if (query.recordset.length === 0) {
            logger.warn(`Сотрудник с ID ${id} не найден`);
            return res.status(404).json({ message: 'Сотрудник не найден' });
        }
        
        const result = query.recordset[0];
        logger.info(`Найден сотрудник по id: ${result.famaly} ${result.ima} ${result.otch} (Id: ${result.id}, tnom: ${result.tnom})`);
        res.json({
            ...result,
            category: result.category || null,
            departmentName: result.departmentName || null,
            departmentCode: result.departmentCode || null
        });
        
    } catch (err) {
        logger.error('[SQL ERROR]', err);
        res.status(500).json({ 
            message: 'Ошибка сервера',
            error: err.message
        });
    }
});

module.exports = router;