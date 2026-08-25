'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  Heart,
  MoreVertical,
  Music2,
  Clock,
  Sparkles,
  Zap,
  Disc3,
  ListPlus,
  Radio,
} from 'lucide-react';
import { TrackItem, Album } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';
import { toggleLike, getUserLikes } from '@/lib/pocketbaseService';
import TrackActionMenu from '@/components/ui/TrackActionMenu';

interface TrackListProps {
  tracks: TrackItem[];
  album?: Album | null;
  showCover?: boolean;
  showAlbum?: boolean;
  showPlaysCount?: boolean;
  showBitrate?: boolean;
  className?: string;
  onTrackSelect?: (track: TrackItem) => void;
}

export default function TrackList({
  tracks,
  album,
  showCover = true,
  showAlbum = true,
  showPlaysCount = true,
  showBitrate = true,
  className = '',
  onTrackSelect,
}: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue, playNextInQueue } = usePlayer();
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  // Load liked tracks on mount
  useEffect(() => {
    let mounted = true;
    getUserLikes().then((ids) => {
      if (mounted && ids && ids.length > 0) {
        setLikedTrackIds(new Set(ids));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleLike = useCallback(async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });

    try {
      await toggleLike(trackId);
    } catch (err) {
      console.debug('Failed to sync like with PocketBase:', err);
    }
  }, []);

  const handlePlayClick = useCallback(
    (track: TrackItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentTrack?.id === track.id) {
        togglePlay();
      } else {
        if (onTrackSelect) {
          onTrackSelect(track);
        } else {
          playTrack(track, album || undefined, tracks);
        }
      }
    },
    [currentTrack?.id, togglePlay, onTrackSelect, playTrack, album, tracks]
  );

  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPlays = (count?: number): string => {
    if (!count || count <= 0) return '0';
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
    return count.toString();
  };

  if (!tracks || tracks.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
        Chưa có bài hát trong danh sách phát
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col divide-y divide-white/5 ${className}`}>
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400 select-none border-b border-white/10">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-6 sm:col-span-5 flex items-center gap-2">
          <span>Tiêu đề</span>
        </div>
        {showAlbum && <div className="hidden sm:block sm:col-span-3">Album</div>}
        {showPlaysCount && <div className="hidden md:block md:col-span-2 text-right">Lượt nghe</div>}
        <div className="col-span-5 sm:col-span-3 md:col-span-1 flex items-center justify-end gap-1 text-right">
          <Clock className="w-3 h-3 inline" />
        </div>
      </div>

      {/* Track Rows */}
      {tracks.map((track, index) => {
        const isCurrent = currentTrack?.id === track.id;
        const isCurrentPlaying = isCurrent && isPlaying;
        const isLiked = likedTrackIds.has(track.id);
        const isHovered = hoveredTrackId === track.id;

        return (
          <div
            key={track.id || index}
            onMouseEnter={() => setHoveredTrackId(track.id)}
            onMouseLeave={() => setHoveredTrackId(null)}
            onClick={(e) => handlePlayClick(track, e)}
            className={`group grid grid-cols-12 gap-3 items-center px-4 py-3 cursor-pointer transition-all duration-200 select-none ${
              isCurrent
                ? 'bg-white/10 text-white border-l-2 border-l-white'
                : 'hover:bg-white/[0.04] text-zinc-300 hover:text-white'
            }`}
          >
            {/* Index / Play Indicator */}
            <div className="col-span-1 flex items-center justify-center">
              {isCurrentPlaying ? (
                <div className="flex items-end gap-0.5 h-3.5">
                  <span className="w-0.5 bg-white h-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                  <span className="w-0.5 bg-white h-2/3 animate-[pulse_0.4s_ease-in-out_infinite_0.2s]" />
                  <span className="w-0.5 bg-white h-4/5 animate-[pulse_0.8s_ease-in-out_infinite_0.4s]" />
                </div>
              ) : isHovered ? (
                <button
                  type="button"
                  className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform"
                  onClick={(e) => handlePlayClick(track, e)}
                >
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </button>
              ) : (
                <span className="font-mono text-xs text-zinc-400 group-hover:hidden">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
              )}
            </div>

            {/* Title & Artist & Artwork */}
            <div className="col-span-6 sm:col-span-5 flex items-center gap-3 min-w-0">
              {showCover && (
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-900 border border-white/10 relative shadow-md">
                  {track.cover_url ? (
                    <img
                      src={track.cover_url}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Music2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold text-xs sm:text-sm truncate font-sans ${
                      isCurrent ? 'text-white font-bold' : 'text-zinc-200 group-hover:text-white'
                    }`}
                  >
                    {track.title}
                  </span>
                  {showBitrate && (
                    <span className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider bg-white/10 text-zinc-300 border border-white/10 uppercase">
                      LOSSLESS
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-zinc-400 truncate">
                  {track.artist || album?.artist || 'Unknown Artist'}
                </span>
              </div>
            </div>

            {/* Album */}
            {showAlbum && (
              <div className="hidden sm:block sm:col-span-3 text-xs font-mono text-zinc-400 truncate">
                {album?.title || track.album_id || 'Hidden Vault'}
              </div>
            )}

            {/* Plays Count */}
            {showPlaysCount && (
              <div className="hidden md:block md:col-span-2 text-right font-mono text-xs text-zinc-400">
                {formatPlays((track as any).plays_count)}
              </div>
            )}

            {/* Duration & Actions */}
            <div className="col-span-5 sm:col-span-3 md:col-span-1 flex items-center justify-end gap-2">
              {/* Like / Favorite Button */}
              <button
                type="button"
                onClick={(e) => handleToggleLike(track.id, e)}
                className={`p-1 rounded-md transition-colors ${
                  isLiked
                    ? 'text-white fill-white'
                    : 'text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100'
                }`}
                title={isLiked ? 'Bỏ thích' : 'Yêu thích'}
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-white text-white' : ''}`} />
              </button>

              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                {formatDuration(track.duration)}
              </span>

              {/* Context Action Menu */}
              <TrackActionMenu
                track={track}
                album={album || undefined}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
