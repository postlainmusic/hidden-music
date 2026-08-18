'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
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
  X,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '@/lib/lrcParser';
import { hasActiveSession } from '@/lib/authSession';

const formatTime = (secs: number) => {
  if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const rem = Math.floor(secs % 60);
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
};

export default function GlobalPlayerBar() {
  const {
    currentTrack,
    currentAlbum,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffleMode,
    repeatMode,
    activeZone,
    audioRef,
    currentTimeRef,
    analyserRef,
    kickAnalyserRef,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const [mounted, setMounted] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const playerRootRef = useRef<HTMLDivElement | null>(null);
  const barContainerRef = useRef<HTMLDivElement | null>(null);
  const fireOverlayRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const timelineRafIdRef = useRef<number | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeSliderRef = useRef<HTMLDivElement | null>(null);
  const isDraggingVolumeRef = useRef<boolean>(false);

  // Direct DOM refs for 60FPS timeline updates without React re-renders
  const currentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const seekerInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);
  const lastKickTimeRef = useRef<number>(0);
  const bassHistoryRef = useRef<number[]>([]);
  const prevInstantEnergyRef = useRef<number>(0);
  const barFlashIntensityRef = useRef<number>(0);
  const barScaleRef = useRef<number>(1);
  const isHeavyKickRef = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setIsAuth(hasActiveSession());

    const handleAuthChange = () => {
      setIsAuth(hasActiveSession());
    };

    window.addEventListener('vault_auth_change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('vault_auth_change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  // Reset beat state on track change
  useEffect(() => {
    bassHistoryRef.current = [];
    prevInstantEnergyRef.current = 0;
  }, [currentTrack?.id]);

  // Click outside to close drawers and volume slider
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (playerRootRef.current && !playerRootRef.current.contains(e.target as Node)) {
        setShowLyrics(false);
        setShowQueue(false);
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // High-Performance 60FPS Direct DOM Timeline Updater (Zero React Re-render Lag)
  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (timelineRafIdRef.current) cancelAnimationFrame(timelineRafIdRef.current);
      return;
    }

    const updateDirectTimeline = () => {
      if (!isDraggingSeekerRef.current) {
        const liveSec = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : 0);
        if (seekerInputRef.current) {
          seekerInputRef.current.value = String(liveSec);
        }
        if (currentTimeTextRef.current) {
          currentTimeTextRef.current.textContent = formatTime(liveSec);
        }
      }
      timelineRafIdRef.current = requestAnimationFrame(updateDirectTimeline);
    };

    timelineRafIdRef.current = requestAnimationFrame(updateDirectTimeline);

    return () => {
      if (timelineRafIdRef.current) cancelAnimationFrame(timelineRafIdRef.current);
    };
  }, [isPlaying, activeZone, currentTimeRef, audioRef]);

  // High-Precision Low-Pass Dynamic Kick Detection Engine (30Hz - 120Hz)
  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (fireOverlayRef.current) fireOverlayRef.current.style.opacity = '0';
      if (barContainerRef.current) {
        barContainerRef.current.style.transform = 'scale(1)';
        barContainerRef.current.style.boxShadow = '';
        barContainerRef.current.style.borderColor = '';
      }
      bassHistoryRef.current = [];
      prevInstantEnergyRef.current = 0;
      return;
    }

    const analyzeFrame = () => {
      const now = performance.now();
      let beatDetected = false;
      let kickStrength = 0;

      const activeNode = kickAnalyserRef?.current || analyserRef?.current;
      if (activeNode) {
        try {
          const freqData = new Uint8Array(activeNode.frequencyBinCount);
          activeNode.getByteFrequencyData(freqData);

          // Dedicated 30Hz - 120Hz Sub-Bass / Kick Energy
          // fftSize 512 gives Bin 0 = 0-86Hz, Bin 1 = 86-172Hz (isolated by 120Hz lowpass filter)
          const instantEnergy = (freqData[0] * 1.6 + freqData[1] * 1.1) / 2.7;

          if (instantEnergy >= 16) {
            // Update sliding history buffer (40 frames ~ 0.65s window)
            const history = bassHistoryRef.current;
            history.push(instantEnergy);
            if (history.length > 40) history.shift();

            // Calculate Moving Average Energy
            let energySum = 0;
            for (let i = 0; i < history.length; i++) {
              energySum += history[i];
            }
            const averageEnergy = energySum / history.length;

            // Dynamic Threshold: current energy must exceed average energy by at least 1.25x
            const dynamicThreshold = Math.max(30, averageEnergy * 1.25);
            const isRising = instantEnergy > prevInstantEnergyRef.current;
            const delta = instantEnergy - prevInstantEnergyRef.current;
            const timeSinceLastKick = now - lastKickTimeRef.current;

            // Trigger Kick Beat:
            // 1. InstantEnergy > 1.25 * AverageEnergy
            // 2. Rising slope (delta > 6)
            // 3. Debounce cooldown: 190ms (prevents multi-trigger on single kick)
            if (
              instantEnergy > dynamicThreshold &&
              isRising &&
              delta > 6 &&
              timeSinceLastKick > 190
            ) {
              beatDetected = true;
              lastKickTimeRef.current = now;
              kickStrength = Math.min(1.0, Math.max(0.35, (instantEnergy - dynamicThreshold) / 32 + 0.4));
              isHeavyKickRef.current = kickStrength > 0.72;
            }
          } else {
            // Audio silent or bridge/intro without drums -> clean decay
            if (bassHistoryRef.current.length > 0) {
              bassHistoryRef.current.shift();
            }
          }

          prevInstantEnergyRef.current = instantEnergy;
        } catch (e) {
          // Ignore transient read error
        }
      }

      // Apply Reactivity or Smooth Natural Spring Decay
      if (beatDetected) {
        barScaleRef.current = 1.0 + kickStrength * 0.038;
        barFlashIntensityRef.current = kickStrength;
        if (fireOverlayRef.current) {
          if (isHeavyKickRef.current) {
            fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.65))';
          } else {
            fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.20))';
          }
        }
      } else {
        // Natural exponential decay (fast, punchy, zero lingering jitter)
        barFlashIntensityRef.current *= 0.74;
        barScaleRef.current += (1.0 - barScaleRef.current) * 0.26;
      }

      if (barFlashIntensityRef.current < 0.01) barFlashIntensityRef.current = 0;
      if (Math.abs(barScaleRef.current - 1.0) < 0.001) barScaleRef.current = 1.0;

      if (barContainerRef.current) {
        const scaleVal = showLyrics || showQueue ? 1.0 : barScaleRef.current;
        barContainerRef.current.style.transform = `scale(${scaleVal.toFixed(4)})`;

        if (barFlashIntensityRef.current > 0.05) {
          const alpha = barFlashIntensityRef.current;
          const isHeavy = isHeavyKickRef.current;

          if (isHeavy) {
            barContainerRef.current.style.boxShadow = `0 16px 45px rgba(255, 255, 255, ${(alpha * 0.42).toFixed(2)}), inset 0 0 25px rgba(255, 255, 255, ${(alpha * 0.25).toFixed(2)})`;
            barContainerRef.current.style.borderColor = `rgba(255, 255, 255, ${(alpha * 0.85).toFixed(2)})`;
          } else {
            barContainerRef.current.style.boxShadow = `0 10px 30px rgba(255, 255, 255, ${(alpha * 0.22).toFixed(2)})`;
            barContainerRef.current.style.borderColor = `rgba(255, 255, 255, ${(alpha * 0.45).toFixed(2)})`;
          }
        } else {
          barContainerRef.current.style.boxShadow = '';
          barContainerRef.current.style.borderColor = '';
        }

        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.opacity = barFlashIntensityRef.current.toFixed(3);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(analyzeFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(analyzeFrame);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, showLyrics, showQueue, activeZone, kickAnalyserRef, analyserRef]);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    return parseLrc(currentTrack.lyrics);
  }, [currentTrack?.lyrics]);

  const activeLyricIdx = useMemo(() => {
    if (!parsedLyrics || parsedLyrics.length === 0) return -1;
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  // Hardware-accelerated smooth center scroll only triggered when active lyric index changes
  useEffect(() => {
    if (!showLyrics || activeLyricIdx < 0) return;
    const container = lyricsScrollRef.current;
    if (!container) return;

    const activeEl = container.querySelector('[data-active-lyric="true"]') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIdx, showLyrics]);

  // Volume hover & drag UX handlers
  const handleVolumeMouseEnter = useCallback(() => {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    setShowVolumeSlider(true);
  }, []);

  const handleVolumeMouseLeave = useCallback(() => {
    if (isDraggingVolumeRef.current) return;
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 550);
  }, []);

  const updateVolumeFromPosition = useCallback((clientY: number) => {
    if (!volumeSliderRef.current) return;
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const rawRatio = (rect.bottom - clientY) / rect.height;
    const clamped = Math.max(0, Math.min(1, rawRatio));
    setVolume(Math.round(clamped * 100) / 100);
  }, [setVolume]);

  const handleVolumeDragStart = useCallback((clientY: number) => {
    isDraggingVolumeRef.current = true;
    updateVolumeFromPosition(clientY);

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingVolumeRef.current) {
        updateVolumeFromPosition(e.clientY);
      }
    };

    const handleMouseUp = () => {
      isDraggingVolumeRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [updateVolumeFromPosition]);

  const handleVolumeTouchStart = useCallback((e: React.TouchEvent) => {
    isDraggingVolumeRef.current = true;
    if (e.touches[0]) {
      updateVolumeFromPosition(e.touches[0].clientY);
    }
  }, [updateVolumeFromPosition]);

  const handleVolumeTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDraggingVolumeRef.current && e.touches[0]) {
      updateVolumeFromPosition(e.touches[0].clientY);
    }
  }, [updateVolumeFromPosition]);

  const handleVolumeTouchEnd = useCallback(() => {
    isDraggingVolumeRef.current = false;
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (activeZone !== 'audio') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextTrack();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevTrack();
      } else if (key === 'l') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
        setShowQueue(false);
      } else if (key === 'q') {
        e.preventDefault();
        setShowQueue((prev) => !prev);
        setShowLyrics(false);
      } else if (key === 's') {
        e.preventDefault();
        toggleShuffle();
      } else if (key === 'r') {
        e.preventDefault();
        toggleRepeat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, nextTrack, prevTrack, toggleShuffle, toggleRepeat, activeZone]);

  // If in Video Zone, unmounted, no current track, or not authenticated -> hide playbar
  if (!mounted || !currentTrack || !isAuth || activeZone === 'video') return null;

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;
  const hasDrawerOpen = showLyrics || showQueue;

  return (
    <div
      ref={playerRootRef}
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center justify-end pointer-events-none px-3 sm:px-6 md:px-8 pb-3 sm:pb-5 transition-all duration-300"
    >
      {/* 1. SEAMLESS ATTACHED DRAWER: LYRICS & QUEUE (FLUSH MOUNTED DIRECTLY ON TOP OF PLAYBAR) */}
      {hasDrawerOpen && (
        <div className="w-full max-w-5xl h-[320px] sm:h-[380px] rounded-t-3xl border border-b-0 border-white/20 bg-zinc-950/98 shadow-[0_-20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-4 sm:p-5 flex flex-col relative overflow-hidden pointer-events-auto font-mono z-10 animate-fadeIn">
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              {showLyrics ? <Mic2 className="w-4 h-4 text-white" /> : <ListMusic className="w-4 h-4 text-white" />}
              <span className="text-xs uppercase font-extrabold tracking-widest text-white font-cyber">
                {showLyrics ? 'LỜI BÀI HÁT (GOTHIC LYRICS)' : 'DANH SÁCH PHÁT (QUEUE)'}
              </span>
            </div>
            <button
              onClick={() => {
                setShowLyrics(false);
                setShowQueue(false);
              }}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drawer Body - Zero Scrollbar on both X & Y */}
          <div className="flex-1 min-h-0 relative overflow-hidden select-none">
            {showLyrics && (
              <div
                ref={lyricsScrollRef}
                className="h-full overflow-y-auto overflow-x-hidden no-scrollbar text-center py-32 sm:py-36 space-y-4 will-change-transform"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {parsedLyrics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs uppercase tracking-widest">
                    Chưa có lời bài hát cho tác phẩm này
                  </div>
                ) : (
                  parsedLyrics.map((line, idx) => {
                    const isActive = idx === activeLyricIdx;
                    return (
                      <p
                        key={idx}
                        data-active-lyric={isActive ? 'true' : 'false'}
                        onClick={() => seekTo(line.time)}
                        className={`cursor-pointer transition-all duration-300 px-4 select-none ${
                          isActive
                            ? 'text-white font-black text-base sm:text-lg scale-105 drop-shadow-[0_0_15px_rgba(255,255,255,0.9)] opacity-100'
                            : 'text-slate-500 hover:text-slate-300 text-xs sm:text-sm font-medium opacity-60 hover:opacity-100'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })
                )}
              </div>
            )}

            {showQueue && (
              <div
                className="h-full overflow-y-auto overflow-x-hidden no-scrollbar py-2 space-y-1"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {playlist.map((track, idx) => {
                  const isCurrent = track.id === currentTrack.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, currentAlbum, playlist)}
                      className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                        isCurrent
                          ? 'bg-white/15 border-white text-white shadow-lg'
                          : 'bg-white/5 border-transparent hover:bg-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[10px] text-slate-500 font-bold">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="text-xs font-cyber truncate">{track.title}</span>
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {formatTime(track.duration)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. PURE AUDIO SINGLE-ROW PLAYBAR CONTAINER (FLUSH SEAMLESSLY ATTACHED) */}
      <div
        ref={barContainerRef}
        className={`relative w-full max-w-5xl bg-zinc-950/98 border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl px-3.5 sm:px-5 py-2 sm:py-2.5 pointer-events-auto will-change-transform transition-all font-mono select-none z-10 ${
          hasDrawerOpen ? 'rounded-b-3xl rounded-t-none border-t-0 -mt-[1px]' : 'rounded-3xl'
        }`}
      >
        {/* Monochromatic Flash Overlay */}
        <div
          ref={fireOverlayRef}
          className={`absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-75 ${
            hasDrawerOpen ? 'rounded-b-3xl rounded-t-none' : 'rounded-3xl'
          }`}
        />

        {/* STRICT SINGLE-ROW HORIZONTAL LAYOUT */}
        <div className="flex items-center justify-between gap-2.5 sm:gap-4 w-full">
          
          {/* Left: Track Information & Album Cover */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-[140px] xs:max-w-[170px] sm:max-w-[210px] flex-shrink-0">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0 shadow-lg">
              {currentAlbum?.cover_url ? (
                <img
                  src={currentAlbum.cover_url}
                  alt={currentAlbum.title || 'Cover'}
                  className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : ''} transition-transform duration-500`}
                />
              ) : (
                <Disc3 className="w-full h-full p-2 text-white/50 animate-spin-slow" />
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs font-cyber font-extrabold text-white truncate uppercase tracking-wide">
                {currentTrack.title}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono font-bold truncate uppercase mt-0.5">
                {currentTrack.artist || currentAlbum?.artist || 'VAULT ARTIST'}
              </span>
            </div>
          </div>

          {/* Center: Controls + Inline Elongated Timeline (All on the same line) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            
            {/* Playback Controls Cluster */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Shuffle Button */}
              <button
                onClick={toggleShuffle}
                title={shuffleMode ? 'Tắt trộn bài' : 'Bật trộn bài'}
                className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                  shuffleMode
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>

              {/* Previous Track */}
              <button
                onClick={prevTrack}
                title="Bài trước"
                className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
              >
                <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              </button>

              {/* Play / Pause Master Button */}
              <button
                onClick={togglePlay}
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" />
                ) : (
                  <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current ml-0.5" />
                )}
              </button>

              {/* Next Track */}
              <button
                onClick={nextTrack}
                title="Bài kế tiếp"
                className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
              >
                <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              </button>

              {/* Repeat Button */}
              <button
                onClick={toggleRepeat}
                title={`Lặp: ${repeatMode}`}
                className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                  repeatMode !== 'off'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                )}
              </button>
            </div>

            {/* Direct DOM Elapsed Time */}
            <span
              ref={currentTimeTextRef}
              className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 tabular-nums flex-shrink-0"
            >
              {formatTime(currentTime)}
            </span>

            {/* Direct DOM Scrubber Timeline Range Input */}
            <div className="relative flex-1 flex items-center min-w-[60px] group/seek">
              <input
                ref={seekerInputRef}
                type="range"
                min={0}
                max={effectiveDuration || 100}
                defaultValue={currentTime}
                onMouseDown={() => {
                  isDraggingSeekerRef.current = true;
                }}
                onTouchStart={() => {
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
                onTouchEnd={(e) => {
                  isDraggingSeekerRef.current = false;
                  seekTo(parseFloat((e.target as HTMLInputElement).value));
                }}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer border border-white/15 bg-zinc-900 group-hover/seek:bg-zinc-800 transition-all shadow-inner"
              />
            </div>

            {/* Inline Total Duration */}
            <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 tabular-nums flex-shrink-0">
              {formatTime(effectiveDuration)}
            </span>

          </div>

          {/* Right: Drawer Triggers & Volume Slider */}
          <div className="flex items-center gap-1 sm:gap-1.5 justify-end flex-shrink-0">
            {/* Lyrics Drawer Toggle */}
            <button
              onClick={() => {
                setShowLyrics((prev) => !prev);
                setShowQueue(false);
              }}
              title="Lời bài hát (L)"
              className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                showLyrics
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/15'
              }`}
            >
              <Mic2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Queue Drawer Toggle */}
            <button
              onClick={() => {
                setShowQueue((prev) => !prev);
                setShowLyrics(false);
              }}
              title="Danh sách phát (Q)"
              className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                showQueue
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/15'
              }`}
            >
              <ListMusic className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Volume Control with iOS Control Center Vertical Capsule Slider */}
            <div
              className="relative"
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
            >
              <button
                onClick={() => {
                  setShowVolumeSlider((prev) => !prev);
                }}
                onDoubleClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                title={`Âm lượng: ${Math.round(volume * 100)}% (Click để chỉnh, Nhấp đúp để tắt tiếng)`}
                className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                  showVolumeSlider
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                {volume >= 0.5 ? (
                  <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : volume > 0 ? (
                  <Volume1 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400" />
                )}
              </button>

              {/* iOS Control Center Vertical Pill Capsule Popover */}
              {showVolumeSlider && (
                <div
                  className="absolute bottom-12 right-0 p-2.5 rounded-3xl bg-zinc-950/98 border border-white/25 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl flex flex-col items-center gap-2 animate-fadeIn z-50 select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Percentage Tooltip Badge */}
                  <span className="text-[10px] text-white font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/15 tabular-nums shadow-sm">
                    {Math.round(volume * 100)}%
                  </span>

                  {/* iOS Vertical Capsule Track */}
                  <div
                    ref={volumeSliderRef}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleVolumeDragStart(e.clientY);
                    }}
                    onTouchStart={handleVolumeTouchStart}
                    onTouchMove={handleVolumeTouchMove}
                    onTouchEnd={handleVolumeTouchEnd}
                    className="relative w-11 h-36 rounded-full bg-zinc-900 border border-white/20 overflow-hidden cursor-pointer shadow-inner flex flex-col justify-end group/slider"
                  >
                    {/* Fill Level (from bottom up) */}
                    <div
                      style={{ height: `${Math.round(volume * 100)}%` }}
                      className="w-full bg-white transition-[height] duration-75 ease-out rounded-b-full pointer-events-none"
                    />

                    {/* Integrated Dynamic Speaker Icon at bottom */}
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
  );
}
