'use client';

import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
} from 'lucide-react';
import { Album, TrackItem } from '../../types/database';
import { usePlayer } from '../../context/PlayerContext';
import { supabase } from '../../lib/supabase';
import { isVipSubscribed } from '../../lib/authSession';
import AlbumComments from '../ui/AlbumComments';
import SubscriptionModal from '../ui/SubscriptionModal';

interface AlbumDetailViewProps {
  album?: Album | null;
  albumId?: string;
}

export default function AlbumDetailView({ album: initialAlbum, albumId }: AlbumDetailViewProps) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [album, setAlbum] = useState<Album | null>(initialAlbum || null);
  const [albumTab, setAlbumTab] = useState<'tracks' | 'comments'>('tracks');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'audio' | 'video'>('all');
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);

  useEffect(() => {
    setIsVip(isVipSubscribed());

    if (!album && albumId) {
      supabase
        .from('albums')
        .select('*, tracks(*)')
        .eq('id', albumId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setAlbum(data);
        });
    }
  }, [albumId, album]);

  if (!album) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-slate-500">
        Đang tải thông tin album...
      </div>
    );
  }

  const tracks = album.tracks || [];
  const isPlayingThisAlbum = currentTrack?.album_id === album.id && isPlaying;

  const handlePlayAlbum = () => {
    if (tracks.length > 0) {
      if (isPlayingThisAlbum) {
        togglePlay();
      } else {
        playTrack(tracks[0], album, tracks);
      }
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      const random = tracks[Math.floor(Math.random() * tracks.length)];
      playTrack(random, album, tracks);
    }
  };

  const formatDuration = (s?: number) => {
    if (!s) return '03:20';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full min-h-screen pt-16 sm:pt-20 pb-32 px-4 sm:px-8 font-mono select-none flex items-center justify-center">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Left: Physical Sleeve & Sliding Vinyl Disc */}
        <div className="flex flex-col items-center justify-center flex-shrink-0">
          <div className="w-full flex items-center justify-start mb-3">
            <a
              href="/"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> QUAY LẠI VAULT
            </a>
          </div>

          <div className="relative mx-auto flex items-center justify-center w-[220px] h-[220px] sm:w-[260px] sm:h-[260px]">
            {/* Sliding Grooved Vinyl */}
            <div
              className={`absolute w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/25 shadow-2xl flex items-center justify-center transition-all duration-700 pointer-events-none ${
                isPlayingThisAlbum ? 'translate-x-14 sm:translate-x-20 rotate-180' : 'translate-x-8 sm:translate-x-12'
              }`}
            >
              <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800 border-2 border-white/40 flex items-center justify-center shadow-inner ${
                    isPlayingThisAlbum ? 'animate-spin-slow' : ''
                  }`}
                >
                  <img src={album.cover_url} alt="" className="w-full h-full object-cover rounded-full" />
                  <div className="absolute w-4 h-4 rounded-full bg-black border border-white/60" />
                </div>
              </div>
            </div>

            {/* Sleeve Cover */}
            <div className="relative z-10 w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-zinc-950 -translate-x-4">
              <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover select-none" />
              <div
                onClick={handlePlayAlbum}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform">
                  {isPlayingThisAlbum ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-4">
            <h2 className="text-xl sm:text-2xl font-black font-cyber text-white uppercase tracking-wider">
              {album.title}
            </h2>
            <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mt-0.5">
              {album.artist || 'VAULT ARTIST'}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setAlbumTab((p) => (p === 'comments' ? 'tracks' : 'comments'))}
              className={`p-2.5 rounded-full border transition-all ${
                albumTab === 'comments'
                  ? 'bg-white text-black border-white'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
              title="Bình luận"
            >
              {albumTab === 'comments' ? <ListMusic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            </button>

            <button
              onClick={handlePlayAlbum}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {isPlayingThisAlbum ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlayingThisAlbum ? 'TẠM DỪNG' : 'PHÁT TOÀN BỘ'}</span>
            </button>

            <button
              onClick={handleShufflePlay}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all hover:scale-105"
              title="Phát ngẫu nhiên"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Tracklist / Comments Deck */}
        <div className="flex-1 w-full max-w-xl h-full max-h-[60vh] lg:max-h-[70vh] bg-black/60 backdrop-blur-xl border border-white/15 rounded-3xl p-4 sm:p-6 overflow-hidden flex flex-col shadow-2xl">
          {albumTab === 'tracks' ? (
            <div className="flex-1 flex flex-col min-h-0">
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
                        onClick={() => playTrack(track, album, tracks)}
                        className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-white/20 border-white text-white shadow-lg'
                            : 'bg-white/[0.03] hover:bg-white/10 border-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xs text-slate-500 w-5 text-center flex-shrink-0">
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
                          <span className="text-[11px] text-slate-500">{formatDuration(track.duration)}</span>
                          <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-all">
                            {isTrackPlaying ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <AlbumComments
              albumId={album.id}
              albumTitle={album.title}
              onCommentsCountChange={setCommentsCount}
            />
          )}
        </div>
      </div>

      <SubscriptionModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        onSubscribed={() => setIsVip(true)}
      />
    </div>
  );
}
