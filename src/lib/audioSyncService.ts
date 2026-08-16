/**
 * =========================================================================
 * HIDDEN MUSIC VAULT - AUDIO-VIDEO TIMELINE SYNCHRONIZATION SERVICE
 * Fast Pure-JS MP4 AAC Demuxer & Waveform Cross-Correlation Fingerprinting
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
  downsampleRate?: number; // Standardize sample rate for fast FFT/correlation (default: 4000Hz)
  maxOffsetSearchSeconds?: number; // Search range: -10s to +50s (default: 50s)
  onProgress?: (percent: number, step: string) => void;
}

// Sampling frequency map for ADTS AAC headers
const AAC_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

function getSampleRateIndex(rate: number): number {
  const idx = AAC_SAMPLE_RATES.indexOf(rate);
  return idx !== -1 ? idx : 4; // Default to 44100Hz (index 4)
}

function createAdtsHeader(dataLength: number, sampleRateIndex: number, channelConfig: number): Uint8Array {
  const frameLength = dataLength + 7;
  const header = new Uint8Array(7);
  header[0] = 0xff; // Syncword (12 bits)
  header[1] = 0xf1; // Syncword (4 bits) + MPEG-4 (1 bit) + Layer 00 (2 bits) + No CRC (1 bit)
  header[2] = ((1 /* AAC LC */ << 6) | (sampleRateIndex << 2) | ((channelConfig >> 2) & 1)) & 0xff;
  header[3] = (((channelConfig & 3) << 6) | ((frameLength >> 11) & 3)) & 0xff;
  header[4] = ((frameLength >> 3) & 0xff) & 0xff;
  header[5] = (((frameLength & 7) << 5) | 0x1f) & 0xff;
  header[6] = 0xfc;
  return header;
}

interface MP4Box {
  type: string;
  start: number;
  size: number;
  dataStart: number;
}

function findBoxes(data: DataView, start: number, end: number): MP4Box[] {
  const boxes: MP4Box[] = [];
  let offset = start;

  while (offset + 8 <= end) {
    let size = data.getUint32(offset);
    const type = String.fromCharCode(
      data.getUint8(offset + 4),
      data.getUint8(offset + 5),
      data.getUint8(offset + 6),
      data.getUint8(offset + 7)
    );

    let dataStart = offset + 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(data.getBigUint64(offset + 8));
      dataStart = offset + 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < 8 || offset + size > end) {
      boxes.push({ type, start: offset, size: end - offset, dataStart });
      break;
    }

    boxes.push({ type, start: offset, size, dataStart });
    offset += size;
  }

  return boxes;
}

function findBoxRecursive(data: DataView, start: number, end: number, targetPath: string[]): MP4Box | null {
  if (targetPath.length === 0) return null;
  const currentTarget = targetPath[0];
  const boxes = findBoxes(data, start, end);

  for (const box of boxes) {
    if (box.type === currentTarget) {
      if (targetPath.length === 1) {
        return box;
      }
      // stsd has 8 bytes of FullBox header (version + flags (4) + entry_count (4))
      const childStart = box.type === 'stsd' ? box.dataStart + 8 : box.dataStart;
      const found = findBoxRecursive(data, childStart, box.start + box.size, targetPath.slice(1));
      if (found) return found;
    }
  }

  return null;
}

/**
 * Pure JS ISO-BMFF MP4 to ADTS AAC Demuxer
 */
