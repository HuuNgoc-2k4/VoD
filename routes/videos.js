const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');

// GET /api/videos - List all videos
router.get('/', (req, res) => {
    const { search, status, sort } = req.query;

    let query = 'SELECT * FROM videos WHERE 1=1';
    const params = [];

    if (search) {
        query += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    if (sort === 'views') {
        query += ' ORDER BY views DESC';
    } else if (sort === 'oldest') {
        query += ' ORDER BY created_at ASC';
    } else {
        query += ' ORDER BY created_at DESC';
    }

    const videos = db.prepare(query).all(...params);
    res.json(videos);
});

// GET /api/videos/:id - Get video detail
router.get('/:id', (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    // Increment views
    db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);
    video.views += 1;

    res.json(video);
});

// PUT /api/videos/:id - Update video info
router.put('/:id', (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    const { title, description } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Tiêu đề không được để trống' });
    }

    db.prepare('UPDATE videos SET title = ?, description = ? WHERE id = ?')
        .run(title.trim(), (description || '').trim(), req.params.id);

    res.json({ success: true, message: 'Đã cập nhật video' });
});

// DELETE /api/videos/:id - Delete video
router.delete('/:id', (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    // Remove video files
    const videoDir = path.join(__dirname, '..', 'videos', req.params.id);
    if (fs.existsSync(videoDir)) {
        fs.rmSync(videoDir, { recursive: true, force: true });
    }

    // Remove from database
    db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM bandwidth_logs WHERE video_id = ?').run(req.params.id);

    res.json({ success: true, message: 'Đã xóa video' });
});

// GET /api/videos/:id/download - Download video (highest quality available)
router.get('/:id/download', (req, res) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    if (video.status !== 'ready') {
        return res.status(400).json({ error: 'Video chưa sẵn sàng' });
    }

    const videoDir = path.join(__dirname, '..', 'videos', req.params.id);

    // Find the highest quality available
    const qualityOrder = ['1080p', '720p', '480p', '360p'];
    let selectedQuality = null;

    for (const q of qualityOrder) {
        const qDir = path.join(videoDir, q);
        if (fs.existsSync(qDir)) {
            selectedQuality = q;
            break;
        }
    }

    if (!selectedQuality) {
        return res.status(404).json({ error: 'Không tìm thấy file video' });
    }

    // Collect all .ts segments and concatenate them
    const segDir = path.join(videoDir, selectedQuality);
    const segments = fs.readdirSync(segDir)
        .filter(f => f.endsWith('.ts'))
        .sort();

    if (segments.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy segments' });
    }

    // Calculate total size
    let totalSize = 0;
    for (const seg of segments) {
        totalSize += fs.statSync(path.join(segDir, seg)).size;
    }

    // Set download headers
    const safeTitle = video.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s._-]/g, '').trim() || 'video';
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${selectedQuality}.ts"`);
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Content-Length', totalSize);

    // Stream segments sequentially
    let index = 0;
    function sendNext() {
        if (index >= segments.length) {
            res.end();
            return;
        }
        const segPath = path.join(segDir, segments[index]);
        const stream = fs.createReadStream(segPath);
        index++;
        stream.on('end', sendNext);
        stream.on('error', (err) => {
            console.error('Download stream error:', err);
            res.end();
        });
        stream.pipe(res, { end: false });
    }
    sendNext();
});

module.exports = router;
