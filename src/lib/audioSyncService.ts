/**
 * =========================================================================
 * HIDDEN MUSIC VAULT - AUDIO-VIDEO TIMELINE SYNCHRONIZATION SERVICE
 * Automatic Waveform Fingerprinting & Cross-Correlation Matching Algorithm
 * =========================================================================
 */

import { SyncMetadata } from '@/types/database';

export interface AudioSyncResult {
  offset: number; // In seconds (e.g. +13.78s: Video is 13.78s ahead of Audio)
  confidence: number; // 0.0 to 1.0 (e.g. 0.95 = 95% certainty)
  introDuration: number;
  outroStart?: number;
  sampleRate: number;
  method: 'cross_correlation' | 'energy_envelope' | 'manual';
  message: string;
  metadata: SyncMetadata;
}

export interface AudioSyncOptions {
  maxDurationToAnalyze?: number; // Analyze first N seconds (default: 60s)
  downsampleRate?: number; // Standardize to low sample rate for fast FFT/correlation (default: 2000Hz)
  maxOffsetSearchSeconds?: number; // Search range: -15s to +60s (default: 45s)
  onProgress?: (percent: number, step: string) => void;
}

/**
 * Helper: Extract mono PCM Float32Array from Audio/Video File or ArrayBuffer
 */
async function decodeMediaToMonoPCM(
  input: File | Blob | ArrayBuffer,
  targetSampleRate: number = 2000,
  maxDuration: number = 60
): Promise<Float32Array> {
  if (typeof window === 'undefined') {
    throw new Error('Web Audio API chỉ khả dụng trên client-side.');
  }

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API không được hỗ trợ trên trình duyệt này.');
  }

  const audioCtx = new AudioCtx();
  try {
    let arrayBuffer: ArrayBuffer;
    if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
    } else {
      arrayBuffer = await input.arrayBuffer();
    }

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = Math.min(audioBuffer.duration, maxDuration);
    const totalOutputSamples = Math.floor(duration * targetSampleRate);
    const monoPCM = new Float32Array(totalOutputSamples);

    // Mixdown all channels to mono and downsample via linear interpolation
    const numChannels = audioBuffer.numberOfChannels;
    const channelData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channelData.push(audioBuffer.getChannelData(c));
    }

    const srcSampleRate = audioBuffer.sampleRate;
    const ratio = srcSampleRate / targetSampleRate;

    for (let i = 0; i < totalOutputSamples; i++) {
      const srcIndex = i * ratio;
      const indexFloor = Math.floor(srcIndex);
      const frac = srcIndex - indexFloor;

      let sampleSum = 0;
      for (let c = 0; c < numChannels; c++) {
        const cData = channelData[c];
        const s1 = cData[indexFloor] || 0;
        const s2 = cData[indexFloor + 1] || s1;
        sampleSum += s1 + frac * (s2 - s1);
      }
      monoPCM[i] = sampleSum / numChannels;
    }

    return monoPCM;
  } finally {
    audioCtx.close().catch(() => {});
  }
}

/**
 * Compute Root-Mean-Square (RMS) Energy Envelope of PCM signal
 */
function computeEnergyEnvelope(pcm: Float32Array, windowSize: number = 20): Float32Array {
  const numFrames = Math.floor(pcm.length / windowSize);
  const envelope = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    let sumSquares = 0;
    const start = i * windowSize;
    for (let j = 0; j < windowSize; j++) {
      const val = pcm[start + j] || 0;
      sumSquares += val * val;
    }
    envelope[i] = Math.sqrt(sumSquares / windowSize);
  }

  // Normalize envelope
  let max = 0;
  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] > max) max = envelope[i];
  }
  if (max > 0) {
    for (let i = 0; i < envelope.length; i++) {
      envelope[i] /= max;
    }
  }

  return envelope;
}

/**
 * Normalized Cross-Correlation between Audio and Video Signals
 */
function computeNormalizedCrossCorrelation(
  audioSignal: Float32Array,
  videoSignal: Float32Array,
  minLagSamples: number,
  maxLagSamples: number
): { bestLag: number; maxScore: number; scores: Float32Array } {
  const range = maxLagSamples - minLagSamples + 1;
  const scores = new Float32Array(range);

  // Mean centering audio
  let audioMean = 0;
  for (let i = 0; i < audioSignal.length; i++) audioMean += audioSignal[i];
  audioMean /= audioSignal.length;

  let audioVar = 0;
  for (let i = 0; i < audioSignal.length; i++) {
    const diff = audioSignal[i] - audioMean;
    audioVar += diff * diff;
  }
  const audioStd = Math.sqrt(audioVar) || 1e-6;

  let maxScore = -1;
  let bestLag = 0;

  for (let lag = minLagSamples; lag <= maxLagSamples; lag++) {
    const scoreIdx = lag - minLagSamples;

    let dot = 0;
    let videoSum = 0;
    let videoSqSum = 0;
    let count = 0;

    for (let i = 0; i < audioSignal.length; i++) {
      const vIdx = i + lag;
      if (vIdx >= 0 && vIdx < videoSignal.length) {
        const vVal = videoSignal[vIdx];
        const aVal = audioSignal[i];
        dot += aVal * vVal;
        videoSum += vVal;
        videoSqSum += vVal * vVal;
        count++;
      }
    }

    if (count > audioSignal.length * 0.4) {
      const vMean = videoSum / count;
      const vVar = Math.max(0, videoSqSum / count - vMean * vMean);
      const vStd = Math.sqrt(vVar) || 1e-6;

      const normDot = (dot / count - audioMean * vMean) / (audioStd * vStd);
      scores[scoreIdx] = normDot;

      if (normDot > maxScore) {
        maxScore = normDot;
        bestLag = lag;
      }
    } else {
      scores[scoreIdx] = 0;
    }
  }

  // Parabolic Sub-sample Peak Interpolation for Sub-frame Millisecond Accuracy
  const peakIdx = bestLag - minLagSamples;
  if (peakIdx > 0 && peakIdx < range - 1) {
    const alpha = scores[peakIdx - 1];
    const beta = scores[peakIdx];
    const gamma = scores[peakIdx + 1];
    const denom = alpha - 2 * beta + gamma;
    if (denom !== 0) {
      const subOffset = (0.5 * (alpha - gamma)) / denom;
      bestLag += subOffset;
    }
  }

  return { bestLag, maxScore, scores };
}

