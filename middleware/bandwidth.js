const db = require('../db');

function bandwidthTracker(req, res, next) {
    // Only track video segment requests
    if (req.path.includes('/videos/') && (req.path.endsWith('.ts') || req.path.endsWith('.m3u8'))) {
        const originalEnd = res.end;
        let bytesSent = 0;

        const originalWrite = res.write;
        res.write = function (chunk, ...args) {
            if (chunk) {
                bytesSent += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
            }
            return originalWrite.apply(this, [chunk, ...args]);
        };

        res.end = function (chunk, ...args) {
            if (chunk) {
                bytesSent += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
            }

            // Extract video ID and quality from path
            const pathParts = req.path.split('/');
            const videosIdx = pathParts.indexOf('videos');
            const videoId = videosIdx >= 0 ? pathParts[videosIdx + 1] : null;
            const quality = videosIdx >= 0 ? pathParts[videosIdx + 2] : null;

            if (videoId && bytesSent > 0) {
                try {
                    const stmt = db.prepare(
                        'INSERT INTO bandwidth_logs (video_id, bytes_sent, quality, client_ip) VALUES (?, ?, ?, ?)'
                    );
                    stmt.run(videoId, bytesSent, quality || '', req.ip || req.connection.remoteAddress);
                } catch (e) {
                    // Don't crash on logging errors
                }
            }

            return originalEnd.apply(this, [chunk, ...args]);
        };

        // Set cache headers for segments (immutable content)
        if (req.path.endsWith('.ts')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (req.path.endsWith('.m3u8')) {
            res.setHeader('Cache-Control', 'public, max-age=1');
        }
    }

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    next();
}

module.exports = bandwidthTracker;
