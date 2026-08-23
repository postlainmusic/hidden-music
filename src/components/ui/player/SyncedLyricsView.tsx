'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LyricLine, LrcParser } from '@/lib/lyrics/lrcParser';
import { usePlayer } from '@/context/PlayerContext';
import { Mic2, Loader2 } from 'lucide-react';

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
  const [sourceTag, setSourceTag] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load and parse lyrics
  const fetchLyrics = useCallback(() => {
    if (rawLrc) {
      const parsed = LrcParser.parse(rawLrc);
      setLyrics(parsed);
      setPlainLyrics(null);
      setSourceTag('STUDIO MASTER LRC');
      return;
    }

    if (!trackTitle) {
      setLyrics([]);
      setPlainLyrics(null);
      return;
    }

    setIsLoading(true);

    const url = `/api/ytm/lyrics?title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(
      artistName || ''
    )}&duration=${encodeURIComponent(duration || 0)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data?.syncedLyrics) {
          const parsed = LrcParser.parse(data.syncedLyrics);
          setLyrics(parsed);
          setPlainLyrics(null);
          setSourceTag('REALTIME SYNCHRONIZED');
        } else if (data?.plainLyrics) {
          setLyrics([]);
          setPlainLyrics(data.plainLyrics);
          setSourceTag('PLAIN TEXT');
        } else {
          setLyrics([]);
          setPlainLyrics(null);
          setSourceTag(null);
        }
      })
      .catch(() => {
        setLyrics([]);
        setPlainLyrics(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [rawLrc, trackTitle, artistName, duration]);

  useEffect(() => {
    fetchLyrics();
  }, [fetchLyrics]);

  const activeIndex = LrcParser.findActiveIndex(lyrics, currentTime);

  // Auto-scroll active line to vertical center
  useEffect(() => {
    if (activeIndex >= 0 && lineRefs.current[activeIndex] && containerRef.current) {
      const activeEl = lineRefs.current[activeIndex];
      const container = containerRef.current;
      if (activeEl) {
        const topPos =
          activeEl.offsetTop - container.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, topPos),
          behavior: 'smooth',
        });
      }
    }
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-zinc-500 gap-3 min-h-[300px] ${className}`}>
        <Loader2 className="w-7 h-7 animate-spin text-white" />
        <p className="text-xs uppercase tracking-widest font-mono text-zinc-400 font-bold">
          ĐANG TẢI LỜI BÀI HÁT...
        </p>
      </div>
    );
  }

  if (lyrics.length === 0 && !plainLyrics) {
    return (
      <div className={`flex flex-col items-center justify-center px-6 py-16 text-center gap-3 min-h-[300px] ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Mic2 className="w-6 h-6 text-zinc-500 opacity-80" />
        </div>
        <h4 className="text-xs uppercase tracking-widest font-mono text-zinc-400 font-bold">
          CHƯA CÓ LỜI BÀI HÁT
        </h4>
        <p className="text-[11px] font-mono text-zinc-600 max-w-xs">
          Ca khúc này hiện chưa có file lời được cập nhật.
        </p>
      </div>
    );
  }

  if (plainLyrics && lyrics.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`overflow-y-auto overflow-x-hidden no-scrollbar px-6 sm:px-8 py-8 text-left select-text font-sans space-y-4 ${className}`}
        style={{
          overscrollBehaviorY: 'contain',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div className="pb-3 border-b border-white/10 mb-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
            — LỜI BÀI HÁT —
          </span>
        </div>
        {plainLyrics.split('\n').map((line, idx) => (
          <p key={idx} className="text-base sm:text-lg text-zinc-300 font-medium leading-relaxed">
            {line || '...'}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto overflow-x-hidden no-scrollbar px-6 sm:px-10 py-12 space-y-6 text-left select-none font-sans scroll-smooth relative ${className}`}
      style={{
        overscrollBehaviorY: 'contain',
        contain: 'layout paint',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {/* Top Source Badge */}
      <div className="flex items-center pb-3 border-b border-white/10 mb-4 sticky top-0 bg-black/80 backdrop-blur-md z-10 -mt-6 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
            {sourceTag || 'REALTIME SYNCHRONIZED'}
          </span>
        </div>
      </div>

      {lyrics.map((line, idx) => {
        const isActive = idx === activeIndex;
        const isPast = idx < activeIndex;

        return (
          <div
            key={line.id || idx}
            ref={(el) => {
              lineRefs.current[idx] = el;
            }}
            onClick={() => seekTo(line.timeSec)}
            className={`cursor-pointer transition-all duration-300 ease-out py-1.5 px-3 -mx-3 rounded-xl relative select-none ${
              isActive
                ? 'text-white font-extrabold text-lg sm:text-xl md:text-2xl leading-snug drop-shadow-[0_0_16px_rgba(255,255,255,0.45)] bg-white/[0.04]'
                : isPast
                ? 'text-zinc-500 hover:text-zinc-300 text-lg sm:text-xl md:text-2xl font-bold leading-snug opacity-60 hover:opacity-90'
                : 'text-zinc-600 hover:text-zinc-400 text-lg sm:text-xl md:text-2xl font-bold leading-snug opacity-40 hover:opacity-80'
            }`}
            style={{
              contain: 'layout style paint',
            }}
          >
            {/* Active Left Indicator Bar */}
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
            )}
            <span className="pl-2">{line.text || '♪ ♪ ♪'}</span>
          </div>
        );
      })}
    </div>
  );
};
