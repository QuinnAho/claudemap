import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const buildConfigPath = fileURLToPath(new URL('./.claudemap-build.json', import.meta.url));
const buildOverrides = fs.existsSync(buildConfigPath)
  ? JSON.parse(fs.readFileSync(buildConfigPath, 'utf8'))
  : null;

export default defineConfig({
  base: buildOverrides?.base || '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: buildOverrides?.outDir || 'dist',
    emptyOutDir: Boolean(buildOverrides?.emptyOutDir),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@xyflow/react') || id.includes('elkjs')) {
            return 'graph-vendor';
          }

          if (
            id.includes('react-dom') ||
            id.includes('/node_modules/react/') ||
            id.includes('\\node_modules\\react\\') ||
            id.includes('lucide-react') ||
            id.includes('zustand')
          ) {
            return 'app-vendor';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
});
