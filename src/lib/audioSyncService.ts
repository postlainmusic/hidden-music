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
  downsampleRate?: number; // Standardize sample rate for fast FFT/correlation (default: 8000Hz)
  maxOffsetSearchSeconds?: number; // Search range: -10s to +45s (default: 40s)
  onProgress?: (percent: number, step: string) => void;
}

/**
 * Decode pure Audio (MP3, WAV, FLAC, M4A, AAC) to mono PCM Float32Array
 */
async function decodeAudioArrayBufferToPCM(
  arrayBuffer: ArrayBuffer,
  targetSampleRate: number = 8000,
  maxDuration: number = 45
): Promise<Float32Array> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API không được hỗ trợ trên trình duyệt này.');
  }

  const audioCtx = new AudioCtx();
  try {
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
  targetSampleRate: number = 8000,
  maxDuration: number = 45,
  onProgress?: (msg: string) => void
): Promise<Float32Array> {
  // Strategy 1: Try direct arrayBuffer decodeAudioData (if browser demuxer supports container)
  if (videoInput instanceof ArrayBuffer) {
    try {
      return await decodeAudioArrayBufferToPCM(videoInput, targetSampleRate, maxDuration);
    } catch {
      videoInput = new Blob([videoInput], { type: 'video/mp4' });
    }
  } else if (videoInput instanceof File || videoInput instanceof Blob) {
    try {
      const buffer = await videoInput.arrayBuffer();
      return await decodeAudioArrayBufferToPCM(buffer, targetSampleRate, maxDuration);
    } catch {
      // Fallback to Headless HTMLVideoElement Audio Capture below
    }
  }

  // Strategy 2: Fast Headless HTMLVideoElement Audio Capture with 8x High-Speed Buffer Stream
  return new Promise((resolve, reject) => {
    let videoUrl = '';
    let isCreatedBlobUrl = false;
    let timeoutId: any = null;
    let sourceNode: MediaElementAudioSourceNode | null = null;
    let processorNode: ScriptProcessorNode | null = null;
    let audioCtx: AudioContext | null = null;
    let isFinished = false;
    const sampleChunks: Float32Array[] = [];
    let totalSamplesCollected = 0;
    const targetTotalSamples = Math.floor(maxDuration * targetSampleRate);

    if (typeof videoInput === 'string') {
      videoUrl = videoInput;
    } else {
      videoUrl = URL.createObjectURL(videoInput);
      isCreatedBlobUrl = true;
    }

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
        try {
          sourceNode.disconnect();
        } catch {}
      }
      if (processorNode) {
        try {
          processorNode.disconnect();
        } catch {}
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      if (isCreatedBlobUrl) {
        URL.revokeObjectURL(videoUrl);
      }
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

      if (merged.length === 0) {
        reject(
          new Error(
            'Không thể trích xuất kênh âm thanh từ video (video không có âm thanh hoặc bị chặn CORS).'
          )
        );
      } else {
        resolve(merged);
      }
    };

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      cleanup();
      reject(new Error('Web Audio API không được hỗ trợ trên trình duyệt này.'));
      return;
    }

    audioCtx = new AudioCtx();

    // Timeout safety (14s max)
    timeoutId = setTimeout(() => {
      if (totalSamplesCollected > targetSampleRate * 8) {
        // Captured sufficient audio samples (>= 8s), proceed to correlation
        finish();
      } else {
        cleanup();
        reject(new Error('Quá thời gian trích xuất âm thanh từ Video (Timeout).'));
      }
    }, 14000);

    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          `Lỗi phát Video: ${video.error?.message || 'Không thể giải mã định dạng video hoặc bị chặn CORS'}`
        )
      );
    };

    video.onloadedmetadata = () => {
      try {
        if (onProgress) onProgress('Đang thu thập âm thanh tốc độ cao từ Video MV...');

        // 8x high speed extraction (captures 45s of video audio in ~5 seconds)
        video.playbackRate = 8.0;

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
            downsampled[i] = inputData[srcIdx] || 0;
          }

          sampleChunks.push(downsampled);
          totalSamplesCollected += outputLength;

          const secondsCollected = Math.min(maxDuration, Math.round(totalSamplesCollected / targetSampleRate));
          if (onProgress && secondsCollected % 4 === 0) {
            onProgress(`Đang trích xuất kênh âm thanh Video: ${secondsCollected}s / ${maxDuration}s...`);
          }

          if (totalSamplesCollected >= targetTotalSamples || video.currentTime >= maxDuration) {
            finish();
          }
        };

        // Mute to destination (user won't hear high-speed audio)
        const dummyGain = audioCtx.createGain();
        dummyGain.gain.value = 0;

        sourceNode.connect(processorNode);
        processorNode.connect(dummyGain);
        dummyGain.connect(audioCtx.destination);

        video.play().catch(() => {
          audioCtx.resume().then(() => {
            video.play().catch((playErr) => {
              cleanup();
              reject(new Error(`Trình duyệt chặn giải mã audio từ video: ${playErr.message}`));
            });
          });
        });
      } catch (err: any) {
        cleanup();
        reject(new Error(`Lỗi kết nối Web Audio API từ Video: ${err.message}`));
      }
    };

    video.src = videoUrl;
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
  const peakIdx = bestLag - minLagSamples;
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

  // Confidence calculation: peak prominence vs background noise
  const avgBackground = validScoreCount > 0 ? scoreSum / validScoreCount : 0.1;
  const prominence = maxScore / (avgBackground + 1e-4);
  const confidenceRatio = Math.max(0, Math.min(1, Math.round((maxScore * 0.6 + Math.min(1, prominence / 3) * 0.4) * 100) / 100));

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
    maxDurationToAnalyze = 45,
    downsampleRate = 8000,
    maxOffsetSearchSeconds = 40,
    onProgress,
  } = options;

  if (onProgress) onProgress(15, 'Đang giải mã tín hiệu Audio...');

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

  // 2. Extract Video Audio PCM using Headless Video Processor
  const videoPCM = await extractAudioPCMFromVideo(
    videoInput,
    downsampleRate,
    maxDurationToAnalyze + maxOffsetSearchSeconds,
    (msg) => {
      if (onProgress) onProgress(60, msg);
    }
  );

  if (onProgress) onProgress(80, 'Đang so khớp sóng âm Cross-Correlation & Waveform Fingerprinting...');

  // 3. Compute Energy Envelopes (200 FPS)
  const windowSize = Math.floor(downsampleRate / 200); // 40 samples per envelope frame
  const audioEnvelope = computeEnergyEnvelope(audioPCM, windowSize);
  const videoEnvelope = computeEnergyEnvelope(videoPCM, windowSize);

  const envelopeFrameRate = 200; // 200 frames/sec (5ms precision)
  const minLag = Math.floor(-5 * envelopeFrameRate); // -5s search
  const maxLag = Math.floor(maxOffsetSearchSeconds * envelopeFrameRate); // +40s search

  const { bestLag, confidenceRatio } = computeNormalizedCrossCorrelation(
    audioEnvelope,
    videoEnvelope,
    minLag,
    maxLag
  );

  if (onProgress) onProgress(95, 'Đang hoàn tất phân tích độ lệch...');

  const offsetSeconds = Math.round((bestLag / envelopeFrameRate) * 100) / 100;
  const isConfident = confidenceRatio >= 0.4;
  const finalOffset = isConfident ? offsetSeconds : 0;

  const metadata: SyncMetadata = {
    intro_duration: finalOffset > 0 ? finalOffset : 0,
    confidence_score: confidenceRatio,
    sample_rate: downsampleRate,
    analyzed_at: new Date().toISOString(),
    method: 'cross_correlation',
    notes: isConfident
      ? `Đồng bộ thành công với độ khớp ${(confidenceRatio * 100).toFixed(1)}%`
      : `Độ khớp thấp (${(confidenceRatio * 100).toFixed(1)}%), fallback về 0s`,
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
