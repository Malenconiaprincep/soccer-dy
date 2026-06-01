import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { label, palette } from '../ui';

export class MatchmakingScene extends BaseScene {
  private static readonly MATCH_DURATION_MS = 60000;
  private static readonly MATCH_TITLE = '/assets/ui/matchtitle.png';
  private static readonly MATCH_TITLE_FRAME = new Rectangle(140, 280, 768, 111);
  private elapsed = 0;
  private matched = false;
  private spinnerRoot?: Container;
  private blueArc?: Container;
  private greenArc?: Container;
  private orbitDots?: Container;
  private sparkleRing?: Container;
  private centerPulse?: Container;
  private waitValue?: Text;

  protected build() {
    this.container.addChild(this.stadiumBackground());
    this.drawShade();
    this.drawHeader();
    this.drawSearchPanel();
  }

  update(deltaMs: number) {
    this.elapsed += deltaMs;
    const t = this.elapsed * 0.001;
    if (this.spinnerRoot) this.spinnerRoot.scale.set(1 + Math.sin(t * 2.2) * 0.012);
    if (this.blueArc) this.blueArc.rotation += deltaMs * 0.0032;
    if (this.greenArc) this.greenArc.rotation -= deltaMs * 0.00165;
    if (this.orbitDots) this.orbitDots.rotation += deltaMs * 0.00105;
    if (this.sparkleRing) {
      this.sparkleRing.rotation -= deltaMs * 0.0008;
      this.sparkleRing.alpha = 0.45 + Math.sin(t * 3.4) * 0.18;
    }
    if (this.centerPulse) this.centerPulse.scale.set(1 + Math.sin(t * 4.1) * 0.035);
    this.updateWaitValue();
    if (!this.matched && this.elapsed >= MatchmakingScene.MATCH_DURATION_MS) {
      this.matched = true;
      this.game.prepareOpponent();
      this.game.changeScene('matchup');
    }
  }

  resize() {
    this.container.removeChildren();
    this.spinnerRoot = undefined;
    this.blueArc = undefined;
    this.greenArc = undefined;
    this.orbitDots = undefined;
    this.sparkleRing = undefined;
    this.centerPulse = undefined;
    this.waitValue = undefined;
    this.build();
  }

