# 📌 CURRENT CHECKPOINT & TIẾP TỤC DỰ ÁN (HANDOVER RECORD)

> **MỤC ĐÍCH**: Đây là điểm lưu trữ trạng thái hiện tại của dự án **Hidden Music Vault**. Khi bạn mở phiên làm việc mới, bạn chỉ cần nói *"tiếp tục"* hoặc *"đang làm đến đâu rồi"*, AI sẽ đọc file này và tiếp tục hướng dẫn bạn chính xác từ bước này!

---

## 📍 TRẠNG THÁI HIỆN TẠI (CURRENT STATE)

1. **Pure Audio Optimization**: Đã gỡ bỏ toàn bộ logic và mã nguồn video, biến web thành nền tảng nghe nhạc thuần khiết, siêu nhẹ và bắt beat 60FPS.
2. **Cloudflare R2 Object Storage**: Đã kết nối mã nguồn thành công với Cloudflare R2 bucket `hidden-music-vault`. Toàn bộ upload mới (ảnh bìa, nhạc MP3/WAV/FLAC) sẽ tự động đẩy thẳng lên Cloudflare R2 với **0 chi phí băng thông (0 Egress Fees)**.
3. **Admin Portal (`/admin`)**: Đã cập nhật nút **`🗑️ RESET DATA`** và **`Làm mới 🔄`** để dọn sạch dữ liệu cũ và bắt đầu upload lại từ đầu.

---

## 🎯 CÁC BƯỚC ĐANG DỞ CẦN LÀM TIẾP (NEXT ACTIONS)

### 🔹 Bước 1: Dọn sạch dữ liệu cũ trên Supabase
Bạn đang muốn xóa hết thông tin cũ trên Supabase để bắt đầu upload album mới.
* **Cách nhanh nhất**: Vào tab **Supabase SQL Editor** và chạy:
```sql
TRUNCATE TABLE public.tracks CASCADE;
TRUNCATE TABLE public.album_comments CASCADE;
TRUNCATE TABLE public.albums CASCADE;

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access albums" ON public.albums;
CREATE POLICY "Open access albums" ON public.albums FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access tracks" ON public.tracks;
CREATE POLICY "Open access tracks" ON public.tracks FOR ALL USING (true) WITH CHECK (true);
```
*(Hoặc vào trang `/admin` và bấm nút đỏ **`RESET DATA`**)*.

---

### 🔹 Bước 2: Thêm biến môi trường lên Vercel (Production)
Vào **Vercel Dashboard > Project Settings > Environment Variables** và dán 5 biến sau:
* `CLOUDFLARE_R2_ACCOUNT_ID`: `5da953b3d1c0e1c733cf2285f8e7ab39`
* `CLOUDFLARE_R2_ACCESS_KEY_ID`: `57456fede976516aa1adecf2cd2b24e3`
* `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: `4cb6fa310e4a74e524dd8217bb0bae7072b5f0fdd21c350d8591a65f29fd4ee4`
* `CLOUDFLARE_R2_BUCKET_NAME`: `hidden-music-vault`
* `NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL`: `https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev`

---

### 🔹 Bước 3: Thêm CORS Policy trên Cloudflare R2
Vào Cloudflare R2 > Bucket `hidden-music-vault` > Tab **Settings** > **CORS Policy** > Thêm:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

### 🔹 Bước 4: Tạo Album & Upload Nhạc Mới
* Vào trang `/admin` > Bấm **`+ NEW ALBUM`** > Nhập tên Album, Nghệ sĩ, chọn ảnh bìa.
* Chọn tải nhạc từng bài hoặc **`📤 TẢI NHẠC .MP3 HÀNG LOẠT`** > Toàn bộ nhạc sẽ được lưu trữ trên Cloudflare R2!