function demuxMp4ToAdtsAAC(mp4Buffer: ArrayBuffer, maxDurationSeconds: number = 60): ArrayBuffer | null {
  try {
    const data = new DataView(mp4Buffer);
    const totalLength = mp4Buffer.byteLength;

    const rootBoxes = findBoxes(data, 0, totalLength);
    const moov = rootBoxes.find((b) => b.type === 'moov');
    if (!moov) return null;

    const traks = findBoxes(data, moov.dataStart, moov.start + moov.size).filter((b) => b.type === 'trak');

    let audioTrakBox: MP4Box | null = null;
    let sampleRate = 44100;
    let channelCount = 2;

    for (const trak of traks) {
      const trakEnd = trak.start + trak.size;
      const hdlr = findBoxRecursive(data, trak.dataStart, trakEnd, ['mdia', 'hdlr']);
      if (hdlr) {
        const hdlrType = String.fromCharCode(
          data.getUint8(hdlr.dataStart + 8),
          data.getUint8(hdlr.dataStart + 9),
          data.getUint8(hdlr.dataStart + 10),
          data.getUint8(hdlr.dataStart + 11)
        );
        if (hdlrType === 'soun') {
          audioTrakBox = trak;

          // Parse audio sample description in stsd
          const mp4a = findBoxRecursive(data, trak.dataStart, trakEnd, ['mdia', 'minf', 'stbl', 'stsd', 'mp4a']);
          if (mp4a) {
            channelCount = data.getUint16(mp4a.dataStart + 16) || 2;
            sampleRate = data.getUint16(mp4a.dataStart + 24) || 44100;
          }
          break;
        }
      }
    }

    if (!audioTrakBox) return null;

    const audioEnd = audioTrakBox.start + audioTrakBox.size;
    const stbl = findBoxRecursive(data, audioTrakBox.dataStart, audioEnd, ['mdia', 'minf', 'stbl']);
    if (!stbl) return null;

    const stblEnd = stbl.start + stbl.size;
    const stszBox = findBoxRecursive(data, stbl.dataStart, stblEnd, ['stsz']);
    const stscBox = findBoxRecursive(data, stbl.dataStart, stblEnd, ['stsc']);
    const stcoBox = findBoxRecursive(data, stbl.dataStart, stblEnd, ['stco']);
    const co64Box = findBoxRecursive(data, stbl.dataStart, stblEnd, ['co64']);

    if (!stszBox || (!stcoBox && !co64Box) || !stscBox) return null;

    // 1. Parse Sample Sizes (stsz)
    const defaultSampleSize = data.getUint32(stszBox.dataStart + 4);
    const sampleCount = data.getUint32(stszBox.dataStart + 8);
    const sampleSizes: number[] = [];

    if (defaultSampleSize > 0) {
      for (let i = 0; i < sampleCount; i++) sampleSizes.push(defaultSampleSize);
    } else {
      let szOffset = stszBox.dataStart + 12;
      for (let i = 0; i < sampleCount; i++) {
        sampleSizes.push(data.getUint32(szOffset));
        szOffset += 4;
      }
    }

    // 2. Parse Chunk Offsets (stco / co64)
    const chunkOffsets: number[] = [];
    if (stcoBox) {
      const chunkCount = data.getUint32(stcoBox.dataStart + 4);
      let coOffset = stcoBox.dataStart + 8;
      for (let i = 0; i < chunkCount; i++) {
        chunkOffsets.push(data.getUint32(coOffset));
        coOffset += 4;
      }
    } else if (co64Box) {
      const chunkCount = data.getUint32(co64Box.dataStart + 4);
      let coOffset = co64Box.dataStart + 8;
      for (let i = 0; i < chunkCount; i++) {
        chunkOffsets.push(Number(data.getBigUint64(coOffset)));
        coOffset += 8;
      }
    }

    // 3. Parse Sample-to-Chunk Map (stsc)
    const stscEntryCount = data.getUint32(stscBox.dataStart + 4);
    const stscEntries: { firstChunk: number; samplesPerChunk: number }[] = [];
    let scOffset = stscBox.dataStart + 8;
    for (let i = 0; i < stscEntryCount; i++) {
      stscEntries.push({
        firstChunk: data.getUint32(scOffset),
        samplesPerChunk: data.getUint32(scOffset + 4),
      });
      scOffset += 12;
    }

    // Calculate max samples needed
    const maxFrames = Math.min(sampleSizes.length, Math.ceil(maxDurationSeconds * (sampleRate / 1024)));

    // 4. Extract samples and build ADTS stream
    const sampleRateIdx = getSampleRateIndex(sampleRate);
    const adtsChunks: Uint8Array[] = [];
    let totalAdtsBytes = 0;

    let sampleIdx = 0;
    let stscIdx = 0;

    const rawBytes = new Uint8Array(mp4Buffer);

    for (let chunkIdx = 0; chunkIdx < chunkOffsets.length && sampleIdx < maxFrames; chunkIdx++) {
      const currentChunkNum = chunkIdx + 1; // 1-indexed in stsc

      if (stscIdx + 1 < stscEntries.length && currentChunkNum >= stscEntries[stscIdx + 1].firstChunk) {
        stscIdx++;
      }

      const samplesInThisChunk = stscEntries[stscIdx]?.samplesPerChunk || 1;
      let filePos = chunkOffsets[chunkIdx];

      for (let s = 0; s < samplesInThisChunk && sampleIdx < maxFrames; s++) {
        const sSize = sampleSizes[sampleIdx];
        if (sSize > 0 && filePos + sSize <= totalLength) {
          const adtsHeader = createAdtsHeader(sSize, sampleRateIdx, channelCount);
          adtsChunks.push(adtsHeader);
          totalAdtsBytes += 7;

          const packetData = rawBytes.subarray(filePos, filePos + sSize);
          adtsChunks.push(packetData);
          totalAdtsBytes += sSize;

          filePos += sSize;
        }
        sampleIdx++;
      }
    }

    if (totalAdtsBytes === 0) return null;

    const combined = new Uint8Array(totalAdtsBytes);
    let outOffset = 0;
    for (const chunk of adtsChunks) {
      combined.set(chunk, outOffset);
      outOffset += chunk.length;
    }

    return combined.buffer;
  } catch (err) {
    console.warn('[AudioSync] Demuxer error:', err);
    return null;
  }
}

