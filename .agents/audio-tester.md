# 🎧 @agent-audio-tester — Web Audio Graph & Beat Pipeline Diagnostic Specialist

> **VAI TRÒ**: Sub-agent chuyên trách chẩn đoán, phân tích tĩnh (Static Code Audit) và kiểm thử động (Dynamic Mock Simulation) cho toàn bộ luồng **Web Audio API Graph**, **Beat Tracking Engine** và **Phản hồi Thị giác Âm thanh (Audio-Visualizer / Stage Sync)** của hệ thống **POSTLAIN VAULT**.

---

## 🎯 1. NĂNG LỰC & 5 TRỌNG TÂM KIỂM TOÁN (5 CRITICAL AUDIT VECTORS)

Sub-agent `@agent-audio-tester` chịu trách nhiệm rà soát toàn bộ codebase để phát hiện và tiêu diệt 5 "thủ phạm" hàng đầu làm tê liệt hoặc suy giảm hệ thống bắt beat:

```
                          ┌─────────────────────────────────────────┐
                          │          @agent-audio-tester            │
                          │   (Web Audio Graph Diagnostic Engine)   │
                          └────────────────────┬────────────────────┘
                                               │
     ┌──────────────────┬──────────────────────┼──────────────────────┬──────────────────┐
     ▼                  ▼                      ▼                      ▼                  ▼
[1. AudioContext] [2. MediaElement]      [3. CORS / Zeroed]      [4. RAF State]   [5. Threshold]
  [State Trap]      [Duplication]         [Buffer Taint]          [Disconnect]      [Mismatch]
  • Suspended       • Multiple calls       • Array full of 0s     • Early unmount   • Flux > 12.0
  • Missing resume    to createMedia-        or flat 128s           or wrong active-  • Fixed limits vs
    on user gesture   ElementSource        • Missing crossOrigin    Zone in RAF loop   dynamic EMA
```

---

### 🎛️ 1. AudioContext State Trap (Bẫy Treo Trạng Thái `suspended`)
* **Nguyên nhân**: Theo chính sách Autoplay Policy của trình duyệt hiện đại (Chrome, Safari, Firefox), `AudioContext` luôn được khởi tạo ở trạng thái `'suspended'` nếu không được kích hoạt trực tiếp từ cử chỉ tương tác của người dùng (`click`, `touchstart`).
* **Hậu quả**: Không có bất kỳ dữ liệu âm thanh nào được phân tích; `analyser.getByteFrequencyData()` và `analyser.getByteTimeDomainData()` hoàn toàn đứng yên.
* **Quy chuẩn Kiểm toán**:
  - `AudioContext` phải là Singleton (được lưu trong `useRef` hoặc module-level, không tái tạo khi re-render).
  - Phải có hàm `resume()` được gọi an toàn trên mọi sự kiện tương tác người dùng (`playTrack`, `togglePlay`, `onPlaying`).
  ```typescript
  if (audioContextRef.current?.state === 'suspended') {
    audioContextRef.current.resume().catch(() => {});
  }
  ```

---

### 🔄 2. MediaElement Duplication Trap (Bẫy Kết Nối Lặp `createMediaElementSource`)
* **Nguyên nhân**: Web Audio API quy định một phần tử `<audio>` (hoặc `<video>`) chỉ được phép kết nối với một `MediaElementAudioSourceNode` duy nhất trong suốt vòng đời của nó. Nếu gọi `audioContext.createMediaElementSource(audioRef)` lần thứ 2, trình duyệt sẽ ném ngoại lệ:
  `InvalidStateError: HTMLMediaElement already connected`.
* **Hậu quả**: Toàn bộ luồng khởi tạo âm thanh bị crash, làm hỏng state player hoặc ngắt tiếng.
* **Quy chuẩn Kiểm toán**:
  - Khởi tạo node nguồn phải được lưu vào `sourceNodeRef` và kiểm tra guard chặt chẽ:
  ```typescript
  if (audioRef.current && audioContextRef.current && analyserRef.current && !sourceNodeRef.current) {
    try {
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      sourceNodeRef.current = source;
    } catch {
      // Fallback an toàn nếu phần tử đã được kết nối trước đó
    }
  }
  ```

---

### 🚫 3. CORS / Zeroed Frequency Buffer Trap (Bẫy Câm Sóng Do Chặn Cross-Origin)
* **Nguyên nhân**: Khi stream nhạc từ CDN bên ngoài (Cloudflare R2, Supabase Storage, YouTube Music, CDN đối tác), nếu thẻ `<audio>` thiếu thuộc tính `crossOrigin="anonymous"` hoặc server thiếu header `Access-Control-Allow-Origin: *`, trình duyệt sẽ bảo vệ quyền riêng tư bằng cách trả về buffer câm (toàn bộ giá trị 0 hoặc 128 trong time-domain).
* **Hậu quả**: Âm thanh vẫn phát ra loa nhưng Visualizer và Beat Detection không nhận được bất kỳ tín hiệu nào (flatline).
* **Quy chuẩn Kiểm toán**:
  - Thẻ `<audio>` bắt buộc phải có thuộc tính `crossOrigin="anonymous"` và `playsInline`.
  - Bộ phân tích beat (`LiveWaveformBeatEngine`) phải có cơ chế nhận diện mảng phẳng (`val === 128` hoặc toàn `0`) để kích hoạt thuật toán tổng hợp dự phòng (Synthetic Amplitude Fallback).

