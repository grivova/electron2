const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();
const logger = require('../../logger');
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');

const csrfProtection = csurf({ cookie: false });

const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 минут
  max: 10,
  message: { message: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

router.post('/moder-login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  logger.info(`[LOGIN] Попытка входа: ${username}`);
  try {
    logger.info('[LOGIN] Проверка подключения к базе...');
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    logger.info(`[LOGIN] Результат поиска пользователя: ${rows.length > 0 ? 'найден' : 'не найден'}`);
    if (!rows.length) {
      logger.warn(`[LOGIN] Пользователь не найден: ${username}`);
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }
    const user = rows[0];
    if (!user.password_hash) {
      logger.error('[LOGIN] Отсутствует password_hash в БД');
      return res.status(500).json({ message: 'Ошибка сервера: некорректные данные пользователя' });
    }
    logger.info('[LOGIN] Сравнение пароля через bcrypt...');
    const match = await bcrypt.compare(password, user.password_hash);
    logger.info(`[LOGIN] Результат сравнения пароля: ${match}`);
    if (!match) {
      logger.warn(`[LOGIN] Неверный пароль для пользователя: ${username}`);
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }
    try {
      req.session.isModerator = true;
      req.session.userId = user.id;
      req.session.username = user.username;
      logger.info('[LOGIN] Сессия установлена:', {
        isModerator: req.session.isModerator,
        userId: req.session.userId,
        username: req.session.username
      });
      res.json({ message: 'OK' });
      logger.info('[LOGIN] Ответ отправлен');
    } catch (e) {
      logger.error('[LOGIN] Ошибка при установке сессии или отправке ответа:', e);
      res.status(500).json({ message: 'Ошибка сервера (сессия)' });
    }
  } catch (err) {
    logger.error('[LOGIN] Ошибка авторизации:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

router.get('/moder-logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'OK' });
  });
});

router.get('/check-session', (req, res) => {
  if (req.session && req.session.isModerator) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

module.exports = router; 