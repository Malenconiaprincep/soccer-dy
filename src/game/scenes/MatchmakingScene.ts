import { Container, Graphics, Rectangle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { glassPanel, label, palette } from '../ui';

export class MatchmakingScene extends BaseScene {
  private elapsed = 0;
  private matched = false;
  private spinner?: Container;

  protected build() {
    this.container.addChild(this.stadiumBackground());
    this.drawShade();
    this.drawHeader();
    this.drawSearchPanel();
  }

  update(deltaMs: number) {
    this.elapsed += deltaMs;
    if (this.spinner) this.spinner.rotation += deltaMs * 0.004;
    if (!this.matched && this.elapsed >= 1800) {
      this.matched = true;
      this.game.prepareOpponent();
      this.game.changeScene('matchup');
    }
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  private drawShade() {
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020613, alpha: 0.48 });
    const glow = new Graphics();
    glow.ellipse(this.game.width / 2, this.game.height * 0.48, this.game.width * 0.72, 210);
    glow.fill({ color: 0x1d8fff, alpha: 0.13 });
    glow.ellipse(this.game.width / 2, this.game.height * 0.7, this.game.width * 0.9, 260);
    glow.fill({ color: 0x38ffba, alpha: 0.08 });
    this.container.addChild(shade, glow);
  }

  private drawHeader() {
    const shift = this.game.contentTopOffset * 0.24;
    const back = label('‹', 64, palette.white, '900');
    back.anchor.set(0.5);
    back.x = 42;
    back.y = 58 + shift;
    back.eventMode = 'static';
    back.cursor = 'pointer';
    back.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('formation');
    });

    const title = label('匹配对手', 46, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = 64 + shift;
    this.container.addChild(back, title);
  }

  private drawSearchPanel() {
    const panelW = Math.min(this.game.width - 72, 620);
    const panelH = 610;
    const panel = new Container();
    panel.x = (this.game.width - panelW) / 2;
    panel.y = Math.max(184, (this.game.height - panelH) / 2);
    panel.addChild(glassPanel(panelW, panelH, 0x071936, 0x56d7ff));

    const spinner = this.searchSpinner(86);
    spinner.x = panelW / 2;
    spinner.y = 118;
    this.spinner = spinner;

    const status = label('正在寻找对手', 36, palette.white, '900');
    status.anchor.set(0.5);
    status.x = panelW / 2;
    status.y = 224;
    const hint = label('根据战力与阵型匹配在线玩家', 21, 0x9fffc6, '900');
    hint.anchor.set(0.5);
    hint.x = panelW / 2;
    hint.y = 263;

    const info = new Container();
    info.x = 42;
    info.y = 312;
    info.addChild(glassPanel(panelW - 84, 126, 0x06142d, 0x2f83d6));
    const formation = label(`阵型  ${this.game.selectedFormation.name}`, 24, 0xffe56a, '900');
    formation.x = 28;
    formation.y = 24;
    const power = label(`战力  ${this.game.lineupPower()}`, 30, palette.white, '900');
    power.x = 28;
    power.y = 66;
    const mode = label('实时对战准备中', 22, 0x6ce8ff, '900');
    mode.anchor.set(1, 0);
    mode.x = panelW - 112;
    mode.y = 48;
    info.addChild(formation, power, mode);

    const cancel = this.cancelButton();
    cancel.x = (panelW - 220) / 2;
    cancel.y = panelH - 92;
    panel.addChild(spinner, status, hint, info, cancel);
    this.container.addChild(panel);
  }

  private searchSpinner(radius: number) {
    const c = new Container();
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const dot = new Graphics();
      dot.circle(Math.cos(angle) * radius, Math.sin(angle) * radius, 7);
      dot.fill({ color: i < 3 ? 0xffd640 : 0x6ce8ff, alpha: 0.35 + i * 0.055 });
      c.addChild(dot);
    }
    const center = new Graphics();
    center.circle(0, 0, 44);
    center.fill({ color: 0x071e41, alpha: 0.9 });
    center.stroke({ color: 0x56d7ff, alpha: 0.8, width: 3 });
    const ball = label('VS', 27, 0xffe56a, '900');
    ball.anchor.set(0.5);
    c.addChild(center, ball);
    return c;
  }

  private cancelButton() {
    const btn = new Container();
    const w = 220;
    const h = 58;
    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 16);
    bg.fill({ color: 0x10234b, alpha: 0.9 });
    bg.stroke({ color: 0x56a8ff, alpha: 0.66, width: 3 });
    const text = label('取消匹配', 24, palette.white, '900');
    text.anchor.set(0.5);
    text.x = w / 2;
    text.y = h / 2;
    btn.addChild(bg, text);
    btn.hitArea = new Rectangle(0, 0, w, h);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('formation');
    });
    return btn;
  }
}
