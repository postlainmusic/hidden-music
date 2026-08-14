'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Album, TrackItem } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { hasActiveSession } from '@/lib/authSession';

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
  audioRef: React.RefObject<HTMLAudioElement>;
  analyserRef: React.RefObject<AnalyserNode | null>;
  kickAnalyserRef: React.RefObject<AnalyserNode | null>;
  snareAnalyserRef: React.RefObject<AnalyserNode | null>;
  kickTimestampsRef: React.RefObject<number[]>;
  snareTimestampsRef: React.RefObject<number[]>;
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
          if (typeof parsed?.currentTime === 'number') setCurrentTime(parsed.currentTime);
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
            currentTime: Math.floor(currentTime),
            volume,
            shuffleMode,
            repeatMode,
          })
        );
      }
    } catch {}
  }, [currentTrack, currentAlbum, playlist, volume, shuffleMode, repeatMode]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const kickAnalyserRef = useRef<AnalyserNode | null>(null);
  const snareAnalyserRef = useRef<AnalyserNode | null>(null);
  const kickTimestampsRef = useRef<number[]>([]);
  const snareTimestampsRef = useRef<number[]>([]);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rawTrackUrl = currentTrack?.audio_url || '';
  const trackUrl = rawTrackUrl;

  // Extract Separate Kick & Snare Timestamps from raw PCM AudioBuffer
  const processPCMBeatMap = async (url: string) => {
    if (!url || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);

      const sampleRate = audioBuffer.sampleRate;
      const channelData = audioBuffer.getChannelData(0);
      const len = channelData.length;

      // 1. Digital 55Hz Biquad Bandpass Filter for Kick Sub-Punch (High Q=3.5)
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

      // 2. Digital 3200Hz Biquad Bandpass Filter for Snare / Clap High Crack (Q=1.5)
      // High-frequency crack 3.2kHz rejects male singing vocals (which live below 1kHz)
      const f0S = 3200, QS = 1.5;
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

      const frameSize = Math.floor(sampleRate * 0.02); // 20ms frame
      const totalFrames = Math.floor(len / frameSize);

      // Compute Global Max Energies for Peak Normalization
      let maxEnergyK = 0;
      let maxEnergyS = 0;
      for (let f = 0; f < totalFrames; f++) {
        const start = f * frameSize;
        let sumK = 0, sumS = 0;
        for (let i = 0; i < frameSize; i++) {
          const k = filteredKick[start + i];
          const s = filteredSnare[start + i];
          sumK += k * k;
          sumS += s * s;
        }
        const eK = Math.sqrt(sumK / frameSize);
        const eS = Math.sqrt(sumS / frameSize);
        if (eK > maxEnergyK) maxEnergyK = eK;
        if (eS > maxEnergyS) maxEnergyS = eS;
      }

      // If the track's overall sub-punch peak is below 0.075 (like Piano/Chill track Night in Prague),
      // there are NO true Kick drums in this track! Do NOT extract false Kick timestamps.
      const hasRealKickDrums = maxEnergyK >= 0.075;
      const hasRealSnares = maxEnergyS >= 0.075;

      const kickStamps: number[] = [];
      const snareStamps: number[] = [];

      if (hasRealKickDrums || hasRealSnares) {
        let prevKickE = 0, smoothKickTrans = 0, lastKickSec = -1;
        let prevSnareE = 0, smoothSnareTrans = 0, lastSnareSec = -1;

        for (let f = 0; f < totalFrames; f++) {
          const start = f * frameSize;
          let sumK = 0, sumS = 0;
          for (let i = 0; i < frameSize; i++) {
            const k = filteredKick[start + i];
            const s = filteredSnare[start + i];
            sumK += k * k;
            sumS += s * s;
          }
          const eK = Math.sqrt(sumK / frameSize);
          const eS = Math.sqrt(sumS / frameSize);

          const deltaK = Math.max(0, eK - prevKickE);
          const deltaS = Math.max(0, eS - prevSnareE);
          prevKickE = eK;
          prevSnareE = eS;

          smoothKickTrans = smoothKickTrans * 0.85 + deltaK * 0.15;
          smoothSnareTrans = smoothSnareTrans * 0.85 + deltaS * 0.15;

          const threshK = Math.max(0.022, smoothKickTrans * 1.7);
          const threshS = Math.max(0.028, smoothSnareTrans * 1.8);

          const curSec = (f * frameSize) / sampleRate;

          // Kick drum impact (Requires absolute peak threshold eK > maxEnergyK * 0.45 AND eK > 0.055)
          if (hasRealKickDrums && deltaK > threshK && deltaK > 0.024 && eK > maxEnergyK * 0.45 && eK > 0.055 && (curSec - lastKickSec > 0.16)) {
            lastKickSec = curSec;
            kickStamps.push(Number(curSec.toFixed(3)));
          }

          // Snare / Clap impact (Requires absolute peak threshold eS > maxEnergyS * 0.45 AND eS > 0.055)
          if (hasRealSnares && deltaS > threshS && deltaS > 0.028 && eS > maxEnergyS * 0.45 && eS > 0.055 && (curSec - lastSnareSec > 0.16)) {
            lastSnareSec = curSec;
            snareStamps.push(Number(curSec.toFixed(3)));
          }
        }
      }

      kickTimestampsRef.current = kickStamps;
      snareTimestampsRef.current = snareStamps;
    } catch (e) {
      console.warn('PCM Beat map generation note:', e);
    }
  };

  const initAudioAnalyser = () => {
    if (!audioRef.current || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (!sourceRef.current && audioCtxRef.current) {
        const audioCtx = audioCtxRef.current;
        const source = audioCtx.createMediaElementSource(audioRef.current);

        // 1. Full Spectrum Master Analyser
        const masterAnalyser = audioCtx.createAnalyser();
        masterAnalyser.fftSize = 256;
        masterAnalyser.smoothingTimeConstant = 0.15;

        // 2. High-Q Trap Sub-Punch Kick Filter (Peak @ 58Hz, Band 45Hz-75Hz, Q=2.8)
        // High steepness Q=2.8 rejects male vocal fundamentals (100Hz+) and snare/clap frequencies
        const kickFilter = audioCtx.createBiquadFilter();
        kickFilter.type = 'bandpass';
        kickFilter.frequency.value = 58;
        kickFilter.Q.value = 2.8;

        const kickAnalyser = audioCtx.createAnalyser();
        kickAnalyser.fftSize = 256;
        kickAnalyser.smoothingTimeConstant = 0.02; // Instantaneous 60fps transient response

        // 3. Snare & Male Vocal Guard Filter (Peak @ 350Hz, Q=1.5)
        // Measures male vocal formants & Snare body to prevent false triggers
        const snareFilter = audioCtx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.value = 350;
        snareFilter.Q.value = 1.5;

        const snareAnalyser = audioCtx.createAnalyser();
        snareAnalyser.fftSize = 256;
        snareAnalyser.smoothingTimeConstant = 0.05;

        // Connect Audio Graph
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
  };

  const toggleCinematicFx = () => {
    setIsCinematicFxEnabled((prev) => !prev);
  };

  // Global User Interaction to unlock AudioContext for real-time Beat Analysis
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

  // Hard Refresh (Ctrl + F5, Shift + F5, Ctrl + Shift + R, Cmd + Shift + R) Handler
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

  // Load saved state from localStorage on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hidden_music_player_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentTrack) setCurrentTrack(parsed.currentTrack);
        if (parsed.currentAlbum) setCurrentAlbum(parsed.currentAlbum);
        if (parsed.playlist && parsed.playlist.length > 0) setPlaylist(parsed.playlist);
        if (typeof parsed.currentTime === 'number') setCurrentTime(parsed.currentTime);
        if (typeof parsed.volume === 'number') setVolumeState(parsed.volume);
        if (typeof parsed.shuffleMode === 'boolean') setShuffleMode(parsed.shuffleMode);
        if (parsed.repeatMode) setRepeatMode(parsed.repeatMode);
      }
    } catch (err) {
      console.warn('Failed to load player state from localStorage:', err);
    }
  }, []);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Save player state to localStorage on changes
  useEffect(() => {
    if (!currentTrack) return;
    try {
      const stateToSave = {
        currentTrack,
        currentAlbum,
        playlist,
        currentTime: currentTimeRef.current,
        volume,
        shuffleMode,
        repeatMode,
      };
      localStorage.setItem('hidden_music_player_state', JSON.stringify(stateToSave));
    } catch (err) {
      console.warn('Failed to save player state to localStorage:', err);
    }
  }, [currentTrack, currentAlbum, playlist, volume, shuffleMode, repeatMode]);

  // Sync Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Sync Play / Pause state with audio element
  useEffect(() => {
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

    // MediaSession lockscreen and system notification integration
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
  }, [isPlaying, trackUrl, currentTrack, currentAlbum]);

  const playTrack = (track: TrackItem, album?: Album | null, newPlaylist?: TrackItem[]) => {
    setCurrentTrack(track);
    if (album) setCurrentAlbum(album);
    if (newPlaylist && newPlaylist.length > 0) setPlaylist(newPlaylist);
    setIsPlaying(true);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (!currentTrack || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
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
  };

  const prevTrack = () => {
    if (!playlist || playlist.length === 0 || !currentTrack) return;

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(playlist[prevIndex], currentAlbum, playlist);
  };

  const seekTo = (time: number) => {
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
  };

  const toggleShuffle = () => {
    setShuffleMode((prev) => !prev);
  };

  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  return (
    <PlayerContext.Provider
      value={{
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
        toggleCinematicFx,
      }}
    >
      {children}

      {/* Global Clean Background HTML5 Audio Element */}
      {currentTrack && trackUrl && (
        <audio
          ref={audioRef}
          src={trackUrl}
          crossOrigin="anonymous"
          autoPlay={isPlaying}
          onPlay={initAudioAnalyser}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
              if (currentTime > 0 && Math.abs(audioRef.current.currentTime - currentTime) > 2) {
                audioRef.current.currentTime = currentTime;
              }
            }
          }}
          onEnded={nextTrack}
          onError={(e) => {
            console.warn('Audio element playback note:', currentTrack?.title, e);
          }}
          className="hidden"
        />
      )}
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
