# 🧠 HIDDEN MUSIC VAULT - PROJECT BRAIN & ARCHITECTURE SPECIFICATION

> **Document Purpose**: Đây là file tài liệu kiến trúc toàn diện của dự án **Hidden Music Vault**. Mỗi phiên làm việc mới của AI/Developer CHỈ CẦN đọc file này là hiểu 100% dự án, luồng dữ liệu, cách vận hành 3D, Supabase, Player đa định dạng, phím tắt, font chữ và quy trình đăng bài.

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

## 🏗 2. KIẾN TRÚC DỮ LIỆU THƯ MỤC (PARENT - CHILD ARCHITECTURE)

Dự án áp dụng mô hình **Album Thư Mục Chứa -> Các Bài Hát / MV Bên Trong**:

```
 ┌─────────────────────────────────────────────────────────┐
 │                   ALBUM (Bảng `albums`)                  │
 │  - id (UUID)                                            │
 │  - title: "HVL"                                         │
 │  - artist: "MCK"                                        │
 │  - original_year: 2024                                  │
 │  - cover_url: "https://..." (Ảnh màu thực tế)           │
 │  - is_published: true                                   │
 └────────────────────────────┬────────────────────────────┘
                              │ 1 - N (ForeignKey: album_id)
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │               TRACK ITEM (Bảng `tracks`)                │
 │  - id (UUID)                                            │
 │  - album_id (UUID FK -> albums.id)                      │
 │  - title: "02. IDK"                                     │
 │  - media_type: "audio" | "video"                        │
 │  - audio_url: "https://...mp3"                          │
 │  - video_url: "https://...mp4" (Tùy chọn cho MV)        │
 │  - lyrics: "[video_offset:01:45]\n[00:16.63]..."        │
 │  - duration: 200                                        │
 └─────────────────────────────────────────────────────────┘
```

---

## ⚡️ 3. CƠ SỞ DỮ LIỆU & SUPABASE CONFIGURATION

* **Project Ref**: `muemwfqynfljpmvxmpep`
* **URL REST API**: `https://muemwfqynfljpmvxmpep.supabase.co`
* **Database Tables**:
  * `public.profiles`: Quản lý người dùng và phân quyền `role` (`user` | `admin`).
  * `public.albums`: Thư mục đĩa Album (id, title, artist, original_year, cover_url, is_published).
  * `public.tracks`: Từng bài hát / MV bên trong Album (id, album_id, title, media_type, audio_url, video_url, lyrics, duration).
* **Storage Buckets**:
  * `audio-files`: Tệp âm thanh/video mp3, wav, flac, mp4.
  * `cover-arts`: Ảnh bìa album thực tế.
* **RLS Policies**: Mở quyền `FOR ALL USING (true) WITH CHECK (true)` để đảm bảo các tác vụ ghi từ Client/Admin luôn thông suốt.

---

## 🎵 4. HỆ THỐNG PHÁT NHẠC & MV ĐA ĐỊNH DẠNG (GLOBAL PLAYER ENGINE)

1. **Native HTML5 Video & Audio Streaming**:
   * Phát trực tiếp file `.mp4`, `.webm`, `.mp3`, `.wav`, `.flac` tải lên từ Supabase Storage.
   * Cơ chế **Seamless Time Handoff**: Khi chuyển đổi qua lại giữa MV Stage và Audio Mode, thời gian phát tiếp tục chính xác từng giây mà không bao giờ bị tải lại từ đầu (`0:00`).
2. **Đồng Bộ Lời Bài Hát & Video Intro Offset**:
   * Hỗ trợ tag `[video_offset:mm:ss]` trong định dạng `.LRC` để tự động lùi thời gian bắt đầu chạy phụ đề/lời bài hát cho các video MV có đoạn hội thoại / intro mở đầu.
   * Giao diện Lời bài hát Gothic không viền kẻ, tự cuộn mượt mà theo beat nhạc và tự căn giữa màn hình.
3. **Phản Hồi Bắt Beat Theo Thời Gian Thực (Kick & Snare Detection)**:
   * Thuật toán phân tích Web Audio API (58Hz Sub-Punch Kick & 280Hz Snare Crack) với hiệu ứng chớp lửa Cam/Đỏ khi bắt Kick và Neon Tím/Xanh khi bắt Snare.
