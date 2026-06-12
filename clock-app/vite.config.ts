import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    cssMinify: true,
    // es2015 is the minimum target esbuild supports for let/const transformation
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Ensure esbuild downgrades modern JS syntax
  esbuild: {
    target: 'es2015',
  },
})
