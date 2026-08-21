---
name: frontend-design
description: "Master Frontend Design & Anti-AI Aesthetics Specialist. Based on Anthropic's 300k+ installed frontend-design skill & Distilled Aesthetics framework to eliminate generic AI-generated UI patterns (AI slop) and craft bespoke, award-winning interfaces for Hidden Music Vault."
---

# 🎨 FRONTEND DESIGN & ANTI-AI SLOP MASTERY SKILL

> **NGUỒN GỐC & SỨ MỆNH**: Kỹ năng này được chuyển hóa và nâng cấp trực tiếp từ bộ kỹ năng **`frontend-design`** chính thức của Anthropic (hơn 300.000+ lượt cài đặt trong cộng đồng Claude Code), kết hợp với triết lý **Distilled Aesthetics**. Nhiệm vụ tối thượng: **Xóa bỏ hoàn toàn "kiểu thiết kế AI" (AI Slop/AI Defaults)** và xây dựng giao diện nghệ thuật số đỉnh cao, mang cá tính thương hiệu độc bản cho **Hidden Music Vault** (POSTLAIN).

---

## 🚫 1. BẢNG DANH MỤC CẤM (THE ANTI-AI FORBIDDEN MANIFESTO)

Các AI agent thường có xu hướng tạo ra những giao diện an toàn, rập khuôn và vô hồn. Dưới đây là danh sách **TUYỆT ĐỐI CẤM** khi code giao diện cho dự án:

| Hạng Mục | ❌ KIỂU THIẾT KẾ AI RẬP KHUÔN (CẤM) | ✨ CHUẨN THIẾT KẾ NGHỆ THUẬT POSTLAIN (BẮT BUỘC) |
| :--- | :--- | :--- |
| **Màu Sắc (Color)** | Gradient tím-hồng (Purple/Pink neon AI default) trên nền xám tối vô hồn. | **Monochrome Cyber Noir**: `#000000`, `#07070a`, viền `border-white/15`, điểm xuyết màu nguyên bản của Cover Art. |
| **Typography** | Font mặc định `Inter`, `Roboto`, `Arial` hoặc `system-ui` không cá tính. | **Đa tầng Font phân cấp**: `font-cyber` (DFVN Grafika, Gotham Ultra), `font-mono` (JetBrains Mono), `font-sans` (Outfit). |
| **Bố Cục (Layout)** | 3 cột thẻ Card đều chằn chặn, bo góc `rounded-xl` bóng bẩy kiểu template SaaS. | **Asymmetric & Atmospheric Grid**: Không gian mở, tỷ lệ vàng, đường chia viền siêu mỏng, cảm giác thiết bị âm thanh analogue cao cấp. |
| **Bề Mặt (Texture)** | Nền đen phẳng lì hoặc đổ bóng blur `shadow-lg` mờ nhạt. | **Tactile Analog Textures**: Lớp phủ hạt bụi đĩa than (`.tv-grain-overlay`), đường quét CRT scanline (`.crt-scanlines`), kính frosted glass nhiều tầng. |
| **Chuyển Động (Motion)** | Animation nảy vô thưởng vô phạt hoặc lạm dụng thư viện nặng nề. | **Vật lý Lò xo Hooke & GPU Direct DOM**: Chuyển động nẩy có trọng lượng, phản hồi xúc giác Haptic và biến thiên phổ âm thanh tức thời 120 FPS. |
| **Nút Bấm (Buttons)** | Nút gradient tròn bóng bẩy, hover đổi màu lòe loẹt. | **Tactile Cyber Triggers**: Nút bấm mang cảm giác cơ học (Mechanical switch), viền laser sắc gọn, active scale nén xuống. |

---

## 📐 2. BỐN TRỤ CỘT THIẾT KẾ BẬC THẦY (DISTILLED AESTHETIC PILLARS)

### Trụ Cột 1: Typography As Architecture (Chữ là Kiến trúc)
- **Tên bài / Tiêu đề chính**: Cỡ chữ lớn, kerning chặt chẽ (`tracking-tight` hoặc `tracking-widest` đối với Uppercase), font hình học đậm chất tương lai.
- **Dữ liệu kỹ thuật / Timecode / Hashes**: Luôn luôn dùng font Monospace (`font-mono`) định dạng số `tabular-nums` để không bị nhảy giật khi thời gian chạy.
- **Lời bài hát (Lyrics)**: Trình bày nghệ thuật Gothic/Brutalist với hiệu ứng chuyển đổi mượt mà theo từng mili-giây.

### Trụ Cột 2: Negative Space & Atmosphere (Không gian Thở & Chiều Sâu)
- Tận dụng khoảng trống vô cực (Pure Black Space) để làm nổi bật tác phẩm nghệ thuật đĩa than Three.js ở trung tâm.
- Tạo chiều sâu không gian (Spatial Depth) bằng các tầng Z-index có tính toán: Background Glow $\rightarrow$ 3D Turntable $\rightarrow$ Frosted Glass HUD $\rightarrow$ Modals.

### Trụ Cột 3: Micro-Interactions with Physical Weight (Vi tương tác Vật lý)
- Mọi tương tác chạm (Hover, Click, Drag, Drop) đều phải có phản hồi thị giác tức thì trong vòng $16\text{ms}$.
- Nút bấm có độ lún (`active:scale-95`), thanh trượt Seeker có hiệu ứng từ tính nam châm (Magnetic Scrubber) và gợn sóng khi chạm mốc nhịp.

### Trụ Cột 4: Authentic Cover Art Primacy (Tôn vinh Tác phẩm Nghệ thuật)
- Giữ 100% màu sắc và chi tiết gốc của Artwork Album/Track (`grayscale: 0`).
- Dùng màu sắc trích xuất từ Artwork để tạo vầng hào quang Ambient Glow dịu nhẹ phản chiếu xuống nền đen.

---

## 💻 3. CODE SNIPPETS & THƯ VIỆN PATTERN CHUẨN

### Pattern 1: Cyber-Frosted Glass Card (Thẻ Kính Cơ Khí)
```tsx
<div className="relative group overflow-hidden rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur-2xl transition-all duration-300 hover:border-white/25 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
  <div className="relative z-10 p-5">
    {/* Content */}
  </div>
</div>
```

### Pattern 2: Mechanical Cyber Switch Button
```tsx
<button className="relative px-4 py-2 text-xs font-mono tracking-wider uppercase border border-white/20 bg-zinc-900/80 text-white/90 rounded-md transition-transform duration-150 active:scale-95 hover:bg-white hover:text-black hover:border-white focus:outline-none focus:ring-1 focus:ring-white/50">
  <span className="relative z-10 flex items-center gap-2">
    <Icon className="w-3.5 h-3.5" />
    <span>ACTION_KEY</span>
  </span>
</button>
```

---

## ⚡ 4. CHECKLIST PHÊ DUYỆT TRƯỚC MỖI KHI XUẤT CODE UI

- [ ] Giao diện có bị rơi vào màu tím gradient AI phổ thông không? (Nếu có $\rightarrow$ **SỬA NGAY VỀ MONOCHROME NOIR**).
- [ ] Font chữ đã được phân cấp chuẩn (`font-cyber`, `font-mono`, `font-sans`) chưa?
- [ ] Các thanh tiến trình, seeker có hỗ trợ kéo mượt 60 FPS không bị lag hydration không?
- [ ] Đã kiểm tra responsive trên Mobile ($375\text{px}-430\text{px}$) và Màn hình siêu rộng ($2560\text{px}$) chưa?
- [ ] Tất cả icon Lucide đã được import đầy đủ ở đầu file chưa?
