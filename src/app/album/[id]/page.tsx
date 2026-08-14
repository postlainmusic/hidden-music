'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Play,
  Pause,
  Music,
  Film,
  Disc3,
  Shuffle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Album, TrackItem } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';
import Navbar from '@/components/ui/Navbar';
import { hasActiveSession, getStoredUserSession, setStoredUserSession } from '@/lib/authSession';

export default function AlbumDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [mounted, setMounted] = useState(false);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<TrackItem | null>(null);
  const [animateSlide, setAnimateSlide] = useState(false);
  const [isCoverHovered, setIsCoverHovered] = useState(false);

  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    shuffleMode,
    toggleShuffle,
  } = usePlayer();

  useEffect(() => {
    setMounted(true);

    async function checkAuthAndFetchAlbum() {
      if (!id) return;

      // 1. Instant local cache read (0ms)
      try {
        const cached = localStorage.getItem(`hidden_vault_album_cache_${id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) {
            setAlbum(parsed);
            if (parsed.tracks && parsed.tracks.length > 0) {
              setSelectedTrack(parsed.tracks[0]);
            }
            setLoading(false);
          }
        }
      } catch {}

      // Safety timeout: Never hang in loading state for more than 3 seconds
      const timeoutTimer = setTimeout(() => {
        setLoading(false);
      }, 3000);

      try {
        const supabase = createClient();
        let authenticated = hasActiveSession();

        if (!authenticated) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            authenticated = true;
            setStoredUserSession(session.user);
          }
        }

        if (!authenticated) {
          clearTimeout(timeoutTimer);
          window.location.href = '/';
          return;
        }

        const { data, error } = await supabase
          .from('albums')
          .select('*, tracks(*)')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Supabase album query error:', error);
        } else if (data) {
          if (data.tracks) {
            data.tracks.sort((a: TrackItem, b: TrackItem) => {
              return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
            });
          }
          setAlbum(data);
          try {
            localStorage.setItem(`hidden_vault_album_cache_${id}`, JSON.stringify(data));
          } catch {}
          if (data.tracks && data.tracks.length > 0 && !selectedTrack) {
            setSelectedTrack(data.tracks[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching album details:', err);
      } finally {
        clearTimeout(timeoutTimer);
        setLoading(false);
      }
    }

    checkAuthAndFetchAlbum();
  }, [id]);

  // Smooth entrance transition trigger
  useEffect(() => {
    if (album) {
      setAnimateSlide(false);
      const timer = setTimeout(() => {
        setAnimateSlide(true);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [id, album?.id]);

  const tracks = useMemo(() => album?.tracks || [], [album]);
  const isCurrentPlayingThisAlbum = currentTrack && tracks.some((t) => t.id === currentTrack.id);

  const handlePlayAlbum = () => {
    if (tracks.length > 0) {
      const trackToPlay = selectedTrack || tracks[0];
      playTrack(trackToPlay, album, tracks);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      if (!shuffleMode) toggleShuffle();
      const randomIndex = Math.floor(Math.random() * tracks.length);
      playTrack(tracks[randomIndex], album, tracks);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '03:20';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!mounted || (loading && !album)) {
    return (
      <main className="h-screen bg-black text-white p-8 flex flex-col items-center justify-center font-mono overflow-hidden">
        <Navbar showBackButton={true} />
        <div className="flex items-center gap-3 text-slate-400">
          <Disc3 className="w-6 h-6 animate-spin text-white" />
          <span className="text-xs uppercase tracking-widest font-cyber">DECRYPTING VAULT ARCHIVE...</span>
        </div>
      </main>
    );
  }

  if (!album) {
    return (
      <main className="h-screen bg-black text-white p-8 flex flex-col items-center justify-center font-mono text-center overflow-hidden">
        <Navbar showBackButton={true} />
        <h2 className="text-xl font-bold mb-4 font-cyber">ALBUM NOT FOUND IN VAULT</h2>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-xl transition-transform hover:scale-105"
        >
          BACK TO 3D VAULT
        </Link>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] w-full bg-[#09090d] text-white font-cyber relative overflow-hidden flex flex-col justify-between select-none">
      {/* Top Fixed Header with clean BACK button */}
      <Navbar showBackButton={true} />

      {/* Dynamic Ambient Background Glow from Cover Art */}
      <div
        className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full pointer-events-none opacity-20 blur-[130px] transition-all duration-1000 z-0"
        style={{
          backgroundImage: `radial-gradient(circle, #ffffff 0%, #3b82f6 40%, #7c3aed 70%, transparent 100%)`,
        }}
      />

      {/* Main Single-Viewport Locked Content Area (Auto-Fit across All Breakpoints) */}
      <div className="flex-1 min-h-0 w-full max-w-[1520px] mx-auto px-3 sm:px-6 md:px-8 lg:px-12 flex flex-col lg:flex-row items-center justify-center gap-3 sm:gap-6 lg:gap-14 overflow-hidden pt-14 sm:pt-16 pb-20 sm:pb-24">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Ultra-Premium 3D Vinyl Sleeve Showcase (Auto-Sized)         */}
        {/* ========================================================================= */}
        <div
          className={`w-full lg:w-[360px] xl:w-[400px] shrink-0 flex flex-col items-center text-center space-y-1.5 sm:space-y-3 relative z-20 transition-all duration-700 ease-out max-h-[36vh] lg:max-h-none ${
            animateSlide
              ? 'lg:translate-x-0 lg:opacity-100'
              : 'lg:translate-x-[180px] lg:scale-105 opacity-90'
          } animate-slideUp`}
        >
          {/* 3D Vinyl Sleeve Deck with Realistic Peek & Slide Out */}
          <div
            className="relative group cursor-pointer flex items-center justify-center overflow-visible"
            onMouseEnter={() => setIsCoverHovered(true)}
            onMouseLeave={() => setIsCoverHovered(false)}
            onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
          >
            {/* Outer Wrapper that handles the physical slide-out to the right */}
            <div
              id="album-vinyl-wrapper"
              className={`absolute w-28 h-28 xs:w-36 xs:h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 xl:w-72 xl:h-72 transition-all duration-700 ease-out z-0 pointer-events-none ${
                (isCoverHovered || (isCurrentPlayingThisAlbum && isPlaying))
                  ? 'translate-x-10 sm:translate-x-18 md:translate-x-22 opacity-100'
                  : 'translate-x-0 opacity-0'
              }`}
            >
              {/* Inner Disc that handles the physical vocal bounce & rotating vinyl grooves */}
              <div
                id="album-vinyl-disc"
                className="w-full h-full rounded-full bg-[#0a0a0a] shadow-[0_15px_40px_rgba(0,0,0,0.9)] flex items-center justify-center will-change-transform"
                style={{
                  background: 'radial-gradient(circle, #222 2%, #0d0d0d 15%, #181818 30%, #080808 45%, #151515 60%, #050505 85%, #000 100%)',
                }}
              >
                {/* Vinyl Grooves Texture */}
                <div className="absolute inset-2 rounded-full border border-white/[0.04]" />
                <div className="absolute inset-5 rounded-full border border-white/[0.06]" />
                <div className="absolute inset-10 rounded-full border border-white/[0.08]" />
                <div className="absolute inset-14 rounded-full border border-white/[0.05]" />

                {/* Central Center Label with Mini Album Artwork */}
                <div className={`w-10 h-10 sm:w-14 sm:h-14 md:w-18 md:h-18 rounded-full overflow-hidden shadow-inner flex items-center justify-center ${
                  isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
                }`}>
                  <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute w-2 h-2 rounded-full bg-black" />
                </div>
              </div>
            </div>

            {/* Front Borderless Album Sleeve with Dynamic Vocal Reactivity */}
            <div
              id="album-cover-box"
              className="relative w-28 h-28 xs:w-36 xs:h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 xl:w-72 xl:h-72 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95)] bg-zinc-950 flex-shrink-0 z-10 will-change-transform"
            >
              {/* Full-Color Cover Artwork */}
              <img
                src={album.cover_url}
                alt={album.title}
                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                  isCurrentPlayingThisAlbum && isPlaying ? 'scale-[1.02]' : ''
                }`}
              />

              {/* Overlay with Gloss Sheen */}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-white/10 opacity-70 group-hover:opacity-40 transition-opacity" />

              {/* Floating Central Play / Pause Button with Backdrop Blur */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-white/90 backdrop-blur-md text-black flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-300 group-hover:scale-110 group-hover:bg-white active:scale-95"
                >
                  {isCurrentPlayingThisAlbum && isPlaying ? (
                    <Pause className="w-4 h-4 sm:w-6 sm:h-6 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-6 sm:h-6 fill-current ml-0.5" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Album Title & Artist */}
          <div className="space-y-0.5 px-2 w-full">
            <h1 className="text-sm xs:text-base sm:text-2xl lg:text-3xl font-black tracking-tight uppercase text-white font-cyber truncate drop-shadow-md">
              {album.title}
            </h1>
            <p className="text-[10px] sm:text-xs font-mono text-slate-300 uppercase tracking-widest font-semibold truncate">
              {album.artist}
            </p>
          </div>

          {/* Action Buttons Deck */}
          <div className="w-full max-w-xs flex items-center gap-2 pt-0.5">
            {/* Main Play / Pause Button */}
            <button
              onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
              className="flex-1 py-1.5 sm:py-2.5 px-3 sm:px-4 rounded-full bg-white hover:bg-slate-100 text-black font-black font-mono text-[10px] sm:text-xs uppercase tracking-wider shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5"
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

            {/* Shuffle Button */}
            <button
              onClick={handleShufflePlay}
              title={shuffleMode ? 'Tắt trộn bài' : 'Phát ngẫu nhiên'}
              className={`p-1.5 sm:p-2.5 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                shuffleMode
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Dark Neumorphic Soft-Emboss Playlist Panel (Scrollable)     */}
        {/* ========================================================================= */}
        <div
          className={`flex-1 min-h-0 w-full max-w-2xl h-full flex flex-col font-mono transition-all duration-700 delay-100 ease-out ${
            animateSlide
              ? 'lg:translate-x-0 lg:opacity-100'
              : 'lg:translate-x-20 lg:opacity-0 pointer-events-none'
          }`}
        >
          {/* Unified Dark Neumorphic Panel */}
          <div className="dark-neumorph-card p-2 sm:p-3 md:p-4 h-full flex flex-col w-full overflow-hidden">
            
            {/* Scrollable Tracklist with Smooth Touch Scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 select-none no-scrollbar px-0.5 py-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                          setSelectedTrack(track);
                          playTrack(track, album, tracks);
                        }}
                        className={`group relative h-13 sm:h-14 px-3.5 sm:px-4 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
                          isCurrentPlaying
                            ? 'bg-white/[0.10] border-white/25 shadow-[0_0_20px_rgba(255,255,255,0.06)]'
                            : 'bg-transparent hover:bg-white/[0.04] border-transparent hover:border-white/[0.08]'
                        }`}
                      >
                        {/* Left: Index / Wave Equalizer + Track Title */}
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-3">
                          {/* Index or Live Wave */}
                          <div className="w-6 flex items-center justify-center flex-shrink-0">
                            {isCurrentPlaying && isPlaying ? (
                              <div className="flex items-end gap-[2px] h-3.5">
                                <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '70%', animationDelay: '0ms' }} />
                                <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
                                <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '85%', animationDelay: '300ms' }} />
                              </div>
                            ) : (
                              <>
                                <span
                                  className={`text-xs font-mono font-bold group-hover:hidden ${
                                    isCurrentPlaying ? 'text-white font-black' : 'text-slate-500'
                                  }`}
                                >
                                  {trackIndex}
                                </span>
                                <Play className="w-3.5 h-3.5 fill-white text-white hidden group-hover:block transition-all" />
                              </>
                            )}
                          </div>

                          {/* Track Title */}
                          <span
                            className={`truncate text-xs sm:text-sm font-cyber tracking-wide ${
                              isCurrentPlaying ? 'text-white font-black' : 'text-slate-300 group-hover:text-white font-medium'
                            }`}
                          >
                            {track.title}
                          </span>
                        </div>

                        {/* Right: MV Badge + Duration */}
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                          {track.video_url && (
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                              MV
                            </span>
                          )}

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

            </div>

          </div>

        </div>
      </div>
    </main>
  );
}
