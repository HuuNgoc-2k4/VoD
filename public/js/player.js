const videoPlayer = document.getElementById('videoPlayer');
const qualitySelector = document.getElementById('qualitySelector');
const currentQualityEl = document.getElementById('currentQuality');
const estimatedBandwidthEl = document.getElementById('estimatedBandwidth');
const bufferLengthEl = document.getElementById('bufferLength');
const segmentsLoadedEl = document.getElementById('segmentsLoaded');
const videoTitleEl = document.getElementById('videoTitle');
const videoViewsEl = document.getElementById('videoViews');
const videoDateEl = document.getElementById('videoDate');
const videoDurationEl = document.getElementById('videoDuration');
const videoDescriptionEl = document.getElementById('videoDescription');

let hls = null;
let segmentsLoaded = 0;
let currentVideo = null;

// Get video ID from URL
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');

if (!videoId) {
    window.location.href = '/';
}

// Utility
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBitrate(bps) {
    if (bps >= 1000000) return (bps / 1000000).toFixed(1) + ' Mbps';
    if (bps >= 1000) return (bps / 1000).toFixed(0) + ' Kbps';
    return bps + ' bps';
}

function timeAgo(dateStr) {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✗'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Load video info
async function loadVideoInfo() {
    try {
        const res = await fetch(`/api/videos/${videoId}`);
        if (!res.ok) throw new Error('Video not found');
        const video = await res.json();
        currentVideo = video;

        document.title = `${video.title} - VoD Streaming`;
        videoTitleEl.textContent = video.title;
        videoViewsEl.textContent = `${video.views} lượt xem`;
        videoDateEl.textContent = timeAgo(video.created_at);
        videoDurationEl.textContent = formatDuration(video.duration);
        videoDescriptionEl.textContent = video.description || 'Không có mô tả';

        if (video.status === 'ready') {
            initPlayer();
        } else if (video.status === 'processing') {
            currentQualityEl.textContent = 'Đang xử lý...';
            showToast('Video đang được xử lý. Vui lòng đợi...', 'error');
            pollStatus();
        } else {
            currentQualityEl.textContent = 'Lỗi';
            showToast('Video bị lỗi khi xử lý', 'error');
        }
    } catch (err) {
        console.error('Error loading video:', err);
        showToast('Không thể tải video', 'error');
        videoTitleEl.textContent = 'Video không tồn tại';
    }
}

function pollStatus() {
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/upload/status/${videoId}`);
            const video = await res.json();
            if (video.status === 'ready') {
                clearInterval(interval);
                initPlayer();
                showToast('Video đã sẵn sàng!');
            } else if (video.status === 'error') {
                clearInterval(interval);
                showToast('Lỗi xử lý video', 'error');
            }
        } catch (e) { }
    }, 3000);
}

// Initialize HLS.js Player
function initPlayer() {
    const streamUrl = `/videos/${videoId}/master.m3u8`;

    if (Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startLevel: 0,
            abrEwmaDefaultEstimate: 500000,
            abrBandWidthFactor: 0.95,
            abrBandWidthUpFactor: 0.7,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            testBandwidth: true,
            progressive: true,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(videoPlayer);

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS Manifest loaded, quality levels:', data.levels.length);
            buildQualitySelector(data.levels);
            videoPlayer.play().catch(() => { });
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            const level = hls.levels[data.level];
            if (level) {
                const qualityName = `${level.height}p`;
                currentQualityEl.textContent = qualityName;
                updateQualityButtons(data.level);
            }
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
            segmentsLoaded++;
            segmentsLoadedEl.textContent = segmentsLoaded;
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('HLS Fatal Error:', data);
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        hls.destroy();
                        showToast('Lỗi phát video', 'error');
                }
            }
        });

        setInterval(updateStats, 1000);
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = streamUrl;
        videoPlayer.addEventListener('loadedmetadata', () => {
            videoPlayer.play().catch(() => { });
        });
        currentQualityEl.textContent = 'Auto (native)';
    } else {
        showToast('Trình duyệt không hỗ trợ HLS', 'error');
    }
}

// Build quality selector buttons
function buildQualitySelector(levels) {
    let html = '<span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Chất lượng:</span>';
    html += `<button class="quality-badge active" data-level="-1" onclick="setQuality(-1)">Auto</button>`;

    levels.forEach((level, index) => {
        html += `<button class="quality-badge" data-level="${index}" onclick="setQuality(${index})">${level.height}p</button>`;
    });

    qualitySelector.innerHTML = html;
}

// Set quality level
function setQuality(level) {
    if (!hls) return;

    if (level === -1) {
        hls.currentLevel = -1;
        currentQualityEl.textContent = 'Auto';
    } else {
        hls.currentLevel = level;
        const levelData = hls.levels[level];
        if (levelData) {
            currentQualityEl.textContent = `${levelData.height}p (thủ công)`;
        }
    }

    document.querySelectorAll('.quality-badge').forEach((btn) => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.level) === level) {
            btn.classList.add('active');
        }
    });
}

// Update quality button active state
function updateQualityButtons(activeLevel) {
    if (hls && hls.autoLevelEnabled) {
        document.querySelectorAll('.quality-badge').forEach((btn) => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.level) === -1) {
                btn.classList.add('active');
            }
        });
    }
}

// Update streaming stats
function updateStats() {
    if (!hls) return;

    const bwEstimate = hls.bandwidthEstimate;
    if (bwEstimate) {
        estimatedBandwidthEl.textContent = formatBitrate(bwEstimate);
    }

    if (videoPlayer.buffered.length > 0) {
        const buffered = videoPlayer.buffered.end(videoPlayer.buffered.length - 1) - videoPlayer.currentTime;
        bufferLengthEl.textContent = `${Math.max(0, buffered).toFixed(1)}s`;
    }
}

// ===================================
// Edit / Delete / Download
// ===================================

const editModal = document.getElementById('editModal');
const deleteModal = document.getElementById('deleteModal');
const editTitleInput = document.getElementById('editTitle');
const editDescInput = document.getElementById('editDesc');

// --- Download ---
document.getElementById('btnDownload').addEventListener('click', () => {
    if (!currentVideo || currentVideo.status !== 'ready') {
        showToast('Video chưa sẵn sàng để tải', 'error');
        return;
    }
    // Trigger download via hidden link
    const a = document.createElement('a');
    a.href = `/api/videos/${videoId}/download`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Đang bắt đầu tải xuống...');
});

// --- Edit ---
document.getElementById('btnEdit').addEventListener('click', () => {
    if (!currentVideo) return;
    editTitleInput.value = currentVideo.title || '';
    editDescInput.value = currentVideo.description || '';
    editModal.style.display = 'flex';
});

document.getElementById('btnCancelEdit').addEventListener('click', () => {
    editModal.style.display = 'none';
});

// Close modal on overlay click
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.style.display = 'none';
});

document.getElementById('btnSaveEdit').addEventListener('click', async () => {
    const title = editTitleInput.value.trim();
    const description = editDescInput.value.trim();

    if (!title) {
        showToast('Tiêu đề không được để trống', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/videos/${videoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description }),
        });

        const result = await res.json();

        if (res.ok) {
            editModal.style.display = 'none';
            showToast('Đã cập nhật video thành công!');
            // Update UI
            currentVideo.title = title;
            currentVideo.description = description;
            videoTitleEl.textContent = title;
            videoDescriptionEl.textContent = description || 'Không có mô tả';
            document.title = `${title} - VoD Streaming`;
        } else {
            showToast(result.error || 'Lỗi cập nhật video', 'error');
        }
    } catch (err) {
        console.error('Edit error:', err);
        showToast('Lỗi kết nối server', 'error');
    }
});

// --- Delete ---
document.getElementById('btnDelete').addEventListener('click', () => {
    deleteModal.style.display = 'flex';
});

document.getElementById('btnCancelDelete').addEventListener('click', () => {
    deleteModal.style.display = 'none';
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) deleteModal.style.display = 'none';
});

document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
    try {
        const res = await fetch(`/api/videos/${videoId}`, {
            method: 'DELETE',
        });

        const result = await res.json();

        if (res.ok) {
            showToast('Đã xóa video thành công!');
            // Redirect to homepage after short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showToast(result.error || 'Lỗi xóa video', 'error');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Lỗi kết nối server', 'error');
    }
});

// Init
loadVideoInfo();
