# 🧠 HIDDEN MUSIC VAULT - PROJECT BRAIN & ARCHITECTURE SPECIFICATION

> **Document Purpose**: Đây là file tài liệu kiến trúc toàn diện của dự án **Hidden Music Vault**. Mỗi phiên làm việc mới của AI/Developer CHỈ CẦN đọc file này và file [CURRENT_CHECKPOINT.md](file:///c:/Users/Admin/Documents/GitHub/hidden-music/CURRENT_CHECKPOINT.md) là nắm 100% tiến độ và các bước làm tiếp theo!

---

## 📌 TIẾP TỤC DỰ ÁN TỪ CHECKPOINT: Đọc [CURRENT_CHECKPOINT.md](file:///c:/Users/Admin/Documents/GitHub/hidden-music/CURRENT_CHECKPOINT.md)

---

## 🎯 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)
* **Tên dự án**: Hidden Music Vault (Kho Lưu Trữ Âm Nhạc & MV Bị Thu Hồi / Ẩn).
* **Mục đích**: Nền tảng chuyên lưu trữ, phát trực tuyến và bảo tồn các album nhạc, bài hát và MV video hiếm hoặc bị cấm truyền thông.
* **Phong cách thiết kế (Design System & Aesthetic)**:
  * **Trắng - Đen Tối Giản (Pure Monochrome B&W)**: Tone màu trắng `#ffffff`, đen `#000000`, và các sắc thái xám `slate-800`, `slate-900`. Không dùng màu neon sặc sỡ cho UI.
  * **Ảnh bìa Album (Cover Art)**: Luôn giữ nguyên màu sắc gốc thực tế của tác phẩm nghệ thuật (`grayscale={0}`).
  * **Hiệu ứng Analog / CRT Visuals**: Phủ lớp hạt nhiễu TV cổ điển (`.tv-grain-overlay`) và dải quét CRT scanlines tinh tế.
  * **Cột 3D Monolith**: Cột hiển thị dọc giữa màn hình, tương tác nghiêng 3D (`perspective`, `rotateX`, `rotateY`) mượt mà theo chuyển động con trỏ chuột.
  * **Bộ Font Quốc Tế & Việt Hóa**: Sử dụng font **Gotham** (Medium, Ultra, Thin) và **DFVN Grafika** cho độ sắc nét tối đa trên tiếng Việt có dấu.

---

## 🏗 2. KIẾN TRÚC 2 PHÂN VÙNG ĐỘC LẬP (DECOUPLED DUAL-ZONE ARCHITECTURE)

Hệ thống phân tách triệt để 2 không gian phát độc lập:

```
                               ┌─────────────────────────────┐
                               │     HIDDEN MUSIC VAULT      │
                               └──────────────┬──────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
          [AUDIO ZONE - ÂM NHẠC]                          [VIDEO ZONE - MV THEATER]
    ┌───────────────────────────────────┐           ┌───────────────────────────────────┐
    │ - GlobalPlayerBar toàn màn hình   │           │ - Card Theater tỷ lệ 2/3 chuẩn HD │
    │ - Thanh Seekbar kéo dài 100%      │   GATE    │ - Trình phát Video độc lập        │
    │ - Beat Pulse & Gothic Lyrics      │ ◄───────► │ - Compact Playlist & Comments     │
    │ - Không tải / không chạy video    │  PAYWALL  │ - Dừng & hủy hoàn toàn Audio/Bar  │
    │ - Nút Video + Gatekeeper Paywall  │           │ - Nút Audio quay lại Audio Zone   │
    └───────────────────────────────────┘           └───────────────────────────────────┘
```

---

## ⚡️ 3. CƠ SỞ DỮ LIỆU & SUPABASE CONFIGURATION

* **Project Ref**: `muemwfqynfljpmvxmpep`
* **URL REST API**: `https://muemwfqynfljpmvxmpep.supabase.co`
* **Database Tables**:
  * `public.profiles`: Quản lý người dùng và phân quyền `role` (`user` | `admin`), gói dịch vụ `plan` và cờ `has_video_subscription`.
  * `public.albums`: Thư mục đĩa Album (id, title, artist, original_year, cover_url, is_published).
  * `public.tracks`: Từng bài hát / MV bên trong Album (id, album_id, title, media_type, audio_url, video_url, lyrics, duration).
* **Storage Buckets**:
  * `audio-files`: Tệp âm thanh/video mp3, wav, flac, mp4.
  * `cover-arts`: Ảnh bìa album thực tế.
* **RLS Policies**: Mở quyền `FOR ALL USING (true) WITH CHECK (true)` để đảm bảo các tác vụ ghi từ Client/Admin luôn thông suốt.

---

## 🎵 4. HỆ THỐNG PHÁT NHẠC & MV ĐA ĐỊNH DẠNG (GLOBAL PLAYER & THEATER ENGINE)

1. **Audio Zone (GlobalPlayerBar)**:
   * Thanh Seekbar kéo dài toàn chiều rộng giao diện cho trải nghiệm nghe nhạc thuần túy.
   * Đồng bộ lời bài hát Gothic LRC mượt mà không viền.
   * Phản hồi bắt beat Web Audio API (58Hz Sub-Punch Kick & 280Hz Snare Crack).
   * Tự động ẩn Playbar hoàn toàn khi chuyển qua Video Zone.
2. **Video Zone (Theater 2/3 Ratio)**:
   * Khung phát Video HTML5 chiếm tỷ lệ 2/3 với đầy đủ controls (Play/Pause, Seekbar, Volume, Mute, Fullscreen, Next/Prev).
   * Cột bên phải (1/3) chứa Compact Playlist và Tab Thảo luận / Bình luận.
   * Nút bấm **AUDIO ZONE** chuyển đổi quay lại Audio Zone an toàn, dừng video và khôi phục Playbar.
3. **Video Access Gatekeeper**:
   * Kiểm tra quyền `hasVideoSubscription`.
   * Tự động bật Modal `VideoPaywallModal` khi người dùng chưa nâng cấp gói dịch vụ.

---

## ⌨️ 5. BẢNG PHÍM TẮT BONG BÓNG (SHORTCUTS BUBBLE)

* **Phím tắt toàn cục**:
  * `ESC` hoặc `?` hoặc `H`: Bật / Tắt Bong bóng phím tắt nhanh.
  * `Space`: Phát / Tạm dừng (Play / Pause).
  * `←` / `→`: Chuyển bài trước / Bài kế tiếp.
  * `L`: Mở / Đóng giao diện Lời bài hát (Gothic Lyrics).
  * `Q`: Mở / Đóng Danh sách phát (Queue).
  * `S`: Bật / Tắt chế độ Trộn bài (Shuffle).
  * `R`: Chuyển chế độ Lặp bài (Repeat Off / One / All).
  * `F5`: Tải lại trang và giữ nguyên toàn bộ phiên đăng nhập.
  * `Ctrl + Shift + F5`: Hard Reset, xóa sạch session và đăng xuất an toàn.

---

## 🔐 6. TRANG QUẢN TRỊ ADMIN (`/admin`)

* **Đường dẫn bí mật**: `/admin`
* **Tài khoản Admin mặc định**: `Lucii@1108` (hoặc đăng nhập bằng Google Mail admin).
* **Tách biệt 2 trường dữ liệu độc lập**:
  * **Ô 1: Tệp Âm thanh / URL Audio (.mp3 / .flac)**.
  * **Ô 2: Tệp Video / URL MV (.mp4 từ Cloudflare R2 / Supabase)**.
* Đã loại bỏ hoàn toàn các trường và logic tính toán Video Offset không cần thiết.

---

## 📂 7. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

```
c:\Users\Admin\Documents\hidden-music\
├── PROJECT_BRAIN.md                  <-- File bộ não kiến trúc này
├── CURRENT_CHECKPOINT.md             <-- Checkpoint tiến độ
├── AGENTS.md                         <-- Hướng dẫn vận hành AI
├── .agents/skills/                   <-- Vault Skills (vault-manager, vault-deploy)
├── src/
│   ├── app/
│   │   ├── layout.tsx                <-- Root layout & Grain & ShortcutsDrawer
│   │   ├── globals.css               <-- CSS TV Grain Noise, CRT Scanlines, @font-face
│   │   ├── page.tsx                  <-- Trang chủ Cột 3D Vault
│   │   ├── admin/page.tsx            <-- Trang Admin Quản lý Album / Track độc lập
│   │   └── album/[id]/page.tsx       <-- Trang Chi Tiết Thư Mục Album
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── VaultScene.tsx        <-- Cột 3D Monolith & Giao diện Video Zone 2/3 Theater
│   │   │   └── VaultPillar3D.tsx     <-- Cột 3D Album Card
│   │   └── ui/
│   │       ├── GlobalPlayerBar.tsx   <-- Trình phát nhạc thuần Audio với timeline kéo dài
│   │       ├── VideoPaywallModal.tsx <-- Cổng nâng cấp gói Video Pass độc quyền
│   │       ├── AlbumComments.tsx     <-- Hệ thống bình luận & thảo luận
│   │       ├── ShortcutsDrawer.tsx   <-- Bong bóng phím tắt trượt thông minh
│   │       ├── CinematicVisualizer.tsx <-- Hiệu ứng beat visualizer
│   │       └── VaultGate.tsx         <-- Cổng đăng nhập bảo mật
│   ├── context/
│   │   └── PlayerContext.tsx         <-- State phân tách Audio Zone & Video Zone
│   ├── lib/
│   │   ├── authSession.ts            <-- Quản lý Session & Quyền Gói Video Subscription
│   │   ├── lrcParser.ts              <-- Trình đọc lời .LRC
│   │   └── supabase/                 <-- Client kết nối Supabase
│   └── types/
│       └── database.ts               <-- TypeScript Interfaces (Album & TrackItem)
```
