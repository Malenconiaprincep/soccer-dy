import type { Application } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH, MAX_PIXEL_RATIO } from './constants';
import type { MainCanvasResult, Platform, SafeAreaInsets } from './types';

function capDpr(raw: number): number {
  return Math.min(Math.max(raw || 1, 1), MAX_PIXEL_RATIO);
}

function assertTt(): NonNullable<typeof tt> {
  if (typeof tt === 'undefined') {
    throw new Error('当前非抖音小游戏运行环境：请在抖音开发者工具中打开 build/douyin');
  }
  return tt;
}

export function createDouyinPlatform(): Platform {
  return {
    kind: 'douyin',

    getPixelRatio() {
      const info = assertTt().getSystemInfoSync();
      return capDpr(info.pixelRatio ?? 1);
    },

    getSafeAreaInsets(): SafeAreaInsets {
      const info = assertTt().getSystemInfoSync();
      const sw = info.screenWidth;
      const sh = info.screenHeight;
      const s = info.safeArea;
      if (!s) {
        return { top: 0, right: 0, bottom: 0, left: 0 };
      }
      return {
        top: s.top,
        left: s.left,
        right: sw - s.right,
        bottom: sh - s.bottom,
      };
    },

    getDesignSize() {
      return { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
    },

    mountMainCanvas(_appHost: HTMLElement | null): MainCanvasResult {
      const api = assertTt();
      const info = api.getSystemInfoSync();
      const canvas = api.createCanvas();
      return {
        canvas,
        screenWidth: info.screenWidth,
        screenHeight: info.screenHeight,
      };
    },

    attachView(_app: Application) {
      // 主画布由运行时展示
    },

    subscribeTouches(canvas, handler) {
      const api = assertTt();
      const map = (kind: 'start' | 'move' | 'end' | 'cancel', e: MinigameTouchEvent) => {
        const t = e.changedTouches[0] ?? e.touches[0];
        if (!t) return;
        const rect = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 };
        const scaleX = canvas.width / (rect.width || canvas.width);
        const scaleY = canvas.height / (rect.height || canvas.height);
        const x = (t.clientX - (rect.left ?? 0)) * scaleX;
        const y = (t.clientY - (rect.top ?? 0)) * scaleY;
        handler(kind, x, y);
      };
      api.onTouchStart?.((e) => map('start', e));
      api.onTouchMove?.((e) => map('move', e));
      api.onTouchEnd?.((e) => map('end', e));
      api.onTouchCancel?.((e) => map('cancel', e));
      return () => {};
    },
  };
}
