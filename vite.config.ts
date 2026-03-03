/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages base is injected via env on CI.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE ?? '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
