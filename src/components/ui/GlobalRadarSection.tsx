'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Sparkles, Flame, Moon, Mic, Compass, Plus, Loader2 } from 'lucide-react';
import { TrackItem } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';

const RADAR_TABS = [
  { id: 'all', label: 'TẤT CẢ', query: 'V-Pop trending hot hits', icon: Sparkles },
  { id: 'trending', label: 'TRENDING', query: 'Top hits Vietnam trending official audio', icon: Flame },
  { id: 'chill', label: 'CHILL / NIGHT', query: 'Vietnamese chill night lofi rnb official audio', icon: Moon },
  { id: 'hiphop', label: 'HIP-HOP / TRAP', query: 'Vietnamese hiphop rap underground official audio', icon: Mic },
  { id: 'indie', label: 'INDIE', query: 'Vietnamese indie acoustic unreleased official audio', icon: Compass },
];

export default function GlobalRadarSection() {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [activeTab, setActiveTab] = useState('all');
  const [radarTracks, setRadarTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<string, TrackItem[]>>({});

  useEffect(() => {
    const currentTabObj = RADAR_TABS.find((t) => t.id === activeTab) || RADAR_TABS[0];
    const query = currentTabObj.query;

    if (cacheRef.current[activeTab]) {
      setRadarTracks(cacheRef.current[activeTab]);
      return;
    }

    setLoading(true);
    let isCancelled = false;

    fetch(`/api/yt/search?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && Array.isArray(data)) {
          const formatted: TrackItem[] = data.slice(0, 9).map((item: any) => ({
            id: item.id || `yt_${item.youtube_id}`,
            youtube_id: item.youtube_id,
            album_id: 'yt_radar',
            title: item.title,
            artist: item.artist || 'YouTube Artist',
            media_type: 'audio',
            source: 'youtube',
            audio_url: item.audio_url || `/api/yt/stream/${item.youtube_id}`,
            cover_url: item.cover_url,
            duration: item.duration || 200,
            created_at: new Date().toISOString(),
          }));
          cacheRef.current[activeTab] = formatted;
          setRadarTracks(formatted);
        }
      })
      .catch((err) => {
        console.warn('Global radar fetch note:', err);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab]);

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 my-10 font-mono select-none">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black font-cyber text-white uppercase tracking-wider">
                GLOBAL RADAR
              </h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-extrabold uppercase tracking-widest">
                LIVE YOUTUBE STREAM
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Nhạc đề xuất & thịnh hành toàn cầu cập nhật theo thời gian thực
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {RADAR_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  isActive
                    ? 'bg-white text-black shadow-lg scale-105'
                    : 'bg-black/40 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Tracks */}
      {loading && radarTracks.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-500 bg-black/40 rounded-3xl border border-white/5">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
          <span className="text-xs uppercase tracking-widest">Đang tải luồng âm thanh toàn cầu...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {radarTracks.map((track, idx) => {
            const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;
            const isThisTrackSelected = currentTrack?.id === track.id;

            return (
              <div
                key={track.id || idx}
                onClick={() => {
                  if (isThisTrackSelected) {
                    togglePlay();
                  } else {
                    playTrack(track, null, radarTracks);
                  }
                }}
                className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all duration-300 border backdrop-blur-md ${
                  isThisTrackSelected
                    ? 'bg-white/15 border-white shadow-[0_0_25px_rgba(255,255,255,0.1)] text-white'
                    : 'bg-black/50 hover:bg-white/10 border-white/10 hover:border-white/25 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Thumbnail */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0 group-hover:scale-105 transition-transform shadow-md">
                    <img
                      src={track.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Play Icon Overlay */}
                    <div
                      className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${
                        isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isThisTrackPlaying ? (
                        <Pause className="w-4 h-4 text-white fill-current" />
                      ) : (
                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold truncate group-hover:text-white transition-colors">
                      {track.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                        {track.artist}
                      </p>
                      <span className="text-[8px] uppercase px-1 py-0.2 rounded font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                        YT
                      </span>
                    </div>
                  </div>
                </div>

                {/* Duration & Play Action */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {Math.floor((track.duration || 200) / 60)}:
                    {String(Math.floor((track.duration || 200) % 60)).padStart(2, '0')}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-all border border-white/15 shadow-sm">
                    {isThisTrackPlaying ? (
                      <Pause className="w-3 h-3 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
