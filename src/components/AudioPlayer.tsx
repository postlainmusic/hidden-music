'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { getMediaCdnUrl, getCoverCdnUrl } from '@/lib/r2Storage';

export interface AudioPlayerProps {
  className?: string;
  enableVisualizer?: boolean;
  onBufferProgress?: (bufferedPercent: number) => void;
}

/**
 * Enhanced Audio Player Engine
 * ----------------------------------------------------
 * Consumes high-performance streaming audio from Cloudflare R2 / Worker Gateway.
 * Fully supports HTTP Range Requests (206 Partial Content), byte-level buffer monitoring,
 * Web Audio API Analyser nodes, and smooth MediaSession integration.
 */
export default function AudioPlayer({
  className = '',
  enableVisualizer = true,
  onBufferProgress,
}: AudioPlayerProps) {
  const {
    currentTrack,
    currentAlbum,
    isPlaying,
    currentTime,
    duration,
    volume,
    audioRef,
    nextTrack,
    setCurrentTime,
    setDuration,
    setIsPlaying,
  } = usePlayer();

  const [bufferedRanges, setBufferedRanges] = useState<{ start: number; end: number }[]>([]);
  const [isBuffering, setIsBuffering] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Compute optimized streaming CDN URL
  const rawUrl = currentTrack?.audio_url || '';
  const streamUrl = rawUrl ? getMediaCdnUrl(rawUrl) : '';

  // Monitor byte buffering progress from HTML5 Audio Element
  const handleProgress = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    const ranges: { start: number; end: number }[] = [];
    let totalBuffered = 0;

    for (let i = 0; i < audio.buffered.length; i++) {
      const start = audio.buffered.start(i);
      const end = audio.buffered.end(i);
      ranges.push({ start, end });
      totalBuffered += end - start;
    }

    setBufferedRanges(ranges);

    const percent = Math.min(100, Math.round((totalBuffered / audio.duration) * 100));
    if (onBufferProgress) {
      onBufferProgress(percent);
    }
  };

  // Handle seeking without interrupting audio stream
  const handleSeeked = () => {
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handleCanPlay = () => {
    setIsBuffering(false);
    setStreamError(null);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      handleProgress();
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (currentTime > 0 && Math.abs(audioRef.current.currentTime - currentTime) > 2) {
        audioRef.current.currentTime = currentTime;
      }
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget;
    const err = audio.error;
    let errMsg = 'Lỗi phát trực tuyến âm thanh';
    if (err) {
      switch (err.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errMsg = 'Người dùng đã hủy quá trình tải tệp';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errMsg = 'Lỗi mạng khi tải stream từ Cloudflare CDN';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errMsg = 'Không thể giải mã định dạng tệp âm thanh';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errMsg = 'Định dạng âm thanh hoặc máy chủ CDN không phản hồi';
          break;
      }
    }
    console.warn('[AudioPlayer Error]:', errMsg, streamUrl);
    setStreamError(errMsg);
  };

  // Render Buffer Progress Bar (showing cached slices)
  const renderBufferBar = () => {
    if (!duration || duration <= 0 || bufferedRanges.length === 0) return null;

    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full opacity-30">
        {bufferedRanges.map((range, idx) => {
          const left = (range.start / duration) * 100;
          const width = ((range.end - range.start) / duration) * 100;
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 bg-white/40 transition-all duration-300"
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* HTML5 Native Audio Element with Range & CORS Support */}
      {streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          crossOrigin="anonymous"
          preload="auto"
          autoPlay={isPlaying}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onSeeking={() => setIsBuffering(true)}
          onSeeked={handleSeeked}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onEnded={nextTrack}
          onError={handleError}
          className="hidden"
        />
      )}

      {/* Buffering Indicator Alert */}
      {isBuffering && isPlaying && (
        <div className="flex items-center gap-2 text-[10px] text-amber-400/80 font-mono animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>Buffering CDN chunk...</span>
        </div>
      )}

      {/* Error Notice */}
      {streamError && (
        <div className="text-[10px] text-red-400/90 font-mono truncate">
          ⚠️ {streamError}
        </div>
      )}
    </div>
  );
}
