'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Album, TrackItem, PlayerZone } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { hasActiveSession, hasVideoSubscription, activateVideoSubscription } from '@/lib/authSession';
import { getMediaCdnUrl } from '@/lib/r2Storage';
import { getTrackDrumProfile, isDrumActiveAtTime } from '@/lib/dsp/trackDrumProfiles';
import { incrementPlaysCount } from '@/lib/pocketbaseService';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

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
  isMuted: boolean;
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
  playNextInQueue: (track: TrackItem) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
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
  toggleMute: () => void;
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

function generateDeterministicWaveform(trackId: string, durationSec: number, trackTitle?: string): number[] {
  const cacheKey = `${trackId}_${trackTitle || ''}`;
  if (WAVEFORM_CACHE.has(cacheKey)) {
    return WAVEFORM_CACHE.get(cacheKey)!;
  }

  const profile = getTrackDrumProfile(trackTitle || trackId);
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

  const bpm = profile.bpm || 120;
  const beatIntervalSec = 60 / bpm;
  const beatBucketInterval = Math.max(1, Math.round(beatIntervalSec * 20));

  for (let i = 0; i < totalBuckets; i++) {
    const t = i * 0.05;
    const progress = t / safeDuration;
    const hasDrums = isDrumActiveAtTime(profile, t);

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

    let transient = 0;
    if (hasDrums) {
      const isBeat = i % beatBucketInterval < 2;
      const isOffbeat = (i + Math.floor(beatBucketInterval / 2)) % beatBucketInterval < 2;
      transient = isBeat ? 0.40 : isOffbeat ? 0.22 : 0;
    }

    const noise = pseudoRandom(i) * 0.15;
    const subHarmonic = hasDrums ? (0.15 * Math.sin(t * 8.0) + 0.1 * Math.sin(t * 19.5)) : (0.05 * Math.sin(t * 2.0));

    const rawAmp = hasDrums
      ? macroEnvelope * 0.45 + transient + noise + subHarmonic
      : 0.15 + 0.08 * Math.sin(t * 1.5) + noise * 0.5;

    buckets[i] = Math.max(0.05, Math.min(1.0, Number(rawAmp.toFixed(3))));
  }

  WAVEFORM_CACHE.set(cacheKey, buckets);
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // YouTube Audio Bridge References
  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);

  const initAudioGraph = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }

      if (audioContextRef.current && !analyserRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
      }

      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }

      // Connect Audio graph with safety fallback
      if (audioRef.current && audioContextRef.current && analyserRef.current && !sourceNodeRef.current) {
        try {
          const source = audioContextRef.current.createMediaElementSource(audioRef.current);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          sourceNodeRef.current = source;
        } catch {
          // Fallback: If browser restricts CORS or source already connected, silently ignore
        }
      }
    } catch {}
  }, []);

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
    const buckets = generateDeterministicWaveform(currentTrack.id, trackDuration, currentTrack.title);
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

  // ── Track Source Resolution (Lossless Vault vs YouTube Bridge) ─────────────
  const rawTrackUrl = currentTrack?.audio_url || '';
  const isCurrentTrackYouTube = Boolean(
    currentTrack &&
      (currentTrack.youtube_id ||
        rawTrackUrl.startsWith('yt:') ||
        currentTrack.id?.startsWith('yt:') ||
        currentTrack.id?.startsWith('yt_'))
  );

  const currentYouTubeId = useMemo(() => {
    if (!currentTrack) return '';
    if (currentTrack.youtube_id) return currentTrack.youtube_id.replace(/^yt:/, '');
    if (rawTrackUrl.startsWith('yt:')) return rawTrackUrl.replace(/^yt:/, '');
    if (currentTrack.id?.startsWith('yt:')) return currentTrack.id.replace(/^yt:/, '');
    if (currentTrack.id?.startsWith('yt_')) return currentTrack.id.replace(/^yt_/, '');
    return '';
  }, [currentTrack, rawTrackUrl]);

  // For Vault FLAC/Lossless tracks only (zero 404 for YouTube tracks)
  const trackUrl = isCurrentTrackYouTube
    ? ''
    : rawTrackUrl
    ? getMediaCdnUrl(rawTrackUrl)
    : '';

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
    if (ytPlayerRef.current?.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo(); } catch {}
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
      if (ytPlayerRef.current?.pauseVideo) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
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
    if (ytPlayerRef.current?.setVolume) {
      try {
        ytPlayerRef.current.setVolume(Math.round(volume * 100));
      } catch {}
    }
  }, [volume]);

  // ── HTML5 Audio Player Controller (for Vault Lossless) ───────────────────────
  useEffect(() => {
    if (activeZone === 'video' || isCurrentTrackYouTube) {
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
      initAudioGraph();
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
  }, [isPlaying, trackUrl, isCurrentTrackYouTube, activeZone, initAudioGraph]);

  const playTrack = useCallback((track: TrackItem, album?: Album | Partial<Album> | null, newPlaylist?: TrackItem[]) => {
    if (!track) return;
    initAudioGraph();
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

    // Increment plays count asynchronously in PocketBase
    if (track.id) {
      incrementPlaysCount(track.id).catch(() => {});
    }
  }, [initAudioGraph]);

  const seekTo = useCallback(
    (time: number) => {
      currentTimeRef.current = time;
      setCurrentTime(time);
      if (activeZone === 'video' && videoRef.current) {
        videoRef.current.currentTime = time;
      } else if (isCurrentTrackYouTube && ytPlayerRef.current?.seekTo) {
        try {
          ytPlayerRef.current.seekTo(time, true);
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    },
    [activeZone, isCurrentTrackYouTube]
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

    if (currentTimeRef.current > 3) {
      seekTo(0);
      return;
    }

    let prevIndex = 0;
    if (shuffleMode) {
      prevIndex = Math.floor(Math.random() * safePlaylist.length);
    } else {
      const currentIndex = safePlaylist.findIndex((t) => t.id === currentTrack.id);
      prevIndex = (currentIndex - 1 + safePlaylist.length) % safePlaylist.length;
    }

    const targetTrack = safePlaylist[prevIndex];
    if (targetTrack) {
      playTrack(targetTrack, currentAlbum, safePlaylist);
    }
  }, [playlist, currentTrack, shuffleMode, currentAlbum, seekTo, playTrack]);

  const togglePlay = useCallback(() => {
    initAudioGraph();
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

    if (!currentTrack) return;

    if (isCurrentTrackYouTube) {
      if (isPlaying) {
        try {
          ytPlayerRef.current?.pauseVideo();
        } catch {}
        setIsPlaying(false);
      } else {
        setActiveZone('audio');
        try {
          ytPlayerRef.current?.playVideo();
        } catch {}
        setIsPlaying(true);
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setActiveZone('audio');
      setIsPlaying(true);
    }
  }, [activeZone, currentTrack, isPlaying, isCurrentTrackYouTube, initAudioGraph]);

  const pause = useCallback(() => {
    if (isCurrentTrackYouTube) {
      try { ytPlayerRef.current?.pauseVideo(); } catch {}
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [isCurrentTrackYouTube]);

  const resume = useCallback(() => {
    initAudioGraph();
    if (isCurrentTrackYouTube) {
      try { ytPlayerRef.current?.playVideo(); } catch {}
    } else if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(true);
  }, [isCurrentTrackYouTube, initAudioGraph]);

  // ── YouTube Audio Bridge Lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initYT = () => {
      if (!window.YT || !window.YT.Player) return;
      if (ytPlayerRef.current) return;

      try {
        ytPlayerRef.current = new window.YT.Player('vault-yt-audio-bridge-target', {
          height: '1',
          width: '1',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              ytPlayerReadyRef.current = true;
              try {
                event.target.setVolume(Math.round(volume * 100));
              } catch {}
            },
            onStateChange: (event: any) => {
              // 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 5 = CUED
              if (event.data === 0) {
                nextTrack();
              } else if (event.data === 1) {
                setIsPlaying(true);
                setIsBuffering(false);
              } else if (event.data === 2) {
                setIsPlaying(false);
              } else if (event.data === 3) {
                setIsBuffering(true);
              }
            },
            onError: (event: any) => {
              console.warn('[YouTube Audio Bridge] Player error:', event.data);
              setIsBuffering(false);
            },
          },
        });
      } catch (e) {
        console.warn('[YouTube Audio Bridge] Init error:', e);
      }
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      const existingScript = document.getElementById('yt-iframe-api-script');
      if (!existingScript) {
        const prevHandler = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof prevHandler === 'function') prevHandler();
          initYT();
        };
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      } else {
        const timer = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(timer);
            initYT();
          }
        }, 200);
        return () => clearInterval(timer);
      }
    }
  }, [volume, nextTrack]);

  // Switch/Load YouTube Track
  useEffect(() => {
    if (activeZone === 'video') {
      if (ytPlayerRef.current?.pauseVideo) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
      }
      return;
    }

    if (!isCurrentTrackYouTube || !currentYouTubeId) {
      if (ytPlayerRef.current?.pauseVideo) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
      }
      return;
    }

    // Stop HTML5 audio immediately
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    if (ytPlayerReadyRef.current && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.loadVideoById(currentYouTubeId, 0);
        } else {
          ytPlayerRef.current.cueVideoById(currentYouTubeId);
        }
      } catch (e) {
        console.warn('[YouTube Audio Bridge] Load track error:', e);
      }
    }
  }, [isCurrentTrackYouTube, currentYouTubeId, isPlaying, activeZone]);

  // YouTube Audio Bridge Continuous Time Synchronizer (60/120 FPS)
  useEffect(() => {
    if (!isCurrentTrackYouTube || !isPlaying || activeZone === 'video') return;

    const interval = setInterval(() => {
      if (!ytPlayerRef.current || typeof ytPlayerRef.current.getCurrentTime !== 'function') return;
      try {
        const cur = ytPlayerRef.current.getCurrentTime();
        if (typeof cur === 'number' && !isNaN(cur)) {
          currentTimeRef.current = cur;

          timeSubscribersRef.current.forEach((cb) => {
            try { cb(cur); } catch {}
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
        }

        const dur = ytPlayerRef.current.getDuration();
        if (typeof dur === 'number' && dur > 0 && Math.abs(dur - (duration || 0)) > 2) {
          const trueDuration = Math.round(dur);
          setDuration(trueDuration);
          setCurrentTrack((prev) => (prev ? { ...prev, duration: trueDuration } : prev));
          setPlaylist((prev) =>
            prev.map((t) => (t.id === currentTrack?.id ? { ...t, duration: trueDuration } : t))
          );
        }
      } catch {}
    }, 100);

    return () => clearInterval(interval);
  }, [isCurrentTrackYouTube, isPlaying, activeZone, waveformBuckets, duration, currentTrack?.id]);

  // Mute and Volume Management
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const previousVolumeRef = useRef<number>(0.8);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
    if (audioRef.current) audioRef.current.volume = clamped;
    if (videoRef.current) videoRef.current.volume = clamped;
    if (ytPlayerRef.current?.setVolume) {
      try {
        ytPlayerRef.current.setVolume(Math.round(clamped * 100));
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      if (prevMuted) {
        const restored = previousVolumeRef.current > 0 ? previousVolumeRef.current : 0.8;
        setVolumeState(restored);
        if (audioRef.current) audioRef.current.volume = restored;
        if (videoRef.current) videoRef.current.volume = restored;
        if (ytPlayerRef.current?.setVolume) {
          try { ytPlayerRef.current.setVolume(Math.round(restored * 100)); } catch {}
        }
        return false;
      } else {
        previousVolumeRef.current = volume > 0 ? volume : 0.8;
        setVolumeState(0);
        if (audioRef.current) audioRef.current.volume = 0;
        if (videoRef.current) videoRef.current.volume = 0;
        if (ytPlayerRef.current?.setVolume) {
          try { ytPlayerRef.current.setVolume(0); } catch {}
        }
        return true;
      }
    });
  }, [volume]);

  // MediaSession Metadata & Actions Synchronizer
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || currentAlbum?.artist || 'POSTLAIN MUSIC',
        album: currentAlbum?.title || 'Hidden Music Vault',
        artwork: currentTrack.cover_url || currentAlbum?.cover_url
          ? [
              { src: currentTrack.cover_url || currentAlbum?.cover_url || '', sizes: '512x512', type: 'image/jpeg' },
              { src: currentTrack.cover_url || currentAlbum?.cover_url || '', sizes: '256x256', type: 'image/jpeg' },
            ]
          : [],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (isCurrentTrackYouTube) {
          try { ytPlayerRef.current?.playVideo(); } catch {}
        }
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isCurrentTrackYouTube) {
          try { ytPlayerRef.current?.pauseVideo(); } catch {}
        }
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack();
      });

      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (typeof details.seekTime === 'number') {
            seekTo(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skip = details.seekOffset || 5;
          seekTo(Math.max(0, currentTimeRef.current - skip));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skip = details.seekOffset || 5;
          seekTo(Math.min(duration || 9999, currentTimeRef.current + skip));
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          pause();
          seekTo(0);
        });
      } catch {}

      // Update position state for Lockscreen / Media Bar progress
      if ('setPositionState' in navigator.mediaSession && duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, duration),
            playbackRate: 1,
            position: Math.max(0, Math.min(currentTime, duration)),
          });
        } catch {}
      }
    }
  }, [currentTrack, currentAlbum, isCurrentTrackYouTube, prevTrack, nextTrack, seekTo, pause, duration, currentTime]);

  // Global Keyboard Shortcuts (Space, Arrows, Mute)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);
      if (isInput) return;
      if (activeZone === 'video') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const cur = currentTimeRef.current;
        seekTo(Math.max(0, cur - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const cur = currentTimeRef.current;
        seekTo(Math.min(duration || 9999, cur + 5));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [togglePlay, seekTo, duration, volume, setVolume, toggleMute, activeZone]);

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

  const addToQueue = useCallback((track: TrackItem) => {
    setUserQueue((prev) => [...prev, track]);
  }, []);

  const addToUserQueue = useCallback((track: TrackItem) => {
    setUserQueue((prev) => [...prev, track]);
  }, []);

  const playNextInQueue = useCallback((track: TrackItem) => {
    setUserQueue((prev) => [track, ...prev.filter((t) => t.id !== track.id)]);
  }, []);

  const reorderQueue = useCallback((startIndex: number, endIndex: number) => {
    setUserQueue((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  const removeFromUserQueue = useCallback((trackId: string) => {
    setUserQueue((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setUserQueue((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const clearUserQueue = useCallback(() => {
    setUserQueue([]);
  }, []);

  const clearQueue = useCallback(() => {
    setUserQueue([]);
  }, []);

  const contextValue: PlayerContextType = useMemo(
    () => ({
      currentTrack,
      currentAlbum,
      playlist,
      userQueue,
      isPlaying,
      isBuffering,
      currentTime,
      duration,
      volume,
      isMuted,
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
      playNextInQueue,
      reorderQueue,
      removeFromUserQueue,
      removeFromQueue,
      clearUserQueue,
      clearQueue,
      togglePlay,
      pause,
      resume,
      nextTrack,
      prevTrack,
      seekTo,
      setCurrentTime,
      setDuration,
      setIsPlaying,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      toggleCinematicFx,
      isHapticEnabled,
      toggleHaptic,
      subscribeToTimeUpdate,
      analyserRef,
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
      isMuted,
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
      playTrack,
      addToQueue,
      addToUserQueue,
      playNextInQueue,
      reorderQueue,
      removeFromUserQueue,
      removeFromQueue,
      clearUserQueue,
      clearQueue,
      togglePlay,
      pause,
      resume,
      nextTrack,
      prevTrack,
      seekTo,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      toggleCinematicFx,
      isHapticEnabled,
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

      {/* Hidden YouTube Audio Bridge Element */}
      <div
        id="vault-yt-audio-bridge"
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <div id="vault-yt-audio-bridge-target" />
      </div>

      {/* Primary HTML5 Audio Element for Vault Lossless Tracks with Byte-Range Seeking */}
      <audio
        ref={audioRef}
        src={trackUrl || undefined}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          initAudioGraph();
        }}
        onCanPlay={() => setIsBuffering(false)}
        onCanPlayThrough={() => {
          setIsBuffering(false);
          initAudioGraph();
        }}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const cur = audioRef.current.currentTime;
          currentTimeRef.current = cur;

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
        onDurationChange={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
            const trueDuration = Math.round(audioRef.current.duration);
            setDuration(trueDuration);
            setCurrentTrack((prev) => {
              if (!prev) return prev;
              return { ...prev, duration: trueDuration };
            });
            setPlaylist((prev) =>
              prev.map((t) => (t.id === currentTrack?.id ? { ...t, duration: trueDuration } : t))
            );
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
            const trueDuration = Math.round(audioRef.current.duration);
            setDuration(trueDuration);
            setCurrentTrack((prev) => {
              if (!prev) return prev;
              return { ...prev, duration: trueDuration };
            });
            setPlaylist((prev) =>
              prev.map((t) => (t.id === currentTrack?.id ? { ...t, duration: trueDuration } : t))
            );
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
