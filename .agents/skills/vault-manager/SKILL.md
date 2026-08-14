---
name: vault-manager
description: >-
  Chuyên gia quản lý và phát triển dự án Hidden Music Vault. Dùng khi phát triển tính năng, 
  chỉnh sửa giao diện 3D Monolith, quản lý API Supabase, hệ thống Player âm thanh/video và trang Admin.
---

# 🎼 Hidden Music Vault - Development & Architecture Skill

Kỹ năng này hướng dẫn toàn bộ kiến trúc và nguyên tắc vận hành của **Hidden Music Vault**.

## 1. Nguyên tắc cốt lõi
1. **Thiết kế**: Tone màu Pure Monochrome B&W (`#000000`, `#ffffff`), hiệu ứng Analog Noise & CRT Scanline, tương tác 3D Monolith góc nhìn nghiêng theo chuột.
2. **Ảnh bìa đĩa**: Ảnh album luôn giữ màu sắc thực tế nguyên bản (`cover_url`).
3. **Cấu trúc dữ liệu 2 cấp**: 
   - Cấp 1: **Album Thư Mục** (`albums`)
   - Cấp 2: **Bài hát / MV con** (`tracks` gán `album_id`)
4. **Không có Cấp độ bảo mật**: Đã loại bỏ hoàn toàn thuộc tính `security_level`.

## 2. Các tệp tin trọng yếu
- `src/app/page.tsx`: Trang chủ chứa Cột đĩa 3D Monolith, hiệu ứng tương tác chuột và danh sách đĩa.
- `src/app/album/[id]/page.tsx`: Trang chi tiết đĩa album, danh sách tracklist, phát âm thanh và video.
- `src/app/admin/page.tsx`: Giao diện Admin quản trị 2 bước (Tạo Album $\rightarrow$ Thêm bài hát/MV).
- `src/context/PlayerContext.tsx`: Trình phát âm thanh/video toàn cục (Global Player), điều khiển phát liên tục xuyên suốt các trang.
- `src/lib/supabase/client.ts` & `src/lib/supabase/server.ts`: Khởi tạo kết nối Supabase với Project Ref `muemwfqynfljpmvxmpep`.

## 3. Checklist khi chỉnh sửa
- [ ] Giữ nguyên tính năng chạy nền không gián đoạn của Global Player.
- [ ] Bảo toàn hiệu ứng TV Grain và CRT Scanlines.
- [ ] Đồng bộ hóa các thay đổi cấu trúc bảng với `src/types/database.ts` và `supabase/schema.sql`.
- [ ] Cập nhật tệp `PROJECT_BRAIN.md` nếu có thay đổi về kiến trúc.
