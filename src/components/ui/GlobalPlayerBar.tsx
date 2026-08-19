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
  X,
  ChevronDown,
  Loader2,
  Sparkles,
  ShieldCheck,
  Plus,
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
    isPremium,
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

  // Mobile Expanded Player Modal State
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [expandedTab, setExpandedTab] = useState<'player' | 'lyrics' | 'queue'>('player');

  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const expandedLyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const playerRootRef = useRef<HTMLDivElement | null>(null);
  const timelineRafIdRef = useRef<number | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeSliderRef = useRef<HTMLDivElement | null>(null);
  const isDraggingVolumeRef = useRef<boolean>(false);

  // Direct DOM refs for 60FPS timeline updates without React re-renders
  const currentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const seekerInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSeekerInputRef = useRef<HTMLInputElement | null>(null);
  const mobileProgressBarRef = useRef<HTMLDivElement | null>(null);
  const expandedCurrentTimeRef = useRef<HTMLSpanElement | null>(null);
  const expandedSeekerInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);

  // Touch Drag to Dismiss State
  const touchStartYRef = useRef<number>(0);
  const touchCurrentYRef = useRef<number>(0);

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

  // Standard Web MediaSession Integration
  useEffect(() => {
    if (typeof window === 'undefined' || !currentTrack) return;

    const coverUrl = currentAlbum?.cover_url || '';
    const trackTitle = currentTrack.title || 'Unknown Track';
    const trackArtist = currentTrack.artist || currentAlbum?.artist || 'POSTLAIN';
    const albumTitle = currentAlbum?.title || 'Hidden Music Vault';

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackTitle,
        artist: trackArtist,
        album: albumTitle,
        artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/png' }] : [],
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [currentTrack, currentAlbum, isPlaying]);

  // Click outside to close volume slider
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (playerRootRef.current && !playerRootRef.current.contains(e.target as Node)) {
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

  // High-Performance 60FPS Direct DOM Timeline Updater (AUDIO ZONE ONLY)
  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (timelineRafIdRef.current) cancelAnimationFrame(timelineRafIdRef.current);
      return;
    }

    const effectiveDur = duration > 0 && isFinite(duration) ? duration : (currentTrack?.duration || 1);

    const updateDirectTimeline = () => {
      if (!isDraggingSeekerRef.current) {
        const liveSec = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : 0);
        if (seekerInputRef.current) {
          seekerInputRef.current.value = String(liveSec);
        }
        if (expandedSeekerInputRef.current) {
          expandedSeekerInputRef.current.value = String(liveSec);
        }
        if (mobileSeekerInputRef.current) {
          mobileSeekerInputRef.current.value = String(liveSec);
        }
        if (mobileProgressBarRef.current && effectiveDur > 0) {
          const pct = Math.min(100, Math.max(0, (liveSec / effectiveDur) * 100));
          mobileProgressBarRef.current.style.width = `${pct}%`;
        }
        if (currentTimeTextRef.current) {
          currentTimeTextRef.current.textContent = formatTime(liveSec);
        }
        if (expandedCurrentTimeRef.current) {
          expandedCurrentTimeRef.current.textContent = formatTime(liveSec);
        }
      }
      timelineRafIdRef.current = requestAnimationFrame(updateDirectTimeline);
    };

    timelineRafIdRef.current = requestAnimationFrame(updateDirectTimeline);

    return () => {
      if (timelineRafIdRef.current) cancelAnimationFrame(timelineRafIdRef.current);
    };
  }, [isPlaying, activeZone, currentTimeRef, audioRef, duration, currentTrack?.duration]);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    return parseLrc(currentTrack.lyrics);
  }, [currentTrack?.lyrics]);

  const activeLyricIdx = useMemo(() => {
    if (!parsedLyrics || parsedLyrics.length === 0) return -1;
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  // Smooth scroll lyrics
  useEffect(() => {
    if ((!showLyrics && expandedTab !== 'lyrics') || activeLyricIdx < 0) return;

    const container = showLyrics ? lyricsScrollRef.current : expandedLyricsScrollRef.current;
    if (!container) return;

    const activeEl = container.querySelector('[data-active-lyric="true"]') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }, [activeLyricIdx, showLyrics, expandedTab]);

  // Keyboard shortcuts (Audio Zone only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (activeZone === 'video') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setShowQueue((prev) => !prev);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.max(0, cur - 5));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.min(duration || 999, cur + 5));
      } else if (e.key === 'Escape') {
        if (showLyrics) setShowLyrics(false);
        if (showQueue) setShowQueue(false);
        if (isMobileExpanded) setIsMobileExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeZone, togglePlay, seekTo, currentTime, duration, currentTimeRef, showLyrics, showQueue, isMobileExpanded]);

  // Handle Swipe Down to dismiss Expanded Player
  const handleTouchStartSheet = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchCurrentYRef.current = e.touches[0].clientY;
  };

  const handleTouchMoveSheet = (e: React.TouchEvent) => {
    touchCurrentYRef.current = e.touches[0].clientY;
  };

  const handleTouchEndSheet = () => {
    const deltaY = touchCurrentYRef.current - touchStartYRef.current;
    if (deltaY > 100) {
      setIsMobileExpanded(false);
    }
  };

  // iOS Vertical Capsule Volume Slider
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

  // =========================================================================
  // AUTO-HIDE IN VIDEO ZONE (0% Footprint when watching MV)
  // =========================================================================
  if (activeZone === 'video') {
    return null;
  }

  if (!mounted || !isAuth || !currentTrack) {
    return null;
  }

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. FULLSCREEN IMMERSIVE LYRICS OVERLAY (DESKTOP & TABLET)                 */}
      {/* ========================================================================= */}
      {showLyrics && (
        <div className="fixed inset-0 z-50 bg-black/92 backdrop-blur-3xl text-white flex flex-col justify-between p-6 sm:p-10 md:p-14 animate-fadeIn select-none">
          {/* Top Header & Close Button */}
          <div className="flex items-center justify-between w-full flex-shrink-0 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <Mic2 className="w-5 h-5 text-white animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-cyber font-black text-white">
                LỜI BÀI HÁT // GOTHIC LYRICS STREAM
              </span>
            </div>
            <button
              onClick={() => setShowLyrics(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-all"
              title="Đóng lời bài hát (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Content Area: Split View (Left: Artwork/Meta, Right: Lyrics Stream) */}
          <div className="flex-1 min-h-0 my-6 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-16 overflow-hidden">
            {/* Left Column: Artwork & Track Bio */}
            <div className="hidden md:flex flex-col items-center md:items-start text-left w-72 lg:w-96 flex-shrink-0">
              <div className="relative w-64 h-64 lg:w-80 lg:h-80 rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.95)] border border-white/20 bg-zinc-950 flex items-center justify-center mb-6">
                {currentAlbum?.cover_url ? (
                  <img
                    src={currentAlbum.cover_url}
                    alt={currentAlbum.title || 'Cover'}
                    className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                  />
                ) : (
                  <Disc3 className="w-24 h-24 text-white/40 animate-spin" />
                )}
              </div>
              <h2 className="text-xl lg:text-2xl font-cyber font-black text-white truncate max-w-full uppercase">
                {currentTrack.title}
              </h2>
              <p className="text-sm font-mono text-zinc-400 truncate max-w-full uppercase mt-1">
                {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
              </p>
              <p className="text-xs font-mono text-zinc-500 truncate max-w-full uppercase mt-0.5">
                {currentAlbum?.title || 'HIDDEN DISC'}
              </p>
            </div>

            {/* Right Column: Synced Lyrics Stream */}
            <div
              ref={lyricsScrollRef}
              className="flex-1 w-full h-full overflow-y-auto no-scrollbar text-center md:text-left py-28 md:py-36 space-y-6 md:space-y-8 font-sans px-4"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {parsedLyrics.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm uppercase tracking-widest font-mono">
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
                      className={`transition-all duration-300 cursor-pointer select-none leading-relaxed ${
                        isActive
                          ? 'text-white text-2xl sm:text-3xl md:text-4xl font-extrabold drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] scale-[1.02] opacity-100'
                          : 'text-zinc-500 hover:text-zinc-300 text-base sm:text-lg md:text-xl font-medium opacity-40 hover:opacity-75'
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Hint */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 border-t border-white/10 pt-3">
            <span>NHẤP VÀO DÒNG LỜI ĐỂ TUA ĐẾN ĐOẠN ĐÓ</span>
            <span className="hidden sm:inline">NHẤN ESC ĐỂ ĐÓNG</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RIGHT-SIDE SLIDE-IN QUEUE DRAWER (DESKTOP & MOBILE)                    */}
      {/* ========================================================================= */}
      {showQueue && (
        <>
          {/* Backdrop for click away */}
          <div
            onClick={() => setShowQueue(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fadeIn"
          />
          <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#0c0d12]/98 backdrop-blur-3xl border-l border-white/15 z-50 p-5 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col justify-between font-mono animate-slideInRight select-none">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-white" />
                <span className="text-xs uppercase font-extrabold tracking-widest text-white font-cyber">
                  HÀNG CHỜ PHÁT ({playlist.length} BÀI)
                </span>
              </div>
              <button
                onClick={() => setShowQueue(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white text-zinc-300 hover:text-black transition-all"
                title="Đóng (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Track list */}
            <div className="flex-1 min-h-0 my-3 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {playlist.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs uppercase tracking-widest">
                  Hàng chờ phát đang trống
                </div>
              ) : (
                playlist.map((track, idx) => {
                  const isCur = track.id === currentTrack.id;
                  return (
                    <div
                      key={track.id || idx}
                      onClick={() => playTrack(track, currentAlbum, playlist)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isCur
                          ? 'bg-white/15 border-white text-white font-bold shadow-lg'
                          : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-zinc-400 w-5 text-center flex-shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs truncate font-bold">{track.title}</p>
                          <p className="text-[10px] text-zinc-400 truncate">{track.artist || currentAlbum?.artist}</p>
                        </div>
                      </div>
                      {isCur && <Disc3 className="w-4 h-4 text-white animate-spin flex-shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>

            {/* Queue Footer */}
            <div className="pt-3 border-t border-white/10 text-[11px] text-zinc-500 flex items-center justify-between">
              <span>ĐANG PHÁT TỪ VAULT</span>
              <span className="text-white font-bold">{formatTime(effectiveDuration)}</span>
            </div>
          </aside>
        </>
      )}

      {/* ========================================================================= */}
      {/* 3. MOBILE FULLSCREEN EXPANDED SHEET                                      */}
      {/* ========================================================================= */}
      <div
        onTouchStart={handleTouchStartSheet}
        onTouchMove={handleTouchMoveSheet}
        onTouchEnd={handleTouchEndSheet}
        className={`fixed inset-0 z-50 md:hidden bg-[#07070a]/98 backdrop-blur-3xl text-white flex flex-col justify-between p-6 transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] select-none will-change-transform ${
          isMobileExpanded ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none'
        }`}
        style={{
          paddingTop: 'max(24px, env(safe-area-inset-top))',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Dynamic Background Glow */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden opacity-30">
          <div
            className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] blur-[120px]"
            style={{
              backgroundImage: currentAlbum?.cover_url
                ? `radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(59,130,246,0.15) 50%, transparent 80%)`
                : 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Top Dismiss Bar */}
        <div className="flex items-center justify-between w-full flex-shrink-0">
          <button
            onClick={() => setIsMobileExpanded(false)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white hover:text-black transition-all"
            title="Thu nhỏ"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">ĐANG PHÁT TỪ VAULT</span>
          <div className="w-9 h-9" />
        </div>

        {/* Center Main Viewport */}
        <div className="flex-1 min-h-0 my-4 flex flex-col items-center justify-center relative overflow-hidden">
          {expandedTab === 'player' && (
            <div className="w-full flex flex-col items-center justify-center animate-fadeIn">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-white/20 bg-zinc-950 flex items-center justify-center">
                {currentAlbum?.cover_url ? (
                  <img
                    src={currentAlbum.cover_url}
                    alt={currentAlbum.title || 'Cover'}
                    className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                  />
                ) : (
                  <Disc3
                    className="w-24 h-24 text-white/50 animate-spin"
                    style={{ animationPlayState: isPlaying ? 'running' : 'paused', animationDuration: '4s' }}
                  />
                )}
              </div>
            </div>
          )}

          {expandedTab === 'lyrics' && (
            <div
              ref={expandedLyricsScrollRef}
              className="w-full h-full overflow-y-auto text-center py-20 px-4 font-sans space-y-4 no-scrollbar animate-fadeIn"
            >
              {parsedLyrics.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm uppercase tracking-widest font-mono">
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
                      className={`transition-all duration-300 cursor-pointer font-sans leading-relaxed ${
                        isActive
                          ? 'text-white text-lg sm:text-xl font-bold drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] scale-105'
                          : 'text-zinc-500 text-sm font-medium opacity-50'
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })
              )}
            </div>
          )}

          {expandedTab === 'queue' && (
            <div className="w-full h-full overflow-y-auto space-y-2 p-2 font-mono no-scrollbar animate-fadeIn">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 px-2">
                HÀNG CHỜ PHÁT ({playlist.length} BÀI)
              </h4>
              {playlist.map((track, idx) => {
                const isCur = track.id === currentTrack.id;
                return (
                  <div
                    key={track.id || idx}
                    onClick={() => playTrack(track, currentAlbum, playlist)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isCur
                        ? 'bg-white/20 border-white text-white font-bold'
                        : 'bg-white/5 border-white/10 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-zinc-400 w-5 text-center">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs truncate font-bold">{track.title}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{track.artist || currentAlbum?.artist}</p>
                      </div>
                    </div>
                    {isCur && <Disc3 className="w-4 h-4 text-white animate-spin flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="flex flex-col gap-4 w-full flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-cyber font-black text-white truncate uppercase">
                {currentTrack.title}
              </h3>
              <p className="text-xs font-mono text-zinc-400 truncate uppercase mt-0.5">
                {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedTab(expandedTab === 'lyrics' ? 'player' : 'lyrics')}
                className={`p-2 rounded-full border transition-all ${
                  expandedTab === 'lyrics' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/15 text-zinc-300'
                }`}
                title="Lyrics"
              >
                <Mic2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpandedTab(expandedTab === 'queue' ? 'player' : 'queue')}
                className={`p-2 rounded-full border transition-all ${
                  expandedTab === 'queue' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/15 text-zinc-300'
                }`}
                title="Queue"
              >
                <ListMusic className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Seeker */}
          <div className="flex flex-col gap-1.5 w-full">
            <div className="relative w-full h-3 flex items-center">
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  ref={mobileProgressBarRef}
                  style={{ width: `${(currentTime / effectiveDuration) * 100}%` }}
                  className="h-full bg-white transition-[width] duration-75"
                />
              </div>
              <input
                ref={expandedSeekerInputRef}
                type="range"
                min={0}
                max={effectiveDuration || 100}
                defaultValue={currentTime}
                onMouseDown={() => (isDraggingSeekerRef.current = true)}
                onTouchStart={() => (isDraggingSeekerRef.current = true)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (expandedCurrentTimeRef.current) {
                    expandedCurrentTimeRef.current.textContent = formatTime(val);
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
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span ref={expandedCurrentTimeRef}>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {/* Main Controls Row */}
          <div className="flex items-center justify-between px-2 pt-1">
            <button
              onClick={toggleShuffle}
              className={`p-2.5 rounded-full border transition-all ${
                shuffleMode ? 'bg-white text-black border-white shadow-md' : 'bg-white/5 text-zinc-400 border-white/10'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={prevTrack}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-95"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-transform active:scale-95"
            >
              {isBuffering ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-95"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-2.5 rounded-full border transition-all ${
                repeatMode !== 'off' ? 'bg-white text-black border-white shadow-md' : 'bg-white/5 text-zinc-400 border-white/10'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ELEVATED FLOATING DOCK PLAYBAR (ABOVE FOOTER)                          */}
      {/* ========================================================================= */}
      <div
        ref={playerRootRef}
        className={`fixed bottom-8 sm:bottom-10 left-0 right-0 z-40 flex flex-col items-center justify-end pointer-events-none px-3 sm:px-6 md:px-8 transition-all duration-300 ${
          isMobileExpanded ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="w-full max-w-5xl rounded-2xl md:rounded-3xl border border-white/20 bg-zinc-950/95 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-2 sm:p-2.5 md:p-3 flex flex-col gap-1 pointer-events-auto relative overflow-hidden transition-all duration-300">
          {/* Mobile Top Thin Progress Line */}
          <div className="md:hidden relative w-full h-1 bg-white/10 rounded-full overflow-hidden -mt-1 mb-1">
            <div
              ref={mobileProgressBarRef}
              style={{ width: `${(currentTime / effectiveDuration) * 100}%` }}
              className="h-full bg-white transition-[width] duration-75"
            />
            <input
              ref={mobileSeekerInputRef}
              type="range"
              min={0}
              max={effectiveDuration || 100}
              defaultValue={currentTime}
              onMouseDown={() => (isDraggingSeekerRef.current = true)}
              onTouchStart={() => (isDraggingSeekerRef.current = true)}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (mobileProgressBarRef.current && effectiveDuration > 0) {
                  mobileProgressBarRef.current.style.width = `${(val / effectiveDuration) * 100}%`;
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
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>

          {/* SINGLE-ROW RESPONSIVE FLEXBOX */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
            {/* Left: Track Information & Cover */}
            <div
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setIsMobileExpanded(true);
                  setExpandedTab('player');
                }
              }}
              className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-[140px] xs:max-w-[180px] sm:max-w-[220px] flex-shrink-0 cursor-pointer md:cursor-default group/trackinfo"
            >
              <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0 shadow-lg">
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
                <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono font-bold truncate uppercase mt-0.5">
                  {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                </span>
              </div>
            </div>

            {/* Center: Controls + Inline Timeline */}
            <div className="flex items-center justify-center md:justify-start gap-1.5 sm:gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <button
                  onClick={toggleShuffle}
                  title={shuffleMode ? 'Tắt trộn bài' : 'Bật trộn bài'}
                  className={`hidden md:flex p-1.5 sm:p-2 rounded-full border transition-all ${
                    shuffleMode
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={prevTrack}
                  title="Bài trước"
                  className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
                >
                  <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                </button>

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

                <button
                  onClick={nextTrack}
                  title="Bài kế tiếp"
                  className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
                >
                  <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                </button>

                <button
                  onClick={toggleRepeat}
                  title={`Lặp: ${repeatMode}`}
                  className={`hidden md:flex p-1.5 sm:p-2 rounded-full border transition-all ${
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
                className="hidden md:inline-block text-[10px] sm:text-xs font-mono font-bold text-zinc-400 tabular-nums flex-shrink-0"
              >
                {formatTime(currentTime)}
              </span>

              <div className="hidden md:flex relative flex-1 items-center min-w-[60px] group/seek">
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

              <span className="hidden md:inline-block text-[10px] sm:text-xs font-mono font-bold text-zinc-400 tabular-nums flex-shrink-0">
                {formatTime(effectiveDuration)}
              </span>
            </div>

            {/* Right: Drawer Triggers & Volume Slider */}
            <div className="flex items-center gap-1.5 sm:gap-2 justify-end flex-shrink-0">
              <button
                onClick={() => setShowLyrics((prev) => !prev)}
                title="Lời bài hát toàn màn hình (L)"
                className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                  showLyrics
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowQueue((prev) => !prev)}
                title="Danh sách phát bên phải (Q)"
                className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                  showQueue
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
              </button>

              {/* Volume Slider for Desktop */}
              <div
                className="hidden md:block relative"
                onMouseEnter={handleVolumeMouseEnter}
                onMouseLeave={handleVolumeMouseLeave}
              >
                <button
                  onClick={() => {
                    setShowVolumeSlider((prev) => !prev);
                  }}
                  onDoubleClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                  title={`Âm lượng: ${Math.round(volume * 100)}%`}
                  className={`p-1.5 sm:p-2 rounded-full border transition-all ${
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
                      onTouchStart={handleVolumeTouchStart}
                      onTouchMove={handleVolumeTouchMove}
                      onTouchEnd={handleVolumeTouchEnd}
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
    </>
  );
}
