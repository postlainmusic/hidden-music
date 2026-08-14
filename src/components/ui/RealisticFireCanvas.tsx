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

    let width = (canvas.width = 520);
    let height = (canvas.height = 620);

    interface FlameParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      maxSize: number;
      life: number;
      maxLife: number;
      heat: number;
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
    const maxFlames = 120;
    const maxSparks = 45;

    const createFlame = (intensity: number): FlameParticle => {
      const spread = width * 0.45;
      const x = width / 2 + (Math.random() - 0.5) * spread;
      const y = height - 45 - Math.random() * 25;
      const size = 32 + Math.random() * 32 * intensity;
      const life = 0;
      const maxLife = 24 + Math.random() * 22;
      const vy = -1 * (8.5 + Math.random() * 7.5 * intensity);
      const vx = (Math.random() - 0.5) * 2.5;

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
        swaySpeed: 0.08 + Math.random() * 0.08,
      };
    };

    const createSpark = (intensity: number): SparkParticle => {
      const spread = width * 0.52;
      const x = width / 2 + (Math.random() - 0.5) * spread;
      const y = height - 50 - Math.random() * 30;
      const size = 1.5 + Math.random() * 2.5;
      const maxLife = 30 + Math.random() * 40;
      const vy = -1 * (9.0 + Math.random() * 8.0 * intensity);
      const vx = (Math.random() - 0.5) * 4.0;

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

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Read real-time Kick intensity (0.0 to 1.0)
      const flameContainer = document.getElementById('cyber-album-flame');
      const kickIntensity = flameContainer
        ? parseFloat(flameContainer.getAttribute('data-kick') || '0')
        : 0;

      // PURE KICK-ONLY: Only spawn flames when a real kick beat hits (kickIntensity > 0.08)
      const hasActiveKick = isPlaying && kickIntensity > 0.08;

      if (hasActiveKick) {
        const spawnCount = Math.floor(4 + kickIntensity * 8);
        for (let i = 0; i < spawnCount; i++) {
          if (flameParticles.length < maxFlames) {
            flameParticles.push(createFlame(kickIntensity));
          }
        }

        const sparkCount = Math.floor(2 + kickIntensity * 4);
        for (let i = 0; i < sparkCount; i++) {
          if (sparks.length < maxSparks) {
            sparks.push(createSpark(kickIntensity));
          }
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // 1. Draw Volumetric Plasma Core only on active kick punch
      if (hasActiveKick) {
        const baseGlow = ctx.createRadialGradient(
          width / 2,
          height - 45,
          10,
          width / 2,
          height - 45,
          140 * kickIntensity
        );
        baseGlow.addColorStop(0, `rgba(255, 255, 230, ${0.95 * kickIntensity})`);
        baseGlow.addColorStop(0.25, `rgba(255, 160, 0, ${0.85 * kickIntensity})`);
        baseGlow.addColorStop(0.60, `rgba(255, 45, 0, ${0.50 * kickIntensity})`);
        baseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = baseGlow;
        ctx.beginPath();
        ctx.ellipse(width / 2, height - 45, 160 * kickIntensity, 65 * kickIntensity, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Update & Draw Rising Dynamic Flame Tongues
      for (let i = flameParticles.length - 1; i >= 0; i--) {
        const p = flameParticles[i];
        p.life++;
        p.swayOffset += p.swaySpeed;

        const progress = p.life / p.maxLife;
        if (progress >= 1.0) {
          flameParticles.splice(i, 1);
          continue;
        }

        // Upward turbulent velocity
        p.x += p.vx + Math.sin(p.swayOffset) * 1.6;
        p.y += p.vy;
        p.vy *= 0.98;

        // Convergence toward top center
        const centerDist = width / 2 - p.x;
        p.x += centerDist * 0.02;

        const curSize = p.maxSize * (1.0 - progress * 0.70);
        p.heat = 1.0 - progress;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, curSize);

        if (p.heat > 0.65) {
          // White-hot core
          const alpha = 1.0 - (progress * 0.25);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          grad.addColorStop(0.35, `rgba(255, 215, 40, ${alpha * 0.95})`);
          grad.addColorStop(0.70, `rgba(255, 75, 0, ${alpha * 0.70})`);
          grad.addColorStop(1, 'rgba(255, 20, 0, 0)');
        } else if (p.heat > 0.3) {
          // Vivid Orange
          const alpha = (1.0 - progress) * 0.85;
          grad.addColorStop(0, `rgba(255, 185, 20, ${alpha})`);
          grad.addColorStop(0.45, `rgba(255, 50, 0, ${alpha * 0.80})`);
          grad.addColorStop(0.85, `rgba(180, 10, 0, ${alpha * 0.35})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          // Fiery Crimson Tip
          const alpha = (1.0 - progress) * 0.40;
          grad.addColorStop(0, `rgba(240, 40, 0, ${alpha})`);
          grad.addColorStop(0.65, `rgba(130, 10, 0, ${alpha * 0.35})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, curSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Update & Draw Ember Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life++;
        const prog = s.life / s.maxLife;

        if (prog >= 1.0) {
          sparks.splice(i, 1);
          continue;
        }

        s.x += s.vx + (Math.random() - 0.5) * 1.8;
        s.y += s.vy;
        s.vy *= 0.985;
        s.alpha = (1.0 - prog) * (0.6 + Math.random() * 0.4);

        const sparkGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2);
        sparkGrad.addColorStop(0, `rgba(255, 255, 255, ${s.alpha})`);
        sparkGrad.addColorStop(0.4, `rgba(255, 190, 20, ${s.alpha * 0.9})`);
        sparkGrad.addColorStop(0.8, `rgba(255, 45, 0, ${s.alpha * 0.4})`);
        sparkGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = sparkGrad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animIdRef.current = requestAnimationFrame(render);
    };

    animIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [isPlaying]);

  return (
    <div
      id="cyber-album-flame"
      data-kick="0"
      className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[520px] h-[620px] max-w-[160%] pointer-events-none select-none z-0 overflow-visible"
    >
      <canvas
        ref={canvasRef}
        width={520}
        height={620}
        className="w-full h-full object-contain pointer-events-none select-none"
      />
    </div>
  );
}
