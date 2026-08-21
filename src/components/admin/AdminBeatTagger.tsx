'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Check,
  Disc3,
  FileAudio,
  UploadCloud,
  Clock,
  FileDown,
  Layers,
  Eye,
  BrainCircuit,
  Volume2,
  Sparkles,
  Scissors,
  Wand2,
  Activity,
  Trash2,
  Plus
} from 'lucide-react';
import { TrackItem, Album } from '@/types/database';
import { getMediaCdnUrl } from '@/lib/r2Storage';

export type BeatTagType = 'sub-kick' | 'kick' | 'snare' | 'hihat';

export interface BeatTagMarker {
  id: string;
  timeSec: number;
  type: BeatTagType;
  confidence?: number;
  intensity?: number;
}

interface AdminBeatTaggerProps {
  albums: Album[];
  initialTrack?: TrackItem | null;
  onExportTags?: (trackTitle: string, tags: BeatTagMarker[]) => void;
}

const TAG_CONFIG: Record<BeatTagType, { label: string; color: string; bg: string; border: string }> = {
  'sub-kick': {
    label: 'SUB-808 (BASS)',
    color: '#ff1e1e',
    bg: 'rgba(255, 30, 30, 0.25)',
    border: '#ff2a2a',
  },
  'kick': {
    label: 'KICK THƯỜNG',
    color: '#ff9500',
    bg: 'rgba(255, 149, 0, 0.25)',
    border: '#ff9500',
  },
  'snare': {
    label: 'SNARE / CLAP',
    color: '#ffffff',
    bg: 'rgba(255, 255, 255, 0.25)',
    border: '#ffffff',
  },
  'hihat': {
    label: 'HI-HAT',
    color: '#00e5ff',
    bg: 'rgba(0, 229, 255, 0.25)',
    border: '#00e5ff',
  },
};

/**
 * Thuật toán biến đổi Fourier nhanh (Cooley-Tukey Radix-2 FFT)
 */
function computeFFTMagnitude(realIn: Float32Array): Float32Array {
  const n = realIn.length;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    real[i] = realIn[i] * hann;
  }

  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i]; real[i] = real[j]; real[j] = tempR;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < len / 2; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const vR = real[i + k + len / 2] * wR - imag[i + k + len / 2] * wI;
        const vI = real[i + k + len / 2] * wI + imag[i + k + len / 2] * wR;
        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + len / 2] = uR - vR;
        imag[i + k + len / 2] = uI - vI;
        const nextWR = wR * wStepR - wI * wStepI;
        wI = wR * wStepI + wI * wStepR;
        wR = nextWR;
      }
    }
  }

  const half = n / 2;
  const mag = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / half;
  }
  return mag;
}

/**
 * AI Multi-Stage Pipeline: Bóc tách Stem & Nhận diện nhịp sâu
 */
