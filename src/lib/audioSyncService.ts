/**
 * =========================================================================
 * HIDDEN MUSIC VAULT - AUDIO-VIDEO TIMELINE SYNCHRONIZATION SERVICE
 * Fast HTTP Range Streaming & Log-Compressed Acoustic Fingerprinting
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
  downsampleRate?: number; // Standardize sample rate for fast FFT/correlation (default: 2000Hz)
  maxOffsetSearchSeconds?: number; // Search range: -10s to +180s (default: 180s)
  onProgress?: (percent: number, step: string) => void;
}

/**
 * Decode pure Audio buffer (MP3, WAV, FLAC, M4A, AAC) to mono PCM Float32Array
 */
async function decodeAudioArrayBufferToPCM(
  arrayBuffer: ArrayBuffer,
  targetSampleRate: number = 2000,
  maxDuration: number = 60
): Promise<Float32Array> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API không được hỗ trợ trên trình duyệt này.');
  }

  const audioCtx = new AudioCtx();
  try {
    await audioCtx.resume();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = Math.min(audioBuffer.duration, maxDuration);
    const totalOutputSamples = Math.floor(duration * targetSampleRate);
    const monoPCM = new Float32Array(totalOutputSamples);

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
 * Stream and capture audio directly from Video URL/File via Native Media Pipeline (MKV, WebM, MP4)
 * Uses HTTP Range requests to avoid downloading 700MB video into RAM!
 */
async function extractAudioFromStreamingVideo(
  videoInput: File | Blob | ArrayBuffer | string,
  targetSampleRate: number = 2000,
  maxDuration: number = 45,
  onProgress?: (percent: number, msg: string) => void
): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    let videoUrl = '';
    let isCreatedBlobUrl = false;

    if (typeof videoInput === 'string') {
      videoUrl = videoInput;
    } else if (videoInput instanceof ArrayBuffer) {
      const blob = new Blob([videoInput], { type: 'video/mp4' });
      videoUrl = URL.createObjectURL(blob);
      isCreatedBlobUrl = true;
    } else {
      videoUrl = URL.createObjectURL(videoInput);
      isCreatedBlobUrl = true;
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = false;
    video.volume = 1;
    video.style.position = 'fixed';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '2px';
    video.style.height = '2px';
    video.style.opacity = '0.01';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      if (video.parentNode) video.parentNode.removeChild(video);
      if (isCreatedBlobUrl) URL.revokeObjectURL(videoUrl);
      reject(new Error('Web Audio API không được hỗ trợ trên trình duyệt này.'));
      return;
    }

    const audioCtx = new AudioCtx();
    let sourceNode: MediaElementAudioSourceNode | null = null;
    let processorNode: ScriptProcessorNode | null = null;

    const sampleChunks: Float32Array[] = [];
    let totalSamplesCollected = 0;
    let nonZeroCount = 0;
    const targetTotalSamples = Math.floor(maxDuration * targetSampleRate);
    let isFinished = false;
    let timeoutId: any = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.pause();
      if (video.parentNode) video.parentNode.removeChild(video);
      try {
        sourceNode?.disconnect();
      } catch {}
      try {
        processorNode?.disconnect();
      } catch {}
      if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
      if (isCreatedBlobUrl) URL.revokeObjectURL(videoUrl);
    };

    const finish = () => {
      if (isFinished) return;
      isFinished = true;

      const merged = new Float32Array(totalSamplesCollected);
      let offset = 0;
      for (const chunk of sampleChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      cleanup();

      if (merged.length === 0 || nonZeroCount < 30) {
        reject(
          new Error(
            'Không thể trích xuất kênh âm thanh từ video (video không có âm thanh hoặc bị chặn giải mã).'
          )
        );
      } else {
        resolve(merged);
      }
    };

    // Timeout safety (30 seconds)
    timeoutId = setTimeout(() => {
      if (totalSamplesCollected > targetSampleRate * 8) {
        finish();
      } else {
        cleanup();
        reject(new Error('Quá thời gian trích xuất âm thanh từ Video (Timeout).'));
      }
    }, 30000);

    video.onerror = () => {
      cleanup();
      reject(new Error(`Lỗi tải video (${video.error?.message || 'Không thể phát định dạng video'}).`));
    };

    video.onloadedmetadata = async () => {
      try {
        await audioCtx.resume();

        // 2x high-speed stream capture (captures 45s of audio in ~22 seconds)
        video.playbackRate = 2.0;

        sourceNode = audioCtx.createMediaElementSource(video);
        processorNode = audioCtx.createScriptProcessor(4096, 1, 1);

        const srcSampleRate = audioCtx.sampleRate;
        const downsampleRatio = srcSampleRate / targetSampleRate;

        processorNode.onaudioprocess = (audioEvt) => {
          if (isFinished) return;

          const inputData = audioEvt.inputBuffer.getChannelData(0);
          const outputLength = Math.floor(inputData.length / downsampleRatio);
          const downsampled = new Float32Array(outputLength);

          for (let i = 0; i < outputLength; i++) {
            const srcIdx = Math.floor(i * downsampleRatio);
            const val = inputData[srcIdx] || 0;
            downsampled[i] = val;
            if (Math.abs(val) > 0.001) {
              nonZeroCount++;
            }
          }

          sampleChunks.push(downsampled);
          totalSamplesCollected += outputLength;

          const secondsCollected = Math.min(maxDuration, Math.round(totalSamplesCollected / targetSampleRate));
          const percent = 25 + Math.round((secondsCollected / maxDuration) * 60);
          if (onProgress) {
            onProgress(percent, `Đang trích xuất luồng âm thanh Video (${secondsCollected}s / ${maxDuration}s)...`);
          }

          if (totalSamplesCollected >= targetTotalSamples || video.currentTime >= maxDuration) {
            finish();
          }
        };

        const dummyGain = audioCtx.createGain();
        dummyGain.gain.value = 0; // Muted to user

        sourceNode.connect(processorNode);
        processorNode.connect(dummyGain);
        dummyGain.connect(audioCtx.destination);

        await video.play();
      } catch (err: any) {
        cleanup();
        reject(new Error(`Lỗi kết nối Web Audio API từ Video: ${err.message}`));
      }
    };

    video.src = videoUrl;
  });
}

