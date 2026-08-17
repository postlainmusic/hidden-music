# 🎧 hiddenmusic-web (Astro + React + Capacitor)

The Underground Music Terminal - Client UI & Native Android Wrapper for **Hidden Music Vault** (`postlain.com`).

---

## ⚡️ Điểm nổi bật
1. **Kiến trúc Astro v4 Static**:
   * Xuất thư mục tĩnh `dist/` siêu nhẹ, tải trang tức thì.
   * Tích hợp `<ViewTransitions />` (`<ClientRouter />`) cho chuyển trang 60 FPS mượt mà.
2. **Persistent Global Audio Player**:
   * Trình phát nhạc `<GlobalAudioPlayer transition:persist client:load />` chạy xuyên suốt toàn bộ ứng dụng mà không bao giờ bị ngắt nhạc khi bấm vào các liên kết.
3. **The Underground Music Terminal Layout**:
   * **BLOCK 1**: Spotlight Hero với Dynamic Backdrop Glow & Vinyl Slider.
   * **BLOCK 2**: Restricted Archive ngang với hiệu ứng snap-x.
   * **BLOCK 3**: Global Radar (YouTube Music API real-time).
   * **BLOCK 4**: Daily Protocol Mix.
4. **PWA & Capacitor Native Ready**:
   * Cấu hình đầy đủ `manifest.webmanifest`, `sw.js`, và `capacitor.config.ts`.

---

## 🚀 Hướng dẫn Chạy & Build

### 1. Cài đặt Dependencies:
```bash
npm install
```

### 2. Chạy Local Development:
```bash
npm run dev
# Mở trình duyệt tại http://localhost:4321
```

### 3. Build Static Bundle (`dist/`):
```bash
npm run build
```

### 4. Đồng bộ Capacitor Android:
```bash
npm run cap:sync
npm run cap:android
```
