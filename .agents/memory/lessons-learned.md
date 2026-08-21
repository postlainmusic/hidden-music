# 🧠 LESSONS LEARNED & SYSTEM MEMORY — POSTLAIN VAULT

> **MỤC ĐÍCH**: Đây là bộ nhớ tiến hóa tự động (Self-Evolving Knowledge Base) được `@agent-lead` và toàn bộ hội đồng Sub-Agents đọc trước khi lập kế hoạch và cập nhật sau mỗi vòng đời task nhằm triệt tiêu vĩnh viễn việc lặp lại các lỗi kỹ thuật trong quá khứ.

---

## 🏛️ 1. CÁC BÀI HỌC VỀ HẠ TẦNG & CI/CD (INFRASTRUCTURE & CI/CD)

* **LL-01: Cross-Platform CI/CD Dependency Parity (Windows Local vs Ubuntu Linux Runner)**
  - *Sự cố*: Khai báo `@next/swc-win32-x64-msvc` trong `dependencies` gây lỗi `EBADPLATFORM` trên GitHub Actions Linux runner.
  - *Bài học vĩnh viễn*: Không bao giờ thêm các binary packages ràng buộc OS cụ thể vào `package.json`. Để Next.js tự động xử lý qua `optionalDependencies`.

* **LL-02: Edge Runtime Compatibility on Cloudflare Pages**
  - *Sự cố*: Các route API hoặc Page sử dụng dynamic Web APIs bị lỗi build SSG trên Cloudflare Pages.
  - *Bài học vĩnh viễn*: Mọi Page/API route tương tác với Cloudflare Edge bắt buộc phải có `export const runtime = 'edge';` và `export const dynamic = 'force-dynamic';`.

---

## 🎧 2. CÁC BÀI HỌC VỀ AUDIO DSP & WEB AUDIO API

* **LL-03: Mobile Autoplay Policy & AudioContext Unlock**
  - *Sự cố*: Trên iOS Safari và Android Chrome, `AudioContext` khởi tạo ngầm sẽ bị khóa `suspended` nếu chưa có tương tác chạm từ người dùng.
  - *Bài học vĩnh viễn*: Luôn gắn handler mở khóa `if (audioCtx.state === 'suspended') audioCtx.resume()` vào sự kiện click/tap đầu tiên của người dùng.

* **LL-04: Cross-Origin Audio Tainting & Silent Playback [CRITICAL INVARIANT - PERMANENT BAN]**
  - *Sự cố*: Gắn `createMediaElementSource(audio)` lên stream audio từ CDN ngoài (`media.postlain.com`, YouTube Music, R2) khiến trình duyệt lập tức tắt tiếng hoàn toàn thẻ audio (`MediaElementAudioSource outputs zeroes due to CORS access restrictions`).
  - *Bài học vĩnh viễn*: TUYỆT ĐỐI CẤM gọi `createMediaElementSource` trên thẻ audio chính. Thẻ HTML5 Audio element PHẢI luôn xuất âm thanh trực tiếp ra loa. Mọi hoạt ảnh Visualizer, Beat Detection, Dynamic Glow, Strobe và Physics PHẢI trích xuất độc lập qua `MeydaEngine` (`spectralFlux`, `rms`, `spectralCentroid`) kết hợp deterministic waveform buckets. Được giám sát tự động bởi unit test `tests/unit/no-cors-hijack.test.mjs`.

* **LL-05: Mobile Haptic API Uniformity & Battery Guard**
  - *Sự cố*: Gọi `navigator.vibrate` trực tiếp gây crash trên iOS Safari (không hỗ trợ) hoặc làm nóng máy nếu kích hoạt ở tần số cao.
  - *Bài học vĩnh viễn*: Luôn bọc `'vibrate' in navigator` và throttle tối thiểu 220ms giữa 2 nhịp rung kick drop.

---

## ⚡ 3. CÁC BÀI HỌC VỀ HIỆU NĂNG REACT & 120 FPS RENDERING

* **LL-06: Decouple TimeState from Global React Tree**
  - *Sự cố*: Cập nhật `currentTime` trong `PlayerContext` mỗi 100ms gây re-render toàn bộ ứng dụng (Header, Track rows, 3D Monolith).
  - *Bài học vĩnh viễn*: Tách `TimeState` ra khỏi React State, lưu trong `useRef` và phân phối qua `subscribeToTimeUpdate` bằng `requestAnimationFrame` trực tiếp đến DOM của Seekbar & Visualizer.

* **LL-07: Pure GPU Compositing in RAF Loops**
  - *Sự cố*: Sử dụng `box-shadow`, `radial-gradient`, `filter: blur()` thay đổi liên tục trong vòng lặp RAF gây ép CPU rasterize, tụt FPS từ 120 xuống 30.
  - *Bài học vĩnh viễn*: Mọi hoạt ảnh nhịp điệu chỉ sử dụng GPU hardware-accelerated properties: `transform: translate3d(...) scale3d(...)` và `opacity`.

* **LL-08: Zero Layout Shift on Synced Lyrics (.lrc)**
  - *Sự cố*: Thay đổi `font-size` hoặc `line-height` khi chuyển trạng thái active của lyric gây giật dòng và lệch khung nhìn cuộn.
  - *Bài học vĩnh viễn*: Giữ nguyên 100% kích thước font của tất cả các dòng; chỉ thay đổi `color` / `opacity` và scale nhẹ bằng GPU transform.

---

## 🛡️ 4. CÁC BÀI HỌC VỀ HYDRATION & NULL-SAFETY DEFENSE

* **LL-09: SSR Hydration Mismatch Defense**
  - *Sự cố*: Đọc `localStorage` hoặc kiểm tra `window` đồng bộ trong thân hàm render SSR gây lỗi Hydration `#418` / `#423`.
  - *Bài học vĩnh viễn*: Luôn sử dụng cờ `isMounted` guard (`const [isMounted, setIsMounted] = useState(false)`) trước khi render giao diện phụ thuộc client-state.

* **LL-10: Safe Array Protocol on Collections**
  - *Sự cố*: Gọi `.map()` hoặc `.filter()` trên `playlist` / `userQueue` khi chưa load xong gây crash màn hình đen runtime.
  - *Bài học vĩnh viễn*: Mọi state danh sách bắt buộc bọc fallback `Array.isArray(x) ? x : []`.
