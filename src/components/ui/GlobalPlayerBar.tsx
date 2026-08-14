'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
  X,
  Music,
  Mic2,
  Film,
  Sparkles
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '@/lib/lrcParser';

export default function GlobalPlayerBar() {
  const pathname = usePathname();
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
    toggleCinematicFx
  } = usePlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  // Video player ref for synced playback
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Separate Kick & Snare Beat Detection & Animation Refs
  const barContainerRef = useRef<HTMLDivElement | null>(null);
  const fireOverlayRef = useRef<HTMLDivElement | null>(null);
  const snareOverlayRef = useRef<HTMLDivElement | null>(null);
  // Lyrics Stage separate overlay refs (React refs can only attach to 1 element at a time)
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

  // Mute background audio when Video Stage is open
  useEffect(() => {
    if (!audioRef?.current) return;
    if (showVideo) {
      audioRef.current.pause();
      audioRef.current.muted = true;
    } else {
      audioRef.current.muted = false;
      if (isPlaying) audioRef.current.play().catch(() => {});
    }
  }, [showVideo, isPlaying, audioRef]);

  // Sync video element: load src, play/pause, seek, volume
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !showVideo || !currentTrack?.video_url) return;
    if (vid.src !== currentTrack.video_url) {
      vid.src = currentTrack.video_url;
      vid.load();
    }
    vid.volume = volume;
    vid.currentTime = currentTime;
    if (isPlaying) vid.play().catch(() => {});
    else vid.pause();
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

  // Auto-scroll active lyric line to center of lyrics drawer
  useEffect(() => {
    if (showLyrics && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIdx, showLyrics]);

  // Global Keyboard Shortcuts (Space: Play/Pause, Arrows: Prev/Next, L: Lyrics, Q: Queue, S: Shuffle, R: Repeat)
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
      } else if (key === 'q') {
        e.preventDefault();
        setShowQueue((prev) => !prev);
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

  if (!currentTrack) return null;

  const effectiveDuration = (duration > 0 && isFinite(duration)) ? duration : (currentTrack.duration || 0);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const bottomPosition = 'bottom-2 sm:bottom-3';

  return (
    <div className={`fixed ${bottomPosition} left-0 right-0 z-40 px-2 sm:px-4 pointer-events-auto select-none flex justify-center`}>
      {/* DYNAMIC MUSIC VISUALIZATION BAR GLASSMORPHIC CONTAINER */}
      <div
        ref={barContainerRef}
        className="w-full max-w-6xl md:max-w-7xl mx-auto rounded-3xl dynamic-music-bar text-white overflow-hidden transform-gpu relative shadow-2xl"
      >
        {/* Fluid Ambient Multi-Color Gradient Overlay (Always active when audio plays) */}
        {isPlaying && !showVideo && <div className="fluid-ambient-gradient" />}

        {/* High-Energy Fire Effect Flash Gradient Overlay (Flash & Decay on Kick Drum Beat) */}
        <div ref={fireOverlayRef} className="fire-flash-overlay opacity-0" />

        {/* Electric Neon Cyan/Purple Flash Gradient Overlay (Flash & Decay on Snare / Clap Beat) */}
        <div ref={snareOverlayRef} className="snare-flash-overlay opacity-0" />

        {/* ============================================================= */}
        {/* INTEGRATED DRAWER: NATIVE WEB VIDEO PLAYER (SLIDE UP/DOWN) */}
        {/* ============================================================= */}
        {showVideo && currentTrack?.video_url && (
          <div className="w-full h-[360px] sm:h-[460px] md:h-[540px] p-3 sm:p-4 border-b border-cyan-500/30 flex flex-col justify-between text-white font-mono animate-slideUp transition-all transform-gpu bg-black/95 backdrop-blur-2xl relative z-40 select-none">
            {/* CRT TV Grain & Scanlines Overlay inside Video Drawer */}
            <div className="crt-scanlines pointer-events-none" />
            <div className="tv-grain-overlay pointer-events-none opacity-40" />

            {/* Header Bar inside Video Drawer */}
            <div className="flex items-center justify-between border-b border-white/15 pb-2 px-1 relative z-20">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center flex-shrink-0">
                  <Film className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-xs sm:text-sm text-white truncate tracking-wider font-cyber flex items-center gap-2">
                    <span>{currentTrack.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-400/40 uppercase">
                      WEB STAGE MV 1080P
                    </span>
                  </h3>
                  <p className="text-[9px] text-slate-400 truncate uppercase tracking-widest font-mono">
                    {currentAlbum?.artist || 'VAULT ARTIST'} • VIDEO STAGE
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowVideo(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors flex-shrink-0 flex items-center gap-1 text-[10px] font-bold"
                title="Thu gọn Video Stage"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">THU GỌN</span>
              </button>
            </div>

            {/* Native Web Video Viewport Stage */}
            <div className="flex-1 my-2 rounded-2xl overflow-hidden border border-cyan-500/40 relative bg-black flex items-center justify-center shadow-2xl z-20 select-none pointer-events-auto">
              {/* HIDDEN MUSIC Watermark Logo Badge (Top Left Corner) */}
              <div className="absolute top-3 left-3 z-40 flex items-center gap-2 bg-black/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-cyan-400/40 text-white shadow-2xl select-none pointer-events-none">
                <Disc3 className="w-4 h-4 text-cyan-400 animate-spin-slow" />
                <span className="font-cyber font-extrabold text-xs tracking-wider text-cyan-200">HIDDEN MUSIC</span>
              </div>

              {/* Anti-Screen Recording & DRM Protection Badge (Bottom Right) */}
              <div className="absolute bottom-3 right-3 z-40 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 text-[9px] text-slate-300 font-mono select-none pointer-events-none">
                <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>DRM PROTECTED • WEB STAGE</span>
              </div>

              <video
                ref={videoRef}
                playsInline
                controls={false}
                className="w-full h-full object-contain select-none"
              />
            </div>

            {/* Bottom Info Status inside Video Drawer */}
            <div className="flex items-center justify-between pt-1.5 border-t border-white/10 px-1 font-mono text-[9px] text-slate-400 relative z-20">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Sparkles className="w-3 h-3 animate-spin" />
                <span>DYNAMIC AUDIO-VIDEO BEAT SYNCED</span>
              </span>
              <span>BẤM "THU GỌN" ĐỂ CHUYỂN VỀ NHẠC 3D</span>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* INTEGRATED DRAWER: LYRICS (TV SCREEN FRAME) */}
        {/* ============================================================= */}
        {showLyrics && (
          <div className="w-full h-[360px] sm:h-[420px] p-4 border-2 border-white/20 rounded-3xl flex flex-col justify-between text-white font-sans animate-slideUp transition-all transform-gpu relative z-50 shadow-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d22 40%, #0a0a1a 100%)' }}>
            {/* Animated ambient gradient — same as music bar */}
            {isPlaying && <div className="fluid-ambient-gradient" />}
            {/* Fire & Snare overlays — separate refs from music bar */}
            <div ref={lyricsFireOverlayRef} className="fire-flash-overlay opacity-0" />
            <div ref={lyricsSnareOverlayRef} className="snare-flash-overlay opacity-0" />

            {/* Top Bar inside Drawer */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 px-1 relative z-50">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <Mic2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-white truncate tracking-wide flex items-center gap-1.5 font-cyber">
                    {currentTrack.title}
                  </h3>
                  <p className="text-[9px] text-slate-400 truncate uppercase tracking-widest font-mono">
                    {currentAlbum?.artist || 'VAULT ARTIST'} • TV LYRICS STAGE
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLyrics(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors flex-shrink-0"
                title="Đóng lời bài hát"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Karaoke Synchronized Lyrics Line List */}
            <div className="flex-1 overflow-y-auto my-2 px-2 py-6 space-y-3 text-center scroll-smooth pr-1 relative z-50" style={{ isolation: 'isolate' }}>
              {parsedLyrics.length > 0 ? (
                parsedLyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIdx;
                  return (
                    <div
                      key={`${line.time}_${idx}`}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => seekTo(line.time)}
                      className={`cursor-pointer transition-all duration-300 py-2 px-4 rounded-2xl ${
                        isActive
                          ? 'scale-105'
                          : 'opacity-50 hover:opacity-80 hover:text-white'
                      }`}
                      style={isActive ? { isolation: 'isolate' } : {}}
                    >
                      <span
                        className="font-semibold leading-relaxed font-sans"
                        style={{
                          isolation: 'isolate',
                          filter: 'none',
                          mixBlendMode: 'normal',
                          color: isActive ? '#ffffff' : 'rgba(200,200,220,0.7)',
                          fontSize: isActive ? '1.05rem' : '0.85rem',
                          fontWeight: isActive ? 800 : 500,
                          textShadow: isActive
                            ? '0 0 20px rgba(120,200,255,0.9), 0 0 40px rgba(100,160,255,0.5)'
                            : 'none',
                          letterSpacing: isActive ? '0.02em' : '0',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {line.text}
                      </span>
                    </div>
                  );
                })
              ) : currentTrack.lyrics ? (
                <div className="whitespace-pre-wrap text-xs sm:text-sm text-slate-200 leading-relaxed font-sans text-center px-2 py-4 font-semibold" style={{ isolation: 'isolate', filter: 'none' }}>
                  {currentTrack.lyrics}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400 text-xs tracking-wider flex flex-col items-center gap-2 font-mono" style={{ isolation: 'isolate' }}>
                  <Mic2 className="w-8 h-8 text-slate-500 mb-1" />
                  <span>CHƯA CÓ DỮ LIỆU LỜI BÀI HÁT (.LRC) CHO BÀI HÁT NÀY</span>
                </div>
              )}
            </div>

            {/* Bottom Progress Scrubber inside Drawer */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10 px-1 font-mono text-[9px] text-slate-400 relative z-50">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={effectiveDuration || 100}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* INTEGRATED DRAWER: QUEUE (GLASSMORPHIC BACKDROP) */}
        {/* ============================================================= */}
        {showQueue && (
          <div className="w-full h-[280px] sm:h-[340px] p-4 border-b border-white/15 text-white font-mono text-xs flex flex-col justify-between animate-slideUp transition-all transform-gpu bg-black/60 backdrop-blur-xl relative z-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider font-cyber text-[10px]">
                <Disc3 className="w-3.5 h-3.5 text-white animate-spin-slow" />
                <span>QUEUE LIST ({playlist.length})</span>
              </div>
              <button
                onClick={() => setShowQueue(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                      <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                        VIDEO
                      </span>
                    ) : (
                      <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
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
        <div className={`w-full p-2.5 sm:p-3.5 backdrop-blur-2xl transition-all duration-300 flex items-center justify-between gap-2 sm:gap-4 relative z-30 select-none ${
          showVideo
            ? 'bg-cyan-950/95 border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,240,255,0.4)]'
            : 'bg-black/90 border border-white/20'
        }`}>

          {/* Left Column: Track / Video Details */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0 max-w-[130px] xs:max-w-[170px] sm:max-w-[260px]">
            <div className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden border flex-shrink-0 bg-slate-900 ${
              showVideo ? 'border-cyan-400/50' : 'border-white/25'
            }`}>
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
                {showVideo ? (
                  <span className="text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold bg-cyan-400 text-black border border-cyan-300 flex items-center gap-0.5 flex-shrink-0 shadow-[0_0_10px_rgba(0,240,255,0.8)]">
                    <Film className="w-2.5 h-2.5" /> VIDEO BAR
                  </span>
                ) : currentTrack.video_url ? (
                  <span
                    onClick={() => {
                      setShowVideo(true);
                      setShowLyrics(false);
                      setShowQueue(false);
                    }}
                    className="text-[8px] uppercase px-2 py-0.5 rounded-full font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-400/50 flex items-center gap-1 flex-shrink-0 cursor-pointer hover:bg-cyan-900 transition-colors shadow-sm"
                    title="Mở MV Video Stage"
                  >
                    <Film className="w-2.5 h-2.5 text-cyan-400" /> MV
                  </span>
                ) : (
                  <span className="text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold bg-white/10 text-white border border-white/20 flex items-center gap-0.5 flex-shrink-0">
                    <Music className="w-2.5 h-2.5" /> AUDIO
                  </span>
                )}
              </div>
              <p className="text-[8px] sm:text-[9px] text-slate-400 truncate uppercase">
                {currentAlbum?.artist || 'VAULT ARTIST'}
                <span className="sm:hidden text-slate-300 font-mono font-semibold ml-1">
                  ({formatTime(currentTime)} / {formatTime(effectiveDuration)})
                </span>
              </p>
            </div>
          </div>

          {/* Center Column: PROMINENT & EXTENDED WIDE TIME SCRUBBER */}
          <div className="flex-1 flex items-center gap-1.5 sm:gap-3.5 px-1 sm:px-6 min-w-0">
            <span className={`hidden sm:inline-block text-[10px] sm:text-[11px] font-bold font-mono flex-shrink-0 ${
              showVideo ? 'text-cyan-300' : 'text-slate-300'
            }`}>
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={effectiveDuration || 100}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className={`w-full h-2 sm:h-2.5 rounded-full appearance-none cursor-pointer border shadow-inner transition-all ${
                  showVideo
                    ? 'bg-cyan-950 border-cyan-500/50 accent-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                    : 'bg-slate-800 border-white/20 accent-white hover:bg-slate-700'
                }`}
              />
            </div>
            <span className={`hidden sm:inline-block text-[10px] sm:text-[11px] font-bold font-mono flex-shrink-0 ${
              showVideo ? 'text-cyan-400' : 'text-slate-400'
            }`}>
              {formatTime(effectiveDuration)}
            </span>
          </div>

          {/* Right Column: PLAYBACK & ACTION CONTROLS GROUPED ON RIGHT */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0">
            {/* LYRICS BUTTON (Music mode only) */}
            {!showVideo && (
              <button
                onClick={() => {
                  setShowLyrics(!showLyrics);
                  setShowQueue(false);
                }}
                className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full border transition-all flex items-center gap-1 text-[10px] font-bold ${
                  showLyrics
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.7)]'
                    : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20 hover:text-white'
                }`}
                title="Xem Lời bài hát (.LRC)"
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">LYRICS</span>
              </button>
            )}

            {/* THU GỌN BUTTON (Video mode only) */}
            {showVideo && (
              <button
                onClick={() => setShowVideo(false)}
                className="px-2.5 py-1 rounded-full bg-cyan-400 text-black border border-cyan-300 text-[10px] font-bold shadow-[0_0_15px_rgba(0,240,255,0.7)] hover:bg-cyan-300 transition-all flex items-center gap-1"
                title="Thu gọn Video Stage về Nhạc"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">THU GỌN</span>
              </button>
            )}

            <button
              onClick={toggleShuffle}
              title={shuffleMode ? 'Shuffle: ON' : 'Shuffle: OFF'}
              className={`hidden md:block p-1.5 transition-colors ${
                shuffleMode ? (showVideo ? 'text-cyan-300' : 'text-white') : 'text-slate-500 hover:text-white'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={prevTrack}
              className={`transition-colors p-1 ${showVideo ? 'text-cyan-300 hover:text-white' : 'text-slate-400 hover:text-white'}`}
              title="Bài trước"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform flex-shrink-0 ${
                showVideo ? 'bg-cyan-400 text-black shadow-[0_0_15px_rgba(0,240,255,0.6)]' : 'bg-white text-black'
              }`}
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
              className={`transition-colors p-1 ${showVideo ? 'text-cyan-300 hover:text-white' : 'text-slate-400 hover:text-white'}`}
              title="Bài kế tiếp"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              title={`Loop Mode: ${repeatMode.toUpperCase()}`}
              className={`hidden md:block p-1.5 transition-colors ${
                repeatMode !== 'off' ? (showVideo ? 'text-cyan-300' : 'text-white') : 'text-slate-500 hover:text-white'
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
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.7)]'
                    : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20 hover:text-white'
                }`}
                title="Hàng chờ"
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">QUEUE</span>
              </button>
            )}

            {/* Speaker Icon with Vertical Hover Popover Volume Slider */}
            <div
              className="relative flex items-center justify-center group ml-1"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title="Điều chỉnh âm lượng"
              >
                {volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Vertical Hover Popover Volume Slider */}
              {showVolumeSlider && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 p-3 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl flex flex-col items-center gap-2 animate-fadeIn z-50">
                  <span className="text-[9px] font-mono text-slate-300 font-bold">{Math.round(volume * 100)}%</span>
                  <div className="h-24 flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="h-20 w-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white [writing-mode:vertical-lr] [direction:rtl]"
                    />
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
