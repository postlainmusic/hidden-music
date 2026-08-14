'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Play,
  Pause,
  Music,
  Film,
  Disc3,
  Radio,
  Layers
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

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();

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

  const tracks = album.tracks || [];
  const isCurrentPlayingThisAlbum = currentTrack && tracks.some((t) => t.id === currentTrack.id);

  const handlePlayAlbum = () => {
    if (tracks.length > 0) {
      const trackToPlay = selectedTrack || tracks[0];
      playTrack(trackToPlay, album, tracks);
    }
  };

  return (
    <main className="h-screen w-screen bg-black text-white font-cyber relative overflow-hidden flex flex-col justify-between select-none">
      {/* Top Fixed Header */}
      <Navbar showBackButton={true} />

      {/* Analog TV Grain Noise & CRT Scanlines Overlays */}
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

      {/* Main Single-Viewport Content Area (Wide, Zero Page Scroll on Desktop) */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 flex items-center justify-center relative z-10 pt-16 md:pt-20 pb-28 md:pb-32 overflow-hidden">
        
        {/* Spacious Responsive Layout: Left Showcase & Right Wide Playlist */}
        <div className="w-full flex flex-col md:flex-row items-center md:items-center justify-center gap-6 md:gap-8 lg:gap-12 max-h-full">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Album Cover Showcase & Primary Controls                      */}
          {/* ========================================================================= */}
          <div
            className={`w-full md:w-[320px] lg:w-[360px] xl:w-[400px] shrink-0 flex flex-col items-center text-center space-y-3.5 lg:space-y-4 transition-all duration-700 ease-out ${
              animateSlide
                ? 'md:translate-x-0 md:opacity-100'
                : 'md:translate-x-[180px] lg:translate-x-[240px] md:scale-105 opacity-90'
            } animate-slideUp`}
          >
            {/* Album Cover Art Card */}
            <div
              id="album-cover-box"
              className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 rounded-3xl overflow-hidden border-2 border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.9)] group bg-zinc-950 transition-all duration-500 hover:border-white/60 flex-shrink-0"
            >
              <img
                src={album.cover_url}
                alt={album.title}
                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                  isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
                }`}
              />
              <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                <button
                  onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
                  title={isCurrentPlayingThisAlbum && isPlaying ? 'Tạm dừng' : 'Phát album'}
                  className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
                >
                  {isCurrentPlayingThisAlbum && isPlaying ? (
                    <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" />
                  )}
                </button>
              </div>

              {/* Year Badge */}
              <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-[9px] font-mono font-extrabold uppercase tracking-widest text-white flex items-center gap-1">
                <Disc3 className={`w-3 h-3 text-white ${isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin' : ''}`} />
                <span>{album.original_year || 'ARCHIVE'}</span>
              </div>
            </div>

            {/* Title & Artist */}
            <div className="space-y-1 px-2 w-full">
              <h1 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-extrabold tracking-wider uppercase text-white font-cyber truncate">
                {album.title}
              </h1>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest truncate">
                {album.artist} • {album.original_year}
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="w-full max-w-xs flex flex-col items-center gap-1.5">
              <button
                onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
                className="w-full py-2.5 sm:py-3 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold font-mono text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
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

              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-500" />
                <span>{tracks.length} TRACKS IN VAULT</span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: Wide Unified Tracklist Card (Hidden Scrollbar)              */}
          {/* ========================================================================= */}
          <div
            className={`w-full flex-1 min-w-0 font-mono transition-all duration-700 delay-100 ease-out ${
              animateSlide
                ? 'md:translate-x-0 md:opacity-100'
                : 'md:translate-x-20 md:opacity-0 pointer-events-none'
            }`}
          >
            {/* Wide Unified Card Enclosing All Tracks */}
            <div className="bw-panel rounded-3xl p-3.5 sm:p-5 border border-white/20 shadow-2xl backdrop-blur-2xl h-[370px] sm:h-[410px] md:h-[440px] lg:h-[480px] xl:h-[500px] flex flex-col w-full">
              
              {/* Scrollable Tracklist Area with Zero Visible Scrollbar (Smooth Wheel Scroll) */}
              <div className="flex-1 overflow-y-auto space-y-2.5 select-none no-scrollbar">
                {tracks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                    <Disc3 className="w-8 h-8 text-slate-600 animate-spin-slow mb-2" />
                    <p className="text-xs uppercase tracking-widest">No tracks uploaded yet in this archive.</p>
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
                        className={`p-3 sm:p-4 rounded-2xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
                          isCurrentPlaying
                            ? 'bg-white text-black font-extrabold border-white shadow-xl scale-[1.01]'
                            : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/15 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {/* Left: Index + Icon + Full Title */}
                        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 pr-4">
                          <span
                            className={`w-5 sm:w-6 font-mono font-bold text-xs ${
                              isCurrentPlaying ? 'text-black font-black' : 'text-slate-500'
                            }`}
                          >
                            {trackIndex}
                          </span>

                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                              isCurrentPlaying
                                ? 'bg-black text-white border-black'
                                : 'bg-white/10 text-white border-white/15'
                            }`}
                          >
                            {isCurrentPlaying && isPlaying ? (
                              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-pulse" />
                            ) : (
                              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                          </div>

                          <span className="truncate text-xs sm:text-sm font-bold font-cyber tracking-wide">
                            {track.title}
                          </span>
                        </div>

                        {/* Right: Badges & Wave Indicator */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {track.audio_url && (
                            <span
                              className={`text-[8px] sm:text-[9px] uppercase px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                                isCurrentPlaying
                                  ? 'bg-black text-white border-black'
                                  : 'bg-white/10 text-white border-white/20'
                              }`}
                            >
                              <Music className="w-2.5 h-2.5 text-white" /> AUDIO
                            </span>
                          )}

                          {track.video_url && (
                            <span
                              className={`text-[8px] sm:text-[9px] uppercase px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                                isCurrentPlaying
                                  ? 'bg-black text-cyan-300 border-cyan-400'
                                  : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                              }`}
                            >
                              <Film className="w-2.5 h-2.5 text-cyan-400" /> MV
                            </span>
                          )}

                          {/* Equalizer bouncy wave indicator when actively playing */}
                          {isCurrentPlaying && isPlaying && (
                            <div className="flex items-end gap-0.5 h-3.5 pl-1.5">
                              <span className="w-0.5 sm:w-1 bg-black rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms' }} />
                              <span className="w-0.5 sm:w-1 bg-black rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
                              <span className="w-0.5 sm:w-1 bg-black rounded-full animate-bounce" style={{ height: '75%', animationDelay: '300ms' }} />
                            </div>
                          )}
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
