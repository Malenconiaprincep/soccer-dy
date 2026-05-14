import { installDouyinAdapter } from './adapter/douyin';

installDouyinAdapter();
void import('./bootstrap').then((m) => m.bootstrap('douyin'));
