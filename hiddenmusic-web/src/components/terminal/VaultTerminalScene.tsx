'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Disc3,
  Music,
  Film,
  Lock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  Terminal,
} from 'lucide-react';
import { Album, TrackItem } from '../../types/database';
import { usePlayer } from '../../context/PlayerContext';
import { isVipSubscribed } from '../../lib/authSession';
import GlobalRadarSection from '../ui/GlobalRadarSection';
import SubscriptionModal from '../ui/SubscriptionModal';
import HybridSearchModal from '../ui/HybridSearchModal';

interface VaultTerminalSceneProps {
  initialAlbums?: Album[];
}

export default function VaultTerminalScene({ initialAlbums = [] }: VaultTerminalSceneProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVip, setIsVip] = useState(false);

  const archiveSwiperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVip(isVipSubscribed());
  }, []);

  const activeSpotlightAlbum = albums[0] || {
    id: 'hvl',
    title: 'HVL',
    artist: 'MCK',
    cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000',
  };

  const scrollArchive = (direction: 'left' | 'right') => {
    if (archiveSwiperRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      archiveSwiperRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const handlePlayAlbumDirectly = (album: Album) => {
    if (album.tracks && album.tracks.length > 0) {
      playTrack(album.tracks[0], album, album.tracks);
    } else {
      window.location.href = `/album/${album.id}`;
    }
  };

  return (
    <div className="w-full min-h-screen pt-16 sm:pt-20 pb-32 px-3 sm:px-6 md:px-8 font-mono select-none flex flex-col items-center">
      
      {/* ========================================================================= */}
      {/* BLOCK 1: SPOTLIGHT HERO (Nhạc tiêu điểm)                                   */}
      {/* ========================================================================= */}
      <section
        className="group/deck relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center my-4 sm:my-8 text-center"
        onMouseEnter={() => setIsHeroHovered(true)}
        onMouseLeave={() => setIsHeroHovered(false)}
      >
        {/* Dynamic Backdrop Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[450px] h-[320px] sm:h-[450px] rounded-full pointer-events-none blur-[110px] opacity-35 animate-pulse-slow"
          style={{
            backgroundImage: `radial-gradient(circle, #ffffff 0%, #3b82f6 40%, #7c3aed 70%, transparent 100%)`,
          }}
        />

        {/* Spotlight Card */}
        <div
          onClick={() => (window.location.href = `/album/${activeSpotlightAlbum.id}`)}
          className="relative z-10 cursor-pointer p-4 sm:p-6 rounded-3xl bg-black/50 border border-white/15 backdrop-blur-xl shadow-2xl flex flex-col items-center transition-all duration-500 hover:border-white/30 hover:scale-[1.02]"
        >
          {/* Vinyl & Sleeve Composition */}
          <div className="relative mx-auto flex items-center justify-center w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]">
            {/* Sliding Grooved Vinyl */}
            <div
              className={`absolute w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/25 shadow-2xl flex items-center justify-center transition-all duration-700 pointer-events-none ${
                isHeroHovered ? 'translate-x-12 sm:translate-x-16 rotate-180' : 'translate-x-0'
              }`}
            >
              <div className="w-full h-full rounded-full border border-white/10 p-2 flex items-center justify-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-800 border-2 border-white/40 flex items-center justify-center shadow-inner">
                  <img src={activeSpotlightAlbum.cover_url} alt="" className="w-full h-full object-cover rounded-full" />
                  <div className="absolute w-3 h-3 rounded-full bg-black border border-white/60" />
                </div>
              </div>
            </div>

            {/* Sleeve Cover */}
            <div className="relative z-10 w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-zinc-950">
              <img
                src={activeSpotlightAlbum.cover_url}
                alt={activeSpotlightAlbum.title}
                className="w-full h-full object-cover select-none"
              />
            </div>
          </div>

          {/* Title & Artist */}
          <div className="mt-3.5 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9px] text-white font-extrabold uppercase tracking-widest mb-1 shadow-inner">
              <Sparkles className="w-3 h-3 text-white" /> SPOTLIGHT ALBUM
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-cyber text-white uppercase tracking-wider">
              {activeSpotlightAlbum.title}
            </h2>
            <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mt-0.5">
              {activeSpotlightAlbum.artist || 'VAULT ARTIST'}
            </p>
          </div>

          {/* MODE SELECTION (CHỈ HIỆN KHI ĐƯA CHUỘT VÀO) */}
          <div
            className={`flex items-center gap-2 mt-3 transition-all duration-300 ${
              isHeroHovered ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/album/${activeSpotlightAlbum.id}?mode=audio`;
              }}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold text-[11px] uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
            >
              <Music className="w-3 h-3 fill-current" />
              <span>AUDIO</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isVip) {
                  window.location.href = `/album/${activeSpotlightAlbum.id}?mode=video`;
                } else {
                  setIsVipModalOpen(true);
                }
              }}
              className="px-3.5 py-1.5 rounded-full font-extrabold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1 border border-white/20 bg-black/60 hover:bg-white/10 text-slate-300 hover:border-white/40 shadow-lg"
            >
              {isVip ? <Film className="w-3 h-3 text-white" /> : <Lock className="w-3 h-3 text-white/70" />}
              <span>VIDEO MV</span>
              {!isVip && (
                <span className="text-[7px] bg-white text-black px-1 py-0.2 rounded font-black uppercase ml-0.5">
                  VIP
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* BLOCK 2: RESTRICTED ARCHIVE (Kho nhạc Độc quyền / R2 Vault Swiper)          */}
      {/* ========================================================================= */}
      <section className="w-full max-w-6xl mx-auto px-2 sm:px-4 my-6 select-none">
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollArchive('left')}
              className="p-2 rounded-full bg-white/5 hover:bg-white text-slate-300 hover:text-black border border-white/15 transition-all shadow-md active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollArchive('right')}
              className="p-2 rounded-full bg-white/5 hover:bg-white text-slate-300 hover:text-black border border-white/15 transition-all shadow-md active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={archiveSwiperRef}
          className="flex items-center gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-none"
        >
          {albums.map((album, idx) => (
            <div
              key={album.id || idx}
              onClick={() => (window.location.href = `/album/${album.id}`)}
              className="group relative flex-shrink-0 w-[200px] sm:w-[230px] p-3 rounded-2xl bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/30 backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-[1.03] snap-start shadow-xl"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 border border-white/10 mb-3 shadow-md">
                <img
                  src={album.cover_url || '/icon.svg'}
                  alt={album.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-black/80 text-white border border-white/30 shadow-md backdrop-blur-md">
                    VAULT EXCLUSIVE
                  </span>
                  <span className="text-[7px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 shadow-md backdrop-blur-md">
                    LOSSLESS 24-BIT
                  </span>
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <h4 className="text-xs sm:text-sm font-bold text-white truncate uppercase tracking-wide">
                {album.title}
              </h4>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{album.artist || 'Nghệ sĩ'}</p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-white/5">
                <span>{album.tracks ? `${album.tracks.length} BÀI` : 'ALBUM'}</span>
                <span>{album.original_year || '2026'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* BLOCK 3: GLOBAL RADAR (Nhạc Đề xuất & Thịnh hành từ YouTube Music API)      */}
      {/* ========================================================================= */}
      <GlobalRadarSection />

      {/* ========================================================================= */}
      {/* BLOCK 4: DAILY PROTOCOL (Playlist tự động theo ngày)                       */}
      {/* ========================================================================= */}
      <section className="w-full max-w-6xl mx-auto px-2 sm:px-4 my-6 select-none">
        <div className="relative w-full rounded-3xl bg-gradient-to-r from-slate-950 via-zinc-900 to-black border border-white/20 p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
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
              onClick={() => {
                if (albums.length > 0 && albums[0].tracks) {
                  playTrack(albums[0].tracks[0], albums[0], albums[0].tracks);
                }
              }}
              className="px-6 py-3 rounded-full bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-wider shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>PHÁT PROTOCOL MIX</span>
            </button>
          </div>
        </div>
      </section>

      {/* VIP Subscription Modal */}
      <SubscriptionModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        onSubscribed={() => setIsVip(true)}
      />

      {/* Hybrid Search Modal */}
      <HybridSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        vaultAlbums={albums}
      />
    </div>
  );
}
