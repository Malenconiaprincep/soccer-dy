import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function copyDouyinProjectFiles(): Plugin {
  return {
    name: 'copy-douyin-project-files',
    closeBundle() {
      for (const file of ['game.json', 'project.config.json']) {
        const from = resolve('public', file);
        const to = resolve('douyin-game', file);
        if (!existsSync(from)) continue;
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const isDouyinMode = mode === 'douyin' || mode === 'douyin-debug';
  const isDouyinDebug = mode === 'douyin-debug';

  if (!isDouyinMode) {
    return {
      server: {
        proxy: {
          '/api': 'http://localhost:8787'
        }
      },
      build: {
        rollupOptions: {
          input: {
            game: 'index.html',
            shopAdmin: 'admin/shop.html'
          }
        }
      }
    };
  }

  return {
    publicDir: false,
    define: {
      'import.meta.env.VITE_DOUYIN_DEV_PANEL': JSON.stringify(isDouyinDebug ? '1' : process.env.VITE_DOUYIN_DEV_PANEL ?? '')
    },
    plugins: [copyDouyinProjectFiles()],
    build: {
      outDir: 'douyin-game',
      emptyOutDir: true,
      target: 'es2018',
      minify: false,
      sourcemap: isDouyinDebug,
      rollupOptions: {
        input: 'src/douyin/game.ts',
        output: {
          format: 'iife',
          name: 'SoccerDouyinGame',
          entryFileNames: 'game.js',
          inlineDynamicImports: true
        }
      }
    }
  };
});
