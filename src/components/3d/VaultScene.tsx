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
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const touchStartY = useRef(0);
  const lastScrollTime = useRef(0);

  const activeAlbum = albums[currentIndex] || albums[0];

  // Smooth 3D Cursor Parallax for Background & Card Tilt
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const normX = (e.clientX / innerWidth - 0.5) * 2; // -1 to 1
      const normY = (e.clientY / innerHeight - 0.5) * 2; // -1 to 1

      // 3D Tilt for Card (-8deg to +8deg)
      setTilt({
        x: -normY * 8,
        y: normX * 8,
      });

      // 3D Parallax Offset for Background Space Layers
      setMouseOffset({
        x: normX,
        y: normY,
      });
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
    <div className="w-full h-full absolute inset-0 z-0 bg-[#09090d] flex items-center justify-center overflow-hidden px-4 select-none">
      {/* ========================================================================= */}
      {/* 3D MOUSE-INTERACTIVE COSMIC SKY (PARALLAX DEPTH ON MOUSE MOVE)             */}
      {/* ========================================================================= */}
      <div
        className="cosmic-sky transition-transform duration-700 ease-out"
        style={{
          transform: `translate3d(${mouseOffset.x * 14}px, ${mouseOffset.y * 14}px, 0)`,
        }}
        aria-hidden="true"
      >
        {/* Procedural Stars drifting with mouse parallax */}
        <div
          className="cosmic-stars transition-transform duration-500 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * 32}px, ${mouseOffset.y * 32}px, 0)`,
          }}
        />

        {/* Deep Blue Nebula (Opposite Depth Movement) */}
        <div
          className="cosmic-nebula cosmic-nebula-one transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * -42}px, ${mouseOffset.y * -42}px, 0) rotate(-25deg)`,
          }}
        />

        {/* Wine Red Nebula (Forward Depth Movement) */}
        <div
          className="cosmic-nebula cosmic-nebula-two transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * 52}px, ${mouseOffset.y * 52}px, 0)`,
          }}
        />

        {/* Cosmic Supernova Flashes (High Parallax) */}
        <div
          className="cosmic-flash cosmic-flash-one transition-transform duration-300 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * -65}px, ${mouseOffset.y * -65}px, 0)`,
          }}
        />
        <div
          className="cosmic-flash cosmic-flash-two transition-transform duration-300 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * -75}px, ${mouseOffset.y * -75}px, 0)`,
          }}
        />
      </div>

      {/* Main 3D Interactive Container */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Crystal Clear Transparent Glass Card */}
        <div
          className="glass-card group cursor-pointer p-5 sm:p-6 md:p-7 w-[320px] sm:w-[380px] md:w-[420px]"
          style={{
            perspective: '1200px',
            transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale(${isHovered ? 1.025 : 1.0})`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onSelectAlbum(activeAlbum)}
        >
          {/* 1. Harmonious Symmetrical Composition: Cover Sleeve & Sliding Vinyl Disc */}
          <div className="relative mx-auto flex items-center justify-center h-48 sm:h-56 md:h-60 overflow-visible">
            {/* Realistic Grooved Vinyl Record (Slides Smoothly to the Right on Hover) */}
            <div
              className="absolute w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border border-white/25 shadow-2xl flex items-center justify-center transition-all duration-500 ease-out pointer-events-none z-0"
              style={{
                transform: isHovered
                  ? 'translateX(34px) rotate(180deg)'
                  : 'translateX(0px) rotate(0deg)',
                boxShadow: isHovered
                  ? '0 20px 40px rgba(0,0,0,0.95), inset 0 0 25px rgba(255,255,255,0.1)'
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

            {/* Original Full-Color Cover Artwork Sleeve (Slides Gracefully to the Left on Hover) */}
            <div
              className="relative z-10 w-46 h-46 sm:w-54 sm:h-54 md:w-58 md:h-58 rounded-2xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.9)] border border-white/20 bg-zinc-950 flex-shrink-0 transition-transform duration-500 ease-out"
              style={{
                transform: isHovered ? 'translateX(-22px)' : 'translateX(0px)',
              }}
            >
              <img
                src={activeAlbum.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
                alt={activeAlbum.title}
                className="w-full h-full object-cover select-none"
                loading="eager"
              />
            </div>
          </div>

          {/* 2. Album Title & Artist Name Only */}
          <div className="flex flex-col items-center text-center mt-5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-cyber text-white tracking-wider truncate uppercase w-full">
              {activeAlbum.title}
            </h2>
            <p className="text-xs sm:text-sm font-mono text-zinc-300 font-bold tracking-widest uppercase mt-1">
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
