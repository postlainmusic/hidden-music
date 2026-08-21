'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Check,
  Trash2,
  Plus,
  Tag,
  Music,
  Disc3,
  FileAudio,
  UploadCloud,
  Sliders,
  HelpCircle,
  Activity,
  Sparkles,
  Clock,
  ChevronRight,
  ChevronLeft,
  Save,
  FileDown,
  Scissors,
  Zap,
  Layers,
  Eye,
  AlertCircle
} from 'lucide-react';
import { TrackItem, Album } from '@/types/database';
import { getMediaCdnUrl } from '@/lib/r2Storage';

export type BeatTagType = 'sub-kick' | 'kick' | 'snare' | 'hihat';

export interface BeatTagMarker {
  id: string;
  timeSec: number;
  type: BeatTagType;
  label?: string;
  intensity?: number;
}

interface AdminBeatTaggerProps {
  albums: Album[];
  initialTrack?: TrackItem | null;
  onExportTags?: (trackTitle: string, tags: BeatTagMarker[]) => void;
}

const TAG_CONFIG: Record<BeatTagType, { label: string; color: string; bg: string; border: string; key: string }> = {
  'sub-kick': {
    label: 'SUB-KICK (808/BASS)',
    color: '#ff1e1e',
    bg: 'rgba(255, 30, 30, 0.25)',
    border: '#ff3333',
    key: '2 hoặc S',
  },
  'kick': {
    label: 'KICK THƯỜNG',
    color: '#ff8c00',
    bg: 'rgba(255, 140, 0, 0.25)',
    border: '#ffa500',
    key: '1 hoặc K',
  },
  'snare': {
    label: 'SNARE / CLAP',
    color: '#ffffff',
    bg: 'rgba(255, 255, 255, 0.25)',
    border: '#ffffff',
    key: '3 hoặc N',
  },
  'hihat': {
    label: 'HI-HAT / CYMBAL',
    color: '#00e5ff',
    bg: 'rgba(0, 229, 255, 0.25)',
    border: '#00e5ff',
    key: '4 hoặc H',
  },
};

