# 🧠 HIDDEN MUSIC VAULT - PROJECT BRAIN & ARCHITECTURE SPECIFICATION

> **Document Purpose**: Đây là file tài liệu kiến trúc toàn diện của dự án **Hidden Music Vault**. Mỗi phiên làm việc mới của AI/Developer CHỈ CẦN đọc file này là hiểu 100% dự án, luồng dữ liệu, cách vận hành 3D, Supabase và quy trình đăng bài.

---

## 🎯 1. TỔNG QUAN DỰ ÁN (PROJECT PURPOSE)
* **Tên dự án**: Hidden Music Vault (Kho Âm Nhạc & MV Bị Thu Hồi / Ẩn).
* **Mục đích**: Website chuyên đăng tải các sản phẩm âm nhạc, đĩa album và MV Video bị ẩn hoặc xóa do các lý do bảo mật, bản quyền hoặc lệnh cấm truyền thông.
* **Phong cách thiết kế (Aesthetic)**:
  * **Trắng - Đen Tối Giản (Pure Monochrome B&W)**: Chỉ sử dụng màu `#000000` và `#ffffff`, không dùng màu neon màu mè.
  * **Analog TV Grain Noise & CRT Scanlines**: Phủ lớp hiệu ứng nhiều hạt TV cũ (`.tv-grain-overlay`) và dải quét CRT tĩnh tạo cảm giác bí ẩn, cổ điển.
  * **Không Gian 3D Phong Cách Hàng Đầu**: Cột 3D Monolith dọc giữa màn hình hiển thị các Album ảnh màu thực tế, có hiệu ứng nghiêng 3D tương tác theo con trỏ chuột.

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
 │  - ban_reason: "Lý do cấm / bảo mật..."                 │
 │  - security_level: "TOP SECRET" / "CONFIDENTIAL"        │
 │  - cover_url: "https://..." (Ảnh màu thực tế)           │
 └────────────────────────────┬────────────────────────────┘
                              │ 1 - N (ForeignKey: album_id)
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │               TRACK ITEM (Bảng `tracks`)                │
 │  - id (UUID)                                            │
 │  - album_id (UUID FK -> albums.id)                      │
 │  - title: "01. Elegie (Unreleased)"                     │
 │  - media_type: "audio" | "video"                        │
 │  - audio_url: "https://..."                             │
 │  - video_url: "https://..."                             │
 │  - lyrics: "Lời bài hát..."                             │
 └─────────────────────────────────────────────────────────┘
```

---

## ⚡️ 3. CƠ SỞ DỮ LIỆU & SUPABASE CONFIGURATION

* **Project Ref**: `yodctlkebsbtivmkskdo`
* **URL REST API**: `https://yodctlkebsbtivmkskdo.supabase.co`
* **Schema SQL File**: `supabase/schema.sql`

### **Cấu Trúc Các Bảng Trên Postgres (Supabase)**:
1. **`public.profiles`**: Lưu thông tin người dùng và phân quyền Role (`user` | `admin`).
2. **`public.albums`**: Lưu thông tin đĩa Album chính hiển thị trên Cột 3D.
3. **`public.tracks`**: Lưu các bài hát/MV thuộc về Album (`album_id REFERENCES public.albums(id) ON DELETE CASCADE`).
4. **Storage Buckets**: `audio-files` (lưu tệp mp3/wav/flac/mp4) và `cover-arts` (lưu ảnh bìa album).

### **Chính Sách Bảo Mật (RLS Policies)**:
* `albums`, `tracks` và `storage.objects` được thiết lập chính sách **Open Access (`FOR ALL USING (true) WITH CHECK (true)`)** để đảm bảo ứng dụng gửi request REST API từ trang Admin luôn được ghi nhận 100% không bị lỗi HTTP 401 (Unauthorized).

---

## 🔐 4. TRANG QUẢN TRỊ ADMIN (`/admin`) & QUY TRÌNH ĐĂNG BÀI

* **Đường dẫn bí mật**: `/admin`
* **Tài khoản Admin mặc định**:
  * **Username**: `admin` *(tự động map tới `admin@hiddenvault.com`)*
  * **Mật khẩu**: `Lucii@1108`
