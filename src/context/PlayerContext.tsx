'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Album, TrackItem, PlayerZone } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { hasActiveSession, hasVideoSubscription, activateVideoSubscription } from '@/lib/authSession';
import { getMediaCdnUrl } from '@/lib/r2Storage';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerContextType {
  // Audio & Core Track States
  currentTrack: TrackItem | null;
  currentAlbum: Album | null;
  playlist: TrackItem[];
  userQueue: TrackItem[];
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffleMode: boolean;
  repeatMode: RepeatMode;
  isCinematicFxEnabled: boolean;
  activeZone: PlayerZone;

  // Audio DSP & Waveform Engine (50ms Buckets $O(1)$)
  waveformBuckets: number[];
  currentAmplitude: number;
  getAmplitudeAtTime: (timeSec: number) => number;

  // Multimedia Super App & Scaling States
  isPremium: boolean;
  currentVideo: TrackItem | null;
  isFullscreen: boolean;
  isPaywallOpen: boolean;
  isPiPActive: boolean;
  videoPlaybackRate: number;

  // Native Elements & References
  audioRef: React.RefObject<HTMLAudioElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  currentTimeRef: React.RefObject<number>;

  // Audio Controls
  playTrack: (track: TrackItem, album?: Album | Partial<Album> | null, playlist?: TrackItem[]) => void;
  addToQueue: (track: TrackItem) => void;
  addToUserQueue: (track: TrackItem) => void;
  removeFromUserQueue: (trackId: string) => void;
  removeFromQueue: (trackId: string) => void;
  clearUserQueue: () => void;
  clearQueue: () => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
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
  isHapticEnabled: boolean;
  toggleHaptic: () => void;
  subscribeToTimeUpdate: (callback: (timeSec: number) => void) => () => void;
  analyserRef?: React.RefObject<AnalyserNode | null>;

  // Video & Zone Controls
  setActiveZone: (zone: PlayerZone) => void;
  switchToAudioZone: () => void;
  switchToVideoZone: (track?: TrackItem, album?: Album | null) => void;
  playVideo: (track: TrackItem, album?: Album | null) => void;
  closeVideo: () => void;

  // Premium & Paywall Controls
  setIsPremium: React.Dispatch<React.SetStateAction<boolean>>;
  openPaywall: () => void;
  closePaywall: () => void;
  handleUpgrade: (plan?: string) => Promise<void>;

  // Fullscreen & Web Picture-in-Picture Controls
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleFullscreen: (element?: HTMLElement | null) => Promise<void>;
  togglePiP: () => Promise<void>;
  setVideoPlaybackRate: (rate: number) => void;
}

const PLAYER_STATE_KEY = 'hidden_vault_player_state';
const WAVEFORM_CACHE = new Map<string, number[]>();

