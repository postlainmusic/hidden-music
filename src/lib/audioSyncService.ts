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
  maxDurationToAnalyze?: number; // Analyze first N seconds (default: 45s)
  downsampleRate?: number; // Standardize sample rate for fast FFT/correlation (default: 4000Hz)
  maxOffsetSearchSeconds?: number; // Search range: -10s to +45s (default: 35s)
  onProgress?: (percent: number, step: string) => void;
}

/**
 * Decode pure Audio (MP3, WAV, FLAC, M4A, AAC) to mono PCM Float32Array
 */
async function decodeAudioArrayBufferToPCM(
  arrayBuffer: ArrayBuffer,
  targetSampleRate: number = 4000,
  maxDuration: number = 45
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
 * Extract mono PCM samples from Video (File, Blob, or URL) using Headless HTMLVideoElement + Web Audio API
 */
async function extractAudioPCMFromVideo(
  videoInput: File | Blob | ArrayBuffer | string,
  targetSampleRate: number = 4000,
  maxDuration: number = 45,
  onProgress?: (msg: string) => void
): Promise<Float32Array> {
  // Strategy 1: Try direct arrayBuffer decodeAudioData (if browser supports container)
  if (videoInput instanceof ArrayBuffer) {
    try {
      return await decodeAudioArrayBufferToPCM(videoInput, targetSampleRate, maxDuration);
    } catch {
      // Fallback below
    }
  } else if (videoInput instanceof File || videoInput instanceof Blob) {
    try {
      const buffer = await videoInput.arrayBuffer();
      return await decodeAudioArrayBufferToPCM(buffer, targetSampleRate, maxDuration);
    } catch {
      // Fallback below
    }
  }

  // Strategy 2: Same-Origin Blob + Headless HTMLVideoElement Audio Capture
  let videoBlob: Blob;
  if (typeof videoInput === 'string') {
    if (onProgress) onProgress('Đang tải dữ liệu tệp Video để giải mã âm thanh...');
    const res = await fetch(videoInput);
    if (!res.ok) throw new Error(`Không thể tải video từ URL (${res.status}): ${res.statusText}`);
    videoBlob = await res.blob();
  } else if (videoInput instanceof Blob) {
    videoBlob = videoInput;
  } else if (videoInput instanceof ArrayBuffer) {
    videoBlob = new Blob([videoInput], { type: 'video/mp4' });
  } else {
    videoBlob = videoInput;
  }

  return new Promise((resolve, reject) => {
    const localBlobUrl = URL.createObjectURL(videoBlob);
    let timeoutId: any = null;
    let sourceNode: MediaElementAudioSourceNode | null = null;
    let processorNode: ScriptProcessorNode | null = null;
    let audioCtx: AudioContext | null = null;
    let isFinished = false;
    const sampleChunks: Float32Array[] = [];
    let totalSamplesCollected = 0;
    let nonZeroSampleCount = 0;
    const targetTotalSamples = Math.floor(maxDuration * targetSampleRate);

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = false;
    video.volume = 1;
    video.style.display = 'none';
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    document.body.appendChild(video);

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      }
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch {}
      }
      if (processorNode) {
        try { processorNode.disconnect(); } catch {}
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      URL.revokeObjectURL(localBlobUrl);
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

      if (merged.length === 0 || nonZeroSampleCount < 50) {
        reject(
          new Error(
            'Không thể trích xuất kênh âm thanh từ video (video không có tiếng hoặc bị tắt âm).'
          )
        );
      } else {
        resolve(merged);
      }
    };

    // Timeout safety (20s max)
    timeoutId = setTimeout(() => {
      if (totalSamplesCollected > targetSampleRate * 8) {
        finish();
      } else {
        cleanup();
        reject(new Error('Quá thời gian trích xuất âm thanh từ Video (Timeout).'));
      }
    }, 20000);

    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          `Lỗi phát Video: ${video.error?.message || 'Không thể giải mã định dạng video'}`
        )
      );
    };

    video.onloadedmetadata = async () => {
      try {
        if (onProgress) onProgress('Đang bắt đầu trích xuất âm thanh từ Video MV...');

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          cleanup();
          reject(new Error('Web Audio API không được hỗ trợ trên trình duyệt này.'));
          return;
        }

        audioCtx = new AudioCtx();
        await audioCtx.resume();

        // 2x safe playback rate without dropping audio packets
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
              nonZeroSampleCount++;
            }
          }

          sampleChunks.push(downsampled);
          totalSamplesCollected += outputLength;

          const secondsCollected = Math.min(maxDuration, Math.round(totalSamplesCollected / targetSampleRate));
          if (onProgress && secondsCollected % 5 === 0) {
            onProgress(`Đang trích xuất kênh âm thanh Video: ${secondsCollected}s / ${maxDuration}s...`);
          }

          if (totalSamplesCollected >= targetTotalSamples || video.currentTime >= maxDuration) {
            finish();
          }
        };

        // Mute to speakers (user won't hear sound during analysis)
        const dummyGain = audioCtx.createGain();
        dummyGain.gain.value = 0;

        sourceNode.connect(processorNode);
        processorNode.connect(dummyGain);
        dummyGain.connect(audioCtx.destination);

        await video.play();
      } catch (err: any) {
        cleanup();
        reject(new Error(`Lỗi kết nối Web Audio API từ Video: ${err.message}`));
      }
    };

    video.src = localBlobUrl;
  });
}

