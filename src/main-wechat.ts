import { installWeChatAdapter } from './adapter/wechat';

installWeChatAdapter();
void import('./bootstrap').then((m) => m.bootstrap('wechat'));
