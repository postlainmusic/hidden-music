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
  Loader2,
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
    isBuffering,
    currentTime,
    duration,
    volume,
    shuffleMode,
    repeatMode,
    activeZone,
    audioRef,
    currentTimeRef,
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
  const timelineRafIdRef = useRef<number | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeSliderRef = useRef<HTMLDivElement | null>(null);
  const isDraggingVolumeRef = useRef<boolean>(false);

  // Direct DOM refs for 60FPS timeline updates without React re-renders
  const currentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const seekerInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);

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
      const containerHeight = container.clientHeight;
      const elOffsetTop = activeEl.offsetTop;
      const elHeight = activeEl.clientHeight;
      const targetScroll = elOffsetTop - containerHeight / 2 + elHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeLyricIdx, showLyrics]);

  // Keyboard shortcut listener (Space: Play/Pause, L: Lyrics, Q: Queue, Left/Right: Seek 5s)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
        setShowQueue(false);
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        setShowQueue((prev) => !prev);
        setShowLyrics(false);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.min(duration, cur + 5));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.max(0, cur - 5));
      } else if (e.code === 'Escape') {
        setShowLyrics(false);
        setShowQueue(false);
        setShowVolumeSlider(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekTo, currentTime, duration, currentTimeRef]);

  // iOS Vertical Capsule Volume Slider Drag Logic
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

  const handleVolumeTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDraggingVolumeRef.current = true;
      if (e.touches[0]) calculateVolumeFromClientY(e.touches[0].clientY);
    },
    [calculateVolumeFromClientY]
  );

  const handleVolumeTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingVolumeRef.current || !e.touches[0]) return;
      calculateVolumeFromClientY(e.touches[0].clientY);
    },
    [calculateVolumeFromClientY]
  );

  const handleVolumeTouchEnd = useCallback(() => {
    isDraggingVolumeRef.current = false;
  }, []);

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

  // Only render if mounted, authenticated, and in Audio Zone with an active track
  if (!mounted || !isAuth || activeZone !== 'audio' || !currentTrack) {
    return null;
  }

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
                        className={`transition-all duration-300 cursor-pointer font-serif tracking-wide select-none ${
                          isActive
                            ? 'text-white text-base sm:text-lg md:text-xl font-bold drop-shadow-[0_0_15px_rgba(255,255,255,0.9)] scale-105 opacity-100 py-1'
                            : 'text-slate-500 hover:text-slate-300 text-xs sm:text-sm opacity-50 hover:opacity-80'
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
                className="h-full overflow-y-auto overflow-x-hidden no-scrollbar space-y-1.5 py-2 pr-1"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {playlist.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs uppercase tracking-widest">
                    Hàng chờ phát đang trống
                  </div>
                ) : (
                  playlist.map((track, idx) => {
                    const isCur = track.id === currentTrack.id;
                    return (
                      <div
                        key={track.id || idx}
                        onClick={() => playTrack(track, currentAlbum, playlist)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isCur
                            ? 'bg-white/15 border-white text-white font-bold shadow-md'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-mono text-slate-400 w-5 text-center flex-shrink-0">
                            {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs truncate uppercase">{track.title}</span>
                            <span className="text-[10px] text-slate-400 truncate">
                              {track.artist || currentAlbum?.artist || 'VAULT ARTIST'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 ml-2">
                          {formatTime(track.duration || 0)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DOCK PLAYBAR (ELEGANT MONOCHROMATIC MONOLITH DOCK) */}
      <div
        className={`w-full max-w-5xl rounded-3xl border border-white/20 bg-zinc-950/98 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl p-2.5 sm:p-3 pointer-events-auto relative overflow-visible transition-all duration-200 ${
          hasDrawerOpen ? '-mt-[1px] rounded-t-none border-t-0' : ''
        }`}
      >
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
                <Disc3
                  className="w-full h-full p-2 text-white/50 animate-spin"
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused', animationDuration: '4s' }}
                />
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

              {/* Play / Pause Master Button with Loading Indicator */}
              <button
                onClick={togglePlay}
                title={isBuffering ? 'Đang tải âm thanh...' : isPlaying ? 'Tạm dừng' : 'Phát'}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95 flex-shrink-0"
              >
                {isBuffering ? (
                  <Loader2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-spin" />
                ) : isPlaying ? (
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
