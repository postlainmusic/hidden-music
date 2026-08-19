'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import {
  Play,
  Film,
  Sparkles,
  Disc3,
  Heart,
  ChevronRight,
  ChevronLeft,
  Flame,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { Album, TrackItem } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';
import { useTelemetry } from '@/hooks/useTelemetry';

interface DiscoveryFeedProps {
  albums: Album[];
  onSelectAlbum?: (album: Album) => void;
  className?: string;
}

export default function DiscoveryFeed({
  albums,
  onSelectAlbum,
  className = '',
}: DiscoveryFeedProps) {
  const { playTrack, playVideo, switchToVideoZone, openPaywall, isPremium } = usePlayer();
  const { trackPlay, trackHeart, trackRecommendationClick } = useTelemetry();
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());

  // Aggregate all tracks from albums for swimlanes
  const allTracks = React.useMemo(() => {
    const list: { track: TrackItem; album: Album }[] = [];
    albums.forEach((album) => {
      if (album.tracks && album.tracks.length > 0) {
        album.tracks.forEach((track) => {
          list.push({ track, album });
        });
      }
    });
    return list;
  }, [albums]);

  // Swimlane 1: Trending MVs (Tracks with video_url or media_type === 'video')
  const videoTracks = React.useMemo(() => {
    const vids = allTracks.filter(
      (item) => item.track.media_type === 'video' || Boolean(item.track.video_url)
    );
    return vids.length > 0 ? vids : allTracks.slice(0, 8);
  }, [allTracks]);

  // Swimlane 2: Curated for PostLain
  const curatedTracks = React.useMemo(() => {
    return [...allTracks].reverse().slice(0, 10);
  }, [allTracks]);

  // Swimlane 3: Featured Albums
  const featuredAlbums = React.useMemo(() => {
    return albums.slice(0, 8);
  }, [albums]);

  const handleToggleHeart = (e: React.MouseEvent, trackId: string, albumId?: string) => {
    e.stopPropagation();
    setLikedTrackIds((prev) => {
      const next = new Set(prev);
      const isNowLiked = !next.has(trackId);
      if (isNowLiked) next.add(trackId);
      else next.delete(trackId);
      trackHeart(trackId, isNowLiked, albumId);
      return next;
    });
  };

  const handlePlayAudio = (e: React.MouseEvent, track: TrackItem, album: Album, section: string) => {
    e.stopPropagation();
    trackRecommendationClick(track.id, section, album.id);
    trackPlay(track.id, album.id, 'audio', section);
    playTrack(track, album, album.tracks || [track]);
  };

  const handlePlayVideoMV = (e: React.MouseEvent, track: TrackItem, album: Album, section: string) => {
    e.stopPropagation();
    trackRecommendationClick(track.id, section, album.id);
    trackPlay(track.id, album.id, 'video', section);

    if (!isPremium && track.media_type === 'video') {
      openPaywall();
      return;
    }

    playVideo(track, album);
    switchToVideoZone(track, album);
  };

  return (
    <section className={`w-full flex flex-col gap-10 py-6 text-white select-none ${className}`}>
      {/* Swimlane 1: Trending 4K MVs */}
      <SwimlaneWrapper
        title="TRENDING 4K MVs"
        subtitle="XU HƯỚNG BĂNG ĐĨA // DIRECT STREAMING"
        icon={<Film className="w-5 h-5 text-white" />}
      >
        {videoTracks.map(({ track, album }) => {
          const isLiked = likedTrackIds.has(track.id);
          const cover = track.cover_url || album.cover_url || '/placeholder.jpg';

          return (
            <div
              key={`trending-mv-${track.id}`}
              onClick={(e) => handlePlayVideoMV(e, track, album, 'trending_mvs')}
              className="flex-shrink-0 w-64 sm:w-72 group relative rounded-2xl bg-zinc-950/80 border border-white/15 overflow-hidden transition-all duration-300 hover:border-white/40 hover:-translate-y-1 shadow-lg hover:shadow-[0_10px_30px_rgba(255,255,255,0.05)] cursor-pointer"
            >
              {/* Media Thumbnail */}
              <div className="relative w-full aspect-video bg-zinc-900 overflow-hidden">
                <Image
                  src={cover}
                  alt={track.title}
                  fill
                  sizes="300px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* 4K Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 border border-white/20 text-[9px] font-mono font-bold tracking-wider text-white backdrop-blur-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-white" />
                  <span>4K HDR</span>
                </div>

                {/* Heart Button */}
                <button
                  onClick={(e) => handleToggleHeart(e, track.id, album.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 border border-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-md"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${isLiked ? 'fill-white text-white' : 'text-zinc-300'}`}
                  />
                </button>

                {/* Play MV Overlay Icon */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => handlePlayVideoMV(e, track, album, 'trending_mvs')}
                    className="p-3 rounded-full bg-white text-black hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                    title="Play 4K MV"
                  >
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </button>
                  <button
                    onClick={(e) => handlePlayAudio(e, track, album, 'trending_mvs')}
                    className="p-3 rounded-full bg-black/80 border border-white/30 text-white hover:scale-110 active:scale-95 transition-all backdrop-blur-md"
                    title="Play Audio Only"
                  >
                    <Disc3 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Meta info */}
              <div className="p-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-cyber line-clamp-1 group-hover:text-zinc-200">
                    {track.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest line-clamp-1 mt-0.5">
                    {track.artist || album.artist}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span className="uppercase">{album.title}</span>
                  <span>{track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : 'HD'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </SwimlaneWrapper>

      {/* Swimlane 2: Curated for PostLain (AI Recommendation) */}
      <SwimlaneWrapper
        title="CURATED FOR POSTLAIN"
        subtitle="AI PHỐI KHÍ // GỢI Ý RIÊNG CHO BẠN"
        icon={<Sparkles className="w-5 h-5 text-white" />}
      >
        {curatedTracks.map(({ track, album }) => {
          const isLiked = likedTrackIds.has(track.id);
          const cover = track.cover_url || album.cover_url || '/placeholder.jpg';

          return (
            <div
              key={`curated-${track.id}`}
              onClick={(e) => handlePlayAudio(e, track, album, 'curated_for_you')}
              className="flex-shrink-0 w-44 sm:w-52 group relative rounded-2xl bg-zinc-950/80 border border-white/15 overflow-hidden transition-all duration-300 hover:border-white/40 hover:-translate-y-1 shadow-lg hover:shadow-[0_10px_30px_rgba(255,255,255,0.05)] cursor-pointer p-3 flex flex-col gap-3"
            >
              {/* Square Artwork */}
              <div className="relative w-full aspect-square rounded-xl bg-zinc-900 overflow-hidden">
                <Image
                  src={cover}
                  alt={track.title}
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* AI Match Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 border border-white/20 text-[8px] font-mono font-bold tracking-wider text-white backdrop-blur-md flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                  <span>99% MATCH</span>
                </div>

                {/* Heart Button */}
                <button
                  onClick={(e) => handleToggleHeart(e, track.id, album.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 border border-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-md"
                >
                  <Heart
                    className={`w-3 h-3 ${isLiked ? 'fill-white text-white' : 'text-zinc-300'}`}
                  />
                </button>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <button
                    onClick={(e) => handlePlayAudio(e, track, album, 'curated_for_you')}
                    className="p-3 rounded-full bg-white text-black hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                  >
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  </button>
                </div>
              </div>

              {/* Track Title & Artist */}
              <div>
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-cyber line-clamp-1 group-hover:text-zinc-200">
                  {track.title}
                </h4>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest line-clamp-1 mt-0.5">
                  {track.artist || album.artist}
                </p>
              </div>
            </div>
          );
        })}
      </SwimlaneWrapper>

      {/* Swimlane 3: Featured Albums Vault */}
      <SwimlaneWrapper
        title="VAULT DISCOGRAPHY"
        subtitle="TOÀN BỘ DANH MỤC ALBUM BỊ ẨN & THU HỒI"
        icon={<Disc3 className="w-5 h-5 text-white animate-spin-slow" />}
      >
        {featuredAlbums.map((album) => (
          <div
            key={`album-item-${album.id}`}
            onClick={() => onSelectAlbum && onSelectAlbum(album)}
            className="flex-shrink-0 w-48 sm:w-56 group relative rounded-2xl bg-zinc-950/80 border border-white/15 overflow-hidden transition-all duration-300 hover:border-white/40 hover:-translate-y-1 shadow-lg hover:shadow-[0_10px_30px_rgba(255,255,255,0.05)] cursor-pointer p-3 flex flex-col gap-3"
          >
            <div className="relative w-full aspect-square rounded-xl bg-zinc-900 overflow-hidden">
              <Image
                src={album.cover_url || '/placeholder.jpg'}
                alt={album.title}
                fill
                sizes="250px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 border border-white/20 text-[8px] font-mono font-bold tracking-wider text-white backdrop-blur-md">
                {album.original_year || 'ARCHIVE'}
              </div>

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <span className="px-3 py-1.5 rounded-full bg-white text-black font-mono text-[10px] font-bold uppercase tracking-wider">
                  MỞ ALBUM
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-cyber line-clamp-1 group-hover:text-zinc-200">
                {album.title}
              </h4>
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest line-clamp-1 mt-0.5">
                {album.artist}
              </p>
            </div>
          </div>
        ))}
      </SwimlaneWrapper>
    </section>
  );
}

// Subcomponent: Reusable Swimlane Container with Horizontal Scrolling Controls
function SwimlaneWrapper({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -350 : 350;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md">
            {icon}
          </div>
          <div>
            <h3 className="text-sm sm:text-lg font-black uppercase tracking-wider font-cyber">
              {title}
            </h3>
            <p className="text-[10px] sm:text-xs text-zinc-400 font-mono uppercase tracking-widest">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Scroll Arrows */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-xl bg-zinc-950 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95"
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-xl bg-zinc-950 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95"
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex items-center gap-4 overflow-x-auto px-4 sm:px-6 pb-2 scrollbar-none scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