/**
 * Decode pure Audio buffer (MP3, WAV, FLAC, M4A, AAC) to mono PCM Float32Array
 */
async function decodeAudioArrayBufferToPCM(
  arrayBuffer: ArrayBuffer,
  targetSampleRate: number = 4000,
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
 * Fast Web Audio Element Render Fallback
 */
async function extractAudioViaWebAudioElement(
  videoBuffer: ArrayBuffer,
  targetSampleRate: number = 4000,
  maxDuration: number = 60
): Promise<Float32Array> {
  const blob = new Blob([videoBuffer], { type: 'video/mp4' });
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = blobUrl;
    video.preload = 'auto';
    video.muted = false;
    video.volume = 1;
    video.style.position = 'fixed';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0.01';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtx();
    let sourceNode: MediaElementAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;

    const sampleChunks: Float32Array[] = [];
    let totalSamples = 0;
    const targetSamples = Math.floor(maxDuration * targetSampleRate);
    let done = false;

    const cleanup = () => {
      video.pause();
      if (video.parentNode) video.parentNode.removeChild(video);
      try { sourceNode?.disconnect(); } catch {}
      try { processor?.disconnect(); } catch {}
      audioCtx.close().catch(() => {});
      URL.revokeObjectURL(blobUrl);
    };

    const finish = () => {
      if (done) return;
      done = true;
      const merged = new Float32Array(totalSamples);
      let off = 0;
      for (const chunk of sampleChunks) {
        merged.set(chunk, off);
        off += chunk.length;
      }
      cleanup();
      if (merged.length > 0) resolve(merged);
      else reject(new Error('Không trích xuất được âm thanh từ video.'));
    };

    try {
      sourceNode = audioCtx.createMediaElementSource(video);
      processor = audioCtx.createScriptProcessor(4096, 1, 1);

      const ratio = audioCtx.sampleRate / targetSampleRate;
      processor.onaudioprocess = (evt) => {
        if (done) return;
        const inp = evt.inputBuffer.getChannelData(0);
        const outLen = Math.floor(inp.length / ratio);
        const down = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
          down[i] = inp[Math.floor(i * ratio)] || 0;
        }
        sampleChunks.push(down);
        totalSamples += outLen;
        if (totalSamples >= targetSamples || video.currentTime >= maxDuration) {
          finish();
        }
      };

      const dummyGain = audioCtx.createGain();
      dummyGain.gain.value = 0;
      sourceNode.connect(processor);
      processor.connect(dummyGain);
      dummyGain.connect(audioCtx.destination);

      video.playbackRate = 2.0;
      audioCtx.resume().then(() => {
        video.play().catch(() => {
          setTimeout(finish, 2000);
        });
      });

      setTimeout(finish, 15000);
    } catch (e: any) {
      cleanup();
      reject(e);
    }
  });
}

/**
 * Extract mono PCM samples from Video (File, Blob, ArrayBuffer, or URL)
 */
