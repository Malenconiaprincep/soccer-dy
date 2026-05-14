/** 与 docs/DESIGN_PROMPTS.md 一致：手机竖屏逻辑稿（宽 × 高） */
export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1624;

/** pixelRatio 上限，减轻发热与显存 */
export const MAX_PIXEL_RATIO = 2;

/**
 * 画布相对逻辑稿的缩放策略。
 * - `contain`：整稿可见，视口特别「瘦高」时会按宽度缩小，显得字和按钮都很小、上下留白多。
 * - `cover`：铺满视口，常见竖屏上更大；左右或上下可能被裁切（关键 UI 请留在安全区内）。
 */
export const DESIGN_SCALE_MODE: 'contain' | 'cover' = 'cover';
