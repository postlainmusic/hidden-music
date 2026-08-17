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
  const isPCMReadyRef = useRef<boolean>(false);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lastUiTimeUpdateRef = useRef<number>(0);
  const trackUrl = useMemo(() => {
    if (!currentTrack) return '';
    if (currentTrack.source === 'youtube' || currentTrack.id.startsWith('yt_') || currentTrack.youtube_id) {
      const vid = currentTrack.youtube_id || currentTrack.id.replace(/^yt_/, '');
      return `/api/yt/stream/${vid}`;
    }
    return currentTrack.audio_url || '';
  }, [currentTrack]);

  // Reset beat map states on track change
  useEffect(() => {
    kickTimestampsRef.current = [];
    snareTimestampsRef.current = [];
    isPCMReadyRef.current = false;
  }, [currentTrack?.id]);

  // Instant Real-time streaming Web Audio Graph (Zero memory footprint, zero extra network request)
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

        // 1. Full Spectrum Master Analyser for Visualizer
        const masterAnalyser = audioCtx.createAnalyser();
        masterAnalyser.fftSize = 256;
        masterAnalyser.smoothingTimeConstant = 0.15;

        // 2. Real-time Kick Sub-Punch Analyser
        const kickFilter = audioCtx.createBiquadFilter();
        kickFilter.type = 'bandpass';
        kickFilter.frequency.value = 55;
        kickFilter.Q.value = 3.2;

        const kickAnalyser = audioCtx.createAnalyser();
        kickAnalyser.fftSize = 256;
        kickAnalyser.smoothingTimeConstant = 0.02;

        // 3. Real-time Snare / Clap Analyser
        const snareFilter = audioCtx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.value = 3200;
        snareFilter.Q.value = 1.8;

        const snareAnalyser = audioCtx.createAnalyser();
        snareAnalyser.fftSize = 256;
        snareAnalyser.smoothingTimeConstant = 0.04;

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
        isPCMReadyRef.current = true;
      }
    } catch (err) {
      console.warn('AudioAnalyser initialization note:', err);
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
      audioRef.current.play().catch((err) => {
        console.warn('Audio play blocked by browser policy:', err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }

    // MediaSession lockscreen and system notification integration
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist || currentAlbum?.artist || 'Hidden Vault',
          album: currentAlbum?.title || 'Hidden Music Vault',
          artwork: currentAlbum?.cover_url ? [
            { src: currentAlbum.cover_url, sizes: '96x96', type: 'image/jpeg' },
            { src: currentAlbum.cover_url, sizes: '128x128', type: 'image/jpeg' },
            { src: currentAlbum.cover_url, sizes: '256x256', type: 'image/jpeg' },
            { src: currentAlbum.cover_url, sizes: '512x512', type: 'image/jpeg' },
          ] : [],
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

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
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            seekTo(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skipTime = details.seekOffset || 10;
          seekTo(Math.max(0, currentTime - skipTime));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skipTime = details.seekOffset || 10;
          seekTo(Math.min(duration || 1000, currentTime + skipTime));
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          setIsPlaying(false);
        });

        if ('setPositionState' in navigator.mediaSession && duration > 0) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(duration, 1),
            playbackRate: 1.0,
            position: Math.min(Math.max(currentTime, 0), duration),
          });
        }
      } catch (e) {
        console.warn('MediaSession handler setup error:', e);
      }
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
      }}
    >
      {children}

      {/* Global Clean Background HTML5 Audio Element (Zero Buffering Stream) */}
      {currentTrack && trackUrl && (
        <audio
          ref={audioRef}
          src={trackUrl}
          crossOrigin="anonymous"
          preload="auto"
          autoPlay={isPlaying}
          onPlay={initAudioAnalyser}
          onTimeUpdate={(e) => {
            const target = e.currentTarget;
            currentTimeRef.current = target.currentTime;
            const now = performance.now();
            if (now - lastUiTimeUpdateRef.current > 250) {
              lastUiTimeUpdateRef.current = now;
              setCurrentTime(target.currentTime);
            }
          }}
          onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPause={(e) => setCurrentTime(e.currentTarget.currentTime)}
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
