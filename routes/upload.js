const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { transcodeVideo } = require('../services/transcoder');

// Configure multer for video uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|avi|mov|mkv)$/i)) {
        cb(null, true);
    } else {
        cb(new Error('Định dạng video không được hỗ trợ. Chấp nhận: MP4, WebM, AVI, MOV, MKV'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

// POST /api/upload - Upload video
router.post('/', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Không có file video được upload' });
    }

    const videoId = uuidv4();
    const title = req.body.title || path.parse(req.file.originalname).name;
    const description = req.body.description || '';

    // Insert into database with processing status
    const stmt = db.prepare(
        'INSERT INTO videos (id, title, description, filename, status) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(videoId, title, description, req.file.filename, 'processing');

    // Start transcoding in the background
    const inputPath = path.join(uploadsDir, req.file.filename);
    transcodeVideo(videoId, inputPath).catch((err) => {
        console.error('Transcode error:', err);
    });

    res.json({
        success: true,
        videoId,
        message: 'Video đã được upload. Đang xử lý transcoding...',
    });
});

// GET /api/upload/status/:id - Check transcoding status
router.get('/status/:id', (req, res) => {
    const video = db.prepare('SELECT id, title, status, duration FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    res.json(video);
});

module.exports = router;
