'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Play,
  Pause,
  Music,
  Film,
  Disc3
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
    <main className="min-h-screen bg-black text-white font-cyber relative overflow-x-hidden pt-20 md:pt-24 pb-36 select-none flex flex-col justify-between">
      {/* Top Fixed Header */}
      <Navbar showBackButton={true} />

      {/* Analog TV Grain Noise & CRT Scanlines Overlays */}
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

      {/* Hero Viewport Center Player */}
      <section className="min-h-[75vh] flex flex-col items-center justify-center text-center p-4 md:p-6 relative z-10 max-w-3xl mx-auto space-y-6">
        {/* Large Album Cover Art Player Box */}
        <div id="album-cover-box" className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden border-2 border-white/30 shadow-2xl group bg-slate-900 transition-transform duration-75 ease-out">
          <img
            src={album.cover_url}
            alt={album.title}
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
              isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
            }`}
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <button
              onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
              className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
            >
              {isCurrentPlayingThisAlbum && isPlaying ? (
                <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
              ) : (
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* Title & Artist */}
        <div className="space-y-2 px-2">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-wider uppercase text-white font-cyber break-words">
            {album.title}
          </h1>
          <p className="text-xs sm:text-sm md:text-base font-mono text-slate-400 uppercase tracking-widest">
            {album.artist} ({album.original_year})
          </p>
        </div>

        {/* Play Album Primary Action */}
        <div className="pt-2">
          <button
            onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
            className="px-6 py-3 sm:px-8 sm:py-3.5 rounded-full bg-white text-black font-extrabold font-mono text-xs uppercase tracking-widest shadow-2xl hover:bg-slate-200 transition-all flex items-center gap-2"
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
        </div>
      </section>

      {/* Tracklist Details */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 space-y-4 relative z-10 pt-4 font-mono text-xs w-full pb-36 sm:pb-40">
        <div className="space-y-3">
          {tracks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              No tracks uploaded yet in this archive.
            </div>
          ) : (
            tracks.map((track, idx) => {
              const isCurrentPlaying = currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  onClick={() => {
                    setSelectedTrack(track);
                    playTrack(track, album, tracks);
                  }}
                  className={`p-3.5 sm:p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between backdrop-blur-md border ${
                    isCurrentPlaying
                      ? 'bg-white text-black font-extrabold border-white shadow-2xl scale-[1.01]'
                      : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/20 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                    <span className={`w-5 sm:w-6 font-bold text-xs ${isCurrentPlaying ? 'text-black' : 'text-slate-400'}`}>
                      {idx + 1}.
                    </span>
                    <Music className="w-4 h-4 flex-shrink-0 text-white" />
                    <span className="truncate text-xs sm:text-sm">{track.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {track.audio_url && (
                      <span
                        className={`text-[9px] sm:text-[10px] uppercase px-2 sm:px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                          isCurrentPlaying
                            ? 'bg-black text-white border-white/60'
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
                            ? 'bg-black text-white border-white/60'
                            : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                        }`}
                      >
                        <Film className="w-3 h-3 text-cyan-400" /> MV VIDEO
                      </span>
                    )}

                    {isCurrentPlaying && isPlaying && (
                      <span className="w-2 h-2 rounded-full bg-white animate-ping ml-1" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
