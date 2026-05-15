import { Assets, type Texture } from 'pixi.js';
import urlBall from '../assets/game/ball.png';
import urlBgMainMenu from '../assets/game/bg_main_menu.png';
import urlPitch from '../assets/game/pitch_topdown.png';

export type GameArt = {
  bgMainMenu: Texture;
  pitch: Texture;
  ball: Texture;
};

export async function loadGameArt(onPhase?: (t: number, label: string) => void): Promise<GameArt> {
  const phase = (t: number, label: string) => onPhase?.(t, label);

  phase(0.08, '加载菜单背景…');
  const bgMainMenu = await Assets.load<Texture>(urlBgMainMenu);
  phase(0.38, '加载球场贴图…');
  const pitch = await Assets.load<Texture>(urlPitch);
  phase(0.68, '加载足球贴图…');
  const ball = await Assets.load<Texture>(urlBall);
  phase(1, '素材就绪');
  return { bgMainMenu, pitch, ball };
}
