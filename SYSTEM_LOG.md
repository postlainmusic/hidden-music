# 📜 HIDDEN MUSIC VAULT - SYSTEM LOG (APPEND-ONLY TRANSACTION LEDGER)

> **MỤC ĐÍCH**: Đây là sổ cái ghi nhận lịch sử giao dịch kiến trúc, chi tiết các lần chỉnh sửa code, nguyên nhân gốc rễ (Root Cause) của các lỗi từng gặp và bài học kinh nghiệm để ngăn ngừa tái diễn.

---

## 📑 MỤC LỤC GIAO DỊCH GẦN NHẤT

- [Giao dịch 001: Technical Debt Removal & PWA/Capacitor Cleanup](#giao-dịch-001-technical-debt-removal--pwacapacitor-cleanup)
- [Giao dịch 002: Multimedia Super App Scaling (Video Engine, Telemetry, Discovery)](#giao-dịch-002-multimedia-super-app-scaling-video-engine-telemetry-discovery)
- [Giao dịch 003: Fix Cloudflare Pages Build / Edge Runtime (`bc3c201`)](#giao-dịch-003-fix-cloudflare-pages-build--edge-runtime-bc3c201)
- [Giao dịch 004: Fix Crash `ReferenceError: Sparkles is not defined` (`4515766`)](#giao-dịch-004-fix-crash-referenceerror-sparkles-is-not-defined-4515766)
- [Giao dịch 005: Optimize CI/CD Pipeline with Dual-Layer Caching (`09bb9c5`)](#giao-dịch-005-optimize-cicd-pipeline-with-dual-layer-caching-09bb9c5)
- [Giao dịch 006: Minimal Player in Video Zone & Desktop Drawer Redesign (`8e9ed02`)](#giao-dịch-006-minimal-player-in-video-zone--desktop-drawer-redesign-8e9ed02)
- [Giao dịch 007: Comprehensive Deep Code Audit & Verification of Items 2 to 9](#giao-dịch-007-comprehensive-deep-code-audit--verification-of-items-2-to-9)
- [Giao dịch 008: Playbar Cleanup, Footer Spacing & Discovery Feed Revamp](#giao-dịch-008-playbar-cleanup-footer-spacing--discovery-feed-revamp)
- [Giao dịch 009: Unified Expandable Bottom Sheet Refactor (`GlobalPlayerBar.tsx`)](#giao-dịch-009-unified-expandable-bottom-sheet-refactor-globalplayerbartsx)
- [Giao dịch 010: Decoupled Two-Layer Drawer & Static Dock Architecture (`GlobalPlayerBar.tsx`)](#giao-dịch-010-decoupled-two-layer-drawer--static-dock-architecture-globalplayerbartsx)

---

## 🔍 GIAO DỊCH CHI TIẾT

### Giao dịch 001: Technical Debt Removal & PWA/Capacitor Cleanup
* **Thời gian**: 19/08/2026 15:20
* **Tệp đã xóa**: `capacitor.config.json`, `twa-manifest.json`, `deploy.bat`, `deploy.ps1`, `worker/`, `.github/workflows/build-apk.yml`.
* **Tệp đã sửa**: `package.json`, `next.config.mjs`.
* **Mục đích**: Loại bỏ hoàn toàn các cấu hình thử nghiệm Native APK, đưa ứng dụng về kiến trúc Next.js thuần Web hiệu năng cao.
* **Xác thực**: Không còn mã trung gian Android / Capacitor, build bundle sạch và nhẹ hơn.

---

### Giao dịch 002: Multimedia Super App Scaling (Video Engine, Telemetry, Discovery)
* **Thời gian**: 19/08/2026 15:30
* **Commit**: [`18116c5`](https://github.com/postlainmusic/hidden-music/commit/18116c5)
* **Tệp đã tạo**:
  - `src/components/video/PremiumVideoPlayer.tsx`
  - `src/components/video/PaywallOverlay.tsx`
  - `src/components/discovery/DiscoveryFeed.tsx`
  - `src/app/discover/page.tsx`
  - `src/hooks/useTelemetry.ts`
  - `src/app/api/telemetry/route.ts`
* **Tệp đã sửa**: `src/context/PlayerContext.tsx`, `src/components/ui/GlobalPlayerBar.tsx`, `src/components/ui/Navbar.tsx`.
* **Mục đích**: Mở rộng hệ sinh thái ứng dụng sang phát video 4K MV độc lập, đề xuất nội dung khám phá và thu thập tín hiệu người dùng.

---

### Giao dịch 003: Fix Cloudflare Pages Build / Edge Runtime (`bc3c201`)
* **Thời gian**: 19/08/2026 15:36
* **Commit**: [`bc3c201`](https://github.com/postlainmusic/hidden-music/commit/bc3c201)
* **Tệp đã sửa**: `src/app/legal/page.tsx`, `src/app/profile/page.tsx`, `src/app/settings/page.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/metadata/page.tsx`, `src/app/admin/page.tsx`, `src/app/discover/page.tsx`, `src/app/page.tsx`, `src/app/api/telemetry/route.ts`.
* **Triệu chứng lỗi (Regression)**: GitHub Actions CI build fail tại bước `npx @cloudflare/next-on-pages` với lỗi: `Export encountered errors on following paths: /legal, /profile, /settings`.
* **Nguyên nhân gốc rễ (Root Cause)**:
  - `@cloudflare/next-on-pages` mặc định cố gắng Static Prerender (SSG) các trang chứa Client Hooks (`useRouter`, `localStorage`, `usePlayer`) trong môi trường Node/Edge.
  - `/api/telemetry` khai báo nhầm `runtime = 'nodejs'`.
* **Giải pháp & Phòng ngừa**: Thêm `export const runtime = 'edge';` và `export const dynamic = 'force-dynamic';` cho toàn bộ các trang và route handlers.

---

### Giao dịch 004: Fix Crash `ReferenceError: Sparkles is not defined` (`4515766`)
* **Thời gian**: 19/08/2026 15:39
* **Commit**: [`4515766`](https://github.com/postlainmusic/hidden-music/commit/4515766)
* **Tệp đã sửa**: `src/components/ui/Navbar.tsx`.
* **Triệu chứng lỗi (Regression)**: Trang web báo lỗi Client-side Exception: `ReferenceError: Sparkles is not defined` khi render trang chủ hoặc trang album.
* **Nguyên nhân gốc rễ (Root Cause)**: Khi thêm nút Discovery Feed vào `Navbar.tsx`, JSX sử dụng `<Sparkles className="w-3.5 h-3.5" />` nhưng ở đầu file chưa import `Sparkles` từ `lucide-react`.
* **Giải pháp & Phòng ngừa**: Bổ sung `Sparkles` vào import `lucide-react`. Đưa quy tắc "Kiểm tra import icon trước khi render JSX" thành **Invariant bắt buộc** trong `PROJECT_BRAIN.md` và `AGENTS.md`.

---

### Giao dịch 005: Optimize CI/CD Pipeline with Dual-Layer Caching (`09bb9c5`)
* **Thời gian**: 19/08/2026 15:46
* **Commit**: [`09bb9c5`](https://github.com/postlainmusic/hidden-music/commit/09bb9c5)
* **Tệp đã sửa**: `.github/workflows/deploy.yml`, xóa `wrangler.toml`.
* **Mục đích**: Tối ưu hóa thời gian build CI trên GitHub Actions.
* **Giải pháp**:
  - Cấu hình `actions/setup-node@v4` với `cache: 'npm'`.
  - Thêm bước `actions/cache@v4` lưu trữ `.next/cache` và `.vercel/cache` dựa trên hash của dependencies và source code.
  - Sử dụng cờ `npm install --prefer-offline --no-audit --legacy-peer-deps`.

---

### Giao dịch 006: Minimal Player in Video Zone & Desktop Drawer Redesign (`8e9ed02`)
* **Thời gian**: 19/08/2026 15:53
* **Commit**: [`8e9ed02`](https://github.com/postlainmusic/hidden-music/commit/8e9ed02)
* **Tệp đã sửa**: `src/components/ui/GlobalPlayerBar.tsx`.
* **Vấn đề đã giải quyết**:
  1. **Bug 1 (Duplicate Controls in Video Zone)**: Khi `activeZone === 'video'`, GlobalPlayerBar thu gọn thành capsule tối giản (chỉ hiển thị Tiêu đề, Artist và Master Switcher `[ ÂM THANH | VIDEO MV ]`), ẩn toàn bộ audio seekbar và nút play/pause audio.
  2. **Bug 2 (Awkward Desktop Drawer Overlap)**: Tái thiết kế ngăn kéo Lời bài hát & Danh sách phát trên Desktop thành dock gắn liền phía trên thanh player (`w-full max-w-4xl`, `h-[220px] sm:h-[260px]`, `rounded-t-2xl`, glassmorphism) không còn che khuất đĩa 3D Monolith.

---

### Giao dịch 007: Comprehensive Deep Code Audit & Verification of Items 2 to 9
* **Thời gian**: 19/08/2026 16:06
* **Mục đích**: Hoàn thành toàn diện 9 hạng mục kiểm toán thông qua phân tích chuyên sâu mã nguồn (Deep Source Code Inspection) và kiểm tra tính toàn vẹn cú pháp/AST.
* **Kết quả xác thực**:
  - **Mục 2 & 7**: Admin authentication & role gating (`src/lib/authSession.ts`, `src/app/admin/page.tsx`, `AdminUserManagement.tsx`, `AdminVoucherManagement.tsx`) bảo vệ an toàn các quyền `role === 'admin'`, `has_video_subscription`, `is_video_paid`.
  - **Mục 3 & 4**: 3D Monolith & Vinyl (`VaultScene.tsx`, `VaultPillar3D.tsx`) giữ nguyên độ sắc nét của cover art gốc, cập nhật 60FPS timeline trực tiếp trên DOM node và bộ tách lời LRC hoạt động ổn định.
  - **Mục 5**: Discovery Feed (`DiscoveryFeed.tsx`, `/discover/page.tsx`) tích hợp mượt mà các swimlanes và telemetry event tracking (`useTelemetry.ts`).
  - **Mục 6**: Phân tách triệt để Audio/Video Zone (`GlobalPlayerBar.tsx` dòng 365-420, `PremiumVideoPlayer.tsx`).
  - **Mục 8 & 9**: Quét kiểm tra toàn diện 100% các icon JSX `<IconName>` trong toàn bộ thư mục `src/`, xác nhận không có icon nào bị thiếu import.

---

### Giao dịch 008: Playbar Cleanup, Footer Spacing & Discovery Feed Revamp
* **Thời gian**: 19/08/2026 16:15
* **Tệp đã sửa**: `src/components/ui/GlobalPlayerBar.tsx`, `src/components/discovery/DiscoveryFeed.tsx`, `src/context/PlayerContext.tsx`.
* **Vấn đề & Thay đổi**:
  1. **GlobalPlayerBar Cleanup**:
     - Loại bỏ hoàn toàn nút chuyển đổi `[ ÂM THANH | MV 4K ]` khỏi layout.
     - Thiết lập tự động ẩn hoàn toàn (`if (activeZone === 'video') return null;`) khi ở Video Zone.
     - Nâng vị trí thanh player lên `bottom-8 sm:bottom-10` nổi nhẹ nhàng phía trên dòng cyber footer.
     - Thiết kế giao diện **Fullscreen Immersive Lyrics** (Cover art/Meta bên trái, dòng lyrics phát sáng bên phải với tương tác tua dòng).
     - Thiết kế giao diện **Right-Side Slide-in Queue Drawer** (`w-full sm:w-[420px]` trượt từ cạnh phải màn hình) không che khuất đĩa than 3D bên trái.
  2. **Discovery Feed Revamp**:
     - Thanh bộ lọc Sticky Category Pills (`ALL`, `AI CURATED`, `EXCLUSIVE MVS`, `LOSSLESS AUDIO`).
     - 3 swimlane phân loại: *AI Deep Resonance Mix* (điểm cộng hưởng AI % MATCH), *Trending 4K Vault Exclusives* (Banner 16:9 4K UHD), *Underground Rarities* (Lossless 24-bit).
     - Tương tác thẻ trực tiếp: Quick Play, Add to Queue (`+`), Like (`Heart` -> `useTelemetry`).
  3. **PlayerContext Expansion**:
     - Bổ sung `addToQueue(track)` vào interface và provider context.

---

### Giao dịch 009: Unified Expandable Bottom Sheet Refactor (`GlobalPlayerBar.tsx`)
* **Thời gian**: 19/08/2026 16:25
* **Tệp đã sửa**: `src/components/ui/GlobalPlayerBar.tsx`.
* **Vấn đề & Thay đổi**:
  - **Kiến trúc Hợp nhất (Unified Architecture)**: Loại bỏ các overlay tách rời (`fixed inset-0`) hay drawer mép phải riêng biệt. Tích hợp toàn bộ Lời bài hát & Danh sách phát thành một khối đáy mở rộng (Expandable Bottom Sheet) duy nhất.
  - **Trạng thái thu gọn (Compact State)**: Chiều cao `74px - 80px`, đặt nổi tại `bottom-6 sm:bottom-8` tránh đè footer.
  - **Trạng thái mở rộng (Expanded State)**: Trượt mượt mà lên trên đạt `480px - 540px` (hiển thị Lyrics Stream hoặc Queue List), thanh điều khiển playback vẫn nằm cố định liền mạch ở đáy khối.
  - **Tự động ẩn 100% trong Video Zone**: `if (activeZone === 'video') return null;`.

---

### Giao dịch 010: Decoupled Two-Layer Drawer & Static Dock Architecture (`GlobalPlayerBar.tsx`)
* **Thời gian**: 19/08/2026 17:05
* **Tệp đã sửa**: `src/components/ui/GlobalPlayerBar.tsx`.
* **Vấn đề & Thay đổi**:
  - **Khắc phục lỗi biến dạng dock**: Tách `GlobalPlayerBar.tsx` thành 2 tầng anh em (Two Decoupled Sibling Layers) bên trong container `fixed bottom-8 left-1/2 -translate-x-1/2 max-w-5xl`.
  - **Layer 1 (Slide-Up Drawer)**: Khung chứa Lời bài hát / Hàng chờ phát độc lập (`opacity-100 translate-y-0 max-h-[60vh] h-[480px] mb-3` khi mở, `h-0 opacity-0 mb-0` khi đóng).
  - **Layer 2 (Immutable Static Playbar Dock)**: Thanh dock điều khiển nằm cố định phía dưới (`w-full bg-[#0c0d12]/92 backdrop-blur-2xl border border-white/15 rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2.5 sm:py-3 shadow-xl`), **không bao giờ thay đổi chiều cao hoặc biến dạng**.

---

## 🛡️ BẢNG TỔNG HỢP NGUYÊN TẮC PHÒNG NGỪA HỒI QUY (REGRESSION DEFENSE MATRIX)

| Mã lỗi | Triệu chứng | Nguyên nhân gốc rễ | Quy tắc phòng ngừa vĩnh viễn |
| :--- | :--- | :--- | :--- |
| **REG-01** | `ReferenceError: [Icon] is not defined` | Dùng component Lucide trong JSX mà quên thêm vào dòng `import { ... } from 'lucide-react'` | Luôn chạy kiểm tra grep import icon trước khi commit bất kỳ component nào. |
| **REG-02** | Xung đột phát âm thanh đè lên video / 2 cụm nút play | Trộn lẫn controls hoặc không dừng audio khi vào Video Zone | Tuân thủ Invariant 1: Audio Zone và Video Zone là 2 state machine độc lập. Bar ở Video Zone luôn ở Minimal State. |
| **REG-03** | Lỗi build Cloudflare Pages `Export encountered errors` | Next.js cố gắng render SSG cho các trang dùng Client hooks mà không khai báo Edge Runtime | Mọi page/route handler bắt buộc phải có `export const runtime = 'edge';` và `export const dynamic = 'force-dynamic';`. |
| **REG-04** | Ngăn kéo Lyrics/Queue che mất 3D Vinyl trên Desktop | Dùng modal thả nổi cố định `fixed` hoặc `max-w-5xl` lơ lửng giữa màn hình | Dùng dock gắn liền phía trên thanh player có chiều cao giới hạn (`h-[220px] sm:h-[260px]`) và `overflow-y-auto`. |
