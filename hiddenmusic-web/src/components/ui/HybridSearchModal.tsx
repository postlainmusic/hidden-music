'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Disc3, Radio, Play, Pause, Loader2, Sparkles } from 'lucide-react';
import { Album, TrackItem } from '../../types/database';
import { usePlayer } from '../../context/PlayerContext';
import { searchYouTube } from '../../lib/api';

interface HybridSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultAlbums?: Album[];
}

export default function HybridSearchModal({
  isOpen,
  onClose,
  vaultAlbums = [],
}: HybridSearchModalProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'vault' | 'youtube'>('all');
  const [ytResults, setYtResults] = useState<TrackItem[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery('');
      setYtResults([]);
    }
  }, [isOpen]);

  // YouTube Search with Debounce
  useEffect(() => {
    if (!query.trim() || sourceFilter === 'vault') {
      setYtResults([]);
      setIsSearchingYt(false);
      return;
    }

    setIsSearchingYt(true);
    const timer = setTimeout(async () => {
      const results = await searchYouTube(query.trim());
      setYtResults(results);
      setIsSearchingYt(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, sourceFilter]);

  if (!isOpen) return null;

  // Filter Local Vault Tracks
  const vaultTracks: TrackItem[] = [];
  vaultAlbums.forEach((alb) => {
    (alb.tracks || []).forEach((t) => {
      if (
        !query.trim() ||
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        (alb.artist && alb.artist.toLowerCase().includes(query.toLowerCase())) ||
        (t.artist && t.artist.toLowerCase().includes(query.toLowerCase()))
      ) {
        vaultTracks.push({
          ...t,
          source: 'vault',
          cover_url: alb.cover_url,
          artist: t.artist || alb.artist,
        });
      }
    });
  });

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center p-3 sm:p-6 pt-16 sm:pt-20 bg-black/90 backdrop-blur-2xl animate-fadeIn select-none font-mono"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-[#090a0f] border border-white/20 p-4 sm:p-6 shadow-2xl overflow-hidden flex flex-col gap-4 text-white animate-scaleUp max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/15 rounded-2xl px-4 py-3">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm bài hát, ca sĩ trên Vault hoặc YouTube..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-500 font-mono"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
          {isSearchingYt && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />}
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center gap-2 text-xs border-b border-white/10 pb-3">
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all ${
              sourceFilter === 'all' ? 'bg-white text-black' : 'text-slate-400 hover:text-white bg-white/5'
            }`}
          >
            TẤT CẢ
          </button>
          <button
            onClick={() => setSourceFilter('vault')}
            className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all flex items-center gap-1.5 ${
              sourceFilter === 'vault' ? 'bg-white text-black' : 'text-slate-400 hover:text-white bg-white/5'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5" /> VAULT R2 ({vaultTracks.length})
          </button>
          <button
            onClick={() => setSourceFilter('youtube')}
            className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all flex items-center gap-1.5 ${
              sourceFilter === 'youtube' ? 'bg-white text-black' : 'text-slate-400 hover:text-white bg-white/5'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" /> YOUTUBE MUSIC ({ytResults.length})
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-none pr-1">
          {/* 1. Vault Tracks */}
          {(sourceFilter === 'all' || sourceFilter === 'vault') &&
            vaultTracks.map((track, idx) => (
              <div
                key={track.id || idx}
                onClick={() => {
                  playTrack(track, null, vaultTracks);
                  onClose();
                }}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/20 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0">
                    <img src={track.cover_url || '/icon.svg'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold truncate text-white">{track.title}</h4>
                      <span className="text-[7px] px-1 py-0.2 rounded font-black uppercase bg-white/10 text-white border border-white/20">
                        VAULT
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/10 hover:bg-white hover:text-black flex items-center justify-center transition-all ml-2">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </div>
              </div>
            ))}

          {/* 2. YouTube Music Tracks */}
          {(sourceFilter === 'all' || sourceFilter === 'youtube') &&
            ytResults.map((track, idx) => (
              <div
                key={track.id || idx}
                onClick={() => {
                  playTrack(track, null, ytResults);
                  onClose();
                }}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-500/20 hover:border-cyan-500/40 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0">
                    <img src={track.cover_url || '/icon.svg'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold truncate text-cyan-200">{track.title}</h4>
                      <span className="text-[7px] px-1 py-0.2 rounded font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                        YT MUSIC
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 hover:bg-cyan-400 hover:text-black text-cyan-300 flex items-center justify-center transition-all ml-2">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
