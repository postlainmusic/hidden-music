import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',
    mode: 'advanced',
  }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['three', '@react-three/fiber', '@react-three/drei', 'lucide-react', 'clsx', 'tailwind-merge'],
    },
    optimizeDeps: {
      include: ['three', '@react-three/fiber', '@react-three/drei', 'lucide-react', 'clsx', 'tailwind-merge'],
    },
  },
});
