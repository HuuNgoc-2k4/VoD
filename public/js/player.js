// ===================================
// VoD Streaming - Player.js
// HLS.js Player + Edit/Delete/Download
// ===================================

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
let editVisibility = 'public';

const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');
if (!videoId) window.location.href = '/';

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
    setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function setEditVisibility(vis) {
    editVisibility = vis;
    document.getElementById('editVisPublic').classList.toggle('active', vis === 'public');
    document.getElementById('editVisPrivate').classList.toggle('active', vis === 'private');
}

// Load video info
async function loadVideoInfo() {
    try {
        const res = await authFetch(`/api/videos/${videoId}`);
        if (!res.ok) {
            if (res.status === 403) {
                showToast('Video này ở chế độ riêng tư', 'error');
                videoTitleEl.textContent = 'Video riêng tư';
                return;
            }
            throw new Error('Video not found');
        }
        const video = await res.json();
        currentVideo = video;

        document.title = `${video.title} - VoD Streaming`;
        videoTitleEl.textContent = video.title;
        videoViewsEl.textContent = `${video.views} lượt xem`;
        videoDateEl.textContent = timeAgo(video.created_at);
        videoDurationEl.textContent = formatDuration(video.duration);
        videoDescriptionEl.textContent = video.description || 'Không có mô tả';

        // Show uploader
        if (video.uploader_name) {
            document.getElementById('videoUploader').textContent = `Uploaded bởi: ${video.uploader_name}`;
        }

        // Show visibility badge
        if (video.visibility === 'private') {
            document.getElementById('videoVisibility').innerHTML = ' • <span class="visibility-badge private">Private</span>';
        }

        // Show codec info
        if (video.codec) {
            const codecNames = { libx264: 'H.264', libx265: 'H.265/HEVC', 'libvpx-vp9': 'VP9', 'libaom-av1': 'AV1' };
            document.getElementById('videoCodec').textContent = `Codec: ${codecNames[video.codec] || video.codec}`;
        }

        // Show action buttons if owner or admin
        const user = getCurrentUser();
        if (user) {
            const isOwner = video.user_id === user.id;
            const isAdm = user.role === 'admin';
            if (isOwner || isAdm) {
                document.getElementById('videoActions').style.display = 'flex';
            }
            // Download is visible for everyone (when video is ready)
            if (video.status === 'ready') {
                document.getElementById('btnDownload').style.display = '';
            }
        }

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
            if (video.status === 'ready') { clearInterval(interval); initPlayer(); showToast('Video đã sẵn sàng!'); }
            else if (video.status === 'error') { clearInterval(interval); showToast('Lỗi xử lý video', 'error'); }
        } catch (e) { }
    }, 3000);
}

// HLS Player
function initPlayer() {
    const streamUrl = `/videos/${videoId}/master.m3u8`;

    if (Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true, lowLatencyMode: false, startLevel: 0,
            abrEwmaDefaultEstimate: 500000, abrBandWidthFactor: 0.95, abrBandWidthUpFactor: 0.7,
            maxBufferLength: 30, maxMaxBufferLength: 60, maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5, testBandwidth: true, progressive: true,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(videoPlayer);

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            buildQualitySelector(data.levels);
            videoPlayer.play().catch(() => { });
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            const level = hls.levels[data.level];
            if (level) { currentQualityEl.textContent = `${level.height}p`; updateQualityButtons(data.level); }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => { segmentsLoaded++; segmentsLoadedEl.textContent = segmentsLoaded; });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
                    case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
                    default: hls.destroy(); showToast('Lỗi phát video', 'error');
                }
            }
        });

        setInterval(updateStats, 1000);
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = streamUrl;
        videoPlayer.addEventListener('loadedmetadata', () => { videoPlayer.play().catch(() => { }); });
        currentQualityEl.textContent = 'Auto (native)';
    } else {
        showToast('Trình duyệt không hỗ trợ HLS', 'error');
    }
}

function buildQualitySelector(levels) {
    let html = '<span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Chất lượng:</span>';
    html += `<button class="quality-badge active" data-level="-1" onclick="setQuality(-1)">Auto</button>`;
    levels.forEach((level, index) => {
        html += `<button class="quality-badge" data-level="${index}" onclick="setQuality(${index})">${level.height}p</button>`;
    });
    qualitySelector.innerHTML = html;
}

function setQuality(level) {
    if (!hls) return;
    hls.currentLevel = level;
    if (level === -1) { currentQualityEl.textContent = 'Auto'; }
    else { const l = hls.levels[level]; if (l) currentQualityEl.textContent = `${l.height}p (thủ công)`; }
    document.querySelectorAll('.quality-badge').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
}

