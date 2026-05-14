import type { Application } from 'pixi.js';

export type RuntimeKind = 'web' | 'wechat' | 'douyin';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MainCanvasResult {
  canvas: HTMLCanvasElement;
  /** 物理像素画布宽高 */
  screenWidth: number;
  screenHeight: number;
}

export interface Platform {
  readonly kind: RuntimeKind;
  getPixelRatio: () => number;
  getSafeAreaInsets: () => SafeAreaInsets;
  /** 逻辑设计稿尺寸（固定） */
  getDesignSize: () => { width: number; height: number };
  /** 创建或取得主画布，并返回当前屏幕像素尺寸 */
  mountMainCanvas: (appHost: HTMLElement | null) => MainCanvasResult;
  /** 将 Pixi 画布挂到宿主（小游戏可为空操作） */
  attachView: (app: Application) => void;
  /** 小游戏触摸 → 归一化到画布坐标后回调 */
  subscribeTouches: (
    canvas: HTMLCanvasElement,
    handler: (kind: 'start' | 'move' | 'end' | 'cancel', x: number, y: number) => void,
  ) => () => void;
}
