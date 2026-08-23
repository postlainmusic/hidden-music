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
  ChevronDown,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { useTelemetry } from '@/hooks/useTelemetry';
import { getTrackDrumProfile, isDrumActiveAtTime } from '@/lib/dsp/trackDrumProfiles';
import { LiveWaveformBeatEngine } from '@/lib/dsp/liveWaveformBeat';
import TrackActionMenu from '@/components/ui/TrackActionMenu';

const formatTime = (secs: number) => {
  if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const rem = Math.floor(secs % 60);
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
};

const cleanLyrics = (raw?: string) => {
  if (!raw) return '';
  return raw
    .split('\n')
    .map((line) => line.replace(/\[\d{2}:\d{2}(\.\d+)?\]/g, '').trim())
    .filter((line) => line.length > 0)
    .join('\n');
};

export default function MobilePlayerBar() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const player = usePlayer();

  const currentTrack = player?.currentTrack ?? null;
  const currentAlbum = player?.currentAlbum ?? null;
  const drumProfile = useMemo(() => getTrackDrumProfile(currentTrack?.title || currentTrack?.id), [currentTrack?.title, currentTrack?.id]);
  const playlist = Array.isArray(player?.playlist) ? player.playlist : [];
  const userQueue = Array.isArray(player?.userQueue) ? player.userQueue : [];
  const removeFromQueue = typeof player?.removeFromQueue === 'function' ? player.removeFromQueue : () => {};
  const clearQueue = typeof player?.clearQueue === 'function' ? player.clearQueue : () => {};
  const isPlaying = !!player?.isPlaying;
  const isBuffering = !!player?.isBuffering;
  const currentTime = player?.currentTime ?? 0;
  const duration = player?.duration ?? 0;
  const shuffleMode = !!player?.shuffleMode;
  const repeatMode = player?.repeatMode ?? 'off';
  const activeZone = player?.activeZone ?? 'idle';
  const audioRef = player?.audioRef;
  const currentTimeRef = player?.currentTimeRef;
  const analyserRef = player?.analyserRef;
  const currentAmplitude = player?.currentAmplitude ?? 0;
  const getAmplitudeAtTime = player?.getAmplitudeAtTime;
  const playTrack = player?.playTrack ?? (() => {});
  const togglePlay = player?.togglePlay ?? (() => {});
  const nextTrack = player?.nextTrack ?? (() => {});
  const prevTrack = player?.prevTrack ?? (() => {});
  const seekTo = player?.seekTo ?? (() => {});
  const toggleShuffle = player?.toggleShuffle ?? (() => {});
  const toggleRepeat = player?.toggleRepeat ?? (() => {});

  let sendTelemetry = (_payload: any) => {};
  try {
    const tele = useTelemetry();
    if (tele && typeof tele.sendTelemetry === 'function') {
      sendTelemetry = tele.sendTelemetry;
    }
  } catch {}

  const effectiveDuration = (duration && Number.isFinite(duration) && duration > 0)
    ? duration
    : (currentTrack?.duration && currentTrack.duration > 0)
    ? currentTrack.duration
    : (audioRef?.current?.duration && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration
    : 0;

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeView, setActiveView] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [isLiked, setIsLiked] = useState(false);

  const rafIdRef = useRef<number | null>(null);

  // Direct DOM Elements
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
  const kickRedIntensityRef = useRef<number>(0);
  const targetKickRedIntensityRef = useRef<number>(0);
  const snareStrobeRef = useRef<number>(0);
  const targetSnareStrobeRef = useRef<number>(0);

  // Audio Analyzer State
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
  const liveWaveformEngineRef = useRef<LiveWaveformBeatEngine>(new LiveWaveformBeatEngine(1024, 0.015, 55));

  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      targetKickScaleRef.current = 0;
      kickScaleRef.current = 1;
      targetKickRedIntensityRef.current = 0;
      kickRedIntensityRef.current = 0;
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

    const updateLiveMobileShow = () => {
      const now = performance.now();
      const liveSec = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : 0);
      const isDrumming = isDrumActiveAtTime(drumProfile, liveSec);

      if (expandedCurrentTimeTextRef.current && !isDraggingSeekerRef.current) {
        expandedCurrentTimeTextRef.current.textContent = formatTime(liveSec);
      }

      if (expandedSeekerInputRef.current && !isDraggingSeekerRef.current) {
        expandedSeekerInputRef.current.value = String(liveSec);
      }

      let hasRealData = false;
      if (analyserRef?.current) {
        try {
          analyserRef.current.getByteFrequencyData(dataArray);
          for (let i = 2; i <= 20; i++) {
            if (dataArray[i] > 0) {
              hasRealData = true;
              break;
            }
          }
        } catch {}
      }

      if (!hasRealData) {
        const rawAmp = currentAmplitude || (getAmplitudeAtTime ? getAmplitudeAtTime(liveSec) : 0.4);
        for (let i = 0; i < 1024; i++) dataArray[i] = Math.floor(rawAmp * 120);

        if (isDrumming) {
          const beatPeriod = 60 / drumProfile.bpm;
          const beatPhase = (liveSec % beatPeriod) / beatPeriod;
          const isKickBeat = beatPhase < 0.12;
          const isSnareBeat = Math.abs(beatPhase - 0.5) < 0.10;

          if (isKickBeat && drumProfile.hasKick) {
            for (let i = 2; i <= 6; i++) dataArray[i] = Math.min(255, Math.floor(rawAmp * 255 * 1.5));
          }
          if (isSnareBeat && drumProfile.hasSnare) {
            for (let i = 70; i <= 140; i++) dataArray[i] = Math.min(255, Math.floor(rawAmp * 230 * 1.3));
            for (let i = 200; i <= 400; i++) dataArray[i] = Math.min(255, Math.floor(rawAmp * 210 * 1.2));
          }
        } else {
          for (let i = 2; i <= 10; i++) dataArray[i] = Math.floor(rawAmp * 40);
          for (let i = 70; i <= 140; i++) dataArray[i] = Math.floor(rawAmp * 50);
        }
      }

      // 1. SUB-BASS / KICK
      let bassSum = 0;
      for (let i = 2; i <= 6; i++) bassSum += dataArray[i];
      const currentBass = bassSum / 5;
      const fB = fastBassRef.current * 0.15 + currentBass * 0.85;
      const sB = slowBassRef.current * 0.88 + currentBass * 0.12;
      fastBassRef.current = fB;
      slowBassRef.current = sB;
      const bassFlux = Math.max(0, fB - sB);

      // 2. BASSLINE / 808
      let basslineSum = 0;
      for (let i = 3; i <= 12; i++) basslineSum += dataArray[i];
      const currentBassline = basslineSum / 10;
      smoothBasslineRef.current += ((currentBassline / 255) - smoothBasslineRef.current) * 0.22;

      // 3. SNARE DUAL-BAND GATE
      let midSum = 0;
      for (let i = 70; i <= 140; i++) midSum += dataArray[i];
      const currentMid = midSum / 71;
      const fM = fastMidRef.current * 0.15 + currentMid * 0.85;
      const sM = slowMidRef.current * 0.88 + currentMid * 0.12;
      fastMidRef.current = fM;
      slowMidRef.current = sM;
      const midFlux = Math.max(0, fM - sM);

      let highSum = 0;
      for (let i = 200; i <= 420; i++) highSum += dataArray[i];
      const currentHigh = highSum / 221;
      const fH = fastHighRef.current * 0.15 + currentHigh * 0.85;
      const sH = slowHighRef.current * 0.88 + currentHigh * 0.12;
      fastHighRef.current = fH;
      slowHighRef.current = sH;
      const highFlux = Math.max(0, fH - sH);

      // 4. TREBLE / HI-HATS
      let trebleSum = 0;
      for (let i = 232; i <= 743; i++) trebleSum += dataArray[i];
      const currentTreble = trebleSum / 512;
      const fT = fastTrebleRef.current * 0.15 + currentTreble * 0.85;
      const sT = slowTrebleRef.current * 0.88 + currentTreble * 0.12;
      fastTrebleRef.current = fT;
      slowTrebleRef.current = sT;
      const trebleFlux = Math.max(0, fT - sT);

      // 5. TOTAL AMBIENT ENERGY
      let totalSum = 0;
      for (let i = 0; i < 1024; i++) totalSum += dataArray[i];
      const currentEnergy = totalSum / 1024;
      smoothEnergyRef.current += ((currentEnergy / 255) - smoothEnergyRef.current) * 0.15;

      const liveWaveBeat = liveWaveformEngineRef.current.processLiveAnalyser(analyserRef?.current, now);

      if (isDrumming) {
        const timeSinceLastKick = now - lastKickHitTimeRef.current;
        const isConsecutiveKick = timeSinceLastKick >= 55 && timeSinceLastKick < 240;
        const kickThreshold = isConsecutiveKick
          ? 1.6 * drumProfile.fluxSensitivity
          : 2.6 * drumProfile.fluxSensitivity;

        const is808Sustaining = currentBass > 195 && bassFlux < 3.0;
        const hasBassTransient = bassFlux > kickThreshold && !is808Sustaining && timeSinceLastKick >= 55;
        const hasWaveformKick = liveWaveBeat.isBeat;

        if (hasBassTransient || hasWaveformKick) {
          lastKickHitTimeRef.current = now;
          const isSub808HeavyKick = (currentBass > 135 || bassFlux > 7.0 || (drumProfile.hasKick && currentBass > 115));

          if (isSub808HeavyKick) {
            const force = Math.min(0.110, 0.055 + bassFlux / 140);
            targetKickScaleRef.current += force;
            targetKickRedIntensityRef.current = 1.0;
          } else {
            const force = Math.min(0.058, 0.030 + bassFlux / 260);
            targetKickScaleRef.current += force;
            targetKickRedIntensityRef.current = Math.max(targetKickRedIntensityRef.current, 0.88);
          }
        }

        const timeSinceLastSnare = now - lastSnareHitTimeRef.current;
        const isSnare = midFlux > 3.0 * drumProfile.fluxSensitivity && highFlux > 1.3;
        if (isSnare && timeSinceLastSnare >= 65) {
          lastSnareHitTimeRef.current = now;
          targetSnareStrobeRef.current = Math.min(1.0, Math.max(0.35, midFlux / 16));
        }

        const timeSinceLastTreble = now - lastTrebleHitTimeRef.current;
        if (trebleFlux > 1.3 && timeSinceLastTreble >= 55) {
          lastTrebleHitTimeRef.current = now;
          targetTrebleStrobeRef.current = Math.min(1.0, Math.max(0.30, trebleFlux / 8));
        }
      }

      // Physics
      const tension = 0.30;
      const dampening = 0.65;
      const displacement = kickScaleRef.current - 1.0;
      targetKickScaleRef.current -= displacement * tension;
      targetKickScaleRef.current *= dampening;
      kickScaleRef.current += targetKickScaleRef.current;
      
      if (kickScaleRef.current < 0.985) kickScaleRef.current = 0.985;
      if (kickScaleRef.current > 1.15) kickScaleRef.current = 1.15;

      kickRedIntensityRef.current += (targetKickRedIntensityRef.current - kickRedIntensityRef.current) * 0.48;
      targetKickRedIntensityRef.current *= 0.70;

      snareStrobeRef.current += (targetSnareStrobeRef.current - snareStrobeRef.current) * 0.55;
      targetSnareStrobeRef.current *= 0.72;

      trebleStrobeRef.current += (targetTrebleStrobeRef.current - trebleStrobeRef.current) * 0.65;
      targetTrebleStrobeRef.current *= 0.58;

      const k = kickScaleRef.current;
      const s = snareStrobeRef.current;
      const nrg = smoothEnergyRef.current;

      const redIntensity = Math.min(1.0, Math.max(0, kickRedIntensityRef.current));
      const kickDelta = Math.max(0, k - 1.0);

      const g = Math.floor(255 - redIntensity * 230);
      const b = Math.floor(255 - redIntensity * 230);
      const kickColor = `255, ${g}, ${b}`;

      // Mini Player DOM
      if (miniBarRef.current) {
        miniBarRef.current.style.transform = `translateX(${swipeOffsetX}px) scale(${1 + kickDelta * 0.25})`;
        miniBarRef.current.style.borderColor = `rgba(${kickColor}, ${0.15 + kickDelta * 2.5})`;
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

      // Expanded Player DOM
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
        expandPlayBtnRef.current.style.boxShadow = `0 0 ${25 + kickDelta * 300 + s * 30}px rgba(255, 255, 255, ${0.4 + kickDelta * 4.0 + s * 0.3})`;
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

      rafIdRef.current = requestAnimationFrame(updateLiveMobileShow);
    };

    rafIdRef.current = requestAnimationFrame(updateLiveMobileShow);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPlaying, activeZone, currentTimeRef, audioRef, analyserRef, swipeOffsetX, effectiveDuration, shuffleMode, repeatMode, activeView]);

  // Mini bar swipe
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

  // Sheet swipe handlers
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
    const deltaY = sheetTouchDeltaYRef.current;
    if (deltaY > 50) {
      setIsExpanded(false);
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

  if (!isMounted || !currentTrack) return null;

  const displayLyrics = cleanLyrics(currentTrack?.lyrics);

  return (
    <>
      {/* MINI-PLAYER */}
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
          className="absolute inset-0 -inset-x-2 -inset-y-1 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-3xl blur-xl pointer-events-none transition-opacity duration-75 will-change-transform"
        />

        <div
          ref={miniBarRef}
          className="relative w-full backdrop-blur-2xl bg-zinc-950/85 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-2 border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.9)] transition-all duration-75 active:scale-[0.98] cursor-pointer overflow-hidden will-change-transform"
        >
          <div
            ref={miniSheenRef}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none opacity-0 will-change-transform"
          />

          <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
            <div
              ref={miniCoverRef}
              className="relative w-11 h-11 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 shadow-md border border-white/25 will-change-transform"
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
                className="text-xs font-cyber font-extrabold text-white truncate uppercase tracking-wide"
              >
                {currentTrack.title}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]" />
                <span className="text-[10px] text-zinc-400 font-mono font-bold truncate uppercase">
                  {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 relative z-10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleToggleLike}
              className="p-2 rounded-xl text-zinc-400 hover:text-white active:scale-90 transition-transform"
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
              className="p-2 rounded-xl text-zinc-300 hover:text-white active:scale-90 transition-transform will-change-transform"
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
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 flex-shrink-0 mx-0.5 will-change-transform"
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
              className="p-2 rounded-xl text-zinc-300 hover:text-white active:scale-90 transition-transform will-change-transform"
              title="Bài kế tiếp"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDED FULLSCREEN */}
      {isExpanded && (
        <div
          ref={expandRootRef}
          style={{ transform: `translateY(${sheetOffsetY}px)` }}
          className="fixed inset-0 z-50 bg-[#050507] text-white flex flex-col justify-between p-4 sm:p-6 pb-8 select-none animate-fadeIn transition-transform duration-75 overflow-hidden"
        >
          <div
            ref={expandLaserBorderRef}
            className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent opacity-20 transition-opacity pointer-events-none"
          />

          {/* HEADER DRAG ZONE */}
          <div
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
            className="flex items-center justify-between w-full flex-shrink-0 pt-1 pb-2 px-2 relative z-30 touch-none select-none"
          >
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition-all active:scale-95"
              title="Thu nhỏ trình phát"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            <div 
              onClick={() => setIsExpanded(false)}
              className="flex flex-col items-center text-center cursor-pointer flex-1 px-3 py-1"
            >
              <div className="w-12 h-1.5 bg-white/30 hover:bg-white/60 active:bg-white/90 rounded-full mb-1.5 transition-all shadow-sm" />
              <span className="text-[9px] font-mono tracking-[0.22em] text-zinc-400 uppercase font-bold">
                ĐANG PHÁT TỪ ALBUM
              </span>
              <span className="text-xs font-cyber font-extrabold text-white truncate max-w-[220px] uppercase mt-0.5">
                {currentAlbum?.title || 'HIDDEN DISC'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <TrackActionMenu track={currentTrack} album={currentAlbum} />
              <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-white/10 text-white/90 border border-white/15">
                FLAC
              </span>
            </div>
          </div>

          {/* SEGMENTED NAVIGATION */}
          <div className="w-full max-w-sm mx-auto px-2 py-2 relative z-20 flex-shrink-0">
            <div className="bg-zinc-950/80 border border-white/15 rounded-2xl p-1 flex items-center justify-between shadow-lg backdrop-blur-xl">
              <button
                onClick={() => setActiveView('player')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  activeView === 'player'
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Disc3 className={`w-3.5 h-3.5 ${activeView === 'player' && isPlaying ? 'animate-spin' : ''}`} />
                <span>TRÌNH PHÁT</span>
              </button>

              <button
                onClick={() => setActiveView('lyrics')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  activeView === 'lyrics'
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span>LỜI BÀI HÁT</span>
              </button>

              <button
                onClick={() => setActiveView('queue')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  activeView === 'queue'
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>HÀNG CHỜ</span>
              </button>
            </div>
          </div>

          {/* MAIN STAGE */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center my-auto relative w-full overflow-hidden">
            {/* VIEW 1: PLAYER */}
            {activeView === 'player' && (
              <div className="w-full flex flex-col items-center justify-center h-full animate-fadeIn relative overflow-visible px-4">
                <div
                  ref={expandCoverRef}
                  className="relative w-[68vw] max-w-[270px] aspect-square rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center mb-6 border border-white/20 will-change-transform z-10 flex-shrink-0 shadow-[0_20px_60px_rgba(0,0,0,0.95)]"
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

                <div className="flex items-center justify-between w-full max-w-[280px] relative z-10 px-1">
                  <div className="flex flex-col min-w-0 flex-1 mr-3">
                    <h2
                      ref={expandTitleRef}
                      className="text-lg sm:text-xl font-cyber font-black text-white truncate uppercase tracking-tight transition-all will-change-transform"
                    >
                      {currentTrack.title}
                    </h2>
                    <p 
                      ref={expandArtistRef}
                      className="text-xs font-mono text-zinc-400 truncate uppercase mt-1 transition-all tracking-wider font-bold"
                    >
                      {currentTrack.artist || currentAlbum?.artist || 'POSTLAIN VAULT'}
                    </p>
                  </div>

                  <button
                    ref={expandLikeBtnRef}
                    onClick={handleToggleLike}
                    className="p-2.5 rounded-2xl bg-white/5 border border-white/10 active:scale-90 transition-transform will-change-transform"
                    title={isLiked ? 'Đã yêu thích' : 'Yêu thích'}
                  >
                    <Heart
                      className={`w-5 h-5 transition-colors ${
                        isLiked ? 'text-white fill-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between w-full max-w-[280px] mt-4 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                    <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-300 uppercase">
                      24-BIT / 96kHz LOSSLESS
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-wider">
                    STEREO AUDIO
                  </span>
                </div>
              </div>
            )}

            {/* VIEW 2: LYRICS */}
            {activeView === 'lyrics' && (
              <div 
                className="w-full h-full overflow-y-auto no-scrollbar py-6 px-4 text-center select-text font-cyber animate-fadeIn"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {displayLyrics ? (
                  <p className="text-base sm:text-lg font-bold text-zinc-200 leading-relaxed whitespace-pre-line tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    {displayLyrics}
                  </p>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                    <Mic2 className="w-8 h-8 text-zinc-600 mb-2 opacity-50" />
                    <p className="text-xs uppercase tracking-widest font-mono">Chưa có lời bài hát cho ca khúc này</p>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: QUEUE */}
            {activeView === 'queue' && (
              <div
                className="w-full h-full overflow-y-auto no-scrollbar space-y-3 py-2 font-mono px-3 animate-fadeIn"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
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
                        className="text-[9px] font-mono text-zinc-500 hover:text-white transition-colors flex items-center gap-1 uppercase font-bold"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {userQueue.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                      <p className="text-xs text-zinc-400 font-bold">Hàng chờ trống</p>
                      <p className="text-[9px] text-zinc-600 mt-0.5">
                        Tự động phát ngẫu nhiên từ thư viện khi hết bài.
                      </p>
                    </div>
                  ) : (
                    userQueue.map((track, idx) => (
                      <div
                        key={`mob_queue_${track?.id || idx}_${idx}`}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10 active:bg-white/15 transition-all"
                      >
                        <div
                          onClick={() => {
                            if (track?.id) removeFromQueue(track.id);
                            playTrack(track, currentAlbum, playlist);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="text-[10px] font-mono text-zinc-500 w-4 text-center flex-shrink-0 font-bold">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs truncate font-bold text-white">{track?.title || 'Unknown Track'}</p>
                            <p className="text-[9px] text-zinc-500 truncate uppercase mt-0.5">{track?.artist || 'Unknown Artist'}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (track?.id) removeFromQueue(track.id);
                          }}
                          title="Xóa khỏi hàng chờ"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-white active:scale-90 transition-all ml-2 flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {playlist.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                        ĐANG PHÁT TỪ THƯ VIỆN ({playlist.length})
                      </span>
                      {shuffleMode && (
                        <span className="text-[8px] font-mono text-white font-bold bg-white/15 px-2 py-0.5 rounded border border-white/20">
                          SHUFFLE ON
                        </span>
                      )}
                    </div>
                    {playlist.map((track, idx) => {
                      const isCur = track?.id === currentTrack?.id;
                      return (
                        <div
                          key={track?.id || idx}
                          onClick={() => playTrack(track, currentAlbum, playlist)}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                            isCur
                              ? 'bg-white/15 border-white text-white font-bold shadow-md'
                              : 'bg-white/[0.02] border-white/5 text-zinc-400 active:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono text-zinc-500 w-4 text-center flex-shrink-0 font-bold">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs truncate font-bold">{track?.title || 'Unknown Track'}</p>
                              <p className="text-[9px] text-zinc-500 truncate mt-0.5">{track?.artist || currentAlbum?.artist || 'Unknown'}</p>
                            </div>
                          </div>
                          {isCur && <Disc3 className="w-4 h-4 text-white animate-spin flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CONTROL DECK */}
          <div className="w-full flex flex-col gap-3.5 flex-shrink-0 pt-2 pb-2 relative z-20">
            <div className="flex flex-col gap-1.5 w-full px-4">
              <div className="relative w-full flex items-center group">
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
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer border border-white/25 bg-zinc-900 focus:outline-none transition-all shadow-inner"
                  style={{
                    accentColor: '#ffffff',
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums font-bold px-0.5">
                <span ref={expandedCurrentTimeTextRef}>{formatTime(currentTime)}</span>
                <span>{formatTime(effectiveDuration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 max-w-sm mx-auto w-full">
              <button
                ref={expandShuffleBtnRef}
                onClick={toggleShuffle}
                className={`p-3 rounded-2xl border transition-all active:scale-95 will-change-transform ${
                  shuffleMode
                    ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] font-bold'
                    : 'bg-zinc-900/80 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Trộn bài"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                ref={expandPrevBtnRef}
                onClick={prevTrack}
                className="p-3.5 rounded-2xl bg-zinc-900/80 text-white border border-white/15 active:scale-90 hover:bg-white/10 transition-all will-change-transform shadow-md"
                title="Bài trước"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                ref={expandPlayBtnRef}
                onClick={togglePlay}
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.5)] border-2 border-white/40 active:scale-95 will-change-transform transition-transform relative group"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                <span className="absolute inset-1 rounded-full border border-black/10 pointer-events-none" />
                {isBuffering ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                ref={expandNextBtnRef}
                onClick={nextTrack}
                className="p-3.5 rounded-2xl bg-zinc-900/80 text-white border border-white/15 active:scale-90 hover:bg-white/10 transition-all will-change-transform shadow-md"
                title="Bài kế tiếp"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                ref={expandRepeatBtnRef}
                onClick={toggleRepeat}
                className={`p-3 rounded-2xl border transition-all active:scale-95 will-change-transform ${
                  repeatMode !== 'off'
                    ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] font-bold'
                    : 'bg-zinc-900/80 text-zinc-400 border-white/10 hover:text-white'
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
          </div>
        </div>
      )}
    </>
  );
}
