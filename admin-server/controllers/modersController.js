const moderDb = require('../moders/db');
const bcrypt = require('bcrypt');
const logger = require('../logger');

const getModers = async (req, res) => {
  try {
    const [rows] = await moderDb.query('SELECT id, username FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (e) {
    logger.error('Ошибка получения списка модераторов:', e);
    res.status(500).json({ message: 'Ошибка получения списка модераторов' });
  }
};

const addModer = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username и password обязательны' });
  }
  try {
    const [exists] = await moderDb.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length) {
      return res.status(409).json({ message: 'Пользователь с таким username уже существует' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await moderDb.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    res.json({ id: result.insertId, username });
  } catch (e) {
    logger.error('Ошибка добавления модератора:', e);
    res.status(500).json({ message: 'Ошибка добавления модератора' });
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: 'password обязателен' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await moderDb.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Модератор не найден' });
    }
    res.json({ message: 'Пароль обновлён' });
  } catch (e) {
    logger.error('Ошибка смены пароля модератора:', e);
    res.status(500).json({ message: 'Ошибка смены пароля модератора' });
  }
};

const deleteModer = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await moderDb.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Модератор не найден' });
    }
    res.json({ message: 'Модератор удалён' });
  } catch (e) {
    logger.error('Ошибка удаления модератора:', e);
    res.status(500).json({ message: 'Ошибка удаления модератора' });
  }
};

module.exports = {
  getModers,
  addModer,
  changePassword,
  deleteModer
};
