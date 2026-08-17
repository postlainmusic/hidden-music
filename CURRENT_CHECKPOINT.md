# 📌 CURRENT CHECKPOINT & TIẾP TỤC DỰ ÁN (HANDOVER RECORD)

> **MỤC ĐÍCH**: Đây là điểm lưu trữ trạng thái hiện tại của dự án **Hidden Music Vault** (`postlain.com`). Khi bạn mở phiên làm việc mới, bạn chỉ cần nói *"tiếp tục"* hoặc *"đang làm đến đâu rồi"*, AI sẽ đọc file này và tiếp tục hướng dẫn bạn chính xác từ bước này!

---

## 📍 TRẠNG THÁI HIỆN TẠI (CURRENT STATE - NÂNG CẤP TOÀN DIỆN 4 BƯỚC)

1. **Hono Backend API & Cloudflare Worker Gateway (`worker/index.ts` & `wrangler.toml`)**:
   * Hỗ trợ chuẩn **RFC 7233 Byte-Range Requests (HTTP 206 Partial Content)** kết nối trực tiếp R2 Bucket `hidden-music-vault` qua `env.BUCKET`.
   * Endpoint `/api/upload/presign` tạo AWS S3 SigV4 Presigned PUT URL để Client upload file FLAC/WAV/MP4 dung lượng không giới hạn thẳng lên R2.
   * Endpoint `/api/tracks` và `/api/albums` kết nối Supabase Edge REST API có gắn Edge Caching (`stale-while-revalidate`).
   * HMAC-SHA256 Expiring Stream Token (`/api/sign-stream`) bảo vệ các bản ghi độc quyền / private.

2. **Astro + Persistent React Island Engine (`src/layouts/RootLayout.astro`, `astro.config.mjs`)**:
   * Tích hợp **Astro View Transitions (`<ClientRouter />`)** cho phép chuyển trang tức thì < 50ms mà không reload trang.
   * Cài đặt **Persistent Audio Island (`GlobalPlayerIsland.tsx` với `transition:persist`)** giữ nguyên 100% nhạc/video đang phát khi duyệt album.
   * Bảo toàn 100% hệ thống giao diện Pure Monochrome B&W, CRT Scanlines, TV Grain Overlay và bộ font Gotham & DFVN Grafika.

3. **Three.js & Mobile Performance Tối Ưu Triệt Để (`VaultPillar3D.tsx`, `VaultScene.tsx`)**:
   * Khóa Clamped `devicePixelRatio` ($\le 1.5$ trên Mobile, $\le 2.0$ trên Desktop), triệt tiêu hiện tượng lag giật và tụt pin trên màn hình Retina/OLED di động.
   * Tích hợp Off-screen Culling và `requestAnimationFrame` debouncing trên toàn bộ sự kiện con trỏ và cảm ứng.

4. **Đa Nền Tảng PWA + Capacitor Android Background Playback (`manifest.webmanifest`, `sw.js`, `PlayerContext.tsx`)**:
   * PWA Manifest chuẩn Web Standalone (`display: standalone`, Dark theme `#000000`).
   * Service Worker (`public/sw.js`) cache App Shell và bỏ qua bypass các luồng Range Stream 206.
   * Tích hợp đầy đủ **MediaSession API** (metadata, lockscreen controls, `seekto`, `seekbackward`, `seekforward`, `setPositionState`, `playbackState`) giúp phát nhạc nền liên tục khi tắt màn hình điện thoại.
   * File cấu hình Capacitor (`capacitor.config.json`) sẵn sàng build Native Android APK.

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
      "Content-Type",
      "Content-Range",
      "Accept-Ranges"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

### 🔹 Bước 2: Đăng bài hát / MV trên `/admin`
* Vào trang `/admin` > Tạo Album hoặc mở Album hiện có.
* Tải nhạc MP3/FLAC hoặc Video MV MP4: Hệ thống tự động upload thẳng lên Cloudflare R2 và lưu vào CSDL!