/**
 * Compute Log-Compressed Acoustic Fingerprint with Moving Average DC Subtraction
 */
function computeAcousticFingerprint(pcm: Float32Array, windowSize: number = 40): Float32Array {
  const numFrames = Math.floor(pcm.length / windowSize);
  const logEnergy = new Float32Array(numFrames);

  // 1. RMS with Log dynamic range compression
  for (let i = 0; i < numFrames; i++) {
    let sumSquares = 0;
    const start = i * windowSize;
    for (let j = 0; j < windowSize; j++) {
      const val = pcm[start + j] || 0;
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / windowSize);
    logEnergy[i] = Math.log(1 + 25 * rms);
  }

  // 2. Local Moving Average Baseline Subtraction (High-pass filter over ~1.4s window)
  const smoothed = new Float32Array(numFrames);
  const halfWindow = 35; // 35 frames = 0.7s on each side

  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    let count = 0;
    const wStart = Math.max(0, i - halfWindow);
    const wEnd = Math.min(numFrames - 1, i + halfWindow);
    for (let j = wStart; j <= wEnd; j++) {
      sum += logEnergy[j];
      count++;
    }
    const localMean = sum / count;
    smoothed[i] = logEnergy[i] - localMean;
  }

  return smoothed;
}

/**
 * Normalized Cross-Correlation with Peak Prominence Scoring
 */
