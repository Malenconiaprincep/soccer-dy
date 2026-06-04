import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode !== 'douyin') {
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
    build: {
      outDir: 'douyin-game',
      emptyOutDir: true,
      target: 'es2018',
      minify: false,
      sourcemap: false,
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
