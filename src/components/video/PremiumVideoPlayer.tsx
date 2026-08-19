'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  SkipForward,
  SkipBack,
  RotateCcw,
  Sparkles,
  Disc3,
  X,
  Settings,
  ShieldCheck,
  Check,
  Flame,
} from 'lucide-react';
import { TrackItem, Album } from '@/types/database';
import { getMediaCdnUrl } from '@/lib/r2Storage';
import { usePlayer } from '@/context/PlayerContext';
import PaywallOverlay from './PaywallOverlay';

interface PremiumVideoPlayerProps {
  track: TrackItem;
  album?: Album | null;
  onClose?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  isLocked?: boolean;
  onUpgrade?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function PremiumVideoPlayer({
  track,
  album,
  onClose,
  onNext,
  onPrev,
  isLocked = false,
  onUpgrade,
}: PremiumVideoPlayerProps) {
  const {
    isPremium,
    openPaywall,
    handleUpgrade,
    videoRef: contextVideoRef,
  } = usePlayer();

  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = contextVideoRef || internalVideoRef;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPiPActive, setIsPiPActive] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);

  // Resolve direct CDN stream URL
  const videoStreamUrl = useMemo(() => {
    const rawUrl = track.video_url || track.audio_url || '';
    if (!rawUrl) return '';
    return getMediaCdnUrl(rawUrl);
  }, [track]);

  const userCanWatch = isPremium || !isLocked;

  // Format MM:SS
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Auto-hide controls logic
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSpeedMenu && !isDraggingSeekerRef.current) {
          setShowControls(false);
        }
      }, 3500);
    }
  }, [isPlaying, showSpeedMenu]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current || !userCanWatch) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [videoRef, userCanWatch]);

  // Fullscreen Handler
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen toggle notice:', err);
    }
  }, []);

  // Standard Web Picture-in-Picture
  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn('PiP notice:', err);
    }
  }, [videoRef]);

  // Volume & Mute control
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  // Speed selector
  const handleSpeedSelect = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  // Timeline Seeker
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    setHoverPosition(clampedPos * 100);
    setHoverTime(clampedPos * duration);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
  };

  // Keyboard controls (Space, Esc, F, M, ArrowLeft, ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePiP();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, togglePiP, duration, videoRef]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className="relative w-full h-full min-h-[380px] bg-black rounded-2xl overflow-hidden border border-white/15 select-none shadow-2xl flex flex-col justify-between group"
    >
      {/* Paywall Overlay if locked */}
      {!userCanWatch && (
        <PaywallOverlay
          title={track.title}
          artist={track.artist || album?.artist}
          onUpgrade={() => {
            if (onUpgrade) onUpgrade();
            else openPaywall();
          }}
        />
      )}

      {/* HTML5 Native Video Stream Element */}
      <div
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className="relative flex-1 w-full h-full flex items-center justify-center cursor-pointer bg-black overflow-hidden"
      >
        <video
          ref={videoRef}
          src={userCanWatch ? videoStreamUrl : undefined}
          preload="auto"
          autoPlay={true}
          playsInline={true}
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onTimeUpdate={() => {
            if (videoRef.current && !isDraggingSeekerRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              videoRef.current.volume = volume;
              videoRef.current.muted = isMuted;
              if (userCanWatch) {
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
              }
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (onNext) onNext();
          }}
          className="w-full h-full object-contain pointer-events-auto"
        />

        {/* Buffering Spinner */}
        {isBuffering && userCanWatch && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <Disc3 className="w-12 h-12 text-white animate-spin text-opacity-80" />
          </div>
        )}

        {/* Center Play/Pause Flash Animation */}
        <div
          className={`absolute w-20 h-20 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center transition-all duration-300 pointer-events-none ${
            !isPlaying && !isBuffering ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        >
          <Play className="w-9 h-9 text-white fill-white ml-1" />
        </div>
      </div>

      {/* Top Glass Control Bar */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex items-center justify-between ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-[10px] font-mono text-zinc-300 flex items-center gap-1.5 backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            <span className="font-bold tracking-widest uppercase">4K ULTRA HD</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider line-clamp-1 font-cyber">
              {track.title}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
              {track.artist || album?.artist || 'POSTLAIN VAULT'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Picture in Picture Button */}
          <button
            onClick={togglePiP}
            title="Picture-in-Picture (P)"
            className="p-2 rounded-xl bg-black/50 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 backdrop-blur-md"
          >
            <PictureInPicture2 className="w-4 h-4" />
          </button>

          {/* Close Video Button */}
          {onClose && (
            <button
              onClick={onClose}
              title="Close Video"
              className="p-2 rounded-xl bg-black/50 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 backdrop-blur-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Glass Control Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-3 sm:p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 flex flex-col gap-2.5 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Scrubber Bar */}
        <div
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
          className="relative w-full h-4 flex items-center cursor-pointer group/timeline"
        >
          {/* Hover Timecode Tooltip */}
          {hoverTime !== null && (
            <div
              style={{ left: `${hoverPosition}%` }}
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-white/20 text-[10px] font-mono text-white pointer-events-none shadow-lg whitespace-nowrap"
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Background Track */}
          <div className="w-full h-1.5 group-hover/timeline:h-2.5 bg-white/20 rounded-full overflow-hidden relative transition-all duration-150">
            {/* Progress Fill */}
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full bg-white transition-all duration-75 relative"
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] opacity-0 group-hover/timeline:opacity-100" />
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => (isDraggingSeekerRef.current = true)}
            onMouseUp={() => (isDraggingSeekerRef.current = false)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Buttons and Sliders Row */}
        <div className="flex items-center justify-between text-white">
          {/* Left Controls (Prev, Play, Next, Timecode) */}
          <div className="flex items-center gap-2 sm:gap-4">
            {onPrev && (
              <button
                onClick={onPrev}
                title="Previous MV"
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-all active:scale-95"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="p-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.2)] flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
            </button>

            {onNext && (
              <button
                onClick={onNext}
                title="Next MV"
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-all active:scale-95"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}

            {/* Timecode */}
            <div className="text-[11px] sm:text-xs font-mono text-zinc-300 tracking-wider">
              <span className="text-white font-bold">{formatTime(currentTime)}</span>
              <span className="mx-1 text-zinc-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls (Volume, Speed, Fullscreen) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                title="Mute (M)"
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-all active:scale-95"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-20 h-1 bg-white/20 accent-white rounded-full cursor-pointer hidden sm:block"
              />
            </div>

            {/* Speed Selector Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu((prev) => !prev)}
                title="Playback Speed"
                className="px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs font-mono text-zinc-300 hover:text-white transition-all flex items-center gap-1"
              >
                <span>{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 p-1 rounded-xl bg-zinc-950 border border-white/20 shadow-2xl backdrop-blur-xl flex flex-col gap-0.5 z-50 min-w-[90px]">
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedSelect(rate)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-mono text-left flex items-center justify-between transition-colors ${
                        playbackRate === rate ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <Check className="w-3 h-3 text-black" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title="Fullscreen (F)"
              className="p-2 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-all active:scale-95"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
