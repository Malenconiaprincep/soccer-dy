import { defineConfig } from 'vite';

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
    define: {
      'import.meta.env.VITE_DOUYIN_DEV_PANEL': JSON.stringify(isDouyinDebug ? '1' : process.env.VITE_DOUYIN_DEV_PANEL ?? '')
    },
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
