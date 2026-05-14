/** 微信小游戏全局（运行时存在） */
declare const wx:
  | {
      createCanvas: () => HTMLCanvasElement;
      getSystemInfoSync: () => WechatMinigameSystemInfo;
      onTouchStart?: (cb: (e: MinigameTouchEvent) => void) => void;
      onTouchMove?: (cb: (e: MinigameTouchEvent) => void) => void;
      onTouchEnd?: (cb: (e: MinigameTouchEvent) => void) => void;
      onTouchCancel?: (cb: (e: MinigameTouchEvent) => void) => void;
    }
  | undefined;

/** 抖音 / 字节小游戏全局 */
declare const tt:
  | {
      createCanvas: () => HTMLCanvasElement;
      getSystemInfoSync: () => WechatMinigameSystemInfo;
      onTouchStart?: (cb: (e: MinigameTouchEvent) => void) => void;
      onTouchMove?: (cb: (e: MinigameTouchEvent) => void) => void;
      onTouchEnd?: (cb: (e: MinigameTouchEvent) => void) => void;
      onTouchCancel?: (cb: (e: MinigameTouchEvent) => void) => void;
    }
  | undefined;

interface WechatMinigameSystemInfo {
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  safeArea?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
}

interface MinigameTouchEvent {
  changedTouches: Array<{ clientX: number; clientY: number; identifier: number }>;
  touches: Array<{ clientX: number; clientY: number; identifier: number }>;
}
