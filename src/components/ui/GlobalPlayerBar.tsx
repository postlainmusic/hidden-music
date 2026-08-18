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
    snareAnalyserRef,
    kickTimestampsRef,
    snareTimestampsRef,
    isPCMReadyRef,
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

  // Direct DOM refs for 60FPS timeline updates without React re-renders
  const currentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const seekerInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);

  const lastKickTimeRef = useRef<number>(0);
  const lastSnareTimeRef = useRef<number>(0);
  const lastFiredKickIndexRef = useRef<number>(-1);
  const lastFiredSnareIndexRef = useRef<number>(-1);
  const prevKickPunchRef = useRef<number>(0);
  const smoothedKickPunchRef = useRef<number>(0);
  const prevSnarePunchRef = useRef<number>(0);
  const smoothedSnarePunchRef = useRef<number>(0);
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

  // Reset fired indices on track change
  useEffect(() => {
    lastFiredKickIndexRef.current = -1;
    lastFiredSnareIndexRef.current = -1;
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
    if (!isPlaying || activeZone !== 'video') {
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

  // Real-Time Playbar Monochromatic Beat Engine
  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (fireOverlayRef.current) fireOverlayRef.current.style.opacity = '0';
      if (barContainerRef.current) {
        barContainerRef.current.style.transform = 'scale(1)';
        barContainerRef.current.style.boxShadow = '';
        barContainerRef.current.style.borderColor = '';
      }
      return;
    }

    const analyzeFrame = () => {
      let isHeavyKick = false;
      let isLightKick = false;
      let isSnare = false;
      const now = performance.now();
      const liveCurrentTime = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : currentTime);

      const isPCMReady = isPCMReadyRef?.current ?? false;
      const kickStamps = kickTimestampsRef?.current || [];
      const snareStamps = snareTimestampsRef?.current || [];

      if (isPCMReady) {
        if (kickStamps.length > 0) {
          for (let i = 0; i < kickStamps.length; i++) {
            const diff = liveCurrentTime - kickStamps[i];
            if (diff >= -0.022 && diff <= 0.035 && i !== lastFiredKickIndexRef.current) {
              lastFiredKickIndexRef.current = i;
              isHeavyKick = true;
              lastKickTimeRef.current = now;
              break;
            }
          }
        }

        if (!isHeavyKick && snareStamps.length > 0) {
          for (let i = 0; i < snareStamps.length; i++) {
            const diff = liveCurrentTime - snareStamps[i];
            if (diff >= -0.022 && diff <= 0.035 && i !== lastFiredSnareIndexRef.current) {
              lastFiredSnareIndexRef.current = i;
              isSnare = true;
              lastSnareTimeRef.current = now;
              break;
            }
          }
        }
      } else {
        let masterMidEnergy = 0;
        if (analyserRef?.current) {
          try {
            const masterArr = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(masterArr);
            masterMidEnergy = (masterArr[2] + masterArr[3] + masterArr[4] + masterArr[5] + masterArr[6]) / 5;
          } catch {}
        }

        if (kickAnalyserRef?.current) {
          try {
            const arr = new Uint8Array(kickAnalyserRef.current.frequencyBinCount);
            kickAnalyserRef.current.getByteFrequencyData(arr);
            const kickSub = (arr[0] + arr[1]) / 2;

            const deltaKick = Math.max(0, kickSub - prevKickPunchRef.current);
            prevKickPunchRef.current = kickSub;
            smoothedKickPunchRef.current = smoothedKickPunchRef.current * 0.8 + deltaKick * 0.2;
            const kickThreshold = Math.max(16.0, smoothedKickPunchRef.current * 1.5);

            if (
              deltaKick > kickThreshold &&
              kickSub >= 80 &&
              kickSub >= masterMidEnergy * 0.85 &&
              now - lastKickTimeRef.current > 160
            ) {
              if (kickSub > 120 || deltaKick > 28) {
                isHeavyKick = true;
              } else {
                isLightKick = true;
              }
              lastKickTimeRef.current = now;
            }
          } catch {}
        }

        if (!isHeavyKick && !isLightKick && snareAnalyserRef?.current) {
          try {
            const arr = new Uint8Array(snareAnalyserRef.current.frequencyBinCount);
            snareAnalyserRef.current.getByteFrequencyData(arr);
            const snareHigh = (arr[1] + arr[2] + arr[3]) / 3;

            const deltaSnare = Math.max(0, snareHigh - prevSnarePunchRef.current);
            prevSnarePunchRef.current = snareHigh;
            smoothedSnarePunchRef.current = smoothedSnarePunchRef.current * 0.8 + deltaSnare * 0.2;
            const snareThreshold = Math.max(18.0, smoothedSnarePunchRef.current * 1.6);

            if (
              deltaSnare > snareThreshold &&
              snareHigh >= 85 &&
              now - lastSnareTimeRef.current > 170 &&
              now - lastKickTimeRef.current > 120
            ) {
              isSnare = true;
              lastSnareTimeRef.current = now;
            }
          } catch {}
        }
      }

      if (isHeavyKick) {
        isHeavyKickRef.current = true;
        barScaleRef.current = 1.035;
        barFlashIntensityRef.current = 1.0;
        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.70))';
        }
      } else if (isLightKick) {
        isHeavyKickRef.current = false;
        barScaleRef.current = 1.018;
        barFlashIntensityRef.current = 0.55;
        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))';
        }
      } else if (isSnare) {
        isHeavyKickRef.current = false;
        barFlashIntensityRef.current = 0.45;
        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.15))';
        }
      } else {
        barFlashIntensityRef.current *= 0.65;
        barScaleRef.current = barScaleRef.current + (1.0 - barScaleRef.current) * 0.35;
      }

      if (barFlashIntensityRef.current < 0.01) barFlashIntensityRef.current = 0;
      if (Math.abs(barScaleRef.current - 1.0) < 0.001) barScaleRef.current = 1.0;

      if (barContainerRef.current) {
        const scaleVal = showLyrics || showQueue ? 1.0 : barScaleRef.current;
        barContainerRef.current.style.transform = `scale(${scaleVal.toFixed(4)})`;

        if (barFlashIntensityRef.current > 0.06) {
          const alpha = barFlashIntensityRef.current;
          const isHeavy = isHeavyKickRef.current;

          if (isHeavy) {
            barContainerRef.current.style.boxShadow = `0 16px 45px rgba(255, 255, 255, ${(alpha * 0.4).toFixed(2)}), inset 0 0 25px rgba(255, 255, 255, ${(alpha * 0.25).toFixed(2)})`;
            barContainerRef.current.style.borderColor = `rgba(255, 255, 255, ${(alpha * 0.8).toFixed(2)})`;
          } else {
            barContainerRef.current.style.boxShadow = `0 10px 30px rgba(255, 255, 255, ${(alpha * 0.2).toFixed(2)})`;
            barContainerRef.current.style.borderColor = `rgba(255, 255, 255, ${(alpha * 0.4).toFixed(2)})`;
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
  }, [isPlaying, showLyrics, showQueue, activeZone, analyserRef, kickAnalyserRef, snareAnalyserRef, kickTimestampsRef, snareTimestampsRef, isPCMReadyRef, currentTime, audioRef, currentTimeRef]);

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

  // Volume hover UX handlers
  const handleVolumeMouseEnter = useCallback(() => {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    setShowVolumeSlider(true);
  }, []);

  const handleVolumeMouseLeave = useCallback(() => {
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 450);
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
      {/* 1. ATTACHED DRAWER: LYRICS & QUEUE (FLUSH ATTACHED TO TOP OF PLAYBAR) */}
      {hasDrawerOpen && (
        <div className="w-full max-w-5xl h-[320px] sm:h-[380px] rounded-t-3xl border border-b-0 border-white/20 bg-zinc-950/95 shadow-[0_-15px_40px_rgba(0,0,0,0.9)] backdrop-blur-2xl p-4 sm:p-5 flex flex-col relative overflow-hidden pointer-events-auto animate-fadeIn font-mono">
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

      {/* 2. PURE AUDIO SINGLE-ROW PLAYBAR CONTAINER */}
      <div
        ref={barContainerRef}
        className={`relative w-full max-w-5xl bg-zinc-950/95 border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl px-3.5 sm:px-5 py-2 sm:py-2.5 pointer-events-auto will-change-transform transition-all font-mono select-none ${
          hasDrawerOpen ? 'rounded-b-3xl rounded-t-none border-t-white/10' : 'rounded-3xl'
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

            {/* Volume Control with Popover */}
            <div
              className="relative"
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
            >
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                title={volume > 0 ? 'Tắt tiếng' : 'Bật tiếng'}
                className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition-all"
              >
                {volume > 0 ? <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              </button>

              {/* Volume Slider Popover */}
              {showVolumeSlider && (
                <div className="absolute bottom-10 right-0 p-2.5 rounded-2xl bg-zinc-950 border border-white/20 shadow-2xl flex flex-col items-center gap-1.5 animate-fadeIn z-50">
                  <span className="text-[9px] text-slate-400 font-mono">{Math.round(volume * 100)}%</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 h-1.5 rounded-full appearance-none cursor-pointer border border-white/20 bg-zinc-800"
                  />
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
