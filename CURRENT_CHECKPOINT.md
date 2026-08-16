# 📌 CURRENT CHECKPOINT & TIẾP TỤC DỰ ÁN (HANDOVER RECORD)

> **MỤC ĐÍCH**: Đây là điểm lưu trữ trạng thái hiện tại của dự án **Hidden Music Vault**. Khi bạn mở phiên làm việc mới, bạn chỉ cần nói *"tiếp tục"* hoặc *"đang làm đến đâu rồi"*, AI sẽ đọc file này và tiếp tục hướng dẫn bạn chính xác từ bước này!

---

## 📍 TRẠNG THÁI HIỆN TẠI (CURRENT STATE)

1. **Dual Media Engine (Audio & MV Video Restored 100%)**:
   * Đã khôi phục toàn bộ giao diện **MV Video Stage**, chế độ xem Fullscreen tỉ lệ gốc (aspect ratio contain), phụ đề chạy chữ Gothic đồng bộ theo beat nhạc, cơ chế `video_offset` và nút bật/tắt MV mượt mà trên cả Mobile lẫn Desktop.
2. **Cloudflare R2 Object Storage & Worker Gateway (100% Tested & Verified)**:
   * Lưu trữ tệp âm thanh (MP3/FLAC/WAV) và MV Video (MP4) với **0 chi phí băng thông Egress**.
   * Hệ thống Direct S3 Presigned URL hỗ trợ tải lên file dung lượng lớn vượt qua giới hạn của Vercel Serverless.
   * Worker Gateway hỗ trợ RFC 7233 Range Requests (206 Partial Content) để tua nhạc/video tức thì.
3. **CI/CD & Git Integration**: Đã thiết lập GitHub Actions và kết nối remote repo `postlainmusic/hidden-music` trên nhánh `main`.

---

## 🎯 CÁC BƯỚC THỰC HIỆN KHI ĐĂNG BÀI

### 🔹 Bước 1: Cấu hình CORS Policy trên Cloudflare R2
Vào Cloudflare R2 > Bucket `hidden-music-vault` > Tab **Settings** > **CORS Policy** > Thêm:
```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

### 🔹 Bước 2: Đăng bài hát / MV trên `/admin`
* Vào trang `/admin` > Tạo Album hoặc mở Album hiện có.
* Tải nhạc MP3/FLAC hoặc Video MV MP4: Hệ thống tự động upload thẳng lên Cloudflare R2 và lưu vào CSDL!
