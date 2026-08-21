'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { SpringMotion, calculateFrequencyDecomposition } from '@/lib/dsp/audioPhysics';
import { HapticEngine } from '@/lib/dsp/hapticEngine';
import { getTrackDrumProfile, isDrumActiveAtTime } from '@/lib/dsp/trackDrumProfiles';

interface BeatVisualizerProps {
  className?: string;
  barCount?: number;
  showRings?: boolean;
}

export const BeatVisualizer: React.FC<BeatVisualizerProps> = ({
  className = '',
  barCount = 16,
  showRings = true,
}) => {
  const { currentAmplitude, currentTime, isPlaying, currentTrack } = usePlayer();
  const drumProfile = useMemo(() => getTrackDrumProfile(currentTrack?.title || currentTrack?.id), [currentTrack?.title, currentTrack?.id]);
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const springRef = useRef<SpringMotion>(new SpringMotion(1.0, { stiffness: 220, damping: 12 }));
  const lastTimeRef = useRef<number>(0);
  const kickCooldownRef = useRef<number>(0);

  useEffect(() => {
    let animId: number;

    const animate = (time: number) => {
      const dt = lastTimeRef.current > 0 ? (time - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = time;

      const isDrumming = isDrumActiveAtTime(drumProfile, currentTime);
      const decomp = calculateFrequencyDecomposition(currentAmplitude, currentTime, 1.0);

      // Spring physics update for overall bounce (strictly when drums are active)
      const targetScale = isPlaying && isDrumming ? 1.0 + decomp.subBass * 0.15 + decomp.snareFlux * 0.08 : 1.0;
      springRef.current.setTarget(targetScale);
      const currentScale = springRef.current.update(dt);

      if (containerRef.current) {
        containerRef.current.style.transform = `scale3d(${currentScale.toFixed(4)}, ${currentScale.toFixed(4)}, 1)`;
      }

      // Haptic kick trigger strictly during drum sections when Sub-bass > 0.82
      if (isPlaying && isDrumming && decomp.subBass > 0.82 && time - kickCooldownRef.current > 240) {
        kickCooldownRef.current = time;
        HapticEngine.triggerKick();
      }

      // Update individual frequency spectrum bars
      barsRef.current.forEach((bar, idx) => {
        if (!bar) return;
        if (!isPlaying) {
          bar.style.transform = 'scale3d(1, 0.1, 1)';
          bar.style.opacity = '0.3';
          return;
        }

        const normIdx = idx / (barCount - 1 || 1);
        let bandAmp = 0;

        if (normIdx < 0.35) {
          // Lows (Sub-bass)
          bandAmp = decomp.subBass * (1.0 - normIdx * 0.5);
        } else if (normIdx < 0.75) {
          // Mids (Snare & Vocals)
          bandAmp = decomp.snareFlux * (0.8 + 0.2 * Math.sin(normIdx * Math.PI));
        } else {
          // Highs (Hi-hats / Air)
          bandAmp = decomp.rmsEnergy * (0.6 + 0.4 * Math.cos(normIdx * Math.PI));
        }

        const barScaleY = Math.max(0.12, Math.min(1.0, bandAmp * 1.25));
        const barOpacity = Math.max(0.3, Math.min(1.0, 0.4 + bandAmp * 0.6));

        bar.style.transform = `scale3d(1, ${barScaleY.toFixed(3)}, 1)`;
        bar.style.opacity = barOpacity.toFixed(2);
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [currentAmplitude, currentTime, isPlaying, barCount]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}
      style={{
        contain: 'layout style paint',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      {/* Optional Ambient Pulse Ring */}
      {showRings && (
        <div
          className="absolute inset-0 rounded-full border border-white/20 pointer-events-none transition-opacity duration-300"
          style={{
            transform: 'scale(1.25)',
            opacity: isPlaying ? Math.max(0.1, currentAmplitude * 0.4) : 0.05,
          }}
        />
      )}

      {/* Cyber Waveform Bars */}
      <div className="flex items-end justify-center gap-1 h-8 w-full max-w-[200px]">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className="flex-1 min-w-[2px] bg-white rounded-t-sm origin-bottom"
            style={{
              height: '100%',
              transform: 'scale3d(1, 0.12, 1)',
              opacity: 0.3,
              contain: 'layout style paint',
            }}
          />
        ))}
      </div>
    </div>
  );
};
