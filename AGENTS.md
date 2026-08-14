# 🧠 HIDDEN MUSIC VAULT - AGENT & WORKSPACE INSTRUCTIONS

> **MỤC ĐÍCH**: File này là kim chỉ nam cho tất cả các Agent/AI khi làm việc trong repository **Hidden Music Vault**. Luôn tuân thủ các quy tắc thiết kế, cấu trúc dữ liệu và quy trình kiểm thử/deploy bên dưới.

---

## 🎯 1. TỔNG QUAN VỀ DỰ ÁN
* **Tên**: Hidden Music Vault (Kho Lưu Trữ Âm Nhạc & MV Bị Ẩn / Thu Hồi).
* **Mục đích**: Nền tảng chuyên lưu trữ, phát trực tuyến và bảo tồn các album nhạc, bài hát và MV video hiếm hoặc bị cấm truyền thông.
* **Tài liệu kiến trúc chi tiết**: Đọc file [PROJECT_BRAIN.md](file:///c:/Users/Admin/Documents/hidden-music/PROJECT_BRAIN.md) để nắm toàn bộ luồng dữ liệu và thông số kĩ thuật.

---

## 🎨 2. NGUYÊN TẮC THIẾT KẾ (DESIGN SYSTEM & AESTHETICS)
1. **Pure Monochrome B&W (Trắng - Đen Tối Giản)**:
   * Chỉ sử dụng tone màu trắng `#ffffff`, đen `#000000`, và các sắc thái xám `slate-800`, `slate-900`.
   * **TUYỆT ĐỐI KHÔNG** dùng các màu neon, màu sắc sặc sỡ cho UI nền và nút bấm.
   * **Ảnh bìa Album (Cover Art)**: Luôn giữ nguyên màu sắc gốc thực tế của tác phẩm nghệ thuật.
2. **Hiệu ứng Analog / CRT Visuals**:
   * Phủ lớp hạt nhiễu TV cổ điển (`.tv-grain-overlay`).
   * Phủ dải quét CRT scanlines tinh tế tạo cảm giác băng đĩa ngầm bí ẩn.
3. **Cột 3D Monolith**:
   * Cột hiển thị dọc giữa màn hình, tương tác nghiêng 3D (`perspective`, `rotateX`, `rotateY`) mượt mà theo chuyển động con trỏ chuột.

---

## 🗄 3. CẤU TRÚC DỮ LIỆU & SUPABASE
* **Project Ref**: `muemwfqynfljpmvxmpep`
* **URL**: `https://muemwfqynfljpmvxmpep.supabase.co`
* **Database Tables**:
  * `public.profiles`: Quản lý người dùng và phân quyền `role` (`user` | `admin`).
  * `public.albums`: Thư mục đĩa Album (id, title, artist, original_year, cover_url, is_published).
  * `public.tracks`: Từng bài hát / MV bên trong Album (id, album_id, title, media_type, audio_url, video_url, lyrics, duration).
* **Storage Buckets**:
  * `audio-files`: Tệp âm thanh/video mp3, wav, flac, mp4.
  * `cover-arts`: Ảnh bìa album thực tế.
* **RLS Policies**: Thiết lập mở quyền `FOR ALL USING (true) WITH CHECK (true)` để đảm bảo các tác vụ ghi từ Client/Admin luôn thông suốt.

---

## ⚙️ 4. QUY TRÌNH CHỈNH SỬA & DEPLOY BẮT BUỘC (MỖI PHIÊN LÀM VIỆC)
Mỗi khi nhận yêu cầu thêm tính năng, fix bug hoặc thay đổi giao diện, Agent PHẢI thực hiện đủ 4 bước:
1. **Kiểm tra ngữ cảnh**: Đọc [PROJECT_BRAIN.md](file:///c:/Users/Admin/Documents/hidden-music/PROJECT_BRAIN.md) và các file liên quan trước khi sửa code.
2. **Viết code chất lượng cao**:
   * Tuân thủ TypeScript types trong [src/types/database.ts](file:///c:/Users/Admin/Documents/hidden-music/src/types/database.ts).
   * Không bỏ sót xử lý lỗi và fallback giao diện.
3. **Kiểm tra tính toàn vẹn (Testing & Linting)**: Đảm bảo không có lỗi cú pháp hoặc gãy luồng logic.
4. **Commit & Push GitHub**:
   * Viết commit message theo chuẩn Conventional Commits (`feat: ...`, `fix: ...`, `refactor: ...`).
   * Push code lên nhánh `main` để Vercel CI/CD tự động build & deploy phiên bản mới.
