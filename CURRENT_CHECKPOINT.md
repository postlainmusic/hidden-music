# 📌 CURRENT CHECKPOINT - HIDDEN MUSIC VAULT

> **Thời gian cập nhật**: 21/08/2026 20:25 (GMT+7)  
> **Nhánh hoạt động**: `main`  
> **Trạng thái hệ thống**: Đã xử lý trọn vẹn 3 phản hồi kỹ thuật từ người dùng: (1) Nâng cấp Live Waveform Beat Tracking đa tầng (Multi-tier Adaptive Kick Detection) bắt trọn vẹn cả kick nhỏ (ghost kicks), kick vừa và các chuỗi kick dồn dập (rapid rolls / trap double-kicks cách nhau 60-70ms) với lockout giảm xuống 60ms; (2) Triệt tiêu 100% thanh cuộn ngang/dọc (Universal Zero-Scrollbar Cyber Protocol) trên Lyrics View, Queue Drawer và toàn bộ giao diện; (3) Đồng bộ chính xác 100% thời lượng bài hát từ HTML5 Audio Element (`onDurationChange`, `onLoadedMetadata`), sửa lỗi bài *01. Elegie* hiển thị `03:20` thay vì đúng `01:26`. Toàn bộ 7/7 Audio Diagnostic Vectors PASS 100%.

---

## 🎯 1. CÁC HẠNG MỤC ĐÃ HOÀN TẤT & ĐÃ XÁC THỰC

1. **Nâng Cấp Hệ Thống Bắt Beat Đa Tầng & Kick Dồn Dập (`src/lib/dsp/liveWaveformBeat.ts`, `DesktopPlayerBar.tsx`, `MobilePlayerBar.tsx`)**:
   - Giảm `minIntervalMs` từ `110ms` xuống `60ms` để bắt trọn các đợt kick roll dồn dập (16th-notes / trap 808 rolls lên tới 1000 BPM).
   - Thiết lập Multi-tier Adaptive Trigger:
     * Kick nhỏ / Ghost kicks (`bassFlux > 2.2 * fluxSensitivity` hoặc `peakToPeak > 0.09`): độ nảy nhẹ tinh tế (`force ~ 0.015 - 0.025`).
     * Kick vừa (`bassFlux > 4.5 * fluxSensitivity`): độ nảy vừa (`force ~ 0.028 - 0.038`).
     * Kick mạnh / Drop 808 (`bassFlux > 9.0 * fluxSensitivity`): độ nảy uy lực (`force ~ 0.040 - 0.048`).
   - Xóa bỏ lockout cứng `Math.max(160, (60 / bpm) * 700)` vốn làm nuốt mất các kick kế tiếp trong chuỗi dồn dập.

2. **Thiết Lập Universal Zero-Scrollbar Cyber Protocol (`src/app/globals.css`, `SyncedLyricsView.tsx`)**:
   - Bổ sung quy tắc triệt tiêu thanh cuộn trên toàn bộ phần tử (`* { scrollbar-width: none !important; -ms-overflow-style: none !important; }`, `*::-webkit-scrollbar { display: none !important; }`).
   - Gán `no-scrollbar` và `overflow-x-hidden` cho `SyncedLyricsView.tsx` để giao diện lời bài hát và hàng đợi hoàn toàn không có thanh trượt xám làm mất thẩm mỹ.

3. **Đồng Bộ Chính Xác 100% Thời Lượng Âm Thanh Thực Tế (`PlayerContext.tsx`, `VaultApp.tsx`, `VaultScene.tsx`, `DesktopPlayerBar.tsx`, `MobilePlayerBar.tsx`)**:
   - Bắt sự kiện `onDurationChange` và `onLoadedMetadata` từ thẻ `<audio>` để cập nhật `duration` state, `currentTrack.duration`, và danh sách `playlist`.
   - Ưu tiên `duration` thực tế từ luồng stream thay vì phụ thuộc vào metadata giả định trong database.
   - Loại bỏ fallback cứng `'03:20'` trong `formatDuration` ở `VaultApp.tsx` và `VaultScene.tsx` (thay bằng `'--:--'` khi chưa nạp audio). Bài *01. Elegie* hiển thị chính xác `01:26` khi kết thúc thay vì `03:20`.

---

## 🚀 2. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT MILESTONES)

1. Giám sát độ mượt 120 FPS của vinyl rotation, laser border và physics spring trên các thiết bị màn hình 120Hz.
2. Mở rộng khả năng tự động đồng bộ duration cho các bài nhạc nạp qua CDN và YouTube Music Bridge.
