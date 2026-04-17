import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  findMapById,
  readManifest,
  setActiveMapId,
  writeManifest,
} from '../skill/lib/map-manifest.js';
import { getDefaultProjectRoot } from '../skill/lib/runtime-paths.js';
import { API_ACTIVE_MAP_ENDPOINT } from './src/contracts/paths.js';
import { claudemapTokensPlugin } from './vite/tokens-plugin.js';

const buildConfigPath = fileURLToPath(new URL('./.claudemap-build.json', import.meta.url));
const buildOverrides = fs.existsSync(buildConfigPath)
  ? JSON.parse(fs.readFileSync(buildConfigPath, 'utf8'))
  : null;

async function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function writeJsonResponse(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function claudemapApiPlugin() {
  return {
    name: 'claudemap-api',
    configureServer(server) {
      server.middlewares.use(API_ACTIVE_MAP_ENDPOINT, async (request, response) => {
        if (request.method !== 'POST') {
          writeJsonResponse(response, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const requestBody = await readRequestBody(request);
          const payload = requestBody ? JSON.parse(requestBody) : {};
          const projectRoot = getDefaultProjectRoot();
          const manifest = readManifest(projectRoot);

          if (!findMapById(manifest, payload.mapId)) {
            writeJsonResponse(response, 404, { error: `Unknown ClaudeMap id: ${payload.mapId}` });
            return;
          }

          setActiveMapId(manifest, payload.mapId);
          writeManifest(projectRoot, manifest);
          writeJsonResponse(response, 200, {
            ok: true,
            activeMapId: manifest.activeMapId,
          });
        } catch (error) {
          writeJsonResponse(response, 400, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}

export default defineConfig({
  base: buildOverrides?.base || '/',
  plugins: [claudemapTokensPlugin(), claudemapApiPlugin(), react(), tailwindcss()],
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
