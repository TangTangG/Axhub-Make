import path from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, 'dist/admin/assets'),
    emptyOutDir: false,
    copyPublicDir: false,
    minify: true,
    lib: {
      entry: path.resolve(__dirname, 'src/axure-export-runtime.ts'),
      formats: ['es'],
      fileName: () => 'axure-export-runtime.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'axure-export-runtime.js',
      },
    },
  },
});
