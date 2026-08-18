# 📌 CURRENT CHECKPOINT - HIDDEN MUSIC VAULT

> **Thời gian cập nhật**: 18/08/2026
> **Trạng thái**: Hoàn tất phân tách kiến trúc Audio Zone & Video Zone, Cổng thanh toán Video Paywall Gatekeeper và Dọn dẹp Video Offset trong Admin.

---

## 🎯 CÁC HẠNG MỤC ĐÃ HOÀN THÀNH:
1. **Phân tách 2 vùng độc lập**:
   - **Audio Zone**: GlobalPlayerBar thuần nhạc, thanh timeline trải dài toàn màn hình mượt mà, loại bỏ mọi nút/popup/drawer video.
   - **Video Zone**: Card Theater tỷ lệ 2/3 chuẩn điện ảnh kèm Compact Playlist, Tab Thảo luận & Nút icon Audio quay lại Audio Zone. Khi vào Video Zone, Playbar và luồng Audio dừng và ẩn hoàn toàn.
2. **Video Access Gatekeeper**:
   - Nút icon Video đặt tại Album Header cạnh nút `PLAY ALL` và tại badge `[MV]` của tracklist.
   - Tự động kiểm tra quyền gói dịch vụ (`hasVideoSubscription`).
   - Mở modal `VideoPaywallModal` cho người dùng chưa kích hoạt, hỗ trợ kích hoạt nhanh và nhập mã voucher/passkey.
3. **Dọn dẹp Admin & Schema**:
   - Loại bỏ hoàn toàn trường nhập "Lệch giây video (Video Offset)", các nút tính toán sync và `audioSyncService`.
   - Tách biệt 2 trường độc lập: URL Audio và URL Video.
4. **Bảo toàn giao diện & hiệu ứng**:
   - Giữ nguyên Monochrome B&W, Analog TV Grain, CRT Scanlines và tương tác 3D Monolith.

---

## 🚀 CÁC BƯỚC TIẾP THEO:
1. Kiểm tra build dự án (`npm run build` hoặc linting check).
2. Commit và push lên GitHub main để Vercel CI/CD tự động deploy.