/**
 * Compute Root-Mean-Square (RMS) Energy Envelope of PCM signal
 */
function computeEnergyEnvelope(pcm: Float32Array, windowSize: number = 40): Float32Array {
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
): { bestLag: number; maxScore: number; confidenceRatio: number } {
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

  // Parabolic Sub-sample Peak Interpolation for Sub-frame Millisecond Accuracy
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

  // Confidence calculation: peak score + prominence over background
  const avgBackground = validScoreCount > 0 ? scoreSum / validScoreCount : 0.1;
  const prominence = maxScore / (avgBackground + 1e-4);
  const confidenceRatio = Math.max(
    0,
    Math.min(1, Math.round((Math.max(0, maxScore) * 0.7 + Math.min(1, prominence / 2.5) * 0.3) * 100) / 100)
  );

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
    maxDurationToAnalyze = 40,
    downsampleRate = 4000,
    maxOffsetSearchSeconds = 35,
    onProgress,
  } = options;

  if (onProgress) onProgress(15, 'Đang tải và giải mã tín hiệu Audio...');

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

  if (onProgress) onProgress(45, 'Đang trích xuất kênh âm thanh từ Video MV...');

  // 2. Extract Video Audio PCM using Same-Origin Blob Video Processor
  const videoPCM = await extractAudioPCMFromVideo(
    videoInput,
    downsampleRate,
    maxDurationToAnalyze + maxOffsetSearchSeconds,
    (msg) => {
      if (onProgress) onProgress(65, msg);
    }
  );

  if (onProgress) onProgress(85, 'Đang so khớp sóng âm Cross-Correlation & Waveform Fingerprinting...');

  // 3. Compute Energy Envelopes (100 FPS)
  const windowSize = Math.floor(downsampleRate / 100); // 40 samples per envelope frame
  const audioEnvelope = computeEnergyEnvelope(audioPCM, windowSize);
  const videoEnvelope = computeEnergyEnvelope(videoPCM, windowSize);

  const envelopeFrameRate = 100; // 100 frames/sec (10ms precision)
  const minLag = Math.floor(-5 * envelopeFrameRate); // -5s search
  const maxLag = Math.floor(maxOffsetSearchSeconds * envelopeFrameRate); // +35s search

  const { bestLag, confidenceRatio } = computeNormalizedCrossCorrelation(
    audioEnvelope,
    videoEnvelope,
    minLag,
    maxLag
  );

  if (onProgress) onProgress(98, 'Đang hoàn tất phân tích độ lệch...');

  const offsetSeconds = Math.round((bestLag / envelopeFrameRate) * 100) / 100;
  const isConfident = confidenceRatio >= 0.35;
  const finalOffset = isConfident ? offsetSeconds : 0;

  const metadata: SyncMetadata = {
    intro_duration: finalOffset > 0 ? finalOffset : 0,
    confidence_score: confidenceRatio,
    sample_rate: downsampleRate,
    analyzed_at: new Date().toISOString(),
    method: 'cross_correlation',
    notes: isConfident
      ? `Đồng bộ thành công với độ khớp ${(confidenceRatio * 100).toFixed(0)}%`
      : `Độ khớp thấp (${(confidenceRatio * 100).toFixed(0)}%), fallback về 0s`,
  };

  const result: AudioSyncResult = {
    offset: finalOffset,
    confidence: confidenceRatio,
    introDuration: finalOffset > 0 ? finalOffset : 0,
    sampleRate: downsampleRate,
    method: 'cross_correlation',
    message: isConfident
      ? `✅ Phát hiện thành công độ lệch Intro MV: ${finalOffset > 0 ? `+${finalOffset}s` : `${finalOffset}s`} (Độ tin cậy: ${(confidenceRatio * 100).toFixed(0)}%)`
      : `⚠️ Tín hiệu âm thanh Audio và Video có sự khác biệt lớn. Độ lệch mặc định: 0s`,
    metadata,
  };

  if (onProgress) onProgress(100, result.message);

  return result;
}
