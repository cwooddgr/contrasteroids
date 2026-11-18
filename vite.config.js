import { defineConfig } from 'vite';

// Relative base so the build can be hosted from any path. Safari 15 is the
// floor because the arcade iMac's system WebKit (macOS 12, used by the
// arcade/ wrapper) can't parse class static blocks, which three.js uses.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 800, target: ['es2020', 'safari15'] },
});