function generateDeterministicWaveform(trackId: string, durationSec: number): number[] {
  if (WAVEFORM_CACHE.has(trackId)) {
    return WAVEFORM_CACHE.get(trackId)!;
  }

  const safeDuration = Math.max(10, durationSec || 180);
  const totalBuckets = Math.floor(safeDuration * 20); // 50ms per bucket
  const buckets: number[] = new Array(totalBuckets);

  let seed = 0;
  for (let i = 0; i < trackId.length; i++) {
    seed = (seed * 31 + trackId.charCodeAt(i)) & 0xffffffff;
  }

  const pseudoRandom = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const bpm = 120 + (Math.abs(seed) % 40);
  const beatIntervalSec = 60 / bpm;
  const beatBucketInterval = Math.max(1, Math.round(beatIntervalSec * 20));

  for (let i = 0; i < totalBuckets; i++) {
    const t = i * 0.05;
    const progress = t / safeDuration;

    let macroEnvelope = 0.5;
    if (progress < 0.08) {
      macroEnvelope = 0.2 + 0.6 * (progress / 0.08);
    } else if (progress > 0.92) {
      macroEnvelope = 0.8 * (1 - (progress - 0.92) / 0.08);
    } else if (progress > 0.45 && progress < 0.55) {
      macroEnvelope = 0.35 + 0.2 * Math.sin((progress - 0.45) * Math.PI * 10);
    } else {
      macroEnvelope = 0.65 + 0.35 * Math.sin(progress * Math.PI * 4);
    }

    const isBeat = i % beatBucketInterval < 2;
    const isOffbeat = (i + Math.floor(beatBucketInterval / 2)) % beatBucketInterval < 2;
    const transient = isBeat ? 0.35 : isOffbeat ? 0.2 : 0;
    const noise = pseudoRandom(i) * 0.25;
    const subHarmonic = 0.15 * Math.sin(t * 8.0) + 0.1 * Math.sin(t * 19.5);

    const rawAmp = macroEnvelope * 0.5 + transient + noise + subHarmonic;
    buckets[i] = Math.max(0.05, Math.min(1.0, Number(rawAmp.toFixed(3))));
  }

  WAVEFORM_CACHE.set(trackId, buckets);
  return buckets;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // Audio & Core State
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [playlist, setPlaylist] = useState<TrackItem[]>([]);
  const [userQueue, setUserQueue] = useState<TrackItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [shuffleMode, setShuffleMode] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [isCinematicFxEnabled, setIsCinematicFxEnabled] = useState(true);
  const [activeZone, setActiveZone] = useState<PlayerZone>('audio');

  // DSP & Waveform State
  const [waveformBuckets, setWaveformBuckets] = useState<number[]>([]);
  const [currentAmplitude, setCurrentAmplitude] = useState<number>(0);

  // Multimedia Super App & Scaling States
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [currentVideo, setCurrentVideo] = useState<TrackItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [isPiPActive, setIsPiPActive] = useState<boolean>(false);
  const [videoPlaybackRate, setVideoPlaybackRateState] = useState<number>(1.0);
  const [isHapticEnabled, setIsHapticEnabled] = useState<boolean>(true);

  // References
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTimeRef = useRef<number>(0);
  const lastStateUpdateTimeRef = useRef<number>(0);
  const timeSubscribersRef = useRef<Set<(time: number) => void>>(new Set());

  const subscribeToTimeUpdate = useCallback((callback: (timeSec: number) => void) => {
    timeSubscribersRef.current.add(callback);
    return () => {
      timeSubscribersRef.current.delete(callback);
    };
  }, []);

  const toggleHaptic = useCallback(() => {
    setIsHapticEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hidden_vault_haptic_enabled', String(next));
      } catch {}
      return next;
    });
  }, []);

  const checkAndSyncPremium = useCallback(() => {
    if (typeof window === 'undefined') return;
    const hasSub = hasVideoSubscription();
    setIsPremium(hasSub);
    try {
      const savedHaptic = localStorage.getItem('hidden_vault_haptic_enabled');
      if (savedHaptic !== null) setIsHapticEnabled(savedHaptic === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    if (!currentTrack) {
      setWaveformBuckets([]);
      setCurrentAmplitude(0);
      return;
    }
    const trackDuration = duration || currentTrack.duration || 180;
    const buckets = generateDeterministicWaveform(currentTrack.id, trackDuration);
    setWaveformBuckets(buckets);
  }, [currentTrack, duration]);

  const getAmplitudeAtTime = useCallback(
    (timeSec: number): number => {
      if (waveformBuckets.length === 0) return 0;
      const bucketIdx = Math.max(0, Math.min(waveformBuckets.length - 1, Math.floor(timeSec * 20)));
      return waveformBuckets[bucketIdx] ?? 0;
    },
    [waveformBuckets]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    checkAndSyncPremium();

    const syncPlayerWithAuth = () => {
      checkAndSyncPremium();

      if (!hasActiveSession()) {
        setCurrentTrack(null);
        setCurrentAlbum(null);
        setCurrentVideo(null);
        setPlaylist([]);
        setUserQueue([]);
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
          if (parsed?.currentVideo) setCurrentVideo(parsed.currentVideo);
          if (parsed?.activeZone) setActiveZone(parsed.activeZone);
          if (Array.isArray(parsed?.playlist)) setPlaylist(parsed.playlist);
          if (Array.isArray(parsed?.userQueue)) setUserQueue(parsed.userQueue);
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
    window.addEventListener('vault_profile_updated', syncPlayerWithAuth);
    window.addEventListener('storage', syncPlayerWithAuth);

    return () => {
      window.removeEventListener('vault_auth_change', syncPlayerWithAuth);
      window.removeEventListener('vault_profile_updated', syncPlayerWithAuth);
      window.removeEventListener('storage', syncPlayerWithAuth);
    };
  }, [checkAndSyncPremium]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentTrack || currentVideo) {
        localStorage.setItem(
          PLAYER_STATE_KEY,
          JSON.stringify({
            currentTrack,
            currentAlbum,
            currentVideo,
            activeZone,
            playlist: playlist || [],
            userQueue: userQueue || [],
            currentTime: Math.floor(currentTimeRef.current),
            volume,
            shuffleMode,
            repeatMode,
          })
        );
      }
    } catch {}
  }, [currentTrack, currentAlbum, currentVideo, activeZone, playlist, userQueue, volume, shuffleMode, repeatMode]);

  const [resolvedTrackUrl, setResolvedTrackUrl] = useState<string>('');
  const rawTrackUrl = currentTrack?.audio_url || '';

  useEffect(() => {
    if (!currentTrack) {
      setResolvedTrackUrl('');
      return;
    }

    const rawUrl = currentTrack.audio_url || '';
    const ytmId = currentTrack.youtube_id || (rawUrl.startsWith('yt:') ? rawUrl.replace(/^yt:/, '') : '');

    if (ytmId && (rawUrl.startsWith('yt:') || !rawUrl.startsWith('http'))) {
      let isCancelled = false;
      setIsBuffering(true);

      fetch(`/api/ytm/resolve?id=${encodeURIComponent(ytmId)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Resolve HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (!isCancelled && data?.audioUrl) {
            setResolvedTrackUrl(data.audioUrl);
            if (data.duration && (!duration || duration === 0)) {
              setDuration(data.duration);
            }
          }
        })
        .catch((err) => {
          console.warn('[PlayerContext] Stream resolve warning:', err);
        })
        .finally(() => {
          if (!isCancelled) setIsBuffering(false);
        });

      return () => {
        isCancelled = true;
      };
    } else {
      setResolvedTrackUrl(rawUrl ? getMediaCdnUrl(rawUrl) : '');
    }
  }, [currentTrack]);

  const trackUrl = resolvedTrackUrl || (rawTrackUrl ? getMediaCdnUrl(rawTrackUrl) : '');

  const nextTrackItem = useMemo(() => {
    if (userQueue && userQueue.length > 0) {
      return userQueue[0];
    }
    const safePlaylist = playlist || [];
    if (safePlaylist.length <= 1 || !currentTrack) return null;
    const currentIndex = safePlaylist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1) return safePlaylist[0] || null;
    const nextIdx = (currentIndex + 1) % safePlaylist.length;
    return safePlaylist[nextIdx] || null;
  }, [playlist, userQueue, currentTrack]);

  const nextTrackUrl = useMemo(() => {
    if (!nextTrackItem?.audio_url || nextTrackItem.audio_url.startsWith('yt:')) return '';
    return getMediaCdnUrl(nextTrackItem.audio_url);
  }, [nextTrackItem]);

  const toggleCinematicFx = useCallback(() => {
    setIsCinematicFxEnabled((prev) => !prev);
  }, []);

  const switchToAudioZone = useCallback(() => {
    setActiveZone('audio');
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
    }
  }, []);

  const switchToVideoZone = useCallback((track?: TrackItem, album?: Album | null) => {
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
      setCurrentVideo(track);
    }
    if (album) {
      setCurrentAlbum(album);
    }
    setActiveZone('video');
  }, []);

  const playVideo = useCallback(
    (track: TrackItem, album?: Album | null) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        try {
          audioRef.current.load();
        } catch {}
      }

      setCurrentVideo(track);
      setCurrentTrack(track);
      if (album) setCurrentAlbum(album);
      setActiveZone('video');
      setIsPlaying(true);
      setIsBuffering(false);
      setCurrentTime(0);
      currentTimeRef.current = 0;
    },
    []
  );

  const closeVideo = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    setCurrentVideo(null);
    setActiveZone('audio');
  }, []);

  const openPaywall = useCallback(() => {
    setIsPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setIsPaywallOpen(false);
  }, []);

  const handleUpgrade = useCallback(async (plan = 'vip') => {
    try {
      activateVideoSubscription();
      setIsPremium(true);
      setIsPaywallOpen(false);
      window.dispatchEvent(new CustomEvent('vault_auth_change'));
    } catch (err) {
      console.error('Upgrade process failed:', err);
    }
  }, []);

  const toggleFullscreen = useCallback(async (element?: HTMLElement | null) => {
    if (typeof window === 'undefined') return;
    try {
      const target = element || document.documentElement;
      if (!document.fullscreenElement) {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
        } else if ((target as any).webkitRequestFullscreen) {
          await (target as any).webkitRequestFullscreen();
        } else if ((target as any).msRequestFullscreen) {
          await (target as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle notice:', err);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (typeof window === 'undefined' || !videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn('PiP toggle notice:', err);
    }
  }, []);

  const setVideoPlaybackRate = useCallback((rate: number) => {
    setVideoPlaybackRateState(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  }, []);

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

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

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
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err?.name !== 'AbortError') {
            console.warn('Audio play notice:', err);
            setIsPlaying(false);
          }
        });
      }
    } else {
      audioRef.current.pause();
    }

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
  }, [isPlaying, trackUrl, currentTrack, currentAlbum, activeZone]);

  const playTrack = useCallback((track: TrackItem, album?: Album | Partial<Album> | null, newPlaylist?: TrackItem[]) => {
    if (!track) return;
    setCurrentTrack(track);
    if (album) setCurrentAlbum(album as Album);
    if (newPlaylist && Array.isArray(newPlaylist) && newPlaylist.length > 0) {
      setPlaylist(newPlaylist);
    }
    setActiveZone('audio');
    setIsPlaying(true);
    setIsBuffering(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
  }, []);

  const togglePlay = useCallback(() => {
    if (activeZone === 'video') {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    if (!currentTrack || !audioRef.current) return;
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setActiveZone('audio');
      setIsPlaying(true);
    }
  }, [activeZone, currentTrack, isPlaying]);

  const seekTo = useCallback(
    (time: number) => {
      currentTimeRef.current = time;
      setCurrentTime(time);
      if (activeZone === 'video' && videoRef.current) {
        videoRef.current.currentTime = time;
      } else if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    },
    [activeZone]
  );

  const nextTrack = useCallback(() => {
    if (userQueue && userQueue.length > 0) {
      const [nextQueued, ...remainingQueue] = userQueue;
      setUserQueue(remainingQueue);
      if (nextQueued) {
        playTrack(nextQueued, currentAlbum, playlist);
        return;
      }
    }

    const safePlaylist = playlist || [];
    if (safePlaylist.length === 0 || !currentTrack) return;

    if (repeatMode === 'one') {
      seekTo(0);
      setIsPlaying(true);
      return;
    }

    let nextIndex = 0;
    if (shuffleMode) {
      nextIndex = Math.floor(Math.random() * safePlaylist.length);
    } else {
      const currentIndex = safePlaylist.findIndex((t) => t.id === currentTrack.id);
      nextIndex = (currentIndex + 1) % safePlaylist.length;
    }

    const targetTrack = safePlaylist[nextIndex];
    if (targetTrack) {
      playTrack(targetTrack, currentAlbum, safePlaylist);
    }
  }, [userQueue, playlist, currentTrack, repeatMode, shuffleMode, currentAlbum, seekTo, playTrack]);

  const prevTrack = useCallback(() => {
    const safePlaylist = playlist || [];
    if (safePlaylist.length === 0 || !currentTrack) return;

    const currentIndex = safePlaylist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + safePlaylist.length) % safePlaylist.length;
    const targetTrack = safePlaylist[prevIndex];
    if (targetTrack) {
      playTrack(targetTrack, currentAlbum, safePlaylist);
    }
  }, [playlist, currentTrack, currentAlbum, playTrack]);

  const addToQueue = useCallback((track: TrackItem) => {
    if (!track) return;
    setPlaylist((prev) => {
      const safe = prev || [];
      if (safe.some((t) => t.id === track.id)) return safe;
      return [...safe, track];
    });
  }, []);

  const addToUserQueue = useCallback((track: TrackItem) => {
    if (!track) return;
    setUserQueue((prev) => {
      const safe = prev || [];
      if (safe.some((t) => t.id === track.id)) return safe;
      return [...safe, track];
    });
  }, []);

  const removeFromUserQueue = useCallback((trackId: string) => {
    setUserQueue((prev) => (prev || []).filter((t) => t.id !== trackId));
  }, []);

  const clearUserQueue = useCallback(() => {
    setUserQueue([]);
  }, []);

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
      playlist: playlist || [],
      userQueue: userQueue || [],
      isPlaying,
      isBuffering,
      currentTime,
      duration,
      volume,
      shuffleMode,
      repeatMode,
      isCinematicFxEnabled,
      activeZone,
      waveformBuckets,
      currentAmplitude,
      getAmplitudeAtTime,
      isPremium,
      currentVideo,
      isFullscreen,
      isPaywallOpen,
      isPiPActive,
      videoPlaybackRate,
      audioRef,
      videoRef,
      currentTimeRef,
      playTrack,
      addToQueue,
      addToUserQueue,
      removeFromUserQueue,
      removeFromQueue: removeFromUserQueue,
      clearUserQueue,
      clearQueue: clearUserQueue,
      togglePlay,
      pause: () => setIsPlaying(false),
      resume: () => setIsPlaying(true),
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
      isHapticEnabled,
      toggleHaptic,
      subscribeToTimeUpdate,
      setActiveZone,
      switchToAudioZone,
      switchToVideoZone,
      playVideo,
      closeVideo,
      setIsPremium,
      openPaywall,
      closePaywall,
      handleUpgrade,
      setIsFullscreen,
      toggleFullscreen,
      togglePiP,
      setVideoPlaybackRate,
    }),
    [
      currentTrack,
      currentAlbum,
      playlist,
      userQueue,
      isPlaying,
      isBuffering,
      currentTime,
      duration,
      volume,
      shuffleMode,
      repeatMode,
      isCinematicFxEnabled,
      isHapticEnabled,
      activeZone,
      waveformBuckets,
      currentAmplitude,
      getAmplitudeAtTime,
      isPremium,
      currentVideo,
      isFullscreen,
      isPaywallOpen,
      isPiPActive,
      videoPlaybackRate,
      playTrack,
      addToQueue,
      addToUserQueue,
      removeFromUserQueue,
      clearUserQueue,
      togglePlay,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleShuffle,
      toggleRepeat,
      toggleCinematicFx,
      toggleHaptic,
      subscribeToTimeUpdate,
      switchToAudioZone,
      switchToVideoZone,
      playVideo,
      closeVideo,
      openPaywall,
      closePaywall,
      handleUpgrade,
      toggleFullscreen,
      togglePiP,
      setVideoPlaybackRate,
    ]
  );

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}

      <audio
        ref={audioRef}
        src={activeZone === 'audio' && currentTrack ? trackUrl : undefined}
        preload="auto"
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onCanPlayThrough={() => setIsBuffering(false)}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const cur = audioRef.current.currentTime;
          currentTimeRef.current = cur;

          // Dispatch to 120 FPS high-frequency subscribers without React re-render
          timeSubscribersRef.current.forEach((cb) => {
            try {
              cb(cur);
            } catch {}
          });

          if (waveformBuckets.length > 0) {
            const bIdx = Math.max(0, Math.min(waveformBuckets.length - 1, Math.floor(cur * 20)));
            setCurrentAmplitude(waveformBuckets[bIdx] ?? 0);
          }

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
        onError={() => {
          setIsBuffering(false);
        }}
        className="hidden"
      />

      {activeZone === 'audio' && nextTrackUrl && (
        <audio src={nextTrackUrl} preload="auto" className="hidden" />
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
