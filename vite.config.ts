import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.env.TARGET ?? 'web';

export default defineConfig(() => {
  if (target === 'web') {
    return {
      base: './',
    };
  }

  return {
    base: './',
    publicDir: false,
    build: {
      outDir: `build/${target}`,
      emptyOutDir: true,
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        input: path.resolve(__dirname, `src/main-${target}.ts`),
        output: {
          format: 'iife',
          name: 'soccerGame',
          inlineDynamicImports: true,
          entryFileNames: 'game.js',
        },
      },
      target: 'es2020',
    },
  };
});
