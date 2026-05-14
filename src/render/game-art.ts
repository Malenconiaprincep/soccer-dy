import { Assets, type Texture } from 'pixi.js';
import urlBall from '../assets/game/ball.png';
import urlBgMainMenu from '../assets/game/bg_main_menu.png';
import urlPitch from '../assets/game/pitch_topdown.png';

export type GameArt = {
  bgMainMenu: Texture;
  pitch: Texture;
  ball: Texture;
};

export async function loadGameArt(): Promise<GameArt> {
  const [bgMainMenu, pitch, ball] = await Promise.all([
    Assets.load<Texture>(urlBgMainMenu),
    Assets.load<Texture>(urlPitch),
    Assets.load<Texture>(urlBall),
  ]);
  return { bgMainMenu, pitch, ball };
}
