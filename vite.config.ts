import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves a project site under /<repo>/; the deploy workflow sets BASE_PATH. The app builds URLs as
// import.meta.env.BASE_URL + 'art/…', so the base must end in a slash.
const basePath = process.env.BASE_PATH || '/';

export default defineConfig(({ mode }) => ({
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
  plugins: [
    react(),
    // npm run dev:tablet — https on the local network, which the tablet needs (crypto.randomUUID, the service worker)
    ...(mode === 'tablet' ? [basicSsl()] : []),
    // spec §11: installable, full screen, offline; every picture, font and voice clip is cached on first load
    ...(process.env.VITEST ? [] : [VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Buddy',
        short_name: 'Buddy',
        description: 'A learning game for Lower KG, with Buddy the baby elephant',
        lang: 'en',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#f6efe2',
        theme_color: '#f6efe2',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,mp3}'],
        navigateFallback: 'index.html',
      },
    })]),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    globals: true, // lets @testing-library/react clean up after each test; tests still import from vitest
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
}));
