'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LyricLine, LrcParser } from '@/lib/lyrics/lrcParser';
import { usePlayer } from '@/context/PlayerContext';
import { Mic2, Loader2, RefreshCw } from 'lucide-react';

interface SyncedLyricsViewProps {
  rawLrc?: string;
  trackTitle?: string;
  artistName?: string;
  duration?: number;
  className?: string;
}

export const SyncedLyricsView: React.FC<SyncedLyricsViewProps> = ({
  rawLrc,
  trackTitle,
  artistName,
  duration,
  className = '',
}) => {
  const { currentTime, seekTo } = usePlayer();
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load and parse lyrics
  useEffect(() => {
    if (rawLrc) {
      const parsed = LrcParser.parse(rawLrc);
      setLyrics(parsed);
      setPlainLyrics(null);
      return;
    }

    if (!trackTitle) {
      setLyrics([]);
      setPlainLyrics(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    const url = `/api/ytm/lyrics?title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(artistName || '')}&duration=${encodeURIComponent(duration || 0)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data?.syncedLyrics) {
          const parsed = LrcParser.parse(data.syncedLyrics);
          setLyrics(parsed);
          setPlainLyrics(null);
        } else if (data?.plainLyrics) {
          setLyrics([]);
          setPlainLyrics(data.plainLyrics);
        } else {
          setLyrics([]);
          setPlainLyrics(null);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLyrics([]);
          setPlainLyrics(null);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [rawLrc, trackTitle, artistName, duration]);

  const activeIndex = LrcParser.findActiveIndex(lyrics, currentTime);

  // Auto-scroll active line to center smoothly without layout shift
  useEffect(() => {
    if (activeIndex >= 0 && lineRefs.current[activeIndex] && containerRef.current) {
      const activeEl = lineRefs.current[activeIndex];
      const container = containerRef.current;
      if (activeEl) {
        const topPos = activeEl.offsetTop - container.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, topPos),
          behavior: 'smooth',
        });
      }
    }
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-zinc-500 gap-3 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
        <p className="text-xs uppercase tracking-widest font-mono text-zinc-400">Đang tìm lời bài hát...</p>
      </div>
    );
  }

  if (lyrics.length === 0 && !plainLyrics) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-zinc-600 gap-2 ${className}`}>
        <Mic2 className="w-8 h-8 opacity-40" />
        <p className="text-xs uppercase tracking-wider font-mono">Chưa có lời đồng bộ cho bài hát này</p>
      </div>
    );
  }

  if (plainLyrics && lyrics.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`overflow-y-auto px-6 py-8 text-center select-text font-sans space-y-4 ${className}`}
        style={{ overscrollBehaviorY: 'contain' }}
      >
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">— LỜI BÀI HÁT (STATIC) —</p>
        {plainLyrics.split('\n').map((line, idx) => (
          <p key={idx} className="text-sm md:text-base text-zinc-300 font-medium leading-relaxed">
            {line || '...'}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto px-4 sm:px-8 py-12 space-y-6 text-center select-none font-sans scroll-smooth ${className}`}
      style={{
        overscrollBehaviorY: 'contain',
        contain: 'layout paint',
      }}
    >
      {lyrics.map((line, idx) => {
        const isActive = idx === activeIndex;
        const isPast = idx < activeIndex;

        return (
          <div
            key={line.id}
            ref={(el) => {
              lineRefs.current[idx] = el;
            }}
            onClick={() => seekTo(line.timeSec)}
            className={`cursor-pointer transition-all duration-300 py-1 rounded-lg ${
              isActive
                ? 'text-white font-bold text-base sm:text-lg md:text-xl scale-[1.02] drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                : isPast
                ? 'text-zinc-500 hover:text-zinc-300 text-sm sm:text-base md:text-lg font-normal opacity-70'
                : 'text-zinc-600 hover:text-zinc-400 text-sm sm:text-base md:text-lg font-normal opacity-50'
            }`}
            style={{
              contain: 'layout style paint',
            }}
          >
            {line.text || '♪ ♪ ♪'}
          </div>
        );
      })}
    </div>
  );
};
