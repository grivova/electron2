const express = require('express');
const db = require('../db');
const requireModerator = require('../middleware/requireModerator');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  }
});
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png',
  'video/mp4', 'video/quicktime'
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  }
});

// Получить все блоки для вкладки
router.get('/:tab', async (req, res) => {
  const { tab } = req.params;
  if (!['info', 'union'].includes(tab)) return res.status(400).json({ message: 'Некорректная вкладка' });
  try {
    const [rows] = await db.query('SELECT * FROM content_blocks WHERE tab = ? ORDER BY created_at ASC', [tab]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Загрузка файла (image/video)
router.post('/:tab/upload', requireModerator, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });
  const relPath = '/uploads/' + req.file.filename;
  res.json({ path: relPath });
});

// Добавить новый блок
router.post('/:tab', requireModerator, async (req, res) => {
  const { tab } = req.params;
  const { content } = req.body;
  if (!['info', 'union'].includes(tab)) return res.status(400).json({ message: 'Некорректная вкладка' });
  try {
    const [result] = await db.query(
      'INSERT INTO content_blocks (tab, type, content, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [tab, 'text', content, req.session.userId]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Обновить блок
router.put('/:tab/:id', requireModerator, async (req, res) => {
  const { tab, id } = req.params;
  const { content } = req.body;
  if (!['info', 'union'].includes(tab)) return res.status(400).json({ message: 'Некорректная вкладка' });
  try {
    await db.query(
      'UPDATE content_blocks SET content = ?, updated_at = NOW() WHERE id = ? AND tab = ?',
      [content, id, tab]
    );
    res.json({ message: 'Обновлено' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Удалить блок
router.delete('/:tab/:id', requireModerator, async (req, res) => {
  const { tab, id } = req.params;
  if (!['info', 'union'].includes(tab)) return res.status(400).json({ message: 'Некорректная вкладка' });
  try {
    await db.query('DELETE FROM content_blocks WHERE id = ? AND tab = ?', [id, tab]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router; 