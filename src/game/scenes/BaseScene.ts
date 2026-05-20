import { Container, Graphics } from 'pixi.js';
import type { GameApp } from '../GameApp';
import type { Scene } from '../types';
import { coverSprite, label, palette } from '../ui';

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
    bg.addChild(coverSprite('/assets/home-hero-v2.png', w, h));
    const shade = new Graphics();
    shade.rect(0, 0, w, h);
    shade.fill({ color: 0x030817, alpha: 0.58 });
    shade.rect(0, 0, w, h * 0.2);
    shade.fill({ color: 0x030817, alpha: 0.2 });
    shade.rect(0, h * 0.66, w, h * 0.34);
    shade.fill({ color: 0x030817, alpha: 0.28 });
    bg.addChild(shade);
    for (let i = 0; i < 16; i += 1) {
      const light = new Graphics();
      light.circle((w / 15) * i, h * 0.18 + Math.sin(i) * 28, 4);
      light.fill({ color: i % 2 ? 0xfff5bf : 0x92c9ff, alpha: 0.55 });
      bg.addChild(light);
    }
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
