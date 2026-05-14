import type { Application } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH, MAX_PIXEL_RATIO } from './constants';
import type { MainCanvasResult, Platform, SafeAreaInsets } from './types';

function capDpr(raw: number): number {
  return Math.min(Math.max(raw || 1, 1), MAX_PIXEL_RATIO);
}

function assertWx(): NonNullable<typeof wx> {
  if (typeof wx === 'undefined') {
    throw new Error('当前非微信小游戏运行环境：请在微信开发者工具中打开 build/wechat');
  }
  return wx;
}

export function createWeChatPlatform(): Platform {
  return {
    kind: 'wechat',

    getPixelRatio() {
      const info = assertWx().getSystemInfoSync();
      return capDpr(info.pixelRatio ?? 1);
    },

    getSafeAreaInsets(): SafeAreaInsets {
      const info = assertWx().getSystemInfoSync();
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
      const api = assertWx();
      const info = api.getSystemInfoSync();
      const canvas = api.createCanvas();
      return {
        canvas,
        screenWidth: info.screenWidth,
        screenHeight: info.screenHeight,
      };
    },

    attachView(_app: Application) {
      // 小游戏主画布已由运行时展示，无需挂 DOM
    },

    subscribeTouches(canvas, handler) {
      const api = assertWx();
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
      const s = (e: MinigameTouchEvent) => map('start', e);
      const m = (e: MinigameTouchEvent) => map('move', e);
      const en = (e: MinigameTouchEvent) => map('end', e);
      const c = (e: MinigameTouchEvent) => map('cancel', e);
      api.onTouchStart?.(s);
      api.onTouchMove?.(m);
      api.onTouchEnd?.(en);
      api.onTouchCancel?.(c);
      return () => {
        // 小游戏侧通常无需解绑；保留占位
      };
    },
  };
}
