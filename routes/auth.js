const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', (req, res) => {
    const { username, password, display_name } = req.body;

    if (!username || !password || !display_name) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return res.status(409).json({ error: 'Tên đăng nhập đã được sử dụng' });
    }

    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare('INSERT INTO users (id, username, password, display_name, role) VALUES (?, ?, ?, ?, ?)')
        .run(id, username, hashedPassword, display_name.trim(), 'user');

    const token = jwt.sign({ id, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
        success: true,
        token,
        user: { id, username, display_name: display_name.trim(), role: 'user' },
    });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
        success: true,
        token,
        user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
    });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
