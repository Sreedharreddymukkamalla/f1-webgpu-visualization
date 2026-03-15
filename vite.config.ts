import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: 'public',

  // Serve data directory as static assets
  server: {
    fs: {
      allow: ['..'],
    },
    // Ignore backend directories to prevent crashes during data fetching
    watch: {
      ignored: [
        '**/backend/**',
        '**/node_modules/**',
        '**/.git/**',
      ],
    },
  },

  // Copy data directory to dist on build
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
    // Ensure large assets are handled properly
    assetsInlineLimit: 0,
  },
});
