import { Graphics } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { coverSprite, headerTitleSprite, label, palette } from '../ui';

const LOADING_BG = '/assets/loading-bg.png';

export class LoadingScene extends BaseScene {
  private progress = 0;
  private bar?: Graphics;

  protected build() {
    this.container.addChild(coverSprite(LOADING_BG, this.game.width, this.game.height));

    const logo = headerTitleSprite('championRoad', Math.min(360, this.game.width * 0.6));
    logo.x = this.game.width / 2 - logo.width / 2;
    logo.y = this.game.height * 0.39;
    const tip = label('正在进入球场...', 20, palette.muted);
    tip.anchor.set(0.5);
    tip.x = this.game.width / 2;
    tip.y = this.game.height * 0.51;
    this.bar = new Graphics();
    this.container.addChild(logo, tip, this.bar);
    this.drawAntiAddictionNotice();
  }

  update(deltaMs: number) {
    if (this.game.isLoadingHeldForDebug()) {
      this.progress = 0.72;
      this.drawBar();
      return;
    }
    this.progress = Math.min(1, this.progress + deltaMs / 1600);
    this.drawBar();
    if (this.progress >= 1) {
      this.game.changeScene('home');
    }
  }

  resize() {
    this.container.removeChildren();
    this.build();
    this.drawBar();
  }

  private drawBar() {
    if (!this.bar) return;
    const w = Math.min(360, this.game.width * 0.68);
    const x = (this.game.width - w) / 2;
    const y = this.game.height * 0.58;
    this.bar.clear();
    this.bar.roundRect(x, y, w, 18, 9);
    this.bar.fill({ color: 0x101a40, alpha: 0.9 });
    this.bar.roundRect(x + 3, y + 3, (w - 6) * this.progress, 12, 6);
    this.bar.fill(0xffb21a);
  }

  private drawAntiAddictionNotice() {
    const w = Math.min(646, this.game.width - 48);
    const h = 132;
    const panel = new Graphics();
    const x = (this.game.width - w) / 2;
    const y = this.game.height - h - 42;
    panel.roundRect(x, y, w, h, 20);
    panel.fill({ color: 0x030817, alpha: 0.58 });
    panel.stroke({ color: 0x7ca8ff, alpha: 0.22, width: 2 });

    const title = label('防沉迷提示', 22, 0xfff0b3, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = y + 24;

    const line1 = label('抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。', 17, 0xcfe0ff, '700');
    line1.anchor.set(0.5);
    line1.x = this.game.width / 2;
    line1.y = y + 62;

    const line2 = label('适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。', 17, 0xcfe0ff, '700');
    line2.anchor.set(0.5);
    line2.x = this.game.width / 2;
    line2.y = y + 94;

    this.container.addChild(panel, title, line1, line2);
  }
}
