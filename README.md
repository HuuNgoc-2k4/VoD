# VoD Streaming Platform

Website chia sẻ video tối ưu hóa băng thông sử dụng giao thức Video-on-Demand (VoD) với HLS Adaptive Bitrate Streaming.

## Chức năng

### Quản lý Video
- **Upload video**: Kéo thả hoặc chọn file (MP4, WebM, AVI, MOV, MKV — tối đa 500MB)
- **Chỉnh sửa video**: Cập nhật tiêu đề và mô tả video đã upload
- **Xóa video**: Xóa video cùng toàn bộ dữ liệu liên quan
- **Tải xuống video**: Download video ở chất lượng cao nhất có sẵn
- **Tìm kiếm video**: Tìm kiếm theo tiêu đề hoặc mô tả

### Phát Video (HLS Player)
- **Adaptive Bitrate Streaming (ABR)**: Tự động điều chỉnh chất lượng video theo tốc độ mạng
- **Hỗ trợ 6 mức chất lượng**: 360p, 480p, 720p, 1080p, 1440p (2K), 2160p (4K)
- **Chuyển đổi chất lượng thủ công**: Chọn chất lượng cụ thể hoặc chế độ Auto
- **Thống kê real-time**: Hiển thị chất lượng hiện tại, băng thông ước tính, buffer, segments đã tải

### Tối ưu Băng thông
- **HLS Segmentation**: Chia video thành các segment 6 giây
- **Multi-bitrate Transcoding**: FFmpeg chuyển đổi video sang nhiều mức chất lượng
- **Intelligent Caching**: Cache headers tối ưu cho segments và playlists
- **Bandwidth Tracking**: Theo dõi lượng băng thông sử dụng theo từng request

## Yêu cầu hệ thống

- **Node.js** >= 18
- **FFmpeg** (phải được cài đặt và có trong PATH)

### Cài đặt Node.js

1. Truy cập [https://nodejs.org](https://nodejs.org) và tải phiên bản **LTS** (khuyến nghị).
2. Chạy file cài đặt, chọn **Next** qua các bước và đảm bảo tích chọn **"Add to PATH"**.
3. Mở Terminal (hoặc PowerShell) và kiểm tra:
   ```bash
   node -v    # Hiển thị phiên bản Node.js, ví dụ: v20.11.1
   npm -v     # Hiển thị phiên bản npm, ví dụ: 10.2.4
   ```

### Cài đặt FFmpeg

**Cách 1 — Dùng winget (Windows 10/11):**
```bash
winget install Gyan.FFmpeg
```

**Cách 2 — Cài thủ công:**
1. Truy cập [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html) hoặc [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/).
2. Tải bản **ffmpeg-release-full** (file `.zip`).
3. Giải nén vào thư mục, ví dụ: `C:\ffmpeg`.
4. Thêm `C:\ffmpeg\bin` vào biến môi trường **PATH**:
   - Tìm kiếm **"Environment Variables"** trong Start Menu.
   - Chỉnh sửa biến **Path** của System → thêm dòng `C:\ffmpeg\bin`.
5. Mở Terminal mới và kiểm tra:
   ```bash
   ffmpeg -version   # Hiển thị thông tin phiên bản FFmpeg
   ```

## Cài đặt & Chạy dự án

```bash
# Bước 1: Cài đặt các thư viện cần thiết
npm install

# Bước 2: Khởi động server
npm start
```

Sau khi khởi động thành công, mở trình duyệt và truy cập: **http://localhost:3000**

### Sử dụng

1. **Trang chủ** (`/`): Xem danh sách video, tìm kiếm video.
2. **Upload** (`/upload.html`): Kéo thả hoặc chọn file video để upload. Hệ thống sẽ tự động transcode sang HLS multi-bitrate.
3. **Xem video** (`/player.html?id=...`): Phát video với HLS player, chọn chất lượng, xem thống kê streaming.
4. **Quản lý video**: Tại trang xem video, sử dụng các nút **Chỉnh sửa**, **Xóa**, **Tải xuống**.

## Cấu trúc dự án

```
VoD/
├── server.js                 # Express server chính
├── db.js                     # Khởi tạo SQLite database
├── package.json
│
├── services/
│   └── transcoder.js         # FFmpeg transcoding pipeline (HLS multi-bitrate)
│
├── middleware/
│   └── bandwidth.js          # Theo dõi băng thông & cache headers
│
├── routes/
│   ├── videos.js             # API: CRUD video, tải xuống
│   └── upload.js             # API: Upload & trạng thái transcoding
│
├── public/                   # Frontend
│   ├── index.html            # Trang chủ — danh sách video
│   ├── player.html           # Trình phát video HLS
│   ├── upload.html           # Trang upload video
│   ├── favicon.png           # Icon website
│   ├── css/
│   │   └── style.css         # Dark theme design system
│   └── js/
│       ├── app.js            # Logic trang chủ
│       ├── player.js         # HLS.js player + edit/delete/download
│       └── upload.js         # Logic upload & tracking
│
├── videos/                   # HLS segments & playlists (auto-generated)
├── uploads/                  # File tạm khi upload (auto-cleanup)
└── data/                     # SQLite database file
```

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/videos` | Danh sách video (hỗ trợ `?search=`, `?status=`, `?sort=`) |
| `GET` | `/api/videos/:id` | Chi tiết video (tự tăng lượt xem) |
| `PUT` | `/api/videos/:id` | Cập nhật tiêu đề & mô tả |
| `DELETE` | `/api/videos/:id` | Xóa video và toàn bộ file |
| `GET` | `/api/videos/:id/download` | Tải xuống video (chất lượng cao nhất) |
| `POST` | `/api/upload` | Upload video (multipart form-data) |
| `GET` | `/api/upload/status/:id` | Kiểm tra trạng thái transcoding |

## Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| Video Processing | FFmpeg (fluent-ffmpeg) |
| Streaming Protocol | HLS (HTTP Live Streaming) |
| Frontend Player | HLS.js |
| UI | Vanilla HTML/CSS/JS — Dark theme, Glassmorphism |

## Mức chất lượng Transcoding

| Chất lượng | Độ phân giải | Video Bitrate | Audio Bitrate |
|-----------|-------------|---------------|---------------|
| 360p | 640×360 | 800 Kbps | 96 Kbps |
| 480p | 854×480 | 1.4 Mbps | 128 Kbps |
| 720p | 1280×720 | 2.8 Mbps | 128 Kbps |
| 1080p | 1920×1080 | 5 Mbps | 192 Kbps |
| 1440p (2K) | 2560×1440 | 10 Mbps | 192 Kbps |
| 2160p (4K) | 3840×2160 | 20 Mbps | 256 Kbps |

> **Lưu ý:** Hệ thống chỉ transcode sang các mức chất lượng ≤ độ phân giải gốc của video upload. Ví dụ video 1080p sẽ không tạo phiên bản 2K hay 4K.
