# VoD Streaming Platform

Website chia sẻ video tối ưu hóa băng thông sử dụng giao thức Video-on-Demand (VoD) với HLS Adaptive Bitrate Streaming.

## Chức năng

### 👤 Xác thực & Người dùng
- **Đăng ký / Đăng nhập**: Quản lý tài khoản người dùng với mã hóa mật khẩu bảo mật (Bcrypt) và JWT.
- **Phân quyền**: Hỗ trợ role `user` và `admin`.
- **Bảo mật**: Các route cần thiết đều được bảo vệ bằng Middleware xác thực JWT.

### 🛡️ Quản trị viên (Admin)
- **Quản lý người dùng**: Xem danh sách người dùng, số lượng video, xóa tài khoản (tự động xóa toàn bộ video của họ).
- **Quản lý toàn bộ video**: Xem danh sách và trạng thái tất cả video trên hệ thống.

### 🎬 Quản lý Video
- **Upload video**: Hỗ trợ kéo thả (MP4, WebM, AVI, MOV, MKV — tối đa 500MB). Trạng thái tiến trình transcode trực tiếp.
- **Chỉnh sửa video**: Cập nhật tiêu đề, mô tả, trạng thái (Công khai/Riêng tư).
- **Trình quản lý cá nhân (Dashboard)**: Nơi người dùng quản lý các video đã đăng tải.
- **Xóa video**: Xóa video hoàn toàn khỏi CSDL và server ổ cứng.
- **Tải xuống video**: Tải video ở định dạng MP4 nguyên gốc.
- **Tìm kiếm**: Tìm kiếm theo tiêu đề hoặc mô tả trên kho video chung.

### ⚡ Phát Video (HLS Player)
- **Adaptive Bitrate Streaming (ABR)**: Tự động điều chỉnh chất lượng video tùy theo tốc độ đường truyền.
- **Hỗ trợ 6 mức chất lượng**: 360p, 480p, 720p, 1080p, 1440p (2K), 2160p (4K).
- **Chuyển đổi thủ công**: User có thể chọn chất lượng tĩnh hoặc chế độ Auto.
- **Thống kê real-time**: Biểu đồ phân tích chất lượng hiện tại, băng thông ước tính, buffer size.

### 🚀 Tối ưu Hệ thống
- **HLS Segmentation**: Tự động chia video thành các segment 6 giây.
- **Multi-bitrate Transcoding**: Tự sinh các tệp playlist riêng cho nhiều băng thông mạng khác nhau.
- **Intelligent Caching**: Cache headers tối ưu cho giao thức HLS.
- **Bandwidth Tracking**: Lưu trữ và log lượng băng thông tiêu thụ trên mỗi phiên xem video.

## Yêu cầu hệ thống
- **Node.js** >= 18
- **FFmpeg** (phải được cài đặt và thêm báo vào PATH)

## Cài đặt hệ thống

### 1. Cài đặt FFmpeg
**Trên Windows (Sử dụng Winget):**
```bash
winget install Gyan.FFmpeg
```

**Hoặc cài đặt thủ công:** Tải bản Release từ [ffmpeg.org](https://ffmpeg.org/download.html), giải nén và thêm thư mục `bin` vào biến môi trường `PATH`.

### 2. Cài đặt & Chạy dự án
```bash
# Clone source code
git clone https://github.com/HuuNgoc-2k4/VoD.git

# Di chuyển vào thư mục
cd VoD

# Cài đặt thư viện NodeJS
npm install

# Khởi chạy server
npm start
# Hoặc npm run dev (dành cho quá trình phát triển)
```

Truy cập trang Frontend tại: **http://localhost:3000**

## Cấu trúc dự án

```
VoD/
├── server.js                 # Express server chính
├── db.js                     # Khởi tạo SQLite database (bảng: users, videos, bandwidth_logs)
├── middleware/               # Auth middleware (JWT) & Bandwidth tracker
├── routes/                   # API logic (auth, admin, videos, upload)
├── services/                 # FFmpeg Transcoder service xử lý HLS
├── public/                   # Website Client (CSS, JS, HLS.js, Dark Theme UI)
└── data/, videos/, uploads/  # Thư mục dữ liệu tĩnh & video tự sinh (Không theo dõi trên Git)
```

## Công nghệ sử dụng
- **Backend:** Node.js, Express.js
- **Database:** SQLite (better-sqlite3)
- **Video Processing:** FFmpeg (fluent-ffmpeg)
- **Streaming Protocol:** HLS (HTTP Live Streaming)
- **Authentication:** JWT (jsonwebtoken), BcryptJS
- **Frontend Plugin:** HLS.js
