'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, Stars } from '@react-three/drei';
import VaultPillar3D from './VaultPillar3D';
import { Album } from '@/types/database';

interface VaultSceneProps {
  albums: Album[];
  onSelectAlbum: (album: Album) => void;
}

export default function VaultScene({ albums, onSelectAlbum }: VaultSceneProps) {
  return (
    <div id="vault-scene-container" className="w-full h-full absolute inset-0 z-0 bg-[#000000] transition-transform duration-75 ease-out">
      <Canvas gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}>
        <PerspectiveCamera makeDefault position={[0, 0.3, 7.0]} fov={48} />
        
        {/* Studio 3D Dynamic Monochrome Lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 8, 8]} intensity={2.0} color="#ffffff" />
        <directionalLight position={[-6, -6, -4]} intensity={0.6} color="#888888" />
        <pointLight position={[0, 3, 5]} intensity={2.5} color="#ffffff" />
        <pointLight position={[0, -5, 2]} intensity={1.2} color="#ffffff" />

        <Suspense fallback={null}>
          <VaultPillar3D albums={albums} onSelectAlbum={onSelectAlbum} />
          
          {/* Subtle Star Particles for Depth */}
          <Stars radius={90} depth={50} count={2000} factor={4} saturation={0} fade speed={0.6} />
        </Suspense>
      </Canvas>
    </div>
  );
}
