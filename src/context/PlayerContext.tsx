'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Album, TrackItem, PlayerZone } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { hasActiveSession } from '@/lib/authSession';
import { getMediaCdnUrl } from '@/lib/r2Storage';

type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerContextType {
  currentTrack: TrackItem | null;
  currentAlbum: Album | null;
  playlist: TrackItem[];
  isPlaying: boolean;
  isBuffering: boolean;
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
  const [isBuffering, setIsBuffering] = useState(false);
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
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

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

  // Compute Next Track for Preloading (Zero-Gap Playback)
  const nextTrackItem = useMemo(() => {
    if (!playlist || playlist.length <= 1 || !currentTrack) return null;
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1) return null;
    const nextIdx = (currentIndex + 1) % playlist.length;
    return playlist[nextIdx];
  }, [playlist, currentTrack]);

  const nextTrackUrl = useMemo(() => {
    if (!nextTrackItem?.audio_url) return '';
    return getMediaCdnUrl(nextTrackItem.audio_url);
  }, [nextTrackItem]);

  // Initialize Web Audio Graph with 100Hz Lowpass Biquad Filter
  const initAudioAnalyser = useCallback(() => {
    if (!audioRef.current || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (
        audioCtxRef.current &&
        (audioCtxRef.current.state === 'suspended' || audioCtxRef.current.state === 'interrupted')
      ) {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (!sourceRef.current && audioCtxRef.current && audioRef.current) {
        const audioCtx = audioCtxRef.current;
        const source = audioCtx.createMediaElementSource(audioRef.current);

        // Precision 2nd-order Lowpass Filter isolating Kick/Sub-Bass (< 100Hz, Q=1.2)
        const lowpass = audioCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 100;
        lowpass.Q.value = 1.2;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.05;

        // Route: Source -> Lowpass -> Analyser
        source.connect(lowpass);
        lowpass.connect(analyser);

        // Output Route: Source -> Destination (Crystal clear direct audio output)
        source.connect(audioCtx.destination);

        analyserRef.current = analyser;
        sourceRef.current = source;
      }
    } catch (err) {
      console.warn('AudioAnalyser setup note:', err);
    }
  }, []);

  // Global user interaction handler to unlock AudioContext
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlockAudio = () => {
      if (
        audioCtxRef.current &&
        (audioCtxRef.current.state === 'suspended' || audioCtxRef.current.state === 'interrupted')
      ) {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const toggleCinematicFx = useCallback(() => {
    setIsCinematicFxEnabled((prev) => !prev);
  }, []);

  // Switch to Audio Zone cleanly
  const switchToAudioZone = useCallback(() => {
    setActiveZone('audio');
  }, []);

  // Switch to Video Zone cleanly (frees RAM, unloads audio stream completely)
  const switchToVideoZone = useCallback((track?: TrackItem) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      try {
        audioRef.current.load();
      } catch {}
    }
    setIsPlaying(false);
    setIsBuffering(false);
    if (track) {
      setCurrentTrack(track);
    }
    setActiveZone('video');
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
          document.cookie = 'hidden_vault_admin=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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

  // Sync Volume to Native Audio
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
        artwork: currentAlbum?.cover_url
          ? [{ src: currentAlbum.cover_url, sizes: '512x512', type: 'image/jpeg' }]
          : [],
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
  }, [isPlaying, trackUrl, currentTrack, currentAlbum, activeZone, initAudioAnalyser]);

  const playTrack = useCallback((track: TrackItem, album?: Album | null, newPlaylist?: TrackItem[]) => {
    setCurrentTrack(track);
    if (album) setCurrentAlbum(album);
    if (newPlaylist && newPlaylist.length > 0) setPlaylist(newPlaylist);
    setActiveZone('audio');
    setIsPlaying(true);
    setIsBuffering(false);
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
      initAudioAnalyser();
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, initAudioAnalyser]);

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
      isBuffering,
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
      isBuffering,
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

      {/* HTML5 Audio Engine with Lowpass Web Audio Analyser & CORS Support */}
      <audio
        ref={audioRef}
        src={activeZone === 'audio' && currentTrack ? trackUrl : undefined}
        preload="auto"
        crossOrigin="anonymous"
        onPlay={() => {
          initAudioAnalyser();
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onCanPlayThrough={() => setIsBuffering(false)}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const cur = audioRef.current.currentTime;
          currentTimeRef.current = cur;

          // Throttled React state update every 350ms to eliminate re-render lag
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
          setIsBuffering(false);
          console.warn('Audio playback note:', currentTrack?.title, e);
        }}
        className="hidden"
      />

      {/* Hidden Preloader for Next Track (Zero-Gap Instant Playback) */}
      {activeZone === 'audio' && nextTrackUrl && (
        <audio src={nextTrackUrl} preload="auto" crossOrigin="anonymous" className="hidden" />
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
