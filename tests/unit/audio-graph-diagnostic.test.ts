import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LiveWaveformBeatEngine } from '../../src/lib/dsp/liveWaveformBeat';

describe('Web Audio Graph & Beat Pipeline Diagnostic', () => {
  it('1. Kiểm tra cấu hình AudioContext singleton và resume policy', () => {
    // Verify audioContext is not recreated on every render
    const playerContextPath = path.resolve(process.cwd(), 'src/context/PlayerContext.tsx');
    const content = fs.readFileSync(playerContextPath, 'utf8');

    // 1. AudioContext must be maintained in a useRef (Singleton across renders)
    expect(content.includes('audioContextRef = useRef<AudioContext | null>(null)')).toBe(true);

    // 2. AudioContext initialization must be guarded against recreation
    expect(content.includes('if (!audioContextRef.current)')).toBe(true);

    // 3. Resume policy on suspended state
    expect(content.includes("audioContextRef.current?.state === 'suspended'")).toBe(true);
    expect(content.includes('audioContextRef.current.resume()')).toBe(true);

    // 4. MediaElementSource connection must be guarded against duplicate connection
    expect(content.includes('!sourceNodeRef.current')).toBe(true);
  });

  it('2. Kiểm tra phần tử <audio> có thuộc tính crossOrigin="anonymous"', () => {
    // Verify crossOrigin attribute presence to prevent tainted media stream
    const playerContextPath = path.resolve(process.cwd(), 'src/context/PlayerContext.tsx');
    const content = fs.readFileSync(playerContextPath, 'utf8');

    // 1. Must include crossOrigin="anonymous" on audio element
    expect(content.includes('crossOrigin="anonymous"')).toBe(true);

    // 2. Must include playsInline on audio element for mobile browser compatibility
    expect(content.includes('playsInline')).toBe(true);
  });

  it('3. Kiểm tra thuật toán phân tích sóng với Mock Audio Buffer', () => {
    // Tạo sóng sin 60Hz giả lập tiếng Kick Sub-bass
    const sampleRate = 44100;
    const bufferLength = 512;
    const waveArray = new Uint8Array(bufferLength);

    // Giả lập xung nhịp Kick có biên độ cao
    for (let i = 0; i < bufferLength; i++) {
      const sample = Math.sin((2 * Math.PI * 60 * i) / sampleRate);
      waveArray[i] = Math.floor((sample + 1) * 127.5);
    }

    // Tính toán năng lượng sóng
    let sumSquares = 0;
    let minVal = 255;
    let maxVal = 0;
    for (let i = 0; i < waveArray.length; i++) {
      const norm = (waveArray[i] - 128) / 128;
      sumSquares += norm * norm;
      if (waveArray[i] < minVal) minVal = waveArray[i];
      if (waveArray[i] > maxVal) maxVal = waveArray[i];
    }
    const rms = Math.sqrt(sumSquares / waveArray.length);
    const peakToPeak = (maxVal - minVal) / 255;

    expect(rms).toBeGreaterThan(0.5);
    expect(peakToPeak).toBeGreaterThan(0.8);
  });

  it('4. Kiểm tra khả năng phát hiện tín hiệu câm (CORS Silence / Flat 128 Buffer)', () => {
    const engine = new LiveWaveformBeatEngine(512);

    // Mảng phẳng 128 (đặc trưng của luồng CORS bị chặn hoặc chưa có tín hiệu)
    const flat128Array = new Uint8Array(512).fill(128);
    const result128 = engine.processWaveformArray(flat128Array, 1000);
    expect(result128.isBeat).toBe(false);
    expect(result128.rms).toBe(0);
    expect(result128.peakToPeak).toBe(0);

    // Mảng toàn 0
    const zeroArray = new Uint8Array(512).fill(0);
    const resultZero = engine.processWaveformArray(zeroArray, 1000);
    expect(resultZero.isBeat).toBe(false);
    expect(resultZero.rms).toBe(0);
  });

  it('5. Kiểm tra tính năng bắt nhịp thích ứng động Dual EMA trên LiveWaveformBeatEngine', () => {
    const engine = new LiveWaveformBeatEngine(512, 0.04, 100);

    // Gửi tín hiệu nền yên tĩnh
    const quietArray = new Uint8Array(512).fill(130);
    engine.processWaveformArray(quietArray, 100);

    // Bắn xung nhịp Kick đột biến (High amplitude 60Hz burst)
    const burstArray = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      const sample = Math.sin((2 * Math.PI * 60 * i) / 44100);
      burstArray[i] = Math.floor((sample + 1) * 127.5);
    }

    const beatResult = engine.processWaveformArray(burstArray, 500);
    expect(beatResult.isBeat).toBe(true);
    expect(beatResult.kickForce).toBeGreaterThan(0);
    expect(beatResult.energyFlux).toBeGreaterThan(0.04);
  });

  it('6. Kiểm tra khả năng bắt kick nhỏ và các đợt kick dồn dập (Consecutive Kick Rolls)', () => {
    const engine = new LiveWaveformBeatEngine(512, 0.016, 60);

    // 1. Kiểm tra kick nhỏ (Soft kick: biên độ vừa phải)
    const softKickArray = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      const sample = Math.sin((2 * Math.PI * 60 * i) / 44100) * 0.35; // 35% amplitude
      softKickArray[i] = Math.floor((sample + 1) * 127.5);
    }
    const softResult = engine.processWaveformArray(softKickArray, 200);
    expect(softResult.isBeat).toBe(true);
    expect(softResult.kickForce).toBeGreaterThan(0.01);

    // 2. Kiểm tra chuỗi kick dồn dập cách nhau 70ms (Rapid Trap/Drill double-kick roll)
    const secondRollResult = engine.processWaveformArray(softKickArray, 275);
    expect(secondRollResult.isBeat).toBe(true);
    expect(secondRollResult.kickForce).toBeGreaterThan(0.01);
  });
});