  private drawShade() {
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020613, alpha: 0.2 });
    this.container.addChild(shade);
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

    const titleTexture = Texture.from(MatchmakingScene.MATCH_TITLE);
    const title = new Sprite(new Texture({ source: titleTexture.source, frame: MatchmakingScene.MATCH_TITLE_FRAME }));
    title.anchor.set(0.5);
    title.width = Math.min(this.game.width * 0.62, 420);
    title.height = title.width * (MatchmakingScene.MATCH_TITLE_FRAME.height / MatchmakingScene.MATCH_TITLE_FRAME.width);
    title.x = this.game.width / 2;
    title.y = 124 + shift;
    this.container.addChild(back, title);
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
    const hint = label('正在为你寻找在线玩家', 25, 0x9fffc6, '900');
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
    const waitValue = label('01:00', 27, 0x5eff6f, '900');
    waitValue.anchor.set(0.5);
    waitValue.x = centerX + 122;
    waitValue.y = wait.y;
    this.waitValue = waitValue;
    this.updateWaitValue();
    const note = label('搜索时间过长可尝试更换阵型，可更快匹配', 21, 0xc6d2da, '900');
    note.anchor.set(0.5);
    note.x = centerX;
    note.y = wait.y + 48;

    this.container.addChild(spinner, status, hint, info, cancel, wait, waitValue, note);
  }

  private updateWaitValue() {
    if (!this.waitValue) return;
    const remainingMs = Math.max(0, MatchmakingScene.MATCH_DURATION_MS - this.elapsed);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    this.waitValue.text = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private searchSpinner(radius: number) {
    const c = new Container();
    this.spinnerRoot = c;

    const blueLong = new Container();
    this.arcGlow(blueLong, radius + 34, -Math.PI * 0.05, Math.PI * 0.58, 0x19aaff, 10, 0.96, 13);
    this.arcGlow(blueLong, radius + 34, -Math.PI * 0.08, Math.PI * 0.02, 0x78dfff, 11, 0.78, 16);
    this.blueArc = blueLong;

    const green = new Container();
    this.arcGlow(green, radius + 34, Math.PI * 0.32, Math.PI * 0.53, 0x95ff31, 9, 0.96, 12);
    this.greenArc = green;

    const innerTrack = new Container();
    this.arcGlow(innerTrack, radius - 8, 0, Math.PI * 2, 0x22b9ff, 2, 0.5, 0);
    this.arcGlow(innerTrack, radius - 8, -Math.PI * 0.48, -Math.PI * 0.3, 0x52d8ff, 3, 0.72, 5);

    const orbit = new Container();
    const dotCount = 10;
    for (let i = 0; i < dotCount; i += 1) {
      const angle = (Math.PI * 2 * i) / dotCount - Math.PI / 2;
      const isYellow = i === 2 || i === 7;
      const dot = new Graphics();
      const dotRadius = isYellow ? 10.5 : 10;
      dot.circle(Math.cos(angle) * radius, Math.sin(angle) * radius, dotRadius);
      dot.fill({ color: isYellow ? 0xffdd25 : 0x21b7f4, alpha: 0.92 });
      this.useAdditive(dot);
      orbit.addChild(dot);
    }
    this.orbitDots = orbit;

    const sparkles = new Container();
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16 + (i % 3) * 0.09;
      const distance = radius + 64 + (i % 4) * 9;
      const spark = new Graphics();
      const color = [0x1bbcff, 0xffe22d, 0x79ff38, 0xff377e][i % 4];
      spark.poly([-2, -7, 4, -2, 2, 7, -4, 2]);
      spark.fill({ color, alpha: i % 5 === 0 ? 0.5 : 0.34 });
      spark.x = Math.cos(angle) * distance;
      spark.y = Math.sin(angle) * distance;
      spark.rotation = angle + Math.PI * 0.5;
      this.useAdditive(spark);
      sparkles.addChild(spark);
    }
    this.sparkleRing = sparkles;

    const centerLayer = new Container();
    const center = new Graphics();
    center.circle(0, 0, 58);
    center.fill({ color: 0x061936, alpha: 0.9 });
    center.circle(0, 0, 58);
    center.stroke({ color: 0x28bfff, alpha: 0.94, width: 4 });
    const vs = label('VS', 39, 0xffe45a, '900');
    vs.anchor.set(0.5);
    vs.style.dropShadow = { color: 0x0b0a02, blur: 3, distance: 2, alpha: 0.7, angle: Math.PI / 4 };
    this.centerPulse = centerLayer;
    centerLayer.addChild(center, vs);

    c.addChild(sparkles, innerTrack, orbit, green, blueLong, centerLayer);
    return c;
  }

  private arcGlow(target: Container, radius: number, start: number, end: number, color: number, width: number, alpha: number, glow = 0) {
    if (glow > 0) {
      const halo = new Graphics();
      halo.arc(0, 0, radius, start, end);
      halo.stroke({ color, alpha: alpha * 0.18, width: width + glow * 1.8 });
      this.useAdditive(halo);
      target.addChild(halo);
    }
    const soft = new Graphics();
    soft.arc(0, 0, radius, start, end);
    soft.stroke({ color, alpha: alpha * 0.34, width: width + Math.max(4, glow * 0.45) });
    const core = new Graphics();
    core.arc(0, 0, radius, start, end);
    core.stroke({ color, alpha, width });
    this.useAdditive(soft);
    this.useAdditive(core);
    target.addChild(soft, core);
  }

  private useAdditive(display: Container | Graphics) {
    (display as { blendMode?: string }).blendMode = 'add';
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
