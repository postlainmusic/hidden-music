'use client';

import { useEffect } from 'react';

export default function CinematicVisualizer() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const wrapper = document.getElementById('cinematic-viewport-wrapper');
      const coverBox = document.getElementById('album-cover-box');
      const vaultBox = document.getElementById('vault-scene-container');
      if (wrapper) wrapper.style.transform = '';
      if (coverBox) coverBox.style.transform = '';
      if (vaultBox) vaultBox.style.transform = '';
    }
  }, []);

  return null;
}
