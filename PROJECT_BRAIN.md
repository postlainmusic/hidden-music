# 🧠 HIDDEN MUSIC VAULT - PROJECT BRAIN & ARCHITECTURAL SPECIFICATION

> **SINGLE SOURCE OF ARCHITECTURAL TRUTH**  
> *Project*: **Hidden Music Vault** (POSTLAIN Brand)  
> *Target Architecture*: Next.js 14+ (App Router) • Pure Web Application • Cloudflare Pages / Vercel Edge Runtime  
> *Database & Storage*: Supabase PostgreSQL • Cloudflare R2 CDN  

---

## 🔒 1. CORE ARCHITECTURAL INVARIANTS (LOCKED — NEVER MODIFY)

These principles are the foundational pillars of Hidden Music Vault. Under no circumstances should any developer or AI agent violate or alter these invariants.

### Invariant 1: Strict Decoupled Dual-Zone Architecture (Audio Zone vs Video Zone)
The application operates on two completely separate, mutually exclusive functional zones:

```
                              ┌────────────────────────────────────────┐
                              │          HIDDEN MUSIC VAULT            │
                              └───────────────────┬────────────────────┘
                                                  │
                      ┌───────────────────────────┴───────────────────────────┐
                      ▼                                                       ▼
          [AUDIO ZONE - HI-RES MUSIC]                             [VIDEO ZONE - 4K MV THEATER]
    ┌─────────────────────────────────────────┐             ┌─────────────────────────────────────────┐
    │ • Full-featured GlobalPlayerBar         │             │ • Native 4K/1080p Theater Video Player  │
    │ • 60FPS Direct DOM Seeker & Scrubber    │    MUTUAL   │ • Video Player Has ITS OWN Controls     │
    │ • Real-time LRC Gothic Lyrics Sync      │  EXCLUSION  │ • GlobalPlayerBar ENTERS MINIMAL STATE  │
    │ • Web Audio Sub-Punch Beat Visualizer   │ ◄─────────► │   (No audio seeker, no duplicate play)  │
    │ • Zero-gap HTML5 Audio Preloading Engine│             │ • Dừng & hủy hoàn toàn Audio Stream     │
    │ • Master Switcher to Video MV           │             │ • Master Switcher to Audio Zone         │
    └─────────────────────────────────────────┘             └─────────────────────────────────────────┘
```

1. **State Machine Separation**:
   - Audio Zone is active when `activeZone === 'audio'`. Audio element streams lossless FLAC/MP3/M4A/WAV.
   - Video Zone is active when `activeZone === 'video'`. Video element streams direct MP4/HLS from Cloudflare R2 CDN.
2. **Zero Audio Clash / Memory Leak Policy**:
   - When entering Video Zone: The native audio element (`audioRef.current`) is immediately paused, its `src` wiped, and garbage-collected (`audioRef.current.src = ''; audioRef.current.load();`).
   - When returning to Audio Zone: Video playback is immediately paused, freeing GPU/video buffers.
3. **No Duplicate Controls (Minimal Bar Invariant)**:
   - In Video Zone, the bottom `GlobalPlayerBar` MUST remain in its **Minimal State** (only Track Title, Artist, and the `[ 🎵 ÂM THANH | 🎬 VIDEO MV ]` switcher button). It MUST NEVER render audio seekers, audio play/pause, or skip buttons that duplicate video controls.

---

### Invariant 2: Pure Monochrome Cyber-Aesthetic & Design System (POSTLAIN Brand)
1. **Color Palette**:
   - Backgrounds: `#000000` (Pure Black), `#07070a`, `#090a0f` (Deep Cyber Space).
   - Accents & Highlights: `#ffffff` (Pure White), `#f4f4f5` (Zinc 100).
   - Containers & Panels: `zinc-950/90`, `zinc-900/80` with glassmorphic borders `border-white/15` or `border-white/20`.
   - **RULE**: **NO saturated neon greens, blues, or rainbow colors** for UI frames, cards, or buttons.
2. **Cover Art Authenticity**:
   - Album & Track Cover Arts MUST retain 100% original, rich, true-to-life colors (`grayscale: 0`). Never apply monochromatic filters to artwork.
3. **Analog & CRT Retro Atmosphere**:
   - Covered with `.tv-grain-overlay` (subtle noise simulation) and `.crt-scanlines` (tactile analog CRT line sweeps).
4. **Typography Hierarchy**:
   - `font-cyber`: Geometric futuristic bold uppercase titles (**DFVN Grafika**, **Gotham Ultra**).
   - `font-mono`: Data readouts, timecodes, hashes, technical badges (**JetBrains Mono**).
   - `font-sans`: Body copy, descriptions, lyrics (**Outfit**, **Be Vietnam Pro**).

