const express = require('express');
const path = require('path');
const bandwidthTracker = require('./middleware/bandwidth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(bandwidthTracker);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Serve video HLS files with proper MIME types
app.use(
    '/videos',
    express.static(path.join(__dirname, 'videos'), {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.m3u8')) {
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            } else if (filePath.endsWith('.ts')) {
                res.setHeader('Content-Type', 'video/mp2t');
            }
        },
    })
);

// Serve thumbnails from video directories
app.get('/thumbnails/:videoId', (req, res) => {
    const thumbPath = path.join(__dirname, 'videos', req.params.videoId, 'thumbnail.jpg');
    res.sendFile(thumbPath, (err) => {
        if (err) {
            // Send a default placeholder
            res.status(404).send('');
        }
    });
});

// API Routes
app.use('/api/videos', require('./routes/videos'));
app.use('/api/upload', require('./routes/upload'));

// SPA fallback - serve index.html for client-side routing
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/videos/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File quá lớn. Giới hạn 500MB.' });
    }
    res.status(500).json({ error: err.message || 'Lỗi server' });
});

app.listen(PORT, () => {
    console.log(`\n VoD Streaming Server`);
    console.log(` http://localhost:${PORT}`);
});
