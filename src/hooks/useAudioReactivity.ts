'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { BeatGridResult, analyzeTrackBeatGrid, getCachedBeatGrid } from '@/lib/audioBeatEngine';

export interface AudioReactivityState {
  isKick: boolean;
  isHeavy: boolean;
  kickStrength: number;
  scale: number;
  flashIntensity: number;
  beatGrid: BeatGridResult | null;
  isReady: boolean;
}

export function useAudioReactivity() {
  const { currentTrack, isPlaying, activeZone, audioRef, currentTimeRef, currentTime } = usePlayer();

  const [reactivityState, setReactivityState] = useState<AudioReactivityState>({
    isKick: false,
    isHeavy: false,
    kickStrength: 0,
    scale: 1,
    flashIntensity: 0,
    beatGrid: null,
    isReady: false,
  });

  const beatGridRef = useRef<BeatGridResult | null>(null);
  const lastFiredBeatIdxRef = useRef<number>(-1);
  const animFrameIdRef = useRef<number | null>(null);

  const curScaleRef = useRef<number>(1);
  const curFlashRef = useRef<number>(0);
  const isHeavyRef = useRef<boolean>(false);
  const isKickRef = useRef<boolean>(false);
  const kickStrengthRef = useRef<number>(0);

  // 1. Load or calculate Beat Grid automatically on track change
  useEffect(() => {
    if (!currentTrack?.id || !currentTrack?.audio_url) {
      beatGridRef.current = null;
      lastFiredBeatIdxRef.current = -1;
      setReactivityState((prev) => ({ ...prev, beatGrid: null, isReady: false }));
      return;
    }

    let isMounted = true;
    lastFiredBeatIdxRef.current = -1;

    // Instant local cache check
    getCachedBeatGrid(currentTrack.id).then((cached) => {
      if (isMounted && cached && cached.timestamps.length > 0) {
        beatGridRef.current = cached;
        setReactivityState((prev) => ({ ...prev, beatGrid: cached, isReady: true }));
      }
    });

    // Run full pipeline in background
    analyzeTrackBeatGrid(currentTrack.audio_url, currentTrack.id).then((result) => {
      if (isMounted && result) {
        beatGridRef.current = result;
        setReactivityState((prev) => ({ ...prev, beatGrid: result, isReady: true }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id, currentTrack?.audio_url]);

  // 2. High-Speed 60FPS requestAnimationFrame Synchronization
  useEffect(() => {
    if (!isPlaying || activeZone !== 'audio') {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      curScaleRef.current = 1;
      curFlashRef.current = 0;
      isKickRef.current = false;
      return;
    }

    const syncBeatFrame = () => {
      const grid = beatGridRef.current;
      const liveTime = currentTimeRef?.current ?? (audioRef?.current ? audioRef.current.currentTime : currentTime);

      let triggeredNow = false;

      if (grid && grid.timestamps.length > 0) {
        const timestamps = grid.timestamps;
        const strengths = grid.strengths;
        const beats = grid.beats;

        for (let i = 0; i < timestamps.length; i++) {
          const diff = liveTime - timestamps[i];
          // Time window tolerance: -22ms to +35ms
          if (diff >= -0.022 && diff <= 0.035 && i !== lastFiredBeatIdxRef.current) {
            lastFiredBeatIdxRef.current = i;
            triggeredNow = true;

            const str = strengths[i] || 0.8;
            const isHeavy = beats[i]?.isHeavy ?? str > 0.75;

            isKickRef.current = true;
            isHeavyRef.current = isHeavy;
            kickStrengthRef.current = str;

            curScaleRef.current = isHeavy ? 1.055 : 1.025;
            curFlashRef.current = isHeavy ? 1.0 : 0.60;
            break;
          }
        }
      }

      if (!triggeredNow) {
        // Exponential spring decay
        curFlashRef.current *= 0.70;
        curScaleRef.current += (1.0 - curScaleRef.current) * 0.32;
        if (curFlashRef.current < 0.02) {
          curFlashRef.current = 0;
          isKickRef.current = false;
        }
        if (Math.abs(curScaleRef.current - 1.0) < 0.001) {
          curScaleRef.current = 1.0;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(syncBeatFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(syncBeatFrame);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, activeZone, currentTimeRef, audioRef, currentTime]);

  return {
    beatGridRef,
    curScaleRef,
    curFlashRef,
    isHeavyRef,
    isKickRef,
    kickStrengthRef,
    isReady: reactivityState.isReady,
  };
}
