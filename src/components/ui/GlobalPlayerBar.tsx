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
  Volume2,
  VolumeX,
  ListMusic,
  Disc3,
  Music,
  Mic2,
  Film,
  Sparkles,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex, extractVideoOffset } from '@/lib/lrcParser';
import { hasActiveSession } from '@/lib/authSession';

export default function GlobalPlayerBar() {
  const {
    currentTrack,
    currentAlbum,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffleMode,
    repeatMode,
    isCinematicFxEnabled,
    audioRef,
    analyserRef,
    kickAnalyserRef,
    snareAnalyserRef,
    kickTimestampsRef,
    snareTimestampsRef,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const [mounted, setMounted] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRootRef = useRef<HTMLDivElement | null>(null);
  const barContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeContainerRef = useRef<HTMLDivElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dedicated Kick Detection Refs for Player Bar
  const fireOverlayRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastKickTimeRef = useRef<number>(0);
  const lastSnareTimeRef = useRef<number>(0);
  const lastFiredKickIndexRef = useRef<number>(-1);
  const lastFiredSnareIndexRef = useRef<number>(-1);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Track Fullscreen state accurately
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFs);
      if (isFs) {
        setShowFullscreenControls(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reset fired indices on track change
  useEffect(() => {
    lastFiredKickIndexRef.current = -1;
    lastFiredSnareIndexRef.current = -1;
  }, [currentTrack?.id]);

  // Click outside playerRootRef to close drawers and volume popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (playerRootRef.current && !playerRootRef.current.contains(e.target as Node)) {
        setShowLyrics(false);
        setShowQueue(false);
        setShowVideo(false);
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleFullscreenActivity = () => {
    setShowFullscreenControls(true);
    if (fullscreenControlsTimerRef.current) {
      clearTimeout(fullscreenControlsTimerRef.current);
    }
    fullscreenControlsTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowFullscreenControls(false);
      }
    }, 3500);
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const el = videoContainerRef.current || videoRef.current;
    if (!el) return;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const videoOffset = useMemo(() => {
    return extractVideoOffset(currentTrack?.lyrics || '');
  }, [currentTrack?.lyrics]);

  const songDuration = useMemo(() => {
    return (currentTrack?.duration && currentTrack.duration > 0) ? currentTrack.duration : 180;
  }, [currentTrack?.duration]);

  const syncWindowStart = videoOffset;
  const syncWindowEnd = videoOffset + songDuration;

  // Master Play/Pause toggler that reliably controls both Video and Audio
  const handleTogglePlay = () => {
    if (showVideo && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      togglePlay();
    }
  };

  // Seamless Audio <-> Video playback handoff with accurate sync window
  useEffect(() => {
    const audio = audioRef?.current;
    const vid = videoRef.current;

    if (showVideo) {
      // Switching to Video Mode: calculate target video position with offset
      if (audio) {
        audio.pause();
        audio.muted = true;
      }
      if (vid) {
        vid.volume = volume;
        const targetVidTime = Math.max(0, currentTime + videoOffset);
        if (Math.abs(vid.currentTime - targetVidTime) > 0.5) {
          vid.currentTime = targetVidTime;
        }
        if (vid.duration > 0 && isFinite(vid.duration)) {
          setDuration(vid.duration);
        }
        if (isPlaying) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      }
    } else {
      // Switching back to Audio Mode: verify sync window
      if (vid) {
        const vidTime = vid.currentTime;
        vid.pause();
        if (audio) {
          audio.muted = false;
          if (vidTime < syncWindowStart) {
            // Before music starts (Intro): Audio starts at beginning
            audio.currentTime = 0;
            setCurrentTime(0);
          } else if (vidTime >= syncWindowStart && vidTime <= syncWindowEnd) {
            // Inside Sync Window: jump to mapped song time
            const mappedSongTime = vidTime - videoOffset;
            audio.currentTime = mappedSongTime;
            setCurrentTime(mappedSongTime);
          } else {
            // After music finished (Outro): Advance to next track
            nextTrack();
            return;
          }
          if (audio.duration > 0 && isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
          if (isPlaying) {
            audio.play().catch(() => {});
          }
        }
      } else if (audio) {
        audio.muted = false;
        if (isPlaying) {
          audio.play().catch(() => {});
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVideo, videoOffset, songDuration, volume, audioRef]);

  // Keep video volume in sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // Handle seek for both audio and video
  const handleSeek = (newTime: number) => {
    if (showVideo && videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    } else {
      seekTo(newTime);
    }
  };

  // Monochromatic White Lighting & Transient Tracking Refs
  const barFlashIntensityRef = useRef<number>(0);
  const barScaleRef = useRef<number>(1);
  const isHeavyKickRef = useRef<boolean>(false);
  const prevKickPunchRef = useRef<number>(0);
  const smoothedKickPunchRef = useRef<number>(0);
  const prevSnarePunchRef = useRef<number>(0);
  const smoothedSnarePunchRef = useRef<number>(0);

  // Real-Time Playbar Monochromatic Beat Engine:
  // - HEAVY KICK: Nảy cực mạnh (scale 1.055) + Chớp trắng sáng rực rỡ
  // - LIGHT KICK: Nảy nhẹ (scale 1.025) + Chớp trắng mờ tinh tế
  // - SNARE: Chỉ chớp trắng mờ (scale 1.0 không nảy)
  // - Album: 100% tĩnh
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (fireOverlayRef.current) fireOverlayRef.current.style.opacity = '0';
      if (barContainerRef.current) {
        barContainerRef.current.style.transform = 'scale(1)';
        barContainerRef.current.style.boxShadow = '';
        barContainerRef.current.style.borderColor = '';
      }
      return;
    }

    const analyzeFrame = () => {
      let isHeavyKick = false;
      let isLightKick = false;
      let isSnare = false;
      const now = performance.now();
      const liveCurrentTime = showVideo && videoRef.current
        ? Math.max(0, videoRef.current.currentTime - videoOffset)
        : (audioRef?.current ? audioRef.current.currentTime : currentTime);

      // =========================================================================
      // [1] EXACT ONE-SHOT PCM TIMESTAMPS MATCHING (MATHEMATICALLY ACCURATE)
      // =========================================================================
      const kickStamps = kickTimestampsRef?.current || [];
      const hasPCMBeatMap = kickStamps.length > 0;

      if (hasPCMBeatMap) {
        // Kick Detection from PCM
        for (let i = 0; i < kickStamps.length; i++) {
          const diff = liveCurrentTime - kickStamps[i];
          if (diff >= -0.022 && diff <= 0.035 && i !== lastFiredKickIndexRef.current) {
            lastFiredKickIndexRef.current = i;
            // Alternate heavy/light based on step or detect peak
            isHeavyKick = true;
            lastKickTimeRef.current = now;
            break;
          }
        }

        // Snare Detection from PCM
        const snareStamps = snareTimestampsRef?.current || [];
        if (!isHeavyKick) {
          for (let i = 0; i < snareStamps.length; i++) {
            const diff = liveCurrentTime - snareStamps[i];
            if (diff >= -0.022 && diff <= 0.035 && i !== lastFiredSnareIndexRef.current) {
              lastFiredSnareIndexRef.current = i;
              isSnare = true;
              lastSnareTimeRef.current = now;
              break;
            }
          }
        }
      } else {
        // =========================================================================
        // [2] DEDICATED 58Hz HARDWARE BIQUAD FILTER DETECTION (ZERO MASTER SPILL)
        // =========================================================================
        if (kickAnalyserRef?.current) {
          try {
            const arr = new Uint8Array(kickAnalyserRef.current.frequencyBinCount);
            kickAnalyserRef.current.getByteFrequencyData(arr);
            const kickSub = (arr[0] + arr[1] + arr[2]) / 3;

            const deltaKick = Math.max(0, kickSub - prevKickPunchRef.current);
            prevKickPunchRef.current = kickSub;
            smoothedKickPunchRef.current = smoothedKickPunchRef.current * 0.80 + deltaKick * 0.20;
            const kickThreshold = Math.max(9.0, smoothedKickPunchRef.current * 1.45);

            if (deltaKick > kickThreshold && kickSub > 32 && (now - lastKickTimeRef.current > 150)) {
              if (kickSub > 70 || deltaKick > 22) {
                isHeavyKick = true;
              } else {
                isLightKick = true;
              }
              lastKickTimeRef.current = now;
            }
          } catch {}
        }

        // Dedicated 350Hz Snare Filter
        if (!isHeavyKick && !isLightKick && snareAnalyserRef?.current) {
          try {
            const arr = new Uint8Array(snareAnalyserRef.current.frequencyBinCount);
            snareAnalyserRef.current.getByteFrequencyData(arr);
            const snareMid = (arr[1] + arr[2] + arr[3]) / 3;

            const deltaSnare = Math.max(0, snareMid - prevSnarePunchRef.current);
            prevSnarePunchRef.current = snareMid;
            smoothedSnarePunchRef.current = smoothedSnarePunchRef.current * 0.80 + deltaSnare * 0.20;
            const snareThreshold = Math.max(10.0, smoothedSnarePunchRef.current * 1.5);

            if (deltaSnare > snareThreshold && snareMid > 35 && (now - lastSnareTimeRef.current > 170)) {
              isSnare = true;
              lastSnareTimeRef.current = now;
            }
          } catch {}
        }
      }

      // =========================================================================
      // [3] APPLY CLEAN MONOCHROME WHITE LIGHTING (LIGHT KICK vs HEAVY KICK)
      // =========================================================================
      if (isHeavyKick) {
        // HEAVY KICK: NẢY CỰC MẠNH + TRẮNG SÁNG RỰC RỠ
        isHeavyKickRef.current = true;
        barScaleRef.current = 1.055;
        barFlashIntensityRef.current = 1.0;

        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.70))';
        }
      } else if (isLightKick) {
        // LIGHT KICK: NẢY VỪA + TRẮNG MỜ TINH TẾ
        isHeavyKickRef.current = false;
        barScaleRef.current = 1.026;
        barFlashIntensityRef.current = 0.55;

        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))';
        }
      } else if (isSnare) {
        // SNARE: CHỈ CHỚP TRẮNG MỜ (KHÔNG NẢY)
        isHeavyKickRef.current = false;
        barFlashIntensityRef.current = 0.45;

        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.15))';
        }
      } else {
        // Smooth and punchy fast decay
        barFlashIntensityRef.current *= 0.65;
        barScaleRef.current = barScaleRef.current + (1.0 - barScaleRef.current) * 0.35;
      }

      if (barFlashIntensityRef.current < 0.01) barFlashIntensityRef.current = 0;
      if (Math.abs(barScaleRef.current - 1.0) < 0.001) barScaleRef.current = 1.0;

      // Update Playbar styling
      if (barContainerRef.current) {
        const scaleVal = showLyrics ? 1.0 : barScaleRef.current;
        barContainerRef.current.style.transform = `scale(${scaleVal.toFixed(4)})`;

        if (barFlashIntensityRef.current > 0.06) {
          const alpha = barFlashIntensityRef.current;
          const isHeavy = isHeavyKickRef.current;

          if (isHeavy) {
            barContainerRef.current.style.boxShadow = `0 16px 45px rgba(255, 255, 255, ${(alpha * 0.45).toFixed(2)}), inset 0 0 25px rgba(255, 255, 255, ${(alpha * 0.30).toFixed(2)})`;
            barContainerRef.current.style.borderColor = `rgba(255, 255, 255, ${(alpha * 0.85).toFixed(2)})`;
          } else {
            barContainerRef.current.style.boxShadow = `0 10px 30px rgba(255, 255, 255, ${(alpha * 0.22).toFixed(2)}), inset 0 0 15px rgba(255, 255, 255, ${(alpha * 0.12).toFixed(2)})`;
            barContainerRef.current.style.borderColor = `rgba(255, 255, 255, ${(alpha * 0.45).toFixed(2)})`;
          }
        } else {
          barContainerRef.current.style.boxShadow = '';
          barContainerRef.current.style.borderColor = '';
        }

        if (fireOverlayRef.current) {
          fireOverlayRef.current.style.opacity = barFlashIntensityRef.current.toFixed(3);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(analyzeFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(analyzeFrame);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, showVideo, showLyrics, kickAnalyserRef, snareAnalyserRef, kickTimestampsRef, snareTimestampsRef, currentTime, audioRef, videoOffset]);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    return parseLrc(currentTrack.lyrics);
  }, [currentTrack?.lyrics]);

  const activeLyricIdx = useMemo(() => {
    if (!parsedLyrics || parsedLyrics.length === 0) return -1;
    if (showVideo) {
      // Sync Window Gating: If video is in intro or outro outside the song, do not display out-of-sync lyrics
      if (currentTime < syncWindowStart || currentTime > syncWindowEnd) {
        return -1;
      }
      const effectiveSongTime = currentTime - videoOffset;
      return getActiveLyricIndex(parsedLyrics, effectiveSongTime);
    }
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime, showVideo, videoOffset, syncWindowStart, syncWindowEnd]);

  // Auto-scroll active lyric line in lyrics stage
  useEffect(() => {
    if (showLyrics && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIdx, showLyrics]);

  // Volume hover UX handlers with continuous bridge
  const handleVolumeMouseEnter = () => {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    setShowVolumeSlider(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 450);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextTrack();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevTrack();
      } else if (key === 'l') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
        setShowQueue(false);
        setShowVideo(false);
      } else if (key === 'q') {
        e.preventDefault();
        setShowQueue((prev) => !prev);
        setShowLyrics(false);
        setShowVideo(false);
      } else if (key === 's') {
        e.preventDefault();
        toggleShuffle();
      } else if (key === 'r') {
        e.preventDefault();
        toggleRepeat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, nextTrack, prevTrack, toggleShuffle, toggleRepeat]);

  if (!mounted || !currentTrack || !isAuth) return null;

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const hasDrawerOpen = showVideo || showLyrics || showQueue;

  const renderDrawerContent = () => (
    <>
      {/* 1. DIRECT SUPABASE NATIVE VIDEO PLAYER (MV STAGE) */}
      {showVideo && currentTrack?.video_url && (
        <div className="w-full flex-1 flex flex-col justify-between text-white font-mono min-h-0 relative">
          <div
            ref={videoContainerRef}
            onMouseMove={handleFullscreenActivity}
            onTouchStart={handleFullscreenActivity}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="flex-1 rounded-2xl overflow-hidden border border-white/20 relative bg-black flex items-center justify-center shadow-2xl z-30 select-none pointer-events-auto min-h-[220px] sm:min-h-[300px] group/video"
          >
            {/* HIDDEN MUSIC Watermark */}
            <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-40 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-white/20 text-white shadow-2xl select-none pointer-events-none">
              <Disc3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white animate-spin-slow" />
              <span className="font-cyber font-extrabold text-[10px] sm:text-[11px] tracking-wider text-white">HIDDEN MUSIC</span>
            </div>

            {/* Central Play/Pause Watermark Button for Double Tap/Click */}
            {(!isPlaying || (isFullscreen && showFullscreenControls)) && (
              <div
                onClick={handleTogglePlay}
                className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 cursor-pointer pointer-events-auto transition-opacity"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/80 border border-white/50 backdrop-blur-md flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-110 active:scale-95">
                  {isPlaying ? (
                    <Pause className="w-5 h-5 sm:w-7 sm:h-7 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 sm:w-7 sm:h-7 fill-current ml-0.5 sm:ml-1" />
                  )}
                </div>
              </div>
            )}

            {/* Fullscreen Trigger / Exit Button */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ video' : 'Toàn màn hình'}
              className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-40 p-2 rounded-xl bg-black/80 hover:bg-white hover:text-black border border-white/20 text-white shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-[10px] font-bold font-mono"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}</span>
            </button>

            {/* Subtitle Overlay with Live Beat Sync */}
            {parsedLyrics.length > 0 && activeLyricIdx >= 0 && parsedLyrics[activeLyricIdx]?.text && (
              <div className={`absolute ${isFullscreen ? 'bottom-16 sm:bottom-20' : 'bottom-3 sm:bottom-6'} left-2 right-2 sm:left-4 sm:right-4 z-40 flex justify-center pointer-events-none select-none transition-all duration-150`}>
                <div className="bg-black/90 backdrop-blur-md px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-xl border border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.95)] max-w-2xl text-center">
                  <p className="text-white font-cyber font-bold text-xs sm:text-base md:text-lg leading-relaxed tracking-wide">
                    {parsedLyrics[activeLyricIdx].text}
                  </p>
                </div>
              </div>
            )}

            {/* FULLSCREEN HUD TIMELINE & CONTROLS BAR (SHOWN IN FULLSCREEN) */}
            {isFullscreen && showFullscreenControls && (
              <div className="absolute bottom-0 left-0 right-0 z-50 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-2 transition-opacity animate-fadeIn">
                {/* Timeline Scrubber */}
                <div className="flex items-center gap-2.5 w-full">
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-300 flex-shrink-0">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={effectiveDuration || 100}
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer border border-white/20 bg-slate-800 shadow-inner"
                  />
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 flex-shrink-0">
                    {formatTime(effectiveDuration)}
                  </span>
                </div>

                {/* Bottom Fullscreen Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-cyber font-bold truncate max-w-xs uppercase">
                    {currentTrack.title} <span className="text-slate-400 text-[9px] font-mono">({currentAlbum?.artist})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={prevTrack} className="p-1.5 text-slate-300 hover:text-white" title="Bài trước">
                      <SkipBack className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      onClick={handleTogglePlay}
                      className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <button onClick={nextTrack} className="p-1.5 text-slate-300 hover:text-white" title="Bài kế tiếp">
                      <SkipForward className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Direct HTML5 Video Player */}
            <video
              ref={videoRef}
              src={currentTrack.video_url}
              playsInline
              preload="auto"
              onClick={handleTogglePlay}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFullscreen();
              }}
              onLoadedMetadata={(e) => {
                const targetVidTime = Math.max(0, currentTime + videoOffset);
                if (targetVidTime > 0) {
                  e.currentTarget.currentTime = targetVidTime;
                }
                if (isPlaying) {
                  e.currentTarget.play().catch(() => {});
                }
              }}
              onTimeUpdate={(e) => {
                if (showVideo) {
                  const rawVidTime = e.currentTarget.currentTime;
                  const effectiveSongTime = Math.max(0, rawVidTime - videoOffset);
                  setCurrentTime(effectiveSongTime);
                }
              }}
              onPlay={() => {
                if (showVideo) setIsPlaying(true);
              }}
              onPause={() => {
                if (showVideo) setIsPlaying(false);
              }}
              onEnded={nextTrack}
              className="w-full h-full object-contain select-none cursor-pointer relative z-10"
            />
          </div>
        </div>
      )}

      {/* 2. GOTHIC LYRICS PANEL */}
      {showLyrics && (
        <div className="w-full flex-1 flex flex-col justify-between text-white font-sans min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto no-scrollbar my-auto px-2 py-4 sm:py-8 space-y-3 sm:space-y-4 text-center scroll-smooth relative z-10" style={{ WebkitOverflowScrolling: 'touch' }}>
            {parsedLyrics.length > 0 ? (
              parsedLyrics.map((line, idx) => {
                const isActive = idx === activeLyricIdx;
                return (
                  <div
                    key={`${line.time}_${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => handleSeek(line.time)}
                    className={`cursor-pointer transition-all duration-300 py-1 px-2 sm:px-4 ${
                      isActive
                        ? 'scale-105 opacity-100'
                        : 'opacity-35 hover:opacity-75'
                    }`}
                  >
                    <p
                      className={`transition-all duration-200 ${
                        isActive
                          ? 'text-white font-extrabold text-sm sm:text-lg md:text-xl tracking-wide font-cyber'
                          : 'text-zinc-400 font-medium text-xs sm:text-sm font-sans'
                      }`}
                    >
                      {line.text}
                    </p>
                  </div>
                );
              })
            ) : currentTrack.lyrics ? (
              <div className="whitespace-pre-wrap text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans text-center px-2 sm:px-4 py-4 sm:py-6">
                {currentTrack.lyrics}
              </div>
            ) : (
              <div className="text-center py-10 sm:py-16 text-zinc-500 text-xs tracking-widest flex flex-col items-center gap-2 font-mono">
                <Mic2 className="w-5 h-5 sm:w-7 sm:h-7 text-zinc-600 mb-1" />
                <span>CHƯA CÓ LỜI BÀI HÁT CHO TÁC PHẨM NÀY</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. QUEUE LIST PANEL */}
      {showQueue && (
        <div className="w-full flex-1 flex flex-col justify-between text-white font-mono text-xs min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 sm:space-y-1.5 pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {playlist.map((trk, i) => {
              const isCurrent = currentTrack?.id === trk.id;
              return (
                <div
                  key={`${trk.id}_${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(trk, currentAlbum, playlist);
                  }}
                  className={`p-2 sm:p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                    isCurrent
                      ? 'bg-white text-black font-extrabold border-white shadow-lg'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="text-[10px] opacity-60 w-4 font-mono">{i + 1}.</span>
                    <span className="truncate text-xs font-semibold">{trk.title}</span>
                  </div>
                  {trk.video_url ? (
                    <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-white/15 text-white border border-white/30 font-mono font-bold">
                      MV
                    </span>
                  ) : (
                    <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                      AUDIO
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      ref={playerRootRef}
      className="fixed bottom-2.5 sm:bottom-4 md:bottom-12 left-0 right-0 z-[60] px-2 sm:px-4 pointer-events-auto select-none flex flex-col items-center overflow-visible"
    >
      {/* UNIFIED ATTACHED UPWARD DRAWER (MODERATE HEIGHT ON BOTH MOBILE & DESKTOP) */}
      {hasDrawerOpen && (
        <div className="w-full max-w-5xl md:max-w-6xl mx-auto mb-2 sm:mb-3 rounded-2xl sm:rounded-3xl border border-white/20 bg-[#0c0c10]/95 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden p-3 sm:p-4 flex flex-col h-[280px] xs:h-[320px] sm:h-[360px] md:h-[420px] max-h-[50vh] animate-slideUp flex-shrink-0">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              {showLyrics && <Mic2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
              {showQueue && <Disc3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-spin-slow" />}
              {showVideo && <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
              <span className="font-cyber font-bold text-xs uppercase tracking-wider text-white">
                {showLyrics ? 'LỜI BÀI HÁT (LYRICS)' : showQueue ? `DANH SÁCH PHÁT (${playlist.length})` : 'VIDEO ÂM NHẠC (MV)'}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLyrics(false);
                setShowQueue(false);
                setShowVideo(false);
              }}
              className="p-1 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drawer Body */}
          {renderDrawerContent()}
        </div>
      )}

      {/* 100% UNIFIED CONTINUOUS MONOLITHIC CARD */}
      <div
        ref={barContainerRef}
        className="w-full max-w-5xl md:max-w-6xl mx-auto dynamic-music-bar text-white transform-gpu relative shadow-2xl transition-all duration-300 overflow-visible rounded-2xl sm:rounded-[32px]"
      >
        {/* High-Energy Kick Flash Gradient Overlay */}
        <div ref={fireOverlayRef} className="fire-flash-overlay opacity-0 rounded-[inherit]" />

        {/* ============================================================= */}
        {/* MOBILE CONTROL BAR LAYOUT (< md: 2-Row Optimized Structure) */}
        {/* ============================================================= */}
        <div className="md:hidden w-full p-2 px-2.5 sm:px-3.5 transition-all duration-300 flex flex-col gap-1.5 relative z-50 select-none overflow-visible bg-transparent">
          {/* Mobile Row 1: Track Metadata & Controls */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
            {/* Left: Cover & Info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden border border-white/20 flex-shrink-0 bg-slate-900 shadow-md">
                <img
                  src={currentAlbum?.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                  alt={currentTrack.title}
                  className={`w-full h-full object-cover ${(isPlaying || showVideo) ? 'animate-spin-slow' : ''}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate">
                  <h4 className="text-[11px] sm:text-xs font-extrabold text-white truncate font-cyber uppercase tracking-wide">
                    {currentTrack.title}
                  </h4>
                  {currentTrack.video_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVideo((prev) => !prev);
                        if (!showVideo) {
                          setShowLyrics(false);
                          setShowQueue(false);
                        }
                      }}
                      className={`text-[8px] uppercase px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5 flex-shrink-0 transition-all ${
                        showVideo
                          ? 'bg-white text-black border border-white font-black scale-105'
                          : 'bg-white/10 text-slate-300 border border-white/20'
                      }`}
                    >
                      <Film className="w-2 h-2" /> MV
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 truncate uppercase font-mono">
                  {currentAlbum?.artist || 'VAULT ARTIST'}
                </p>
              </div>
            </div>

            {/* Right: Touch-Friendly Quick Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Lyrics Button */}
              {!showVideo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLyrics(!showLyrics);
                    setShowQueue(false);
                  }}
                  className={`p-1.5 rounded-full border transition-all ${
                    showLyrics
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/10 text-slate-300 border-white/20'
                  }`}
                  title="Lyrics"
                >
                  <Mic2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Prev Button */}
              <button
                onClick={prevTrack}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Bài trước"
              >
                <SkipBack className="w-3.5 h-3.5 fill-current" />
              </button>

              {/* Big Play Button */}
              <button
                onClick={handleTogglePlay}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform flex-shrink-0"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Next Button */}
              <button
                onClick={nextTrack}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Bài kế tiếp"
              >
                <SkipForward className="w-3.5 h-3.5 fill-current" />
              </button>

              {/* Queue Button */}
              {!showVideo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQueue(!showQueue);
                    setShowLyrics(false);
                  }}
                  className={`p-1.5 rounded-full border transition-all ${
                    showQueue
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/10 text-slate-300 border-white/20'
                  }`}
                  title="Queue"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Volume Button on Mobile: MUTE / UNMUTE TOGGLE ONLY */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVolume((prev) => (prev === 0 ? 0.8 : 0));
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title={volume === 0 ? 'Bật âm thanh' : 'Tắt tiếng (Mute)'}
              >
                {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>
          </div>

          {/* Mobile Row 2: Full-Width Clean Timeline */}
          <div className="flex items-center gap-2 w-full px-0.5">
            <span className="text-[9px] font-bold font-mono text-slate-300 flex-shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={effectiveDuration || 100}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer border border-white/20 bg-slate-800 shadow-inner"
              />
            </div>
            <span className="text-[9px] font-bold font-mono text-slate-400 flex-shrink-0">
              {formatTime(effectiveDuration)}
            </span>
          </div>
        </div>

        {/* ============================================================= */}
        {/* DESKTOP CONTROL BAR LAYOUT (>= md: 1-Row Standard Design) */}
        {/* ============================================================= */}
        <div className="hidden md:flex w-full p-3.5 transition-all duration-300 items-center justify-between gap-4 relative z-50 select-none overflow-visible bg-transparent">
          {/* Left Column: Track / Video Details */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0 max-w-[260px]">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/20 flex-shrink-0 bg-slate-900 shadow-md">
              <img
                src={currentAlbum?.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                alt={currentTrack.title}
                className={`w-full h-full object-cover ${(isPlaying || showVideo) ? 'animate-spin-slow' : ''}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <h4 className="text-[11px] font-extrabold text-white truncate uppercase tracking-wider font-cyber">
                  {currentTrack.title}
                </h4>
                {currentTrack.video_url ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVideo((prev) => !prev);
                      if (!showVideo) {
                        setShowLyrics(false);
                        setShowQueue(false);
                      }
                    }}
                    className={`text-[8px] uppercase px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 cursor-pointer transition-all ${
                      showVideo
                        ? 'bg-white text-black border border-white shadow-lg scale-105'
                        : 'bg-white/10 text-slate-300 border border-white/20 hover:bg-white/20 hover:text-white'
                    }`}
                    title={showVideo ? 'Hạ MV xuống' : 'Mở MV'}
                  >
                    <Film className="w-2.5 h-2.5" /> MV
                  </button>
                ) : (
                  <span className="text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold bg-white/10 text-white border border-white/20 flex items-center gap-0.5 flex-shrink-0">
                    <Music className="w-2.5 h-2.5" /> AUDIO
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 truncate uppercase font-mono">
                {currentAlbum?.artist || 'VAULT ARTIST'}
              </p>
            </div>
          </div>

          {/* Center Column: TIME SCRUBBER WITH CIRCULAR IVORY THUMB */}
          <div className="flex-1 flex items-center gap-3.5 px-6 min-w-0">
            <span className="text-[11px] font-bold font-mono flex-shrink-0 text-slate-300">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={effectiveDuration || 100}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full h-2.5 rounded-full appearance-none cursor-pointer border border-white/20 bg-slate-800 shadow-inner hover:bg-slate-700 transition-all"
              />
            </div>
            <span className="text-[11px] font-bold font-mono flex-shrink-0 text-slate-400">
              {formatTime(effectiveDuration)}
            </span>
          </div>

          {/* Right Column: PLAYBACK & ACTION CONTROLS */}
          <div className="flex items-center justify-end gap-2 flex-shrink-0 overflow-visible">
            {/* LYRICS BUTTON */}
            {!showVideo && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLyrics(!showLyrics);
                  setShowQueue(false);
                }}
                className={`px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 text-[10px] font-bold ${
                  showLyrics
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20 hover:text-white'
                }`}
                title="Lời bài hát (Gothic Lyrics)"
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">LYRICS</span>
              </button>
            )}

            <button
              onClick={toggleShuffle}
              title={shuffleMode ? 'Shuffle: ON' : 'Shuffle: OFF'}
              className={`p-1.5 transition-colors ${
                shuffleMode ? 'text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={prevTrack}
              className="transition-colors p-1 text-slate-400 hover:text-white"
              title="Bài trước"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={handleTogglePlay}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform flex-shrink-0"
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="transition-colors p-1 text-slate-400 hover:text-white"
              title="Bài kế tiếp"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              title={`Loop: ${repeatMode.toUpperCase()}`}
              className={`p-1.5 transition-colors ${
                repeatMode !== 'off' ? 'text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
            </button>

            {/* QUEUE BUTTON */}
            {!showVideo && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQueue(!showQueue);
                  setShowLyrics(false);
                }}
                className={`px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 text-[10px] font-bold ${
                  showQueue
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20 hover:text-white'
                }`}
                title="Hàng chờ"
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">QUEUE</span>
              </button>
            )}

            {/* SPEAKER WITH ZERO-GAP HOVER & ABSOLUTE TOP Z-INDEX POPUP */}
            <div
              ref={volumeContainerRef}
              className="relative flex items-center justify-center ml-1 z-[100]"
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
            >
              <button
                onClick={() => setShowVolumeSlider((prev) => !prev)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title="Điều chỉnh âm lượng"
              >
                {volume === 0 ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>

              {/* Popover Volume Slider */}
              {showVolumeSlider && (
                <div
                  className="absolute bottom-full pb-3 left-1/2 -translate-x-1/2 z-[999999] pointer-events-auto"
                  onMouseEnter={handleVolumeMouseEnter}
                  onMouseLeave={handleVolumeMouseLeave}
                >
                  <div
                    className="p-3 border border-white/25 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.98)] flex flex-col items-center gap-2 animate-fadeIn min-w-[50px]"
                    style={{
                      background: 'rgba(12, 12, 16, 0.98)',
                      backdropFilter: 'blur(28px)',
                    }}
                  >
                    <span className="text-[10px] font-mono text-white font-extrabold">{Math.round(volume * 100)}%</span>
                    <div className="h-24 flex items-center py-1">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="h-20 w-2 bg-slate-800 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
