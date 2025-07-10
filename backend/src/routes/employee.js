const express = require('express');
const router = express.Router();
const { sql } = require('../config/db');

// Поиск по карте (cardNumber) — должен идти первым!
router.get('/card/:cardNumber', async (req, res) => {
    try {
        const { cardNumber } = req.params;
        console.log(`[DEBUG] Searching card: ${cardNumber}`);
        const result = await sql.query`
            SELECT * FROM [ASU].[dbo].[mk570]
            WHERE cardNumber = ${cardNumber}`;
        console.log(`[DEBUG] Found ${result.recordset.length} rows`);
        if (result.recordset.length === 0) {
            return res.status(404).json({ 
                message: 'Сотрудник не найден',
                query: `SELECT * FROM mk570 WHERE cardNumber = '${cardNumber}'`
            });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('[SQL ERROR]', err);
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
        console.log(`[DEBUG] Searching id: ${id}`);
        const result = await sql.query`
            SELECT id, causeObject, tnom, famaly, ima, otch, category, organization, identNumber
            FROM [ASU].[dbo].[mk570]
            WHERE id = ${id}`;
        console.log(`[DEBUG] Found ${result.recordset.length} rows`);
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Сотрудник не найден' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('[SQL Error]', err);
        res.status(500).json({ 
            message: 'Ошибка сервера',
            error: err.message
        });
    }
});

module.exports = router; 