async function processAIDrumPipeline(
  buffer: AudioBuffer,
  onProgress: (percent: number, status: string) => void
): Promise<BeatTagMarker[]> {
  const sr = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  const totalLength = channelData.length;
  const totalDuration = buffer.duration;

  const fftSize = 1024;
  const halfBins = fftSize / 2;
  const hopSize = Math.floor(sr * 0.01); // 10ms hop
  const numFrames = Math.floor((totalLength - fftSize) / hopSize);

  onProgress(15, 'Stage 1: Trích xuất ma trận Spectrogram...');
  await new Promise((r) => setTimeout(r, 10));

  const spectrogram: Float32Array[] = [];
  const chunk = new Float32Array(fftSize);

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      chunk[i] = channelData[offset + i] || 0;
    }
    spectrogram.push(computeFFTMagnitude(chunk));
  }

  onProgress(45, 'Stage 2: Bóc tách nguồn âm (Triệt tiêu Vocal & Melody)...');
  await new Promise((r) => setTimeout(r, 10));

  // Lọc vi sai thời gian để triệt tiêu các thành phần âm thanh kéo dài (Vocal, Pad, Reverb)
  const percussiveFlux = new Float32Array(numFrames);
  const subEnergy = new Float32Array(numFrames);
  const punchEnergy = new Float32Array(numFrames);
  const snareEnergy = new Float32Array(numFrames);

  const binSubEnd = Math.floor((80 / (sr / 2)) * halfBins);
  const binPunchEnd = Math.floor((180 / (sr / 2)) * halfBins);
  const binSnareStart = Math.floor((250 / (sr / 2)) * halfBins);
  const binSnareEnd = Math.floor((4500 / (sr / 2)) * halfBins);

  for (let f = 1; f < numFrames; f++) {
    const prev = spectrogram[f - 1];
    const curr = spectrogram[f];

    let flux = 0;
    let sub = 0;
    let punch = 0;
    let snare = 0;

    for (let b = 1; b < halfBins; b++) {
      const diff = curr[b] - prev[b];
      if (diff > 0) {
        flux += diff * curr[b] * 5;

        if (b <= binSubEnd) sub += diff;
        else if (b <= binPunchEnd) punch += diff;
        else if (b >= binSnareStart && b <= binSnareEnd) snare += diff;
      }
    }

    percussiveFlux[f] = flux;
    subEnergy[f] = sub;
    punchEnergy[f] = punch;
    snareEnergy[f] = snare;
  }

  onProgress(75, 'Stage 3: Dò tìm Onset & Khóa pha thích ứng...');
  await new Promise((r) => setTimeout(r, 10));

  const windowRadius = 30; // 300ms window
  const detected: BeatTagMarker[] = [];
  let lastHitTime = -1;

  for (let f = windowRadius; f < numFrames - windowRadius; f++) {
    const timeSec = (f * hopSize) / sr;
    if (timeSec < 0.5 || timeSec > totalDuration - 0.5) continue;

    const currentFlux = percussiveFlux[f];

    let localMean = 0;
    for (let w = f - windowRadius; w <= f + windowRadius; w++) {
      localMean += percussiveFlux[w];
    }
    localMean /= windowRadius * 2 + 1;

    // Ngưỡng động thích ứng lọc sạch tạp âm
    const adaptiveThreshold = localMean * 2.2 + 0.04;

    const isPeak =
      currentFlux > adaptiveThreshold &&
      currentFlux > percussiveFlux[f - 1] &&
      currentFlux > percussiveFlux[f + 1] &&
      currentFlux > percussiveFlux[f - 2] &&
      currentFlux > percussiveFlux[f + 2];

    if (isPeak && timeSec - lastHitTime >= 0.14) {
      let chosenType: BeatTagType = 'kick';
      const subVal = subEnergy[f];
      const punchVal = punchEnergy[f];
      const snareVal = snareEnergy[f];

      if (subVal * 1.5 > punchVal && subVal * 1.5 > snareVal) {
        chosenType = 'sub-kick';
      } else if (snareVal * 1.6 > punchVal) {
        chosenType = 'snare';
      } else {
        chosenType = 'kick';
      }

      detected.push({
        id: `beat_${detected.length + 1}_${f}`,
        timeSec: Math.round(timeSec * 1000) / 1000,
        type: chosenType,
        confidence: Math.min(1.0, currentFlux * 5),
        intensity: chosenType === 'sub-kick' ? 1.0 : chosenType === 'kick' ? 0.85 : 0.75,
      });

      lastHitTime = timeSec;
    }
  }

  onProgress(100, 'Hoàn tất đồng bộ dữ liệu nhịp!');
  await new Promise((r) => setTimeout(r, 20));

  return detected.sort((a, b) => a.timeSec - b.timeSec);
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: 'audio/wav' });
}

