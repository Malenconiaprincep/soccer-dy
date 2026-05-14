import type { Sprite } from 'pixi.js';

/** 等比放大至铺满矩形，居中裁切（类似 CSS object-fit: cover），不拉伸变形 */
export function fitSpriteCover(sprite: Sprite, boxW: number, boxH: number, anchorCenter = false): void {
  const tw = sprite.texture.width;
  const th = sprite.texture.height;
  if (tw <= 0 || th <= 0) return;
  const s = Math.max(boxW / tw, boxH / th);
  sprite.scale.set(s);
  if (anchorCenter) {
    sprite.anchor.set(0.5, 0.5);
    sprite.x = boxW / 2;
    sprite.y = boxH / 2;
  } else {
    sprite.anchor.set(0, 0);
    sprite.x = (boxW - tw * s) / 2;
    sprite.y = (boxH - th * s) / 2;
  }
}
