const express = require('express');
const cors = require('cors');
const { connectDB, sql } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API работает' });
});

// Получение информации о сотруднике по ID
app.get('/api/employee/:id', async (req, res) => {
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
        res.status(500).json({ message: 'Ошибка сервера', error: err.message });
    }
});

// Подключение к БД и запуск сервера
async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

startServer(); 