const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'vod-streaming-secret-key-nhom8';

// Verify JWT and attach user to request
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(decoded.id);
        if (!user) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}

// Optional auth - attach user if token present, but don't block
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(decoded.id);
            if (user) req.user = user;
        } catch (e) { }
    }
    next();
}

// Admin only
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Chỉ admin mới có quyền thực hiện' });
    }
    next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin, JWT_SECRET };
