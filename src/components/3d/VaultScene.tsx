'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Disc3,
  Music,
  MessageSquare,
  Film,
  ListMusic,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Headphones,
  Sparkles,
} from 'lucide-react';
import { Album, TrackItem, PlayerZone } from '@/types/database';
import AlbumComments from '@/components/ui/AlbumComments';
import { hasVideoSubscription } from '@/lib/authSession';

interface VaultSceneProps {
  albums: Album[];
  viewMode?: 'vault' | 'album';
  selectedAlbum?: Album | null;
  onSelectAlbum: (album: Album) => void;
  // Detail mode controls
  tracks?: TrackItem[];
  selectedTrack?: TrackItem | null;
  setSelectedTrack?: (track: TrackItem) => void;
  currentTrack?: TrackItem | null;
  isCurrentPlayingThisAlbum?: boolean;
  isPlaying?: boolean;
  togglePlay?: () => void;
  playTrack?: (track: TrackItem, album: Album, tracks: TrackItem[]) => void;
  shuffleMode?: boolean;
  toggleShuffle?: () => void;
  handlePlayAlbum?: () => void;
  handleShufflePlay?: () => void;
  formatDuration?: (seconds?: number) => string;
  // Video Zone Decoupling & Paywall props
  activeZone?: PlayerZone;
  onSwitchToVideoZone?: (track?: TrackItem) => void;
  onSwitchToAudioZone?: () => void;
  onOpenPaywall?: () => void;
  userSession?: any;
}

