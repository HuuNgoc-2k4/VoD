const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/users - List all users
router.get('/users', (req, res) => {
    const users = db.prepare(
        `SELECT u.id, u.username, u.display_name, u.role, u.created_at,
         (SELECT COUNT(*) FROM videos WHERE user_id = u.id) as video_count
         FROM users u ORDER BY u.created_at DESC`
    ).all();
    res.json(users);
});

// DELETE /api/admin/users/:id - Delete user (and their videos)
router.delete('/users/:id', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User không tồn tại' });
    }

    if (user.role === 'admin') {
        return res.status(400).json({ error: 'Không thể xóa tài khoản admin' });
    }

    // Delete user's video files
    const videos = db.prepare('SELECT id FROM videos WHERE user_id = ?').all(req.params.id);
    for (const v of videos) {
        const videoDir = path.join(__dirname, '..', 'videos', v.id);
        if (fs.existsSync(videoDir)) {
            fs.rmSync(videoDir, { recursive: true, force: true });
        }
    }

    // Delete from database
    db.prepare('DELETE FROM bandwidth_logs WHERE video_id IN (SELECT id FROM videos WHERE user_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM videos WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Đã xóa user và tất cả video' });
});

// GET /api/admin/videos - All videos (any visibility)
router.get('/videos', (req, res) => {
    const videos = db.prepare(
        `SELECT v.*, u.username, u.display_name as uploader_name
         FROM videos v LEFT JOIN users u ON v.user_id = u.id
         ORDER BY v.created_at DESC`
    ).all();
    res.json(videos);
});

module.exports = router;
