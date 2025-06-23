const express = require('express');
const router = express.Router();
const { sql } = require('../config/db');

// Получение информации о сотруднике по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sql.query`
            SELECT 
                id,
                causeObject,
                tnom,
                famaly,
                ima,
                otch,
                category,
                organization,
                identNumber
            FROM dbo.mk570
            WHERE id = ${id}
        `;

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Сотрудник не найден' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router; 