'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { normalizeMediaUrl } from '@/lib/r2Storage';

export interface Track {
  id: string;
  album_id?: string;
  title: string;
  artist?: string;
  audio_url: string;
  youtube_id?: string;
  duration?: number;
  lyrics?: string;
  bpm?: number;
  beat_grid?: any;
}

export interface Album {
  id: string;
  title: string;
  artist?: string;
  cover_url?: string;
  release_year?: number;
}

interface PlayerContextType {
  currentTrack: Track | null;
  currentAlbum: Album | null;
  playlist: Track[];
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffleMode: boolean;
  repeatMode: 'off' | 'all' | 'one';
  activeZone: 'audio' | 'video' | 'idle';
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTimeRef: React.MutableRefObject<number>;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  playTrack: (track: Track, album?: Album | null, newPlaylist?: Track[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (time: number) => void;
  setVolume: (val: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  switchToAudioZone: () => void;
  switchToVideoZone: (track?: Track | null, album?: Album | null) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [activeZone, setActiveZone] = useState<'audio' | 'video' | 'idle'>('idle');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTimeRef = useRef<number>(0);

  // Dual-Engine: YouTube IFrame player ref
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const ytPollTimerRef = useRef<any>(null);
  const isYtTrackRef = useRef(false);

  // Web Audio Context & Analyser (Singleton Engine for HTML5 Audio)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // ── YouTube IFrame API Initialization ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initYt = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        if (!ytPlayerRef.current) {
          try {
            ytPlayerRef.current = new (window as any).YT.Player('hidden-yt-audio-bridge', {
              height: '1',
              width: '1',
              playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
                origin: window.location.origin,
              },
              events: {
                onReady: () => {
                  ytReadyRef.current = true;
                },
                onStateChange: (event: any) => {
                  const state = event.data;
                  // YT.PlayerState: PLAYING=1, PAUSED=2, BUFFERING=3, ENDED=0
                  if (state === 1) {
                    setIsPlaying(true);
                    setIsBuffering(false);
                  } else if (state === 2) {
                    setIsPlaying(false);
                  } else if (state === 3) {
                    setIsBuffering(true);
                  } else if (state === 0) {
                    setIsPlaying(false);
                    // Handle track end
                    if (repeatMode === 'one' && ytPlayerRef.current) {
                      ytPlayerRef.current.seekTo(0);
                      ytPlayerRef.current.playVideo();
                    } else {
                      nextTrack();
                    }
                  }
                },
                onError: (err: any) => {
                  console.warn('[YouTube Audio Bridge Error]:', err);
                  setIsBuffering(false);
                  setIsPlaying(false);
                },
              },
            });
          } catch (e) {
            console.warn('[YouTube Player Init Exception]:', e);
          }
        }
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.body.appendChild(tag);
      (window as any).onYouTubeIframeAPIReady = initYt;
    } else {
      initYt();
    }