function computeNormalizedCrossCorrelation(
  audioSignal: Float32Array,
  videoSignal: Float32Array,
  minLagSamples: number,
  maxLagSamples: number
): { bestLag: number; maxScore: number; confidenceRatio: number } {
  const range = maxLagSamples - minLagSamples + 1;
  const scores = new Float32Array(range);

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
  let scoreSum = 0;
  let validScoreCount = 0;

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

    if (count > audioSignal.length * 0.35) {
      const vMean = videoSum / count;
      const vVar = Math.max(0, videoSqSum / count - vMean * vMean);
      const vStd = Math.sqrt(vVar) || 1e-6;

      const normDot = Math.max(0, (dot / count - audioMean * vMean) / (audioStd * vStd));
      scores[scoreIdx] = normDot;
      scoreSum += normDot;
      validScoreCount++;

      if (normDot > maxScore) {
        maxScore = normDot;
        bestLag = lag;
      }
    } else {
      scores[scoreIdx] = 0;
    }
  }

  // Parabolic Sub-sample Peak Interpolation
  const peakIdx = Math.floor(bestLag - minLagSamples);
  if (peakIdx > 0 && peakIdx < range - 1) {
    const alpha = scores[peakIdx - 1];
    const beta = scores[peakIdx];
    const gamma = scores[peakIdx + 1];
    const denom = alpha - 2 * beta + gamma;
    if (denom !== 0) {
      const subOffset = (0.5 * (alpha - gamma)) / denom;
      if (Math.abs(subOffset) < 1) {
        bestLag += subOffset;
      }
    }
  }

  const avgBackground = validScoreCount > 0 ? scoreSum / validScoreCount : 0.05;
  const prominence = maxScore / (avgBackground + 1e-4);

  let confidenceRatio = 0;
  if (maxScore >= 0.35 && prominence >= 2.0) {
    confidenceRatio = Math.min(0.99, Math.round((0.85 + (maxScore - 0.35) * 0.25) * 100) / 100);
  } else if (maxScore >= 0.2) {
    confidenceRatio = Math.min(0.84, Math.max(0.7, Math.round((0.7 + (maxScore - 0.2) * 0.7) * 100) / 100));
  } else if (maxScore >= 0.1) {
    confidenceRatio = Math.min(0.69, Math.max(0.45, Math.round((0.45 + (maxScore - 0.1) * 2.5) * 100) / 100));
  } else {
    confidenceRatio = Math.max(0.1, Math.round(maxScore * 100) / 100);
  }

  return { bestLag, maxScore, confidenceRatio };
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
    maxOffsetSearchSeconds = 180,
    onProgress,
  } = options;

  if (onProgress) onProgress(10, 'Đang tải và giải mã tín hiệu Audio...');

  // 1. Load and Decode Audio PCM
  let audioArrayBuffer: ArrayBuffer;
  if (typeof audioInput === 'string') {
    const res = await fetch(audioInput);
    if (!res.ok) throw new Error(`Không thể tải luồng Audio từ URL (${res.status}): ${res.statusText}`);
    audioArrayBuffer = await res.arrayBuffer();
  } else if (audioInput instanceof ArrayBuffer) {
    audioArrayBuffer = audioInput;
  } else {
    audioArrayBuffer = await audioInput.arrayBuffer();
  }

  const audioPCM = await decodeAudioArrayBufferToPCM(audioArrayBuffer, downsampleRate, maxDurationToAnalyze);

  if (onProgress) onProgress(25, 'Đang kết nối luồng Video MV qua HTTP Range...');

  // 2. Stream and Extract Video Audio PCM without downloading 700MB video into RAM!
  const videoPCM = await extractAudioFromStreamingVideo(
    videoInput,
    downsampleRate,
    maxDurationToAnalyze + maxOffsetSearchSeconds,
    onProgress
  );

  if (onProgress) onProgress(90, 'Đang so khớp sóng âm Acoustic Fingerprinting...');

  // 3. Compute Log Acoustic Fingerprint Envelopes (50 FPS = 20ms precision)
  const windowSize = Math.floor(downsampleRate / 50); // 40 samples per frame @ 2000Hz
  const audioEnvelope = computeAcousticFingerprint(audioPCM, windowSize);
  const videoEnvelope = computeAcousticFingerprint(videoPCM, windowSize);

  const envelopeFrameRate = 50; // 50 frames/sec (20ms precision)
  const minLag = Math.floor(-5 * envelopeFrameRate); // -5s search
  const maxLag = Math.floor(maxOffsetSearchSeconds * envelopeFrameRate); // +45s search

  const { bestLag, confidenceRatio } = computeNormalizedCrossCorrelation(
    audioEnvelope,
    videoEnvelope,
    minLag,
    maxLag
  );

  if (onProgress) onProgress(98, 'Đang hoàn tất phân tích độ lệch...');

  const offsetSeconds = Math.round((bestLag / envelopeFrameRate) * 100) / 100;

  const metadata: SyncMetadata = {
    intro_duration: offsetSeconds > 0 ? offsetSeconds : 0,
    confidence_score: confidenceRatio,
    sample_rate: downsampleRate,
    analyzed_at: new Date().toISOString(),
    method: 'cross_correlation',
    notes: `Đồng bộ thành công với độ khớp ${(confidenceRatio * 100).toFixed(0)}%`,
  };

  const result: AudioSyncResult = {
    offset: offsetSeconds,
    confidence: confidenceRatio,
    introDuration: offsetSeconds > 0 ? offsetSeconds : 0,
    sampleRate: downsampleRate,
    method: 'cross_correlation',
    message: `✅ Phát hiện thành công độ lệch Intro MV: ${offsetSeconds > 0 ? `+${offsetSeconds}s` : `${offsetSeconds}s`} (Độ tin cậy: ${(confidenceRatio * 100).toFixed(0)}%)`,
    metadata,
  };

  if (onProgress) onProgress(100, result.message);

  return result;
}
