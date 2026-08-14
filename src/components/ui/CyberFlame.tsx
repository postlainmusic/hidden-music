'use client';

import React, { useMemo } from 'react';

export default function CyberFlame({ isPlaying }: { isPlaying?: boolean }) {
  // 32 pre-computed randomized flame particle trajectories for 100% browser compatibility
  const particles = useMemo(() => {
    const arr = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      const posX = ((i * 19.3 + 7) % 94) + 3; // 3% to 97%
      const size = 26 + ((i * 13) % 36); // 26px to 62px
      const duration = (1.1 + ((i * 0.17) % 1.4)).toFixed(2) + 's';
      const delay = (-1 * (i * 0.19)).toFixed(2) + 's';
      const offset = (12 + ((i * 7) % 24)) + 'px';
      const swayDuration = (1.2 + ((i * 0.23) % 1.3)).toFixed(2) + 's';
      const swayDelay = (-1 * ((i * 0.31) % 1.5)).toFixed(2) + 's';

      arr.push({
        id: i,
        style: {
          '--posX': `${posX}%`,
          '--size': `${size}px`,
          '--duration': duration,
          '--delay': delay,
          '--offset': offset,
          '--swayDuration': swayDuration,
          '--swayDelay': swayDelay,
        } as React.CSSProperties,
      });
    }
    return arr;
  }, []);

  return (
    <div
      id="cyber-album-flame"
      className={`cyber-flame-container transition-all duration-200 pointer-events-none select-none ${
        isPlaying ? 'opacity-85' : 'opacity-0 scale-90'
      }`}
    >
      {/* Base incandescent core glow */}
      <div className="flame-core-glow" />

      {/* 32 dynamic rising fire particles */}
      {particles.map((p) => (
        <div key={p.id} className="flame-particle" style={p.style} />
      ))}

      {/* Morphing Liquid Fire Blur & High-Contrast Overlay */}
      <div className="flame-blur-overlay" />
    </div>
  );
}