export default function VaultScene({
  albums,
  viewMode = 'vault',
  selectedAlbum,
  onSelectAlbum,
  tracks = [],
  selectedTrack,
  setSelectedTrack,
  currentTrack,
  isCurrentPlayingThisAlbum = false,
  isPlaying = false,
  togglePlay,
  playTrack,
  shuffleMode = false,
  toggleShuffle,
  handlePlayAlbum,
  handleShufflePlay,
  formatDuration = (s) => (s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '03:20'),
  activeZone = 'audio',
  onSwitchToVideoZone,
  onSwitchToAudioZone,
  onOpenPaywall,
  userSession,
}: VaultSceneProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [albumTab, setAlbumTab] = useState<'tracks' | 'comments'>('tracks');
  const [commentsCount, setCommentsCount] = useState(0);

  // Video Zone Specific Independent State
  const [selectedVideoTrack, setSelectedVideoTrack] = useState<TrackItem | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoVolume, setVideoVolume] = useState(0.8);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [videoTab, setVideoTab] = useState<'playlist' | 'comments'>('playlist');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoCardRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef(0);
  const lastScrollTime = useRef(0);

  const isDetail = viewMode === 'album';
  const isVideoZone = activeZone === 'video';

  // Find tracks with video
  const videoTracks = useMemo(() => tracks.filter((t) => Boolean(t.video_url)), [tracks]);

  // Sync selected video track
  useEffect(() => {
    if (selectedTrack && selectedTrack.video_url) {
      setSelectedVideoTrack(selectedTrack);
    } else if (currentTrack && currentTrack.video_url) {
      setSelectedVideoTrack(currentTrack);
    } else if (videoTracks.length > 0) {
      setSelectedVideoTrack(videoTracks[0]);
    } else if (tracks.length > 0) {
      setSelectedVideoTrack(tracks[0]);
    }
  }, [selectedTrack, currentTrack, videoTracks, tracks]);

  // Reset tab to tracks when changing album
  useEffect(() => {
    setAlbumTab('tracks');
  }, [selectedAlbum?.id, viewMode]);

  // Sync index if selectedAlbum is provided externally
  useEffect(() => {
    if (selectedAlbum) {
      const idx = albums.findIndex((a) => a.id === selectedAlbum.id);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [selectedAlbum, albums]);

  const activeAlbum = (isDetail && selectedAlbum) ? selectedAlbum : (albums[currentIndex] || albums[0]);

  // Fullscreen change listener for video
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsVideoFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Smooth 3D Cursor Parallax for Background & Card Tilt (Disabled in detail and video mode)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const normX = (e.clientX / innerWidth - 0.5) * 2;
      const normY = (e.clientY / innerHeight - 0.5) * 2;

      setMouseOffset({
        x: normX,
        y: normY,
      });

      if (!isDetail && !isVideoZone) {
        setTilt({
          x: -normY * 7,
          y: normX * 7,
        });
      } else {
        setTilt({ x: 0, y: 0 });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isDetail, isVideoZone]);

  // Vertical Navigation Handlers in 3D Vault Mode (Wheel, Arrow Keys, Touch)
  useEffect(() => {
    if (isDetail || isVideoZone) return;

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < 280) return;

      if (e.deltaY > 30) {
        lastScrollTime.current = now;
        setCurrentIndex((prev) => (prev + 1) % albums.length);
      } else if (e.deltaY < -30) {
        lastScrollTime.current = now;
        setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % albums.length);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      if (deltaY > 50) {
        setCurrentIndex((prev) => (prev + 1) % albums.length);
      } else if (deltaY < -50) {
        setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [albums.length, isDetail, isVideoZone]);

  // Video Gatekeeper check
  const handleRequestVideoAccess = (track?: TrackItem) => {
    const hasAccess = hasVideoSubscription(userSession);
    if (!hasAccess) {
      if (onOpenPaywall) onOpenPaywall();
      return;
    }

    const targetTrack = track || selectedTrack || (videoTracks.length > 0 ? videoTracks[0] : (tracks.length > 0 ? tracks[0] : null));
    if (targetTrack) {
      setSelectedVideoTrack(targetTrack);
    }
    if (onSwitchToVideoZone) {
      onSwitchToVideoZone(targetTrack || undefined);
    }
  };

  // Video Controls
  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const handleVideoSeek = (time: number) => {
    setVideoCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const toggleVideoFullscreen = () => {
    const el = videoCardRef.current || videoRef.current;
    if (!el) return;

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const handlePlayNextVideo = () => {
    if (videoTracks.length === 0) return;
    const curIdx = videoTracks.findIndex((t) => t.id === selectedVideoTrack?.id);
    const nextIdx = (curIdx + 1) % videoTracks.length;
    setSelectedVideoTrack(videoTracks[nextIdx]);
    setIsVideoPlaying(true);
  };

  const handlePlayPrevVideo = () => {
    if (videoTracks.length === 0) return;
    const curIdx = videoTracks.findIndex((t) => t.id === selectedVideoTrack?.id);
    const prevIdx = (curIdx - 1 + videoTracks.length) % videoTracks.length;
    setSelectedVideoTrack(videoTracks[prevIdx]);
    setIsVideoPlaying(true);
  };

  if (!activeAlbum) return null;

  return (
    <div className="w-full h-full absolute inset-0 z-0 bg-[#09090d] flex items-center justify-center overflow-hidden px-3 sm:px-6 md:px-8 select-none">
      
      {/* 1A. VAULT 3D COSMIC SKY */}
      <div
        className={`cosmic-sky transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isDetail || isVideoZone ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
        style={{
          transform: `translate3d(${mouseOffset.x * 14}px, ${mouseOffset.y * 14}px, 0)`,
        }}
        aria-hidden="true"
      >
        <div
          className="cosmic-stars transition-transform duration-500 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * 32}px, ${mouseOffset.y * 32}px, 0)`,
          }}
        />
        <div
          className="cosmic-nebula cosmic-nebula-one transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * -42}px, ${mouseOffset.y * -42}px, 0) rotate(-25deg)`,
          }}
        />
        <div
          className="cosmic-nebula cosmic-nebula-two transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * 52}px, ${mouseOffset.y * 52}px, 0)`,
          }}
        />
      </div>

      {/* 1B. DEDICATED AMBIENT GLOW */}
      <div
        className={`absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] sm:w-[700px] h-[550px] sm:h-[700px] rounded-full pointer-events-none blur-[130px] transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] z-0 ${
          isDetail && !isVideoZone ? 'opacity-25 sm:opacity-30 scale-100' : 'opacity-0 scale-75'
        }`}
        style={{
          backgroundImage: `radial-gradient(circle, #ffffff 0%, #3b82f6 40%, #7c3aed 70%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* 2. CHẾ ĐỘ VIDEO ZONE THEATER (CARD TỶ LỆ 2/3)                             */}
      {/* ========================================================================= */}
      {isVideoZone ? (
        <div className="relative z-20 w-full max-w-6xl h-full flex flex-col items-center justify-center pt-14 pb-8 sm:py-16 px-2 sm:px-4 animate-fadeIn font-mono">
          
          {/* Main 2/3 Theater Grid Container */}
          <div className="w-full h-full max-h-[82vh] rounded-3xl bg-zinc-950/90 border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-3 sm:p-5 flex flex-col lg:flex-row gap-4 overflow-hidden relative">
            
            {/* --- LEFT 2/3: NATIVE VIDEO PLAYER CARD --- */}
            <div
              ref={videoCardRef}
              className="w-full lg:w-2/3 h-full flex flex-col justify-between rounded-2xl bg-black border border-white/15 overflow-hidden relative shadow-2xl group/player select-none"
            >
              {/* Top Bar inside Video: Track info + Audio Switcher */}
              <div className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[11px] sm:text-xs font-cyber font-extrabold text-white truncate uppercase tracking-wider">
                    {selectedVideoTrack?.title || activeAlbum.title}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono border border-white/20">
                    MV 4K
                  </span>
                </div>

                {/* PROMINENT AUDIO TOGGLE BUTTON (Quay lại Audio Zone) */}
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.pause();
                    if (onSwitchToAudioZone) onSwitchToAudioZone();
                  }}
                  title="Quay lại Chế độ Âm nhạc (Audio Zone)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black font-black font-cyber text-[10px] sm:text-xs uppercase tracking-wider shadow-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>AUDIO ZONE</span>
                </button>
              </div>

              {/* Native HTML5 Video Element */}
              <div
                onDoubleClick={toggleVideoFullscreen}
                onClick={toggleVideoPlay}
                className="relative flex-1 w-full h-full flex items-center justify-center cursor-pointer bg-black overflow-hidden"
              >
                {selectedVideoTrack?.video_url ? (
                  <video
                    ref={videoRef}
                    src={selectedVideoTrack.video_url}
                    autoPlay
                    playsInline
                    onTimeUpdate={() => {
                      if (videoRef.current) setVideoCurrentTime(videoRef.current.currentTime);
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setVideoDuration(videoRef.current.duration);
                        videoRef.current.volume = videoVolume;
                        videoRef.current.muted = isVideoMuted;
                      }
                    }}
                    onEnded={handlePlayNextVideo}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <Film className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
                    <p className="text-xs uppercase font-cyber tracking-widest text-white">
                      BÀI HÁT NÀY CHƯA CÓ VIDEO MV
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Hãy chọn bài hát khác có icon MV trong danh sách bên cạnh.
                    </p>
                  </div>
                )}

                {/* Big Center Play / Pause Indicator */}
                {!isVideoPlaying && selectedVideoTrack?.video_url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                    <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Custom Video Controls Bar */}
              <div className="p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-2 z-30">
                {/* Video Seekbar */}
                <div className="flex items-center gap-2.5 w-full">
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {formatDuration(videoCurrentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    value={videoCurrentTime}
                    onChange={(e) => handleVideoSeek(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer border border-white/20 bg-zinc-800 shadow-inner"
                  />
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {formatDuration(videoDuration)}
                  </span>
                </div>

                {/* Video Actions Row */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePlayPrevVideo}
                      title="Video trước"
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all"
                    >
                      <SkipBack className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={toggleVideoPlay}
                      title={isVideoPlaying ? 'Tạm dừng' : 'Phát'}
                      className="p-2 rounded-full bg-white text-black hover:bg-zinc-200 transition-all shadow-md"
                    >
                      {isVideoPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>

                    <button
                      onClick={handlePlayNextVideo}
                      title="Video kế tiếp"
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Volume Mute Toggle */}
                    <button
                      onClick={() => {
                        const newMute = !isVideoMuted;
                        setIsVideoMuted(newMute);
                        if (videoRef.current) videoRef.current.muted = newMute;
                      }}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all"
                      title={isVideoMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                    >
                      {isVideoMuted || videoVolume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                      onClick={toggleVideoFullscreen}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all"
                      title={isVideoFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                    >
                      {isVideoFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* --- RIGHT 1/3: COMPACT PLAYLIST & COMMENTS DECK --- */}
            <div className="w-full lg:w-1/3 h-full flex flex-col rounded-2xl bg-zinc-900/60 border border-white/10 p-3 sm:p-4 overflow-hidden relative">
              
              {/* Header: Album thumbnail + Title */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/10 flex-shrink-0">
                <img
                  src={activeAlbum.cover_url}
                  alt={activeAlbum.title}
                  className="w-10 h-10 rounded-xl object-cover border border-white/20 shadow-md"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-cyber font-bold text-white truncate uppercase">
                    {activeAlbum.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {activeAlbum.artist || 'VAULT ARTIST'}
                  </span>
                </div>
              </div>

              {/* Tab Switcher: Playlist vs Comments */}
              <div className="grid grid-cols-2 gap-1.5 my-2.5 p-1 bg-white/5 rounded-xl border border-white/10 flex-shrink-0">
                <button
                  onClick={() => setVideoTab('playlist')}
                  className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    videoTab === 'playlist'
                      ? 'bg-white text-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListMusic className="w-3 h-3" />
                  <span>DANH SÁCH MV</span>
                </button>

                <button
                  onClick={() => setVideoTab('comments')}
                  className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    videoTab === 'comments'
                      ? 'bg-white text-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>THẢO LUẬN</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 select-none no-scrollbar">
                {videoTab === 'playlist' ? (
                  <div className="space-y-1">
                    {tracks.map((t, idx) => {
                      const isSelected = selectedVideoTrack?.id === t.id;
                      const hasMv = Boolean(t.video_url);

                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setSelectedVideoTrack(t);
                            setIsVideoPlaying(true);
                          }}
                          className={`px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                            isSelected
                              ? 'bg-white/15 border-white text-white shadow-md'
                              : 'bg-white/5 border-transparent hover:bg-white/10 text-slate-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono text-slate-500 font-bold">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-cyber truncate">{t.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {hasMv && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-white/20 text-white font-bold font-mono">
                                MV
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono">
                              {formatDuration(t.duration)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full">
                    <AlbumComments
                      albumId={activeAlbum.id}
                      albumTitle={activeAlbum.title}
                      onCommentsCountChange={setCommentsCount}
                    />
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. CHẾ ĐỘ AUDIO ZONE (3D MONOLITH & ALBUM DETAIL)                         */
        /* ========================================================================= */
        <div className="relative z-10 w-full max-w-[1400px] h-full flex flex-col lg:flex-row items-center justify-center pt-10 sm:pt-14 pb-20 sm:pb-22 overflow-hidden">
          
          {/* PHYSICAL ALBUM DECK */}
          <div
            className="flex flex-col items-center justify-center transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform z-20"
            style={{
              transform: isDetail
                ? (typeof window !== 'undefined' && window.innerWidth >= 1024
                    ? 'translateX(-280px) scale(1.02)'
                    : 'translateY(-10px) scale(0.94)')
                : `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale(${isHovered ? 1.03 : 1.0})`,
              perspective: '1000px',
              transformStyle: 'preserve-3d',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Glass Card Container */}
            <div
              onClick={() => {
                if (!isDetail) {
                  onSelectAlbum(activeAlbum);
                } else if (togglePlay && handlePlayAlbum) {
                  if (isCurrentPlayingThisAlbum) togglePlay();
                  else handlePlayAlbum();
                }
              }}
              className={`cursor-pointer transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] p-4 sm:p-5 md:p-6 w-[280px] sm:w-[320px] md:w-[350px] flex flex-col items-center ${
                isDetail
                  ? 'bg-transparent border-transparent shadow-none backdrop-blur-none'
                  : 'glass-card'
              }`}
            >
              {/* Sleeve & Sliding Vinyl Disc */}
              <div className="relative mx-auto flex items-center justify-center w-[210px] h-[210px] sm:w-[240px] sm:h-[240px] overflow-visible">
                {/* Grooved Vinyl Record */}
                <div
                  className="absolute w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/25 shadow-2xl flex items-center justify-center transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none z-0 will-change-transform"
                  style={{
                    transform: (isDetail || isHovered || (isCurrentPlayingThisAlbum && isPlaying))
                      ? (isDetail ? 'translateX(60px) rotate(180deg)' : 'translateX(26px) rotate(180deg)')
                      : 'translateX(0px) rotate(0deg)',
                    boxShadow: (isDetail || isHovered)
                      ? '0 20px 45px rgba(0,0,0,0.95), inset 0 0 20px rgba(255,255,255,0.1)'
                      : 'none',
                  }}
                >
                  <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                    <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                      <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-800 border-2 border-white/40 flex items-center justify-center shadow-inner ${
                          isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
                        }`}>
                          <img src={activeAlbum.cover_url} alt="" className="w-full h-full object-cover rounded-full" />
                          <div className="absolute w-3.5 h-3.5 rounded-full bg-black border border-white/60" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cover Artwork Sleeve */}
                <div
                  className="relative z-10 w-[190px] h-[190px] sm:w-[220px] sm:h-[220px] rounded-2xl overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.95)] border border-white/20 bg-zinc-950 flex-shrink-0 transition-transform duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                  style={{
                    transform: (isDetail || isHovered) ? 'translateX(-20px)' : 'translateX(0px)',
                  }}
                >
                  <img
                    src={activeAlbum.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                    alt={activeAlbum.title}
                    className="w-full h-full object-cover select-none"
                    loading="eager"
                  />

                  {isDetail && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform">
                        {isCurrentPlayingThisAlbum && isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Album Title & Artist */}
              <div className="flex flex-col items-center text-center mt-4 w-full">
                <h2 className="text-xl sm:text-2xl font-black font-cyber text-white tracking-wider truncate uppercase w-full">
                  {activeAlbum.title}
                </h2>
                <p className="text-xs sm:text-sm font-mono text-zinc-300 font-bold tracking-widest uppercase mt-1">
                  {activeAlbum.artist || 'VAULT ARTIST'}
                </p>
              </div>
            </div>

            {/* Action Buttons Deck (with VIDEO GATEKEEPER BUTTON) */}
            <div
              className={`w-full max-w-[320px] flex flex-col items-center gap-2 mt-1 transition-all duration-500 ease-out ${
                isDetail
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              <div className="w-full flex items-center gap-2">
                {/* 1. Comments / Playlist Toggle Button */}
                <button
                  onClick={() => setAlbumTab((prev) => (prev === 'comments' ? 'tracks' : 'comments'))}
                  title={albumTab === 'comments' ? 'Xem danh sách bài hát' : 'Xem thảo luận & bình luận'}
                  className={`p-2 sm:p-2.5 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center relative flex-shrink-0 ${
                    albumTab === 'comments'
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  {albumTab === 'comments' ? <ListMusic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  {commentsCount > 0 && albumTab !== 'comments' && (
                    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-white text-black rounded-full text-[8px] font-black flex items-center justify-center shadow-md">
                      {commentsCount > 99 ? '99+' : commentsCount}
                    </span>
                  )}
                </button>

                {/* 2. PLAY ALL AUDIO BUTTON */}
                <button
                  onClick={() => {
                    if (handlePlayAlbum) handlePlayAlbum();
                  }}
                  className="flex-1 py-2 sm:py-2.5 px-3 rounded-full bg-white hover:bg-slate-100 text-black font-black font-mono text-xs uppercase tracking-wider shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isCurrentPlayingThisAlbum && isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>PAUSE</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>PLAY ALL</span>
                    </>
                  )}
                </button>

                {/* 3. NEW VIDEO ZONE GATEKEEPER BUTTON (NÚT CHUYỂN QUA VIDEO ZONE) */}
                <button
                  onClick={() => handleRequestVideoAccess()}
                  title="Chuyển sang Chế độ Video Zone (MV 4K)"
                  className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center flex-shrink-0 shadow-lg"
                >
                  <Film className="w-4 h-4" />
                </button>

                {/* 4. Shuffle Button */}
                <button
                  onClick={() => {
                    if (handleShufflePlay) handleShufflePlay();
                  }}
                  title={shuffleMode ? 'Tắt trộn bài' : 'Phát ngẫu nhiên'}
                  className={`p-2 sm:p-2.5 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center flex-shrink-0 ${
                    shuffleMode
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Dots */}
            {albums.length > 1 && (
              <div
                className={`flex items-center gap-2 mt-4 transition-all duration-500 ${
                  !isDetail ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
              >
                {albums.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
                    }`}
                    title={`Album ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: PLAYLIST & COMMENTS PANEL (DESKTOP) */}
          <div
            className={`hidden lg:flex absolute z-10 w-[500px] xl:w-[560px] h-[460px] xl:h-[500px] max-h-[70vh] flex-col font-mono transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
              isDetail
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
            style={{
              transform: isDetail ? 'translateX(190px)' : 'translateX(300px)',
            }}
          >
            <div className="dark-neumorph-card p-2 sm:p-3 md:p-4 h-full flex flex-col w-full overflow-hidden shadow-2xl relative">
              {albumTab === 'tracks' ? (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 select-none no-scrollbar px-0.5 py-0.5 animate-fadeIn" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {tracks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                      <Disc3 className="w-8 h-8 text-slate-600 animate-spin-slow mb-2" />
                      <p className="text-xs uppercase tracking-widest font-mono">
                        NO TRACKS IN THIS ARCHIVE
                      </p>
                    </div>
                  ) : (
                    tracks.map((track, idx) => {
                      const isCurrentPlaying = currentTrack?.id === track.id;
                      const trackIndex = String(idx + 1).padStart(2, '0');

                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            if (setSelectedTrack) setSelectedTrack(track);
                            if (playTrack) playTrack(track, activeAlbum, tracks);
                          }}
                          className={`group relative h-13 sm:h-14 px-3.5 sm:px-4 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
                            isCurrentPlaying
                              ? 'bg-white/[0.10] border-white/25 shadow-[0_0_20px_rgba(255,255,255,0.06)]'
                              : 'bg-transparent hover:bg-white/[0.04] border-transparent hover:border-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-3">
                            <div className="w-6 flex items-center justify-center flex-shrink-0">
                              {isCurrentPlaying && isPlaying ? (
                                <div className="flex items-end gap-[2px] h-3.5">
                                  <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '70%', animationDelay: '0ms' }} />
                                  <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
                                  <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '85%', animationDelay: '300ms' }} />
                                </div>
                              ) : (
                                <>
                                  <span className={`text-xs font-mono font-bold group-hover:hidden ${
                                    isCurrentPlaying ? 'text-white font-black' : 'text-slate-500'
                                  }`}>
                                    {trackIndex}
                                  </span>
                                  <Play className="w-3.5 h-3.5 fill-white text-white hidden group-hover:block transition-all" />
                                </>
                              )}
                            </div>

                            <span className={`truncate text-xs sm:text-sm font-cyber tracking-wide ${
                              isCurrentPlaying ? 'text-white font-black' : 'text-slate-300 group-hover:text-white font-medium'
                            }`}>
                              {track.title}
                            </span>

                            {track.video_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestVideoAccess(track);
                                }}
                                title="Xem Video MV"
                                className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 flex items-center gap-1 flex-shrink-0 transition-all"
                              >
                                <Film className="w-2.5 h-2.5" /> MV
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                            <span className={`text-[11px] sm:text-xs font-mono tabular-nums ${
                              isCurrentPlaying ? 'text-white font-bold' : 'text-slate-500 group-hover:text-slate-400'
                            }`}>
                              {formatDuration(track.duration)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col animate-fadeIn">
                  <AlbumComments
                    albumId={activeAlbum.id}
                    albumTitle={activeAlbum.title}
                    onCommentsCountChange={setCommentsCount}
                  />
                </div>
              )}
            </div>
          </div>

          {/* MOBILE PLAYLIST & COMMENTS */}
          <div
            className={`lg:hidden w-full max-w-md h-[290px] xs:h-[320px] sm:h-[360px] flex flex-col font-mono transition-all duration-500 will-change-transform z-10 mt-2 ${
              isDetail
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-6 pointer-events-none hidden'
            }`}
          >
            <div className="dark-neumorph-card p-2 sm:p-3 h-full flex flex-col w-full overflow-hidden shadow-2xl relative">
              {albumTab === 'tracks' ? (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 select-none no-scrollbar px-0.5 py-0.5 animate-fadeIn" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {tracks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                      <Disc3 className="w-8 h-8 text-slate-600 animate-spin-slow mb-2" />
                      <p className="text-xs uppercase tracking-widest font-mono">
                        NO TRACKS IN THIS ARCHIVE
                      </p>
                    </div>
                  ) : (
                    tracks.map((track, idx) => {
                      const isCurrentPlaying = currentTrack?.id === track.id;
                      const trackIndex = String(idx + 1).padStart(2, '0');

                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            if (setSelectedTrack) setSelectedTrack(track);
                            if (playTrack) playTrack(track, activeAlbum, tracks);
                          }}
                          className={`group relative h-12 px-3 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
                            isCurrentPlaying
                              ? 'bg-white/[0.10] border-white/25 shadow-[0_0_20px_rgba(255,255,255,0.06)]'
                              : 'bg-transparent hover:bg-white/[0.04] border-transparent hover:border-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className={`text-xs font-mono font-bold ${
                              isCurrentPlaying ? 'text-white font-black' : 'text-slate-500'
                            }`}>
                              {trackIndex}
                            </span>

                            <span className={`truncate text-xs font-cyber tracking-wide ${
                              isCurrentPlaying ? 'text-white font-black' : 'text-slate-300 group-hover:text-white font-medium'
                            }`}>
                              {track.title}
                            </span>

                            {track.video_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestVideoAccess(track);
                                }}
                                className="text-[8px] uppercase px-1.5 py-0.2 rounded font-bold bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 flex items-center gap-0.5 flex-shrink-0"
                              >
                                <Film className="w-2.5 h-2.5" /> MV
                              </button>
                            )}
                          </div>

                          <span className={`text-[10px] font-mono tabular-nums ${
                            isCurrentPlaying ? 'text-white font-bold' : 'text-slate-500'
                          }`}>
                            {formatDuration(track.duration)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col animate-fadeIn">
                  <AlbumComments
                    albumId={activeAlbum.id}
                    albumTitle={activeAlbum.title}
                    onCommentsCountChange={setCommentsCount}
                  />
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
