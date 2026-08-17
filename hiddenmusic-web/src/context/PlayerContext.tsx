'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from 'react';
import { Album, TrackItem } from '../types/database';
import { getAudioStreamUrl } from '../lib/api';
import { hasActiveSession } from '../lib/authSession';

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
  audioRef: React.RefObject<HTMLAudioElement>;
  analyserRef: React.RefObject<AnalyserNode | null>;
  playTrack: (track: TrackItem, album?: Album | null, newPlaylist?: TrackItem[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  addToQueue: (track: TrackItem) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [playlist, setPlaylist] = useState<TrackItem[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [shuffleMode, setShuffleMode] = useState<boolean>(false);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>('all');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lastUiTimeUpdateRef = useRef<number>(0);

  const trackUrl = useMemo(() => {
    if (!currentTrack) return '';
    return getAudioStreamUrl(currentTrack);
  }, [currentTrack]);

  // Initialize Web Audio API Analyser
  useEffect(() => {
    const initAudioGraph = () => {
      if (!audioRef.current || audioContextRef.current) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;

        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      } catch (e) {
        console.warn('Web Audio Graph initialization note:', e);
      }
    };

    const handleFirstInteraction = () => {
      initAudioGraph();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Update MediaSession on track change
  useEffect(() => {
    if (!currentTrack || typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist || currentAlbum?.artist || 'Hidden Vault Artist',
      album: currentAlbum?.title || 'Hidden Music Vault',
      artwork: [
        {
          src: currentTrack.cover_url || currentAlbum?.cover_url || '/icon.svg',
          sizes: '512x512',
          type: 'image/jpeg',
        },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime);
    });
  }, [currentTrack, currentAlbum]);

  const playTrack = (track: TrackItem, album?: Album | null, newPlaylist?: TrackItem[]) => {
    setCurrentTrack(track);
    if (album) setCurrentAlbum(album);
    if (newPlaylist && newPlaylist.length > 0) {
      setPlaylist(newPlaylist);
    } else if (!playlist.some((t) => t.id === track.id)) {
      setPlaylist((prev) => [...prev, track]);
    }
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.warn);
      setIsPlaying(true);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play().catch(console.warn);
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const toggleShuffle = () => {
    setShuffleMode((prev) => !prev);
  };

  const setRepeatMode = (mode: RepeatMode) => {
    setRepeatModeState(mode);
  };

  const nextTrack = () => {
    if (playlist.length === 0 || !currentTrack) return;

    if (shuffleMode && playlist.length > 1) {
      const remaining = playlist.filter((t) => t.id !== currentTrack.id);
      const random = remaining[Math.floor(Math.random() * remaining.length)];
      playTrack(random, currentAlbum, playlist);
      return;
    }

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
      playTrack(playlist[currentIndex + 1], currentAlbum, playlist);
    } else if (repeatMode === 'all') {
      playTrack(playlist[0], currentAlbum, playlist);
    } else {
      setIsPlaying(false);
    }
  };

  const prevTrack = () => {
    if (playlist.length === 0 || !currentTrack) return;
    if (currentTime > 3) {
      seek(0);
      return;
    }
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex > 0) {
      playTrack(playlist[currentIndex - 1], currentAlbum, playlist);
    } else if (repeatMode === 'all') {
      playTrack(playlist[playlist.length - 1], currentAlbum, playlist);
    } else {
      seek(0);
    }
  };

  const addToQueue = (track: TrackItem) => {
    setPlaylist((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const now = performance.now();
    if (now - lastUiTimeUpdateRef.current > 250) {
      lastUiTimeUpdateRef.current = now;
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || currentTrack?.duration || 0);
      audioRef.current.volume = volume;
      if (isPlaying) {
        audioRef.current.play().catch(console.warn);
      }
    }
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.warn);
      }
    } else {
      nextTrack();
    }
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
        audioRef: audioRef as any,
        analyserRef,
        playTrack,
        togglePlay,
        pause,
        resume,
        seek,
        setVolume,
        toggleShuffle,
        setRepeatMode,
        nextTrack,
        prevTrack,
        addToQueue,
      }}
    >
      {children}
      <audio
        ref={audioRef}
        src={trackUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="auto"
      />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