async function extractAudioPCMFromVideo(
  videoInput: File | Blob | ArrayBuffer | string,
  targetSampleRate: number = 4000,
  maxDuration: number = 60,
  onProgress?: (msg: string) => void
): Promise<Float32Array> {
  let videoBuffer: ArrayBuffer;

  if (typeof videoInput === 'string') {
    if (onProgress) onProgress('Đang tải dữ liệu tệp Video để giải mã âm thanh...');
    const res = await fetch(videoInput);
    if (!res.ok) throw new Error(`Không thể tải video từ URL (${res.status}): ${res.statusText}`);
    videoBuffer = await res.arrayBuffer();
  } else if (videoInput instanceof ArrayBuffer) {
    videoBuffer = videoInput;
  } else {
    videoBuffer = await videoInput.arrayBuffer();
  }

  if (onProgress) onProgress('Đang trích xuất kênh âm thanh AAC từ Video MP4...');

  // Strategy 1: High-Speed Pure JS MP4 to ADTS AAC Demuxer
  const adtsBuffer = demuxMp4ToAdtsAAC(videoBuffer, maxDuration);
  if (adtsBuffer) {
    try {
      if (onProgress) onProgress('Đang giải mã luồng sóng âm thanh...');
      return await decodeAudioArrayBufferToPCM(adtsBuffer, targetSampleRate, maxDuration);
    } catch (e) {
      console.warn('[AudioSync] ADTS decode fallback:', e);
    }
  }

  // Strategy 2: Direct decodeAudioData fallback
  try {
    return await decodeAudioArrayBufferToPCM(videoBuffer, targetSampleRate, maxDuration);
  } catch (e) {
    console.warn('[AudioSync] Direct decode fallback:', e);
  }

  // Strategy 3: Fast Web Audio Element Render Fallback
  return await extractAudioViaWebAudioElement(videoBuffer, targetSampleRate, maxDuration);
}

/**
 * Compute Transient Beat Onset Strength Envelope of PCM signal
 */
function computeOnsetStrengthEnvelope(pcm: Float32Array, windowSize: number = 40): Float32Array {
  const numFrames = Math.floor(pcm.length / windowSize);
  const rms = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    let sumSquares = 0;
    const start = i * windowSize;
    for (let j = 0; j < windowSize; j++) {
      const val = pcm[start + j] || 0;
      sumSquares += val * val;
    }
    rms[i] = Math.sqrt(sumSquares / windowSize);
  }

  const onsets = new Float32Array(numFrames);
  let maxVal = 0;
  for (let i = 1; i < numFrames; i++) {
    const diff = rms[i] - rms[i - 1];
    const onset = diff > 0 ? diff : 0;
    onsets[i] = onset;
    if (onset > maxVal) maxVal = onset;
  }

  if (maxVal > 0) {
    for (let i = 0; i < numFrames; i++) {
      onsets[i] /= maxVal;
    }
  }

  return onsets;
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

    if (count > audioSignal.length * 0.3) {
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
  if (maxScore >= 0.15 && prominence >= 1.5) {
    const rawConf = Math.min(0.98, (maxScore / 0.4) * 0.55 + (prominence / 3.0) * 0.45);
    confidenceRatio = Math.max(0.85, Math.min(0.98, Math.round(rawConf * 100) / 100));
  } else if (maxScore >= 0.08) {
    confidenceRatio = Math.max(0.6, Math.min(0.84, Math.round((maxScore / 0.2) * 70) / 100));
  } else {
    confidenceRatio = Math.max(0, Math.min(0.5, Math.round(maxScore * 100) / 100));
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
    downsampleRate = 4000,
    maxOffsetSearchSeconds = 50,
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

  // 2. Extract Video Audio PCM
  const videoPCM = await extractAudioPCMFromVideo(
    videoInput,
    downsampleRate,
    maxDurationToAnalyze + maxOffsetSearchSeconds,
    (msg) => {
      if (onProgress) onProgress(65, msg);
    }
  );

  if (onProgress) onProgress(85, 'Đang so khớp sóng âm Cross-Correlation & Waveform Fingerprinting...');

  // 3. Compute Transient Beat Onset Envelopes (100 FPS)
  const windowSize = Math.floor(downsampleRate / 100); // 40 samples per envelope frame
  const audioEnvelope = computeOnsetStrengthEnvelope(audioPCM, windowSize);
  const videoEnvelope = computeOnsetStrengthEnvelope(videoPCM, windowSize);

  const envelopeFrameRate = 100; // 100 frames/sec (10ms precision)
  const minLag = Math.floor(-5 * envelopeFrameRate); // -5s search
  const maxLag = Math.floor(maxOffsetSearchSeconds * envelopeFrameRate); // +50s search

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
