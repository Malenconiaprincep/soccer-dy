import { createDouyinPlatform } from './douyin';
import { createWeChatPlatform } from './wechat';
import { createWebPlatform } from './web';
import type { Platform, RuntimeKind } from './types';

export type { Platform, RuntimeKind, SafeAreaInsets } from './types';
export { DESIGN_HEIGHT, DESIGN_SCALE_MODE, DESIGN_WIDTH, MAX_PIXEL_RATIO } from './constants';

export function createPlatform(kind: RuntimeKind): Platform {
  switch (kind) {
    case 'web':
      return createWebPlatform();
    case 'wechat':
      return createWeChatPlatform();
    case 'douyin':
      return createDouyinPlatform();
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
