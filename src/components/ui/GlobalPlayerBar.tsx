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

  // =========================================================================
  // INTEGRATE ANDROID / MOBILE SYSTEM MEDIA NOTIFICATION PLAYBAR (MediaSession)
  // =========================================================================
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) {
      return;
    }

    const coverUrl = currentAlbum?.cover_url || '/icon.png';
    const trackTitle = currentTrack.title || 'Unknown Track';
    const trackArtist = currentTrack.artist || currentAlbum?.artist || 'POSTLAIN';
    const albumTitle = currentAlbum?.title || 'Hidden Music Vault';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: trackTitle,
      artist: trackArtist,
      album: albumTitle,
      artwork: [
        { src: coverUrl, sizes: '96x96', type: 'image/png' },
        { src: coverUrl, sizes: '128x128', type: 'image/png' },
        { src: coverUrl, sizes: '192x192', type: 'image/png' },
        { src: coverUrl, sizes: '256x256', type: 'image/png' },
        { src: coverUrl, sizes: '384x384', type: 'image/png' },
        { src: coverUrl, sizes: '512x512', type: 'image/png' },
      ],
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    const handlePlayAction = () => {
      if (!isPlaying) togglePlay();
    };

    const handlePauseAction = () => {
      if (isPlaying) togglePlay();
    };

    const handlePrevAction = () => {
      prevTrack();
    };

    const handleNextAction = () => {
      nextTrack();
    };

    const handleSeekToAction = (details: MediaSessionActionDetails) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        seekTo(details.seekTime);
      }
    };

    try {
      navigator.mediaSession.setActionHandler('play', handlePlayAction);
      navigator.mediaSession.setActionHandler('pause', handlePauseAction);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevAction);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextAction);
      navigator.mediaSession.setActionHandler('seekto', handleSeekToAction);
    } catch {
      // Ignored for unsupported handlers
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      } catch {
        // Cleanup safety
      }
    };
  }, [currentTrack, currentAlbum, isPlaying, togglePlay, prevTrack, nextTrack, seekTo]);

  // Update Media Position State
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) {
      return;
    }

    const effectiveDur = duration > 0 && isFinite(duration) ? duration : (currentTrack?.duration || 0);
    if (effectiveDur > 0 && isFinite(currentTime)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: effectiveDur,
          playbackRate: 1.0,
          position: Math.min(Math.max(0, currentTime), effectiveDur),
        });
      } catch {
        // Fallback for edge cases
      }
    }
  }, [currentTime, duration, currentTrack?.duration]);

  // Click outside to close drawers and volume slider
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (playerRootRef.current && !playerRootRef.current.contains(e.target as Node) && !isMobileExpanded) {
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
  }, [isMobileExpanded]);

  // High-Performance 60FPS Direct DOM Timeline Updater
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

  // Keyboard shortcuts
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
        if (isMobileExpanded) {
          setExpandedTab((prev) => (prev === 'lyrics' ? 'player' : 'lyrics'));
        } else {
          setShowLyrics((prev) => !prev);
          setShowQueue(false);
        }
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        if (isMobileExpanded) {
          setExpandedTab((prev) => (prev === 'queue' ? 'player' : 'queue'));
        } else {
          setShowQueue((prev) => !prev);
          setShowLyrics(false);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.min(duration, cur + 5));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const cur = currentTimeRef?.current ?? currentTime;
        seekTo(Math.max(0, cur - 5));
      } else if (e.code === 'Escape') {
        if (isMobileExpanded) {
          setIsMobileExpanded(false);
        } else {
          setShowLyrics(false);
          setShowQueue(false);
          setShowVolumeSlider(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekTo, currentTime, duration, currentTimeRef, isMobileExpanded]);

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

  if (!mounted || !isAuth || activeZone !== 'audio' || !currentTrack) {
    return null;
  }

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;
  const hasDrawerOpen = showLyrics || showQueue;

  return (
    <>
      {/* ========================================================================= */}
      {/* A. FULLSCREEN / BOTTOM SHEET EXPANDED MOBILE PLAYER                      */}
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
        {/* Dynamic Background Glow from Cover */}
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

        {/* Top Dismiss Bar & Title */}
        <div className="flex items-center justify-between w-full flex-shrink-0">
          <button
            onClick={() => setIsMobileExpanded(false)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white hover:text-black transition-all"
            title="Thu nhỏ"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold">
              ĐANG PHÁT TỪ ALBUM
            </span>
            <span className="text-xs font-cyber font-extrabold text-white truncate max-w-[200px]">
              {currentAlbum?.title || 'HIDDEN VAULT'}
            </span>
          </div>

          <div className="w-9 h-9" />
        </div>

        {/* Center Main Viewport: Swappable Artwork / Lyrics / Queue */}
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
                  <Disc3 className="w-24 h-24 text-white/40 animate-spin-slow" />
                )}
              </div>
            </div>
          )}

          {expandedTab === 'lyrics' && (
            <div
              ref={expandedLyricsScrollRef}
              className="h-full w-full overflow-y-auto no-scrollbar text-center py-24 space-y-3 font-sans px-3 animate-fadeIn"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {parsedLyrics.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs uppercase font-mono tracking-widest">
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
                      className={`cursor-pointer transition-all duration-200 leading-relaxed ${
                        isActive
                          ? 'text-white text-base font-bold drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] opacity-100 py-1 scale-105'
                          : 'text-slate-500 text-sm font-medium opacity-50 py-0.5'
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
            <div
              className="h-full w-full overflow-y-auto no-scrollbar space-y-2 py-2 font-mono animate-fadeIn"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {playlist.map((track, idx) => {
                const isCur = track.id === currentTrack.id;
                return (
                  <div
                    key={track.id || idx}
                    onClick={() => playTrack(track, currentAlbum, playlist)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isCur
                        ? 'bg-white/20 border-white text-white font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 w-5 text-center">
                        {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs truncate uppercase">{track.title}</span>
                        <span className="text-[10px] text-slate-400 truncate">{track.artist || 'VAULT ARTIST'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 ml-2">{formatTime(track.duration || 0)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Controls Area */}
        <div className="w-full flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex flex-col min-w-0 pr-4">
              <h3 className="text-lg font-cyber font-extrabold text-white truncate uppercase tracking-wide">
                {currentTrack.title}
              </h3>
              <p className="text-xs text-slate-400 font-mono font-bold truncate uppercase mt-0.5">
                {currentTrack.artist || currentAlbum?.artist || 'VAULT ARTIST'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setExpandedTab((prev) => (prev === 'lyrics' ? 'player' : 'lyrics'))}
                className={`p-2.5 rounded-full border transition-all ${
                  expandedTab === 'lyrics'
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-white/10 text-slate-300 border-white/15'
                }`}
              >
                <Mic2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpandedTab((prev) => (prev === 'queue' ? 'player' : 'queue'))}
                className={`p-2.5 rounded-full border transition-all ${
                  expandedTab === 'queue'
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-white/10 text-slate-300 border-white/15'
                }`}
              >
                <ListMusic className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full flex flex-col gap-1.5">
            <div className="relative w-full flex items-center">
              <input
                ref={expandedSeekerInputRef}
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
                className="w-full h-2 rounded-full appearance-none cursor-pointer border border-white/20 bg-zinc-800 shadow-inner"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 tabular-nums">
              <span ref={expandedCurrentTimeRef}>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 pt-1">
            <button
              onClick={toggleShuffle}
              className={`p-2.5 rounded-full border transition-all ${
                shuffleMode
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-white/5 text-slate-400 border-white/10'
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
                repeatMode !== 'off'
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* B. DOCK MINI PLAYBAR (DESKTOP + MOBILE MINI BAR)                          */}
      {/* ========================================================================= */}
      <div
        ref={playerRootRef}
        style={{
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}
        className={`fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center justify-end pointer-events-none px-2 sm:px-6 md:px-8 transition-all duration-300 ${
          isMobileExpanded ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
        {/* 1. SEAMLESS ATTACHED DRAWER: LYRICS & QUEUE (DESKTOP) */}
        {hasDrawerOpen && (
          <div className="w-full max-w-5xl h-[280px] sm:h-[360px] rounded-t-3xl border border-b-0 border-white/20 bg-zinc-950/98 shadow-[0_-20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-3 sm:p-5 flex flex-col relative overflow-hidden pointer-events-auto font-mono z-10 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                {showLyrics ? <Mic2 className="w-4 h-4 text-white" /> : <ListMusic className="w-4 h-4 text-white" />}
                <span className="text-xs uppercase font-extrabold tracking-widest text-white font-cyber">
                  {showLyrics ? 'LỜI BÀI HÁT' : 'DANH SÁCH PHÁT'}
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

            <div className="flex-1 min-h-0 relative overflow-hidden select-none">
              {showLyrics && (
                <div
                  ref={lyricsScrollRef}
                  className="h-full overflow-y-auto overflow-x-hidden no-scrollbar text-center py-24 sm:py-32 space-y-2.5 will-change-transform font-sans px-2"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {parsedLyrics.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs uppercase tracking-widest font-mono">
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
                          className={`transition-colors duration-250 cursor-pointer select-none font-sans leading-relaxed ${
                            isActive
                              ? 'text-white text-sm sm:text-base md:text-lg font-bold drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] opacity-100 py-1'
                              : 'text-slate-500 hover:text-slate-300 text-xs sm:text-sm font-medium opacity-50 hover:opacity-80 py-0.5'
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
                  className="h-full overflow-y-auto overflow-x-hidden no-scrollbar space-y-1.5 py-2 pr-1 font-mono"
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

        {/* 2. DOCK PLAYBAR */}
        <div
          className={`w-full max-w-5xl rounded-2xl md:rounded-3xl border border-white/20 bg-zinc-950/98 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl p-2.5 sm:p-3 pointer-events-auto relative overflow-hidden transition-all duration-200 select-none ${
            hasDrawerOpen ? '-mt-[1px] rounded-t-none border-t-0' : ''
          }`}
        >
          {/* Mobile Top Progress Bar Line */}
          <div className="block md:hidden absolute top-0 left-0 right-0 h-[2.5px] bg-white/10 overflow-hidden">
            <div
              ref={mobileProgressBarRef}
              className="h-full bg-white transition-[width] duration-100 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{
                width: `${effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0}%`,
              }}
            />
            <input
              ref={mobileSeekerInputRef}
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
            
            {/* Left: Track Information & Cover (TAP TO EXPAND ON MOBILE) */}
            <div
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setIsMobileExpanded(true);
                  setExpandedTab('player');
                }
              }}
              className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-[130px] xs:max-w-[170px] sm:max-w-[210px] flex-shrink-0 cursor-pointer md:cursor-default"
            >
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0 shadow-lg">
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

            {/* Center: Controls + Inline Timeline */}
            <div className="flex items-center justify-center md:justify-start gap-1.5 sm:gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <button
                  onClick={toggleShuffle}
                  title={shuffleMode ? 'Tắt trộn bài' : 'Bật trộn bài'}
                  className={`hidden md:flex p-1.5 sm:p-2 rounded-full border transition-all ${
                    shuffleMode
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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

              <span
                ref={currentTimeTextRef}
                className="hidden md:inline-block text-[10px] sm:text-xs font-mono font-bold text-slate-400 tabular-nums flex-shrink-0"
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

              <span className="hidden md:inline-block text-[10px] sm:text-xs font-mono font-bold text-slate-400 tabular-nums flex-shrink-0">
                {formatTime(effectiveDuration)}
              </span>
            </div>

            {/* Right: Drawer Triggers & Volume Slider */}
            <div className="flex items-center gap-1 sm:gap-1.5 justify-end flex-shrink-0">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsMobileExpanded(true);
                    setExpandedTab('lyrics');
                  } else {
                    setShowLyrics((prev) => !prev);
                    setShowQueue(false);
                  }
                }}
                title="Lời bài hát (L)"
                className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                  showLyrics
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsMobileExpanded(true);
                    setExpandedTab('queue');
                  } else {
                    setShowQueue((prev) => !prev);
                    setShowLyrics(false);
                  }
                }}
                title="Danh sách phát (Q)"
                className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                  showQueue
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/15'
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
                      : 'bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10'
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
