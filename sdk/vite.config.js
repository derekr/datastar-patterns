import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

// Multi-entry lib build. Heavy deps (msw, and later sqlite/ts/editor)
// stay external or behind their own entries — never in core.
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(root, 'src/index.js'),
        http: resolve(root, 'src/http.js'),
        sse: resolve(root, 'src/sse.js'),
        bus: resolve(root, 'src/bus.js'),
        element: resolve(root, 'src/element.js'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^msw(\/.*)?$/],
    },
    outDir: 'dist',
  },
});
