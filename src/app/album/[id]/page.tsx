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
    <main className="h-screen w-screen bg-black text-white font-cyber relative overflow-hidden flex flex-col justify-between select-none">
      {/* Top Fixed Header with clean BACK button */}
      <Navbar showBackButton={true} />

      {/* Analog TV Grain Noise & CRT Scanlines Overlays */}
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

      {/* Dynamic Ambient Background Glow from Cover Art */}
      <div
        className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full pointer-events-none opacity-20 blur-[130px] transition-all duration-1000 z-0"
        style={{
          backgroundImage: `radial-gradient(circle, #ffffff 0%, #3b82f6 40%, #7c3aed 70%, transparent 100%)`,
        }}
      />

      {/* Main Single-Viewport Content Area (Zero Page Scroll) */}
      <div className="flex-1 w-full max-w-[1520px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 flex items-center justify-center relative z-10 pt-16 md:pt-20 pb-28 md:pb-32 overflow-hidden">
        
        {/* Main Grid: Left Vinyl Deck & Right Clean Unified Playlist */}
        <div className="w-full flex flex-col lg:flex-row items-center lg:items-center justify-center gap-6 sm:gap-8 lg:gap-12 xl:gap-16 max-h-full">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Ultra-Premium 3D Vinyl Sleeve Showcase                       */}
          {/* ========================================================================= */}
          <div
            className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col items-center text-center space-y-3 sm:space-y-4 transition-all duration-700 ease-out ${
              animateSlide
                ? 'lg:translate-x-0 lg:opacity-100'
                : 'lg:translate-x-[180px] lg:scale-105 opacity-90'
            } animate-slideUp`}
          >
            {/* 3D Vinyl Sleeve Deck with Realistic Peek & Slide Out */}
            <div
              className="relative group cursor-pointer flex items-center justify-center"
              onMouseEnter={() => setIsCoverHovered(true)}
              onMouseLeave={() => setIsCoverHovered(false)}
              onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
            >
              {/* Dynamic Beat Glowing Rim behind the sleeve */}
              <div
                id="album-cover-glow"
                className="absolute inset-0 rounded-3xl transition-all duration-150 pointer-events-none opacity-0 blur-2xl scale-110 z-0"
              />

              {/* Realistic Grooved 3D Vinyl Disc that slides out with live beat reactivity */}
              <div
                id="album-vinyl-disc"
                className={`absolute w-44 h-44 sm:w-52 sm:h-52 md:w-60 md:h-60 lg:w-64 lg:h-64 xl:w-72 xl:h-72 rounded-full bg-[#0a0a0a] border border-white/20 shadow-[0_15px_40px_rgba(0,0,0,0.9)] flex items-center justify-center transition-all duration-700 ease-out z-0 ${
                  (isCoverHovered || (isCurrentPlayingThisAlbum && isPlaying))
                    ? 'translate-x-20 sm:translate-x-24 md:translate-x-32 rotate-90 scale-95 opacity-100'
                    : 'translate-x-0 scale-90 opacity-0'
                }`}
                style={{
                  background: 'radial-gradient(circle, #222 2%, #0d0d0d 15%, #181818 30%, #080808 45%, #151515 60%, #050505 85%, #000 100%)',
                }}
              >
                {/* Vinyl Grooves Texture */}
                <div className="absolute inset-2 rounded-full border border-white/[0.06]" />
                <div className="absolute inset-6 rounded-full border border-white/[0.08]" />
                <div className="absolute inset-12 rounded-full border border-white/[0.1]" />
                <div className="absolute inset-16 rounded-full border border-white/[0.07]" />

                {/* Central Center Label with Mini Album Artwork */}
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-white/30 overflow-hidden shadow-inner flex items-center justify-center ${
                  isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
                }`}>
                  <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute w-3 h-3 rounded-full bg-black border border-white/40" />
                </div>
              </div>

              {/* Front Double-Beveled Glass Album Sleeve with Synchronized Beat Rim Lighting */}
              <div
                id="album-cover-box"
                className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 rounded-3xl overflow-hidden border-2 border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.95)] group-hover:border-white/50 transition-all duration-150 bg-zinc-950 flex-shrink-0 z-10"
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
                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full bg-white/90 backdrop-blur-md text-black flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-300 group-hover:scale-110 group-hover:bg-white active:scale-95"
                  >
                    {isCurrentPlayingThisAlbum && isPlaying ? (
                      <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                    ) : (
                      <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Album Title & Artist */}
            <div className="space-y-1 px-2 w-full">
              <h1 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black tracking-tight uppercase text-white font-cyber truncate drop-shadow-md">
                {album.title}
              </h1>
              <p className="text-xs sm:text-sm font-mono text-slate-300 uppercase tracking-widest font-semibold truncate">
                {album.artist}
              </p>
            </div>

            {/* Action Buttons Deck */}
            <div className="w-full max-w-sm flex items-center gap-2 pt-1">
              {/* Main Play / Pause Button */}
              <button
                onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
                className="flex-1 py-3 px-5 rounded-full bg-white hover:bg-slate-100 text-black font-black font-mono text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isCurrentPlayingThisAlbum && isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>PAUSE PLAYBACK</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>PLAY ALL TRACKS</span>
                  </>
                )}
              </button>

              {/* Shuffle Button */}
              <button
                onClick={handleShufflePlay}
                title={shuffleMode ? 'Tắt trộn bài' : 'Phát ngẫu nhiên'}
                className={`p-3 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                  shuffleMode
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: Ultra-Sleek Modern Minimalist Playlist                       */}
          {/* ========================================================================= */}
          <div
            className={`w-full flex-1 min-w-0 font-mono transition-all duration-700 delay-100 ease-out ${
              animateSlide
                ? 'lg:translate-x-0 lg:opacity-100'
                : 'lg:translate-x-20 lg:opacity-0 pointer-events-none'
            }`}
          >
            {/* Unified Glass Panel with Luxury Finish */}
            <div className="rounded-3xl p-2.5 sm:p-3.5 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] bg-[#0b0b0d]/75 backdrop-blur-2xl h-[420px] sm:h-[460px] md:h-[490px] lg:h-[510px] xl:h-[530px] flex flex-col w-full overflow-hidden">
              
              {/* Scrollable Tracklist with Perfect Padding and Clean Alignment */}
              <div className="flex-1 overflow-y-auto space-y-1 select-none no-scrollbar px-1 py-1">
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
