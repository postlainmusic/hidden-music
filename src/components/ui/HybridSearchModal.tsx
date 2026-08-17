'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { Search, X, Loader2, Music2, Globe, Disc3, Play, Sparkles, Radio } from 'lucide-react';
import { TrackItem, Album } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';
import Image from 'next/image';

interface HybridSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultAlbums: Album[];
}

export default function HybridSearchModal({
  isOpen,
  onClose,
  vaultAlbums,
}: HybridSearchModalProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'vault' | 'youtube'>('all');
  const [ytResults, setYtResults] = useState<TrackItem[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus on input when opened & setup Escape key listener
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Extract all local Vault tracks
  const vaultTracks = React.useMemo(() => {
    const tracks: TrackItem[] = [];
    vaultAlbums.forEach((album) => {
      if (album.tracks) {
        album.tracks.forEach((t) => {
          tracks.push({
            ...t,
            artist: t.artist || album.artist,
            cover_url: t.cover_url || album.cover_url,
            source: 'vault',
          });
        });
      }
    });
    return tracks;
  }, [vaultAlbums]);

  // Filter Vault Tracks by query
  const filteredVaultTracks = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return vaultTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q))
    );
  }, [vaultTracks, query]);

  // Debounced YouTube Music Search API fetch
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setYtResults([]);
      setIsSearchingYt(false);
      return;
    }

    setIsSearchingYt(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/yt/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const formatted: TrackItem[] = data.map((item: any) => ({
              id: item.id || `yt_${item.youtube_id}`,
              youtube_id: item.youtube_id,
              album_id: 'yt_global',
              title: item.title,
              artist: item.artist || 'YouTube Music',
              media_type: 'audio',
              source: 'youtube',
              audio_url: item.audio_url || `/api/yt/stream/${item.youtube_id}`,
              cover_url: item.cover_url,
              duration: item.duration || 200,
              created_at: new Date().toISOString(),
            }));
            startTransition(() => {
              setYtResults(formatted);
            });
          }
        }
      } catch (err) {
        console.warn('YouTube search fetch error:', err);
      } finally {
        setIsSearchingYt(false);
      }
    }, 400);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  // Combined Results based on selected Tab
  const combinedResults = React.useMemo(() => {
    if (activeTab === 'vault') return filteredVaultTracks;
    if (activeTab === 'youtube') return ytResults;
    return [...filteredVaultTracks, ...ytResults];
  }, [activeTab, filteredVaultTracks, ytResults]);

  if (!isOpen) return null;

  const handleSelectTrack = (track: TrackItem) => {
    playTrack(track, null, combinedResults);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-fadeIn select-none">
      {/* Background Click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-black/95 border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-mono text-white">
        {/* CRT Scanline & Grain Texture */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_50%,transparent_50%)] bg-[length:100%_4px] z-0 opacity-40" />

        {/* 1. Header Search Bar Input */}
        <div className="relative z-10 p-4 sm:p-5 border-b border-white/10 flex items-center gap-3 bg-slate-950/80">
          <Search className="w-5 h-5 text-white/60 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm Vault & YouTube Music (Gõ tên bài hát, nghệ sĩ)..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none font-mono"
          />
          {isSearchingYt ? (
            <Loader2 className="w-4 h-4 text-white animate-spin flex-shrink-0" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] text-slate-400 bg-white/10 rounded border border-white/15">
              ESC
            </kbd>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Source Filter Tabs */}
        <div className="relative z-10 px-4 sm:px-5 py-2.5 bg-black/60 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white bg-white/5 border border-white/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tất cả ({filteredVaultTracks.length + ytResults.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'vault'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white bg-white/5 border border-white/10'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Vault ({filteredVaultTracks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('youtube')}
              className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'youtube'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white bg-white/5 border border-white/10'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>YouTube Music ({ytResults.length})</span>
            </button>
          </div>

          <span className="hidden sm:inline text-[10px] text-slate-500 uppercase tracking-widest">
            HYBRID STREAM ENGINE
          </span>
        </div>

        {/* 3. Search Results List */}
        <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 min-h-[260px] max-h-[55vh]">
          {combinedResults.length > 0 ? (
            combinedResults.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isVault = track.source === 'vault';

              return (
                <div
                  key={track.id || idx}
                  onClick={() => handleSelectTrack(track)}
                  className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all border ${
                    isCurrent
                      ? 'bg-white/15 border-white text-white shadow-lg'
                      : 'bg-black/40 hover:bg-white/10 border-white/5 hover:border-white/20 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Thumbnail Artwork */}
                    <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                      {track.cover_url ? (
                        <img
                          src={track.cover_url}
                          alt={track.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white/50">
                          <Music2 className="w-5 h-5" />
                        </div>
                      )}

                      {/* Hover Play Icon Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 text-white fill-current" />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold truncate group-hover:text-white">
                          {track.title}
                        </h4>
                        {/* Source Badge */}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider flex items-center gap-0.5 flex-shrink-0 border ${
                            isVault
                              ? 'bg-white text-black border-white'
                              : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                          }`}
                        >
                          {isVault ? (
                            <>
                              <Disc3 className="w-2.5 h-2.5" /> VAULT
                            </>
                          ) : (
                            <>
                              <Radio className="w-2.5 h-2.5 text-cyan-400" /> YT MUSIC
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {track.artist || 'Nghệ sĩ'}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Duration */}
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-[10px] sm:text-xs text-slate-400 font-mono">
                      {Math.floor((track.duration || 200) / 60)}:
                      {String(Math.floor((track.duration || 200) % 60)).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-all border border-white/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : query ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-2">
              {isSearchingYt ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
                  <p className="text-xs text-slate-400">Đang tìm kiếm trên YouTube Music...</p>
                </>
              ) : (
                <>
                  <Music2 className="w-10 h-10 text-slate-600 mb-1 stroke-1" />
                  <p className="text-xs text-slate-400 font-bold">Không tìm thấy bài hát phù hợp</p>
                  <p className="text-[11px] text-slate-600">
                    Hãy thử gõ từ khóa tên bài hát hoặc ca sĩ khác
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-2">
              <Search className="w-10 h-10 text-slate-700 stroke-1 mb-1" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Tìm kiếm hàng triệu bài hát
              </p>
              <p className="text-[11px] text-slate-600 max-w-sm">
                Kết hợp kho lưu trữ độc quyền <strong>Vault R2</strong> và kho nhạc toàn cầu{' '}
                <strong>YouTube Music</strong>.
              </p>
            </div>
          )}
        </div>

        {/* 4. Footer Hint */}
        <div className="relative z-10 p-3 bg-slate-950/80 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Hybrid Gateway: R2 Zero-Egress + YouTube InnerTube Stream</span>
          </div>
          <span className="hidden sm:inline">Phím tắt: [Ctrl + K]</span>
        </div>
      </div>
    </div>
  );
}