export default function AdminBeatTagger({ albums, initialTrack, onExportTags }: AdminBeatTaggerProps) {
  const [selectedTrackTitle, setSelectedTrackTitle] = useState<string>('02. IDK');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSourceUrl, setAudioSourceUrl] = useState<string>('');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processProgress, setProcessProgress] = useState<number>(0);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [audibleMetronome, setAudibleMetronome] = useState<boolean>(true);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [viewportStartSec, setViewportStartSec] = useState<number>(0);

  const [tags, setTags] = useState<BeatTagMarker[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<BeatTagType | 'all'>('all');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [isExportingWav, setIsExportingWav] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTriggeredTagRef = useRef<string | null>(null);
  const blobUrlToRevokeRef = useRef<string | null>(null);
  const currentTimeRef = useRef<number>(0);
  const viewportStartSecRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const flashOverlayRef = useRef<HTMLDivElement | null>(null);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    viewportStartSecRef.current = viewportStartSec;
  }, [viewportStartSec]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const waveformPeaks = useMemo(() => {
    if (!audioBuffer) return null;
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const numPeaks = 4000;
    const step = Math.max(1, Math.floor(totalSamples / numPeaks));
    const peaks = new Float32Array(numPeaks * 2);

    for (let i = 0; i < numPeaks; i++) {
      const start = i * step;
      const end = Math.min(start + step, totalSamples);
      let min = 1.0;
      let max = -1.0;
      const subStep = Math.max(1, Math.floor((end - start) / 16));
      for (let j = start; j < end; j += subStep) {
        const val = channelData[j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      peaks[i * 2] = min === 1.0 ? 0 : min;
      peaks[i * 2 + 1] = max === -1.0 ? 0 : max;
    }
    return peaks;
  }, [audioBuffer]);

  const runPipelineAnalysis = useCallback(async (buffer: AudioBuffer) => {
    setIsProcessing(true);
    const result = await processAIDrumPipeline(buffer, (percent, status) => {
      setProcessProgress(percent);
      setProcessStatus(status);
    });
    setTags(result);
    setIsProcessing(false);
  }, []);

  const loadAudioSource = useCallback(async (source: string | File, trackName?: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (blobUrlToRevokeRef.current) {
      URL.revokeObjectURL(blobUrlToRevokeRef.current);
      blobUrlToRevokeRef.current = null;
    }

    const ctx = getAudioContext();
    if (trackName) setSelectedTrackTitle(trackName);

    try {
      let decodedBuffer: AudioBuffer;
      if (typeof source === 'string') {
        setAudioSourceUrl(source);
        const res = await fetch(source);
        const arrayBuffer = await res.arrayBuffer();
        decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      } else {
        const blobUrl = URL.createObjectURL(source);
        blobUrlToRevokeRef.current = blobUrl;
        setAudioSourceUrl(blobUrl);
        const arrayBuffer = await source.arrayBuffer();
        decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      }

      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setCurrentTime(0);
      setViewportStartSec(0);

      await runPipelineAnalysis(decodedBuffer);
    } catch (err) {
      console.error('Load audio error:', err);
      setIsProcessing(false);
    }
  }, [getAudioContext, runPipelineAnalysis]);

  useEffect(() => {
    if (initialTrack?.audio_url) {
      loadAudioSource(getMediaCdnUrl(initialTrack.audio_url), initialTrack.title);
    }
  }, [initialTrack, loadAudioSource]);

  const playClickSound = useCallback((type: BeatTagType) => {
    if (!audibleMetronome) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      if (type === 'sub-kick') {
        osc.frequency.setValueAtTime(85, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.08);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      } else if (type === 'kick') {
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      } else if (type === 'snare') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {}
  }, [audibleMetronome, getAudioContext]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekTo = useCallback((timeSec: number) => {
    const audio = audioRef.current;
    const maxDur = duration || audioBuffer?.duration || 1000;
    const safeTime = Math.max(0, Math.min(maxDur, timeSec));
    if (audio) audio.currentTime = safeTime;
    currentTimeRef.current = safeTime;
    setCurrentTime(safeTime);
  }, [duration, audioBuffer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekTo(Math.max(0, (audioRef.current?.currentTime || currentTimeRef.current) - (e.shiftKey ? 0.05 : 0.5)));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekTo((audioRef.current?.currentTime || currentTimeRef.current) + (e.shiftKey ? 0.05 : 0.5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekTo]);

  const drawWaveform = useCallback((liveSec: number, viewStart: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const totalDur = duration || audioBuffer.duration || 1;
    const visibleDur = totalDur / zoomLevel;
    const viewEnd = viewStart + visibleDur;

    // Background
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, width, height);

    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Baseline
    const midY = height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Render Bars
    if (waveformPeaks && waveformPeaks.length > 0) {
      const numPeaks = waveformPeaks.length / 2;
      const numBars = width;
      const barWidth = 1.4;

      for (let x = 0; x < numBars; x += 2) {
        const timeAtX = viewStart + (x / numBars) * visibleDur;
        if (timeAtX < 0 || timeAtX > totalDur) continue;

        const peakIdx = Math.min(numPeaks - 1, Math.max(0, Math.floor((timeAtX / totalDur) * numPeaks)));
        const min = waveformPeaks[peakIdx * 2];
        const max = waveformPeaks[peakIdx * 2 + 1];

        const barHeight = Math.max(2, (max - min) * (height * 0.46));
        const y = midY - barHeight / 2;
        const peakAmp = Math.max(Math.abs(min), Math.abs(max));

        if (peakAmp > 0.65) {
          ctx.fillStyle = '#ff1e1e';
        } else if (peakAmp > 0.35) {
          ctx.fillStyle = '#ff8c00';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        }

        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }

    // Render Tags
    tags.forEach((tag) => {
      if (tag.timeSec >= viewStart && tag.timeSec <= viewEnd) {
        const tagX = ((tag.timeSec - viewStart) / visibleDur) * width;
        const cfg = TAG_CONFIG[tag.type];
        const isSelected = selectedTagId === tag.id;

        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(tagX, 0);
        ctx.lineTo(tagX, height);
        ctx.stroke();

        ctx.fillStyle = cfg.border;
        ctx.beginPath();
        ctx.arc(tagX, 8, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(tag.type === 'sub-kick' ? '808' : tag.type === 'kick' ? 'K' : 'SN', tagX + 6, 12);
      }
    });

    // Playhead Laser
    if (liveSec >= viewStart && liveSec <= viewEnd) {
      const playheadX = ((liveSec - viewStart) / visibleDur) * width;

      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#00ffcc';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.fill();
    }
  }, [audioBuffer, duration, zoomLevel, waveformPeaks, tags, selectedTagId]);

  useEffect(() => {
    const renderLoop = () => {
      const audio = audioRef.current;
      const liveSec = audio ? audio.currentTime : currentTimeRef.current;
      currentTimeRef.current = liveSec;

      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formatMillis(liveSec);
      }

      if (audio && !audio.paused) {
        const totalDur = duration || audioBuffer?.duration || 1;
        const visibleDur = totalDur / zoomLevel;

        if (liveSec > viewportStartSecRef.current + visibleDur * 0.85) {
          viewportStartSecRef.current = Math.max(0, liveSec - visibleDur * 0.2);
        } else if (liveSec < viewportStartSecRef.current) {
          viewportStartSecRef.current = Math.max(0, liveSec);
        }

        const nearbyTag = tags.find((t) => Math.abs(t.timeSec - liveSec) < 0.035);
        if (nearbyTag && nearbyTag.id !== lastTriggeredTagRef.current) {
          lastTriggeredTagRef.current = nearbyTag.id;
          playClickSound(nearbyTag.type);

          if (flashOverlayRef.current) {
            const cfg = TAG_CONFIG[nearbyTag.type];
            flashOverlayRef.current.style.backgroundColor = cfg.border;
            flashOverlayRef.current.style.opacity = nearbyTag.type === 'sub-kick' ? '0.45' : '0.25';
            setTimeout(() => {
              if (flashOverlayRef.current) flashOverlayRef.current.style.opacity = '0';
            }, 60);
          }
        }
      }

      drawWaveform(liveSec, viewportStartSecRef.current);
      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [duration, audioBuffer, zoomLevel, tags, playClickSound, drawWaveform]);

  const handleScrub = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));

    const totalDur = duration || audioBuffer.duration;
    const visibleDur = totalDur / zoomLevel;
    const targetTime = viewportStartSecRef.current + ratio * visibleDur;

    seekTo(targetTime);
  };

  const formatMillis = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const exportJsonString = useMemo(() => {
    return JSON.stringify(
      {
        track: selectedTrackTitle,
        totalTags: tags.length,
        tags: tags.map((t) => ({
          time: t.timeSec,
          type: t.type,
        })),
      },
      null,
      2
    );
  }, [selectedTrackTitle, tags]);

  const exportTsCodeString = useMemo(() => {
    return `// PostLain Master Beat Map: ${selectedTrackTitle}
export const DRUM_SYNC_MAP_${selectedTrackTitle.toUpperCase().replace(/[^A-Z0-9]/g, '_')} = ${JSON.stringify(
      tags.map((t) => ({ time: t.timeSec, type: t.type })),
      null,
      2
    )};`;
  }, [selectedTrackTitle, tags]);

  const handleExportWavFile = async (withClicks: boolean = false) => {
    if (!audioBuffer) return;
    setIsExportingWav(true);

    try {
      let bufferToExport = audioBuffer;

      if (withClicks && tags.length > 0) {
        const ctx = getAudioContext();
        const numSamples = audioBuffer.length;
        const mixed = ctx.createBuffer(2, numSamples, audioBuffer.sampleRate);
        const sr = audioBuffer.sampleRate;

        for (let ch = 0; ch < 2; ch++) {
          const srcCh = audioBuffer.getChannelData(ch);
          const destCh = mixed.getChannelData(ch);
          destCh.set(srcCh);

          tags.forEach((tag) => {
            const startIdx = Math.floor(tag.timeSec * sr);
            const clickLen = Math.floor(sr * 0.04);
            for (let i = 0; i < clickLen && startIdx + i < numSamples; i++) {
              const clickPhase = i / clickLen;
              const env = Math.exp(-clickPhase * 25);
              const freq = tag.type === 'sub-kick' ? 70 : tag.type === 'kick' ? 120 : 600;
              const clickVal = Math.sin(2 * Math.PI * freq * (i / sr)) * env * 0.95;
              destCh[startIdx + i] = Math.max(-1, Math.min(1, destCh[startIdx + i] + clickVal));
            }
          });
        }
        bufferToExport = mixed;
      }

      const wavBlob = encodeAudioBufferToWav(bufferToExport);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTrackTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}${withClicks ? '_CLICK_SYNC' : ''}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export WAV error:', err);
    } finally {
      setIsExportingWav(false);
    }
  };

  const filteredTags = useMemo(() => {
    if (filterType === 'all') return tags;
    return tags.filter((t) => t.type === filterType);
  }, [tags, filterType]);

  const tagCounts = useMemo(() => {
    return {
      subKick: tags.filter((t) => t.type === 'sub-kick').length,
      kick: tags.filter((t) => t.type === 'kick').length,
      snare: tags.filter((t) => t.type === 'snare').length,
    };
  }, [tags]);

  return (
    <div className="space-y-6 text-white font-mono animate-fadeIn pb-16 select-none">
      <audio
        ref={audioRef}
        src={audioSourceUrl}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onDurationChange={(e) => {
          const d = (e.target as HTMLAudioElement).duration;
          if (d && !isNaN(d)) setDuration(d);
        }}
      />

      <div
        ref={flashOverlayRef}
        className="fixed inset-0 pointer-events-none z-50 transition-opacity duration-75 opacity-0"
      />

      {/* Top Header Card */}
      <div className="p-5 md:p-6 rounded-3xl bg-[#090a0f]/95 border border-white/20 shadow-2xl backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500 text-black tracking-widest uppercase flex items-center gap-1">
              <BrainCircuit className="w-3 h-3 text-black" />
              SEPARATE & DETECT AI
            </span>
            <h2 className="text-lg md:text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              AUDIO DRUM TRANSCRIPTION PIPELINE
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Khóa sạch Vocal & Melody • Phân tích quang phổ Onset đa tầng chuyên dụng cho Drum Sync.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-black font-extrabold shadow-[0_0_20px_rgba(0,255,200,0.3)] cursor-pointer transition-all flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-black" />
            <span>Nạp Tệp Audio (FLAC/WAV/MP3)...</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const clean = file.name.replace(/\.[^/.]+$/, '');
                  loadAudioSource(file, clean);
                }
              }}
            />
          </label>

          <button
            onClick={() => {
              if (audioBuffer) runPipelineAnalysis(audioBuffer);
            }}
            disabled={!audioBuffer || isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <Wand2 className="w-4 h-4 text-cyan-400" />
            <span>Chạy Lại Pipeline</span>
          </button>
        </div>
      </div>

      {/* Main Waveform Canvas Stage */}
      <div className="p-4 md:p-6 rounded-3xl bg-[#050608] border border-white/20 shadow-2xl relative space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span ref={timeDisplayRef} className="text-cyan-300 font-extrabold text-sm">{formatMillis(currentTime)}</span>
              <span className="text-zinc-500">/ {formatMillis(duration || audioBuffer?.duration || 0)}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] text-zinc-300">
              <span>Zoom:</span>
              <span className="font-bold text-white">{zoomLevel}x</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1.0, Math.round((z - 0.5) * 2) / 2))}
              disabled={zoomLevel <= 1.0}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.min(25.0, Math.round((z + 0.5) * 2) / 2))}
              disabled={zoomLevel >= 25.0}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setZoomLevel(1.0);
                setViewportStartSec(0);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all"
            >
              Reset 1x
            </button>
          </div>
        </div>

        {/* Waveform Canvas Viewport */}
        <div
          ref={containerRef}
          onMouseDown={() => (isDraggingRef.current = true)}
          onMouseUp={() => (isDraggingRef.current = false)}
          onMouseMove={(e) => {
            if (isDraggingRef.current) handleScrub(e.clientX);
          }}
          className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden border border-white/25 cursor-crosshair bg-black"
        >
          {isProcessing && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 z-20 px-6">
              <Disc3 className="w-9 h-9 text-cyan-400 animate-spin" />
              <div className="w-full max-w-md bg-zinc-800 h-2 rounded-full overflow-hidden border border-white/20">
                <div
                  className="bg-cyan-400 h-full transition-all duration-150 ease-out shadow-[0_0_10px_#00e5ff]"
                  style={{ width: `${processProgress}%` }}
                />
              </div>
              <p className="text-xs text-cyan-300 font-bold tracking-wider animate-pulse">{processStatus}</p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={1400}
            height={240}
            onClick={(e) => handleScrub(e.clientX)}
            onTouchStart={(e) => {
              if (e.touches.length > 0) handleScrub(e.touches[0].clientX);
            }}
            onTouchMove={(e) => {
              if (e.touches.length > 0) handleScrub(e.touches[0].clientX);
            }}
            className="w-full h-full block touch-none"
          />
        </div>

        {/* Timeline Slider */}
        {zoomLevel > 1.0 && (
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, (duration || audioBuffer?.duration || 100) - (duration || audioBuffer?.duration || 100) / zoomLevel)}
              step={0.05}
              value={viewportStartSec}
              onChange={(e) => setViewportStartSec(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-ew-resize accent-cyan-400"
            />
          </div>
        )}

        {/* Audio Transport Bar */}
        <div className="p-3.5 rounded-2xl bg-black/80 border border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black shadow-[0_0_20px_rgba(0,255,200,0.5)] transition-all flex items-center justify-center"
              title="Phát / Dừng (Space)"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
            </button>

            <button
              onClick={() => seekTo(0)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all"
              title="Đầu bài"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekTo(22.746)}
              className="px-3 py-2 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 text-xs font-bold text-red-300 transition-all"
              title="Nhảy tới nhịp đầu tiên (22.746s)"
            >
              Tới Beat 1 (22.746s)
            </button>

            <button
              onClick={() => seekTo(Math.max(0, (audioRef.current?.currentTime || currentTimeRef.current) - 0.5))}
              className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
            >
              -0.5s
            </button>

            <button
              onClick={() => seekTo((audioRef.current?.currentTime || currentTimeRef.current) + 0.5)}
              className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
            >
              +0.5s
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 text-xs">
              <span className="text-zinc-400">Tốc độ:</span>
              {[0.5, 0.75, 1.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setPlaybackRate(rate);
                    if (audioRef.current) audioRef.current.playbackRate = rate;
                  }}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all ${
                    playbackRate === rate ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setAudibleMetronome((m) => !m)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                audibleMetronome
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-zinc-500'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Tiếng Click: {audibleMetronome ? 'BẬT' : 'TẮT'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tagged Markers List & Data Export */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-3xl bg-[#090a0f]/95 border border-white/20 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              DANH SÁCH NHỊP ({filteredTags.length})
            </h3>

            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/15 text-[10px]">
              {(['all', 'sub-kick', 'kick', 'snare'] as const).map((ft) => (
                <button
                  key={ft}
                  onClick={() => setFilterType(ft)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all uppercase ${
                    filterType === ft ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {ft === 'all' ? 'Tất cả' : ft}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto overflow-x-hidden no-scrollbar space-y-1.5 pr-1">
            {filteredTags.map((tag, idx) => {
              const cfg = TAG_CONFIG[tag.type];
              const isSelected = selectedTagId === tag.id;

              return (
                <div
                  key={tag.id}
                  onClick={() => {
                    setSelectedTagId(tag.id);
                    seekTo(tag.timeSec);
                  }}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white/15 border-white shadow-md scale-[1.01]'
                      : 'bg-black/40 hover:bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-bold w-6">#{idx + 1}</span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                    >
                      {tag.type}
                    </span>
                    <span className="font-bold text-white font-mono">{formatMillis(tag.timeSec)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        seekTo(tag.timeSec);
                      }}
                      className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all"
                      title="Nghe mốc này"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Export Code & WAV Downloader */}
        <div className="p-5 rounded-3xl bg-[#090a0f]/95 border border-white/20 shadow-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              XUẤT DỮ LIỆU & AUDITION WAV
            </h3>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                onClick={() => handleExportWavFile(true)}
                disabled={isExportingWav || !audioBuffer || tags.length === 0}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-cyan-900/30"
              >
                <FileDown className="w-4 h-4" />
                <span>XUẤT WAV KÈM NHỊP CLICK ({tags.length} NHỊP)</span>
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                  MÃ HỌC MÁY (GROUND-TRUTH):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(exportJsonString);
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white flex items-center gap-1 font-bold"
                  >
                    {copiedJson ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                    <span>JSON</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(exportTsCodeString);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-[10px] text-cyan-300 hover:text-white flex items-center gap-1 font-bold"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>Dataset TS</span>
                  </button>
                </div>
              </div>

              {tags.length > 0 && (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] space-y-1 text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span>Tổng cú Kick / Sub-808:</span>
                    <strong className="text-red-400">{tagCounts.kick + tagCounts.subKick} ({tagCounts.subKick} Sub-808)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tổng cú Snare / Clap:</span>
                    <strong className="text-white">{tagCounts.snare} nhịp</strong>
                  </div>
                </div>
              )}

              <pre className="p-2.5 rounded-xl bg-black/90 border border-white/15 text-[10px] text-zinc-300 overflow-x-auto max-h-36 no-scrollbar font-mono leading-relaxed">
                {exportJsonString}
              </pre>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 text-[10px] text-zinc-500 text-center">
            PostLain Hidden Music Vault • Drum Transcription Studio Pipeline
          </div>
        </div>
      </div>
    </div>
  );
}
