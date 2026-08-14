'use client';

import React, { useState, useEffect, useRef } from 'react';
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
      const x = (e.clientX / innerWidth - 0.5) * 14; // -7deg to +7deg
      const y = -(e.clientY / innerHeight - 0.5) * 14; // -7deg to +7deg
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
    <div className="w-full h-full absolute inset-0 z-0 bg-[#090a0f] flex items-center justify-center overflow-hidden px-4 select-none">
      {/* ========================================================================= */}
      {/* 3-LAYER COSMIC STARFIELD SPACE BACKGROUND (UIVERSE PARALLAX)               */}
      {/* ========================================================================= */}
      <div className="cosmic-space-bg">
        <div id="stars" />
        <div id="stars2" />
        <div id="stars3" />
      </div>

      {/* Main 3D Interactive Container */}
      <div
        className="relative z-10 flex flex-col items-center justify-center transition-transform duration-200 ease-out"
        style={{
          perspective: '1200px',
        }}
      >
        {/* Crystal Glass Card Container (Exclusively wrapping Cover, Vinyl, Title, Artist) */}
        <div
          className="crystal-glass-card group cursor-pointer p-4 sm:p-5 md:p-6 w-[280px] sm:w-[340px] md:w-[380px]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onSelectAlbum(activeAlbum)}
          style={{
            transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale(${isHovered ? 1.03 : 1.0})`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* 1. Center Album Artwork & Smooth Sliding Vinyl Disc */}
          <div className="relative mx-auto flex items-center justify-center overflow-visible">
            {/* Realistic Grooved Vinyl Record */}
            <div
              className="absolute w-44 h-44 sm:w-52 sm:h-52 md:w-60 md:h-60 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/20 shadow-2xl flex items-center justify-center transition-transform duration-500 ease-out pointer-events-none z-0"
              style={{
                transform: isHovered
                  ? 'translateX(40%) rotate(180deg)'
                  : 'translateX(0%) rotate(0deg)',
                boxShadow: isHovered
                  ? '0 15px 35px rgba(0,0,0,0.95), inset 0 0 25px rgba(255,255,255,0.08)'
                  : 'none',
              }}
            >
              {/* Vinyl Grooves Rings */}
              <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                  <div className="w-full h-full rounded-full border border-white/10 p-2.5 flex items-center justify-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full bg-zinc-800 border-2 border-white/40 flex items-center justify-center shadow-inner">
                      <div className="w-3.5 h-3.5 rounded-full bg-black border border-white/60" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Original Full-Color Cover Artwork Sleeve */}
            <div className="relative z-10 w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.9)] border border-white/15 bg-zinc-950 flex-shrink-0">
              <img
                src={activeAlbum.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                alt={activeAlbum.title}
                className="w-full h-full object-cover select-none"
                loading="eager"
              />
            </div>
          </div>

          {/* 2. Album Title & Artist Name Only */}
          <div className="flex flex-col items-center text-center mt-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-cyber text-white tracking-wider truncate uppercase w-full">
              {activeAlbum.title}
            </h2>
            <p className="text-xs sm:text-sm font-mono text-zinc-400 font-semibold tracking-widest uppercase mt-1">
              {activeAlbum.artist || 'VAULT ARTIST'}
            </p>
          </div>
        </div>

        {/* Minimal Navigation Dots if Multiple Albums Exist */}
        {albums.length > 1 && (
          <div className="flex items-center gap-2 mt-5 z-20">
            {albums.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
                title={`Album ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
