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
  ListMusic,
  Disc3,
  Mic2,
  Heart,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '@/lib/lrcParser';
import { useTelemetry } from '@/hooks/useTelemetry';

const formatTime = (secs: number) => {
  if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const rem = Math.floor(secs % 60);
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
};

export default function MobilePlayerBar() {
  const {
    currentTrack,
    currentAlbum,
    playlist,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
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
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const { sendTelemetry } = useTelemetry();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeView, setActiveView] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [isLiked, setIsLiked] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineRafIdRef = useRef<number | null>(null);

  // Horizontal Swipe on Mini Player Refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchDeltaXRef = useRef<number>(0);
  const [swipeOffsetX, setSwipeOffsetX] = useState<number>(0);
  const isSwipingHorizontalRef = useRef<boolean>(false);

  // Vertical Swipe-Down on Expanded Sheet Refs
  const sheetTouchStartYRef = useRef<number>(0);
  const sheetTouchDeltaYRef = useRef<number>(0);
  const [sheetOffsetY, setSheetOffsetY] = useState<number>(0);

  // Direct DOM refs for 60FPS timeline updates without React re-renders
  const miniProgressBarRef = useRef<HTMLDivElement | null>(null);
  const expandedProgressBarRef = useRef<HTMLDivElement | null>(null);
  const expandedCurrentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const expandedSeekerInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);

  // High-Performance 60FPS Direct DOM Timeline Updater (AUDIO ZONE ONLY)
  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (timelineRafIdRef.current) cancelAnimationFrame(timelineRafIdRef.current);
      return;
    }

    const effectiveDur = duration > 0 && isFinite(duration) ? duration : (currentTrack?.duration || 1);

    const updateDirectTimeline = () => {
      const liveSec = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : 0);
      if (effectiveDur > 0) {
        const pct = Math.min(100, Math.max(0, (liveSec / effectiveDur) * 100));
        if (miniProgressBarRef.current) {
          miniProgressBarRef.current.style.width = `${pct}%`;
        }
        if (expandedProgressBarRef.current && !isDraggingSeekerRef.current) {
          expandedProgressBarRef.current.style.width = `${pct}%`;
        }
      }
      if (!isDraggingSeekerRef.current) {
        if (expandedSeekerInputRef.current) {
          expandedSeekerInputRef.current.value = String(liveSec);
        }
        if (expandedCurrentTimeTextRef.current) {
          expandedCurrentTimeTextRef.current.textContent = formatTime(liveSec);
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

  // Auto-scroll active lyric
  useEffect(() => {
    if (!isExpanded || activeView !== 'lyrics' || activeLyricIdx < 0) return;

    const container = lyricsScrollRef.current;
    if (!container) return;

    const activeEl = container.querySelector('[data-active-mobile-lyric="true"]') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }, [activeLyricIdx, isExpanded, activeView]);

  // Handle Mini-Player Horizontal Swipe Gestures
  const handleMiniTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchDeltaXRef.current = 0;
      isSwipingHorizontalRef.current = false;
    }
  };

  const handleMiniTouchMove = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // Detect intentional horizontal swipe vs vertical scroll
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      isSwipingHorizontalRef.current = true;
      touchDeltaXRef.current = diffX;
      // Damped horizontal translation feedback
      setSwipeOffsetX(Math.max(-40, Math.min(40, diffX * 0.4)));
    }
  };

  const handleMiniTouchEnd = () => {
    if (isSwipingHorizontalRef.current) {
      if (touchDeltaXRef.current < -50) {
        nextTrack();
      } else if (touchDeltaXRef.current > 50) {
        prevTrack();
      }
    }
    setSwipeOffsetX(0);
    setTimeout(() => {
      isSwipingHorizontalRef.current = false;
    }, 50);
  };

  // Handle Expanded Sheet Swipe-Down to Dismiss
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      sheetTouchStartYRef.current = e.touches[0].clientY;
      sheetTouchDeltaYRef.current = 0;
    }
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    const diffY = e.touches[0].clientY - sheetTouchStartYRef.current;
    if (diffY > 0) {
      sheetTouchDeltaYRef.current = diffY;
      setSheetOffsetY(Math.min(180, diffY * 0.6));
    }
  };

  const handleSheetTouchEnd = () => {
    if (sheetTouchDeltaYRef.current > 60) {
      setIsExpanded(false);
    }
    setSheetOffsetY(0);
    sheetTouchDeltaYRef.current = 0;
  };

  const handleToggleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextLiked = !isLiked;
      setIsLiked(nextLiked);
      if (currentTrack) {
        sendTelemetry({
          event: 'heart',
          trackId: currentTrack.id,
          albumId: currentTrack.album_id,
          isLiked: nextLiked,
          sourceSection: 'mobile_player_expanded',
        });
      }
    },
    [isLiked, currentTrack, sendTelemetry]
  );

  if (!currentTrack) return null;

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. COMPACT MINI-PLAYER (COLLAPSED STATE - TOUCH TARGET TO EXPAND)         */}
      {/* ========================================================================= */}
      <div
        className="fixed bottom-4 left-3 right-3 z-40 pointer-events-auto select-none"
        onTouchStart={handleMiniTouchStart}
        onTouchMove={handleMiniTouchMove}
        onTouchEnd={handleMiniTouchEnd}
        onClick={() => {
          if (!isSwipingHorizontalRef.current) {
            setIsExpanded(true);
          }
        }}
      >
        <div
          style={{ transform: `translateX(${swipeOffsetX}px)` }}
          className="w-full bg-zinc-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 sm:p-2.5 shadow-[0_15px_35px_rgba(0,0,0,0.85)] flex flex-col gap-1.5 relative overflow-hidden transition-transform duration-150 active:scale-[0.99] cursor-pointer"
        >
          {/* Top Thin Progress Line */}
          <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              ref={miniProgressBarRef}
              style={{ width: `${(currentTime / effectiveDuration) * 100}%` }}
              className="h-full bg-white transition-[width] duration-75"
            />
          </div>

          <div className="flex items-center justify-between gap-3 w-full">
            {/* Left: Artwork + Track Meta */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0 shadow-sm">
                {currentAlbum?.cover_url ? (
                  <img
                    src={currentAlbum.cover_url}
                    alt={currentAlbum.title || 'Cover'}
                    className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : ''} transition-transform duration-500`}
                  />
                ) : (
                  <Disc3
                    className="w-full h-full p-1.5 text-white/50 animate-spin"
                    style={{ animationPlayState: isPlaying ? 'running' : 'paused', animationDuration: '4s' }}
                  />
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-xs font-cyber font-extrabold text-white truncate uppercase tracking-wide">
                  {currentTrack.title}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono font-bold truncate uppercase mt-0.5">
                  {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                </span>
              </div>
            </div>

            {/* Right: Essential Direct Controls (Play/Pause + Next) */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md active:scale-90 transition-transform flex-shrink-0"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isBuffering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextTrack();
                }}
                className="p-2 rounded-full text-zinc-300 hover:text-white active:scale-90 transition-transform"
                title="Bài kế tiếp"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FULLSCREEN EXPANDED MOBILE PLAYER (STREAMING APP STANDARD)            */}
      {/* ========================================================================= */}
      {isExpanded && (
        <div
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          style={{ transform: `translateY(${sheetOffsetY}px)` }}
          className="fixed inset-0 z-50 bg-[#07070a] text-white flex flex-col justify-between p-6 pb-10 select-none animate-fadeIn transition-transform duration-100"
        >
          {/* Top Bar: Drag Pill Indicator + Header */}
          <div className="flex flex-col items-center w-full flex-shrink-0">
            {/* Minimalist Drag Handle */}
            <div className="w-10 h-1 bg-white/25 rounded-full mb-3 cursor-pointer" />

            <div className="flex items-center justify-between w-full pb-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 active:scale-95 transition-all"
                title="Thu nhỏ"
              >
                <ChevronDown className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
                  ĐANG PHÁT TỪ ALBUM
                </span>
                <span className="text-xs font-cyber font-bold text-white truncate max-w-[200px] uppercase mt-0.5">
                  {currentAlbum?.title || 'HIDDEN DISC'}
                </span>
              </div>

              <div className="w-9" />
            </div>
          </div>

          {/* Center Main Viewport: Player Artwork vs Lyrics vs Queue */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center my-4 overflow-hidden relative w-full">
            {/* PLAYER VIEW: Prominent Artwork */}
            {activeView === 'player' && (
              <div className="w-full flex flex-col items-center justify-center h-full px-4 animate-fadeIn">
                <div className="relative w-64 h-64 xs:w-72 xs:h-72 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] border border-white/20 bg-zinc-950 flex items-center justify-center mb-6">
                  {currentAlbum?.cover_url ? (
                    <img
                      src={currentAlbum.cover_url}
                      alt={currentAlbum.title || 'Cover'}
                      className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                    />
                  ) : (
                    <Disc3 className="w-20 h-20 text-zinc-700 animate-spin" />
                  )}
                </div>

                {/* Metadata Row with Like Button */}
                <div className="flex items-center justify-between w-full max-w-xs">
                  <div className="flex flex-col min-w-0 flex-1 mr-3">
                    <h2 className="text-lg font-cyber font-black text-white truncate uppercase tracking-wide">
                      {currentTrack.title}
                    </h2>
                    <p className="text-xs font-mono text-zinc-400 truncate uppercase mt-0.5">
                      {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                    </p>
                  </div>

                  <button
                    onClick={handleToggleLike}
                    className="p-2 rounded-full active:scale-90 transition-transform"
                    title={isLiked ? 'Đã yêu thích' : 'Yêu thích'}
                  >
                    <Heart
                      className={`w-5 h-5 transition-colors ${
                        isLiked ? 'text-rose-500 fill-rose-500' : 'text-zinc-400 hover:text-white'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* LYRICS VIEW: Pure Synced Stream */}
            {activeView === 'lyrics' && (
              <div
                ref={lyricsScrollRef}
                className="w-full h-full overflow-y-auto no-scrollbar text-center py-10 space-y-4 font-sans px-4 animate-fadeIn"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {parsedLyrics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs uppercase tracking-widest font-mono">
                    Chưa có lời bài hát cho tác phẩm này
                  </div>
                ) : (
                  parsedLyrics.map((line, idx) => {
                    const isActive = idx === activeLyricIdx;
                    return (
                      <p
                        key={idx}
                        data-active-mobile-lyric={isActive ? 'true' : 'false'}
                        onClick={() => seekTo(line.time)}
                        className={`transition-all duration-300 cursor-pointer select-none leading-relaxed ${
                          isActive
                            ? 'text-white text-xl font-black drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] scale-105 opacity-100'
                            : 'text-zinc-500 text-sm font-medium opacity-40 hover:opacity-75'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })
                )}
              </div>
            )}

            {/* QUEUE VIEW: Track List */}
            {activeView === 'queue' && (
              <div
                className="w-full h-full overflow-y-auto no-scrollbar space-y-2 py-2 font-mono px-2 animate-fadeIn"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {playlist.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs uppercase tracking-widest">
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
                            ? 'bg-white/20 border-white text-white font-bold shadow-md'
                            : 'bg-white/5 border-white/10 text-zinc-300 active:bg-white/10'
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
            )}
          </div>

          {/* Bottom Area: Full Seekbar + Master Control Row + Utility Toggles */}
          <div className="w-full flex flex-col gap-4 flex-shrink-0 pt-2">
            {/* Seekbar */}
            <div className="flex flex-col gap-1.5 w-full px-2">
              <div className="relative w-full flex items-center group/seek">
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
                    if (expandedCurrentTimeTextRef.current) {
                      expandedCurrentTimeTextRef.current.textContent = formatTime(val);
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
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer border border-white/15 bg-zinc-900 transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
                <span ref={expandedCurrentTimeTextRef}>{formatTime(currentTime)}</span>
                <span>{formatTime(effectiveDuration)}</span>
              </div>
            </div>

            {/* Master Control Row */}
            <div className="flex items-center justify-between px-2">
              <button
                onClick={toggleShuffle}
                className={`p-2.5 rounded-full border transition-all ${
                  shuffleMode
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-400 border-white/10'
                }`}
                title="Trộn bài"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={prevTrack}
                className="p-3 rounded-full bg-white/5 text-white border border-white/10 active:scale-90 transition-transform"
                title="Bài trước"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95 transition-transform"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isBuffering ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-3 rounded-full bg-white/5 text-white border border-white/10 active:scale-90 transition-transform"
                title="Bài kế tiếp"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={toggleRepeat}
                className={`p-2.5 rounded-full border transition-all ${
                  repeatMode !== 'off'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-400 border-white/10'
                }`}
                title={`Lặp: ${repeatMode}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Bottom Utility Icons (Lyrics & Queue Quick-Toggles) */}
            <div className="flex items-center justify-between px-4 pt-1">
              <button
                onClick={() => setActiveView((prev) => (prev === 'lyrics' ? 'player' : 'lyrics'))}
                className={`p-2.5 rounded-full border transition-all flex items-center gap-1.5 ${
                  activeView === 'lyrics'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Lời bài hát"
              >
                <Mic2 className="w-4 h-4" />
                <span className="text-[10px] font-mono font-bold uppercase">LỜI BÀI HÁT</span>
              </button>

              <button
                onClick={() => setActiveView((prev) => (prev === 'queue' ? 'player' : 'queue'))}
                className={`p-2.5 rounded-full border transition-all flex items-center gap-1.5 ${
                  activeView === 'queue'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Danh sách phát"
              >
                <ListMusic className="w-4 h-4" />
                <span className="text-[10px] font-mono font-bold uppercase">HÀNG CHỜ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
