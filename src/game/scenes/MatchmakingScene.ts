import { Container, Graphics, Rectangle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { label, palette } from '../ui';

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
    shade.fill({ color: 0x020613, alpha: 0.24 });
    shade.rect(0, 0, this.game.width, this.game.height * 0.44);
    shade.fill({ color: 0x020613, alpha: 0.34 });
    const glow = new Graphics();
    glow.ellipse(this.game.width / 2, this.game.height * 0.38, this.game.width * 0.62, 230);
    glow.fill({ color: 0x1d8fff, alpha: 0.1 });
    glow.ellipse(this.game.width / 2, this.game.height * 0.74, this.game.width * 0.76, 260);
    glow.fill({ color: 0x38ffba, alpha: 0.07 });
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

    const titleY = 116 + shift;
    const title = label('匹配对手', 48, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = titleY;
    const leftMark = this.titleMark();
    leftMark.x = title.x - 190;
    leftMark.y = titleY + 2;
    const rightMark = this.titleMark(0x21e86d);
    rightMark.scale.x = -1;
    rightMark.x = title.x + 190;
    rightMark.y = titleY + 2;
    this.container.addChild(back, leftMark, rightMark, title);
  }

  private drawSearchPanel() {
    const centerX = this.game.width / 2;
    const spinner = this.searchSpinner(Math.min(126, this.game.width * 0.16));
    spinner.x = centerX;
    spinner.y = this.game.height * 0.34;

    const status = label('正在寻找对手', 44, palette.white, '900');
    status.anchor.set(0.5);
    status.x = centerX;
    status.y = this.game.height * 0.48;
    const hint = label('根据战力与阵型匹配在线玩家', 25, 0x9fffc6, '900');
    hint.anchor.set(0.5);
    hint.x = centerX;
    hint.y = status.y + 52;

    const infoW = Math.min(this.game.width - 92, 668);
    const info = this.matchInfoPanel(infoW, 156);
    info.x = (this.game.width - infoW) / 2;
    info.y = this.game.height * 0.56;

    const cancel = this.cancelButton();
    cancel.x = (this.game.width - 300) / 2;
    cancel.y = info.y + 240;

    const wait = label('预计等待时间', 23, 0xd7e0e8, '900');
    wait.anchor.set(0.5);
    wait.x = centerX - 42;
    wait.y = cancel.y + 132;
    const waitValue = label('00:10', 27, 0x5eff6f, '900');
    waitValue.anchor.set(0.5);
    waitValue.x = centerX + 122;
    waitValue.y = wait.y;
    const note = label('搜索时间过长可尝试更换阵型，可更快匹配', 21, 0xc6d2da, '900');
    note.anchor.set(0.5);
    note.x = centerX;
    note.y = wait.y + 48;

    this.container.addChild(spinner, status, hint, info, cancel, wait, waitValue, note);
  }

  private searchSpinner(radius: number) {
    const c = new Container();
    const outer = new Graphics();
    outer.circle(0, 0, radius + 28);
    outer.stroke({ color: 0x106dff, alpha: 0.55, width: 4 });
    outer.arc(0, 0, radius + 28, -Math.PI * 0.52, Math.PI * 0.1);
    outer.stroke({ color: 0x14a7ff, alpha: 0.95, width: 10 });
    outer.arc(0, 0, radius + 28, Math.PI * 0.22, Math.PI * 0.42);
    outer.stroke({ color: 0x96ff3e, alpha: 0.95, width: 10 });
    const inner = new Graphics();
    inner.circle(0, 0, radius - 4);
    inner.stroke({ color: 0x22bbff, alpha: 0.44, width: 2 });
    const orbit = new Container();
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const dot = new Graphics();
      dot.circle(Math.cos(angle) * radius, Math.sin(angle) * radius, 10);
      dot.fill({ color: i % 4 === 2 ? 0xffe12c : 0x26bfff, alpha: 0.78 });
      orbit.addChild(dot);
    }
    const center = new Graphics();
    center.circle(0, 0, 58);
    center.fill({ color: 0x06162e, alpha: 0.72 });
    center.stroke({ color: 0x1fa8ff, alpha: 0.82, width: 4 });
    const ball = label('VS', 38, 0xffe56a, '900');
    ball.anchor.set(0.5);
    c.addChild(outer, inner, orbit, center, ball);
    this.spinner = orbit;
    return c;
  }

  private titleMark(color = 0x1b72ff) {
    const c = new Container();
    for (let i = 0; i < 3; i += 1) {
      const g = new Graphics();
      g.poly([i * 34, 0, i * 34 + 26, 0, i * 34 + 12, 22, i * 34 - 14, 22]);
      g.fill({ color: i === 2 ? color : 0x1d7dff, alpha: 0.95 });
      c.addChild(g);
    }
    return c;
  }

  private matchInfoPanel(w: number, h: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.poly([28, 0, w - 18, 0, w, 22, w, h - 30, w - 28, h, 0, h, 0, 22]);
    bg.fill({ color: 0x06152d, alpha: 0.84 });
    bg.stroke({ color: 0x1f7bff, alpha: 0.92, width: 4 });
    const shine = new Graphics();
    shine.rect(36, 0, 160, 5);
    shine.fill({ color: 0x24d8ff, alpha: 0.55 });
    c.addChild(bg, shine);

    const formationTitle = label('阵型', 27, 0xffe56a, '900');
    formationTitle.x = 58;
    formationTitle.y = 36;
    const formation = label(this.game.selectedFormation.name, 27, 0xffe56a, '900');
    formation.x = 148;
    formation.y = 36;
    const powerTitle = label('战力', 35, palette.white, '900');
    powerTitle.x = 58;
    powerTitle.y = 84;
    const power = label(String(this.game.lineupPower()), 35, palette.white, '900');
    power.x = 164;
    power.y = 84;
    const mode = label('实时对战准备中', 26, 0x60eeff, '900');
    mode.anchor.set(1, 0);
    mode.x = w - 58;
    mode.y = 68;
    c.addChild(formationTitle, formation, powerTitle, power, mode);
    return c;
  }

  private cancelButton() {
    const btn = new Container();
    const w = 300;
    const h = 78;
    const bg = new Graphics();
    bg.poly([32, 0, w - 32, 0, w, h / 2, w - 32, h, 32, h, 0, h / 2]);
    bg.fill({ color: 0x102a5d, alpha: 0.94 });
    bg.stroke({ color: 0x2b8cff, alpha: 0.86, width: 4 });
    const text = label('取消匹配', 28, palette.white, '900');
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
