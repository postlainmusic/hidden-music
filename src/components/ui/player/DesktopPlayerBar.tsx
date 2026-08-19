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
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '@/lib/lrcParser';

const formatTime = (secs: number) => {
  if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const rem = Math.floor(secs % 60);
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
};

export default function DesktopPlayerBar() {
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

  const [expandedMode, setExpandedMode] = useState<'none' | 'lyrics' | 'queue'>('none');
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

  // Click outside to collapse
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

  // High-Performance 60FPS Direct DOM Timeline Updater (AUDIO ZONE ONLY)
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

  // Smooth scroll lyrics
  useEffect(() => {
    if (expandedMode !== 'lyrics' || activeLyricIdx < 0) return;

    const container = lyricsScrollRef.current;
    if (!container) return;

    const activeEl = container.querySelector('[data-active-lyric="true"]') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }, [activeLyricIdx, expandedMode]);

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

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;
  const isDrawerOpen = expandedMode !== 'none';

  return (
    <div
      ref={playerRootRef}
      className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-5xl z-50 pointer-events-none px-4 sm:px-6 select-none flex flex-col justify-end"
    >
      {/* UNIFIED CONTINUOUS GLASSMORPHIC CARD */}
      <div className="w-full bg-zinc-950/40 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto overflow-hidden flex flex-col transition-[all] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
        {/* 1. TOP EXPANDABLE SECTION (Pure Lyrics or Queue) */}
        <div
          className={`w-full overflow-hidden transition-[height,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
            isDrawerOpen
              ? 'h-[400px] sm:h-[450px] opacity-100 border-b border-white/10'
              : 'h-0 opacity-0 border-b-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 sm:px-8 py-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              {expandedMode === 'lyrics' ? (
                <>
                  <Mic2 className="w-4 h-4 text-white" />
                  <span className="text-xs uppercase font-cyber font-black tracking-wider text-white">
                    LỜI BÀI HÁT // GOTHIC SYNCED STREAM
                  </span>
                </>
              ) : (
                <>
                  <ListMusic className="w-4 h-4 text-white" />
                  <span className="text-xs uppercase font-cyber font-black tracking-wider text-white">
                    HÀNG CHỜ PHÁT ({playlist.length} BÀI)
                  </span>
                </>
              )}
            </div>

            <button
              onClick={() => setExpandedMode('none')}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white text-zinc-300 hover:text-black transition-all"
              title="Thu nhỏ (Esc)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 px-6 sm:px-8 pb-4 overflow-hidden relative">
            {/* Pure Centered Lyrics Stream (No Left Image / Title) */}
            {expandedMode === 'lyrics' && (
              <div
                ref={lyricsScrollRef}
                className="w-full h-full overflow-y-auto no-scrollbar text-center py-14 space-y-5 font-sans px-4"
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
                        data-active-lyric={isActive ? 'true' : 'false'}
                        onClick={() => seekTo(line.time)}
                        className={`transition-all duration-300 cursor-pointer select-none leading-relaxed ${
                          isActive
                            ? 'text-white text-xl sm:text-2xl font-black drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] scale-105 opacity-100'
                            : 'text-zinc-400 hover:text-zinc-200 text-sm sm:text-base font-medium opacity-40 hover:opacity-75'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })
                )}
              </div>
            )}

            {/* Queue Mode */}
            {expandedMode === 'queue' && (
              <div
                className="w-full h-full overflow-y-auto no-scrollbar space-y-2 py-2 font-mono pr-1"
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
                            : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-zinc-400 w-5 text-center flex-shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm truncate font-bold">{track.title}</p>
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
        </div>

        {/* 2. BOTTOM PLAYBAR ROW */}
        <div className="w-full px-4 sm:px-6 py-3 flex flex-col gap-1 flex-shrink-0">
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Left: Track Information & Cover */}
            <div
              onClick={() => setExpandedMode((prev) => (prev === 'lyrics' ? 'none' : 'lyrics'))}
              className="flex items-center gap-3 min-w-0 max-w-[240px] flex-shrink-0 cursor-pointer group/trackinfo"
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0 shadow-md">
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
                <span className="text-xs font-cyber font-extrabold text-white truncate uppercase tracking-wide group-hover/trackinfo:text-zinc-200 transition-colors">
                  {currentTrack.title}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono font-bold truncate uppercase mt-0.5">
                  {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                </span>
              </div>
            </div>

            {/* Center: Controls + Inline Timeline */}
            <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={toggleShuffle}
                  title={shuffleMode ? 'Tắt trộn bài' : 'Bật trộn bài'}
                  className={`flex p-2 rounded-full border transition-all ${
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
                  className="p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={togglePlay}
                  title={isBuffering ? 'Đang tải âm thanh...' : isPlaying ? 'Tạm dừng' : 'Phát'}
                  className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95 flex-shrink-0"
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
                  onClick={nextTrack}
                  title="Bài kế tiếp"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={toggleRepeat}
                  title={`Lặp: ${repeatMode}`}
                  className={`flex p-2 rounded-full border transition-all ${
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

            {/* Right: Drawer Triggers & Volume Slider */}
            <div className="flex items-center gap-2 justify-end flex-shrink-0">
              <button
                onClick={() => setExpandedMode((prev) => (prev === 'lyrics' ? 'none' : 'lyrics'))}
                title="Lời bài hát (L)"
                className={`p-2 rounded-full border transition-all ${
                  expandedMode === 'lyrics'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setExpandedMode((prev) => (prev === 'queue' ? 'none' : 'queue'))}
                title="Danh sách phát (Q)"
                className={`p-2 rounded-full border transition-all ${
                  expandedMode === 'queue'
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
              </button>

              {/* Volume Slider */}
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
