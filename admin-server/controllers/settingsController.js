const fs = require('fs-extra');
const path = require('path');
const logger = require('../logger');

const configEnvPath = path.join(__dirname, '..', 'config.env');
const modersEnvPath = path.join(__dirname, '..', 'moders', 'config.env');
const backendConfigPath = path.join(__dirname, '..', '../backend/config.json');

const parseEnv = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
};

const updateEnv = async (filePath, updates) => {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const keys = Object.keys(updates);
  const updated = new Set();
  const newLines = lines.map(line => {
    if (!line.trim() || line.trim().startsWith('#') || !line.includes('=')) return line;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    if (keys.includes(key)) {
      updated.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  for (const key of keys) {
    if (!updated.has(key)) {
      newLines.push(`${key}=${updates[key]}`);
    }
  }
  await fs.writeFile(filePath, newLines.join('\n'), 'utf-8');
};

const getMssqlSettings = async (req, res) => {
  try {
    const env = await parseEnv(configEnvPath);
    res.json({
      DB_USER: env.DB_USER || '',
      DB_PASSWORD: env.DB_PASSWORD || '',
      DB_SERVER: env.DB_SERVER || '',
      DB_NAME: env.DB_NAME || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения config.env:', e);
    res.status(500).json({ message: 'Ошибка чтения config.env' });
  }
};

const updateMssqlSettings = async (req, res) => {
  const updates = req.body;
  if (updates.DB_PASSWORD === '') {
    delete updates.DB_PASSWORD;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Нет данных для обновления' });
  }
  try {
    await updateEnv(configEnvPath, updates);
    res.json({ message: 'Параметры MS SQL обновлены' });
  } catch (e) {
    logger.error('Ошибка записи config.env:', e);
    res.status(500).json({ message: 'Ошибка записи config.env' });
  }
};

const getMysqlSettings = async (req, res) => {
  try {
    const env = await parseEnv(modersEnvPath);
    res.json({
      MYSQL_HOST: env.MYSQL_HOST || '',
      MYSQL_PORT: env.MYSQL_PORT || '',
      MYSQL_USER: env.MYSQL_USER || '',
      MYSQL_PASSWORD: env.MYSQL_PASSWORD || '',
      MYSQL_DATABASE: env.MYSQL_DATABASE || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения moders/config.env:', e);
    res.status(500).json({ message: 'Ошибка чтения moders/config.env' });
  }
};

const updateMysqlSettings = async (req, res) => {
  const updates = req.body;
  if (updates.MYSQL_PASSWORD === '') {
    delete updates.MYSQL_PASSWORD;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Нет данных для обновления' });
  }
  try {
    await updateEnv(modersEnvPath, updates);
    res.json({ message: 'Параметры MySQL обновлены' });
  } catch (e) {
    logger.error('Ошибка записи moders/config.env:', e);
    res.status(500).json({ message: 'Ошибка записи moders/config.env' });
  }
};

const getCorsSettings = async (req, res) => {
  try {
    const env = await parseEnv(configEnvPath);
    const origins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    res.json({ ALLOWED_ORIGINS: origins });
  } catch (e) {
    logger.error('Ошибка чтения ALLOWED_ORIGINS:', e);
    res.status(500).json({ message: 'Ошибка чтения ALLOWED_ORIGINS' });
  }
};

const updateCorsSettings = async (req, res) => {
  const { ALLOWED_ORIGINS } = req.body;
  if (!Array.isArray(ALLOWED_ORIGINS) || !ALLOWED_ORIGINS.length) {
    return res.status(400).json({ message: 'Список ALLOWED_ORIGINS обязателен' });
  }
  try {
    await updateEnv(configEnvPath, { ALLOWED_ORIGINS: ALLOWED_ORIGINS.join(', ') });
    res.json({ message: 'ALLOWED_ORIGINS обновлён' });
  } catch (e) {
    logger.error('Ошибка записи ALLOWED_ORIGINS:', e);
    res.status(500).json({ message: 'Ошибка записи ALLOWED_ORIGINS' });
  }
};

const getAdminServerSettings = async (req, res) => {
  try {
    const env = await parseEnv(configEnvPath);
    res.json({
      PORT: env.PORT || '',
      ADMIN_URL: env.ADMIN_URL || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения config.env (admin-server):', e);
    res.status(500).json({ message: 'Ошибка чтения config.env' });
  }
};

const updateAdminServerSettings = async (req, res) => {
  const { PORT, ADMIN_URL } = req.body;
  if (!PORT || !ADMIN_URL) {
    return res.status(400).json({ message: 'PORT и ADMIN_URL обязательны' });
  }
  try {
    await updateEnv(configEnvPath, { PORT, ADMIN_URL });
    res.json({ message: 'Параметры admin-server обновлены' });
  } catch (e) {
    logger.error('Ошибка записи config.env (admin-server):', e);
    res.status(500).json({ message: 'Ошибка записи config.env' });
  }
};

const getBackendServerSettings = async (req, res) => {
  try {
    const config = await fs.readJson(backendConfigPath);
    res.json({
      host: config.server?.host || '',
      port: config.server?.port || ''
    });
  } catch (e) {
    logger.error('Ошибка чтения backend/config.json:', e);
    res.status(500).json({ message: 'Ошибка чтения backend/config.json' });
  }
};

const updateBackendServerSettings = async (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) {
    return res.status(400).json({ message: 'host и port обязательны' });
  }
  try {
    const config = await fs.readJson(backendConfigPath);
    config.server = config.server || {};
    config.server.host = host;
    config.server.port = port;
    await fs.writeJson(backendConfigPath, config, { spaces: 4 });
    res.json({ message: 'Параметры backend-server обновлены' });
  } catch (e) {
    logger.error('Ошибка записи backend/config.json:', e);
    res.status(500).json({ message: 'Ошибка записи backend/config.json' });
  }
};

module.exports = {
  getMssqlSettings,
  updateMssqlSettings,
  getMysqlSettings,
  updateMysqlSettings,
  getCorsSettings,
  updateCorsSettings,
  getAdminServerSettings,
  updateAdminServerSettings,
  getBackendServerSettings,
  updateBackendServerSettings
};
