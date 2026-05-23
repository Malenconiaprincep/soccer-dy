import { Container, Graphics } from 'pixi.js';
import type { GameApp } from '../GameApp';
import type { Scene } from '../types';
import { coverSprite, label, palette } from '../ui';

export const PAGE_BG = '/assets/page-bg.jpg';

export abstract class BaseScene implements Scene {
  readonly container = new Container();

  constructor(protected readonly game: GameApp) {}

  enter() {
    this.game.root.addChild(this.container);
    this.build();
  }

  update(_deltaMs: number) {}

  exit() {
    this.container.destroy({ children: true });
  }

  resize(_width: number, _height: number) {}

  protected abstract build(): void;

  protected stadiumBackground() {
    const w = this.game.width;
    const h = this.game.height;
    const bg = new Container();
    bg.addChild(coverSprite(PAGE_BG, w, h));
    const shade = new Graphics();
    shade.rect(0, 0, w, h);
    shade.fill({ color: 0x020613, alpha: 0.08 });
    shade.rect(0, 0, w, h * 0.18);
    shade.fill({ color: 0x020613, alpha: 0.12 });
    shade.rect(0, h * 0.72, w, h * 0.28);
    shade.fill({ color: 0x020613, alpha: 0.16 });
    bg.addChild(shade);
    return bg;
  }

  protected title(text: string, y = 28) {
    const t = label(text, 28, palette.white, '900');
    t.anchor.set(0.5, 0);
    t.x = this.game.width / 2;
    t.y = y;
    this.container.addChild(t);
    return t;
  }
}
