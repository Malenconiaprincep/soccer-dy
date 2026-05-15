import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.env.TARGET ?? 'web';

const pkgVersion = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
) as { version?: string };
const appVersion = pkgVersion.version ?? '0.0.0';

export default defineConfig(() => {
  const shared = {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
  };

  if (target === 'web') {
    return {
      base: './',
      ...shared,
    };
  }

  return {
    ...shared,
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
