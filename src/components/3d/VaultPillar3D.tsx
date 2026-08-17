'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Image as DreiImage } from '@react-three/drei';
import * as THREE from 'three';
import { Album } from '@/types/database';

interface VaultPillar3DProps {
  albums: Album[];
  onSelectAlbum: (album: Album) => void;
}

function AlbumCard3D({
  album,
  index,
  totalAlbums,
  scrollPosRef,
  onSelectAlbum,
}: {
  album: Album;
  index: number;
  totalAlbums: number;
  scrollPosRef: React.MutableRefObject<number>;
  onSelectAlbum: (album: Album) => void;
}) {
  const cardGroupRef = useRef<THREE.Group>(null!);
  const vinylRef = useRef<THREE.Group>(null!);
  const imageRef = useRef<any>(null!);
  const titleTextRef = useRef<any>(null!);
  const subTextRef = useRef<any>(null!);
  const frameMatRef = useRef<THREE.MeshStandardMaterial>(null!);

  const [hovered, setHovered] = useState(false);
  const { pointer } = useThree();

  const ITEM_SPACING = 4.4;
  const safeTotalAlbums = Math.max(1, totalAlbums);
  const TOTAL_HEIGHT = safeTotalAlbums * ITEM_SPACING;

  useFrame((_, delta) => {
    if (!cardGroupRef.current) return;

    // Calculate wrapped Y position for continuous infinite loop scroll
    const scrollPos = scrollPosRef.current;
    const rawY = -index * ITEM_SPACING + scrollPos;

    let wrappedY = ((rawY % TOTAL_HEIGHT) + TOTAL_HEIGHT) % TOTAL_HEIGHT;
    if (wrappedY > TOTAL_HEIGHT / 2) {
      wrappedY -= TOTAL_HEIGHT;
    }

    const distFromCenter = wrappedY;
    const absDist = Math.abs(distFromCenter);

    // Off-screen Culling: hide cards far from center to save GPU draw calls
    if (absDist > 3.8) {
      cardGroupRef.current.visible = false;
      return;
    }
    cardGroupRef.current.visible = true;

    // Dynamic Opacity & Fade Calculations
    const targetOpacity = Math.max(0.0, Math.min(1.0, 1.2 - Math.pow(absDist / 2.2, 1.5)));

    // 3D Transforms
    const targetZ = 0.6 - Math.min(3.0, Math.pow(absDist / 2.5, 1.8) * 1.2);
    const targetRotX = -distFromCenter * 0.05 + (hovered ? -pointer.y * 0.35 : 0);
    const targetRotY = hovered ? pointer.x * 0.35 : 0;
    const targetScale = hovered ? 1.15 : Math.max(0.85, 1.0 - absDist * 0.08);

    // Apply smooth Lerp 3D Transforms at 60 FPS (delta-capped for stability)
    const safeDelta = Math.min(delta, 0.1);
    cardGroupRef.current.position.y = THREE.MathUtils.lerp(cardGroupRef.current.position.y, wrappedY + 0.3, safeDelta * 10);
    cardGroupRef.current.position.z = THREE.MathUtils.lerp(cardGroupRef.current.position.z, targetZ, safeDelta * 10);
    cardGroupRef.current.rotation.x = THREE.MathUtils.lerp(cardGroupRef.current.rotation.x, targetRotX, safeDelta * 8);
    cardGroupRef.current.rotation.y = THREE.MathUtils.lerp(cardGroupRef.current.rotation.y, targetRotY, safeDelta * 8);
    cardGroupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), safeDelta * 10);

    // Apply Opacity Fade to Materials
    if (frameMatRef.current) {
      frameMatRef.current.transparent = true;
      frameMatRef.current.opacity = THREE.MathUtils.lerp(frameMatRef.current.opacity, targetOpacity, safeDelta * 10);
    }
    if (imageRef.current?.material) {
      imageRef.current.material.transparent = true;
      imageRef.current.material.opacity = THREE.MathUtils.lerp(imageRef.current.material.opacity, targetOpacity, safeDelta * 10);
    }
    if (titleTextRef.current) {
      titleTextRef.current.fillOpacity = THREE.MathUtils.lerp(titleTextRef.current.fillOpacity, targetOpacity, safeDelta * 10);
    }
    if (subTextRef.current) {
      subTextRef.current.fillOpacity = THREE.MathUtils.lerp(subTextRef.current.fillOpacity, targetOpacity, safeDelta * 10);
    }

    // 3D Vinyl Record sliding out & spinning on hover
    if (vinylRef.current) {
      const targetVinylX = hovered ? 1.5 : 0;
      vinylRef.current.position.x = THREE.MathUtils.lerp(vinylRef.current.position.x, targetVinylX, safeDelta * 8);
      if (hovered) {
        vinylRef.current.rotation.z -= safeDelta * 4.0;
      }
    }
  });

  return (
    <group
      ref={cardGroupRef}
      position={[0, -index * ITEM_SPACING + 0.3, 0]}
      onClick={() => onSelectAlbum(album)}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        if (typeof document !== 'undefined') document.body.style.cursor = 'default';
      }}
    >
      {/* 3D Metallic Case Frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.5, 2.5, 0.12]} />
        <meshStandardMaterial
          ref={frameMatRef}
          color={hovered ? '#ffffff' : '#141414'}
          roughness={0.15}
          metalness={0.85}
          emissive={hovered ? '#ffffff' : '#050505'}
          emissiveIntensity={hovered ? 0.6 : 0.1}
        />
      </mesh>

      {/* 3D Spinning Vinyl Record - ONLY VISIBLE ON HOVER */}
      <group ref={vinylRef} position={[0, 0, -0.02]} visible={hovered}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.05, 1.05, 0.03, 32]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.01, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
      </group>

      {/* FULL COLOR High Quality Album Cover Art */}
      <DreiImage
        ref={imageRef}
        url={album.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000'}
        scale={[2.35, 2.35]}
        position={[0, 0, 0.07]}
        grayscale={0}
      />

      {/* BOLD Album Title Underneath */}
      <Text
        ref={titleTextRef}
        position={[0, -1.55, 0.12]}
        fontSize={0.28}
        color={hovered ? '#ffffff' : '#f0f0f0'}
        anchorX="center"
        anchorY="top"
        fontWeight="bold"
      >
        {album.title.toUpperCase()}
      </Text>

      {/* Subtitle / Artist */}
      <Text
        ref={subTextRef}
        position={[0, -1.95, 0.12]}
        fontSize={0.14}
        color={hovered ? '#ffffff' : '#999999'}
        anchorX="center"
        anchorY="top"
      >
        {album.artist.toUpperCase()}
      </Text>
    </group>
  );
}

