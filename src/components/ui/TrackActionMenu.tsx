'use client';

/**
 * TrackActionMenu.tsx — Universal Digital Music Streaming Action Menu '...'
 *
 * Upgrades:
 *  - Uses React createPortal(..., document.body) to eliminate ALL overflow-hidden clipping issues
 *  - Viewport-aware smart placement (top/bottom/left/right boundary calculations)
 *  - Modern Glassmorphism styling with Framer Motion spring physics
 *  - Complete digital platform actions: Play next, Add to queue, Like, MV, Radio, Album, Share
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreVertical,
  MoreHorizontal,
  Play,
  ListPlus,
  Heart,
  Video,
  Share2,
  Disc3,
  Radio,
  Check,
  Sparkles,
} from 'lucide-react';
import { TrackItem, Album } from '@/types/database';
import type { YtmTrack } from '@/types/ytm';
import { usePlayer } from '@/context/PlayerContext';
import { springSnappy } from '@/lib/motionVariants';

export interface TrackActionMenuProps {
  track: TrackItem | YtmTrack;
  album?: Album | null;
  onWatchVideo?: () => void;
  onViewAlbum?: () => void;
  variant?: 'vertical' | 'horizontal';
  className?: string;
}

export default function TrackActionMenu({
  track,
  album,
  onWatchVideo,
  onViewAlbum,
  variant = 'horizontal',
  className = '',
}: TrackActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; placement: 'bottom' | 'top' }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const {
    currentTrack,
    playlist,
    userQueue,
    playTrack,
    addToUserQueue,
  } = usePlayer();

  // Check liked status in localStorage
  useEffect(() => {
    try {
      const likedStr = localStorage.getItem('vault_liked_tracks') || '[]';
      const likedArr = JSON.parse(likedStr);
      const trackId = (track as any).id || (track as any).ytmId;
      setIsLiked(likedArr.includes(trackId));
    } catch {}
  }, [track]);

  // Calculate coordinates on open or resize/scroll
  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 240; // width in px
    const menuHeight = 310; // estimated max height in px
    const margin = 8;

    // Horizontal placement: align right edge with button, clamp within screen
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    // Vertical placement: open downwards by default, open upwards if too close to bottom
    let top = rect.bottom + margin;
    let placement: 'bottom' | 'top' = 'bottom';

    if (rect.bottom + menuHeight > window.innerHeight - 20 && rect.top > menuHeight + margin) {
      top = rect.top - menuHeight - margin;
      placement = 'top';
    }

    setMenuCoords({ top, left, placement });
  }, []);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen((prev) => !prev);
  };

  // Click outside to dismiss & handle scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    window.addEventListener('mousedown', handleClickOutside, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Format standard TrackItem
  const standardTrack: TrackItem = {
    id: (track as any).id || (track as any).ytmId || `track_${Date.now()}`,
    album_id: (track as any).album_id || album?.id || 'unknown',
    title: track.title,
    artist: (track as any).artist || album?.artist || 'Unknown Artist',
    audio_url: (track as any).audio_url || (track as any).ytmId || '',
    cover_url: (track as any).cover_url || (track as any).coverUrl || album?.cover_url,
    duration: typeof track.duration === 'number' ? track.duration : 180,
    media_type: (track as any).mediaType || (track as any).media_type || 'audio',
    youtube_id: (track as any).youtube_id || (track as any).ytmId?.replace(/^yt:/, ''),
    created_at: (track as any).created_at || new Date().toISOString(),
  };

  // 1. Play Next
  const handlePlayNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(false);
      if (addToUserQueue) {
        addToUserQueue(standardTrack);
      }
    },
    [addToUserQueue, standardTrack]
  );

  // 2. Add to Queue
  const handleAddToQueue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(false);
      if (addToUserQueue) {
        addToUserQueue(standardTrack);
      }
    },
    [addToUserQueue, standardTrack]
  );

  // 3. Toggle Like
  const handleToggleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const likedStr = localStorage.getItem('vault_liked_tracks') || '[]';
        let likedArr: string[] = JSON.parse(likedStr);
        const trackId = standardTrack.id;

        if (likedArr.includes(trackId)) {
          likedArr = likedArr.filter((id) => id !== trackId);
          setIsLiked(false);
        } else {
          likedArr.push(trackId);
          setIsLiked(true);
        }
        localStorage.setItem('vault_liked_tracks', JSON.stringify(likedArr));
      } catch {}
      setIsOpen(false);
    },
    [standardTrack.id]
  );

  // 4. Share Link
  const handleCopyLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const shareUrl = `${window.location.origin}/?q=${encodeURIComponent(track.title)}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
      setTimeout(() => setIsOpen(false), 400);
    },
    [track.title]
  );

  // 5. Start Radio Mix
  const handleStartRadio = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(false);
      playTrack(standardTrack, album);
    },
    [playTrack, standardTrack, album]
  );

  return (
    <div className={`relative inline-flex items-center ${className}`} onClick={(e) => e.stopPropagation()}>
      <motion.button
        ref={buttonRef}
        type="button"
        aria-label="Tùy chọn bài hát"
        onClick={handleToggleMenu}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        transition={springSnappy}
        className="p-1.5 sm:p-2 rounded-full bg-black/70 hover:bg-white text-zinc-300 hover:text-black border border-white/15 hover:border-white/40 backdrop-blur-md transition-colors shadow-lg cursor-pointer z-10"
      >
        {variant === 'vertical' ? (
          <MoreVertical className="w-3.5 h-3.5" />
        ) : (
          <MoreHorizontal className="w-3.5 h-3.5" />
        )}
      </motion.button>

      {/* Floating Portal Menu — Never Clipped by Container Overflow */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.92, y: menuCoords.placement === 'bottom' ? -4 : 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: menuCoords.placement === 'bottom' ? -4 : 4 }}
                transition={springSnappy}
                style={{
                  position: 'fixed',
                  top: menuCoords.top,
                  left: menuCoords.left,
                  zIndex: 99999,
                }}
                className="w-60 sm:w-64 rounded-2xl bg-zinc-950/95 border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-1.5 select-none text-left"
              >
                {/* Header Track Info */}
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="text-[11px] font-cyber font-extrabold text-white truncate uppercase">
                    {track.title}
                  </p>
                  <p className="text-[9px] font-mono text-zinc-400 truncate uppercase mt-0.5">
                    {(track as any).artist || album?.artist || 'Postlain Vault'}
                  </p>
                </div>

                {/* Menu Actions */}
                <div className="space-y-0.5">
                  {/* 1. Play Next */}
                  <button
                    type="button"
                    onClick={handlePlayNext}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-bold transition-colors cursor-pointer text-left"
                  >
                    <Play className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                    <span>Phát tiếp theo</span>
                  </button>

                  {/* 2. Add to Queue */}
                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-bold transition-colors cursor-pointer text-left"
                  >
                    <ListPlus className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                    <span>Thêm vào hàng chờ</span>
                  </button>

                  {/* 3. Like Track */}
                  <button
                    type="button"
                    onClick={handleToggleLike}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-bold transition-colors cursor-pointer text-left"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isLiked ? 'fill-white text-white' : 'text-zinc-400'
                      }`}
                    />
                    <span>{isLiked ? 'Đã yêu thích' : 'Thêm vào yêu thích'}</span>
                  </button>

                  {/* 4. Watch MV (if available) */}
                  {((track as any).video_url || onWatchVideo) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        if (onWatchVideo) onWatchVideo();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-bold transition-colors cursor-pointer text-left"
                    >
                      <Video className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                      <span>Xem MV / Video</span>
                    </button>
                  )}

                  {/* 5. Start Radio Mix */}
                  <button
                    type="button"
                    onClick={handleStartRadio}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-bold transition-colors cursor-pointer text-left"
                  >
                    <Radio className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                    <span>Bắt đầu phát Radio</span>
                  </button>

                  {/* 6. View Album */}
                  {((album && album.id) || onViewAlbum) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        if (onViewAlbum) {
                          onViewAlbum();
                        } else if (album?.id) {
                          window.location.href = `/album/${album.id}`;
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-bold transition-colors cursor-pointer text-left"
                    >
                      <Disc3 className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                      <span>Xem Album</span>
                    </button>
                  )}

                  {/* 7. Copy Share Link */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-bold transition-colors cursor-pointer text-left"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                        <span className="text-emerald-400">Đã sao chép liên kết</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                        <span>Sao chép liên kết</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