/**
 * Main Automatic Audio-Video Timeline Synchronizer
 */
export async function calculateAudioVideoSync(
  audioInput: File | Blob | ArrayBuffer | string,
  videoInput: File | Blob | ArrayBuffer | string,
  options: AudioSyncOptions = {}
): Promise<AudioSyncResult> {
  const {
    maxDurationToAnalyze = 60,
    downsampleRate = 2000,
    maxOffsetSearchSeconds = 60,
    onProgress,
  } = options;

  if (onProgress) onProgress(10, 'Đang trích xuất dữ liệu âm thanh từ tệp Audio...');

  // 1. Load Audio Data
  let audioData: ArrayBuffer | Blob;
  if (typeof audioInput === 'string') {
    const res = await fetch(audioInput);
    if (!res.ok) throw new Error(`Không thể tải luồng Audio từ URL: ${res.statusText}`);
    audioData = await res.arrayBuffer();
  } else {
    audioData = audioInput;
  }

  const audioPCM = await decodeMediaToMonoPCM(audioData, downsampleRate, maxDurationToAnalyze);

  if (onProgress) onProgress(40, 'Đang trích xuất kênh âm thanh từ tệp Video MV...');

  // 2. Load Video Data
  let videoData: ArrayBuffer | Blob;
  if (typeof videoInput === 'string') {
    const res = await fetch(videoInput);
    if (!res.ok) throw new Error(`Không thể tải luồng Video từ URL: ${res.statusText}`);
    videoData = await res.arrayBuffer();
  } else {
    videoData = videoInput;
  }

  const videoPCM = await decodeMediaToMonoPCM(videoData, downsampleRate, maxDurationToAnalyze + maxOffsetSearchSeconds);

  if (onProgress) onProgress(70, 'Đang chạy thuật toán Cross-Correlation & Waveform Fingerprinting...');

  // 3. Compute Envelopes
  const audioEnvelope = computeEnergyEnvelope(audioPCM, 20); // 100 Hz frame rate
  const videoEnvelope = computeEnergyEnvelope(videoPCM, 20);

  const envelopeFrameRate = downsampleRate / 20; // 100 frames/sec (10ms per frame)
  const minLag = Math.floor(-10 * envelopeFrameRate); // -10s search
  const maxLag = Math.floor(maxOffsetSearchSeconds * envelopeFrameRate); // +60s search

  const { bestLag, maxScore } = computeNormalizedCrossCorrelation(audioEnvelope, videoEnvelope, minLag, maxLag);

  if (onProgress) onProgress(95, 'Đang hoàn tất phân tích độ lệch Timeline...');

  const offsetSeconds = Math.round((bestLag / envelopeFrameRate) * 100) / 100;
  const confidence = Math.max(0, Math.min(1, Math.round(maxScore * 100) / 100));

  const isConfident = confidence >= 0.45;
  const finalOffset = isConfident ? offsetSeconds : 0;

  const metadata: SyncMetadata = {
    intro_duration: finalOffset > 0 ? finalOffset : 0,
    confidence_score: confidence,
    sample_rate: downsampleRate,
    analyzed_at: new Date().toISOString(),
    method: 'cross_correlation',
    notes: isConfident
      ? `Đồng bộ chính xác với độ tương đồng ${(confidence * 100).toFixed(1)}%`
      : `Độ tương đồng thấp (${(confidence * 100).toFixed(1)}%), fallback về 0s`,
  };

  const result: AudioSyncResult = {
    offset: finalOffset,
    confidence,
    introDuration: finalOffset > 0 ? finalOffset : 0,
    sampleRate: downsampleRate,
    method: 'cross_correlation',
    message: isConfident
      ? `✅ Phát hiện thành công độ lệch Intro MV: ${finalOffset > 0 ? `+${finalOffset}s` : `${finalOffset}s`} (Độ tin cậy: ${(confidence * 100).toFixed(1)}%)`
      : `⚠️ Tín hiệu âm thanh Audio và Video có cấu trúc khác biệt. Độ lệch mặc định: 0s`,
    metadata,
  };

  if (onProgress) onProgress(100, result.message);

  return result;
}