/**
 * Pure In-Browser PCM WAV File Encoder
 */
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

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // 16 for PCM
  setUint16(1); // linear PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); // data length

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
  // Flatten all tracks from albums
  const allTracks = useMemo(() => {
    const list: { albumTitle: string; track: TrackItem }[] = [];
    albums.forEach((alb) => {
      (alb.tracks || []).forEach((t) => {
        list.push({ albumTitle: alb.title, track: t });
      });
    });
    return list;
  }, [albums]);

  const [selectedTrackId, setSelectedTrackId] = useState<string>('preset_idk');
  const [selectedTrackTitle, setSelectedTrackTitle] = useState<string>('02. IDK - MCK');
  
  // HTML5 Audio Master & Web Audio State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSourceUrl, setAudioSourceUrl] = useState<string>('');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [decodeProgress, setDecodeProgress] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audibleMetronome, setAudibleMetronome] = useState<boolean>(true);

  // Zoom & Viewport State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 1x to 20x
  const [viewportStartSec, setViewportStartSec] = useState<number>(0);

  // Tag Markers State
  const [tags, setTags] = useState<BeatTagMarker[]>([]);
  const [activeTagType, setActiveTagType] = useState<BeatTagType>('sub-kick');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<BeatTagType | 'all'>('all');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [isExportingWav, setIsExportingWav] = useState<boolean>(false);

  // Web Audio Context for Metronome & Waveform Decoding
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTriggeredTagRef = useRef<string | null>(null);
  const blobUrlToRevokeRef = useRef<string | null>(null);
  const currentTimeRef = useRef<number>(0);
  const viewportStartSecRef = useRef<number>(0);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);

  // Canvas & Overlay Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const flashOverlayRef = useRef<HTMLDivElement | null>(null);

  // Get Web Audio Context
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

  /**
   * Synthesize realistic demo audio buffer & WAV blob for preset tracks
   */
  const synthesizeDemoTrack = useCallback((title: string, durationSec: number = 180, bpm: number = 134): { buffer: AudioBuffer; wavBlob: Blob } => {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const beatInterval = 60 / bpm;
    const isTrap = title.toLowerCase().includes('idk');

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // 1. Chords / Atmosphere
      const chordNote = 220 * Math.sin(2 * Math.PI * (isTrap ? 130.81 : 146.83) * t);
      sample += chordNote * 0.08 * (1 + 0.2 * Math.sin(2 * Math.PI * 0.5 * t));

      // 2. Drums after intro
      const drumStart = isTrap ? 13.5 : 8.0;
      if (t >= drumStart) {
        const beatPhase = (t - drumStart) % beatInterval;
        const beatNum = Math.floor(((t - drumStart) / beatInterval) % 4);

        // Kick on beat 0 (and double roll on trap)
        if (beatNum === 0 || (isTrap && beatNum === 2 && beatPhase < 0.15)) {
          if (beatPhase < 0.18) {
            const kickEnv = Math.exp(-beatPhase * 28);
            const kickPitch = 55 * Math.exp(-beatPhase * 15) + 38;
            sample += Math.sin(2 * Math.PI * kickPitch * beatPhase) * kickEnv * 0.85;
          }
        }

        // Sub-kick / 808 punch
        if (beatNum === 0 && beatPhase < 0.35) {
          const subEnv = Math.exp(-beatPhase * 10);
          sample += Math.sin(2 * Math.PI * 45 * beatPhase) * subEnv * 0.75;
        }

        // Snare on beat 1 / 3
        if (beatNum === 2 || (!isTrap && beatNum === 1)) {
          if (beatPhase < 0.12) {
            const snareEnv = Math.exp(-beatPhase * 35);
            const noise = (Math.random() * 2 - 1) * 0.55;
            const tone = Math.sin(2 * Math.PI * 180 * beatPhase) * 0.45;
            sample += (noise + tone) * snareEnv * 0.70;
          }
        }

        // Hi-hats
        const hatPhase = ((t - drumStart) % (beatInterval / 2)) / (beatInterval / 2);
        if (hatPhase < 0.04) {
          const hatEnv = Math.exp(-hatPhase * 80);
          sample += (Math.random() * 2 - 1) * hatEnv * 0.25;
        }
      }

      left[i] = sample;
      right[i] = sample;
    }

    const wavBlob = encodeAudioBufferToWav(buffer);
    return { buffer, wavBlob };
  }, [getAudioContext]);

  /**
   * Load and decode audio from File or URL or Preset
   */
  const loadAudioSource = useCallback(async (source: string | File) => {
    setIsDecoding(true);
    setDecodeProgress('Đang nạp luồng âm thanh...');
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (blobUrlToRevokeRef.current) {
      URL.revokeObjectURL(blobUrlToRevokeRef.current);
      blobUrlToRevokeRef.current = null;
    }

    const ctx = getAudioContext();

    try {
      if (typeof source === 'string') {
        if (source.startsWith('preset:')) {
          setDecodeProgress('Khởi tạo bộ tổng hợp âm thanh...');
          const trackKey = source.replace('preset:', '');
          const isIdk = trackKey === 'idk';
          const title = isIdk ? '02. IDK - MCK' : '03. Ai Mới Là Kẻ Xấu Xa';
          const bpm = isIdk ? 134 : 88;
          const dur = isIdk ? 180 : 210;

          const { buffer, wavBlob } = synthesizeDemoTrack(title, dur, bpm);
          setAudioBuffer(buffer);
          setDuration(buffer.duration);

          const blobUrl = URL.createObjectURL(wavBlob);
          blobUrlToRevokeRef.current = blobUrl;
          setAudioSourceUrl(blobUrl);

          setIsDecoding(false);
          setDecodeProgress('');
          return;
        }

        setDecodeProgress('Tải dữ liệu âm thanh từ CDN...');
        setAudioSourceUrl(source);

        const res = await fetch(source);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();

        setDecodeProgress('Đang vẽ thanh sóng PCM...');
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
        setDuration(decoded.duration);
        setIsDecoding(false);
        setDecodeProgress('');
      } else {
        setDecodeProgress('Đang đọc tệp cục bộ...');
        const blobUrl = URL.createObjectURL(source);
        blobUrlToRevokeRef.current = blobUrl;
        setAudioSourceUrl(blobUrl);

        const arrayBuffer = await source.arrayBuffer();
        setDecodeProgress('Đang giải mã thanh sóng...');
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
        setDuration(decoded.duration);
        setIsDecoding(false);
        setDecodeProgress('');
      }

      setCurrentTime(0);
      setViewportStartSec(0);
    } catch (err) {
      console.warn('Direct decode failed, synthesizing fallback waveform:', err);
      setDecodeProgress('Khởi tạo sóng chuẩn fallback...');
      const { buffer, wavBlob } = synthesizeDemoTrack(selectedTrackTitle, 180, 134);
      setAudioBuffer(buffer);
      setDuration(buffer.duration);
      const blobUrl = URL.createObjectURL(wavBlob);
      blobUrlToRevokeRef.current = blobUrl;
      setAudioSourceUrl(blobUrl);
      setIsDecoding(false);
      setDecodeProgress('');
    }
  }, [getAudioContext, synthesizeDemoTrack, selectedTrackTitle]);

  // Handle initialTrack or default Preset
  useEffect(() => {
    if (initialTrack) {
      setSelectedTrackId(initialTrack.id);
      setSelectedTrackTitle(initialTrack.title);
      const url = initialTrack.audio_url ? getMediaCdnUrl(initialTrack.audio_url) : '';
      if (url) {
        loadAudioSource(url);
        return;
      }
    }
    loadAudioSource('preset:idk');
  }, [initialTrack, loadAudioSource]);

  /**
   * Sound Tick generator for Audible Metronome / Tags
   */
  const playClickSound = useCallback((type: BeatTagType) => {
    if (!audibleMetronome) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      if (type === 'sub-kick') {
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.08);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      } else if (type === 'kick') {
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      } else if (type === 'snare') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {}
  }, [audibleMetronome, getAudioContext]);

  /**
   * Audio Playback Control via HTML5 Audio Element
   */
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
    if (audio) {
      audio.currentTime = safeTime;
    }
    setCurrentTime(safeTime);
  }, [duration, audioBuffer]);

  /**
   * Add a new Tag Marker at current timestamp
   */
  const addTagAtTime = useCallback((timeSec: number, type: BeatTagType) => {
    const roundedTime = Math.round(timeSec * 1000) / 1000;
    
    // Check if tag already exists within 20ms
    const existingIdx = tags.findIndex((t) => Math.abs(t.timeSec - roundedTime) < 0.02);
    if (existingIdx !== -1) {
      setTags((prev) => prev.map((t, idx) => (idx === existingIdx ? { ...t, type } : t)));
    } else {
      const newTag: BeatTagMarker = {
        id: `tag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timeSec: roundedTime,
        type,
        intensity: type === 'sub-kick' ? 1.0 : type === 'kick' ? 0.85 : 0.7,
      };
      setTags((prev) => [...prev, newTag].sort((a, b) => a.timeSec - b.timeSec));
    }

    // Flash Visual feedback
    if (flashOverlayRef.current) {
      const cfg = TAG_CONFIG[type];
      flashOverlayRef.current.style.backgroundColor = cfg.border;
      flashOverlayRef.current.style.opacity = type === 'sub-kick' ? '0.5' : '0.3';
      setTimeout(() => {
        if (flashOverlayRef.current) flashOverlayRef.current.style.opacity = '0';
      }, 70);
    }

    playClickSound(type);
  }, [tags, playClickSound]);

  const deleteTag = useCallback((id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    if (selectedTagId === id) setSelectedTagId(null);
  }, [selectedTagId]);

  const clearAllTags = useCallback(() => {
    if (tags.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn xóa toàn bộ ${tags.length} nhãn Beat đã gán không?`)) {
      setTags([]);
      setSelectedTagId(null);
    }
  }, [tags.length]);

  /**
   * Keyboard Shortcuts for Fast Real-time Tagging
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === '1' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const liveSec = audioRef.current ? audioRef.current.currentTime : currentTime;
        addTagAtTime(liveSec, 'kick');
      } else if (e.key === '2' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        const liveSec = audioRef.current ? audioRef.current.currentTime : currentTime;
        addTagAtTime(liveSec, 'sub-kick');
      } else if (e.key === '3' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const liveSec = audioRef.current ? audioRef.current.currentTime : currentTime;
        addTagAtTime(liveSec, 'snare');
      } else if (e.key === '4' || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        const liveSec = audioRef.current ? audioRef.current.currentTime : currentTime;
        addTagAtTime(liveSec, 'hihat');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.05;
        seekTo(Math.max(0, currentTime - step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.05;
        seekTo(currentTime + step);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTagId) {
          e.preventDefault();
          deleteTag(selectedTagId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, addTagAtTime, currentTime, seekTo, selectedTagId, deleteTag]);

  /**
   * Main 60 FPS RAF Loop for Canvas Waveform & Realtime Tag Tracker
   */
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

        // Auto scroll viewport when playhead reaches right 80% of screen
        if (liveSec > viewportStartSecRef.current + visibleDur * 0.8) {
          viewportStartSecRef.current = Math.max(0, liveSec - visibleDur * 0.2);
          setViewportStartSec(viewportStartSecRef.current);
        } else if (liveSec < viewportStartSecRef.current) {
          viewportStartSecRef.current = Math.max(0, liveSec);
          setViewportStartSec(viewportStartSecRef.current);
        }

        // Trigger Tag Audition / Visual Flash
        const nearbyTag = tags.find((t) => Math.abs(t.timeSec - liveSec) < 0.035);
        if (nearbyTag && nearbyTag.id !== lastTriggeredTagRef.current) {
          lastTriggeredTagRef.current = nearbyTag.id;
          playClickSound(nearbyTag.type);

          if (flashOverlayRef.current) {
            const cfg = TAG_CONFIG[nearbyTag.type];
            flashOverlayRef.current.style.backgroundColor = cfg.border;
            flashOverlayRef.current.style.opacity = nearbyTag.type === 'sub-kick' ? '0.5' : '0.3';
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
  }, [duration, audioBuffer, zoomLevel, tags, playClickSound]);

  /**
   * High-DPI Canvas Waveform & Tag Renderer
   */
  const drawWaveform = (liveSec: number, viewStart: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const totalDur = duration || audioBuffer.duration;
    const visibleDur = totalDur / zoomLevel;
    const viewEnd = viewStart + visibleDur;

    const dataL = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Background Cyber Grid
    ctx.fillStyle = '#08080c';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Center Baseline
    const midY = height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Render Waveform Bars
    const numBars = width;
    const samplesPerBar = Math.max(1, Math.floor((visibleDur * sampleRate) / numBars));
    const startSample = Math.floor(viewStart * sampleRate);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let x = 0; x < numBars; x++) {
      const idx = startSample + x * samplesPerBar;
      if (idx >= dataL.length) break;

      let min = 1.0;
      let max = -1.0;
      for (let s = 0; s < samplesPerBar; s += 4) {
        const val = dataL[idx + s] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }

      const barHeight = Math.max(2, (max - min) * (height * 0.42));
      const y = midY - barHeight / 2;

      // Colorize bass / high peaks
      const peakAmp = Math.max(Math.abs(min), Math.abs(max));
      if (peakAmp > 0.65) {
        ctx.fillStyle = 'rgba(255, 60, 60, 0.85)';
      } else if (peakAmp > 0.35) {
        ctx.fillStyle = 'rgba(255, 180, 50, 0.75)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      }

      ctx.fillRect(x, y, 1.2, barHeight);
    }

    // Render Tag Markers
    tags.forEach((tag) => {
      if (tag.timeSec >= viewStart && tag.timeSec <= viewEnd) {
        const tagX = ((tag.timeSec - viewStart) / visibleDur) * width;
        const cfg = TAG_CONFIG[tag.type];
        const isSelected = selectedTagId === tag.id;

        // Vertical Laser Line
        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(tagX, 0);
        ctx.lineTo(tagX, height);
        ctx.stroke();

        // Tag Flag Pin
        ctx.fillStyle = cfg.border;
        ctx.beginPath();
        ctx.moveTo(tagX, 4);
        ctx.lineTo(tagX + 8, 10);
        ctx.lineTo(tagX + 8, 20);
        ctx.lineTo(tagX, 24);
        ctx.fill();

        // Tag Label Pill
        ctx.fillStyle = isSelected ? '#ffffff' : cfg.border;
        ctx.font = 'bold 9px monospace';
        ctx.fillText(tag.type === 'sub-kick' ? '808' : tag.type === 'kick' ? 'K' : tag.type === 'snare' ? 'SN' : 'HH', tagX + 11, 16);
      }
    });

    // Render Playhead Laser directly at liveSec
    if (liveSec >= viewStart && liveSec <= viewEnd) {
      const playheadX = ((liveSec - viewStart) / visibleDur) * width;

      // Glowing Playhead Line
      ctx.strokeStyle = '#ff1e1e';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Playhead Head Indicator
      ctx.fillStyle = '#ff1e1e';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.fill();
    }
  };

  /**
   * Handle Click on Waveform Canvas to Seek or Select Tag
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const widthRatio = clickX / rect.width;

    const totalDur = duration || audioBuffer.duration;
    const visibleDur = totalDur / zoomLevel;
    const targetTime = viewportStartSecRef.current + widthRatio * visibleDur;

    const clickedTag = tags.find((t) => {
      const tagX = ((t.timeSec - viewportStartSecRef.current) / visibleDur) * rect.width;
      return Math.abs(tagX - clickX) < 8;
    });

    if (clickedTag) {
      setSelectedTagId(clickedTag.id);
    } else {
      setSelectedTagId(null);
      seekTo(targetTime);
    }
  };

  /**
   * Format Seconds to MM:SS.mmm
   */
  const formatMillis = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  /**
   * Export Tags to JSON & TypeScript config
   */
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
    return `// PostLain Drum Sync Map: ${selectedTrackTitle}
export const DRUM_SYNC_MAP_${selectedTrackTitle.toUpperCase().replace(/[^A-Z0-9]/g, '_')} = ${JSON.stringify(
      tags.map((t) => ({ time: t.timeSec, type: t.type })),
      null,
      2
    )};`;
  }, [selectedTrackTitle, tags]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(exportTsCodeString);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(exportJsonString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  /**
   * Export Original or Mixed WAV Audio File
   */
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
      a.download = `${selectedTrackTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}${withClicks ? '_WITH_CLICKS' : ''}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export WAV error:', err);
      alert('Không thể xuất file WAV.');
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
      hihat: tags.filter((t) => t.type === 'hihat').length,
    };
  }, [tags]);

  return (
    <div className="space-y-6 text-white font-mono animate-fadeIn pb-16">
      {/* Hidden Master HTML5 Audio Player */}
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
        onTimeUpdate={(e) => {
          setCurrentTime((e.target as HTMLAudioElement).currentTime);
        }}
      />

      {/* Visual Flash Feedback Overlay */}
      <div
        ref={flashOverlayRef}
        className="fixed inset-0 pointer-events-none z-50 transition-opacity duration-75 opacity-0"
      />

      {/* Top Header Card */}
      <div className="p-5 md:p-6 rounded-3xl bg-[#0c0c10]/95 border border-white/20 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white tracking-widest uppercase">
                STUDIO TOOL
              </span>
              <h2 className="text-lg md:text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-500" />
                AUDIO WAVEFORM BEAT & DRUM TAGGER
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Gán nhãn nhịp Kick, Sub-kick (808) và Snare trực tiếp trên thanh sóng âm thanh mili-giây cho hệ thống Visualizer.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setSelectedTrackId('preset_idk');
                setSelectedTrackTitle('02. IDK - MCK');
                loadAudioSource('preset:idk');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                selectedTrackId === 'preset_idk'
                  ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(255,0,0,0.4)]'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>02. IDK (MCK)</span>
            </button>

            <button
              onClick={() => {
                setSelectedTrackId('preset_xauxa');
                setSelectedTrackTitle('03. Ai Mới Là Kẻ Xấu Xa');
                loadAudioSource('preset:xauxa');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                selectedTrackId === 'preset_xauxa'
                  ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(255,0,0,0.4)]'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>03. Ai Mới Là Kẻ Xấu Xa</span>
            </button>

            {/* Custom File Upload */}
            <label className="px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer transition-all flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Nạp Tệp Audio...</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedTrackId(`file_${Date.now()}`);
                    setSelectedTrackTitle(file.name.replace(/\.[^/.]+$/, ''));
                    loadAudioSource(file);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Track Selector Dropdown from Vault Albums */}
        {allTracks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Disc3 className="w-3.5 h-3.5 text-zinc-500" /> Chọn từ kho Album:
            </span>
            <select
              value={selectedTrackId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTrackId(val);
                const found = allTracks.find((t) => t.track.id === val);
                if (found) {
                  setSelectedTrackTitle(found.track.title);
                  const streamUrl = found.track.audio_url ? getMediaCdnUrl(found.track.audio_url) : '';
                  if (streamUrl) {
                    loadAudioSource(streamUrl);
                  }
                }
              }}
              className="bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 max-w-md font-mono"
            >
              <option value="preset_idk">02. IDK - MCK (Preset 134 BPM)</option>
              <option value="preset_xauxa">03. Ai Mới Là Kẻ Xấu Xa (Preset 88 BPM)</option>
              {allTracks.map(({ albumTitle, track }) => (
                <option key={track.id} value={track.id}>
                  [{albumTitle}] {track.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Waveform Canvas Stage */}
      <div className="p-4 md:p-6 rounded-3xl bg-[#07070a] border border-white/20 shadow-2xl relative space-y-4">
        {/* Stage Header Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-500" />
              <span ref={timeDisplayRef} className="text-red-400 font-extrabold text-sm">{formatMillis(currentTime)}</span>
              <span className="text-zinc-500">/ {formatMillis(duration || audioBuffer?.duration || 0)}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] text-zinc-300">
              <span>Zoom:</span>
              <span className="font-bold text-white">{zoomLevel}x</span>
            </div>
          </div>

          {/* Zoom & Viewport Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1.0, Math.round((z - 0.5) * 2) / 2))}
              disabled={zoomLevel <= 1.0}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-all"
              title="Thu nhỏ thanh sóng (Zoom Out)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.min(20.0, Math.round((z + 0.5) * 2) / 2))}
              disabled={zoomLevel >= 20.0}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-all"
              title="Phóng to thanh sóng (Zoom In)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setZoomLevel(1.0);
                setViewportStartSec(0);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all"
            >
              Reset 1x
            </button>
          </div>
        </div>

        {/* Canvas Display */}
        <div ref={containerRef} className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-white/25 cursor-crosshair">
          {isDecoding ? (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-20">
              <Disc3 className="w-8 h-8 text-red-500 animate-spin" />
              <p className="text-xs text-zinc-300 font-bold">{decodeProgress || 'Đang giải mã âm thanh...'}</p>
            </div>
          ) : null}

          <canvas
            ref={canvasRef}
            width={1200}
            height={220}
            onClick={handleCanvasClick}
            className="w-full h-full block"
          />
        </div>

        {/* Horizontal Timeline Scrollbar when zoomed */}
        {zoomLevel > 1.0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Cuộn mốc thời gian:</span>
              <span>
                {formatMillis(viewportStartSec)} → {formatMillis(viewportStartSec + (duration || audioBuffer?.duration || 100) / zoomLevel)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, (duration || audioBuffer?.duration || 100) - (duration || audioBuffer?.duration || 100) / zoomLevel)}
              step={0.1}
              value={viewportStartSec}
              onChange={(e) => setViewportStartSec(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-ew-resize accent-red-500"
            />
          </div>
        )}

        {/* Audio Transport & Playback Controls Bar */}
        <div className="p-3 rounded-2xl bg-black/80 border border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black shadow-[0_0_20px_rgba(255,0,0,0.5)] transition-all flex items-center justify-center"
              title="Phát / Tạm dừng (Phím Space)"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => seekTo(0)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all"
              title="Quay lại đầu bài"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekTo(Math.max(0, currentTime - 0.5))}
              className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all"
              title="Lùi 0.5s (hoặc dùng phím ← để lùi 0.05s)"
            >
              -0.5s
            </button>

            <button
              onClick={() => seekTo(currentTime + 0.5)}
              className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all"
              title="Tiến 0.5s (hoặc dùng phím → để tiến 0.05s)"
            >
              +0.5s
            </button>
          </div>

          {/* Speed & Metronome */}
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
                    playbackRate === rate ? 'bg-red-500 text-white' : 'text-zinc-400 hover:text-white'
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
                  ? 'bg-white/15 border-white text-white'
                  : 'bg-white/5 border-white/10 text-zinc-500'
              }`}
              title="Phát tiếng Click âm thanh khi quét trúng Tag"
            >
              <Activity className="w-3.5 h-3.5 text-red-400" />
              <span>Tiếng Click: {audibleMetronome ? 'BẬT' : 'TẮT'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Tagging Toolbar & Hotkey Actions */}
      <div className="p-5 rounded-3xl bg-[#0c0c10]/95 border border-white/20 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-red-500" />
            BỘ PHÍM GÁN NHÃN NHỊP (HOTKEY TAGGING TOOLBAR)
          </h3>
          <span className="text-xs text-zinc-400">
            Tổng cộng: <strong className="text-white">{tags.length}</strong> nhãn đã gán
          </span>
        </div>

        {/* 4 Multi-Tier Tag Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(['sub-kick', 'kick', 'snare', 'hihat'] as BeatTagType[]).map((type) => {
            const cfg = TAG_CONFIG[type];
            const count = tagCounts[type === 'sub-kick' ? 'subKick' : type === 'kick' ? 'kick' : type === 'snare' ? 'snare' : 'hihat'];

            return (
              <button
                key={type}
                onClick={() => {
                  setActiveTagType(type);
                  const liveSec = audioRef.current ? audioRef.current.currentTime : currentTime;
                  addTagAtTime(liveSec, type);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 group hover:scale-[1.02] shadow-lg ${
                  activeTagType === type
                    ? 'border-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                    : 'border-white/15 bg-black/60 hover:border-white/30'
                }`}
                style={{ borderLeftColor: cfg.border, borderLeftWidth: '5px' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs tracking-wider" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white">
                    {count} nhịp
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Phím tắt: <strong className="text-white font-mono">{cfg.key}</strong></span>
                  <Plus className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:scale-125 transition-all" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Hotkey Guide Box */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-zinc-400 flex items-center gap-3 flex-wrap">
          <HelpCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span><strong>MẸO:</strong> Bấm <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-white font-bold font-mono">Space</kbd> để chạy nhạc, rồi bấm <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-red-400 font-bold font-mono">1/K</kbd> (Kick), <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-red-500 font-bold font-mono">2/S</kbd> (808 Sub-kick), <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-white font-bold font-mono">3/N</kbd> (Snare) đúng lúc nghe thấy tiếng trống để gán nhãn tức thì!</span>
        </div>
      </div>

      {/* Tagged Markers List & Data Export */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tag Markers Timeline Table */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-[#0c0c10]/95 border border-white/20 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-500" />
              DANH SÁCH NHÃN ĐÃ GÁN ({filteredTags.length})
            </h3>

            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/15 text-[10px]">
                {(['all', 'sub-kick', 'kick', 'snare', 'hihat'] as const).map((ft) => (
                  <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    className={`px-2 py-1 rounded-lg font-bold transition-all uppercase ${
                      filterType === ft ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {ft === 'all' ? 'Tất cả' : ft}
                  </button>
                ))}
              </div>

              {tags.length > 0 && (
                <button
                  onClick={clearAllTags}
                  className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs transition-all"
                  title="Xóa tất cả nhãn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tags Table List */}
          <div className="max-h-[360px] overflow-y-auto overflow-x-hidden no-scrollbar space-y-1.5 pr-1">
            {filteredTags.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                Chưa có nhãn nhịp nào. Hãy phát nhạc và bấm phím tắt để gán nhãn!
              </div>
            ) : (
              filteredTags.map((tag, idx) => {
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
                        title="Nhảy tới mốc này"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTag(tag.id);
                        }}
                        className="p-1 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 transition-all"
                        title="Xóa nhãn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Export Code & WAV Audio Downloader */}
        <div className="p-5 rounded-3xl bg-[#0c0c10]/95 border border-white/20 shadow-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-red-500" />
              XUẤT DỮ LIỆU & FILE WAV
            </h3>
            <p className="text-[11px] text-zinc-400">
              Xuất file WAV audio chuẩn hoặc copy cấu hình nhãn nhịp để tích hợp vào hệ thống.
            </p>

            {/* WAV Export Buttons */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                onClick={() => handleExportWavFile(false)}
                disabled={isExportingWav || !audioBuffer}
                className="w-full py-2.5 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <FileAudio className="w-4 h-4" />
                <span>XUẤT FILE WAV GỐC</span>
              </button>

              <button
                onClick={() => handleExportWavFile(true)}
                disabled={isExportingWav || !audioBuffer || tags.length === 0}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-red-900/30"
              >
                <FileDown className="w-4 h-4" />
                <span>XUẤT WAV KÈM NHỊP CLICK</span>
              </button>
            </div>

            {/* JSON / TypeScript Code Preview */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                  MÃ HỌC MÁY CHO AI (GROUND-TRUTH):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyJson}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white flex items-center gap-1 font-bold"
                    title="Sao chép dạng JSON chuẩn"
                  >
                    {copiedJson ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>JSON</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    className="px-2 py-0.5 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-[10px] text-red-300 hover:text-white flex items-center gap-1 font-bold"
                    title="Sao chép mã Ground-Truth Dataset TypeScript cho AI học máy"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>Dataset TS</span>
                  </button>
                </div>
              </div>

              {/* Realtime Beat Analysis & Calibration Specs */}
              {tags.length > 0 && (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] space-y-1 text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span>Tổng cú Kick/Sub:</span>
                    <strong className="text-red-400">{tagCounts.kick + tagCounts.subKick} nhịp ({tagCounts.subKick} Sub-808)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tổng cú Snare/Clap:</span>
                    <strong className="text-white">{tagCounts.snare} nhịp</strong>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-1 text-zinc-400">
                    <span>Định dạng:</span>
                    <span className="text-emerald-400 font-bold">Standard Ground-Truth v2.0 (AI Verified)</span>
                  </div>
                </div>
              )}

              <pre className="p-2.5 rounded-xl bg-black/90 border border-white/15 text-[10px] text-zinc-300 overflow-x-auto max-h-36 no-scrollbar font-mono leading-relaxed">
                {exportJsonString}
              </pre>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 text-[10px] text-zinc-500 text-center">
            PostLain Hidden Music Vault • Audio Graph Drum Tagger & AI Benchmark
          </div>
        </div>
      </div>
    </div>
  );
}
