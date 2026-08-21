# 🧠 HIDDEN MUSIC VAULT - AGENT & WORKSPACE INSTRUCTIONS

> **MỤC ĐÍCH**: File này là kim chỉ nam cho tất cả các Agent/AI khi làm việc trong repository **Hidden Music Vault** (POSTLAIN). Mọi AI agent bắt buộc phải tuân thủ nghiêm ngặt các quy tắc thiết kế, cấu trúc dữ liệu và quy trình kiểm thử bên dưới.

---

## 🎯 1. NGUYÊN TẮC CỐT LÕI (CORE INVARIANTS — KHÔNG ĐƯỢC PHẠM)

1. **Phân Tách Tuyệt Đối Audio Zone & Video Zone**:
   - Audio Zone (`activeZone === 'audio'`) và Video Zone (`activeZone === 'video'`) là 2 không gian phát độc lập với vòng đời bộ nhớ tách biệt.
   - **TUYỆT ĐỐI KHÔNG** gộp chung hoặc điều khiển đè lên nhau.
   - Khi ở Video Zone, `GlobalPlayerBar` PHẢI ở chế độ **Minimal State** (chỉ hiển thị tiêu đề và nút chuyển đổi, không render thanh tua hay nút play/pause trùng lặp).
2. **Pure Monochrome Cyber-Aesthetic (POSTLAIN Brand)**:
   - Giao diện sử dụng tone màu đen sâu (`#000000`, `#07070a`), trắng (`#ffffff`), và các sắc thái `zinc-900`/`zinc-800` với viền `border-white/15`.
   - **TUYỆT ĐỐI KHÔNG** dùng các màu neon sặc sỡ cho UI nền hoặc nút bấm.
   - **Ảnh bìa Album (Cover Art)**: Luôn giữ nguyên 100% màu sắc thực tế nguyên bản của tác phẩm nghệ thuật.
3. **100% Thuần Web Application**:
   - Sử dụng các Web API chuẩn (`navigator.mediaSession`, `document.pictureInPictureElement`, `document.requestFullscreen`, `crypto.subtle`).
   - **TUYỆT ĐỐI KHÔNG** thêm các cấu hình hay thư viện Native APK (Capacitor, TWA, Cordova).
4. **Kỷ Luật Import Lucide Icons**:
   - Mọi icon JSX `<IconName ... />` sử dụng trong component BẮT BUỘC phải được khai báo trong `import { IconName, ... } from 'lucide-react'`.
   - Thiếu import icon sẽ gây lỗi sập toàn bộ ứng dụng (`ReferenceError: IconName is not defined`).
5. **Đồng Nhất Môi Trường Local & GitHub Actions (Cross-Platform CI/CD Parity)**:
   - Môi trường phát triển cục bộ (Windows x64) và máy chủ GitHub Actions CI/CD (`ubuntu-latest` / Linux x64) phải luôn tương thích 100%.
   - **TUYỆT ĐỐI KHÔNG** khai báo các gói binary ràng buộc hệ điều hành (ví dụ `@next/swc-win32-*`, `@next/swc-darwin-*`) trong `dependencies`/`devDependencies` của `package.json` để tránh lỗi `EBADPLATFORM` trên máy chủ Linux.
6. **Tuyệt Đối Cấm Can Thiệp `createMediaElementSource` Vào Thẻ Audio Chính (CORS Audio-Silencing Invariant)**:
   - Thẻ `<audio>` chính (`audioRef.current`) PHẢI luôn phát trực tiếp ra phần cứng loa để đảm bảo 100% người dùng luôn nghe thấy âm thanh.
   - **TUYỆT ĐỐI KHÔNG** gọi `createMediaElementSource(audioRef.current)` vì trình duyệt sẽ tự động ngắt tiếng hoàn toàn (`MediaElementAudioSource outputs zeroes due to CORS access restrictions`) khi stream nhạc từ CDN ngoài (`media.postlain.com`, YouTube Music, Cloudflare R2).
   - Mọi hoạt ảnh Visualizer, Beat Detection, Dynamic Glow, Strobe và Physics PHẢI sử dụng dữ liệu trích xuất từ `MeydaEngine` kết hợp pre-computed deterministic buckets (`waveformBuckets`) và `subscribeToTimeUpdate` để đạt 120 FPS mượt mà không bao giờ can thiệp vào luồng phát âm thanh trực tiếp.

---

## ⚙️ 2. QUY TRÌNH THỰC THI 4 BƯỚC BẮT BUỘC (EVERY TASK LIFECYCLE)

Mỗi khi nhận yêu cầu sửa đổi, thêm tính năng hoặc fix bug, Agent PHẢI thực hiện đủ 4 bước tuần tự:

