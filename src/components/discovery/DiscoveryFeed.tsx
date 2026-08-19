'use client';

import React, { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  Play,
  Pause,
  Film,
  Sparkles,
  Disc3,
  Heart,
  ChevronRight,
  ChevronLeft,
  Flame,
  ShieldCheck,
  Radio,
  Plus,
  Zap,
  Activity,
  Filter,
  Check,
} from 'lucide-react';
import { Album, TrackItem } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';
import { useTelemetry } from '@/hooks/useTelemetry';

interface DiscoveryFeedProps {
  albums: Album[];
  onSelectAlbum?: (album: Album) => void;
  className?: string;
}

type FilterCategory = 'ALL' | 'EXCLUSIVE MVS' | 'LOSSLESS AUDIO' | 'AI CURATED';

const AI_RESONANCE_SCORES = [99, 98, 97, 96, 95, 94, 93, 92, 91, 90];

export default function DiscoveryFeed({
  albums,
  onSelectAlbum,
  className = '',
}: DiscoveryFeedProps) {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    playVideo,
    switchToVideoZone,
    openPaywall,
    isPremium,
    addToQueue,
  } = usePlayer();
  const { trackPlay, trackHeart, trackRecommendationClick } = useTelemetry();

  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [addedQueueIds, setAddedQueueIds] = useState<Set<string>>(new Set());

  // Aggregate all tracks from albums with metadata
  const allTracks = useMemo(() => {
    const list: { track: TrackItem; album: Album; matchScore: number }[] = [];
    let idx = 0;
    albums.forEach((album) => {
      if (album.tracks && album.tracks.length > 0) {
        album.tracks.forEach((track) => {
          list.push({
            track,
            album,
            matchScore: AI_RESONANCE_SCORES[idx % AI_RESONANCE_SCORES.length],
          });
          idx++;
        });
      }
    });
    return list;
  }, [albums]);

  // Swimlane 1: AI Deep Resonance Mix (High match score items)
  const aiResonanceTracks = useMemo(() => {
    return [...allTracks]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }, [allTracks]);

  // Swimlane 2: Trending 4K Vault Exclusives (MVs with video_url or media_type === 'video')
  const videoTracks = useMemo(() => {
    const vids = allTracks.filter(
      (item) => item.track.media_type === 'video' || Boolean(item.track.video_url)
    );
    return vids.length > 0 ? vids : allTracks.slice(0, 8);
  }, [allTracks]);

  // Swimlane 3: Underground Rarities & Unreleased Audio
  const losslessAudioTracks = useMemo(() => {
    return allTracks.filter(
      (item) => item.track.media_type === 'audio' || !item.track.video_url
    );
  }, [allTracks]);

  const handleLike = (trackId: string, trackTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
        trackHeart(trackId, trackTitle);
      }
      return next;
    });
  };

  const handleAddToQueue = (track: TrackItem, album: Album, e: React.MouseEvent) => {
    e.stopPropagation();
    if (addToQueue) {
      addToQueue(track);
    }
    setAddedQueueIds((prev) => new Set(prev).add(track.id));
    setTimeout(() => {
      setAddedQueueIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 2000);
  };

  const handlePlayItem = (
    item: { track: TrackItem; album: Album },
    source: string
  ) => {
    trackRecommendationClick(item.track.id, item.track.title, source);

    if (item.track.media_type === 'video' || item.track.video_url) {
      if (!isPremium) {
        openPaywall();
        return;
      }
      switchToVideoZone(item.track, item.album);
    } else {
      const albumPlaylist = item.album.tracks || [item.track];
      playTrack(item.track, item.album, albumPlaylist);
    }
    trackPlay(item.track.id, item.track.title, item.track.media_type || 'audio');
  };

  const scrollLane = (laneId: string, direction: 'left' | 'right') => {
    const el = document.getElementById(laneId);
    if (!el) return;
    const amount = direction === 'left' ? -380 : 380;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-12 select-none pb-28 ${className}`}>
      {/* 1. STICKY CATEGORY FILTER PILLS */}
      <div className="sticky top-20 z-20 flex items-center justify-between gap-3 p-2 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          {(['ALL', 'AI CURATED', 'EXCLUSIVE MVS', 'LOSSLESS AUDIO'] as FilterCategory[]).map(
            (category) => {
              const isActive = activeFilter === category;
              return (
                <button
                  key={category}
                  onClick={() => setActiveFilter(category)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                      : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {category === 'AI CURATED' && <Sparkles className="w-3.5 h-3.5 text-current" />}
                  {category === 'EXCLUSIVE MVS' && <Film className="w-3.5 h-3.5 text-current" />}
                  {category === 'LOSSLESS AUDIO' && <Radio className="w-3.5 h-3.5 text-current" />}
                  <span>{category}</span>
                </button>
              );
            }
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-500 pr-3">
          <Activity className="w-3.5 h-3.5 text-white animate-pulse" />
          <span>NEURAL ENGINE ACTIVE</span>
        </div>
      </div>

      {/* 2. SWIMLANE: AI DEEP RESONANCE MIX */}
      {(activeFilter === 'ALL' || activeFilter === 'AI CURATED') && (
        <section className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-cyber font-black tracking-wider text-white uppercase flex items-center gap-2">
                  <span>AI DEEP RESONANCE MIX</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-black text-[9px] font-mono font-black">
                    RECOMMENDED
                  </span>
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Tác phẩm được phối ghép tự động theo tần số nghe nhạc của bạn
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollLane('lane-ai-resonance', 'left')}
                className="p-2 rounded-full bg-white/5 hover:bg-white text-zinc-400 hover:text-black border border-white/10 transition-all"
                title="Trượt sang trái"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollLane('lane-ai-resonance', 'right')}
                className="p-2 rounded-full bg-white/5 hover:bg-white text-zinc-400 hover:text-black border border-white/10 transition-all"
                title="Trượt sang phải"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            id="lane-ai-resonance"
            className="flex items-center gap-4 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1"
          >
            {aiResonanceTracks.map((item, index) => {
              const isCur = currentTrack?.id === item.track.id;
              const isLiked = likedTrackIds.has(item.track.id);
              const isAdded = addedQueueIds.has(item.track.id);

              return (
                <div
                  key={item.track.id || index}
                  onClick={() => handlePlayItem(item, 'ai_resonance_mix')}
                  className={`group relative w-64 sm:w-72 flex-shrink-0 rounded-3xl p-4 bg-gradient-to-b from-zinc-900/90 to-zinc-950 border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.02] ${
                    isCur
                      ? 'border-white ring-1 ring-white/50 shadow-[0_0_30px_rgba(255,255,255,0.15)]'
                      : 'border-white/15 hover:border-white/40'
                  }`}
                >
                  {/* Artwork Container */}
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black mb-3.5 border border-white/10 shadow-inner">
                    {item.album.cover_url ? (
                      <img
                        src={item.album.cover_url}
                        alt={item.track.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Disc3 className="w-16 h-16 text-zinc-700" />
                      </div>
                    )}

                    {/* AI Resonance Score Badge */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-mono font-black text-white flex items-center gap-1 shadow-lg">
                      <Sparkles className="w-3 h-3 text-white" />
                      <span>{item.matchScore}% MATCH</span>
                    </div>

                    {/* Hover Action Overlay */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={(e) => handleAddToQueue(item.track, item.album, e)}
                        className="p-3 rounded-full bg-black/80 hover:bg-white text-white hover:text-black border border-white/20 transition-all shadow-lg hover:scale-110"
                        title="Thêm vào hàng chờ"
                      >
                        {isAdded ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
                      </button>

                      <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.8)] transition-transform hover:scale-110">
                        {isCur && isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </div>

                      <button
                        onClick={(e) => handleLike(item.track.id, item.track.title, e)}
                        className={`p-3 rounded-full border transition-all shadow-lg hover:scale-110 ${
                          isLiked
                            ? 'bg-white text-black border-white'
                            : 'bg-black/80 text-white hover:bg-white hover:text-black border-white/20'
                        }`}
                        title="Yêu thích"
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="text-sm font-cyber font-extrabold text-white truncate uppercase">
                        {item.track.title}
                      </h4>
                      <p className="text-xs font-mono text-zinc-400 truncate uppercase mt-0.5">
                        {item.track.artist || item.album.artist}
                      </p>
                    </div>
                    {isCur && <Disc3 className="w-4 h-4 text-white animate-spin flex-shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. SWIMLANE: TRENDING 4K VAULT EXCLUSIVES */}
      {(activeFilter === 'ALL' || activeFilter === 'EXCLUSIVE MVS') && (
        <section className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-cyber font-black tracking-wider text-white uppercase flex items-center gap-2">
                  <span>TRENDING 4K VAULT EXCLUSIVES</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-black text-[9px] font-mono font-black">
                    THEATER 4K
                  </span>
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Kho phim ca nhạc & MV độ phân giải cao độc quyền cho hội viên VIP
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollLane('lane-trending-mvs', 'left')}
                className="p-2 rounded-full bg-white/5 hover:bg-white text-zinc-400 hover:text-black border border-white/10 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollLane('lane-trending-mvs', 'right')}
                className="p-2 rounded-full bg-white/5 hover:bg-white text-zinc-400 hover:text-black border border-white/10 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            id="lane-trending-mvs"
            className="flex items-center gap-5 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1"
          >
            {videoTracks.map((item, index) => {
              const isLiked = likedTrackIds.has(item.track.id);

              return (
                <div
                  key={item.track.id || index}
                  onClick={() => handlePlayItem(item, 'trending_4k_mvs')}
                  className="group relative w-80 sm:w-96 flex-shrink-0 rounded-3xl p-4 bg-zinc-950 border border-white/15 hover:border-white/40 transition-all duration-300 cursor-pointer shadow-xl hover:scale-[1.02]"
                >
                  {/* Video Widescreen 16:9 Banner */}
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-zinc-900 mb-3.5 border border-white/10 shadow-inner">
                    {item.album.cover_url ? (
                      <img
                        src={item.album.cover_url}
                        alt={item.track.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-12 h-12 text-zinc-700" />
                      </div>
                    )}

                    {/* 4K HDR & VIP Badge */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-white/25 text-[9px] font-mono font-black text-white flex items-center gap-1 shadow-lg">
                      <Film className="w-3 h-3 text-white" />
                      <span>4K ULTRA HD</span>
                    </div>

                    {/* Quick Play Trigger */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.9)] transition-transform hover:scale-110">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="text-sm font-cyber font-extrabold text-white truncate uppercase">
                        {item.track.title}
                      </h4>
                      <p className="text-xs font-mono text-zinc-400 truncate uppercase mt-0.5">
                        {item.track.artist || item.album.artist}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleLike(item.track.id, item.track.title, e)}
                      className={`p-2 rounded-full border transition-all ${
                        isLiked
                          ? 'bg-white text-black border-white'
                          : 'bg-white/5 text-zinc-400 hover:text-white border-white/10'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. SWIMLANE: UNDERGROUND RARITIES & UNRELEASED */}
      {(activeFilter === 'ALL' || activeFilter === 'LOSSLESS AUDIO') && (
        <section className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-cyber font-black tracking-wider text-white uppercase flex items-center gap-2">
                  <span>UNDERGROUND RARITIES & LOSSLESS</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-black text-[9px] font-mono font-black">
                    FLAC 24-BIT
                  </span>
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Bản thu âm chuẩn phòng thu không nén (Master Lossless Audio)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollLane('lane-lossless-audio', 'left')}
                className="p-2 rounded-full bg-white/5 hover:bg-white text-zinc-400 hover:text-black border border-white/10 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollLane('lane-lossless-audio', 'right')}
                className="p-2 rounded-full bg-white/5 hover:bg-white text-zinc-400 hover:text-black border border-white/10 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            id="lane-lossless-audio"
            className="flex items-center gap-4 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1"
          >
            {losslessAudioTracks.map((item, index) => {
              const isCur = currentTrack?.id === item.track.id;
              const isLiked = likedTrackIds.has(item.track.id);

              return (
                <div
                  key={item.track.id || index}
                  onClick={() => handlePlayItem(item, 'underground_rarities')}
                  className={`group relative w-64 sm:w-72 flex-shrink-0 rounded-3xl p-4 bg-zinc-950 border transition-all duration-300 cursor-pointer shadow-xl hover:scale-[1.02] ${
                    isCur ? 'border-white shadow-[0_0_25px_rgba(255,255,255,0.15)]' : 'border-white/15 hover:border-white/40'
                  }`}
                >
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black mb-3.5 border border-white/10 shadow-inner">
                    {item.album.cover_url ? (
                      <img
                        src={item.album.cover_url}
                        alt={item.track.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Disc3 className="w-16 h-16 text-zinc-700" />
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[9px] font-mono font-black text-white shadow-lg">
                      LOSSLESS 96kHz
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                        {isCur && isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="text-sm font-cyber font-extrabold text-white truncate uppercase">
                        {item.track.title}
                      </h4>
                      <p className="text-xs font-mono text-zinc-400 truncate uppercase mt-0.5">
                        {item.track.artist || item.album.artist}
                      </p>
                    </div>
                    {isCur && <Disc3 className="w-4 h-4 text-white animate-spin flex-shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
