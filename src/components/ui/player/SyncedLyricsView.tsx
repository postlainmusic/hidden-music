'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricLine, LrcParser } from '@/lib/lyrics/lrcParser';
import { usePlayer } from '@/context/PlayerContext';
import { Mic2, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { buttonTapMotion, subtleButtonTapMotion, springSnappy } from '@/lib/motionVariants';

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
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [sourceTag, setSourceTag] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load and parse lyrics
  const fetchLyrics = useCallback(
    (forceAi = false) => {
      if (rawLrc && !forceAi) {
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

      if (forceAi) setIsAiSearching(true);
      else setIsLoading(true);

      const url = `/api/ytm/lyrics?title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(
        artistName || ''
      )}&duration=${encodeURIComponent(duration || 0)}${forceAi ? '&forceAi=true' : ''}`;

      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data?.syncedLyrics) {
            const parsed = LrcParser.parse(data.syncedLyrics);
            setLyrics(parsed);
            setPlainLyrics(null);
            setSourceTag(
              data.source === 'ai_neural_synthesized'
                ? 'AI NEURAL TIME-SYNCED'
                : data.source === 'ai_procedural_generated'
                ? 'AI KARAOKE SYNC'
                : 'REALTIME SYNCHRONIZED'
            );
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
          setIsAiSearching(false);
        });
    },
    [rawLrc, trackTitle, artistName, duration]
  );

  useEffect(() => {
    fetchLyrics(false);
  }, [fetchLyrics]);

  const activeIndex = LrcParser.findActiveIndex(lyrics, currentTime);

  // Auto-scroll active line to vertical center smoothly without layout shift
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

  if (isLoading || isAiSearching) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-zinc-500 gap-3 min-h-[300px] ${className}`}>
        <div className="relative">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <Sparkles className="w-4 h-4 text-white/80 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <p className="text-xs uppercase tracking-widest font-mono text-zinc-300 font-bold">
          {isAiSearching ? 'AI ĐANG QUÉT VÀ ĐỒNG BỘ LỜI KARAOKE...' : 'ĐANG NẠP LỜI BÀI HÁT...'}
        </p>
      </div>
    );
  }

  if (lyrics.length === 0 && !plainLyrics) {
    return (
      <div className={`flex flex-col items-center justify-center px-6 py-16 text-center gap-4 min-h-[300px] ${className}`}>
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Mic2 className="w-7 h-7 text-zinc-500 opacity-80" />
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-widest font-mono text-zinc-400 font-bold mb-1">
            CHƯA CÓ LỜI ĐỒNG BỘ
          </h4>
          <p className="text-[11px] font-mono text-zinc-600 max-w-xs">
            Bài hát này chưa có sẵn lời chạy theo nhịp. Bạn có thể kích hoạt AI để quét sâu và tự động phân bổ nhịp karaoke.
          </p>
        </div>
        <motion.button
          onClick={() => fetchLyrics(true)}
          {...buttonTapMotion}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>TÌM LỜI BẰNG AI</span>
        </motion.button>
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
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
            — LỜI BÀI HÁT VĂN BẢN —
          </span>
          <motion.button
            onClick={() => fetchLyrics(true)}
            {...subtleButtonTapMotion}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white text-zinc-300 hover:text-black border border-white/15 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>ĐỒNG BỘ AI</span>
          </motion.button>
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
      {/* Top Source Badge + AI Refresh Action */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 sticky top-0 bg-black/80 backdrop-blur-md z-10 -mt-6 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
            {sourceTag || 'REALTIME SYNCHRONIZED'}
          </span>
        </div>
        <motion.button
          onClick={() => fetchLyrics(true)}
          {...subtleButtonTapMotion}
          title="Tự động đồng bộ lại bằng AI"
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/20 text-zinc-400 hover:text-white border border-white/10 text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer"
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>AI SYNC</span>
        </motion.button>
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
            <span className={isActive ? 'pl-2' : 'pl-2'}>{line.text || '♪ ♪ ♪'}</span>
          </div>
        );
      })}
    </div>
  );
};