4. **Giao Diện Responsive Riêng Cho Mobile (`< md`)**:
   * Hàng 1: Thumbnail + Tên bài hát + Nút MV + Bộ nút điều khiển cảm ứng (Lyrics, Prev, Play 32x32, Next, Queue, Volume).
   * Hàng 2: Dải Seekbar kéo dài 100% toàn màn hình kèm 2 mốc thời gian rõ nét.
5. **Bảo Mật Hiển Thị Player Bar**:
   * Player Bar tự động ẩn hoàn toàn khi người dùng chưa đăng nhập hoặc khi bị văng ra màn hình đăng nhập (`VaultGate`).

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
  * `Nhấp đúp vào Video`: Phóng to / Thu nhỏ MV toàn màn hình.
  * `F5`: Tải lại trang và **giữ nguyên toàn bộ phiên đăng nhập**.
  * `Ctrl + Shift + F5`: Hard Reset, xóa sạch session và đăng xuất an toàn.

---

## 🔐 6. TRANG QUẢN TRỊ ADMIN (`/admin`) & QUY TRÌNH ĐĂNG BÀI

* **Đường dẫn bí mật**: `/admin`
* **Tài khoản Admin mặc định**: `Lucii@1108` (hoặc đăng nhập bằng Google Mail admin).
* **Tách biệt 2 ô URL**:
  * **Ô 1: Tệp Âm thanh / URL Audio (.mp3 / .flac)**.
  * **Ô 2: Tệp Video / URL MV (.mp4 từ Supabase)**.
  * **Ô 3: Mốc bắt đầu nhạc trong MV (Offset)** (vd: `01:45`).
* Hệ thống tự động bảo toàn cả `audio_url` và `video_url` khi sửa bài hát, ngăn ngừa triệt để lỗi ghi đè dữ liệu.

---

## 📂 7. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

```
c:\Users\Admin\Documents\hidden-music\
├── PROJECT_BRAIN.md                  <-- File bộ não kiến trúc này
├── AGENTS.md                         <-- Hướng dẫn vận hành AI
├── .agents/skills/                   <-- Vault Skills (vault-manager, vault-deploy)
├── font_vh/                          <-- Bộ font Việt Hóa (DFVN Grafika, Gotham, UVN)
├── public/fonts/                     <-- Web fonts (Gotham-Medium, Gotham-Ultra, DFVN-Grafika)
├── supabase/
│   └── schema.sql                    <-- Schema CSDL Postgres Supabase
├── src/
│   ├── app/
│   │   ├── layout.tsx                <-- Root layout & Grain & ShortcutsDrawer
│   │   ├── globals.css               <-- CSS TV Grain Noise, CRT Scanlines, @font-face
│   │   ├── page.tsx                  <-- Trang chủ Cột 3D Vault
│   │   ├── admin/page.tsx            <-- Trang Admin Quản lý Album / Track / Video Offset
│   │   └── album/[id]/page.tsx       <-- Trang Chi Tiết Thư Mục Album
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── VaultScene.tsx        <-- Canvas Three.js & Lighting
│   │   │   └── VaultPillar3D.tsx     <-- Cột 3D Album Card
│   │   └── ui/
│   │       ├── GlobalPlayerBar.tsx   <-- Trình phát nhạc / MV / Lời bài hát Gothic
│   │       ├── ShortcutsDrawer.tsx   <-- Bong bóng phím tắt trượt thông minh
│   │       ├── CinematicVisualizer.tsx <-- Hiệu ứng beat visualizer
│   │       └── VaultGate.tsx         <-- Cổng đăng nhập bảo mật
│   ├── context/
│   │   └── PlayerContext.tsx         <-- State quản lý Player & đồng bộ Auth
│   ├── lib/
│   │   ├── authSession.ts            <-- Quản lý Session F5 & Hard Reset
│   │   ├── lrcParser.ts              <-- Trình đọc lời .LRC và trích xuất Video Offset
│   │   └── supabase/                 <-- Client kết nối Supabase
│   └── types/
│       └── database.ts               <-- TypeScript Interfaces (Album & TrackItem)
```