export function VaultPillar3DScene({ albums, onSelectAlbum }: VaultPillar3DProps) {
  const containerGroupRef = useRef<THREE.Group>(null!);
  const scrollPosRef = useRef(0);
  const targetScrollY = useRef(0);
  const ITEM_SPACING = 4.4;

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 30;
      else if (e.deltaMode === 2) delta *= 250;

      const step = (delta > 0 ? 1 : -1) * Math.min(Math.abs(delta * 0.015), ITEM_SPACING * 0.85);
      targetScrollY.current += step;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        targetScrollY.current += ITEM_SPACING;
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        targetScrollY.current -= ITEM_SPACING;
      }
    };

    let isDragging = false;
    let startY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' || (e.target as HTMLElement)?.tagName === 'A') return;
      isDragging = true;
      startY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      startY = e.clientY;
      const step = deltaY * 0.018;
      targetScrollY.current += step;
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [albums.length]);

  useFrame((_, delta) => {
    const safeDelta = Math.min(delta, 0.1);
    scrollPosRef.current = THREE.MathUtils.lerp(scrollPosRef.current, targetScrollY.current, safeDelta * 10);
  });

  return (
    <group ref={containerGroupRef} position={[0, 0, 0]}>
      {albums.map((album, index) => (
        <AlbumCard3D
          key={album.id}
          album={album}
          index={index}
          totalAlbums={albums.length}
          scrollPosRef={scrollPosRef}
          onSelectAlbum={onSelectAlbum}
        />
      ))}
    </group>
  );
}

export default function VaultPillar3D({ albums, onSelectAlbum }: VaultPillar3DProps) {
  // Clamped DPR (Max 1.5 on Mobile, Max 2.0 on Desktop) to prevent Retina 3x GPU lag
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  const dprRange: [number, number] = useMemo(() => [1, isMobile ? 1.5 : 2.0], [isMobile]);

  return (
    <div className="w-full h-full absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 8.5], fov: 45 }}
        dpr={dprRange}
        gl={{
          antialias: !isMobile,
          powerPreference: 'high-performance',
          alpha: true,
          stencil: false,
          depth: true,
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 7]} intensity={1.2} />
        <pointLight position={[-5, -5, 5]} intensity={0.5} color="#3b82f6" />
        <VaultPillar3DScene albums={albums} onSelectAlbum={onSelectAlbum} />
      </Canvas>
    </div>
  );
}
