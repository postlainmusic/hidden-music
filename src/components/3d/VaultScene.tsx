'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Disc3,
  Music,
  MessageSquare,
  Film,
  ListMusic,
  Lock,
  Crown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Flame,
  Radio,
  Calendar,
  Terminal,
  Volume2,
  Share2,
} from 'lucide-react';
import { Album, TrackItem } from '@/types/database';
import AlbumComments from '@/components/ui/AlbumComments';
import GlobalRadarSection from '@/components/ui/GlobalRadarSection';

interface VaultSceneProps {
  albums: Album[];
  viewMode?: 'vault' | 'album';
  selectedAlbum?: Album | null;
  onSelectAlbum: (album: Album, initialMediaMode?: 'audio' | 'video') => void;
  isSubscribed?: boolean;
  onOpenSubscriptionModal?: () => void;
  initialMediaMode?: 'audio' | 'video';
  // Detail mode controls
  tracks?: TrackItem[];
  selectedTrack?: TrackItem | null;
  setSelectedTrack?: (track: TrackItem) => void;
  currentTrack?: TrackItem | null;
  isCurrentPlayingThisAlbum?: boolean;
  isPlaying?: boolean;
  togglePlay?: () => void;
  playTrack?: (track: TrackItem, album?: Album | null, tracks?: TrackItem[]) => void;
  shuffleMode?: boolean;
  toggleShuffle?: () => void;
  handlePlayAlbum?: () => void;
  handleShufflePlay?: () => void;
  formatDuration?: (seconds?: number) => string;
}

