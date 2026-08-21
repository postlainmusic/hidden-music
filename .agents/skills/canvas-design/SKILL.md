---
name: canvas-design
description: "Master Canvas 2D, WebGL & Three.js Generative Design Specialist. Based on Anthropic's 300k+ installed canvas-design skill to build bespoke audio visualizers, 3D monolith vinyl stages, shader post-processing, and tactile visual computing artifacts."
---

# 🎭 CANVAS 2D, WEBGL & GENERATIVE STAGE DESIGN SKILL

> **NGUỒN GỐC & SỨ MỆNH**: Kỹ năng này được chuyển hóa từ bộ kỹ năng **`canvas-design`** chính thức của Anthropic (hơn 300.000+ lượt cài đặt), chuyên biệt hóa cho lĩnh vực đồ họa tính toán (Visual Computing), Canvas 2D, WebGL Shaders và Three.js trong **Hidden Music Vault** (POSTLAIN). Mục tiêu là tạo ra trải nghiệm thị giác sống động, đồng bộ nhịp thở âm nhạc với hiệu năng đỉnh cao 60-120 FPS.

---

## 🌌 1. TRIẾT LÝ THIẾT KẾ CANVAS & ĐỒ HỌA POSTLAIN

1. **Hiệu Năng Tuyệt Đối (Zero Frame Drops)**:
   - Tất cả hoạt ảnh Canvas/WebGL đều phải chạy độc lập trên luồng GPU thông qua `requestAnimationFrame`, tuyệt đối không gây re-render cây DOM React.
   - Sử dụng `contain: strict` hoặc `contain: layout style paint` và `will-change: transform` trên các phần tử hiển thị.
2. **Analog & Generative Imperfection**:
   - Tránh đồ họa vector nhân tạo hoàn hảo không tì vết. Đưa vào các yếu tố vật lý thực tế: Phản xạ ánh sáng mặt đĩa than (Anisotropic vinyl reflection), độ trễ phosphor của màn hình CRT, hạt bụi analog ngẫu nhiên.
3. **Phản Ứng Âm Nhạc Hữu Cơ (Organic Beat Reactivity)**:
   - Đồ họa không chỉ nhấp nháy cơ học theo âm lượng đơn thuần. Các hình thái chuyển động phải phản ánh sự phân rã phổ tần số đa chiều:
     - **Sub-bass (30Hz - 80Hz)**: Độ nén dãn không gian, độ rung mặt đất.
     - **Mid-Snare (1kHz - 3kHz)**: Độ sắc bén của tia sáng laser, tia chớp CRT.
     - **Hi-hats / Treble (6kHz - 16kHz)**: Hạt bụi vi mô lơ lửng, gợn sóng bề mặt.

---

## 🛠️ 2. CÁC PATTERN ĐỒ HỌA CHỦ ĐẠO TRONG DỰ ÁN

### Pattern 1: HTML5 Canvas 2D Oscilloscope & Spectrum Ribbon
- Vẽ biểu đồ sóng âm thời gian thực với độ mờ tàn dư (Phosphor Decay Persistence) bằng cách phủ lớp nền `ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'` ở mỗi khung hình thay vì xóa trắng.
- Sử dụng đường cong Bezier (`ctx.quadraticCurveTo` hoặc `ctx.bezierCurveTo`) để tạo dải sóng mềm mại như dải lụa phát quang.

### Pattern 2: Three.js 3D Monolith Vinyl Stage (`VaultScene.tsx`)
- Mô hình đĩa than 3D xoay quanh trục với quán tính vật lý (Inertia & Angular Velocity).
- Bề mặt đĩa có vật liệu phản chiếu ánh sáng anisotropic tạo nên các rãnh đĩa thực tế.
- Tương tác góc nghiêng tự nhiên theo vị trí con trỏ chuột (`mouse.x`, `mouse.y`) với hiệu ứng giảm chấn (LERP).

### Pattern 3: CRT Scanlines & TV Noise Canvas Shader
- Tạo hiệu ứng quét tia điện tử và hạt nhiễu tĩnh vô tuyến giúp giao diện mang đậm hơi thở máy móc âm thanh analog của thập niên 80-90.

---

## 📐 3. NGUYÊN TẮC BẢO VỆ TÀI NGUYÊN & TRÁNH RÒ RỈ BỘ NHỚ

- Luôn luôn dọn dẹp (Cleanup) đối tượng khi component unmount:
  - `cancelAnimationFrame(animId)`
  - Hủy context WebGL: `renderer.dispose()`, `geometry.dispose()`, `material.dispose()`, `texture.dispose()`.
  - Hủy các Event Listeners (`resize`, `pointermove`).
- Tự động hạ độ phân giải Canvas (`devicePixelRatio = Math.min(window.devicePixelRatio, 2)`) để tiết kiệm pin trên thiết bị di động.

---

## ⚡ 4. CHECKLIST PHÊ DUYỆT CANVAS TRƯỚC KHI DEPLOY

- [ ] Canvas có duy trì 60-120 FPS mượt mà không bị rớt khung hình không?
- [ ] Vòng lặp `requestAnimationFrame` đã có hàm cleanup để tránh rò rỉ bộ nhớ chưa?
- [ ] Tỷ lệ màn hình `devicePixelRatio` đã được scale chuẩn xác để không bị mờ trên màn hình Retina không?
- [ ] Hiệu ứng phản ứng âm học đã được đồng bộ với `MeydaEngine` hoặc `waveformBuckets` chưa?