---

### Invariant 3: 3D Monolith Vinyl Canvas Integrity
- Centered 3D Vinyl turntable powered by Three.js (`@react-three/fiber` & `@react-three/drei`).
- Interactive physics tilt reacting smoothly to mouse pointer coordinates (`perspective`, `rotateX`, `rotateY`).
- Uncompressed cover artwork mapped directly onto the center vinyl label sticker.

---

### Invariant 4: 100% Pure Web Application (Zero Native APK Bridge Logic)
- All streaming, picture-in-picture, and media controls use standard HTML5 Web APIs:
  - `navigator.mediaSession` for lockscreen / OS metadata.
  - `document.pictureInPictureElement` / `video.requestPictureInPicture()` for standard Web PiP.
  - `document.requestFullscreen()` for cinema viewing.
  - Web Crypto API (`crypto.subtle`) for secure signatures.
- **RULE**: **NO Capacitor, TWA, Cordova, or Android Java Bridges**.

---

### Invariant 5: Lucide Icon Import Rigor
- **STRICT MANDATE**: Whenever a JSX icon `<IconName ... />` is used in any component, `IconName` MUST be explicitly declared in `import { IconName, ... } from 'lucide-react'`.
- Missing icon imports cause catastrophic runtime `ReferenceError` crashes during SSR/Client hydration.

---

## 🗺️ 2. ACTIVE SYSTEM ROADMAP (OPEN FOR EXTENSION)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                              ACTIVE ROADMAP PHASES                                 │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────┤
│     PHASE 1       │      PHASE 2      │      PHASE 3      │        PHASE 4         │
│  Context & Player │   Video Engine &  │    AI Discovery   │   CI/CD Optimization   │
│  State Expansion  │   Paywall Overlay │   Feed & Telemetry│    & Production Polish │
├───────────────────┼───────────────────┼───────────────────┼────────────────────────┤
│ • PlayerContext   │ • PremiumVideo    │ • DiscoveryFeed   │ • Dual-layer Caching   │
│   (isPremium,     │   Player (PiP,    │   (/discover)     │   (npm + .next/cache)  │
│    currentVideo)  │   Speed Selector) │ • useTelemetry    │ • Edge Runtime across  │
│ • Minimal State   │ • PaywallOverlay  │ • /api/telemetry  │   all routes & APIs    │
│   in Video Zone   │ • payOS & Voucher │ • Curated/Trending│ • Zero build warnings  │
└───────────────────┴───────────────────┴───────────────────┴────────────────────────┘
```

1. **AI Discovery & Recommendation Feed (`/discover`)**:
   - Horizontal swimlanes ("Trending 4K MVs", "Curated for PostLain", "Vault Rarities").
   - Real-time telemetry ingestion via `useTelemetry()` hook sending behavioral signals (`play`, `progress`, `skip`, `heart`, `paywall_view`) to `/api/telemetry`.
2. **Premium Paywall & Access Gatekeeper**:
   - `VideoPaywallModal.tsx`: Automated VietQR checkout via payOS gateway + Voucher passcode activation.
   - `PaywallOverlay.tsx`: Non-blocking video overlay with upgrade CTA.
3. **Adaptive Bitrate Video Streaming**:
   - HTML5 `<video>` engine configured for high-speed edge streaming from Cloudflare R2 CDN buckets.

---

## 🗄️ 3. DATABASE SCHEMA & SUPABASE INTEGRATION

* **Project Ref**: `muemwfqynfljpmvxmpep`
* **URL**: `https://muemwfqynfljpmvxmpep.supabase.co`
* **Tables**:
  * `public.profiles`: `id`, `email`, `display_name`, `role` (`user` | `admin`), `plan` (`free` | `vip` | `premium`), `has_video_subscription` (boolean), `is_video_paid` (boolean), `created_at`.
  * `public.albums`: `id`, `title`, `artist`, `original_year`, `cover_url`, `is_published`, `created_at`.
  * `public.tracks`: `id`, `album_id`, `title`, `artist`, `media_type` (`audio` | `video`), `audio_url`, `video_url`, `cover_url`, `lyrics`, `duration`, `created_at`.
  * `public.vouchers`: `id`, `code`, `plan_type` (`monthly` | `lifetime`), `max_uses`, `used_count`, `expires_at`, `is_active`, `created_at`.
* **Storage Buckets**:
  * `audio-files`: Hi-Res FLAC, MP3, MP4 uncompressed files.
  * `cover-arts`: Full-resolution authentic album cover artwork.

