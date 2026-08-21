# 🥁 TRACK DRUM & ACOUSTIC PROFILES — ALBUM HVL

> **MỤC ĐÍCH**: Tài liệu này lưu trữ vĩnh viễn các phân tích đặc trưng âm học, cấu trúc Drum Kit (Kick, Snare, Hi-hats, 808s), dải tần số chủ đạo và Tempo (BPM) của các bài hát cốt lõi trong **Album HVL** để làm chuẩn cho `BeatDetector`, `MeydaEngine` và hiệu ứng sân khấu `LiveStageShow`.

---

## 🎵 1. BẢNG TỔNG HỢP ĐẶC TRƯNG DRUM CÁC TRACK CỐT LÕI

| Bài Hát | Tempo (BPM) | Cấu Trúc Kick / 808 | Đặc Tính Snare / Clap | Dải Hi-Hats & Transients | Điểm Nhấn Nhịp Học (Groove) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **01. Elegie** | `~75 / 150 BPM` | Sub-bass 808 trầm sâu (35Hz - 60Hz), sustain kéo dài, thưa thớt | Rimshot / Snap sắc gọn, reverb không gian rộng | Hi-hats 1/16 và 1/32 lướt nhẹ ở dải 8kHz - 14kHz | Intro ambient melo-trap, lơ lửng, tạo độ rơi mạnh ở cú kick đầu bar |
| **02. IDK (MCK)** | `~134 BPM` | Kick đập nén mạnh (Punchy attack 60Hz - 100Hz), 808 slide trượt | Snare giòn, đanh (1.2kHz - 2.5kHz), tấn công nhanh | Hi-hats triplet dày đặc, chuyển động dynamic pan | Trap/R&B Drill nảy mạnh, kick giật dứt khoát làm rung sàn sân khấu |
| **03. Ai Mới Là Kẻ Xấu Xa** | `~88 BPM` | Acoustic Kick đầm ấm (80Hz - 120Hz), đuôi decay ngắn, chắc nịch | Layered Clap + Fat Snare ấm, reverb tail sâu lắng | Hi-hat 1/8 đánh đều đặn, phủ lớp bụi đĩa than vinyl crackle | Soulful Hip-Hop tự sự, groove lắc lư chậm rãi, nhịp đập tim |

---

## 🎛️ 2. THÔNG SỐ CẤU HÌNH MEYDA DSP DÀNH CHO CÁC TRACK NÀY

```typescript
export const TRACK_DRUM_PROFILES: Record<string, {
  bpm: number;
  kickBand: [number, number]; // Hz
  snareBand: [number, number]; // Hz
  fluxSensitivity: number;
  springTension: number;
  springDampening: number;
}> = {
  // 01. Elegie (Deep Atmospheric Sub-bass)
  'elegie': {
    bpm: 75,
    kickBand: [30, 70],
    snareBand: [1200, 3500],
    fluxSensitivity: 1.45,
    springTension: 0.28,
    springDampening: 0.65,
  },
  // 02. IDK (Punchy Trap / Drill 808s)
  'idk': {
    bpm: 134,
    kickBand: [50, 110],
    snareBand: [1000, 3000],
    fluxSensitivity: 1.25,
    springTension: 0.35,
    springDampening: 0.58,
  },
  // 03. Ai Mới Là Kẻ Xấu Xa (Soulful Hip-Hop Warmth)
  'ai-moi-la-ke-xau-xa': {
    bpm: 88,
    kickBand: [70, 130],
    snareBand: [800, 2400],
    fluxSensitivity: 1.30,
    springTension: 0.30,
    springDampening: 0.62,
  },
};
```
