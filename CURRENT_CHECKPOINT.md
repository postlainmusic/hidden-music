# 📌 CURRENT CHECKPOINT - HIDDEN MUSIC VAULT

> **Thời gian cập nhật**: 20/08/2026 17:18 (GMT+7)  
> **Nhánh hoạt động**: `main`  
> **Trạng thái hệ thống**: Hoàn tất đại tu toàn diện Closed-Loop In-App Streaming Hub (`/discover`). Loại bỏ 100% liên kết ngoài (`window.open`/`ExternalLink`). Tích hợp Stream Resolver nội bộ (`/api/ytm/resolve`) chuyển đổi YouTube videoId thành direct audio stream trên Edge Runtime truyền thẳng vào `PlayerContext.playTrack(...)`. Tích hợp Native Instant Search (`/api/ytm/search`) và hệ thống phân phối curated âm nhạc chuẩn gu (V-Hop, Global Trap, Lo-fi Late-Night).

---

## 🎯 1. CÁC HẠNG MỤC ĐÃ HOÀN TẤT & ĐÃ XÁC THỰC

1. **Closed-Loop In-App Streaming Engine (Giao dịch 016)**:
   - **`src/app/api/ytm/resolve/route.ts`**: Edge route phân giải luồng stream âm thanh trực tiếp (m4a/webm) thông qua cụm 5 Invidious node fallback, trả về URL audio chạy trực tiếp trên HTML5 `<audio>` của `PlayerContext`.
   - **Zero External Navigation**: Bấm bất kỳ bài hát nào từ Trending, V-Hop, Global Hits, Search Results đều tải âm thanh và phát trực tiếp qua `GlobalPlayerBar` (Mini & Expanded Player).
   - **Hiệu ứng Trạng thái (Loading Feedback)**: Hiển thị icon spinner `Loader2` ngay trên thẻ bài hát đang được phân giải và Toast thông báo lỗi nếu có sự cố mạng.

2. **Native Instant Search & Filter Bar**:
   - **`src/app/api/ytm/search/route.ts`**: Tìm kiếm bài hát, đĩa nhạc, album với locale Việt Nam `gl=VN, hl=vi`.
   - **Debounce 300ms**: Tìm kiếm tức thì khi gõ, tự động chuyển đổi giữa giao diện Khám phá và Kết quả tìm kiếm mà không cần tải lại trang.
   - **Filter Pills**: `All`, `V-Hop & R&B`, `Global Hits`, `Lo-fi / Chill`, `New Releases`, `Vault Lossless`.

3. **Curated Music Taste (V-Hop, Global, Lo-fi)**:
   - **`src/app/api/ytm/feed/route.ts`**: Nhắm mục tiêu chính xác các nghệ sĩ V-Hop underground (MCK, Wren Evans, Low G, tlinh, Obito, 24k.Right) và Global Hip-hop (Travis Scott, The Weeknd, Metro Boomin).

4. **Mobile Gesture Engine & Desktop Preservation**:
   - Duy trì trọn vẹn cử chỉ vuốt ngang chuyển bài, vuốt dọc thu gọn trên `MobilePlayerBar.tsx`.
   - Bảo tồn 100% giao diện và trải nghiệm 3D trên Desktop.

---

## 🚀 2. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT MILESTONES)

1. Giám sát độ ổn định và thời gian phản hồi của các node Invidious resolver.
2. Tối ưu hóa bộ đệm client-side cho metadata tìm kiếm.
3. Hoàn thiện Theater Mode cho Video Zone.