* **Cơ chế Đăng nhập Bypass**: Trong [src/app/login/page.tsx](file:///c:/Users/Administrator/Documents/GitHub/hidden_music/src/app/login/page.tsx), tài khoản Admin được xác thực qua Master Session Token trực tiếp, không bị kẹt lại đòi xác nhận email (`Email not confirmed`).

### **Quy Trình 2 Bước Đăng Sản Phẩm (2-Step Admin Workflow)**:
1. **BƯỚC 1: TẠO ALBUM THƯ MỤC**:
   * Admin nhập Tên Album (vd: `HVL`), Nghệ sĩ, Năm phát hành, Lý do bị cấm/bảo mật, chọn cấp độ bảo mật và tải lên **Ảnh bìa Album (Giữ màu sắc thực nguyên bản)**.
   * Bấm **XÁC NHẬN TẠO ALBUM THƯ MỤC** -> Supabase tự động lưu Album và sinh mã UUID chuẩn.
2. **BƯỚC 2: THÊM BÀI HÁT / MV VÀO ALBUM**:
   * Chọn Album từ Dropdown (ví dụ: `HVL`).
   * Chọn loại media (**ĐĂNG MV VIDEO** hay **ĐĂNG AUDIO**).
   * Điền Tên bài hát, chọn tệp (.mp3 / .wav / .flac / .mp4) hoặc dán link trực tiếp, nhập Lyrics (nếu có).
   * Bấm **THÊM BÀI HÁT VÀO ALBUM** -> Supabase lưu trực tiếp vào bảng `public.tracks` có gán `album_id`.

---

## 🎨 5. GIAO DIỆN KHÔNG GIAN 3D & TRANG CHI TIẾT ALBUM

### **A. Cột 3D Vault Trang Chủ (`src/app/page.tsx` & `VaultPillar3D.tsx`)**:
* Hiển thị Cột 3D Monolith dọc giữa màn hình đen tĩnh.
* Đĩa bìa Album hiển thị hình ảnh **màu sắc thực tế 100%** (`grayscale={0}`).
* **Hiệu Ứng 3D Hover Tương Tác**:
  * Khi đưa con trỏ chuột vào bìa đĩa, khối 3D tự động **nghiêng theo góc nhìn của con trỏ chuột** (`rotation.x/y` lerp theo `pointer`).
  * Phóng to nhẹ mượt mà (`scale 1.12x`).
  * Khung viền phát sáng màu trắng.
* Đã xóa bỏ hình đĩa Vinyl 3D trượt ra và xóa bỏ ô hướng dẫn cuộn chuột bên dưới theo đúng yêu cầu tối giản.

### **B. Trang Chi Tiết Album (`src/app/album/[id]/page.tsx`)**:
* Click vào bất kỳ Album nào trên Cột 3D -> Chuyển sang trang Album `/album/[id]`.
* Hiển thị thông tin Album, Lý do bị cấm/bảo mật.
* Danh sách toàn bộ các bài hát & MV nằm bên trong Album đó.
* Trình phát Video MV giao diện CRT VHS hoặc Trình phát Audio đĩa nhạc.

---

## 🚫 6. NGUYÊN TẮC KỸ THUẬT QUAN TRỌNG CHO AI / DEVELOPER VỀ SAU

> 🔴 **CỰC KỲ QUAN TRỌNG - KHÔNG ĐƯỢC VI PHẠM**:
> 1. **DẸP HOÀN TOÀN LOCALSTORAGE**: Không bao giờ viết logic fallback lưu tạm LocalStorage hay mock data gán cứng. 100% dữ liệu ĐỌC và GHI phải đi qua Supabase REST API (`supabase.from('albums')` và `supabase.from('tracks')`).
> 2. **SỬ DỤNG MÃ UUID CHUẨN**: `album_id` trong Postgres là kiểu `UUID` (36 ký tự). Không bao giờ tự sinh chuỗi `album-123` giả lập vì Postgres sẽ chặn lỗi HTTP 400 Bad Request.
> 3. **KHÔNG DÙNG REMOTE FONT URL TRONG THREE.JS TEXT**: Không dùng `font="https://fonts.gstatic.com/..."` trong Drei `<Text>` vì nếu mạng bị nghẽn font, React Three Fiber `<Suspense>` sẽ bị đơ màn hình đen.
> 4. **SUPABASE HOSTNAME REF**: Hostname Supabase chuẩn là `yodctlkebsbtivmkskdo.supabase.co` (Không thêm đuôi `sb` vào ref).

---

## 📂 7. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

```
c:\Users\Administrator\Documents\GitHub\hidden_music\
├── PROJECT_BRAIN.md                  <-- File bộ não kiến trúc này
├── supabase/
│   └── schema.sql                    <-- File SQL chạy trên Supabase SQL Editor
├── src/
│   ├── app/
│   │   ├── layout.tsx                <-- Root layout & Grain overlay
│   │   ├── globals.css               <-- CSS TV Grain Noise & CRT Scanlines
│   │   ├── page.tsx                  <-- Trang chủ Cột 3D Vault
│   │   ├── login/page.tsx            <-- Trang Đăng nhập Admin Bypass
│   │   ├── register/page.tsx         <-- Trang Đăng ký B&W Monochrome
│   │   ├── admin/page.tsx            <-- Trang Admin Quản lý 2 Bước & Sửa Album/Track
│   │   └── album/[id]/page.tsx       <-- Trang Chi Tiết Thư Mục Album & Trình Phát
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── VaultScene.tsx        <-- Canvas Three.js & Lighting
│   │   │   └── VaultPillar3D.tsx     <-- Cột 3D Album Card nghiêng theo chuột
│   │   └── ui/
│   │       └── Navbar.tsx            <-- Thanh Header B&W
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts             <-- Client Supabase Helper (Fallback URL)
│   │       └── server.ts             <-- Server Supabase Helper
│   └── types/
│       └── database.ts               <-- TypeScript Interfaces (Album & TrackItem)
```
