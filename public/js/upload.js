const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');
const titleInput = document.getElementById('videoTitle');
const descInput = document.getElementById('videoDesc');
const uploadBtn = document.getElementById('uploadBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressSize = document.getElementById('progressSize');
const transcodingStatus = document.getElementById('transcodingStatus');
const transcodingText = document.getElementById('transcodingText');
const uploadSuccess = document.getElementById('uploadSuccess');
const watchBtn = document.getElementById('watchBtn');

let selectedFile = null;

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Drag & Drop
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) selectFile(e.target.files[0]);
});

function selectFile(file) {
    // Validate
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|avi|mov|mkv)$/i)) {
        showToast('Vui lòng chọn file video (MP4, WebM, AVI, MOV, MKV)', 'error');
        return;
    }

    if (file.size > 500 * 1024 * 1024) {
        showToast('File quá lớn. Giới hạn 500MB.', 'error');
        return;
    }

    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    titleInput.value = file.name.replace(/\.[^/.]+$/, '');

    dropZone.style.display = 'none';
    uploadForm.classList.add('active');
}

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    dropZone.style.display = 'block';
    uploadForm.classList.remove('active');
});

// Upload
uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const title = titleInput.value.trim();
    if (!title) {
        showToast('Vui lòng nhập tiêu đề video', 'error');
        titleInput.focus();
        return;
    }

    // Disable form
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Đang upload...';
    uploadForm.style.opacity = '0.6';
    uploadForm.style.pointerEvents = 'none';

    // Show progress
    progressContainer.classList.add('active');

    // Prepare form data
    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title);
    formData.append('description', descInput.value.trim());

    // Upload with progress tracking
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
            progressSize.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
        }
    });

    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            progressContainer.classList.remove('active');
            transcodingStatus.classList.add('active');
            showToast('Upload thành công! Đang transcode...');

            // Poll for transcoding status
            pollTranscoding(result.videoId);
        } else {
            let errorMsg = 'Upload thất bại';
            try {
                const err = JSON.parse(xhr.responseText);
                errorMsg = err.error || errorMsg;
            } catch (e) { }
            showToast(errorMsg, 'error');
            resetForm();
        }
    });

    xhr.addEventListener('error', () => {
        showToast('Lỗi kết nối. Vui lòng thử lại.', 'error');
        resetForm();
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
});

function pollTranscoding(videoId) {
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/upload/status/${videoId}`);
            const data = await res.json();

            if (data.status === 'ready') {
                clearInterval(interval);
                transcodingStatus.classList.remove('active');
                uploadSuccess.style.display = 'block';
                watchBtn.href = `/player.html?id=${videoId}`;
                showToast('🎉 Video đã sẵn sàng phát!');
            } else if (data.status === 'error') {
                clearInterval(interval);
                transcodingText.textContent = 'Lỗi khi xử lý video';
                showToast('Lỗi transcode video', 'error');
            }
        } catch (e) {
            // Continue polling
        }
    }, 3000);
}

function resetForm() {
    uploadBtn.disabled = false;
    uploadBtn.textContent = '⬆️ Bắt đầu Upload & Transcode';
    uploadForm.style.opacity = '1';
    uploadForm.style.pointerEvents = 'auto';
    progressContainer.classList.remove('active');
    progressBar.style.width = '0%';
}
