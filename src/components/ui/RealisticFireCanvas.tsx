'use client';

import React, { useEffect, useRef } from 'react';

interface RealisticFireCanvasProps {
  isPlaying?: boolean;
}

export default function RealisticFireCanvas({ isPlaying = false }: RealisticFireCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = 460);
    let height = (canvas.height = 560);

    // Particle definition
    interface FlameParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      maxSize: number;
      life: number;
      maxLife: number;
      heat: number; // 1.0 (white hot) -> 0.0 (dark red smoke)
      swayOffset: number;
      swaySpeed: number;
    }

    interface SparkParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
      maxLife: number;
      alpha: number;
    }

    const flameParticles: FlameParticle[] = [];
    const sparks: SparkParticle[] = [];
    const maxFlames = 140;
    const maxSparks = 50;

    const createFlame = (isKick = false): FlameParticle => {
      const spread = width * 0.48;
      const x = width / 2 + (Math.random() - 0.5) * spread;
      const y = height - 35 - Math.random() * 20;
      const size = (isKick ? 38 : 24) + Math.random() * (isKick ? 34 : 22);
      const life = 0;
      const maxLife = (isKick ? 45 : 32) + Math.random() * 25;
      const vy = -1 * ((isKick ? 7.5 : 4.5) + Math.random() * (isKick ? 6.0 : 3.5));
      const vx = (Math.random() - 0.5) * 1.8;

      return {
        x,
        y,
        vx,
        vy,
        size,
        maxSize: size,
        life,
        maxLife,
        heat: 1.0,
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 0.05 + Math.random() * 0.06,
      };
    };

    const createSpark = (isKick = false): SparkParticle => {
      const spread = width * 0.55;
      const x = width / 2 + (Math.random() - 0.5) * spread;
      const y = height - 40 - Math.random() * 30;
      const size = 1.5 + Math.random() * 2.5;
      const maxLife = 40 + Math.random() * 50;
      const vy = -1 * ((isKick ? 8.0 : 4.5) + Math.random() * 6.0);
      const vx = (Math.random() - 0.5) * 3.5;

      return {
        x,
        y,
        vx,
        vy,
        size,
        life: 0,
        maxLife,
        alpha: 1.0,
      };
    };

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Read real-time audio flame drive intensity from window/dataset
      const flameContainer = document.getElementById('cyber-album-flame');
      const kickIntensity = flameContainer
        ? parseFloat(flameContainer.getAttribute('data-kick') || '0')
        : 0;

      const isAudioActive = isPlaying || kickIntensity > 0.05;

      if (isAudioActive) {
        // Spawn active flames
        const spawnCount = isKickIntensityHigh(kickIntensity) ? 6 : 3;
        for (let i = 0; i < spawnCount; i++) {
          if (flameParticles.length < maxFlames) {
            flameParticles.push(createFlame(kickIntensity > 0.4));
          }
        }

        // Spawn sparks
        if (Math.random() < (0.4 + kickIntensity * 0.6) && sparks.length < maxSparks) {
          sparks.push(createSpark(kickIntensity > 0.4));
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // 1. Draw Volumetric Base Coal & Core Plasma Glow
      if (isAudioActive) {
        const baseGlowGrad = ctx.createRadialGradient(
          width / 2,
          height - 35,
          10,
          width / 2,
          height - 35,
          160 + kickIntensity * 80
        );
        baseGlowGrad.addColorStop(0, `rgba(255, 255, 230, ${0.95 + kickIntensity * 0.05})`);
        baseGlowGrad.addColorStop(0.2, `rgba(255, 150, 0, ${0.85 + kickIntensity * 0.15})`);
        baseGlowGrad.addColorStop(0.55, `rgba(255, 35, 0, ${0.60 + kickIntensity * 0.25})`);
        baseGlowGrad.addColorStop(0.85, `rgba(180, 0, 0, ${0.30 + kickIntensity * 0.20})`);
        baseGlowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = baseGlowGrad;
        ctx.beginPath();
        ctx.ellipse(width / 2, height - 35, 180 + kickIntensity * 50, 75 + kickIntensity * 35, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Update & Draw Rising Liquid Flame Tongues (Fluid Particles)
      for (let i = flameParticles.length - 1; i >= 0; i--) {
        const p = flameParticles[i];
        p.life++;
        p.swayOffset += p.swaySpeed;

        const progress = p.life / p.maxLife;
        if (progress >= 1.0) {
          flameParticles.splice(i, 1);
          continue;
        }

        // Upward turbulent physics with wind sway
        p.x += p.vx + Math.sin(p.swayOffset) * 1.2;
        p.y += p.vy;
        p.vy *= 0.985; // slight deceleration as flame rises and cools

        // Center convergence as flames reach the top
        const centerDist = width / 2 - p.x;
        p.x += centerDist * 0.015;

        // Dynamic scale & heat decay
        const curSize = p.maxSize * (1.0 - progress * 0.75);
        p.heat = 1.0 - progress;

        // Multi-color fiery gradient based on flame temperature
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, curSize);

        if (p.heat > 0.7) {
          // Core: White-Hot to Brilliant Gold
          const alpha = 1.0 - (progress * 0.3);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          grad.addColorStop(0.35, `rgba(255, 210, 30, ${alpha * 0.95})`);
          grad.addColorStop(0.7, `rgba(255, 80, 0, ${alpha * 0.75})`);
          grad.addColorStop(1, 'rgba(255, 20, 0, 0)');
        } else if (p.heat > 0.35) {
          // Mid body: Vivid Orange to Fiery Crimson
          const alpha = (1.0 - progress) * 0.85;
          grad.addColorStop(0, `rgba(255, 180, 20, ${alpha})`);
          grad.addColorStop(0.45, `rgba(255, 50, 0, ${alpha * 0.85})`);
          grad.addColorStop(0.85, `rgba(180, 10, 0, ${alpha * 0.4})`);
          grad.addColorStop(1, 'rgba(120, 0, 0, 0)');
        } else {
          // Tip: Dark Red Ember Smoke
          const alpha = (1.0 - progress) * 0.45;
          grad.addColorStop(0, `rgba(230, 40, 0, ${alpha})`);
          grad.addColorStop(0.6, `rgba(120, 10, 0, ${alpha * 0.4})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, curSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Update & Draw Incandescent Sparks & Flying Embers
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life++;
        const prog = s.life / s.maxLife;

        if (prog >= 1.0) {
          sparks.splice(i, 1);
          continue;
        }

        s.x += s.vx + (Math.random() - 0.5) * 1.5;
        s.y += s.vy;
        s.vy *= 0.99;
        s.alpha = (1.0 - prog) * (0.6 + Math.random() * 0.4); // realistic flickering

        const sparkGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2);
        sparkGrad.addColorStop(0, `rgba(255, 255, 255, ${s.alpha})`);
        sparkGrad.addColorStop(0.4, `rgba(255, 180, 0, ${s.alpha * 0.9})`);
        sparkGrad.addColorStop(0.8, `rgba(255, 40, 0, ${s.alpha * 0.4})`);
        sparkGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = sparkGrad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animIdRef.current = requestAnimationFrame(render);
    };

    function isKickIntensityHigh(intensity: number) {
      return intensity > 0.35;
    }

    animIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [isPlaying]);

  return (
    <div
      id="cyber-album-flame"
      data-kick="0"
      className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-[460px] h-[560px] max-w-[150%] pointer-events-none select-none z-0 transition-opacity duration-300 ${
        isPlaying ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        filter: 'drop-shadow(0 -15px 40px rgba(255, 60, 0, 0.75)) drop-shadow(0 -30px 90px rgba(255, 20, 0, 0.5))',
      }}
    >
      <canvas
        ref={canvasRef}
        width={460}
        height={560}
        className="w-full h-full object-contain pointer-events-none select-none"
      />
    </div>
  );
}
