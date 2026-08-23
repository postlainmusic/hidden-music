'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  ListMusic,
  Disc3,
  Mic2,
  ChevronDown,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { getTrackDrumProfile, isDrumActiveAtTime } from '@/lib/dsp/trackDrumProfiles';
import { LiveWaveformBeatEngine } from '@/lib/dsp/liveWaveformBeat';
import TrackActionMenu from '@/components/ui/TrackActionMenu';

const formatTime = (secs: number) => {
  if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const rem = Math.floor(secs % 60);
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
};

const cleanLyrics = (raw?: string) => {
  if (!raw) return '';
  return raw
    .split('\n')
    .map((line) => line.replace(/\[\d{2}:\d{2}(\.\d+)?\]/g, '').trim())
    .filter((line) => line.length > 0)
    .join('\n');
};

export default function DesktopPlayerBar() {
  const {
    currentTrack,
    currentAlbum,
    playlist,
    userQueue,
    removeFromQueue,
    clearQueue,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    shuffleMode,
    repeatMode,
    activeZone,
    audioRef,
    currentTimeRef,
    analyserRef,
    currentAmplitude,
    getAmplitudeAtTime,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const drumProfile = useMemo(() => getTrackDrumProfile(currentTrack?.title || currentTrack?.id), [currentTrack?.title, currentTrack?.id]);

  const [expandedMode, setExpandedMode] = useState<'none' | 'lyrics' | 'queue'>('none');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const playerRootRef = useRef<HTMLDivElement | null>(null);
  const playerCardRef = useRef<HTMLDivElement | null>(null);
  const timelineRafIdRef = useRef<number | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeSliderRef = useRef<HTMLDivElement | null>(null);
  const isDraggingVolumeRef = useRef<boolean>(false);

  // Direct DOM refs for 60FPS Audio-Reactive elements
  const currentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const seekerInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);
  const coverBoxRef = useRef<HTMLDivElement | null>(null);
  const titleTextRef = useRef<HTMLSpanElement | null>(null);
  const artistTextRef = useRef<HTMLSpanElement | null>(null);
  const playBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevBtnRef = useRef<HTMLButtonElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const shuffleBtnRef = useRef<HTMLButtonElement | null>(null);
  const repeatBtnRef = useRef<HTMLButtonElement | null>(null);
  const lyricsBtnRef = useRef<HTMLButtonElement | null>(null);
  const queueBtnRef = useRef<HTMLButtonElement | null>(null);

  // Multi-Band Audio Analyzer State
  const kickScaleRef = useRef<number>(1);
  const targetKickScaleRef = useRef<number>(1);
  const kickRedIntensityRef = useRef<number>(0);
  const targetKickRedIntensityRef = useRef<number>(0);
  const snareStrobeRef = useRef<number>(0);
  const targetSnareStrobeRef = useRef<number>(0);

  const fastBassRef = useRef<number>(0);
  const slowBassRef = useRef<number>(0);
  const lastKickHitTimeRef = useRef<number>(0);

  const fastMidRef = useRef<number>(0);
  const slowMidRef = useRef<number>(0);
  const fastHighRef = useRef<number>(0);
  const slowHighRef = useRef<number>(0);
  const lastSnareHitTimeRef = useRef<number>(0);

  const smoothBasslineRef = useRef<number>(0);
  const fastVocalRef = useRef<number>(0);
  const slowVocalRef = useRef<number>(0);
  const smoothVocalRef = useRef<number>(0);

  const fastTrebleRef = useRef<number>(0);
  const slowTrebleRef = useRef<number>(0);
  const trebleStrobeRef = useRef<number>(0);
  const targetTrebleStrobeRef = useRef<number>(0);
  const lastTrebleHitTimeRef = useRef<number>(0);

  const smoothEnergyRef = useRef<number>(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (playerRootRef.current && !playerRootRef.current.contains(e.target as Node)) {
        setExpandedMode('none');
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const effectiveDuration = (duration && Number.isFinite(duration) && duration > 0)
    ? duration
    : (currentTrack?.duration && currentTrack.duration > 0)
    ? currentTrack.duration
    : (audioRef?.current?.duration && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration
    : 0;

  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (timelineRafIdRef.current) cancelAnimationFrame(timelineRafIdRef.current);
      targetKickScaleRef.current = 0;
      kickScaleRef.current = 1;
      targetKickRedIntensityRef.current = 0;
      kickRedIntensityRef.current = 0;
      targetSnareStrobeRef.current = 0;
      snareStrobeRef.current = 0;
      fastBassRef.current = 0; slowBassRef.current = 0;
      fastMidRef.current = 0; slowMidRef.current = 0;
      fastHighRef.current = 0; slowHighRef.current = 0;
      fastVocalRef.current = 0; slowVocalRef.current = 0; smoothVocalRef.current = 0;
      fastTrebleRef.current = 0; slowTrebleRef.current = 0;
      trebleStrobeRef.current = 0; targetTrebleStrobeRef.current = 0;
      smoothBasslineRef.current = 0; smoothEnergyRef.current = 0;
      return;
    }

    const liveWaveformEngineRef = { current: new LiveWaveformBeatEngine(1024, 0.015, 55) };
    const dataArray = new Uint8Array(1024);

    const updateLiveDesktopShow = () => {
      const now = performance.now();
      const liveSec = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : 0);
      const isDrumming = isDrumActiveAtTime(drumProfile, liveSec);

      if (!isDraggingSeekerRef.current) {
        if (seekerInputRef.current) {
          seekerInputRef.current.value = String(liveSec);
        }
        if (currentTimeTextRef.current) {
          currentTimeTextRef.current.textContent = formatTime(liveSec);
        }
      }

      let hasRealData = false;
      if (analyserRef?.current) {
        try {
          analyserRef.current.getByteFrequencyData(dataArray);
          for (let i = 2; i <= 20; i++) {
            if (dataArray[i] > 0) {
              hasRealData = true;
              break;
            }
          }
        } catch {}
      }

      if (!hasRealData) {
        const rawAmp = currentAmplitude || (getAmplitudeAtTime ? getAmplitudeAtTime(liveSec) : 0.4);
        for (let i = 0; i < 1024; i++) dataArray[i] = Math.floor(rawAmp * 120);

        if (isDrumming) {
          const beatPeriod = 60 / drumProfile.bpm;
          const beatPhase = (liveSec % beatPeriod) / beatPeriod;
          const isKickBeat = beatPhase < 0.12;
          const isSnareBeat = Math.abs(beatPhase - 0.5) < 0.10;

          if (isKickBeat && drumProfile.hasKick) {
            for (let i = 2; i <= 6; i++) dataArray[i] = Math.min(255, Math.floor(rawAmp * 255 * 1.5));
          }
          if (isSnareBeat && drumProfile.hasSnare) {
            for (let i = 70; i <= 140; i++) dataArray[i] = Math.min(255, Math.floor(rawAmp * 230 * 1.3));
            for (let i = 200; i <= 400; i++) dataArray[i] = Math.min(255, Math.floor(rawAmp * 210 * 1.2));
          }
        } else {
          for (let i = 2; i <= 10; i++) dataArray[i] = Math.floor(rawAmp * 40);
          for (let i = 70; i <= 140; i++) dataArray[i] = Math.floor(rawAmp * 50);
        }
      }

      // 1. SUB-BASS / KICK
      let bassSum = 0;
      for (let i = 2; i <= 6; i++) bassSum += dataArray[i];
      const currentBass = bassSum / 5;
      const fB = fastBassRef.current * 0.15 + currentBass * 0.85;
      const sB = slowBassRef.current * 0.88 + currentBass * 0.12;
      fastBassRef.current = fB;
      slowBassRef.current = sB;
      const bassFlux = Math.max(0, fB - sB);

      // 2. BASSLINE / 808
      let basslineSum = 0;
      for (let i = 3; i <= 12; i++) basslineSum += dataArray[i];
      const currentBassline = basslineSum / 10;
      smoothBasslineRef.current += ((currentBassline / 255) - smoothBasslineRef.current) * 0.22;

      // 3. SNARE DUAL-BAND GATE
      let midSum = 0;
      for (let i = 70; i <= 140; i++) midSum += dataArray[i];
      const currentMid = midSum / 71;
      const fM = fastMidRef.current * 0.15 + currentMid * 0.85;
      const sM = slowMidRef.current * 0.88 + currentMid * 0.12;
      fastMidRef.current = fM;
      slowMidRef.current = sM;
      const midFlux = Math.max(0, fM - sM);

      let highSum = 0;
      for (let i = 200; i <= 420; i++) highSum += dataArray[i];
      const currentHigh = highSum / 221;
      const fH = fastHighRef.current * 0.15 + currentHigh * 0.85;
      const sH = slowHighRef.current * 0.88 + currentHigh * 0.12;
      fastHighRef.current = fH;
      slowHighRef.current = sH;
      const highFlux = Math.max(0, fH - sH);

      // 4. VOCAL / LEAD
      let vocalSum = 0;
      for (let i = 14; i <= 162; i++) vocalSum += dataArray[i];
      const currentVocal = vocalSum / 148;
      const fV = fastVocalRef.current * 0.20 + currentVocal * 0.80;
      const sV = slowVocalRef.current * 0.90 + currentVocal * 0.10;
      fastVocalRef.current = fV;
      slowVocalRef.current = sV;
      smoothVocalRef.current += ((currentVocal / 255) - smoothVocalRef.current) * 0.20;

      // 5. TREBLE / HI-HATS
      let trebleSum = 0;
      for (let i = 232; i <= 743; i++) trebleSum += dataArray[i];
      const currentTreble = trebleSum / 512;
      const fT = fastTrebleRef.current * 0.15 + currentTreble * 0.85;
      const sT = slowTrebleRef.current * 0.88 + currentTreble * 0.12;
      fastTrebleRef.current = fT;
      slowTrebleRef.current = sT;
      const trebleFlux = Math.max(0, fT - sT);

      // 6. TOTAL ENERGY (RMS)
      let totalSum = 0;
      for (let i = 0; i < 1024; i++) totalSum += dataArray[i];
      const currentEnergy = totalSum / 1024;
      smoothEnergyRef.current += ((currentEnergy / 255) - smoothEnergyRef.current) * 0.15;

      const liveWaveBeat = liveWaveformEngineRef.current.processLiveAnalyser(analyserRef?.current, now);

      if (isDrumming) {
        const timeSinceLastKick = now - lastKickHitTimeRef.current;
        const isConsecutiveKick = timeSinceLastKick >= 55 && timeSinceLastKick < 240;
        const kickThreshold = isConsecutiveKick
          ? 1.6 * drumProfile.fluxSensitivity
          : 2.6 * drumProfile.fluxSensitivity;

        const is808Sustaining = currentBass > 195 && bassFlux < 3.0;
        const hasBassTransient = bassFlux > kickThreshold && !is808Sustaining && timeSinceLastKick >= 55;
        const hasWaveformKick = liveWaveBeat.isBeat;

        if (hasBassTransient || hasWaveformKick) {
          lastKickHitTimeRef.current = now;
          const isSub808HeavyKick = (currentBass > 135 || bassFlux > 7.0 || (drumProfile.hasKick && currentBass > 115));

          if (isSub808HeavyKick) {
            const force = Math.min(0.26, 0.13 + bassFlux / 70);
            targetKickScaleRef.current += force;
            targetKickRedIntensityRef.current = 1.0;
          } else {
            const force = Math.min(0.13, 0.070 + bassFlux / 120);
            targetKickScaleRef.current += force;
            targetKickRedIntensityRef.current = Math.max(targetKickRedIntensityRef.current, 0.88);
          }
        }

        const timeSinceLastSnare = now - lastSnareHitTimeRef.current;
        const isSnare = midFlux > 3.0 * drumProfile.fluxSensitivity && highFlux > 1.3;
        if (isSnare && timeSinceLastSnare >= 65) {
          lastSnareHitTimeRef.current = now;
          targetSnareStrobeRef.current = Math.min(1.0, Math.max(0.35, midFlux / 16));
        }

        const timeSinceLastTreble = now - lastTrebleHitTimeRef.current;
        if (trebleFlux > 1.3 && timeSinceLastTreble >= 55) {
          lastTrebleHitTimeRef.current = now;
          targetTrebleStrobeRef.current = Math.min(1.0, Math.max(0.30, trebleFlux / 8));
        }
      }

      // Physics
      const displacement = kickScaleRef.current - 1.0;
      targetKickScaleRef.current -= displacement * 0.30;
      targetKickScaleRef.current *= 0.65;
      kickScaleRef.current += targetKickScaleRef.current;
      if (kickScaleRef.current < 0.985) kickScaleRef.current = 0.985;

      kickRedIntensityRef.current += (targetKickRedIntensityRef.current - kickRedIntensityRef.current) * 0.48;
      targetKickRedIntensityRef.current *= 0.70;

      snareStrobeRef.current += (targetSnareStrobeRef.current - snareStrobeRef.current) * 0.55;
      targetSnareStrobeRef.current *= 0.72;

      trebleStrobeRef.current += (targetTrebleStrobeRef.current - trebleStrobeRef.current) * 0.65;
      targetTrebleStrobeRef.current *= 0.58;

      const k = kickScaleRef.current;
      const s = snareStrobeRef.current;
      const tr = trebleStrobeRef.current;
      const bl = smoothBasslineRef.current;
      const vocalFlux = Math.max(0, fastVocalRef.current - slowVocalRef.current);
      const voc = Math.min(1.0, smoothVocalRef.current * 1.6 + (vocalFlux > 2.0 ? vocalFlux / 20 : 0));
      const nrg = smoothEnergyRef.current;

      const redIntensity = Math.min(1.0, Math.max(0, kickRedIntensityRef.current));
      const kickDelta = Math.max(0, k - 1.0);

      const g = Math.floor(255 - redIntensity * 230);
      const b = Math.floor(255 - redIntensity * 230);
      const kickColor = `255, ${g}, ${b}`;

      // DOM Updates
      if (coverBoxRef.current) {
        coverBoxRef.current.style.transform = `scale(${k})`;
        coverBoxRef.current.style.borderColor = `rgba(${kickColor}, ${0.25 + redIntensity * 0.65 + kickDelta * 2.0})`;
        coverBoxRef.current.style.boxShadow = `
          0 0 ${10 + redIntensity * 35 + kickDelta * 80}px rgba(${kickColor}, ${0.25 + redIntensity * 0.65}),
          0 0 ${s * 30}px rgba(255, 255, 255, ${s * 0.6})
        `;
      }

      if (playBtnRef.current) {
        playBtnRef.current.style.transform = `scale(${1 + kickDelta * 0.9})`;
        playBtnRef.current.style.boxShadow = `0 0 ${12 + redIntensity * 30 + kickDelta * 60 + s * 25}px rgba(${kickColor}, ${0.35 + redIntensity * 0.5 + s * 0.4})`;
      }

      if (titleTextRef.current) {
        titleTextRef.current.style.textShadow = s > 0.25 
          ? `0 0 16px rgba(255,255,255,${s})` 
          : `0 0 ${4 + voc * 18}px rgba(255, 255, 255, ${0.2 + voc * 0.8})`;
      }

      if (artistTextRef.current) {
        artistTextRef.current.style.color = `rgba(255, 255, 255, ${0.45 + voc * 0.5})`;
      }

      if (seekerInputRef.current) {
        const progPercent = (effectiveDuration && effectiveDuration > 0)
          ? Math.min(100, Math.max(0, (liveSec / effectiveDuration) * 100))
          : 0;
        const wavePulse = Math.sin(now / 120) * bl * 5;
        const activeWidth = Math.min(100, Math.max(0, progPercent + wavePulse));
        seekerInputRef.current.style.boxShadow = `0 0 ${3 + bl * 14}px rgba(255, 255, 255, ${0.2 + bl * 0.5})`;
        seekerInputRef.current.style.backgroundImage = `linear-gradient(90deg, rgba(255,255,255,${0.35 + bl * 0.35}) 0%, rgba(255,255,255,${0.60 + bl * 0.40}) ${activeWidth}%, rgba(255,255,255,0.06) ${activeWidth}%)`;
      }

      if (prevBtnRef.current) {
        prevBtnRef.current.style.boxShadow = tr > 0.15 ? `0 0 ${10 * tr}px rgba(255, 255, 255, ${tr * 0.6})` : 'none';
        prevBtnRef.current.style.transform = tr > 0.15 ? `scale(${1 + tr * 0.07})` : 'scale(1)';
      }

      if (nextBtnRef.current) {
        nextBtnRef.current.style.boxShadow = tr > 0.15 ? `0 0 ${10 * tr}px rgba(255, 255, 255, ${tr * 0.6})` : 'none';
        nextBtnRef.current.style.transform = tr > 0.15 ? `scale(${1 + tr * 0.07})` : 'scale(1)';
      }

      if (shuffleBtnRef.current) {
        shuffleBtnRef.current.style.boxShadow = tr > 0.15 
          ? `0 0 ${10 * tr}px rgba(255, 255, 255, ${tr * 0.6})` 
          : (shuffleMode ? '0 0 10px rgba(255,255,255,0.3)' : 'none');
      }

      if (repeatBtnRef.current) {
        repeatBtnRef.current.style.boxShadow = tr > 0.15 
          ? `0 0 ${10 * tr}px rgba(255, 255, 255, ${tr * 0.6})` 
          : (repeatMode !== 'off' ? '0 0 10px rgba(255,255,255,0.3)' : 'none');
      }

      if (lyricsBtnRef.current) {
        lyricsBtnRef.current.style.boxShadow = expandedMode === 'lyrics' 
          ? '0 0 12px rgba(255,255,255,0.4)' 
          : `0 0 ${4 + nrg * 14}px rgba(255, 255, 255, ${0.1 + nrg * 0.45})`;
      }

      if (queueBtnRef.current) {
        queueBtnRef.current.style.boxShadow = expandedMode === 'queue' 
          ? '0 0 12px rgba(255,255,255,0.4)' 
          : `0 0 ${4 + nrg * 14}px rgba(255, 255, 255, ${0.1 + nrg * 0.45})`;
      }

      if (playerCardRef.current) {
        playerCardRef.current.style.transform = `scale(${1 + Math.max(0, k - 1) * 0.15})`;
        playerCardRef.current.style.borderColor = `rgba(${kickColor}, ${0.15 + (k - 1) * 0.45 + s * 0.25})`;
        playerCardRef.current.style.boxShadow = `
          0 20px 50px rgba(0, 0, 0, 0.85),
          0 0 ${15 + (k - 1) * 65}px rgba(${kickColor}, ${0.10 + (k - 1) * 0.45}),
          0 0 ${s * 25}px rgba(255, 255, 255, ${s * 0.35}),
          inset 0 0 ${10 + s * 20}px rgba(255, 255, 255, ${s * 0.15})
        `;
      }

      timelineRafIdRef.current = requestAnimationFrame(updateLiveDesktopShow);
    };

    timelineRafIdRef.current = requestAnimationFrame(updateLiveDesktopShow);

    return () => {
      if (timelineRafIdRef.current) cancelAnimationFrame(timelineRafIdRef.current);
    };
  }, [isPlaying, activeZone, currentTimeRef, audioRef, analyserRef, effectiveDuration, shuffleMode, repeatMode, expandedMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (activeZone === 'video') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setExpandedMode((prev) => (prev === 'lyrics' ? 'none' : 'lyrics'));
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setExpandedMode((prev) => (prev === 'queue' ? 'none' : 'queue'));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.max(0, cur - 5));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.min(duration || 999, cur + 5));
      } else if (e.key === 'Escape') {
        setExpandedMode('none');
        setShowVolumeSlider(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeZone, togglePlay, seekTo, currentTime, duration, currentTimeRef]);

  const calculateVolumeFromClientY = useCallback(
    (clientY: number) => {
      if (!volumeSliderRef.current) return;
      const rect = volumeSliderRef.current.getBoundingClientRect();
      const height = rect.height;
      const offsetY = rect.bottom - clientY;
      const ratio = Math.max(0, Math.min(1, offsetY / height));
      setVolume(Number(ratio.toFixed(2)));
    },
    [setVolume]
  );

  const handleVolumeDragStart = useCallback(
    (clientY: number) => {
      isDraggingVolumeRef.current = true;
      calculateVolumeFromClientY(clientY);

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingVolumeRef.current) return;
        calculateVolumeFromClientY(e.clientY);
      };

      const handleMouseUp = () => {
        isDraggingVolumeRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [calculateVolumeFromClientY]
  );

  const handleVolumeMouseEnter = () => {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    setShowVolumeSlider(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeTimeoutRef.current = setTimeout(() => {
      if (!isDraggingVolumeRef.current) {
        setShowVolumeSlider(false);
      }
    }, 450);
  };

  if (!currentTrack) return null;

  const isDrawerOpen = expandedMode !== 'none';
  const displayLyrics = cleanLyrics(currentTrack?.lyrics);

  return (
    <div
      ref={playerRootRef}
      className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-5xl z-50 pointer-events-none px-4 sm:px-6 select-none flex flex-col justify-end"
    >
      <div 
        ref={playerCardRef}
        className="w-full bg-zinc-950/70 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto overflow-hidden flex flex-col transition-[all] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
      >
        {/* TOP EXPANDABLE SECTION */}
        <div
          className={`w-full overflow-hidden transition-[height,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
            isDrawerOpen
              ? 'h-[360px] sm:h-[400px] opacity-100'
              : 'h-0 opacity-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 sm:px-8 py-3 flex-shrink-0 border-b border-white/10">
            <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-2xl border border-white/15 shadow-inner">
              <button
                onClick={() => setExpandedMode('lyrics')}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  expandedMode === 'lyrics'
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)] font-extrabold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span>LỜI BÀI HÁT</span>
              </button>
              <button
                onClick={() => setExpandedMode('queue')}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  expandedMode === 'queue'
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)] font-extrabold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>HÀNG CHỜ ({userQueue.length + playlist.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-widest hidden sm:inline-block">
                ESC HOẶC NHẤN NGOÀI ĐỂ ĐÓNG
              </span>
              <button
                onClick={() => setExpandedMode('none')}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white text-zinc-300 hover:text-black transition-all"
                title="Thu nhỏ (Esc)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 px-6 sm:px-8 pb-3 overflow-hidden relative">
            {/* Lyrics View */}
            {expandedMode === 'lyrics' && (
              <div 
                className="w-full h-full overflow-y-auto no-scrollbar py-6 text-center select-text font-cyber"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {displayLyrics ? (
                  <p className="text-base sm:text-lg font-bold text-zinc-200 leading-relaxed whitespace-pre-line tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    {displayLyrics}
                  </p>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                    <Mic2 className="w-8 h-8 text-zinc-600 mb-2 opacity-50" />
                    <p className="text-xs uppercase tracking-widest font-mono">Chưa có lời bài hát cho ca khúc này</p>
                  </div>
                )}
              </div>
            )}

            {/* Queue Mode */}
            {expandedMode === 'queue' && (
              <div
                className="w-full h-full overflow-y-auto no-scrollbar space-y-3 py-2 font-mono pr-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {/* USER QUEUE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-300 uppercase">
                        HÀNG CHỜ PHÁT ({userQueue.length})
                      </span>
                    </div>
                    {userQueue.length > 0 && (
                      <button
                        onClick={clearQueue}
                        className="text-[9px] font-mono text-zinc-500 hover:text-white transition-colors flex items-center gap-1 uppercase"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {userQueue.length === 0 ? (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                      <p className="text-[11px] text-zinc-400">Hàng chờ trống</p>
                      <p className="text-[9px] text-zinc-600 mt-0.5">
                        Tự động phát ngẫu nhiên từ thư viện khi hết bài.
                      </p>
                    </div>
                  ) : (
                    userQueue.map((track, idx) => (
                      <div
                        key={`queue_${track.id}_${idx}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
                      >
                        <div
                          onClick={() => {
                            removeFromQueue(track.id);
                            playTrack(track, currentAlbum, playlist);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="text-[10px] font-mono text-zinc-500 w-4 text-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs truncate font-bold text-white group-hover:text-zinc-200">
                              {track.title}
                            </p>
                            <p className="text-[9px] text-zinc-500 truncate uppercase">
                              {track.artist || 'Unknown Artist'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(track.id);
                          }}
                          title="Xóa khỏi hàng chờ"
                          className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all ml-2 flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* PLAYLIST */}
                {playlist.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                        ĐANG PHÁT TỪ ALBUM / THƯ VIỆN ({playlist.length})
                      </span>
                      {shuffleMode && (
                        <span className="text-[8px] font-mono text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded">
                          SHUFFLE ON
                        </span>
                      )}
                    </div>
                    {playlist.map((track, idx) => {
                      const isCur = track.id === currentTrack?.id;
                      return (
                        <div
                          key={track.id || idx}
                          onClick={() => playTrack(track, currentAlbum, playlist)}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isCur
                              ? 'bg-white/15 border-white text-white font-bold shadow-md'
                              : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono text-zinc-500 w-4 text-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs truncate font-bold">{track.title}</p>
                              <p className="text-[9px] text-zinc-500 truncate">{track.artist || currentAlbum?.artist}</p>
                            </div>
                          </div>
                          {isCur && <Disc3 className="w-3.5 h-3.5 text-white animate-spin flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM PLAYBAR ROW */}
        <div className="w-full px-4 sm:px-6 py-3 flex flex-col gap-1 flex-shrink-0">
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Track Info */}
            <div
              onClick={() => setExpandedMode((prev) => (prev === 'lyrics' ? 'none' : 'lyrics'))}
              className="flex items-center gap-3 min-w-0 max-w-[240px] flex-shrink-0 cursor-pointer group/trackinfo"
            >
              <div
                ref={coverBoxRef}
                className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0 shadow-md will-change-transform"
              >
                {currentAlbum?.cover_url ? (
                  <img
                    src={currentAlbum.cover_url}
                    alt={currentAlbum.title || 'Cover'}
                    className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : ''} transition-transform duration-500`}
                  />
                ) : (
                  <Disc3
                    className="w-full h-full p-2 text-white/50 animate-spin"
                    style={{ animationPlayState: isPlaying ? 'running' : 'paused', animationDuration: '4s' }}
                  />
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <span 
                  ref={titleTextRef}
                  className="text-xs font-cyber font-extrabold text-white truncate uppercase tracking-wide group-hover/trackinfo:text-zinc-200 transition-colors"
                >
                  {currentTrack.title}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]" />
                  <span 
                    ref={artistTextRef}
                    className="text-[10px] text-zinc-400 font-mono font-bold truncate uppercase transition-colors"
                  >
                    {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls + Timeline */}
            <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  ref={shuffleBtnRef}
                  onClick={toggleShuffle}
                  title={shuffleMode ? 'Tắt trộn bài' : 'Bật trộn bài'}
                  className={`flex p-2 rounded-full border transition-all will-change-transform ${
                    shuffleMode
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                <button
                  ref={prevBtnRef}
                  onClick={prevTrack}
                  title="Bài trước"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95 will-change-transform"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                <button
                  ref={playBtnRef}
                  onClick={togglePlay}
                  title={isBuffering ? 'Đang tải âm thanh...' : isPlaying ? 'Tạm dừng' : 'Phát'}
                  className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95 flex-shrink-0 will-change-transform"
                >
                  {isBuffering ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-4.5 h-4.5 fill-current" />
                  ) : (
                    <Play className="w-4.5 h-4.5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  ref={nextBtnRef}
                  onClick={nextTrack}
                  title="Bài kế tiếp"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95 will-change-transform"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>

                <button
                  ref={repeatBtnRef}
                  onClick={toggleRepeat}
                  title={`Lặp: ${repeatMode}`}
                  className={`flex p-2 rounded-full border transition-all will-change-transform ${
                    repeatMode !== 'off'
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/15'
                  }`}
                >
                  {repeatMode === 'one' ? (
                    <Repeat1 className="w-3.5 h-3.5" />
                  ) : (
                    <Repeat className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <span
                ref={currentTimeTextRef}
                className="inline-block text-xs font-mono font-bold text-zinc-400 tabular-nums flex-shrink-0"
              >
                {formatTime(currentTime)}
              </span>

              <div className="relative flex-1 flex items-center min-w-[80px] group/seek">
                <input
                  ref={seekerInputRef}
                  type="range"
                  min={0}
                  max={effectiveDuration || 100}
                  defaultValue={currentTime}
                  onMouseDown={() => {
                    isDraggingSeekerRef.current = true;
                  }}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (currentTimeTextRef.current) {
                      currentTimeTextRef.current.textContent = formatTime(val);
                    }
                  }}
                  onMouseUp={(e) => {
                    isDraggingSeekerRef.current = false;
                    seekTo(parseFloat((e.target as HTMLInputElement).value));
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer border border-white/15 bg-zinc-900 group-hover/seek:bg-zinc-800 transition-all shadow-inner"
                />
              </div>

              <span className="inline-block text-xs font-mono font-bold text-zinc-400 tabular-nums flex-shrink-0">
                {formatTime(effectiveDuration)}
              </span>
            </div>

            {/* Right Buttons */}
            <div className="flex items-center gap-2 justify-end flex-shrink-0">
              <button
                ref={lyricsBtnRef}
                onClick={() => setExpandedMode((prev) => (prev === 'lyrics' ? 'none' : 'lyrics'))}
                title="Lời bài hát (L)"
                className={`p-2 rounded-full border transition-all will-change-transform ${
                  expandedMode === 'lyrics'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
              </button>

              <button
                ref={queueBtnRef}
                onClick={() => setExpandedMode((prev) => (prev === 'queue' ? 'none' : 'queue'))}
                title="Danh sách phát (Q)"
                className={`p-2 rounded-full border transition-all will-change-transform ${
                  expandedMode === 'queue'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
              </button>

              <TrackActionMenu track={currentTrack} album={currentAlbum} />

              <div
                className="relative"
                onMouseEnter={handleVolumeMouseEnter}
                onMouseLeave={handleVolumeMouseLeave}
              >
                <button
                  onClick={() => setShowVolumeSlider((prev) => !prev)}
                  onDoubleClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                  title={`Âm lượng: ${Math.round(volume * 100)}%`}
                  className={`p-2 rounded-full border transition-all ${
                    showVolumeSlider
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/5 hover:bg-white/20 text-zinc-300 hover:text-white border border-white/10'
                  }`}
                >
                  {volume >= 0.5 ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : volume > 0 ? (
                    <Volume1 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  )}
                </button>

                {showVolumeSlider && (
                  <div
                    className="absolute bottom-12 right-0 p-2.5 rounded-3xl bg-zinc-950/98 border border-white/25 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl flex flex-col items-center gap-2 animate-fadeIn z-50 select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-white font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/15 tabular-nums shadow-sm">
                      {Math.round(volume * 100)}%
                    </span>

                    <div
                      ref={volumeSliderRef}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleVolumeDragStart(e.clientY);
                      }}
                      className="relative w-11 h-36 rounded-full bg-zinc-900 border border-white/20 overflow-hidden cursor-pointer shadow-inner flex flex-col justify-end group/slider"
                    >
                      <div
                        style={{ height: `${Math.round(volume * 100)}%` }}
                        className="w-full bg-white transition-[height] duration-75 ease-out rounded-b-full pointer-events-none"
                      />

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center transition-colors">
                        {volume >= 0.5 ? (
                          <Volume2 className={`w-4 h-4 transition-colors ${volume > 0.18 ? 'text-black' : 'text-white'}`} />
                        ) : volume > 0 ? (
                          <Volume1 className={`w-4 h-4 transition-colors ${volume > 0.18 ? 'text-black' : 'text-white'}`} />
                        ) : (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
