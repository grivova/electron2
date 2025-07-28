const logger = require('../logger');
const bcrypt = require('bcrypt');
const moderDb = require('../moders/db');
require('dotenv').config({ path: __dirname + './config.env' });
exports.login = (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        logger.info('Login successful');
        res.status(200).send('Login successful');
    } else {
        res.status(401).send('Invalid password');
        logger.warn('Неверный пароль');
    }
};

exports.getCsrfToken = (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
};

exports.moderLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await moderDb.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Неверные учетные данные' });
        }
        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ message: 'Неверные учетные данные' });
        }
        req.session.moderId = user.id;
        req.session.moderName = user.username;
        res.json({ message: 'Успешный вход', username: user.username });
    } catch (error) {
        logger.error('Ошибка входа модератора:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};