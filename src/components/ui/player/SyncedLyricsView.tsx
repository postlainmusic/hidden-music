'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { Mic2, Music2 } from 'lucide-react';

interface LyricLine {
  time: number;
  text: string;
}

interface SyncedLyricsViewProps {
  rawLrc?: string | null;
  trackTitle?: string;
  artistName?: string;
  duration?: number;
  className?: string;
  onSeek?: (time: number) => void;
}

function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    const matches = [...cleanLine.matchAll(timeRegex)];
    const text = cleanLine.replace(timeRegex, '').trim();

    if (matches.length > 0 && text) {
      for (const match of matches) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const msRaw = match[3];
        const ms = msRaw ? (msRaw.length === 2 ? parseInt(msRaw, 10) * 10 : parseInt(msRaw, 10)) : 0;
        const time = mins * 60 + secs + ms / 1000;
        result.push({ time, text });
      }
    } else if (!matches.length && cleanLine && !cleanLine.startsWith('[')) {
      result.push({ time: -1, text: cleanLine });
    }
  }

  const hasTimestamps = result.some((r) => r.time >= 0);
  if (hasTimestamps) {
    return result.filter((r) => r.time >= 0).sort((a, b) => a.time - b.time);
  }
  return result;
}

export function SyncedLyricsView({
  rawLrc,
  trackTitle,
  artistName,
  className = '',
  onSeek,
}: SyncedLyricsViewProps) {
  const player = usePlayer();
  const currentTime = player?.currentTime ?? 0;
  const seekTo = onSeek || player?.seekTo || (() => {});
  const isPlaying = !!player?.isPlaying;
  const currentTimeRef = player?.currentTimeRef;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const parsedLyrics = useMemo(() => {
    return parseLrc(rawLrc || '');
  }, [rawLrc]);

  const isSynced = useMemo(() => {
    return parsedLyrics.some((line) => line.time >= 0);
  }, [parsedLyrics]);

  // Cập nhật dòng active theo thời gian thực (hỗ trợ cả ref và state)
  useEffect(() => {
    if (!isSynced || parsedLyrics.length === 0) {
      setActiveIndex(-1);
      return;
    }

    let rafId: number;

    const syncLoop = () => {
      const liveTime = currentTimeRef?.current ?? currentTime;
      
      let foundIndex = -1;
      for (let i = parsedLyrics.length - 1; i >= 0; i--) {
        if (liveTime >= parsedLyrics[i].time - 0.2) {
          foundIndex = i;
          break;
        }
      }

      setActiveIndex((prev) => (prev !== foundIndex ? foundIndex : prev));
      if (isPlaying) {
        rafId = requestAnimationFrame(syncLoop);
      }
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(syncLoop);
    } else {
      syncLoop();
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isSynced, parsedLyrics, isPlaying, currentTimeRef, currentTime]);

  // Tự động cuộn mượt dòng đang hát vào giữa tầm mắt
  useEffect(() => {
    if (activeIndex < 0 || isUserScrollingRef.current || !containerRef.current) return;

    const activeEl = lineRefs.current[activeIndex];
    if (activeEl) {
      const container = containerRef.current;
      const targetScrollTop =
        activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  // Nhận diện khi người dùng tự cuộn tay để không giật màn hình
  const handleScroll = useCallback(() => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 2500);
  }, []);

  const handleLineClick = (time: number) => {
    if (time >= 0) {
      seekTo(time);
      isUserScrollingRef.current = false;
    }
  };

  if (!rawLrc || parsedLyrics.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-center px-6 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-zinc-600">
          <Mic2 className="w-5 h-5" />
        </div>
        <p className="text-sm font-cyber font-bold text-zinc-400 uppercase tracking-wider">
          Chưa có lời bài hát
        </p>
        <p className="text-xs font-mono text-zinc-600 mt-1">
          {trackTitle ? `${trackTitle} - ${artistName || 'POSTLAIN'}` : 'Đang cập nhật...'}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto px-6 py-[45vh] space-y-7 no-scrollbar scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 12%, black 25%, black 75%, rgba(0,0,0,0.8) 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 12%, black 25%, black 75%, rgba(0,0,0,0.8) 88%, transparent 100%)',
        }}
      >
        {parsedLyrics.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPassed = activeIndex !== -1 && idx < activeIndex;

          return (
            <p
              key={`line_${idx}_${line.time}`}
              ref={(el) => {
                lineRefs.current[idx] = el;
              }}
              onClick={() => handleLineClick(line.time)}
              className={`transition-all duration-500 ease-out origin-left cursor-pointer leading-relaxed tracking-tight ${
                isActive
                  ? 'text-white font-cyber font-black text-2xl sm:text-3xl scale-100 opacity-100 drop-shadow-[0_0_25px_rgba(255,255,255,0.45)]'
                  : isPassed
                  ? 'text-white/20 font-bold text-lg sm:text-xl scale-95 opacity-40 hover:opacity-75 hover:text-white/60'
                  : 'text-white/30 font-bold text-lg sm:text-xl scale-95 opacity-50 hover:opacity-80 hover:text-white/70'
              }`}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
