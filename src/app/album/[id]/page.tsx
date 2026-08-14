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
  ListMusic,
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

      // 1. Try to load from instant local cache (0ms)
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
      // Start in centered position, then glide to split layout on desktop
      setAnimateSlide(false);
      const timer = setTimeout(() => {
        setAnimateSlide(true);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [id, album?.id]);

  if (!mounted || (loading && !album)) {
    return (
      <main className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center font-mono">
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
      <main className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center font-mono text-center">
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
    <main className="min-h-screen bg-black text-white font-cyber relative overflow-x-hidden pt-20 md:pt-28 pb-36 select-none flex flex-col">
      {/* Top Fixed Header */}
      <Navbar showBackButton={true} title={album.title} />

      {/* Analog TV Grain Noise & CRT Scanlines Overlays */}
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 w-full relative z-10 flex-1 flex flex-col justify-center">
        
        {/* Responsive Dual Layout: Mobile Stack (top-down) & Desktop Split Horizontal Slide */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-center gap-8 lg:gap-14 w-full">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Album Cover Showcase & Primary Controls                      */}
          {/* Desktop Animation: Starts centered, then slides gracefully to the left    */}
          {/* Mobile Animation: Standard smooth vertical entrance                      */}
          {/* ========================================================================= */}
          <div
            className={`w-full md:w-[350px] lg:w-[400px] shrink-0 flex flex-col items-center text-center space-y-5 md:sticky md:top-28 transition-all duration-700 ease-out ${
              animateSlide
                ? 'md:translate-x-0 md:opacity-100'
                : 'md:translate-x-[180px] lg:translate-x-[220px] md:scale-105 opacity-90'
            } animate-slideUp`}
          >
            {/* Album Cover Art Card */}
            <div
              id="album-cover-box"
              className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-84 lg:h-84 xl:w-96 xl:h-96 rounded-3xl overflow-hidden border-2 border-white/30 shadow-[0_20px_60px_rgba(0,0,0,0.9)] group bg-zinc-950 transition-all duration-500 hover:border-white/60"
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
                  className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
                >
                  {isCurrentPlayingThisAlbum && isPlaying ? (
                    <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
                  )}
                </button>
              </div>

              {/* Status Badge on Cover */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[9px] font-mono font-extrabold uppercase tracking-widest text-white flex items-center gap-1.5">
                <Disc3 className={`w-3 h-3 text-white ${isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin' : ''}`} />
                <span>{album.original_year || 'ARCHIVE'}</span>
              </div>
            </div>

            {/* Title & Artist */}
            <div className="space-y-1.5 px-2 w-full">
              <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-extrabold tracking-wider uppercase text-white font-cyber break-words">
                {album.title}
              </h1>
              <p className="text-xs sm:text-sm font-mono text-slate-400 uppercase tracking-widest">
                {album.artist} • {album.original_year}
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="w-full max-w-xs flex flex-col items-center gap-2 pt-1">
              <button
                onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
                className="w-full py-3 sm:py-3.5 rounded-full bg-white hover:bg-slate-200 text-black font-extrabold font-mono text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
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

              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-slate-500" />
                <span>{tracks.length} TRACKS IN VAULT</span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: Tracklist / Playlist                                        */}
          {/* Desktop Animation: Slides smoothly from center to the right with stagger  */}
          {/* Mobile Animation: Directly stacked below album cover                      */}
          {/* ========================================================================= */}
          <div
            className={`w-full flex-1 min-w-0 space-y-4 font-mono transition-all duration-700 delay-100 ease-out ${
              animateSlide
                ? 'md:translate-x-0 md:opacity-100'
                : 'md:translate-x-20 md:opacity-0 pointer-events-none'
            }`}
          >
            {/* Tracklist Header Bar */}
            <div className="bw-panel rounded-2xl p-4 border border-white/20 flex items-center justify-between backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                  <ListMusic className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider font-cyber">
                    DANH SÁCH BÀI HÁT
                  </h3>
                  <p className="text-[10px] text-slate-400">Archive Vault Playlist ({tracks.length} Items)</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase">
                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-slate-300 hidden sm:inline">
                  LOSSLESS
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 hidden sm:inline">
                  4K MV
                </span>
              </div>
            </div>

            {/* Track Items List */}
            <div className="space-y-2.5">
              {tracks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bw-panel rounded-2xl p-6 border border-white/10">
                  <Disc3 className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-spin-slow" />
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
                      className={`p-3.5 sm:p-4 rounded-2xl cursor-pointer transition-all duration-200 flex items-center justify-between backdrop-blur-md border ${
                        isCurrentPlaying
                          ? 'bg-white text-black font-extrabold border-white shadow-2xl scale-[1.01]'
                          : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/15 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {/* Left: Track Number & Title */}
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <span
                          className={`w-6 font-mono font-bold text-xs tracking-wider ${
                            isCurrentPlaying ? 'text-black font-black' : 'text-slate-500'
                          }`}
                        >
                          {trackIndex}
                        </span>

                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                            isCurrentPlaying
                              ? 'bg-black text-white border-black'
                              : 'bg-white/10 text-white border-white/15'
                          }`}
                        >
                          {isCurrentPlaying && isPlaying ? (
                            <Radio className="w-4 h-4 text-white animate-pulse" />
                          ) : (
                            <Music className="w-4 h-4" />
                          )}
                        </div>

                        <span className="truncate text-xs sm:text-sm font-bold tracking-wide font-cyber">
                          {track.title}
                        </span>
                      </div>

                      {/* Right: Badges & Equalizer Animation */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {track.audio_url && (
                          <span
                            className={`text-[9px] sm:text-[10px] uppercase px-2 sm:px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                              isCurrentPlaying
                                ? 'bg-black text-white border-black'
                                : 'bg-white/10 text-white border-white/20'
                            }`}
                          >
                            <Music className="w-3 h-3 text-white" /> AUDIO
                          </span>
                        )}

                        {track.video_url && (
                          <span
                            className={`text-[9px] sm:text-[10px] uppercase px-2 sm:px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                              isCurrentPlaying
                                ? 'bg-black text-cyan-300 border-cyan-400'
                                : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                            }`}
                          >
                            <Film className="w-3 h-3 text-cyan-400" /> MV
                          </span>
                        )}

                        {/* Playing equalizer animation indicator */}
                        {isCurrentPlaying && isPlaying && (
                          <div className="flex items-end gap-0.5 h-3.5 pl-1">
                            <span className="w-1 bg-black rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms' }} />
                            <span className="w-1 bg-black rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
                            <span className="w-1 bg-black rounded-full animate-bounce" style={{ height: '75%', animationDelay: '300ms' }} />
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
    </main>
  );
}
