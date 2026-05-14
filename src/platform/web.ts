import type { Application } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH, MAX_PIXEL_RATIO } from './constants';
import type { MainCanvasResult, Platform, SafeAreaInsets } from './types';

function capDpr(raw: number): number {
  return Math.min(Math.max(raw || 1, 1), MAX_PIXEL_RATIO);
}

export function createWebPlatform(): Platform {
  return {
    kind: 'web',

    getPixelRatio() {
      return capDpr(globalThis.devicePixelRatio ?? 1);
    },

    getSafeAreaInsets(): SafeAreaInsets {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    },

    getDesignSize() {
      return { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
    },

    mountMainCanvas(appHost: HTMLElement | null): MainCanvasResult {
      const host = appHost ?? document.body;
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width || window.innerWidth));
      const h = Math.max(1, Math.floor(rect.height || window.innerHeight));
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      host.appendChild(canvas);
      return { canvas, screenWidth: w, screenHeight: h };
    },

    attachView(app: Application) {
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.touchAction = 'none';
    },

    subscribeTouches(_canvas, _handler) {
      return () => {};
    },
  };
}
