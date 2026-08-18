'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Album, TrackItem, PlayerZone } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { hasActiveSession } from '@/lib/authSession';
import { getMediaCdnUrl } from '@/lib/r2Storage';

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextType {
  currentTrack: TrackItem | null;
  currentAlbum: Album | null;
  playlist: TrackItem[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffleMode: boolean;
  repeatMode: RepeatMode;
  isCinematicFxEnabled: boolean;
  activeZone: PlayerZone;
  audioRef: React.RefObject<HTMLAudioElement>;
  currentTimeRef: React.RefObject<number>;
  analyserRef: React.RefObject<AnalyserNode | null>;
  kickAnalyserRef: React.RefObject<AnalyserNode | null>;
  snareAnalyserRef: React.RefObject<AnalyserNode | null>;
  kickTimestampsRef: React.RefObject<number[]>;
  snareTimestampsRef: React.RefObject<number[]>;
  isPCMReadyRef: React.RefObject<boolean>;
  playTrack: (track: TrackItem, album?: Album | null, playlist?: TrackItem[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleCinematicFx: () => void;
  setActiveZone: (zone: PlayerZone) => void;
  switchToAudioZone: () => void;
  switchToVideoZone: (track?: TrackItem) => void;
}

const PLAYER_STATE_KEY = 'hidden_vault_player_state';

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [playlist, setPlaylist] = useState<TrackItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [shuffleMode, setShuffleMode] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [isCinematicFxEnabled, setIsCinematicFxEnabled] = useState(true);
  const [activeZone, setActiveZone] = useState<PlayerZone>('audio');

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTimeRef = useRef<number>(0);
  const lastStateUpdateTimeRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const kickAnalyserRef = useRef<AnalyserNode | null>(null);
  const snareAnalyserRef = useRef<AnalyserNode | null>(null);
  const kickTimestampsRef = useRef<number[]>([]);
  const snareTimestampsRef = useRef<number[]>([]);
  const isPCMReadyRef = useRef<boolean>(false);
  const currentProcessingUrlRef = useRef<string>('');
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Restore player state safely on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncPlayerWithAuth = () => {
      if (!hasActiveSession()) {
        setCurrentTrack(null);
        setCurrentAlbum(null);
        setPlaylist([]);
        setIsPlaying(false);
        try {
          localStorage.removeItem(PLAYER_STATE_KEY);
        } catch {}
        return;
      }

      try {
        const saved = localStorage.getItem(PLAYER_STATE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.currentTrack) setCurrentTrack(parsed.currentTrack);
          if (parsed?.currentAlbum) setCurrentAlbum(parsed.currentAlbum);
          if (Array.isArray(parsed?.playlist)) setPlaylist(parsed.playlist);
          if (typeof parsed?.currentTime === 'number') {
            setCurrentTime(parsed.currentTime);
            currentTimeRef.current = parsed.currentTime;
          }
          if (typeof parsed?.volume === 'number') setVolumeState(parsed.volume);
          if (typeof parsed?.shuffleMode === 'boolean') setShuffleMode(parsed.shuffleMode);
          if (parsed?.repeatMode) setRepeatMode(parsed.repeatMode);
        }
      } catch (err) {
        console.warn('Player state restore warning:', err);
      }
    };

    syncPlayerWithAuth();

    window.addEventListener('vault_auth_change', syncPlayerWithAuth);
    window.addEventListener('storage', syncPlayerWithAuth);

    return () => {
      window.removeEventListener('vault_auth_change', syncPlayerWithAuth);
      window.removeEventListener('storage', syncPlayerWithAuth);
    };
  }, []);

  // Auto save player state to localStorage across F5
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentTrack) {
        localStorage.setItem(
          PLAYER_STATE_KEY,
          JSON.stringify({
            currentTrack,
            currentAlbum,
            playlist,
            currentTime: Math.floor(currentTimeRef.current),
            volume,
            shuffleMode,
            repeatMode,
          })
        );
      }
    } catch {}
  }, [currentTrack, currentAlbum, playlist, volume, shuffleMode, repeatMode]);

  const rawTrackUrl = currentTrack?.audio_url || '';
  const trackUrl = useMemo(() => {
    if (!rawTrackUrl) return '';
    return getMediaCdnUrl(rawTrackUrl);
  }, [rawTrackUrl]);

  // Reset beat map states on track change
  useEffect(() => {
    kickTimestampsRef.current = [];
    snareTimestampsRef.current = [];
    isPCMReadyRef.current = false;
  }, [currentTrack?.id]);

  // Extract Separate Kick & Snare Timestamps from raw PCM AudioBuffer
  const processPCMBeatMap = useCallback(async (url: string) => {
    if (!url || typeof window === 'undefined') return;
    currentProcessingUrlRef.current = url;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      if (currentProcessingUrlRef.current !== url) return;

      const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      if (currentProcessingUrlRef.current !== url) return;

      const sampleRate = audioBuffer.sampleRate;
      const channelData = audioBuffer.getChannelData(0);
      const len = channelData.length;

      // 1. Digital 55Hz Biquad Bandpass Filter for Kick Sub-Punch
      const f0K = 55, QK = 3.5;
      const w0K = (2 * Math.PI * f0K) / sampleRate;
      const alphaK = Math.sin(w0K) / (2 * QK);
      const B0K = alphaK / (1 + alphaK), B2K = -alphaK / (1 + alphaK);
      const A1K = (-2 * Math.cos(w0K)) / (1 + alphaK), A2K = (1 - alphaK) / (1 + alphaK);

      const filteredKick = new Float32Array(len);
      let x1K = 0, x2K = 0, y1K = 0, y2K = 0;
      for (let i = 0; i < len; i++) {
        const x0 = channelData[i];
        const y0 = B0K * x0 + B2K * x2K - A1K * y1K - A2K * y2K;
        x2K = x1K; x1K = x0; y2K = y1K; y1K = y0;
        filteredKick[i] = y0;
      }

      // 2. Digital 3200Hz Biquad Bandpass Filter for Snare / Clap High Crack
      const f0S = 3200, QS = 1.8;
      const w0S = (2 * Math.PI * f0S) / sampleRate;
      const alphaS = Math.sin(w0S) / (2 * QS);
      const B0S = alphaS / (1 + alphaS), B2S = -alphaS / (1 + alphaS);
      const A1S = (-2 * Math.cos(w0S)) / (1 + alphaS), A2S = (1 - alphaS) / (1 + alphaS);

      const filteredSnare = new Float32Array(len);
      let x1S = 0, x2S = 0, y1S = 0, y2S = 0;
      for (let i = 0; i < len; i++) {
        const x0 = channelData[i];
        const y0 = B0S * x0 + B2S * x2S - A1S * y1S - A2S * y2S;
        x2S = x1S; x1S = x0; y2S = y1S; y1S = y0;
        filteredSnare[i] = y0;
      }

      // 3. Digital 600Hz Mid-Range Guard Filter
      const f0M = 600, QM = 1.0;
      const w0M = (2 * Math.PI * f0M) / sampleRate;
      const alphaM = Math.sin(w0M) / (2 * QM);
      const B0M = alphaM / (1 + alphaM), B2M = -alphaM / (1 + alphaM);
      const A1M = (-2 * Math.cos(w0M)) / (1 + alphaM), A2M = (1 - alphaM) / (1 + alphaM);

      const filteredMid = new Float32Array(len);
      let x1M = 0, x2M = 0, y1M = 0, y2M = 0;
      for (let i = 0; i < len; i++) {
        const x0 = channelData[i];
        const y0 = B0M * x0 + B2M * x2M - A1M * y1M - A2M * y2M;
        x2M = x1M; x1M = x0; y2M = y1M; y1M = y0;
        filteredMid[i] = y0;
      }

      const frameSize = Math.floor(sampleRate * 0.02); // 20ms frame
      const totalFrames = Math.floor(len / frameSize);

      let maxEnergyK = 0;
      let maxEnergyS = 0;
      let maxEnergyM = 0;
      for (let f = 0; f < totalFrames; f++) {
        const start = f * frameSize;
        let sumK = 0, sumS = 0, sumM = 0;
        for (let i = 0; i < frameSize; i++) {
          const k = filteredKick[start + i];
          const s = filteredSnare[start + i];
          const m = filteredMid[start + i];
          sumK += k * k;
          sumS += s * s;
          sumM += m * m;
        }
        const eK = Math.sqrt(sumK / frameSize);
        const eS = Math.sqrt(sumS / frameSize);
        const eM = Math.sqrt(sumM / frameSize);
        if (eK > maxEnergyK) maxEnergyK = eK;
        if (eS > maxEnergyS) maxEnergyS = eS;
        if (eM > maxEnergyM) maxEnergyM = eM;
      }

      const hasRealKickDrums = maxEnergyK >= 0.080 && (maxEnergyM === 0 || maxEnergyK / maxEnergyM >= 0.30);
      const hasRealSnares = maxEnergyS >= 0.080 && (maxEnergyM === 0 || maxEnergyS / maxEnergyM >= 0.28);

      const kickStamps: number[] = [];
      const snareStamps: number[] = [];

      if (hasRealKickDrums || hasRealSnares) {
        let prevKickE = 0, smoothKickTrans = 0, lastKickSec = -1;
        let prevSnareE = 0, smoothSnareTrans = 0, lastSnareSec = -1;

        for (let f = 0; f < totalFrames; f++) {
          const start = f * frameSize;
          let sumK = 0, sumS = 0, sumM = 0;
          for (let i = 0; i < frameSize; i++) {
            const k = filteredKick[start + i];
            const s = filteredSnare[start + i];
            const m = filteredMid[start + i];
            sumK += k * k;
            sumS += s * s;
            sumM += m * m;
          }
          const eK = Math.sqrt(sumK / frameSize);
          const eS = Math.sqrt(sumS / frameSize);
          const eM = Math.sqrt(sumM / frameSize);

          const deltaK = Math.max(0, eK - prevKickE);
          const deltaS = Math.max(0, eS - prevSnareE);
          prevKickE = eK;
          prevSnareE = eS;

          smoothKickTrans = smoothKickTrans * 0.85 + deltaK * 0.15;
          smoothSnareTrans = smoothSnareTrans * 0.85 + deltaS * 0.15;

          const threshK = Math.max(0.026, smoothKickTrans * 1.8);
          const threshS = Math.max(0.032, smoothSnareTrans * 1.9);
          const curSec = (f * frameSize) / sampleRate;

          if (
            hasRealKickDrums &&
            deltaK > threshK &&
            deltaK > 0.026 &&
            eK > maxEnergyK * 0.50 &&
            eK > 0.065 &&
            eK >= eM * 0.48 &&
            (curSec - lastKickSec > 0.16)
          ) {
            lastKickSec = curSec;
            kickStamps.push(Number(curSec.toFixed(3)));
          }

          if (
            hasRealSnares &&
            deltaS > threshS &&
            deltaS > 0.032 &&
            eS > maxEnergyS * 0.50 &&
            eS > 0.068 &&
            eS >= eM * 0.42 &&
            (curSec - lastSnareSec > 0.16)
          ) {
            lastSnareSec = curSec;
            snareStamps.push(Number(curSec.toFixed(3)));
          }
        }
      }

      if (currentProcessingUrlRef.current === url) {
        kickTimestampsRef.current = kickStamps;
        snareTimestampsRef.current = snareStamps;
        isPCMReadyRef.current = true;
      }
    } catch (e) {
      console.warn('PCM Beat map generation note:', e);
      if (currentProcessingUrlRef.current === url) {
        isPCMReadyRef.current = true;
      }
    }
  }, []);

  const initAudioAnalyser = useCallback(() => {
    if (!audioRef.current || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended' || audioCtxRef.current.state === 'interrupted') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (!sourceRef.current && audioCtxRef.current) {
        const audioCtx = audioCtxRef.current;
        const source = audioCtx.createMediaElementSource(audioRef.current);

        const masterAnalyser = audioCtx.createAnalyser();
        masterAnalyser.fftSize = 256;
        masterAnalyser.smoothingTimeConstant = 0.15;

        const kickFilter = audioCtx.createBiquadFilter();
        kickFilter.type = 'lowpass';
        kickFilter.frequency.value = 140;
        kickFilter.Q.value = 1.2;

        const kickAnalyser = audioCtx.createAnalyser();
        kickAnalyser.fftSize = 256;
        kickAnalyser.smoothingTimeConstant = 0.04;

        const snareFilter = audioCtx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.value = 2800;
        snareFilter.Q.value = 1.6;

        const snareAnalyser = audioCtx.createAnalyser();
        snareAnalyser.fftSize = 256;
        snareAnalyser.smoothingTimeConstant = 0.04;

        source.connect(masterAnalyser);
        source.connect(kickFilter);
        kickFilter.connect(kickAnalyser);

        source.connect(snareFilter);
        snareFilter.connect(snareAnalyser);

        source.connect(audioCtx.destination);

        analyserRef.current = masterAnalyser;
        kickAnalyserRef.current = kickAnalyser;
        snareAnalyserRef.current = snareAnalyser;
        sourceRef.current = source;
      }
    } catch (err) {
      console.warn('AudioAnalyser initialization warning:', err);
    }
  }, []);

  const toggleCinematicFx = useCallback(() => {
    setIsCinematicFxEnabled((prev) => !prev);
  }, []);

  // Switch to Audio Zone cleanly
  const switchToAudioZone = useCallback(() => {
    setActiveZone('audio');
  }, []);

  // Switch to Video Zone cleanly (frees RAM, unloads audio decoding buffer completely)
  const switchToVideoZone = useCallback((track?: TrackItem) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      try {
        audioRef.current.load();
      } catch {}
    }
    setIsPlaying(false);
    if (track) {
      setCurrentTrack(track);
    }
    setActiveZone('video');
  }, []);

  // Global User Interaction to unlock AudioContext
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudioCtx = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    window.addEventListener('click', unlockAudioCtx, { passive: true });
    window.addEventListener('touchstart', unlockAudioCtx, { passive: true });
    window.addEventListener('keydown', unlockAudioCtx, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudioCtx);
      window.removeEventListener('touchstart', unlockAudioCtx);
      window.removeEventListener('keydown', unlockAudioCtx);
    };
  }, []);

  // Hard Refresh Handler
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHardRefresh = async (e: KeyboardEvent) => {
      const isF5 = e.key === 'F5' || e.keyCode === 116;
      const isR = e.key === 'r' || e.key === 'R' || e.keyCode === 82;

      const isHardF5 = isF5 && (e.ctrlKey || e.shiftKey || e.metaKey);
      const isHardR = isR && (e.ctrlKey || e.metaKey) && e.shiftKey;

      if (isHardF5 || isHardR) {
        e.preventDefault();
        try {
          localStorage.clear();
          sessionStorage.clear();
          document.cookie = "hidden_vault_admin=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          const supabase = createClient();
          await supabase.auth.signOut().catch(() => {});
        } catch (err) {
          console.warn('Hard refresh cleanup warning:', err);
        } finally {
          window.history.replaceState(null, '', '/');
          window.location.href = '/';
        }
      }
    };

    window.addEventListener('keydown', handleHardRefresh, true);
    return () => window.removeEventListener('keydown', handleHardRefresh, true);
  }, []);

  // Sync Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Sync Play / Pause state with audio element (Audio Zone ONLY)
  useEffect(() => {
    if (activeZone === 'video') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        try {
          audioRef.current.load();
        } catch {}
      }
      return;
    }

    if (!audioRef.current || !trackUrl) return;
    if (audioRef.current.muted) {
      audioRef.current.pause();
      return;
    }

    if (isPlaying) {
      initAudioAnalyser();
      processPCMBeatMap(trackUrl);
      audioRef.current.play().catch((err) => {
        console.warn('Audio play blocked by browser policy:', err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }

    // MediaSession lockscreen integration
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || currentAlbum?.artist || 'Hidden Vault',
        album: currentAlbum?.title || 'Hidden Music Vault',
        artwork: currentAlbum?.cover_url ? [
          { src: currentAlbum.cover_url, sizes: '512x512', type: 'image/jpeg' },
        ] : [],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack();
      });
    }
  }, [isPlaying, trackUrl, currentTrack, currentAlbum, activeZone, initAudioAnalyser, processPCMBeatMap]);

  const playTrack = useCallback((track: TrackItem, album?: Album | null, newPlaylist?: TrackItem[]) => {
    setCurrentTrack(track);
    if (album) setCurrentAlbum(album);
    if (newPlaylist && newPlaylist.length > 0) setPlaylist(newPlaylist);
    setActiveZone('audio');
    setIsPlaying(true);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    if (audioCtxRef.current && (audioCtxRef.current.state === 'suspended' || audioCtxRef.current.state === 'interrupted')) {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentTrack || !audioRef.current) return;
    if (audioCtxRef.current && (audioCtxRef.current.state === 'suspended' || audioCtxRef.current.state === 'interrupted')) {
      audioCtxRef.current.resume().catch(() => {});
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setActiveZone('audio');
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying]);

  const seekTo = useCallback((time: number) => {
    currentTimeRef.current = time;
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const nextTrack = useCallback(() => {
    if (!playlist || playlist.length === 0 || !currentTrack) return;

    if (repeatMode === 'one') {
      seekTo(0);
      setIsPlaying(true);
      return;
    }

    let nextIndex = 0;
    if (shuffleMode) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
      nextIndex = (currentIndex + 1) % playlist.length;
    }

    playTrack(playlist[nextIndex], currentAlbum, playlist);
  }, [playlist, currentTrack, repeatMode, shuffleMode, currentAlbum, seekTo, playTrack]);

  const prevTrack = useCallback(() => {
    if (!playlist || playlist.length === 0 || !currentTrack) return;

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(playlist[prevIndex], currentAlbum, playlist);
  }, [playlist, currentTrack, currentAlbum, playTrack]);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const contextValue = useMemo(
    () => ({
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
      activeZone,
      audioRef,
      currentTimeRef,
      analyserRef,
      kickAnalyserRef,
      snareAnalyserRef,
      kickTimestampsRef,
      snareTimestampsRef,
      isPCMReadyRef,
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
      toggleCinematicFx,
      setActiveZone,
      switchToAudioZone,
      switchToVideoZone,
    }),
    [
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
      activeZone,
      playTrack,
      togglePlay,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleShuffle,
      toggleRepeat,
      toggleCinematicFx,
      switchToAudioZone,
      switchToVideoZone,
    ]
  );

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}

      {/* Permanent Singleton Background HTML5 Audio Element with Fixed MediaElementSource */}
      <audio
        ref={audioRef}
        src={activeZone === 'audio' && currentTrack ? trackUrl : undefined}
        preload="auto"
        crossOrigin="anonymous"
        onPlay={() => {
          initAudioAnalyser();
        }}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const cur = audioRef.current.currentTime;
          currentTimeRef.current = cur;

          // Throttled React state update every 350ms to eliminate 60FPS re-render lag
          const now = performance.now();
          if (now - lastStateUpdateTimeRef.current > 350) {
            lastStateUpdateTimeRef.current = now;
            setCurrentTime(cur);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            if (currentTimeRef.current > 0 && Math.abs(audioRef.current.currentTime - currentTimeRef.current) > 2) {
              audioRef.current.currentTime = currentTimeRef.current;
            }
          }
        }}
        onEnded={nextTrack}
        onError={(e) => {
          console.warn('Audio playback note:', currentTrack?.title, e);
        }}
        className="hidden"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