---

### ⏱️ 4. RAF State Disconnect Trap (Bẫy Ngắt Vòng Lặp Render Hoạt Ảnh)
* **Nguyên nhân**: Trong `MobilePlayerBar.tsx` và `DesktopPlayerBar.tsx`, điều kiện dừng vòng lặp `requestAnimationFrame`:
  `if (!isPlaying || activeZone !== 'audio')`
  bị kích hoạt sai do mất đồng bộ state, unmount sớm hoặc chuyển vùng `activeZone` khi chưa hoàn tất.
* **Hậu quả**: Vòng lặp tính toán đồ họa bị hủy, hoạt ảnh 3D Monolith và nhịp giật Kick/Snare bị đóng băng dù nhạc vẫn đang phát.
* **Quy chuẩn Kiểm toán**:
  - Kiểm tra tính nhất quán giữa trạng thái native `<audio>` (`!audioRef.current.paused`) và React state `isPlaying`.
  - Đảm bảo khi `activeZone === 'audio'`, RAF loop luôn tự duy trì với `requestAnimationFrame(animate)`.

---

### 📐 5. Threshold Mismatch Trap (Bẫy Lệch Ngưỡng Bắt Nhịp Tĩnh)
* **Nguyên nhân**: Đặt các hằng số ngưỡng tĩnh quá cao (như `bassFlux > 12.0`, `spectralFlux > 0.45`) khiến các bài hát có âm lượng master nhỏ, acoustic, lofi hoặc sub-bass sâu không bao giờ vượt qua ngưỡng để nổ beat. Ngược lại, nếu đặt quá thấp sẽ bị kích hoạt nhầm bởi giọng hát (vocal bleed).
* **Hậu quả**: Beat visualizer bị "điếc" ở bài êm dịu hoặc "co giật liên tục" ở bài nhiều nhạc cụ.
* **Quy chuẩn Kiểm toán**:
  - Sử dụng thuật toán ngưỡng thích ứng động (Dynamic Adaptive Threshold qua Dual EMA: Fast Filter vs Slow Filter).
  - Tích hợp hồ sơ tần số theo từng bài hát (`trackDrumProfiles.ts`) và cô lập dải tần số đặc trưng (Sub-bass Kick: 30-100Hz, Snare: 200-500Hz, Vocal Formant Isolation).

---

## 🧪 2. BỘ SCRIPT & TEST CHẨN ĐOÁN TỰ ĐỘNG (`tests/unit/audio-graph-diagnostic.test.ts`)

Mỗi khi hệ thống Web Audio hoặc Beat Tracking Engine có thay đổi, `@agent-audio-tester` sẽ tự động thực thi bộ test chẩn đoán tại [`tests/unit/audio-graph-diagnostic.test.ts`](file:///c:/Users/Admin/Documents/hidden-music/tests/unit/audio-graph-diagnostic.test.ts):

1. **Test 1**: Kiểm tra AudioContext Singleton & Resume Policy.
2. **Test 2**: Kiểm tra Thẻ `<audio>` có `crossOrigin="anonymous"` và `playsInline`.
3. **Test 3**: Kiểm tra Thuật toán Phân tích Sóng với Mock Audio Buffer (Sóng Sine 60Hz mô phỏng Sub-bass Kick).
4. **Test 4**: Kiểm tra Khả năng Phát hiện Tín hiệu Câm (CORS Silence / Flat 128 Buffer Detection).
5. **Test 5**: Kiểm tra Bộ lọc Năng lượng Thích ứng Động Dual EMA (Zero Hardcoded Stagnant Thresholds).

---

## 📊 3. MẪU BÁO CÁO CHẨN ĐOÁN (@agent-audio-tester DIAGNOSTIC REPORT)

```markdown
### 🎧 Báo Cáo Chẩn Đoán Web Audio Graph & Beat Pipeline (@agent-audio-tester)

* **Thời gian thực hiện**: [YYYY-MM-DD HH:mm:ss GMT+7]
* **Tình trạng tổng thể**: [PASS / WARN / FAIL]

#### 🔍 1. KẾT QUẢ QUÉT 5 TRỌNG TÂM (5-VECTOR HEALTH CHECK)
- [x] **Vector 1 (AudioContext State)**: [Singleton verified / Autoplay resume hook present]
- [x] **Vector 2 (MediaElement Duplication)**: [Guarded with sourceNodeRef / Zero duplicate connection crashes]
- [x] **Vector 3 (CORS & Taint Guard)**: [crossOrigin="anonymous" set / Fallback synthetic synthesis available]
- [x] **Vector 4 (RAF Loop Consistency)**: [ActiveZone checked / 60-120 FPS render loop verified]
- [x] **Vector 5 (Adaptive Threshold)**: [Dual EMA active / Frequency profile separation configured]

#### 🧪 2. KẾT QUẢ CHẠY TEST MOCK WAVEFORM
- Sóng thử nghiệm Sub-bass 60Hz: RMS = [0.707] (> 0.50), Peak-to-Peak = [1.00] (> 0.80) -> **[PASS]**
- Phát hiện tín hiệu Flat 128 (CORS Silence): Correctly identified & routed to fallback -> **[PASS]**

#### 💡 3. KHUYẾN NGHỊ TỐI ƯU
- [Các đề xuất tinh chỉnh độ nhạy hoặc giảm tải CPU nếu có]
```
