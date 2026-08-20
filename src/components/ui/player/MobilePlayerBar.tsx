'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Heart,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '@/lib/lrcParser';
import { useTelemetry } from '@/hooks/useTelemetry';

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
    userQueue,
    removeFromQueue,
    clearQueue,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    shuffleMode,
    repeatMode,
    activeZone,
    audioRef,
    currentTimeRef,
    analyserRef,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const { sendTelemetry } = useTelemetry();

  const effectiveDuration = (currentTrack?.duration && currentTrack.duration > 0)
    ? currentTrack.duration
    : duration;

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeView, setActiveView] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [isLiked, setIsLiked] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Direct DOM Elements for 60FPS Hardware-Accelerated Stage Performance
  const miniBarRef = useRef<HTMLDivElement | null>(null);
  const miniGlowBackdropRef = useRef<HTMLDivElement | null>(null);
  const miniCoverRef = useRef<HTMLDivElement | null>(null);
  const miniPlayBtnRef = useRef<HTMLButtonElement | null>(null);
  const miniSheenRef = useRef<HTMLDivElement | null>(null);
  const miniTextRef = useRef<HTMLSpanElement | null>(null);

  const expandCoverRef = useRef<HTMLDivElement | null>(null);
  const expandPlayBtnRef = useRef<HTMLButtonElement | null>(null);
  const expandRootRef = useRef<HTMLDivElement | null>(null);
  const expandLaserBorderRef = useRef<HTMLDivElement | null>(null);
  const expandTitleRef = useRef<HTMLHeadingElement | null>(null);
  const expandArtistRef = useRef<HTMLParagraphElement | null>(null);
  const expandLikeBtnRef = useRef<HTMLButtonElement | null>(null);
  const expandShuffleBtnRef = useRef<HTMLButtonElement | null>(null);
  const expandPrevBtnRef = useRef<HTMLButtonElement | null>(null);
  const expandNextBtnRef = useRef<HTMLButtonElement | null>(null);
  const expandRepeatBtnRef = useRef<HTMLButtonElement | null>(null);
  const expandLyricsBtnRef = useRef<HTMLButtonElement | null>(null);
  const expandQueueBtnRef = useRef<HTMLButtonElement | null>(null);
  const miniPrevBtnRef = useRef<HTMLButtonElement | null>(null);
  const miniNextBtnRef = useRef<HTMLButtonElement | null>(null);

  // Gestures
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchDeltaXRef = useRef<number>(0);
  const [swipeOffsetX, setSwipeOffsetX] = useState<number>(0);
  const isSwipingHorizontalRef = useRef<boolean>(false);

  const sheetTouchStartXRef = useRef<number>(0);
  const sheetTouchStartYRef = useRef<number>(0);
  const sheetTouchDeltaXRef = useRef<number>(0);
  const sheetTouchDeltaYRef = useRef<number>(0);
  const [sheetOffsetY, setSheetOffsetY] = useState<number>(0);

  // Seeker refs
  const expandedCurrentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const expandedSeekerInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSeekerRef = useRef<boolean>(false);

  // Physics Spring State
  const kickScaleRef = useRef<number>(1);
  const targetKickScaleRef = useRef<number>(1);
  const snareStrobeRef = useRef<number>(0);
  const targetSnareStrobeRef = useRef<number>(0);

  // 60FPS Multi-Band Audio Analyzer State
  const fastBassRef = useRef<number>(0);
  const slowBassRef = useRef<number>(0);
  const lastKickHitTimeRef = useRef<number>(0);

  const fastMidRef = useRef<number>(0);
  const slowMidRef = useRef<number>(0);
  const fastHighRef = useRef<number>(0);
  const slowHighRef = useRef<number>(0);
  const lastSnareHitTimeRef = useRef<number>(0);

  const smoothBasslineRef = useRef<number>(0);
  const fastVocalRef = useRef<number>(0);
  const slowVocalRef = useRef<number>(0);
  const smoothVocalRef = useRef<number>(0);

  const fastTrebleRef = useRef<number>(0);
  const slowTrebleRef = useRef<number>(0);
  const trebleStrobeRef = useRef<number>(0);
  const targetTrebleStrobeRef = useRef<number>(0);
  const lastTrebleHitTimeRef = useRef<number>(0);

  const smoothEnergyRef = useRef<number>(0);

  // 60FPS Live Stage Engine
  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      targetKickScaleRef.current = 0;
      kickScaleRef.current = 1;
      targetSnareStrobeRef.current = 0;
      snareStrobeRef.current = 0;
      fastBassRef.current = 0; slowBassRef.current = 0;
      fastMidRef.current = 0; slowMidRef.current = 0;
      fastHighRef.current = 0; slowHighRef.current = 0;
      fastVocalRef.current = 0; slowVocalRef.current = 0; smoothVocalRef.current = 0;
      fastTrebleRef.current = 0; slowTrebleRef.current = 0;
      trebleStrobeRef.current = 0; targetTrebleStrobeRef.current = 0;
      smoothBasslineRef.current = 0; smoothEnergyRef.current = 0;
      return;
    }

    const dataArray = new Uint8Array(1024);

    const liveStageShow = () => {
      const now = performance.now();
      const liveSec = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : 0);

      // Cập nhật Seeker Text mượt mà 60 FPS
      if (!isDraggingSeekerRef.current) {
        if (expandedSeekerInputRef.current) {
          expandedSeekerInputRef.current.value = String(liveSec);
        }
        if (expandedCurrentTimeTextRef.current) {
          expandedCurrentTimeTextRef.current.textContent = formatTime(liveSec);
        }
      }

      if (analyserRef?.current) {
        analyserRef.current.getByteFrequencyData(dataArray);

        // 1. SUB-BASS / KICK (Bins 2-6: 43Hz-129Hz)
        let bassSum = 0;
        for (let i = 2; i <= 6; i++) bassSum += dataArray[i];
        const currentBass = bassSum / 5;
        const fB = fastBassRef.current * 0.15 + currentBass * 0.85;
        const sB = slowBassRef.current * 0.88 + currentBass * 0.12;
        fastBassRef.current = fB;
        slowBassRef.current = sB;
        const bassFlux = Math.max(0, fB - sB);

        // 2. BASSLINE / 808 ENERGY (Bins 3-12: 64Hz-258Hz)
        let basslineSum = 0;
        for (let i = 3; i <= 12; i++) basslineSum += dataArray[i];
        const currentBassline = basslineSum / 10;
        smoothBasslineRef.current += ((currentBassline / 255) - smoothBasslineRef.current) * 0.22;

        // 3. SNARE DUAL-BAND CONFIRMATION
        let midSum = 0;
        for (let i = 70; i <= 185; i++) midSum += dataArray[i];
        const currentMid = midSum / 116;
        const fM = fastMidRef.current * 0.15 + currentMid * 0.85;
        const sM = slowMidRef.current * 0.88 + currentMid * 0.12;
        fastMidRef.current = fM;
        slowMidRef.current = sM;
        const midFlux = Math.max(0, fM - sM);

        let highSum = 0;
        for (let i = 190; i <= 420; i++) highSum += dataArray[i];
        const currentHigh = highSum / 231;
        const fH = fastHighRef.current * 0.15 + currentHigh * 0.85;
        const sH = slowHighRef.current * 0.88 + currentHigh * 0.12;
        fastHighRef.current = fH;
        slowHighRef.current = sH;
        const highFlux = Math.max(0, fH - sH);

        // 4. VOCAL / LEAD BAND (Bins 14-162: ~300Hz-3.5kHz)
        let vocalSum = 0;
        for (let i = 14; i <= 162; i++) vocalSum += dataArray[i];
        const currentVocal = vocalSum / 148;
        const fV = fastVocalRef.current * 0.20 + currentVocal * 0.80;
        const sV = slowVocalRef.current * 0.90 + currentVocal * 0.10;
        fastVocalRef.current = fV;
        slowVocalRef.current = sV;
        smoothVocalRef.current += ((currentVocal / 255) - smoothVocalRef.current) * 0.20;

        // 5. TREBLE / HI-HATS / CYMBALS (Bins 232-743: ~5kHz-16kHz)
        let trebleSum = 0;
        for (let i = 232; i <= 743; i++) trebleSum += dataArray[i];
        const currentTreble = trebleSum / 512;
        const fT = fastTrebleRef.current * 0.15 + currentTreble * 0.85;
        const sT = slowTrebleRef.current * 0.88 + currentTreble * 0.12;
        fastTrebleRef.current = fT;
        slowTrebleRef.current = sT;
        const trebleFlux = Math.max(0, fT - sT);

        // 6. TOTAL AMBIENT ENERGY (RMS)
        let totalSum = 0;
        for (let i = 0; i < 1024; i++) totalSum += dataArray[i];
        const currentEnergy = totalSum / 1024;
        smoothEnergyRef.current += ((currentEnergy / 255) - smoothEnergyRef.current) * 0.15;

        // TRIGGERS
        const is808Sustaining = currentBass > 150 && bassFlux < 9.0;
        if (bassFlux > 12.0 && !is808Sustaining && now - lastKickHitTimeRef.current > 120) {
          lastKickHitTimeRef.current = now;
          const force = Math.min(0.04, 0.015 + bassFlux / 500);
          targetKickScaleRef.current += force;
        }

        const isSnare = midFlux > 4.0 && highFlux > 1.8;
        if (isSnare && now - lastSnareHitTimeRef.current > 125) {
          lastSnareHitTimeRef.current = now;
          targetSnareStrobeRef.current = Math.min(1.0, Math.max(0.35, midFlux / 25));
        }

        if (trebleFlux > 1.4 && now - lastTrebleHitTimeRef.current > 70) {
          lastTrebleHitTimeRef.current = now;
          targetTrebleStrobeRef.current = Math.min(1.0, Math.max(0.35, trebleFlux / 10));
        }
      }

      // PHYSICS ENGINE: HOOKE'S LAW
      const tension = 0.32;
      const dampening = 0.60;
      const displacement = kickScaleRef.current - 1.0;
      targetKickScaleRef.current -= displacement * tension;
      targetKickScaleRef.current *= dampening;
      kickScaleRef.current += targetKickScaleRef.current;
      
      if (kickScaleRef.current < 0.99) kickScaleRef.current = 0.99;
      if (kickScaleRef.current > 1.04) kickScaleRef.current = 1.04;

      snareStrobeRef.current += (targetSnareStrobeRef.current - snareStrobeRef.current) * 0.55;
      targetSnareStrobeRef.current *= 0.72;

      trebleStrobeRef.current += (targetTrebleStrobeRef.current - trebleStrobeRef.current) * 0.65;
      targetTrebleStrobeRef.current *= 0.58;

      const k = kickScaleRef.current;
      const s = snareStrobeRef.current;
      const nrg = smoothEnergyRef.current;

      const kickDelta = Math.max(0, k - 1.0);
      const kickWeight = Math.min(1.0, kickDelta / 0.04); 
      const g = Math.floor(255 - kickWeight * 205);
      const b = Math.floor(255 - kickWeight * 205);
      const kickColor = `255, ${g}, ${b}`;

      // =========================================================================
      // MINI PLAYER DIRECT DOM MANIPULATION
      // =========================================================================
      if (miniBarRef.current) {
        miniBarRef.current.style.transform = `translateX(${swipeOffsetX}px) scale(${1 + kickDelta * 0.25})`;
        miniBarRef.current.style.borderColor = `rgba(${kickColor}, ${0.12 + kickDelta * 2.5})`;
      }

      if (miniGlowBackdropRef.current) {
        miniGlowBackdropRef.current.style.opacity = `${0.2 + s * 0.3 + kickDelta * 4.0}`;
        miniGlowBackdropRef.current.style.transform = `scale(${1 + kickDelta * 1.2})`;
        miniGlowBackdropRef.current.style.backgroundColor = `rgba(${kickColor}, 0.25)`;
      }

      if (miniCoverRef.current) {
        miniCoverRef.current.style.transform = `scale(${k})`;
        miniCoverRef.current.style.borderColor = `rgba(${kickColor}, ${0.2 + kickDelta * 3.0})`;
        miniCoverRef.current.style.boxShadow = `
          0 0 ${kickDelta * 150}px rgba(${kickColor}, ${kickDelta * 4.0}),
          0 0 ${s * 15}px rgba(255, 255, 255, ${s * 0.3})
        `;
      }

      if (miniPlayBtnRef.current) {
        miniPlayBtnRef.current.style.transform = `scale(${1 + kickDelta * 1.0})`;
      }

      // =========================================================================
      // EXPANDED PLAYER DIRECT DOM MANIPULATION
      // =========================================================================
      if (expandCoverRef.current) {
        expandCoverRef.current.style.transform = `scale(${k})`;
        expandCoverRef.current.style.borderColor = `rgba(${kickColor}, ${0.2 + kickDelta * 3.5 + s * 0.4})`;
        expandCoverRef.current.style.boxShadow = `
          0 20px 50px rgba(0, 0, 0, 0.95),
          0 0 ${15 + kickDelta * 300}px rgba(${kickColor}, ${0.15 + kickDelta * 4.5}),
          0 0 ${s * 45}px rgba(255, 255, 255, ${s * 0.4}),
          inset 0 0 ${15 + s * 30}px rgba(255, 255, 255, ${s * 0.3})
        `;
      }

      if (expandPlayBtnRef.current) {
        expandPlayBtnRef.current.style.transform = `scale(${1 + kickDelta * 1.2})`;
        expandPlayBtnRef.current.style.boxShadow = `0 0 ${20 + kickDelta * 300 + s * 30}px rgba(255, 255, 255, ${0.4 + kickDelta * 4.0 + s * 0.3})`;
      }

      if (expandRootRef.current) {
        const cx = 50 + Math.sin(now / 900) * 3;
        const cy = 45 + Math.cos(now / 1100) * 2;
        expandRootRef.current.style.backgroundImage = `radial-gradient(
          circle at ${cx.toFixed(1)}% ${cy.toFixed(1)}%, 
          rgba(${kickColor}, ${0.08 + kickDelta * 2.5 + s * 0.15 + nrg * 0.10}) 0%, 
          rgba(${kickColor}, ${0.02 + kickDelta * 1.2 + nrg * 0.05}) ${35 + kickDelta * 60 + nrg * 10}%, 
          #050507 ${70 + kickDelta * 40}%
        )`;
      }

      if (expandLaserBorderRef.current) {
        expandLaserBorderRef.current.style.opacity = `${0.1 + s * 0.75 + kickDelta * 2.5 + nrg * 0.15}`;
      }

      rafIdRef.current = requestAnimationFrame(liveStageShow);
    };

    rafIdRef.current = requestAnimationFrame(liveStageShow);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPlaying, activeZone, currentTimeRef, audioRef, analyserRef, swipeOffsetX, effectiveDuration, shuffleMode, repeatMode, activeView]);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    return parseLrc(currentTrack.lyrics);
  }, [currentTrack?.lyrics]);

  const activeLyricIdx = useMemo(() => {
    if (!parsedLyrics || parsedLyrics.length === 0) return -1;
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  useEffect(() => {
    if (!isExpanded || activeView !== 'lyrics' || activeLyricIdx < 0) return;
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
  }, [activeLyricIdx, isExpanded, activeView]);

  // Touch Handlers
  const handleMiniTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchDeltaXRef.current = 0;
      isSwipingHorizontalRef.current = false;
    }
  };

  const handleMiniTouchMove = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      isSwipingHorizontalRef.current = true;
      touchDeltaXRef.current = diffX;
      setSwipeOffsetX(Math.max(-40, Math.min(40, diffX * 0.4)));
    }
  };

  const handleMiniTouchEnd = () => {
    if (isSwipingHorizontalRef.current) {
      if (touchDeltaXRef.current < -50) {
        nextTrack();
      } else if (touchDeltaXRef.current > 50) {
        prevTrack();
      }
    }
    setSwipeOffsetX(0);
    setTimeout(() => {
      isSwipingHorizontalRef.current = false;
    }, 50);
  };

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      sheetTouchStartXRef.current = e.touches[0].clientX;
      sheetTouchStartYRef.current = e.touches[0].clientY;
      sheetTouchDeltaXRef.current = 0;
      sheetTouchDeltaYRef.current = 0;
    }
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    const diffX = e.touches[0].clientX - sheetTouchStartXRef.current;
    const diffY = e.touches[0].clientY - sheetTouchStartYRef.current;
    sheetTouchDeltaXRef.current = diffX;
    sheetTouchDeltaYRef.current = diffY;

    if (diffY > 0 && Math.abs(diffY) > Math.abs(diffX)) {
      setSheetOffsetY(Math.min(180, diffY * 0.6));
    }
  };

  const handleSheetTouchEnd = () => {
    const deltaX = sheetTouchDeltaXRef.current;
    const deltaY = sheetTouchDeltaYRef.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (deltaY > 60 && absY > absX) {
      setIsExpanded(false);
    } else if (deltaX < -60 && absX > absY && activeView === 'player') {
      nextTrack();
    } else if (deltaX > 60 && absX > absY && activeView === 'player') {
      prevTrack();
    }

    setSheetOffsetY(0);
    sheetTouchDeltaXRef.current = 0;
    sheetTouchDeltaYRef.current = 0;
  };

  const handleToggleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextLiked = !isLiked;
      setIsLiked(nextLiked);
      if (currentTrack) {
        sendTelemetry({
          event: 'heart',
          trackId: currentTrack.id,
          albumId: currentTrack.album_id,
          isLiked: nextLiked,
          sourceSection: 'mobile_player_expanded',
        });
      }
    },
    [isLiked, currentTrack, sendTelemetry]
  );

  if (!currentTrack) return null;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. MINI-PLAYER STAGE PERFORMANCE                                          */}
      {/* ========================================================================= */}
      <div
        className="fixed bottom-4 left-3 right-3 z-40 pointer-events-auto select-none"
        onTouchStart={handleMiniTouchStart}
        onTouchMove={handleMiniTouchMove}
        onTouchEnd={handleMiniTouchEnd}
        onClick={() => {
          if (!isSwipingHorizontalRef.current) {
            setIsExpanded(true);
          }
        }}
      >
        <div
          ref={miniGlowBackdropRef}
          className="absolute inset-0 -inset-x-2 -inset-y-1 bg-gradient-to-r from-white/10 via-white/25 to-white/10 rounded-3xl blur-xl pointer-events-none transition-opacity duration-75 will-change-transform"
        />

        <div
          ref={miniBarRef}
          className="relative w-full backdrop-blur-3xl bg-black/60 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-2 border border-white/15 transition-all duration-75 active:scale-[0.98] cursor-pointer overflow-hidden will-change-transform"
        >
          <div
            ref={miniSheenRef}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none opacity-0 will-change-transform"
          />

          <div className="flex items-center gap-2.5 min-w-0 flex-1 relative z-10">
            <div
              ref={miniCoverRef}
              className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 shadow-sm border border-white/20 will-change-transform"
            >
              {currentAlbum?.cover_url ? (
                <img
                  src={currentAlbum.cover_url}
                  alt={currentAlbum.title || 'Cover'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3
                  className="w-full h-full p-1.5 text-white/50 animate-spin"
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused', animationDuration: '4s' }}
                />
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span
                ref={miniTextRef}
                className="text-xs font-cyber font-extrabold text-white truncate uppercase tracking-wide transition-all"
              >
                {currentTrack.title}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono font-bold truncate uppercase mt-0.5">
                {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 relative z-10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleToggleLike}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-transform"
              title={isLiked ? 'Đã yêu thích' : 'Yêu thích'}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isLiked ? 'text-white fill-white' : 'text-zinc-400'
                }`}
              />
            </button>

            <button
              ref={miniPrevBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                prevTrack();
              }}
              className="p-1.5 rounded-full text-zinc-300 hover:text-white active:scale-90 transition-transform will-change-transform"
              title="Bài trước"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              ref={miniPlayBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md active:scale-90 flex-shrink-0 mx-0.5 will-change-transform"
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              ref={miniNextBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                nextTrack();
              }}
              className="p-1.5 rounded-full text-zinc-300 hover:text-white active:scale-90 transition-transform will-change-transform"
              title="Bài kế tiếp"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXPANDED FULLSCREEN STAGE PERFORMANCE                                  */}
      {/* ========================================================================= */}
      {isExpanded && (
        <div
          ref={expandRootRef}
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          style={{ transform: `translateY(${sheetOffsetY}px)` }}
          className="fixed inset-0 z-50 bg-[#050507] text-white flex flex-col justify-between p-6 pb-10 select-none animate-fadeIn transition-transform duration-75"
        >
          {/* Top Laser Border */}
          <div
            ref={expandLaserBorderRef}
            className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent opacity-20 transition-opacity pointer-events-none"
          />

          {/* Header */}
          <div
            onClick={() => setIsExpanded(false)}
            className="flex flex-col items-center w-full flex-shrink-0 cursor-pointer pt-1 pb-2 relative z-20"
          >
            <div className="w-10 h-1 bg-white/30 rounded-full mb-3 active:bg-white/50 transition-colors" />

            <div className="flex flex-col items-center text-center">
              <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
                ĐANG PHÁT TỪ ALBUM
              </span>
              <span className="text-xs font-cyber font-bold text-white truncate max-w-[240px] uppercase mt-0.5">
                {currentAlbum?.title || 'HIDDEN DISC'}
              </span>
            </div>
          </div>

          {/* Main Stage Viewport */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center my-auto relative w-full overflow-visible">
            {/* PLAYER VIEW */}
            {activeView === 'player' && (
              <div className="w-full flex flex-col items-center justify-center h-full animate-fadeIn relative overflow-visible">
                <div
                  ref={expandCoverRef}
                  className="relative w-[72vw] max-w-[260px] aspect-square rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center mb-6 border border-white/20 will-change-transform z-10 flex-shrink-0"
                >
                  {currentAlbum?.cover_url ? (
                    <img
                      src={currentAlbum.cover_url}
                      alt={currentAlbum.title || 'Cover'}
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />
                  ) : (
                    <Disc3 className="w-20 h-20 text-zinc-700 animate-spin" />
                  )}
                </div>

                <div className="flex items-center justify-between w-full max-w-[260px] relative z-10 px-1">
                  <div className="flex flex-col min-w-0 flex-1 mr-3">
                    <h2
                      ref={expandTitleRef}
                      className="text-lg font-cyber font-black text-white truncate uppercase tracking-wide transition-all will-change-transform"
                    >
                      {currentTrack.title}
                    </h2>
                    <p 
                      ref={expandArtistRef}
                      className="text-xs font-mono text-zinc-400 truncate uppercase mt-0.5 transition-all"
                    >
                      {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                    </p>
                  </div>

                  <button
                    ref={expandLikeBtnRef}
                    onClick={handleToggleLike}
                    className="p-2 rounded-full active:scale-90 transition-transform will-change-transform"
                    title={isLiked ? 'Đã yêu thích' : 'Yêu thích'}
                  >
                    <Heart
                      className={`w-5 h-5 transition-colors ${
                        isLiked ? 'text-white fill-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* LYRICS VIEW — CHUẨN YOUTUBE MUSIC & SPOTIFY: GIỮ NGUYÊN 100% SIZE CHỮ, KHÔNG NHẢY DÒNG */}
            {activeView === 'lyrics' && (
              <div
                ref={lyricsScrollRef}
                className="w-full h-full overflow-y-auto no-scrollbar py-12 px-6 animate-fadeIn relative"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                }}
              >
                {parsedLyrics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs uppercase tracking-widest font-mono text-center">
                    Chưa có lời bài hát cho tác phẩm này
                  </div>
                ) : (
                  <div className="w-full max-w-md mx-auto py-8 space-y-6">
                    {parsedLyrics.map((line, idx) => {
                      const isActive = idx === activeLyricIdx;
                      return (
                        <p
                          key={idx}
                          data-active-mobile-lyric={isActive ? 'true' : 'false'}
                          onClick={() => seekTo(line.time)}
                          className={`text-[17px] leading-relaxed font-bold tracking-tight text-left select-none cursor-pointer transition-colors duration-300 ${
                            isActive
                              ? 'text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.4)]'
                              : 'text-white/25 hover:text-white/50'
                          }`}
                        >
                          {line.text}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* QUEUE VIEW */}
            {activeView === 'queue' && (
              <div
                className="w-full h-full overflow-y-auto no-scrollbar space-y-3 py-2 font-mono px-2 animate-fadeIn"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {/* 1. USER QUEUE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-300 uppercase">
                        HÀNG CHỜ PHÁT ({userQueue.length})
                      </span>
                    </div>
                    {userQueue.length > 0 && (
                      <button
                        onClick={clearQueue}
                        className="text-[9px] font-mono text-zinc-500 hover:text-white transition-colors flex items-center gap-1 uppercase"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {userQueue.length === 0 ? (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                      <p className="text-[11px] text-zinc-400">Hàng chờ trống</p>
                      <p className="text-[9px] text-zinc-600 mt-0.5">
                        Tự động phát ngẫu nhiên từ thư viện khi hết bài.
                      </p>
                    </div>
                  ) : (
                    userQueue.map((track, idx) => (
                      <div
                        key={`mob_queue_${track.id}_${idx}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 active:bg-white/15 transition-all"
                      >
                        <div
                          onClick={() => {
                            removeFromQueue(track.id);
                            playTrack(track, currentAlbum, playlist);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="text-[10px] font-mono text-zinc-500 w-4 text-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs truncate font-bold text-white">{track.title}</p>
                            <p className="text-[9px] text-zinc-500 truncate uppercase">{track.artist || 'Unknown Artist'}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(track.id);
                          }}
                          title="Xóa khỏi hàng chờ"
                          className="p-1 rounded-lg text-zinc-500 hover:text-white active:scale-90 transition-all ml-2 flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 2. UPCOMING / PLAYLIST */}
                {playlist.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                        ĐANG PHÁT TỪ ALBUM / THƯ VIỆN ({playlist.length})
                      </span>
                      {shuffleMode && (
                        <span className="text-[8px] font-mono text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded">
                          SHUFFLE ON
                        </span>
                      )}
                    </div>
                    {playlist.map((track, idx) => {
                      const isCur = track.id === currentTrack?.id;
                      return (
                        <div
                          key={track.id || idx}
                          onClick={() => playTrack(track, currentAlbum, playlist)}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isCur
                              ? 'bg-white/15 border-white text-white font-bold shadow-md'
                              : 'bg-white/[0.02] border-white/5 text-zinc-400 active:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono text-zinc-500 w-4 text-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs truncate font-bold">{track.title}</p>
                              <p className="text-[9px] text-zinc-500 truncate">{track.artist || currentAlbum?.artist}</p>
                            </div>
                          </div>
                          {isCur && <Disc3 className="w-3.5 h-3.5 text-white animate-spin flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Area */}
          <div className="w-full flex flex-col gap-4 flex-shrink-0 pt-2 relative z-20">
            {/* Seekbar */}
            <div className="flex flex-col gap-1.5 w-full px-2">
              <div className="relative w-full flex items-center">
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
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer border border-white/20 bg-zinc-900 transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
                <span ref={expandedCurrentTimeTextRef}>{formatTime(currentTime)}</span>
                <span>{formatTime(effectiveDuration)}</span>
              </div>
            </div>

            {/* Master Controls */}
            <div className="flex items-center justify-between px-2">
              <button
                ref={expandShuffleBtnRef}
                onClick={toggleShuffle}
                className={`p-2.5 rounded-full border transition-all will-change-transform ${
                  shuffleMode
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                    : 'bg-white/5 text-zinc-400 border-white/10'
                }`}
                title="Trộn bài"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                ref={expandPrevBtnRef}
                onClick={prevTrack}
                className="p-3 rounded-full bg-white/5 text-white border border-white/10 active:scale-90 transition-transform will-change-transform"
                title="Bài trước"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                ref={expandPlayBtnRef}
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_35px_rgba(255,255,255,0.5)] active:scale-95 will-change-transform"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isBuffering ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-1" />
                )}
              </button>

              <button
                ref={expandNextBtnRef}
                onClick={nextTrack}
                className="p-3 rounded-full bg-white/5 text-white border border-white/10 active:scale-90 transition-transform will-change-transform"
                title="Bài kế tiếp"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                ref={expandRepeatBtnRef}
                onClick={toggleRepeat}
                className={`p-2.5 rounded-full border transition-all will-change-transform ${
                  repeatMode !== 'off'
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                    : 'bg-white/5 text-zinc-400 border-white/10'
                }`}
                title={`Lặp: ${repeatMode}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Bottom Tabs */}
            <div className="flex items-center justify-between px-4 pt-1">
              <button
                ref={expandLyricsBtnRef}
                onClick={() => setActiveView((prev) => (prev === 'lyrics' ? 'player' : 'lyrics'))}
                className={`p-2.5 rounded-full border transition-all flex items-center gap-1.5 will-change-transform ${
                  activeView === 'lyrics'
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Lời bài hát"
              >
                <Mic2 className="w-4 h-4" />
                <span className="text-[10px] font-mono font-bold uppercase">LỜI BÀI HÁT</span>
              </button>

              <button
                ref={expandQueueBtnRef}
                onClick={() => setActiveView((prev) => (prev === 'queue' ? 'player' : 'queue'))}
                className={`p-2.5 rounded-full border transition-all flex items-center gap-1.5 will-change-transform ${
                  activeView === 'queue'
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Danh sách phát"
              >
                <ListMusic className="w-4 h-4" />
                <span className="text-[10px] font-mono font-bold uppercase">HÀNG CHỜ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
