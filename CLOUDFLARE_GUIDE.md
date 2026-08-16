# 🚀 Cloudflare R2 Ecosystem & Worker Gateway Guide - Hidden Music Vault

Tài liệu hướng dẫn triển khai toàn diện hệ sinh thái **Cloudflare R2 + Cloudflare Worker Gateway** cho dự án **Hidden Music Vault**.

---

## 🏗 1. Kiến Trúc Hệ Thống (System Architecture)

```
[ Client / Browser Player ]
        │
        ├──────────────────────────────────────────────────────┐
        ▼ (Range: bytes=start-end)                              ▼ (Cover Art ?w=300)
[ Cloudflare Worker Gateway ] ──────────────────► [ Cloudflare Edge CDN Caching ]
        │ (206 Partial / Signed Token Verify)                   │ (Cache-Control: immutable)
        ▼                                                       ▼
[ Cloudflare R2 Bucket: `hidden-music-vault` ] ◄────────────────┘
        │
        ▼ (Metadata: Title, Lyrics, Duration, R2 URL)
[ Supabase PostgreSQL DB: `albums` & `tracks` ]
```

### ✨ Các Tính Năng Đã Được Hiện Thực:
1. **RFC 7233 Byte-Range Requests**:
   * Trả về mã phản hồi `206 Partial Content`, header `Content-Range: bytes start-end/total` và `Accept-Ranges: bytes`.
   * Cho phép audio player tua nhạc (seeking) tức thì và đệm từng chunk (buffering) mượt mà mà không phải tải lại toàn bộ file.
2. **HMAC-SHA256 Expiring Stream Tokens**:
   * Bảo vệ các bản nhạc độc quyền hoặc bản ghi riêng tư qua URL ký sẵn: `?token=<hmac_sha256>&expires=<timestamp>`.
   * Tự động từ chối truy cập trái phép (`403 Forbidden`) khi token sai hoặc quá hạn.
3. **Dynamic Cover Art Transformation & WebP/AVIF Negotiation**:
   * Tự động tối ưu hóa ảnh bìa qua query params `?w=300&q=80&fmt=webp` và lưu cache 7 ngày tại Cloudflare Edge CDN.
4. **Direct Presigned S3 PUT URL Upload**:
   * Cho phép tải lên tệp âm thanh lossless (FLAC, WAV, MP3 320kbps) kích thước không giới hạn trực tiếp từ Client lên Cloudflare R2, vượt qua giới hạn 4.5MB của Vercel Serverless.

---

## ⚙️ 2. Hướng Dẫn Triển Khai Cloudflare Worker (`hidden-music-vault-gateway`)

### 🔹 Bước 1: Cài đặt Dependencies cho Worker
Tại thư mục dự án, chạy lệnh:
```bash
npm install -D wrangler @cloudflare/workers-types
```

### 🔹 Bước 2: Đăng nhập Cloudflare CLI
```bash
npx wrangler login
```
*(Trình duyệt sẽ mở ra để bạn chọn tài khoản Cloudflare và cấp quyền).*

### 🔹 Bước 3: Kiểm tra cấu hình `wrangler.toml`
File [`wrangler.toml`](file:///c:/Users/Admin/Documents/hidden-music/wrangler.toml) đã được thiết lập sẵn:
```toml
name = "hidden-music-vault-gateway"
main = "worker/index.ts"
compatibility_date = "2024-04-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "hidden-music-vault"
preview_bucket_name = "hidden-music-vault"

[vars]
ALLOWED_ORIGINS = "*"
PUBLIC_URL = "https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev"
STREAM_SECRET_KEY = "vault-stream-secret-key-prod-2026"
```

### 🔹 Bước 4: Deploy Worker lên Cloudflare
Chạy lệnh deploy:
```bash
npx wrangler deploy
```
Sau khi hoàn tất, bạn sẽ nhận được một địa chỉ URL Worker Gateway dạng:
```
https://hidden-music-vault-gateway.<your-subdomain>.workers.dev
```

---

## 🌐 3. Cấu Hình Custom Domain & Biến Môi Trường (Tùy Chọn)

### A. Gán Custom Domain trên Cloudflare Dashboard (Khuyên dùng)
1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/) > Vào mục **Workers & Pages**.
2. Chọn Worker **`hidden-music-vault-gateway`** > Chọn tab **Settings** > **Triggers & Domains** (hoặc **Custom Domains**).
3. Bấm **Add Custom Domain** và nhập domain mong muốn (vd: `stream.yourdomain.com`).

### B. Cấu hình biến môi trường trên Vercel / Next.js
Thêm biến sau vào file `.env.local` và trên **Vercel Project Settings > Environment Variables**:
```env
NEXT_PUBLIC_CLOUDFLARE_WORKER_URL=https://hidden-music-vault-gateway.<your-subdomain>.workers.dev
STREAM_SECRET_KEY=vault-stream-secret-key-prod-2026
```

---

## 🛠 4. Thư Viện Tiện Ích Code

* **Worker Gateway Source**: [`worker/index.ts`](file:///c:/Users/Admin/Documents/hidden-music/worker/index.ts)
* **Storage & Token Helper**: [`src/lib/r2Storage.ts`](file:///c:/Users/Admin/Documents/hidden-music/src/lib/r2Storage.ts)
* **Audio Player Component**: [`src/components/AudioPlayer.tsx`](file:///c:/Users/Admin/Documents/hidden-music/src/components/AudioPlayer.tsx)
* **Wrangler Config**: [`wrangler.toml`](file:///c:/Users/Admin/Documents/hidden-music/wrangler.toml)

### Ví dụ sử dụng trong mã nguồn:
```typescript
import { getMediaCdnUrl, getCoverCdnUrl, generateSignedStreamUrl } from '@/lib/r2Storage';

// 1. Lấy link stream audio hỗ trợ Range Requests 206
const audioUrl = getMediaCdnUrl('audio/01_elegie.flac');

// 2. Lấy link stream bảo mật với Token HMAC có hạn sử dụng (vd: 2 giờ)
const secureAudioUrl = generateSignedStreamUrl('audio/exclusive_track.flac', 7200);

// 3. Lấy ảnh bìa tối ưu hóa kích thước & WebP tự động
const coverUrl = getCoverCdnUrl('covers/hvl_cover.jpg', { width: 300, quality: 80 });
```
