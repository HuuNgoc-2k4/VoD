// ===================================
// VoD Streaming - App.js
// Main application logic for homepage
// ===================================

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

function timeAgo(dateStr) {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Video Grid
const videoGrid = document.getElementById('videoGrid');
const emptyState = document.getElementById('emptyState');
const videoCount = document.getElementById('videoCount');
const searchInput = document.getElementById('searchInput');

let debounceTimer;

async function loadVideos(search = '') {
    try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);

        const res = await authFetch(`/api/videos?${params}`);
        const videos = await res.json();
        renderVideos(videos);
    } catch (err) {
        console.error('Error loading videos:', err);
        showToast('Không thể tải danh sách video', 'error');
    }
}

function renderVideos(videos) {
    if (videos.length === 0) {
        videoGrid.style.display = 'none';
        emptyState.style.display = 'block';
        videoCount.textContent = '';
        return;
    }

    videoGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    videoCount.textContent = `${videos.length} video`;

    videoGrid.innerHTML = videos.map(video => `
    <div class="video-card" onclick="window.location.href='/player.html?id=${video.id}'">
      <div class="video-thumbnail">
        ${video.status === 'ready' && video.thumbnail
            ? `<img src="/thumbnails/${video.id}" alt="${escapeHtml(video.title)}" loading="lazy">`
            : `<div class="placeholder-thumb">▶</div>`
        }
        <div class="video-play-btn"></div>
        ${video.duration ? `<span class="video-duration">${formatDuration(video.duration)}</span>` : ''}
        ${video.visibility === 'private' ? `<span class="visibility-tag">Private</span>` : ''}
      </div>
      <div class="video-info">
        <h3>${escapeHtml(video.title)}</h3>
        <div class="video-meta">
          <span class="video-status ${video.status}">
            ${video.status === 'processing' ? 'Đang xử lý' : video.status === 'ready' ? '✓ Sẵn sàng' : '✗ Lỗi'}
          </span>
          <span>${video.views || 0} lượt xem</span>
          <span>${timeAgo(video.created_at)}</span>
        </div>
        ${video.uploader_name ? `<div class="video-uploader">${escapeHtml(video.uploader_name)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// Search
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadVideos(e.target.value);
        }, 300);
    });
}

// Auto-refresh for processing videos
function autoRefresh() {
    const processingCards = document.querySelectorAll('.video-status.processing');
    if (processingCards.length > 0) {
        setTimeout(() => {
            loadVideos(searchInput?.value || '');
            autoRefresh();
        }, 5000);
    }
}

// Init
loadVideos();
setTimeout(autoRefresh, 5000);
