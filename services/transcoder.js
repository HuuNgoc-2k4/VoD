const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const QUALITIES = [
    { name: '360p', width: 640, height: 360, bitrate: '800k', audioBitrate: '96k' },
    { name: '480p', width: 854, height: 480, bitrate: '1400k', audioBitrate: '128k' },
    { name: '720p', width: 1280, height: 720, bitrate: '2800k', audioBitrate: '128k' },
    { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', audioBitrate: '192k' },
    { name: '1440p', width: 2560, height: 1440, bitrate: '10000k', audioBitrate: '192k' },
    { name: '2160p', width: 3840, height: 2160, bitrate: '20000k', audioBitrate: '256k' },
];

const SEGMENT_DURATION = 6;

function getVideoDuration(inputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
}

function generateThumbnail(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: ['50%'],
                filename: 'thumbnail.jpg',
                folder: outputPath,
                size: '640x?',
            })
            .on('end', () => resolve(path.join(outputPath, 'thumbnail.jpg')))
            .on('error', reject);
    });
}

function transcodeToQuality(inputPath, outputDir, quality) {
    return new Promise((resolve, reject) => {
        const qualityDir = path.join(outputDir, quality.name);
        if (!fs.existsSync(qualityDir)) {
            fs.mkdirSync(qualityDir, { recursive: true });
        }

        const playlistPath = path.join(qualityDir, 'playlist.m3u8');

        ffmpeg(inputPath)
            .outputOptions([
                `-vf scale=${quality.width}:${quality.height}:force_original_aspect_ratio=decrease,pad=${quality.width}:${quality.height}:(ow-iw)/2:(oh-ih)/2`,
                `-c:v libx264`,
                `-b:v ${quality.bitrate}`,
                `-maxrate ${quality.bitrate}`,
                `-bufsize ${parseInt(quality.bitrate) * 2}k`,
                `-c:a aac`,
                `-b:a ${quality.audioBitrate}`,
                `-preset fast`,
                `-g 48`,
                `-keyint_min 48`,
                `-sc_threshold 0`,
                `-hls_time ${SEGMENT_DURATION}`,
                `-hls_playlist_type vod`,
                `-hls_segment_filename ${path.join(qualityDir, 'segment_%03d.ts')}`,
                `-f hls`,
            ])
            .output(playlistPath)
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`  [${quality.name}] ${Math.round(progress.percent)}%`);
                }
            })
            .on('end', () => {
                console.log(`  [${quality.name}] ✓ Hoàn thành`);
                resolve(playlistPath);
            })
            .on('error', (err) => {
                console.error(`  [${quality.name}] ✗ Lỗi:`, err.message);
                reject(err);
            })
            .run();
    });
}

function generateMasterPlaylist(outputDir, availableQualities) {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n';

    availableQualities.forEach((q) => {
        const bandwidth = parseInt(q.bitrate) * 1000;
        playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${q.width}x${q.height},NAME="${q.name}"\n`;
        playlist += `${q.name}/playlist.m3u8\n`;
    });

    fs.writeFileSync(path.join(outputDir, 'master.m3u8'), playlist);
}

async function transcodeVideo(videoId, inputPath) {
    const videosDir = path.join(__dirname, '..', 'videos');
    const outputDir = path.join(videosDir, videoId);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        console.log(`\n🎬 Bắt đầu transcode video: ${videoId}`);

        // Get duration
        const duration = await getVideoDuration(inputPath);
        console.log(`  Thời lượng: ${Math.round(duration)}s`);

        // Generate thumbnail
        console.log(`  📸 Tạo thumbnail...`);
        const thumbnailPath = await generateThumbnail(inputPath, outputDir);

        // Get input video resolution to determine which qualities to generate
        const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        const inputHeight = videoStream ? videoStream.height : 1080;

        // Only transcode to qualities <= input resolution
        const applicableQualities = QUALITIES.filter((q) => q.height <= inputHeight);
        if (applicableQualities.length === 0) {
            applicableQualities.push(QUALITIES[0]); // At least 360p
        }

        console.log(
            `  🎞️ Sẽ transcode: ${applicableQualities.map((q) => q.name).join(', ')}`
        );

        // Transcode each quality sequentially to avoid overloading CPU
        for (const quality of applicableQualities) {
            await transcodeToQuality(inputPath, outputDir, quality);
        }

        // Generate master playlist
        generateMasterPlaylist(outputDir, applicableQualities);
        console.log(`  📋 Tạo master playlist`);

        // Get file size
        const stats = fs.statSync(inputPath);

        // Update database
        const stmt = db.prepare(
            'UPDATE videos SET status = ?, duration = ?, file_size = ?, thumbnail = ? WHERE id = ?'
        );
        stmt.run('ready', duration, stats.size, `thumbnail.jpg`, videoId);

        // Clean up the original uploaded file
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }

        console.log(`✅ Transcode hoàn thành: ${videoId}\n`);
    } catch (error) {
        console.error(`❌ Transcode thất bại: ${videoId}`, error);

        const stmt = db.prepare('UPDATE videos SET status = ? WHERE id = ?');
        stmt.run('error', videoId);
    }
}

module.exports = { transcodeVideo };
