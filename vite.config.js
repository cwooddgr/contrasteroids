import { defineConfig } from 'vite';

// Relative base so the build can be hosted from any path.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 800 } });
