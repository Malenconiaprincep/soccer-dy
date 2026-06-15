import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function copyDouyinProjectFiles(): Plugin {
  return {
    name: 'copy-douyin-project-files',
    closeBundle() {
      const files = [
        ['game.json', 'game.json'],
        ['project.config.json', 'project.config.json'],
        ['assets/audio/button-click.wav', 'assets/audio/button-click.wav']
      ] as const;
      for (const [fromFile, toFile] of files) {
        const from = resolve('public', fromFile);
        const to = resolve('douyin-game', toFile);
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
