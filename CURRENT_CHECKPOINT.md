# 📌 CURRENT CHECKPOINT - HIDDEN MUSIC VAULT

> **Thời gian cập nhật**: 25/08/2026 13:20 (GMT+7)  
> **Nhánh hoạt động**: `main`  
> **Trạng thái hệ thống**: Đã hoàn tất triển khai kiến trúc **POSTLAIN MUSIC - Frontend & Audio Engine** kết nối với **PocketBase v0.40+** (`https://database.postlain.com`) và **Cloudflare R2 Direct Streaming** (`hidden-music-vault` / `https://media.postlain.com`):
> 1) Khởi tạo Singleton PocketBase Client (`src/lib/pocketbase.ts`) và Schema Types (`src/types/pocketbase.ts`);
> 2) Xây dựng API Service Layer (`src/lib/pocketbaseService.ts`) hỗ trợ đầy đủ `getTracks`, `getArtists`, `getPlaylists`, `toggleLike`, `getUserLikes`, `incrementPlaysCount`;
> 3) Nâng cấp Global Audio Player Engine (`src/context/PlayerContext.tsx`) với `preload="metadata"`, tua bài HTTP 206 Range mượt mà, quản lý Play Queue (`playNextInQueue`, `reorderQueue`), lưu trạng thái volume/position vào `localStorage`, đồng bộ `MediaSession` API toàn diện kèm `setPositionState`, và hệ thống phím tắt bàn phím (`Space`, `←`/`→`, `↑`/`↓`, `M`, `L`, `Q`);
> 4) Tạo component `TrackList` (`src/components/ui/TrackList.tsx`) chuẩn Monochrome Cyber-Aesthetic;
> 5) Thêm thanh tua bài hiển thị tooltip timestamp khi hover (`DesktopPlayerBar.tsx`);
> 6) Xác thực **32/32 test suites PASS 100%** và `tsc --noEmit` đạt mã thoát 0 (zero errors).

---

## 🎯 1. CÁC HẠNG MỤC ĐÃ HOÀN TẤT & ĐÃ XÁC THỰC

1. **PocketBase Client & Schema Layer (`src/lib/pocketbase.ts` & `src/types/pocketbase.ts`)**:
   - Singleton client `pb` kết nối tới `https://database.postlain.com` với helper `getFileUrl` và `autoCancellation(false)`.
   - Data models đầy đủ: `TrackRecord`, `ArtistRecord`, `PlaylistRecord`, `LikeRecord`, `UserRecord`.
   - Bidirectional adapters: `trackRecordToTrackItem` và `playlistRecordToAlbum`.

2. **PocketBase Service Functions (`src/lib/pocketbaseService.ts`)**:
   - `getTracks()`, `getTrackItems()`, `getTrackById()`, `searchTracks()`.
   - `getArtists()`, `getArtistById()`.
   - `getPlaylists()`, `getPlaylistAlbum()`.
   - `toggleLike()`, `getUserLikes()`, `incrementPlaysCount()`.
   - Universal streaming & artwork resolvers `getAudioStreamUrl()` và `getCoverImageUrl()`.

3. **Global Audio Player Engine (`src/context/PlayerContext.tsx`)**:
   - `<audio preload="metadata">` hỗ trợ phát và tua tức thì qua HTTP 206 Partial Content từ Cloudflare R2 / PocketBase.
   - Thêm `playNextInQueue`, `reorderQueue`, `toggleMute`, `isMuted`.
   - Tự động gọi `incrementPlaysCount(track.id)` khi bắt đầu phát.
   - `navigator.mediaSession` metadata + action handlers (`play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward`, `seekforward`, `stop`) + `setPositionState`.
   - Global Keyboard Shortcuts: `Space` (Play/Pause), `ArrowLeft`/`ArrowRight` (Seek +/- 5s), `ArrowUp`/`ArrowDown` (Volume +/- 5%), `KeyM` (Mute/Unmute).

4. **UI Components & Seekbar Tooltip**:
   - `TrackList.tsx`: Hiển thị danh sách bài hát Monochrome Cyber-Deck, badges chất lượng FLAC 24-bit, lượt nghe, thời lượng, nút like và menu ngữ cảnh `...`.
   - `DesktopPlayerBar.tsx`: Thanh seekbar mượt mà với tooltip hiển thị timestamp preview khi hover chuột.
   - `HomePage` (`src/app/page.tsx`): Tự động nạp song song PocketBase tracks/playlists cùng Supabase albums.

5. **Kiểm Thử Tự Động & CI/CD Integrity**:
   - `npx tsc --noEmit`: **0 errors** (Type-check 100% sạch).
   - `npm test`: **32/32 test suites PASSED 100%**.

---

## 🚀 2. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT MILESTONES)

1. Duy trì tính ổn định của hệ thống phát nhạc trực tiếp từ PocketBase R2 và YouTube Music Discovery Hub.
2. Tiếp tục tinh chỉnh trải nghiệm giao diện Cyber-Deck Audiophile đạt chuẩn 120 FPS mượt mà trên mọi thiết bị.
