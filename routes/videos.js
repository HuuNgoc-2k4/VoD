const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const { optionalAuth, requireAuth } = require('../middleware/auth');

// GET /api/videos - List videos (public + own private)
router.get('/', optionalAuth, (req, res) => {
    const { search, status, sort } = req.query;
    const user = req.user;

    let query = 'SELECT v.*, u.username, u.display_name as uploader_name FROM videos v LEFT JOIN users u ON v.user_id = u.id WHERE 1=1';
    const params = [];

    // Visibility filter: admin sees all, users see public + own private
    if (user && user.role === 'admin') {
        // admin sees everything
    } else if (user) {
        query += ' AND (v.visibility = ? OR v.user_id = ?)';
        params.push('public', user.id);
    } else {
        query += ' AND v.visibility = ?';
        params.push('public');
    }

    if (search) {
        query += ' AND (v.title LIKE ? OR v.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
        query += ' AND v.status = ?';
        params.push(status);
    }

    if (sort === 'views') {
        query += ' ORDER BY v.views DESC';
    } else if (sort === 'oldest') {
        query += ' ORDER BY v.created_at ASC';
    } else {
        query += ' ORDER BY v.created_at DESC';
    }

    const videos = db.prepare(query).all(...params);
    res.json(videos);
});

// GET /api/videos/:id - Get video detail
router.get('/:id', optionalAuth, (req, res) => {
    const video = db.prepare(
        'SELECT v.*, u.username, u.display_name as uploader_name FROM videos v LEFT JOIN users u ON v.user_id = u.id WHERE v.id = ?'
    ).get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    // Check visibility
    const user = req.user;
    if (video.visibility === 'private') {
        if (!user || (user.role !== 'admin' && user.id !== video.user_id)) {
            return res.status(403).json({ error: 'Video này ở chế độ riêng tư' });
        }
    }

    // Increment views
    db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);
    video.views += 1;

    res.json(video);
});

// PUT /api/videos/:id - Update video info
router.put('/:id', requireAuth, (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    // Only owner or admin
    if (req.user.role !== 'admin' && video.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa video này' });
    }

    const { title, description, visibility } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Tiêu đề không được để trống' });
    }

    const vis = (visibility === 'private') ? 'private' : 'public';

    db.prepare('UPDATE videos SET title = ?, description = ?, visibility = ? WHERE id = ?')
        .run(title.trim(), (description || '').trim(), vis, req.params.id);

    res.json({ success: true, message: 'Đã cập nhật video' });
});

// DELETE /api/videos/:id - Delete video
router.delete('/:id', requireAuth, (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    // Only owner or admin
    if (req.user.role !== 'admin' && video.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa video này' });
    }

    const videoDir = path.join(__dirname, '..', 'videos', req.params.id);
    if (fs.existsSync(videoDir)) {
        fs.rmSync(videoDir, { recursive: true, force: true });
    }

    db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM bandwidth_logs WHERE video_id = ?').run(req.params.id);

    res.json({ success: true, message: 'Đã xóa video' });
});

// GET /api/videos/:id/qualities - Get available qualities for download
router.get('/:id/qualities', (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video || video.status !== 'ready') {
        return res.status(404).json({ error: 'Video không tồn tại hoặc chưa sẵn sàng' });
    }

    const videoDir = path.join(__dirname, '..', 'videos', req.params.id);
    const allQualities = ['360p', '480p', '720p', '1080p', '1440p', '2160p'];
    const available = [];

    for (const q of allQualities) {
        const qDir = path.join(videoDir, q);
        if (fs.existsSync(qDir)) {
            // Calculate size
            const segments = fs.readdirSync(qDir).filter(f => f.endsWith('.ts'));
            let size = 0;
            for (const seg of segments) {
                size += fs.statSync(path.join(qDir, seg)).size;
            }
            available.push({ quality: q, size });
        }
    }

    res.json(available);
});

// GET /api/videos/:id/download?quality=720p - Download video
router.get('/:id/download', (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    if (video.status !== 'ready') {
        return res.status(400).json({ error: 'Video chưa sẵn sàng' });
    }

    const videoDir = path.join(__dirname, '..', 'videos', req.params.id);
    const requestedQuality = req.query.quality;

    let selectedQuality = null;

    if (requestedQuality) {
        // Use requested quality if available
        const qDir = path.join(videoDir, requestedQuality);
        if (fs.existsSync(qDir)) {
            selectedQuality = requestedQuality;
        }
    }

    if (!selectedQuality) {
        // Fallback: highest quality available
        const qualityOrder = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];
        for (const q of qualityOrder) {
            const qDir = path.join(videoDir, q);
            if (fs.existsSync(qDir)) {
                selectedQuality = q;
                break;
            }
        }
    }

    if (!selectedQuality) {
        return res.status(404).json({ error: 'Không tìm thấy file video' });
    }

    const segDir = path.join(videoDir, selectedQuality);
    const segments = fs.readdirSync(segDir).filter(f => f.endsWith('.ts')).sort();

    if (segments.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy segments' });
    }

    let totalSize = 0;
    for (const seg of segments) {
        totalSize += fs.statSync(path.join(segDir, seg)).size;
    }

    const safeTitle = video.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s._-]/g, '').trim() || 'video';
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${selectedQuality}.ts"`);
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Content-Length', totalSize);

    let index = 0;
    function sendNext() {
        if (index >= segments.length) { res.end(); return; }
        const segPath = path.join(segDir, segments[index]);
        const stream = fs.createReadStream(segPath);
        index++;
        stream.on('end', sendNext);
        stream.on('error', () => res.end());
        stream.pipe(res, { end: false });
    }
    sendNext();
});

module.exports = router;