---

## 📐 4. UI/UX DESIGN SYSTEM & MODULAR PLAYER ARCHITECTURE

| Layer | Z-Index | Component Description |
| :--- | :---: | :--- |
| **Canvas Background** | `0` | Deep black background, ambient glow, CRT scanline overlay |
| **3D Stage & Visualizer**| `10` | Three.js Vinyl turntable, Monolith cards, particles |
| **Footer Info Bar** | `20` | System status, encryption badge, DMCA/Terms links (Vault mode only) |
| **Header Navigation** | `30` | `Navbar.tsx` with logo, Discovery link, user profile badge, settings |
| **Global Player Root**| `40-50`| `GlobalPlayerBar.tsx` (Root Dispatcher / Orchestrator) |
| **Desktop Player Bar** | `50` | `DesktopPlayerBar.tsx` (Unified frosted glass card `bg-zinc-950/40`, slide-up pure lyrics & queue) |
| **Mobile Player Bar** | `50` | `MobilePlayerBar.tsx` (Capsule mini-bar `fixed bottom-4` & Full-height slide-up sheet) |
| **Modals & Gatekeeper**| `50-60`| `VideoPaywallModal`, `ProfileModal`, `SettingsModal`, `VaultGate` |

### Responsive Player Modular Separation:
* **Desktop (`md` and above)**: Isolated `DesktopPlayerBar.tsx` with continuous translucent glassmorphism (`bg-zinc-950/40 backdrop-blur-2xl`), pure centered synced lyrics, smooth cubic-bezier height expansion.
* **Mobile (below `md`)**: Isolated `MobilePlayerBar.tsx` with touch-friendly capsule mini-bar and full-height slide-up sheet (`fixed inset-x-0 bottom-0 top-12`).

---

## ⌨️ 5. GLOBAL SHORTCUTS REFERENCE

* `Space`: Play / Pause toggle.
* `←` / `→`: Seek backward / forward 5 seconds.
* `L`: Toggle Fullscreen Immersive Gothic Lyrics stream.
* `Q`: Toggle Right-Side Queue drawer.
* `S`: Toggle Shuffle mode.
* `R`: Toggle Repeat mode (`off` → `all` → `one`).
* `P`: Toggle Web Picture-in-Picture for video.
* `F`: Toggle Fullscreen mode.
* `M`: Toggle Audio/Video Mute.
* `Esc`: Close open Drawers / Overlays / Modals.
* `Ctrl + Shift + F5`: Hard reset session and purge local credentials.

---

## 📸 6. QUY TRÌNH KIỂM TOÁN HÌNH ẢNH & LƯU TRỮ BỘ NHỚ (VISUAL VERIFICATION & MEMORY PROTOCOL)

1. **Cấu trúc thư mục**:
   - `screenshots/`: Thư mục chứa ảnh chụp màn hình kiểm tra tự động sau mỗi lần sửa đổi code dạng `screenshots/PENDING_[FEATURE_NAME]_[YYYYMMDD_HHMM].png`.
   - `memory/`: Thư mục lưu trữ vĩnh viễn các chuẩn giao diện thị giác đã được người dùng phê duyệt dạng `memory/APPROVED_[FEATURE_NAME].png`.
2. **Quy trình kiểm tra sau sửa đổi (Post-Edit Workflow)**:
   - Bước 1: Kiểm tra biên dịch & cú pháp đảm bảo 0 lỗi.
   - Bước 2: Chụp ảnh trực quan giao diện đã sửa và lưu vào `screenshots/`.
   - Bước 3: Báo cáo kèm đường dẫn chính xác cho người dùng kiểm tra.
3. **Quy trình Phê duyệt & Đóng băng Bộ nhớ (Approval & Memory Archival)**:
   - Khi người dùng gửi lệnh phê duyệt (ví dụ: "Duyệt [FEATURE_NAME]"):
     + Di chuyển & đổi tên ảnh từ `screenshots/` sang `memory/APPROVED_[FEATURE_NAME].png`.
     + Cập nhật mục `## Visual Memory & UI Invariants` trong file này với tên tệp, thông số kích thước và CSS đã xác thực.
     + Ghi nhận sự kiện phê duyệt vào `SYSTEM_LOG.md`.

---

## 🖼️ 7. VISUAL MEMORY & UI INVARIANTS (CHUẨN GIAO DIỆN ĐÃ PHÊ DUYỆT)

*Mục này đóng băng các chuẩn giao diện thị giác đã được người dùng phê duyệt để các thế hệ AI tiếp theo đối chiếu và không làm lệch layout.*
