import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode !== 'douyin') return {};

  return {
    build: {
      outDir: 'douyin-game',
      emptyOutDir: true,
      target: 'es2018',
      minify: false,
      sourcemap: false,
      watch: {
        include: ['src/**', 'public/**']
      },
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