function updateQualityButtons(activeLevel) {
    if (hls && hls.autoLevelEnabled) {
        document.querySelectorAll('.quality-badge').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.level) === -1);
        });
    }
}

function updateStats() {
    if (!hls) return;
    const bw = hls.bandwidthEstimate;
    if (bw) estimatedBandwidthEl.textContent = formatBitrate(bw);
    if (videoPlayer.buffered.length > 0) {
        const buf = videoPlayer.buffered.end(videoPlayer.buffered.length - 1) - videoPlayer.currentTime;
        bufferLengthEl.textContent = `${Math.max(0, buf).toFixed(1)}s`;
    }
}

// ===================================
// Download with quality selection
// ===================================

document.getElementById('btnDownload').addEventListener('click', async () => {
    if (!currentVideo || currentVideo.status !== 'ready') {
        showToast('Video chưa sẵn sàng', 'error');
        return;
    }

    const modal = document.getElementById('downloadModal');
    const container = document.getElementById('downloadQualities');
    container.innerHTML = '<p style="color: var(--text-muted);">Đang tải...</p>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/videos/${videoId}/qualities`);
        const qualities = await res.json();

        if (qualities.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">Không có chất lượng nào</p>';
            return;
        }

        container.innerHTML = qualities.map(q => `
            <button class="download-quality-btn" onclick="startDownload('${q.quality}')">
                <span class="dq-label">${q.quality}</span>
                <span class="dq-size">${formatBytes(q.size)}</span>
            </button>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p style="color: var(--danger);">Lỗi tải danh sách chất lượng</p>';
    }
});

function startDownload(quality) {
    document.getElementById('downloadModal').style.display = 'none';
    const a = document.createElement('a');
    a.href = `/api/videos/${videoId}/download?quality=${quality}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Đang tải xuống ${quality}...`);
}

document.getElementById('btnCancelDownload').addEventListener('click', () => {
    document.getElementById('downloadModal').style.display = 'none';
});

document.getElementById('downloadModal').addEventListener('click', (e) => {
    if (e.target.id === 'downloadModal') document.getElementById('downloadModal').style.display = 'none';
});

// ===================================
// Edit
// ===================================

document.getElementById('btnEdit').addEventListener('click', () => {
    if (!currentVideo) return;
    document.getElementById('editTitle').value = currentVideo.title || '';
    document.getElementById('editDesc').value = currentVideo.description || '';
    setEditVisibility(currentVideo.visibility || 'public');
    document.getElementById('editModal').style.display = 'flex';
});

document.getElementById('btnCancelEdit').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
});

document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') document.getElementById('editModal').style.display = 'none';
});

document.getElementById('btnSaveEdit').addEventListener('click', async () => {
    const title = document.getElementById('editTitle').value.trim();
    const description = document.getElementById('editDesc').value.trim();

    if (!title) { showToast('Tiêu đề không được để trống', 'error'); return; }

    try {
        const res = await authFetch(`/api/videos/${videoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, visibility: editVisibility }),
        });
        const result = await res.json();

        if (res.ok) {
            document.getElementById('editModal').style.display = 'none';
            showToast('Đã cập nhật video!');
            currentVideo.title = title;
            currentVideo.description = description;
            currentVideo.visibility = editVisibility;
            videoTitleEl.textContent = title;
            videoDescriptionEl.textContent = description || 'Không có mô tả';
            document.title = `${title} - VoD Streaming`;
            // Update visibility badge
            const visBadge = document.getElementById('videoVisibility');
            visBadge.innerHTML = editVisibility === 'private' ? ' • <span class="visibility-badge private">Private</span>' : '';
        } else {
            showToast(result.error || 'Lỗi cập nhật', 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối server', 'error');
    }
});

// ===================================
// Delete
// ===================================

document.getElementById('btnDelete').addEventListener('click', () => {
    document.getElementById('deleteModal').style.display = 'flex';
});

document.getElementById('btnCancelDelete').addEventListener('click', () => {
    document.getElementById('deleteModal').style.display = 'none';
});

document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target.id === 'deleteModal') document.getElementById('deleteModal').style.display = 'none';
});

document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
    try {
        const res = await authFetch(`/api/videos/${videoId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Đã xóa video!');
            setTimeout(() => { window.location.href = '/'; }, 1000);
        } else {
            const d = await res.json();
            showToast(d.error || 'Lỗi xóa video', 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối server', 'error');
    }
});

// Init
loadVideoInfo();
