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
  Sparkles
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '@/lib/lrcParser';

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
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const [mounted, setMounted] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeContainerRef = useRef<HTMLDivElement | null>(null);

  // Separate Kick & Snare Beat Detection & Animation Refs
  const fireOverlayRef = useRef<HTMLDivElement | null>(null);
  const snareOverlayRef = useRef<HTMLDivElement | null>(null);
  const lyricsFireOverlayRef = useRef<HTMLDivElement | null>(null);
  const lyricsSnareOverlayRef = useRef<HTMLDivElement | null>(null);

  const animFrameIdRef = useRef<number | null>(null);
  const lastKickTimeRef = useRef<number>(0);
  const lastSnareTimeRef = useRef<number>(0);
  const lastFiredKickIndexRef = useRef<number>(-1);
  const lastFiredSnareIndexRef = useRef<number>(-1);

  const prevKickPunchRef = useRef<number>(0);
  const smoothedKickPunchRef = useRef<number>(0);

  const fireIntensityRef = useRef<number>(0);
  const snareIntensityRef = useRef<number>(0);
  const currentScaleRef = useRef<number>(1);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Click outside to close drawers and volume popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (barContainerRef.current && !barContainerRef.current.contains(e.target as Node)) {
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

  // Sync Audio <-> Video playback
  useEffect(() => {
    const audio = audioRef?.current;
    const vid = videoRef.current;

    if (showVideo) {
      if (audio) {
        audio.pause();
        audio.muted = true;
      }
      if (vid && currentTrack?.video_url) {
        if (vid.src !== currentTrack.video_url) {
          vid.src = currentTrack.video_url;
          vid.load();
        }
        vid.volume = volume;
        vid.currentTime = currentTime;
        if (isPlaying) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      }
    } else {
      if (vid) {
        vid.pause();
      }
      if (audio) {
        audio.muted = false;
        if (isPlaying) {
          audio.play().catch(() => {});
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVideo, currentTrack?.video_url, isPlaying]);

  // Keep video volume in sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // Seek video when user drags seekbar
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !showVideo) return;
    if (Math.abs(vid.currentTime - currentTime) > 1.5) {
      vid.currentTime = currentTime;
    }
  }, [currentTime, showVideo]);

  // Real-Time 58Hz Sub-Punch Kick & 280Hz Snare Distinct One-Shot Edge Beat Detection
  useEffect(() => {
    // Stop ALL beat effects when Video Stage is open or not playing
    if (!isPlaying || showVideo) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (fireOverlayRef.current) fireOverlayRef.current.style.opacity = '0';
      if (snareOverlayRef.current) snareOverlayRef.current.style.opacity = '0';
      if (barContainerRef.current) {
        barContainerRef.current.style.transform = 'scale(1)';
        barContainerRef.current.style.boxShadow = '';
        barContainerRef.current.style.borderColor = '';
      }
      return;
    }

    const analyzeFrame = () => {
      let isKickBeat = false;
      let isSnareBeat = false;

      const now = performance.now();
      const liveCurrentTime = audioRef?.current ? audioRef.current.currentTime : currentTime;

      // 1. ONE-SHOT PCM KICK MATCHING (Edge trigger within -0.03s .. +0.04s)
      const kickStamps = kickTimestampsRef?.current || [];
      for (let i = 0; i < kickStamps.length; i++) {
        const diff = liveCurrentTime - kickStamps[i];
        if (diff >= -0.03 && diff <= 0.04 && i !== lastFiredKickIndexRef.current) {
          lastFiredKickIndexRef.current = i;
          isKickBeat = true;
          lastKickTimeRef.current = now;
          break;
        }
      }

      // 2. ONE-SHOT PCM SNARE MATCHING (Edge trigger within -0.03s .. +0.04s)
      const snareStamps = snareTimestampsRef?.current || [];
      for (let i = 0; i < snareStamps.length; i++) {
        const diff = liveCurrentTime - snareStamps[i];
        if (diff >= -0.03 && diff <= 0.04 && i !== lastFiredSnareIndexRef.current) {
          lastFiredSnareIndexRef.current = i;
          isSnareBeat = true;
          lastSnareTimeRef.current = now;
          break;
        }
      }

      // 3. REAL-TIME AUDIO NODE FALLBACK IF PCM NOT READY
      let kickSubPunchEnergy = 0;
      if (kickAnalyserRef?.current) {
        try {
          const arr = new Uint8Array(kickAnalyserRef.current.frequencyBinCount);
          kickAnalyserRef.current.getByteFrequencyData(arr);
          let sum = 0;
          for (let i = 0; i < arr.length; i++) sum += arr[i];
          kickSubPunchEnergy = sum / arr.length;
        } catch {}
      }

      let snareVocalEnergy = 0;
      if (snareAnalyserRef?.current) {
        try {
          const arr = new Uint8Array(snareAnalyserRef.current.frequencyBinCount);
          snareAnalyserRef.current.getByteFrequencyData(arr);
          let sum = 0;
          for (let i = 0; i < arr.length; i++) sum += arr[i];
          snareVocalEnergy = sum / arr.length;
        } catch {}
      }

      const deltaKickPunch = Math.max(0, kickSubPunchEnergy - prevKickPunchRef.current);
      prevKickPunchRef.current = kickSubPunchEnergy;
      smoothedKickPunchRef.current = smoothedKickPunchRef.current * 0.78 + deltaKickPunch * 0.22;
      const kickThreshold = Math.max(6, smoothedKickPunchRef.current * 1.25);

      if (!isKickBeat && deltaKickPunch > kickThreshold && deltaKickPunch > 10 && kickSubPunchEnergy > snareVocalEnergy * 0.9 && kickSubPunchEnergy > 28 && (now - lastKickTimeRef.current > 140)) {
        isKickBeat = true;
        lastKickTimeRef.current = now;
      }

      // 4. APPLY DISTINCT KICK REACTION (Fiery Red/Orange Overlay + Scale Bounce)
      if (isKickBeat) {
        fireIntensityRef.current = 1.0;
        currentScaleRef.current = 1.048;
      } else {
        fireIntensityRef.current *= 0.68; // Fast 60ms decay
        currentScaleRef.current = currentScaleRef.current + (1.0 - currentScaleRef.current) * 0.32;
      }

      // 5. APPLY DISTINCT SNARE REACTION (Electric Neon Cyan/Purple Overlay)
      if (isSnareBeat) {
        snareIntensityRef.current = 1.0;
      } else {
        snareIntensityRef.current *= 0.68; // Fast 60ms decay
      }

      if (fireIntensityRef.current < 0.01) fireIntensityRef.current = 0;
      if (snareIntensityRef.current < 0.01) snareIntensityRef.current = 0;
      if (Math.abs(currentScaleRef.current - 1.0) < 0.001) currentScaleRef.current = 1.0;

      // GPU-accelerated inline styles for 60fps performance
      if (fireOverlayRef.current) {
        fireOverlayRef.current.style.opacity = fireIntensityRef.current.toFixed(3);
      }
      if (lyricsFireOverlayRef.current) {
        lyricsFireOverlayRef.current.style.opacity = fireIntensityRef.current.toFixed(3);
      }
      if (snareOverlayRef.current) {
        snareOverlayRef.current.style.opacity = snareIntensityRef.current.toFixed(3);
      }
      if (lyricsSnareOverlayRef.current) {
        lyricsSnareOverlayRef.current.style.opacity = snareIntensityRef.current.toFixed(3);
      }
      if (barContainerRef.current) {
        // Fix lyrics: When lyrics drawer is open, keep container scale 100% fixed without bouncing
        const scaleVal = showLyrics ? 1.0 : currentScaleRef.current;
        barContainerRef.current.style.transform = `scale(${scaleVal.toFixed(4)})`;
        if (fireIntensityRef.current > 0.18) {
          barContainerRef.current.style.boxShadow = `0 15px 45px rgba(255, 60, 0, ${(fireIntensityRef.current * 0.75).toFixed(2)}), inset 0 0 25px rgba(255, 120, 0, ${(fireIntensityRef.current * 0.6).toFixed(2)})`;
          barContainerRef.current.style.borderColor = `rgba(255, 140, 0, ${(0.3 + fireIntensityRef.current * 0.65).toFixed(2)})`;
        } else if (snareIntensityRef.current > 0.18) {
          barContainerRef.current.style.boxShadow = `0 15px 45px rgba(0, 240, 255, ${(snareIntensityRef.current * 0.75).toFixed(2)}), inset 0 0 25px rgba(160, 30, 255, ${(snareIntensityRef.current * 0.6).toFixed(2)})`;
          barContainerRef.current.style.borderColor = `rgba(0, 240, 255, ${(0.3 + snareIntensityRef.current * 0.65).toFixed(2)})`;
        } else {
          barContainerRef.current.style.boxShadow = '';
          barContainerRef.current.style.borderColor = '';
        }
      }

      animFrameIdRef.current = requestAnimationFrame(analyzeFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(analyzeFrame);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, showVideo, showLyrics, kickAnalyserRef, snareAnalyserRef, analyserRef]);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    return parseLrc(currentTrack.lyrics);
  }, [currentTrack?.lyrics]);

  const activeLyricIdx = useMemo(() => {
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

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
        togglePlay();
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

  if (!mounted || !currentTrack) return null;

  const effectiveDuration = duration > 0 && isFinite(duration) ? duration : currentTrack.duration || 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const hasDrawerOpen = showVideo || showLyrics || showQueue;

  return (
    <div className="fixed bottom-2 sm:bottom-3 left-0 right-0 z-[60] px-2 sm:px-4 pointer-events-auto select-none flex justify-center overflow-visible">
      {/* UNIFIED MONOLITHIC CARD CONTAINER */}
      <div
        ref={barContainerRef}
        className={`w-full max-w-6xl md:max-w-7xl mx-auto dynamic-music-bar text-white transform-gpu relative shadow-2xl transition-all duration-300 overflow-visible ${
          hasDrawerOpen ? 'rounded-[28px]' : 'rounded-full sm:rounded-[32px]'
        }`}
      >
        {/* Fluid Ambient Multi-Color Gradient Overlay (Always active when audio plays) */}
        {isPlaying && !showVideo && <div className="fluid-ambient-gradient" />}

        {/* High-Energy Fire Effect Flash Gradient Overlay (Flash & Decay on Kick Drum Beat) */}
        <div ref={fireOverlayRef} className="fire-flash-overlay opacity-0 rounded-inherit" />

        {/* Electric Neon Cyan/Purple Flash Gradient Overlay (Flash & Decay on Snare / Clap Beat) */}
        <div ref={snareOverlayRef} className="snare-flash-overlay opacity-0 rounded-inherit" />

        {/* ============================================================= */}
        {/* INTEGRATED DRAWER 1: NATIVE WEB VIDEO PLAYER (MV STAGE) */}
        {/* ============================================================= */}
        {showVideo && currentTrack?.video_url && (
          <div className="w-full h-[360px] sm:h-[460px] md:h-[540px] p-3 sm:p-4 border-b border-white/20 flex flex-col justify-between text-white font-mono animate-slideUp transition-all transform-gpu relative z-20 select-none rounded-t-[28px] overflow-hidden bg-black/95 backdrop-blur-2xl">
            {/* CRT TV Grain & Scanlines Overlay */}
            <div className="crt-scanlines pointer-events-none" />
            <div className="tv-grain-overlay pointer-events-none opacity-30" />

            {/* Header Bar inside Video Drawer */}
            <div className="flex items-center justify-between border-b border-white/15 pb-2 px-1 relative z-20">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <Film className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-xs sm:text-sm text-white truncate tracking-wider font-cyber flex items-center gap-2">
                    <span>{currentTrack.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/15 text-white border border-white/30 uppercase">
                      1080P MV
                    </span>
                  </h3>
                  <p className="text-[9px] text-slate-400 truncate uppercase tracking-widest font-mono">
                    {currentAlbum?.artist || 'VAULT ARTIST'} • VIDEO STAGE
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/20 text-[10px] font-mono text-white font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>SYNCED MV</span>
                </span>
              </div>
            </div>

            {/* Native Video Stage Viewport */}
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }}
              className="flex-1 my-2 rounded-2xl overflow-hidden border border-white/20 relative bg-black/90 flex items-center justify-center shadow-2xl z-20 select-none pointer-events-auto"
            >
              {/* HIDDEN MUSIC Watermark */}
              <div className="absolute top-3 left-3 z-40 flex items-center gap-2 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-white shadow-2xl select-none pointer-events-none">
                <Disc3 className="w-3.5 h-3.5 text-white animate-spin-slow" />
                <span className="font-cyber font-extrabold text-[11px] tracking-wider text-white">HIDDEN MUSIC</span>
              </div>

              {/* DRM Protected Badge */}
              <div className="absolute bottom-3 right-3 z-40 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 text-[9px] text-slate-300 font-mono select-none pointer-events-none">
                <Sparkles className="w-3 h-3 text-white animate-pulse" />
                <span>DRM PROTECTED</span>
              </div>

              {/* YouTube Style Clean Subtitle Overlay with Live Beat Sync (Hidden during Intro) */}
              {parsedLyrics.length > 0 && activeLyricIdx >= 0 && parsedLyrics[activeLyricIdx]?.text && (
                <div className="absolute bottom-6 left-4 right-4 z-40 flex justify-center pointer-events-none select-none transition-all duration-150">
                  <div className="bg-black/85 backdrop-blur-md px-5 py-2 rounded-xl border border-white/15 shadow-[0_4px_25px_rgba(0,0,0,0.9)] max-w-xl text-center">
                    <p className="text-white font-cyber font-bold text-xs sm:text-base md:text-lg leading-relaxed tracking-wide">
                      {parsedLyrics[activeLyricIdx].text}
                    </p>
                  </div>
                </div>
              )}

              {/* Click-to-Play & Double-Click Fullscreen Overlay */}
              <div
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }}
                onClick={() => togglePlay()}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  const container = e.currentTarget.parentElement;
                  if (container) {
                    if (!document.fullscreenElement) {
                      container.requestFullscreen?.().catch(() => {});
                    } else {
                      document.exitFullscreen?.().catch(() => {});
                    }
                  }
                }}
                className="absolute inset-0 z-30 w-full h-full cursor-pointer flex items-center justify-center select-none bg-transparent"
              >
                {!isPlaying && (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/75 border border-white/50 backdrop-blur-md flex items-center justify-center text-white shadow-2xl animate-pulse pointer-events-none">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
                  </div>
                )}
              </div>

              <video
                ref={videoRef}
                playsInline
                controls={false}
                controlsList="nodownload nofullscreen noremoteplayback"
                disablePictureInPicture={true}
                disableRemotePlayback={true}
                draggable={false}
                onDragStart={(e) => {
                  e.preventDefault();
                  return false;
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }}
                onEnded={nextTrack}
                style={{ pointerEvents: 'none' }}
                className="w-full h-full object-contain max-h-full select-none pointer-events-none"
              />
            </div>

            {/* Bottom Info Status inside Video Drawer */}
            <div className="flex items-center justify-between pt-1.5 border-t border-white/10 px-1 font-mono text-[9px] text-slate-400 relative z-20">
              <span className="flex items-center gap-1.5 text-white font-bold">
                <Sparkles className="w-3 h-3 animate-spin" />
                <span>AUDIO-VIDEO BEAT SYNCED</span>
              </span>
              <span className="text-slate-400 uppercase">Nhấp 2 lần để phóng to video</span>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* INTEGRATED DRAWER 2: GOTHIC LYRICS */}
        {/* ============================================================= */}
        {showLyrics && (
          <div className="w-full h-[360px] sm:h-[430px] p-4 sm:p-6 border-b border-white/15 flex flex-col justify-between text-white font-sans animate-slideUp transition-all transform-gpu relative z-20 rounded-t-[28px] overflow-hidden select-none bg-black/85 backdrop-blur-2xl">
            {/* Dynamic Beat Reaction inside Lyrics */}
            <div ref={lyricsFireOverlayRef} className="fire-flash-overlay opacity-0 pointer-events-none" />
            <div ref={lyricsSnareOverlayRef} className="snare-flash-overlay opacity-0 pointer-events-none" />
            <div className="tv-grain-overlay opacity-25 pointer-events-none" />

            {/* Header Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 px-1 relative z-10">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <Mic2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-xs sm:text-sm text-white truncate tracking-wider font-cyber">
                    {currentTrack.title}
                  </h3>
                  <p className="text-[9px] text-slate-400 truncate uppercase tracking-widest font-mono">
                    {currentAlbum?.artist || 'VAULT ARTIST'} • GOTHIC LYRICS
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold hidden sm:inline">
                SYNCHRONIZED (.LRC)
              </span>
            </div>

            {/* Gothic Synchronized Lyrics List */}
            <div className="flex-1 overflow-y-auto no-scrollbar my-2 px-2 py-8 space-y-4 text-center scroll-smooth relative z-10">
              {parsedLyrics.length > 0 ? (
                parsedLyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIdx;
                  return (
                    <div
                      key={`${line.time}_${idx}`}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => seekTo(line.time)}
                      className={`cursor-pointer transition-all duration-300 py-1 px-4 ${
                        isActive
                          ? 'scale-105 opacity-100'
                          : 'opacity-35 hover:opacity-75'
                      }`}
                    >
                      <p
                        className={`transition-all duration-200 ${
                          isActive
                            ? 'text-white font-extrabold text-base sm:text-lg md:text-xl tracking-wide font-cyber'
                            : 'text-zinc-400 font-medium text-xs sm:text-sm font-sans'
                        }`}
                      >
                        {line.text}
                      </p>
                    </div>
                  );
                })
              ) : currentTrack.lyrics ? (
                <div className="whitespace-pre-wrap text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans text-center px-4 py-6">
                  {currentTrack.lyrics}
                </div>
              ) : (
                <div className="text-center py-20 text-zinc-500 text-xs tracking-widest flex flex-col items-center gap-2 font-mono">
                  <Mic2 className="w-8 h-8 text-zinc-600 mb-1" />
                  <span>CHƯA CÓ DỮ LIỆU LỜI BÀI HÁT CHO TÁC PHẨM NÀY</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* INTEGRATED DRAWER 3: QUEUE LIST */}
        {/* ============================================================= */}
        {showQueue && (
          <div className="w-full h-[280px] sm:h-[340px] p-4 border-b border-white/15 text-white font-mono text-xs flex flex-col justify-between animate-slideUp transition-all transform-gpu relative z-20 rounded-t-[28px] bg-black/85 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider font-cyber text-[10px]">
                <Disc3 className="w-3.5 h-3.5 text-white animate-spin-slow" />
                <span>DANH SÁCH PHÁT ({playlist.length})</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {playlist.map((trk, i) => {
                const isCurrent = currentTrack?.id === trk.id;
                return (
                  <div
                    key={`${trk.id}_${i}`}
                    onClick={() => playTrack(trk, currentAlbum, playlist)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
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

        {/* ============================================================= */}
        {/* MAIN GLOBAL PLAYER DYNAMIC CONTROL BAR */}
        {/* ============================================================= */}
        <div
          className={`w-full p-2.5 sm:p-3.5 backdrop-blur-2xl transition-all duration-300 flex items-center justify-between gap-2 sm:gap-4 relative z-50 select-none overflow-visible ${
            hasDrawerOpen ? 'rounded-b-[28px]' : 'rounded-full sm:rounded-[32px]'
          }`}
        >
          {/* Left Column: Track / Video Details */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0 max-w-[130px] xs:max-w-[170px] sm:max-w-[260px]">
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-white/20 flex-shrink-0 bg-slate-900 shadow-md">
              <img
                src={currentAlbum?.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                alt={currentTrack.title}
                className={`w-full h-full object-cover ${(isPlaying || showVideo) ? 'animate-spin-slow' : ''}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <h4 className="text-[10px] sm:text-[11px] font-extrabold text-white truncate uppercase tracking-wider font-cyber">
                  {currentTrack.title}
                </h4>
                {currentTrack.video_url ? (
                  <button
                    onClick={() => {
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
              <p className="text-[8px] sm:text-[9px] text-slate-400 truncate uppercase font-mono">
                {currentAlbum?.artist || 'VAULT ARTIST'}
                <span className="sm:hidden text-slate-300 font-mono font-semibold ml-1">
                  ({formatTime(currentTime)} / {formatTime(effectiveDuration)})
                </span>
              </p>
            </div>
          </div>

          {/* Center Column: TIME SCRUBBER WITH CIRCULAR IVORY THUMB */}
          <div className="flex-1 flex items-center gap-1.5 sm:gap-3.5 px-1 sm:px-6 min-w-0">
            <span className="hidden sm:inline-block text-[10px] sm:text-[11px] font-bold font-mono flex-shrink-0 text-slate-300">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={effectiveDuration || 100}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-2 sm:h-2.5 rounded-full appearance-none cursor-pointer border border-white/20 bg-slate-800 shadow-inner hover:bg-slate-700 transition-all"
              />
            </div>
            <span className="hidden sm:inline-block text-[10px] sm:text-[11px] font-bold font-mono flex-shrink-0 text-slate-400">
              {formatTime(effectiveDuration)}
            </span>
          </div>

          {/* Right Column: PLAYBACK & ACTION CONTROLS */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0 overflow-visible">
            {/* LYRICS BUTTON */}
            {!showVideo && (
              <button
                onClick={() => {
                  setShowLyrics(!showLyrics);
                  setShowQueue(false);
                }}
                className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full border transition-all flex items-center gap-1 text-[10px] font-bold ${
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
              className={`hidden md:block p-1.5 transition-colors ${
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
              onClick={togglePlay}
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform flex-shrink-0"
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
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
              className={`hidden md:block p-1.5 transition-colors ${
                repeatMode !== 'off' ? 'text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
            </button>

            {/* QUEUE BUTTON */}
            {!showVideo && (
              <button
                onClick={() => {
                  setShowQueue(!showQueue);
                  setShowLyrics(false);
                }}
                className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full border transition-all flex items-center gap-1 text-[10px] font-bold ${
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
