import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LiveWaveformBeatEngine } from '../../src/lib/dsp/liveWaveformBeat.ts';

test('1. Kiểm tra cấu hình AudioContext singleton và resume policy', () => {
  const playerContextPath = path.resolve(process.cwd(), 'src/context/PlayerContext.tsx');
  const content = fs.readFileSync(playerContextPath, 'utf8');

  // 1. AudioContext must be maintained in a useRef (Singleton across renders)
  assert.ok(
    content.includes('audioContextRef = useRef<AudioContext | null>(null)'),
    'PlayerContext.tsx must maintain audioContext in a useRef singleton'
  );

  // 2. AudioContext initialization must be guarded against recreation
  assert.ok(
    content.includes('if (!audioContextRef.current)'),
    'PlayerContext.tsx must guard audioContext creation against recreation'
  );

  // 3. Resume policy on suspended state
  assert.ok(
    content.includes("audioContextRef.current?.state === 'suspended'"),
    'PlayerContext.tsx must check suspended state'
  );
  assert.ok(
    content.includes('audioContextRef.current.resume()'),
    'PlayerContext.tsx must resume audioContext'
  );

  // 4. MediaElementSource connection must be guarded against duplicate connection
  assert.ok(
    content.includes('!sourceNodeRef.current'),
    'PlayerContext.tsx must guard createMediaElementSource against multiple connections'
  );
});

test('2. Kiểm tra phần tử <audio> có thuộc tính crossOrigin="anonymous"', () => {
  const playerContextPath = path.resolve(process.cwd(), 'src/context/PlayerContext.tsx');
  const content = fs.readFileSync(playerContextPath, 'utf8');

  assert.ok(
    content.includes('crossOrigin="anonymous"'),
    'PlayerContext.tsx must set crossOrigin="anonymous" on audio element'
  );

  assert.ok(
    content.includes('playsInline'),
    'PlayerContext.tsx must set playsInline on audio element'
  );
});

test('3. Kiểm tra thuật toán phân tích sóng với Mock Audio Buffer', () => {
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

  assert.ok(rms > 0.5, `Expected RMS > 0.5, got ${rms}`);
  assert.ok(peakToPeak > 0.8, `Expected peakToPeak > 0.8, got ${peakToPeak}`);
});

test('4. Kiểm tra khả năng phát hiện tín hiệu câm (CORS Silence / Flat 128 Buffer)', () => {
  const engine = new LiveWaveformBeatEngine(512);

  // Mảng phẳng 128 (đặc trưng của luồng CORS bị chặn hoặc chưa có tín hiệu)
  const flat128Array = new Uint8Array(512).fill(128);
  const result128 = engine.processWaveformArray(flat128Array, 1000);
  assert.equal(result128.isBeat, false);
  assert.equal(result128.rms, 0);
  assert.equal(result128.peakToPeak, 0);

  // Mảng toàn 0
  const zeroArray = new Uint8Array(512).fill(0);
  const resultZero = engine.processWaveformArray(zeroArray, 1000);
  assert.equal(resultZero.isBeat, false);
  assert.equal(resultZero.rms, 0);
});

test('5. Kiểm tra tính năng bắt nhịp thích ứng động Dual EMA trên LiveWaveformBeatEngine', () => {
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
  assert.equal(beatResult.isBeat, true);
  assert.ok(beatResult.kickForce > 0);
  assert.ok(beatResult.energyFlux > 0.04);
});

test('6. Kiểm tra khả năng bắt kick nhỏ và các đợt kick dồn dập (Consecutive Kick Rolls)', () => {
  const engine = new LiveWaveformBeatEngine(512, 0.016, 60);

  // 1. Kiểm tra kick nhỏ (Soft kick: biên độ vừa phải)
  const softKickArray = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    const sample = Math.sin((2 * Math.PI * 60 * i) / 44100) * 0.35; // 35% amplitude
    softKickArray[i] = Math.floor((sample + 1) * 127.5);
  }
  const softResult = engine.processWaveformArray(softKickArray, 200);
  assert.equal(softResult.isBeat, true);
  assert.ok(softResult.kickForce > 0.01);

  // 2. Kiểm tra chuỗi kick dồn dập cách nhau 70ms (Rapid Trap/Drill double-kick roll)
  const secondRollResult = engine.processWaveformArray(softKickArray, 275);
  assert.equal(secondRollResult.isBeat, true);
  assert.ok(secondRollResult.kickForce > 0.01);
});
