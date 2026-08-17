# 🌐 hiddenmusic-api (Cloudflare Workers + Hono.js)

High-Performance Edge API Gateway & Zero-Buffering Audio Streaming Service for **Hidden Music Vault** (`postlain.com`).

---

## ⚡️ Tính năng chính
1. **Zero-Buffering R2 Streaming (`/stream/:key+`)**:
   * Tương thích chuẩn RFC 7233 HTTP 206 Partial Content Range requests.
   * Truyền thẳng `ReadableStream` với độ trễ phát nhạc < 1s.
2. **YouTube Music Gateway (`/yt/search`, `/yt/stream/:videoId`)**:
   * Tìm kiếm thông tin và ảnh bìa bài hát toàn cầu.
   * Tự động giải mã stream âm thanh chất lượng cao và chuyển hướng 302 trực tiếp tới Google Video CDN.
3. **Database Metadata Cache (`/albums`, `/tracks`)**:
   * Tích hợp Supabase REST API với Edge cache headers `stale-while-revalidate`.
4. **CORS Middleware**: Mở quyền cho `https://postlain.com` và `http://localhost:4321`.

---

## 🚀 Hướng dẫn Chạy & Triển khai

### 1. Cài đặt Dependencies:
```bash
npm install
```

### 2. Chạy Local Development:
```bash
npm run dev
# Server lắng nghe tại http://localhost:8787
```

### 3. Deploy lên Cloudflare Workers:
```bash
npm run deploy
```
