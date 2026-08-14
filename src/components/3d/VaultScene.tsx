'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Disc3, ArrowUp, ArrowDown, Sparkles, ChevronRight, Lock } from 'lucide-react';
import { Album } from '@/types/database';

interface VaultSceneProps {
  albums: Album[];
  onSelectAlbum: (album: Album) => void;
}

export default function VaultScene({ albums, onSelectAlbum }: VaultSceneProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const touchStartY = useRef(0);
  const lastScrollTime = useRef(0);

  const activeAlbum = albums[currentIndex] || albums[0];

  // Smooth 3D Cursor Tilt Parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 16; // -8deg to +8deg
      const y = -(e.clientY / innerHeight - 0.5) * 16; // -8deg to +8deg
      setTilt({ x: y, y: x });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Vertical Navigation Handlers (Wheel, Arrow Keys, Touch)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < 280) return;

      if (e.deltaY > 30) {
        lastScrollTime.current = now;
        setCurrentIndex((prev) => (prev + 1) % albums.length);
      } else if (e.deltaY < -30) {
        lastScrollTime.current = now;
        setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % albums.length);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      if (deltaY > 50) {
        setCurrentIndex((prev) => (prev + 1) % albums.length);
      } else if (deltaY < -50) {
        setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [albums.length]);

  if (!activeAlbum) return null;

  return (
    <div className="w-full h-full absolute inset-0 z-0 bg-[#000000] flex items-center justify-center overflow-hidden px-4 select-none">
      {/* Background Starry Particles / Ambient Space */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/30 via-black to-black pointer-events-none" />

      {/* Main 3D Interactive Monolith Column */}
      <div
        className="relative z-10 flex flex-col items-center justify-center transition-transform duration-200 ease-out"
        style={{
          perspective: '1200px',
        }}
      >
        {/* Uiverse Luxury Glassmorphism Container */}
        <div
          className="uiverse-glass-container group cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onSelectAlbum(activeAlbum)}
          style={{
            transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale(${isHovered ? 1.03 : 1.0})`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Frosted Glass Box */}
          <div className="uiverse-glass-box w-[300px] sm:w-[380px] md:w-[440px] p-5 sm:p-7 md:p-8 flex flex-col gap-5 sm:gap-6 shadow-2xl">
            {/* Top Bar: Vault Metadata */}
            <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] sm:text-xs tracking-widest border-b border-white/10 pb-3">
              <div className="flex items-center gap-1.5 text-white font-bold font-cyber">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>RESTRICTED ARCHIVE</span>
              </div>
              <span className="bg-white/10 px-2 py-0.5 rounded-full border border-white/15 text-zinc-300">
                {String(currentIndex + 1).padStart(2, '0')} / {String(albums.length).padStart(2, '0')}
              </span>
            </div>

            {/* Center: Album Cover & Sliding Vinyl Disc */}
            <div className="relative mx-auto flex items-center justify-center my-2">
              {/* Vinyl Disc (Glides out smoothly on hover) */}
              <div
                className="absolute w-48 h-48 sm:w-60 sm:h-60 md:w-68 md:h-68 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/20 shadow-2xl flex items-center justify-center transition-transform duration-500 ease-out pointer-events-none z-0"
                style={{
                  transform: isHovered
                    ? 'translateX(45%) rotate(180deg)'
                    : 'translateX(0%) rotate(0deg)',
                  boxShadow: isHovered
                    ? '0 10px 30px rgba(0,0,0,0.9), inset 0 0 25px rgba(255,255,255,0.1)'
                    : 'none',
                }}
              >
                {/* Vinyl Grooves Texture */}
                <div className="w-full h-full rounded-full border border-white/10 p-3 flex items-center justify-center">
                  <div className="w-full h-full rounded-full border border-white/10 p-3 flex items-center justify-center">
                    <div className="w-full h-full rounded-full border border-white/10 p-3 flex items-center justify-center">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800 border-2 border-white/40 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-black border border-white/50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* High-Resolution Full-Color Cover Artwork */}
              <div className="relative z-10 w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-2xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.85)] border border-white/15 bg-zinc-900 flex-shrink-0">
                <img
                  src={activeAlbum.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                  alt={activeAlbum.title}
                  className="w-full h-full object-cover select-none"
                  loading="eager"
                />
              </div>
            </div>

            {/* Bottom: Typography & Details */}
            <div className="flex flex-col gap-1 text-center sm:text-left mt-1">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-cyber text-white tracking-wider truncate uppercase">
                {activeAlbum.title}
              </h2>
              <div className="flex items-center justify-center sm:justify-between text-xs sm:text-sm font-mono text-zinc-300">
                <span className="font-semibold tracking-wider uppercase text-zinc-200">
                  {activeAlbum.artist || 'VAULT ARTIST'}
                </span>
                <span className="hidden sm:inline-block text-zinc-500 font-mono text-[11px]">
                  RELEASE: {activeAlbum.original_year || 'ARCHIVE'}
                </span>
              </div>
            </div>

            {/* Action CTA Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectAlbum(activeAlbum);
              }}
              className="w-full py-3 rounded-xl bg-white text-black font-cyber font-extrabold text-xs tracking-widest uppercase hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
            >
              <span>KHÁM PHÁ BẢN GHI (ENTER VAULT)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Album Carousel Navigation Indicators */}
        {albums.length > 1 && (
          <div className="flex items-center gap-3 mt-6 z-20 font-mono text-xs">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-110"
              title="Album trước"
            >
              <ArrowUp className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {albums.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % albums.length)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-110"
              title="Album tiếp theo"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
