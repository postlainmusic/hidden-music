# 📌 CURRENT CHECKPOINT & TIẾP TỤC DỰ ÁN (HANDOVER RECORD)

> **MỤC ĐÍCH**: Đây là điểm lưu trữ trạng thái hiện tại của dự án **Hidden Music Vault**. Khi bạn mở phiên làm việc mới, bạn chỉ cần nói *"tiếp tục"* hoặc *"đang làm đến đâu rồi"*, AI sẽ đọc file này và tiếp tục hướng dẫn bạn chính xác từ bước này!

---

## 📍 TRẠNG THÁI HIỆN TẠI (CURRENT STATE)

1. **Pure Audio Optimization**: Giao diện và player thuần âm thanh chất lượng cao, bắt beat và visualizer 60FPS.
2. **Cloudflare R2 Object Storage (100% Tested & Verified)**:
   - Đã kiểm tra kết nối trực tiếp đến bucket `hidden-music-vault` và public CDN `https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev` (Trả về `200 OK`).
   - Đã nâng cấp hệ thống upload sang cơ chế **Direct S3 Presigned PUT URL**: Cho phép tải lên tệp âm thanh/video kích thước lớn (không giới hạn dung lượng, vượt qua giới hạn 4.5MB của Vercel Serverless).
3. **CI/CD & Git Integration**: Đã thiết lập GitHub Actions và kết nối remote repo `postlainmusic/hidden-music` trên nhánh `main`.

---

## 🎯 CÁC BƯỚC CẦN THỰC HIỆN ĐỂ UPLOAD KHÔNG BỊ LỖI

### 🔹 Bước 1: Cấu hình CORS Policy trên Cloudflare R2 (BẮT BUỘC để duyệt và upload từ trình duyệt)
1. Mở [Cloudflare Dashboard](https://dash.cloudflare.com/) > Vào mục **R2 Object Storage**.
2. Chọn bucket **`hidden-music-vault`** > Chọn tab **Settings**.
3. Cuộn xuống phần **CORS Policy** > Chọn **Add CORS Policy** (hoặc Edit) và dán đoạn JSON sau:
```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```
4. Nhấn **Save**.

---

### 🔹 Bước 2: Thêm biến môi trường lên Vercel (Nếu deploy trên Vercel)
Vào **Vercel Dashboard > Project Settings > Environment Variables** và dán các biến sau:
* `CLOUDFLARE_R2_ACCOUNT_ID`: `5da953b3d1c0e1c733cf2285f8e7ab39`
* `CLOUDFLARE_R2_ACCESS_KEY_ID`: `57456fede976516aa1adecf2cd2b24e3`
* `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: `4cb6fa310e4a74e524dd8217bb0bae7072b5f0fdd21c350d8591a65f29fd4ee4`
* `CLOUDFLARE_R2_BUCKET_NAME`: `hidden-music-vault`
* `NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL`: `https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev`

---

### 🔹 Bước 3: Upload Nhạc trên `/admin`
* Vào trang `/admin` > Tạo Album hoặc mở Album hiện có.
* Bấm **`📤 TẢI NHẠC .MP3 HÀNG LOẠT`** hoặc upload từng file: Trình duyệt sẽ tải thẳng lên Cloudflare R2 siêu tốc và lưu URL vào Supabase Database!
