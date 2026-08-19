'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '@/lib/lrcParser';

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

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');

  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineRafIdRef = useRef<number | null>(null);

  // Direct DOM refs for 60FPS timeline updates without React re-renders
  const mobileProgressBarRef = useRef<HTMLDivElement | null>(null);
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
        if (mobileProgressBarRef.current) {
          mobileProgressBarRef.current.style.width = `${pct}%`;
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
    if (!isExpanded || activeTab !== 'lyrics' || activeLyricIdx < 0) return;

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
  }, [activeLyricIdx, isExpanded, activeTab]);

  if (!currentTrack) return null;

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. MOBILE COMPACT MINI-BAR (ALWAYS DOCKED AT BOTTOM)                      */}
      {/* ========================================================================= */}
      <div className="fixed bottom-4 left-3 right-3 z-40 pointer-events-auto select-none">
        <div className="w-full bg-zinc-950/85 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 sm:p-2.5 shadow-[0_15px_35px_rgba(0,0,0,0.85)] flex flex-col gap-1.5 relative overflow-hidden">
          {/* Top Thin Progress Line */}
          <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              ref={mobileProgressBarRef}
              style={{ width: `${(currentTime / effectiveDuration) * 100}%` }}
              className="h-full bg-white transition-[width] duration-75"
            />
          </div>

          <div className="flex items-center justify-between gap-3 w-full">
            {/* Left: Thumbnail + Track Meta (Tap to Expand Sheet) */}
            <div
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0 shadow-sm">
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
                <span className="text-[11px] font-cyber font-extrabold text-white truncate uppercase tracking-wide">
                  {currentTrack.title}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono font-bold truncate uppercase mt-0.5">
                  {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                </span>
              </div>
            </div>

            {/* Right: Quick Play/Pause + Expand Chevron */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-md active:scale-90 transition-transform"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isBuffering ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setIsExpanded(true)}
                className="p-2 rounded-full text-zinc-400 hover:text-white transition-colors"
                title="Mở rộng"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE FULL EXPANDED BOTTOM SHEET (LYRICS & QUEUE)                     */}
      {/* ========================================================================= */}
      {isExpanded && (
        <div className="fixed inset-x-0 bottom-0 top-12 z-50 bg-[#07070a]/98 backdrop-blur-3xl rounded-t-3xl border-t border-white/15 flex flex-col p-4 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.95)] animate-fadeIn select-none">
          {/* Top Drag Handle & Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
            {/* Tabs Switcher */}
            <div className="flex items-center p-0.5 rounded-full bg-white/10 border border-white/15">
              <button
                onClick={() => setActiveTab('lyrics')}
                className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all ${
                  activeTab === 'lyrics' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                LỜI BÀI HÁT
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all ${
                  activeTab === 'queue' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                DANH SÁCH ({playlist.length})
              </button>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white text-zinc-300 hover:text-black transition-all"
              title="Đóng (Esc)"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Sheet Body Content */}
          <div className="flex-1 min-h-0 relative overflow-hidden my-3">
            {/* Lyrics Tab */}
            {activeTab === 'lyrics' && (
              <div
                ref={lyricsScrollRef}
                className="w-full h-full overflow-y-auto no-scrollbar text-center py-10 space-y-4 font-sans px-2"
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
                            ? 'text-white text-lg font-black drop-shadow-[0_0_15px_rgba(255,255,255,0.85)] scale-105 opacity-100'
                            : 'text-zinc-400 text-sm font-medium opacity-40 hover:opacity-75'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })
                )}
              </div>
            )}

            {/* Queue Tab */}
            {activeTab === 'queue' && (
              <div
                className="w-full h-full overflow-y-auto no-scrollbar space-y-2 py-1 font-mono"
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

          {/* Bottom Controls Area inside Expanded Sheet */}
          <div className="w-full pt-3 border-t border-white/10 flex flex-col gap-3 flex-shrink-0">
            {/* Seeker */}
            <div className="flex flex-col gap-1 w-full">
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

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span ref={expandedCurrentTimeTextRef}>{formatTime(currentTime)}</span>
                <span>{formatTime(effectiveDuration)}</span>
              </div>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-between px-4">
              <button
                onClick={toggleShuffle}
                className={`p-2 rounded-full border transition-all ${
                  shuffleMode
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-zinc-400 border-white/10'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4">
                <button
                  onClick={prevTrack}
                  className="p-2.5 rounded-full bg-white/5 text-white border border-white/10 active:scale-95 transition-transform"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>

                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                >
                  {isBuffering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={nextTrack}
                  className="p-2.5 rounded-full bg-white/5 text-white border border-white/10 active:scale-95 transition-transform"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
              </div>

              <button
                onClick={toggleRepeat}
                className={`p-2 rounded-full border transition-all ${
                  repeatMode !== 'off'
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-zinc-400 border-white/10'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