    return () => {
      if (ytPollTimerRef.current) clearInterval(ytPollTimerRef.current);
    };
  }, [repeatMode]);

  // ── Khởi tạo Audio Engine HTML5 (Lossless Vault) ──────────────────────────────
  const initAudioEngine = useCallback(() => {
    if (!audioRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      if (!analyserRef.current) {
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.4;
        analyserRef.current = analyser;
      }

      if (!sourceNodeRef.current && audioRef.current) {
        try {
          const source = audioCtxRef.current.createMediaElementSource(audioRef.current);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioCtxRef.current.destination);
          sourceNodeRef.current = source;
        } catch (e) {
          console.warn('[Audio Engine]: createMediaElementSource notice', e);
        }
      }
    } catch (e) {
      console.warn('[Audio Engine]: init notice', e);
    }
  }, []);

  const switchToAudioZone = useCallback(() => {
    setActiveZone('audio');
  }, []);

  const switchToVideoZone = useCallback((track?: Track | null, album?: Album | null) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === 'function') {
      try { ytPlayerRef.current.stopVideo(); } catch {}
    }
    setIsPlaying(false);
    if (track) setCurrentTrack(track);
    if (album) setCurrentAlbum(album);
    setActiveZone('video');
  }, []);

  // Helper to extract YouTube video ID from track
  const getYouTubeId = (track: Track): string | null => {
    if (track.youtube_id && /^[a-zA-Z0-9_-]{11}$/.test(track.youtube_id)) return track.youtube_id;
    if (track.audio_url?.startsWith('yt:')) return track.audio_url.replace('yt:', '');
    if (track.id && /^[a-zA-Z0-9_-]{11}$/.test(track.id) && (!track.audio_url || track.audio_url.startsWith('yt:'))) {
      return track.id;
    }
    return null;
  };

  const playTrack = useCallback(
    (track: Track, album: Album | null = null, newPlaylist: Track[] = []) => {
      setCurrentTrack(track);
      if (album) setCurrentAlbum(album);
      if (newPlaylist && newPlaylist.length > 0) setPlaylist(newPlaylist);

      setActiveZone('audio');
      setIsPlaying(true);
      setCurrentTime(0);
      currentTimeRef.current = 0;

      const ytId = getYouTubeId(track);

      // Stop previous polling
      if (ytPollTimerRef.current) {
        clearInterval(ytPollTimerRef.current);
        ytPollTimerRef.current = null;
      }

      if (ytId) {
        // ── Dual Engine: Route to YouTube Audio Bridge ──────────────────────────
        isYtTrackRef.current = true;

        // Pause HTML5 audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }

        const startYtPlayback = () => {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
            try {
              ytPlayerRef.current.loadVideoById(ytId);
              ytPlayerRef.current.playVideo();
              ytPlayerRef.current.setVolume(Math.round(volume * 100));
            } catch (e) {
              console.warn('[YT loadVideoById error]:', e);
            }
          }
        };

        if (ytReadyRef.current && ytPlayerRef.current) {
          startYtPlayback();
        } else {
          // Retry briefly if YT API is mounting
          const retryTimer = setInterval(() => {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
              clearInterval(retryTimer);
              startYtPlayback();
            }
          }, 200);
          setTimeout(() => clearInterval(retryTimer), 4000);
        }

        // Set duration from track or poll
        if (track.duration && track.duration > 0) {
          setDuration(track.duration);
        }

        // Poll time & duration for YouTube tracks
        ytPollTimerRef.current = setInterval(() => {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
            try {
              const cur = ytPlayerRef.current.getCurrentTime() || 0;
              const dur = ytPlayerRef.current.getDuration() || track.duration || 0;
              setCurrentTime(cur);
              currentTimeRef.current = cur;
              if (dur > 0) setDuration(dur);
            } catch {}
          }
        }, 300);

      } else {
        // ── Dual Engine: Route to Lossless HTML5 Audio Engine (Vault / R2) ──────
        isYtTrackRef.current = false;

        // Stop YT player
        if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === 'function') {
          try { ytPlayerRef.current.stopVideo(); } catch {}
        }

        if (audioRef.current) {
          const streamUrl = normalizeMediaUrl(track.audio_url || '');
          audioRef.current.src = streamUrl;
          audioRef.current.load();
          initAudioEngine();
          audioRef.current.play().catch((err) => {
            console.warn('[Audio Play Promise Error]:', err);
            setIsPlaying(false);
          });
        }
      }
    },
    [initAudioEngine, volume]
  );

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;

    if (isYtTrackRef.current && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch {}
      return;
    }

    if (!audioRef.current) return;
    initAudioEngine();

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [isPlaying, currentTrack, initAudioEngine]);

  const pause = useCallback(() => {
    if (isYtTrackRef.current && ytPlayerRef.current) {
      try { ytPlayerRef.current.pauseVideo(); } catch {}
      setIsPlaying(false);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (!currentTrack) return;
    if (isYtTrackRef.current && ytPlayerRef.current) {
      try { ytPlayerRef.current.playVideo(); } catch {}
      setIsPlaying(true);
      return;
    }
    if (audioRef.current) {
      initAudioEngine();
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [currentTrack, initAudioEngine]);

  const nextTrack = useCallback(() => {
    if (playlist.length === 0 || !currentTrack) return;
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    let nextIndex = currentIndex + 1;

    if (shuffleMode) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else if (nextIndex >= playlist.length) {
      nextIndex = 0;
    }

    playTrack(playlist[nextIndex], currentAlbum, playlist);
  }, [playlist, currentTrack, shuffleMode, currentAlbum, playTrack]);

  const prevTrack = useCallback(() => {
    if (playlist.length === 0 || !currentTrack) return;
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = playlist.length - 1;
    playTrack(playlist[prevIndex], currentAlbum, playlist);
  }, [playlist, currentTrack, currentAlbum, playTrack]);

  const seekTo = useCallback((time: number) => {
    if (isYtTrackRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try {
        ytPlayerRef.current.seekTo(time, true);
        setCurrentTime(time);
        currentTimeRef.current = time;
      } catch {}
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      currentTimeRef.current = time;
    }
  }, []);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try { ytPlayerRef.current.setVolume(Math.round(clamped * 100)); } catch {}
    }
  }, []);

  const toggleShuffle = useCallback(() => setShuffleMode((prev) => !prev), []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  // HTML5 Audio Event Listeners (for Lossless Vault tracks)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isYtTrackRef.current) {
        setCurrentTime(audio.currentTime);
        currentTimeRef.current = audio.currentTime;
      }
    };

    const onLoadedMetadata = () => {
      if (!isYtTrackRef.current) {
        setDuration(audio.duration || 0);
      }
    };

    const onWaiting = () => {
      if (!isYtTrackRef.current) setIsBuffering(true);
    };
    const onPlaying = () => {
      if (!isYtTrackRef.current) {
        setIsBuffering(false);
        setIsPlaying(true);
      }
    };
    const onPause = () => {
      if (!isYtTrackRef.current) setIsPlaying(false);
    };

    const onError = () => {
      if (!isYtTrackRef.current) {
        console.warn('[HTML5 Audio Element Error]:', audio.error, audio.src);
        setIsBuffering(false);
        setIsPlaying(false);
      }
    };

    const onEnded = () => {
      if (!isYtTrackRef.current) {
        if (repeatMode === 'one') {
          audio.currentTime = 0;
          audio.play();
        } else {
          nextTrack();
        }
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [repeatMode, nextTrack]);

  return (
    <PlayerContext.Provider
      value={{
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
        activeZone,
        audioRef,
        currentTimeRef,
        analyserRef,
        playTrack,
        togglePlay,
        pause,
        resume,
        nextTrack,
        prevTrack,
        seekTo,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        switchToAudioZone,
        switchToVideoZone,
      }}
    >
      {children}
      {/* HTML5 Audio Element for Lossless Vault Tracks */}
      <audio ref={audioRef} crossOrigin="anonymous" preload="auto" playsInline />
      {/* Invisible YouTube IFrame Bridge for YTM Tracks */}
      <div
        id="hidden-yt-audio-bridge-container"
        style={{
          position: 'fixed',
          width: '1px',
          height: '1px',
          top: '-9999px',
          left: '-9999px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <div id="hidden-yt-audio-bridge" />
      </div>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
