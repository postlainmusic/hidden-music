'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Disc3,
  Music,
  Mic2,
  Film,
  X,
  Radio,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { parseLrc, getActiveLyricIndex } from '../../lib/lrcParser';
import { getCoverCdnUrl } from '../../lib/r2Storage';

export default function GlobalAudioPlayer() {
  const {
    currentTrack,
    currentAlbum,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffleMode,
    repeatMode,
    analyserRef,
    togglePlay,
    seek,
    setVolume,
    toggleShuffle,
    setRepeatMode,
    nextTrack,
    prevTrack,
    playTrack,
  } = usePlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.85);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio Visualizer Canvas animation loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const analyser = analyserRef.current;
      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / 16) * 0.7;
        let x = 0;

        for (let i = 0; i < 16; i++) {
          const barHeight = ((dataArray[i * 2] || 0) / 255) * canvas.height;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 3;
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, analyserRef]);

  if (!currentTrack) return null;

  const parsedLyrics = parseLrc(currentTrack.lyrics);
  const activeLyricIdx = getActiveLyricIndex(parsedLyrics, currentTime);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleToggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume || 0.85);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const coverSrc =
    currentTrack?.cover_url ||
    (currentAlbum?.cover_url ? getCoverCdnUrl(currentAlbum.cover_url) : '') ||
    '/icon.svg';

  return (
    <>
      {/* ========================================================================= */}
      {/* FLOATING BOTTOM PLAYER BAR                                               */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-4 select-none font-mono">
        <div className="max-w-6xl mx-auto rounded-2xl sm:rounded-3xl bg-black/85 backdrop-blur-2xl border border-white/20 p-2.5 sm:p-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-2 sm:gap-4">
          
          {/* LEFT: Cover Art & Track Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 max-w-[220px] sm:max-w-[280px]">
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-900 border border-white/20 flex-shrink-0 shadow-md">
              <img
                src={coverSrc}
                alt={currentTrack.title}
                className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 truncate">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate uppercase font-cyber tracking-wide">
                  {currentTrack.title}
                </h4>
                {currentTrack.source === 'youtube' ? (
                  <span className="text-[7px] px-1 py-0.2 rounded font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex-shrink-0">
                    YT
                  </span>
                ) : currentTrack.video_url ? (
                  <button
                    onClick={() => setShowVideo((p) => !p)}
                    className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-white text-black flex items-center gap-0.5 flex-shrink-0"
                  >
                    <Film className="w-2 h-2" /> MV
                  </button>
                ) : null}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate uppercase">
                {currentTrack.artist || currentAlbum?.artist || 'VAULT ARTIST'}
              </p>
            </div>
          </div>

          {/* CENTER: Main Play Controls & Seekbar */}
          <div className="flex-1 flex flex-col items-center max-w-xl px-1 sm:px-4">
            <div className="flex items-center gap-3 sm:gap-5 mb-1 sm:mb-1.5">
              <button
                onClick={toggleShuffle}
                className={`p-1.5 rounded-full transition-colors hidden sm:block ${
                  shuffleMode ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Phát ngẫu nhiên"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={prevTrack}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Bài trước"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Bài tiếp theo"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => setRepeatMode(repeatMode === 'all' ? 'one' : repeatMode === 'one' ? 'off' : 'all')}
                className={`p-1.5 rounded-full transition-colors hidden sm:block ${
                  repeatMode !== 'off' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Lặp lại"
              >
                {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Time Scrubber */}
            <div className="w-full flex items-center gap-2 text-[10px] text-slate-400 font-mono">
              <span className="w-8 text-right">{formatTime(currentTime)}</span>
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = clickX / rect.width;
                  seek(ratio * duration);
                }}
                className="flex-1 h-1.5 bg-white/10 hover:h-2 rounded-full overflow-hidden cursor-pointer relative transition-all"
              >
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* RIGHT: Extra Tools (Lyrics, Queue, Visualizer, Volume) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Visualizer Canvas */}
            <canvas ref={canvasRef} width={60} height={20} className="hidden md:block opacity-70" />

            {/* Lyrics Toggle */}
            <button
              onClick={() => {
                setShowLyrics((p) => !p);
                setShowQueue(false);
              }}
              className={`p-2 rounded-full border transition-all ${
                showLyrics ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
              title="Lời bài hát"
            >
              <Mic2 className="w-3.5 h-3.5" />
            </button>

            {/* Queue Toggle */}
            <button
              onClick={() => {
                setShowQueue((p) => !p);
                setShowLyrics(false);
              }}
              className={`p-2 rounded-full border transition-all ${
                showQueue ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
              title="Danh sách phát"
            >
              <ListMusic className="w-3.5 h-3.5" />
            </button>

            {/* Volume Slider (Desktop) */}
            <div className="hidden lg:flex items-center gap-1.5">
              <button onClick={handleToggleMute} className="p-1 text-slate-400 hover:text-white">
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-16 h-1 bg-white/20 rounded-full accent-white cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LYRICS DRAWER POPUP                                                      */}
      {/* ========================================================================= */}
      {showLyrics && (
        <div className="fixed bottom-24 right-4 sm:right-8 z-40 w-80 max-h-96 rounded-3xl bg-black/90 backdrop-blur-2xl border border-white/20 p-5 shadow-2xl overflow-hidden flex flex-col font-mono text-center animate-fadeIn select-none">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5" /> LỜI BÀI HÁT (LRC)
            </span>
            <button onClick={() => setShowLyrics(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-none py-4 text-xs">
            {parsedLyrics.length > 0 ? (
              parsedLyrics.map((line, idx) => (
                <p
                  key={idx}
                  onClick={() => seek(line.time)}
                  className={`cursor-pointer transition-all duration-200 ${
                    idx === activeLyricIdx
                      ? 'text-white font-bold text-sm scale-105'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {line.text}
                </p>
              ))
            ) : (
              <p className="text-slate-500 italic py-8">Chưa có lời đồng bộ cho bài hát này</p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUEUE DRAWER POPUP                                                       */}
      {/* ========================================================================= */}
      {showQueue && (
        <div className="fixed bottom-24 right-4 sm:right-8 z-40 w-80 max-h-96 rounded-3xl bg-black/90 backdrop-blur-2xl border border-white/20 p-5 shadow-2xl overflow-hidden flex flex-col font-mono animate-fadeIn select-none">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <ListMusic className="w-3.5 h-3.5" /> HÀNG ĐỢI ({playlist.length})
            </span>
            <button onClick={() => setShowQueue(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none pr-1">
            {playlist.map((track, idx) => {
              const isCurrent = track.id === currentTrack.id;
              return (
                <div
                  key={track.id || idx}
                  onClick={() => playTrack(track, currentAlbum, playlist)}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs transition-all ${
                    isCurrent ? 'bg-white/20 text-white font-bold' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="truncate pr-2">{track.title}</span>
                  {isCurrent && <Disc3 className="w-3 h-3 animate-spin-slow flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
