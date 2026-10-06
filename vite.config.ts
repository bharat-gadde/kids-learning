import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site under /<repo>/; the deploy workflow sets BASE_PATH. The app builds URLs as
// import.meta.env.BASE_URL + 'art/…', so the base must end in a slash.
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true, // lets @testing-library/react clean up after each test; tests still import from vitest
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
});