```
  ┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
  │ 1. PRE-FLIGHT CHECK  │ ───► │ 2. CODE EXECUTION    │ ───► │ 3. BUILD VERIFY      │ ───► │ 4. LOG & GIT PUSH    │
  │ • Đọc PROJECT_BRAIN  │      │ • Viết code 100% full│      │ • Kiểm tra Types     │      │ • Update CHECKPOINT  │
  │ • Check Invariants   │      │ • Không dùng snippet │      │ • Check icon imports │      │ • Append SYSTEM_LOG  │
  │ • Check Icon Imports │      │ • Giữ styling chuẩn  │      │ • Edge runtime check │      │ • Commit & Push git  │
  └──────────────────────┘      └──────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

### Bước 1: Pre-flight Check (Kiểm tra Ngữ cảnh & Ràng buộc)
- Đọc [PROJECT_BRAIN.md](file:///c:/Users/Admin/Documents/GitHub/hidden-music/PROJECT_BRAIN.md), [CURRENT_CHECKPOINT.md](file:///c:/Users/Admin/Documents/GitHub/hidden-music/CURRENT_CHECKPOINT.md) và [SYSTEM_LOG.md](file:///c:/Users/Admin/Documents/GitHub/hidden-music/SYSTEM_LOG.md).
- Kiểm tra danh sách import để không bỏ sót dependency hoặc icon.

### Bước 2: Code Execution (Viết Code Đầy Đủ & Chuẩn Xác)
- Xuất toàn bộ mã nguồn hoàn chỉnh (100% complete file). **Không bao giờ dùng comment rút gọn như `// ... existing code`**.
- Tuân thủ TypeScript types trong [`src/types/database.ts`](file:///c:/Users/Admin/Documents/GitHub/hidden-music/src/types/database.ts).
- Các page/route mới cần khai báo `export const runtime = 'edge';` và `export const dynamic = 'force-dynamic';` để tương thích hoàn toàn với Cloudflare Pages.

### Bước 3: Verification & Integrity Check (Kiểm tra Tính Toàn Vẹn)
- Rà soát syntax, responsive breakpoints trên cả Desktop và Mobile.
- Đảm bảo cơ chế bảo vệ phiên đăng nhập và MediaSession hoạt động chính xác.

### Bước 4: Post-flight Update, Logging & Deploy
- Cập nhật tệp [CURRENT_CHECKPOINT.md](file:///c:/Users/Admin/Documents/GitHub/hidden-music/CURRENT_CHECKPOINT.md) với trạng thái mới nhất.
- Ghi nhận nhật ký thay đổi vào [SYSTEM_LOG.md](file:///c:/Users/Admin/Documents/GitHub/hidden-music/SYSTEM_LOG.md).
- Tạo commit theo chuẩn Conventional Commits (`feat: ...`, `fix: ...`, `refactor: ...`, `perf: ...`, `ci: ...`).
- Push code lên nhánh `main` để GitHub Actions CI/CD tự động build & deploy.

---

## 🗄️ 3. SUPABASE & DATABASE SCHEMA CONTEXT

* **Project Ref**: `muemwfqynfljpmvxmpep`
* **URL**: `https://muemwfqynfljpmvxmpep.supabase.co`
* **Database Tables**:
  * `public.profiles`: Quản lý tài khoản, `role` (`user` | `admin`), `plan` (`free` | `vip` | `premium`), `has_video_subscription`.
  * `public.albums`: Thư mục đĩa Album (id, title, artist, original_year, cover_url, is_published).
  * `public.tracks`: Từng bài hát / MV bên trong Album (id, album_id, title, media_type, audio_url, video_url, cover_url, lyrics, duration).
  * `public.vouchers`: Quản lý mã kích hoạt gói VIP (id, code, plan_type, max_uses, used_count, is_active).
* **Storage Buckets**: `audio-files` (lossless audio/video stream), `cover-arts` (high-res artwork).

---

## 📸 4. QUY CHUẨN KIỂM TOÁN HÌNH ẢNH & ĐÓNG BĂNG BỘ NHỚ (VISUAL VERIFICATION & MEMORY PROTOCOL)

1. **Sau mỗi lần sửa đổi code (Post-Edit Verification)**:
   - Chụp ảnh màn hình giao diện đã sửa và lưu vào thư mục `screenshots/` theo cú pháp:
     `screenshots/PENDING_[FEATURE_NAME]_[YYYYMMDD_HHMM].png`
   - Báo cáo tóm tắt cho người dùng kèm đường dẫn chính xác của tệp ảnh để người dùng xem xét.
2. **Khi người dùng phê duyệt ("Duyệt [FEATURE_NAME]")**:
   - Di chuyển và đổi tên tệp ảnh từ `screenshots/` sang `memory/`:
     `memory/APPROVED_[FEATURE_NAME].png`
   - Đóng băng các thông số CSS & Layout vào mục `## Visual Memory & UI Invariants` trong `PROJECT_BRAIN.md`.
   - Ghi nhận sự kiện phê duyệt vào `SYSTEM_LOG.md`.

