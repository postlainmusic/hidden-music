# 📌 CURRENT CHECKPOINT - HIDDEN MUSIC VAULT

> **Thời gian cập nhật**: 20/08/2026 15:54 (GMT+7)  
> **Nhánh hoạt động**: `main`  
> **Trạng thái hệ thống**: Hoàn thiện Streaming Hub — thay thế DiscoveryFeed lỗi thời bằng hub khám phá 5-section cao cấp (Hero Carousel, Trending, New Releases, Mood Playlists, Vault) tích hợp YouTube Music real-time data qua Edge API `/api/ytm/feed`, cache 1 giờ stale-while-revalidate. Sửa tất cả lỗi API phá vỡ trong DiscoveryFeed cũ (`isPremium`, `openPaywall`, `addToQueue` không tồn tại trong PlayerContext).

---

## 🎯 1. CÁC HẠNG MỤC ĐÃ HOÀN TẤT & ĐÃ XÁC THỰC

1. **Thanh tẩy Toàn bộ Tàn dư APK / PWA**:
   - Quét và xác nhận 100% không còn bất kỳ nút bấm "Cài đặt APK", "Download APK", hay sự kiện `beforeinstallprompt` trong toàn bộ codebase.
   - Ứng dụng hoạt động thuần Web Application 100%.

2. **Mobile Gesture Engine & Native Streaming Player UI (`MobilePlayerBar.tsx`)**:
   - **Compact Mini-Player (Thu gọn)**:
     * Nhấp bất kỳ đâu trên thanh mini-bar để mở rộng (`onClick={() => setIsExpanded(true)}`), không dùng nút mũi tên riêng biệt.
     * Tích hợp trực tiếp các nút Play/Pause và Quick Next (`e.stopPropagation()`).
     * **Vuốt ngang chuyển bài (Horizontal Swipe Gesture)**: Vuốt sang trái đổi bài kế tiếp (`nextTrack`), vuốt sang phải quay lại bài trước (`prevTrack`) kèm hiệu ứng dịch chuyển ngang mượt mà.
   - **Fullscreen Expanded Mobile Player (Toàn màn hình)**:
     * **Vuốt dọc xuống để đóng (Vertical Swipe-Down Dismiss)**: Vuốt xuống ΔY > 60px để thu gọn sheet về mini-bar.
     * Thanh kéo trên cùng tối giản (`w-10 h-1 bg-white/25 rounded-full`).
     * Giao diện phát chuẩn Streaming (Apple Music / Spotify style): Ảnh bìa nổi bật ở trung tâm, thông tin bài hát và nút Yêu thích, thanh tua toàn chiều rộng với thời gian thực, cụm điều khiển trung tâm với nút Play/Pause to tròn (`w-16 h-16 bg-white text-black`).

3. **Bảo tồn Tuyệt đối Desktop (`DesktopPlayerBar.tsx`)**:
   - Giữ nguyên vẹn 100% mã nguồn và trải nghiệm trên Desktop.

4. **Streaming Hub — `/discover` (Giao dịch 015)**:
   - **`src/types/ytm.ts`** — Strict TypeScript types: `YtmTrack`, `YtmAlbum`, `YtmPlaylist`, `YtmFeedResponse`.
   - **`src/app/api/ytm/feed/route.ts`** — Edge-compatible YouTube Music proxy API. Cache `s-maxage=3600`. Graceful fallback trả về empty arrays nếu YTM không khả dụng.
   - **`src/components/discovery/DiscoveryFeed.tsx`** — Viết lại hoàn toàn thành StreamingHub 5 section.
   - **`src/app/discover/page.tsx`** — Parallel fetch YTM + Supabase, title "STREAMING HUB".

---

## 🚀 2. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT MILESTONES)

1. Kiểm thử người dùng trên thiết bị di động thực tế.
2. Tiếp tục hoàn thiện Theater Mode cho Video Zone.
3. Theo dõi tỉ lệ thành công của YTM API proxy và cập nhật parser nếu YouTube thay đổi nội bộ API.