export default function VaultScene({
  albums,
  viewMode = 'vault',
  selectedAlbum,
  onSelectAlbum,
  isSubscribed = false,
  onOpenSubscriptionModal,
  initialMediaMode = 'audio',
  tracks = [],
  selectedTrack,
  setSelectedTrack,
  currentTrack,
  isCurrentPlayingThisAlbum,
  isPlaying = false,
  togglePlay,
  playTrack,
  shuffleMode = false,
  toggleShuffle,
  handlePlayAlbum,
  handleShufflePlay,
  formatDuration = (s) => (s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '03:20'),
}: VaultSceneProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [albumTab, setAlbumTab] = useState<'tracks' | 'comments'>('tracks');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'audio' | 'video'>('all');
  const [commentsCount, setCommentsCount] = useState(0);

  const archiveSwiperRef = useRef<HTMLDivElement>(null);
  const isDetail = viewMode === 'album';

  // Sync media filter with initialMediaMode when entering album view
  useEffect(() => {
    if (isDetail) {
      setMediaFilter(initialMediaMode === 'video' ? 'video' : 'all');
    }
  }, [isDetail, initialMediaMode, selectedAlbum?.id]);

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

  const activeAlbum = isDetail && selectedAlbum ? selectedAlbum : albums[currentIndex] || albums[0];

  // Mouse Parallax for background
  useEffect(() => {
    let rafId: number | null = null;
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);

    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window;
        const normX = (e.clientX / innerWidth - 0.5) * 2;
        const normY = (e.clientY / innerHeight - 0.5) * 2;

        setMouseOffset({ x: normX, y: normY });
        if (!isDetail) {
          setTilt({ x: -normY * 6, y: normX * 6 });
        } else {
          setTilt({ x: 0, y: 0 });
        }
        rafId = null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isDetail]);

  const scrollArchive = (direction: 'left' | 'right') => {
    if (archiveSwiperRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      archiveSwiperRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const handleDailyProtocolPlay = () => {
    if (handleShufflePlay) {
      handleShufflePlay();
    } else if (albums.length > 0) {
      const randomAlb = albums[Math.floor(Math.random() * albums.length)];
      onSelectAlbum(randomAlb, 'audio');
    }
  };

  if (!activeAlbum) return null;

  return (
    <div className="w-full h-full absolute inset-0 z-0 bg-[#07080c] flex flex-col overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* BACKGROUND COSMIC NEBULA & AMBIENT GLOW                                  */}
      {/* ========================================================================= */}
      <div
        className="cosmic-sky pointer-events-none transition-all duration-[750ms]"
        style={{
          transform: `translate3d(${mouseOffset.x * 12}px, ${mouseOffset.y * 12}px, 0)`,
        }}
        aria-hidden="true"
      >
        <div className="cosmic-stars opacity-40" />
        <div className="cosmic-nebula cosmic-nebula-one opacity-30" />
        <div className="cosmic-nebula cosmic-nebula-two opacity-20" />
      </div>

      {/* ========================================================================= */}
      {/* VIEW A: DETAIL ALBUM MODE (When an Album is Opened)                      */}
      {/* ========================================================================= */}
      {isDetail ? (
        <div className="relative z-10 w-full max-w-[1400px] h-full flex flex-col lg:flex-row items-center justify-center mx-auto pt-16 pb-24 px-4 sm:px-8 overflow-hidden select-none">
          {/* LEFT: ALBUM DECK WITH PHYSICAL VINYL SLIDER */}
          <div className="flex flex-col items-center justify-center z-20 flex-shrink-0 mb-6 lg:mb-0 lg:mr-10">
            <div className="relative mx-auto flex items-center justify-center w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] overflow-visible">
              {/* Vinyl Record */}
              <div
                className={`absolute w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/25 shadow-2xl flex items-center justify-center transition-all duration-[750ms] pointer-events-none z-0 ${
                  isCurrentPlayingThisAlbum && isPlaying ? 'translate-x-12 sm:translate-x-16 rotate-180' : 'translate-x-6 sm:translate-x-10'
                }`}
              >
                <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-800 border-2 border-white/40 flex items-center justify-center shadow-inner ${
                    isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
                  }`}>
                    <img src={activeAlbum.cover_url} alt="" className="w-full h-full object-cover rounded-full" />
                    <div className="absolute w-3.5 h-3.5 rounded-full bg-black border border-white/60" />
                  </div>
                </div>
              </div>

              {/* Cover Sleeve */}
              <div className="relative z-10 w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-zinc-950 flex-shrink-0 -translate-x-4">
                <img
                  src={activeAlbum.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                  alt={activeAlbum.title}
                  className="w-full h-full object-cover select-none"
                />
                <div
                  onClick={() => {
                    if (togglePlay && handlePlayAlbum) {
                      if (isCurrentPlayingThisAlbum) togglePlay();
                      else handlePlayAlbum();
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform">
                    {isCurrentPlayingThisAlbum && isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Album Title */}
            <div className="text-center mt-3 font-mono">
              <h2 className="text-xl sm:text-2xl font-black font-cyber text-white uppercase tracking-wider">
                {activeAlbum.title}
              </h2>
              <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mt-0.5">
                {activeAlbum.artist || 'VAULT ARTIST'}
              </p>
            </div>

            {/* Play All & Shuffle Buttons */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setAlbumTab((prev) => (prev === 'comments' ? 'tracks' : 'comments'))}
                className={`p-2.5 rounded-full border transition-all ${
                  albumTab === 'comments' ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
                title="Bình luận"
              >
                {albumTab === 'comments' ? <ListMusic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </button>

              <button
                onClick={() => handlePlayAlbum && handlePlayAlbum()}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-200 text-black font-black font-mono text-xs uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                {isCurrentPlayingThisAlbum && isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isCurrentPlayingThisAlbum && isPlaying ? 'TẠM DỪNG' : 'PHÁT TOÀN BỘ'}</span>
              </button>

              <button
                onClick={() => handleShufflePlay && handleShufflePlay()}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all hover:scale-105"
                title="Phát ngẫu nhiên"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RIGHT: TRACKLIST / COMMENTS DECK */}
          <div className="flex-1 w-full max-w-xl h-full max-h-[60vh] lg:max-h-[70vh] bg-black/60 backdrop-blur-xl border border-white/15 rounded-3xl p-4 sm:p-6 overflow-hidden flex flex-col font-mono shadow-2xl">
            {albumTab === 'tracks' ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Media Filter Tabs */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setMediaFilter('all')}
                      className={`px-3 py-1 rounded-xl font-bold uppercase transition-all ${
                        mediaFilter === 'all' ? 'bg-white text-black' : 'text-slate-400 hover:text-white bg-white/5'
                      }`}
                    >
                      TẤT CẢ ({tracks.length})
                    </button>
                    <button
                      onClick={() => setMediaFilter('audio')}
                      className={`px-3 py-1 rounded-xl font-bold uppercase transition-all flex items-center gap-1 ${
                        mediaFilter === 'audio' ? 'bg-white text-black' : 'text-slate-400 hover:text-white bg-white/5'
                      }`}
                    >
                      <Music className="w-3 h-3" /> AUDIO
                    </button>
                    <button
                      onClick={() => setMediaFilter('video')}
                      className={`px-3 py-1 rounded-xl font-bold uppercase transition-all flex items-center gap-1 ${
                        mediaFilter === 'video' ? 'bg-white text-black' : 'text-slate-400 hover:text-white bg-white/5'
                      }`}
                    >
                      <Film className="w-3 h-3 text-cyan-400" /> VIDEO MV
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase">{tracks.length} BÀI HÁT</span>
                </div>

                {/* Track Items List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none pr-1">
                  {tracks
                    .filter((t) => {
                      if (mediaFilter === 'audio') return !t.video_url && t.media_type !== 'video';
                      if (mediaFilter === 'video') return Boolean(t.video_url || t.media_type === 'video');
                      return true;
                    })
                    .map((track, idx) => {
                      const isSelected = currentTrack?.id === track.id;
                      const isTrackPlaying = isSelected && isPlaying;

                      return (
                        <div
                          key={track.id || idx}
                          onClick={() => playTrack && playTrack(track, activeAlbum, tracks)}
                          className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-white/20 border-white text-white shadow-lg'
                              : 'bg-white/[0.03] hover:bg-white/10 border-white/5 text-slate-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="text-xs font-mono text-slate-500 w-5 text-center flex-shrink-0">
                              {isTrackPlaying ? (
                                <Disc3 className="w-4 h-4 text-white animate-spin-slow mx-auto" />
                              ) : (
                                String(idx + 1).padStart(2, '0')
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs sm:text-sm font-bold truncate group-hover:text-white">
                                  {track.title}
                                </h4>
                                {track.video_url && (
                                  <span className="text-[8px] px-1.5 py-0.2 rounded font-extrabold uppercase bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                                    MV
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                            <span className="text-[11px] font-mono text-slate-500">
                              {formatDuration(track.duration)}
                            </span>
                            <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-all">
                              {isTrackPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <AlbumComments
                albumId={activeAlbum.id}
                albumTitle={activeAlbum.title}
                onCommentsCountChange={setCommentsCount}
              />
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW B: HOME MODE (UNDERGROUND MUSIC TERMINAL WITH 4 CONTENT BLOCKS)       */
        /* ========================================================================= */
        <div className="relative z-10 w-full h-full overflow-y-auto pt-16 sm:pt-20 pb-28 sm:pb-32 px-3 sm:px-6 md:px-8 scrollbar-none flex flex-col items-center">
          
          {/* ======================================================================= */}
          {/* BLOCK 1: SPOTLIGHT HERO (Nhạc tiêu điểm với Dynamic Ambient Glow)        */}
          {/* ======================================================================= */}
          <section
            className="group/deck relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center my-4 sm:my-8 text-center font-mono select-none"
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
          >
            {/* Dynamic Backdrop Glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full pointer-events-none blur-[100px] opacity-35 animate-pulse-slow"
              style={{
                backgroundImage: `radial-gradient(circle, #ffffff 0%, #3b82f6 40%, #7c3aed 70%, transparent 100%)`,
              }}
            />

            {/* Spotlight Card */}
            <div
              onClick={() => onSelectAlbum(activeAlbum, 'audio')}
              className="relative z-10 cursor-pointer p-4 sm:p-6 rounded-3xl bg-black/50 border border-white/15 backdrop-blur-xl shadow-2xl flex flex-col items-center transition-all duration-500 hover:border-white/30 hover:scale-[1.02]"
              style={{
                transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`,
                perspective: '1000px',
              }}
            >
              {/* Sleeve & Vinyl Composition */}
              <div className="relative mx-auto flex items-center justify-center w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]">
                {/* Vinyl Record sliding on hover */}
                <div
                  className={`absolute w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/25 shadow-2xl flex items-center justify-center transition-all duration-700 pointer-events-none ${
                    isHeroHovered || (isCurrentPlayingThisAlbum && isPlaying)
                      ? 'translate-x-12 sm:translate-x-16 rotate-180'
                      : 'translate-x-0'
                  }`}
                >
                  <div className="w-full h-full rounded-full border border-white/10 p-2 flex items-center justify-center">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-800 border-2 border-white/40 flex items-center justify-center shadow-inner ${
                      isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
                    }`}>
                      <img src={activeAlbum.cover_url} alt="" className="w-full h-full object-cover rounded-full" />
                      <div className="absolute w-3 h-3 rounded-full bg-black border border-white/60" />
                    </div>
                  </div>
                </div>

                {/* Cover Art */}
                <div className="relative z-10 w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-zinc-950">
                  <img
                    src={activeAlbum.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                    alt={activeAlbum.title}
                    className="w-full h-full object-cover select-none"
                  />
                  {/* Subtle Glow Ring */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Title & Artist */}
              <div className="mt-3.5 text-center">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9px] text-white font-extrabold uppercase tracking-widest mb-1 shadow-inner">
                  <Sparkles className="w-3 h-3 text-white" /> SPOTLIGHT ALBUM
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-cyber text-white uppercase tracking-wider">
                  {activeAlbum.title}
                </h2>
                <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mt-0.5">
                  {activeAlbum.artist || 'VAULT ARTIST'}
                </p>
              </div>

              {/* MODE SELECTION ON HOVER (CHỈ HIỆN KHI ĐƯA CHUỘT VÀO CARD) */}
              <div
                className={`flex items-center gap-2 mt-3 transition-all duration-300 ${
                  isHeroHovered
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAlbum(activeAlbum, 'audio');
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold font-mono text-[11px] uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
                >
                  <Music className="w-3 h-3 fill-current" />
                  <span>AUDIO</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSubscribed) {
                      onSelectAlbum(activeAlbum, 'video');
                    } else if (onOpenSubscriptionModal) {
                      onOpenSubscriptionModal();
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-full font-extrabold font-mono text-[11px] uppercase tracking-wider transition-all flex items-center gap-1 border shadow-lg ${
                    isSubscribed
                      ? 'bg-white/10 hover:bg-white/20 text-white border-white/40 hover:scale-105'
                      : 'bg-black/60 hover:bg-white/10 text-slate-300 border-white/20'
                  }`}
                >
                  {isSubscribed ? <Film className="w-3 h-3 text-white" /> : <Lock className="w-3 h-3 text-white/70" />}
                  <span>VIDEO MV</span>
                  {!isSubscribed && (
                    <span className="text-[7px] bg-white text-black px-1 py-0.2 rounded font-black uppercase ml-0.5">
                      VIP
                    </span>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* ======================================================================= */}
          {/* BLOCK 2: RESTRICTED ARCHIVE (Kho nhạc Độc quyền / R2 Vault Swiper)        */}
          {/* ======================================================================= */}
          <section className="w-full max-w-6xl mx-auto px-2 sm:px-4 my-6 font-mono select-none">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-md">
                  <Disc3 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-cyber text-white uppercase tracking-wider">
                    RESTRICTED ARCHIVE
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Kho lưu trữ Album đĩa than unreleased độc quyền từ R2 Vault
                  </p>
                </div>
              </div>

              {/* Swiper Arrow Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scrollArchive('left')}
                  className="p-2 rounded-full bg-white/5 hover:bg-white text-slate-300 hover:text-black border border-white/15 transition-all shadow-md active:scale-95"
                  title="Cuộn trái"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollArchive('right')}
                  className="p-2 rounded-full bg-white/5 hover:bg-white text-slate-300 hover:text-black border border-white/15 transition-all shadow-md active:scale-95"
                  title="Cuộn phải"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Horizontal Swiper */}
            <div
              ref={archiveSwiperRef}
              className="flex items-center gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-none"
            >
              {albums.map((album, idx) => {
                const isSelected = activeAlbum?.id === album.id;
                return (
                  <div
                    key={album.id || idx}
                    onClick={() => onSelectAlbum(album, 'audio')}
                    className="group relative flex-shrink-0 w-[200px] sm:w-[230px] p-3 rounded-2xl bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/30 backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-[1.03] snap-start shadow-xl"
                  >
                    {/* Artwork Container */}
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 border border-white/10 mb-3 shadow-md">
                      <img
                        src={album.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Top Metal Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-black/80 text-white border border-white/30 shadow-md backdrop-blur-md">
                          VAULT EXCLUSIVE
                        </span>
                        <span className="text-[7px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 shadow-md backdrop-blur-md">
                          LOSSLESS 24-BIT
                        </span>
                      </div>

                      {/* Hover Play Action Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate uppercase tracking-wide group-hover:text-white">
                      {album.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {album.artist || 'Nghệ sĩ'}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-white/5">
                      <span>{album.tracks ? `${album.tracks.length} BÀI` : 'ALBUM'}</span>
                      <span>{album.original_year || '2026'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ======================================================================= */}
          {/* BLOCK 3: GLOBAL RADAR (Nhạc Đề xuất & Thịnh hành từ YouTube Music API)    */}
          {/* ======================================================================= */}
          <GlobalRadarSection />

          {/* ======================================================================= */}
          {/* BLOCK 4: DAILY PROTOCOL (Playlist tự động theo ngày)                     */}
          {/* ======================================================================= */}
          <section className="w-full max-w-6xl mx-auto px-2 sm:px-4 my-6 font-mono select-none">
            <div className="relative w-full rounded-3xl bg-gradient-to-r from-slate-950 via-zinc-900 to-black border border-white/20 p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
              {/* Terminal scanlines */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_50%,transparent_50%)] bg-[length:100%_4px] pointer-events-none opacity-50" />

              <div className="flex items-center gap-4 z-10">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                  <Terminal className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9px] text-slate-300 font-extrabold uppercase tracking-widest mb-1.5">
                    <Calendar className="w-3 h-3 text-white" /> SYSTEM PROTOCOL MIX
                  </div>
                  <h3 className="text-lg sm:text-xl font-black font-cyber text-white uppercase tracking-wider">
                    DAILY MIX // PROTOCOL #{todayStr}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    Danh sách phát thông minh tự động tổng hợp các bản nhạc hiếm của Vault và hot trend toàn cầu.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 z-10 flex-shrink-0">
                <button
                  onClick={handleDailyProtocolPlay}
                  className="px-6 py-3 rounded-full bg-white hover:bg-slate-200 text-black font-black font-mono text-xs uppercase tracking-wider shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>PHÁT PROTOCOL MIX</span>
                </button>
              </div>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
