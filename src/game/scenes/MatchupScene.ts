import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { LineupSlot, PlayerCardData } from '../types';
import { glassPanel, label, palette, pillButton } from '../ui';

export class MatchupScene extends BaseScene {
  protected build() {
    this.container.addChild(this.stadiumBackground());
    this.drawShade();
    this.drawHeader();
    this.drawTeams();
    this.drawPowerBar();
    this.drawLineupPreview();
    this.drawCoreDuel();
    this.drawActions();
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  private drawShade() {
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020817, alpha: 0.42 });
    const fieldGlow = new Graphics();
    fieldGlow.ellipse(this.game.width / 2, this.game.height * 0.62, this.game.width * 0.92, this.game.height * 0.34);
    fieldGlow.fill({ color: 0x0e6b7d, alpha: 0.08 });
    fieldGlow.ellipse(this.game.width / 2, this.game.height * 0.82, this.game.width * 0.82, this.game.height * 0.26);
    fieldGlow.fill({ color: 0x2b7b38, alpha: 0.06 });
    const top = new Graphics();
    top.rect(0, 0, this.game.width, 210);
    top.fill({ color: 0x020817, alpha: 0.34 });
    this.container.addChild(shade, fieldGlow, top);
  }

  private drawHeader() {
    const shift = this.game.contentTopOffset * 0.18;
    const back = label('‹', 68, palette.white, '900');
    back.anchor.set(0.5);
    back.x = 42;
    back.y = 58 + shift;
    back.eventMode = 'static';
    back.cursor = 'pointer';
    back.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('formation');
    });

    const ghost = label('MATCH', 58, 0x2b4776, '900');
    ghost.anchor.set(0.5);
    ghost.alpha = 0.18;
    ghost.x = this.game.width / 2;
    ghost.y = 62 + shift;

    const title = label('对战', 48, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = 62 + shift;

    const rules = new Container();
    rules.x = this.game.width - 66;
    rules.y = 55 + shift;
    const rulesCircle = new Graphics();
    rulesCircle.circle(0, 0, 25);
    rulesCircle.fill({ color: 0x071735, alpha: 0.82 });
    rulesCircle.stroke({ color: 0x668cff, alpha: 0.46, width: 2 });
    const rulesIcon = label('!', 26, palette.white, '900');
    rulesIcon.anchor.set(0.5);
    rulesIcon.y = -1;
    const rulesText = label('规则说明', 16, 0xd7e5ff, '900');
    rulesText.anchor.set(0.5);
    rulesText.y = 43;
    rules.addChild(rulesCircle, rulesIcon, rulesText);

    this.container.addChild(ghost, back, title, rules);
  }

  private drawTeams() {
    const y = 116 + this.game.contentTopOffset * 0.25;
    const myHero = this.bestPlayers(this.game.lineup)[0];
    const oppHero = this.bestPlayers(this.opponentLineup())[0];
    const left = this.teamHero('我方球队', '蓝焰俱乐部', this.game.selectedFormation.name, myHero, 28, y, false);
    const right = this.teamHero('对手球队', this.game.battleSource.opponentName, this.game.battleSource.opponentFormation?.name ?? '阵型', oppHero, this.game.width - 28, y, true);
    const vsWidth = 128;
    const vsHeight = (vsWidth / 232) * 216;
    const vs = this.vsSprite(vsWidth);
    vs.x = this.game.width / 2 - vsWidth / 2;
    vs.y = y + 66 - vsHeight / 2;
    this.container.addChild(left, right, vs);
  }

  private vsSprite(width: number) {
    const sourceW = 232;
    const sourceH = 216;
    const height = (width / sourceW) * sourceH;
    const sprite = new Sprite(Texture.EMPTY);
    sprite.width = width;
    sprite.height = height;
    void Assets.load<Texture>('/assets/ui/vs.png').then((texture) => {
      if (sprite.destroyed) return;
      sprite.texture = texture;
      sprite.width = width;
      sprite.height = height;
    });
    return sprite;
  }

  private teamHero(titleText: string, club: string, formation: string, player: PlayerCardData | undefined, edgeX: number, y: number, right: boolean) {
    const c = new Container();
    c.x = edgeX;
    c.y = y;
    const avatar = this.avatarFrame(player, 86, right ? 0xffd632 : 0x48dba0);
    avatar.x = right ? -86 : 0;
    avatar.y = 8;
    const title = label(titleText, 28, palette.white, '900');
    title.x = right ? -116 : 110;
    title.y = 26;
    if (right) title.anchor.set(1, 0);
    const sub = label(club, 18, right ? 0xffe6a8 : 0x48dba0, '900');
    sub.x = right ? -116 : 110;
    sub.y = 62;
    if (right) sub.anchor.set(1, 0);
    const score = label(`🏆 ${this.teamTrophy(formation)}`, 22, 0xf8e8af, '900');
    score.x = right ? -116 : 110;
    score.y = 92;
    if (right) score.anchor.set(1, 0);
    c.addChild(avatar, title, sub, score);
    return c;
  }

  private drawPowerBar() {
    const y = 248 + this.game.contentTopOffset * 0.35;
    const w = this.game.width - 40;
    const myPower = this.power(this.game.lineup);
    const oppPower = this.power(this.opponentLineup());
    const total = Math.max(1, myPower + oppPower);
    const leftRatio = Math.max(0.12, Math.min(0.88, myPower / total));

    const panel = new Container();
    panel.x = 20;
    panel.y = y;
    panel.addChild(glassPanel(w, 106, 0x071126, 0x2c78ff));
    const redShade = new Graphics();
    redShade.roundRect(w * 0.5, 0, w * 0.5, 106, 18);
    redShade.fill({ color: 0x3b0b18, alpha: 0.52 });

    const myLabel = label('我方战力', 19, 0xcfe0ff, '900');
    myLabel.x = 22;
    myLabel.y = 20;
    const myValue = label(String(myPower), 36, 0x4d9dff, '900');
    myValue.x = 22;
    myValue.y = 54;
    const oppLabel = label('对方战力', 19, 0xffc8c8, '900');
    oppLabel.anchor.set(1, 0);
    oppLabel.x = w - 22;
    oppLabel.y = 20;
    const oppValue = label(String(oppPower), 36, 0xff7185, '900');
    oppValue.anchor.set(1, 0);
    oppValue.x = w - 22;
    oppValue.y = 54;

    const barX = 150;
    const barY = 50;
    const barW = w - 300;
    const bar = new Graphics();
    bar.roundRect(barX, barY, barW, 20, 10);
    bar.fill({ color: 0x071126, alpha: 0.95 });
    bar.stroke({ color: 0x9dd2ff, alpha: 0.44, width: 2 });
    const leftFill = new Graphics();
    leftFill.roundRect(barX + 4, barY + 4, (barW - 8) * leftRatio, 12, 6);
    leftFill.fill({ color: 0x3294ff, alpha: 0.95 });
    const rightFill = new Graphics();
    rightFill.roundRect(barX + 4 + (barW - 8) * leftRatio, barY + 4, (barW - 8) * (1 - leftRatio), 12, 6);
    rightFill.fill({ color: 0xff4d67, alpha: 0.95 });
    const spark = new Graphics();
    spark.circle(barX + 4 + (barW - 8) * leftRatio, barY + 10, 11);
    spark.fill({ color: 0xffffff, alpha: 0.65 });
    panel.addChild(redShade, myLabel, myValue, oppLabel, oppValue, bar, leftFill, rightFill, spark);
    this.container.addChild(panel);
  }

  private drawLineupPreview() {
    const y = 374 + this.game.contentTopOffset * 0.42;
    const w = (this.game.width - 56) / 2;
    this.drawMiniPitch('我方阵型', this.game.selectedFormation.name, this.game.lineup, 18, y, w, 292, 0x35d49a);
    this.drawMiniPitch('对方阵型', this.game.battleSource.opponentFormation?.name ?? '阵型', this.opponentLineup(), 38 + w, y, w, 292, 0xff4d67);
  }

  private drawMiniPitch(titleText: string, formationName: string, lineup: LineupSlot[], x: number, y: number, w: number, h: number, accent: number) {
    const c = new Container();
    c.x = x;
    c.y = y;
    c.addChild(glassPanel(w, h, 0x06120d, accent));
    const title = label(titleText, 21, palette.white, '900');
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = 24;
    const form = label(formationName, 18, accent === 0xff4d67 ? 0xffd632 : accent, '900');
    form.anchor.set(0.5);
    form.x = w / 2;
    form.y = 50;

    const pitchX = 16;
    const pitchY = 76;
    const pitchW = w - 32;
    const pitchH = h - 96;
    const pitch = new Graphics();
    pitch.roundRect(pitchX, pitchY, pitchW, pitchH, 10);
    pitch.fill({ color: 0x0b3a1d, alpha: 0.78 });
    pitch.stroke({ color: 0xcffff0, alpha: 0.22, width: 2 });
    pitch.moveTo(pitchX, pitchY + pitchH / 2);
    pitch.lineTo(pitchX + pitchW, pitchY + pitchH / 2);
    pitch.stroke({ color: 0xffffff, alpha: 0.14, width: 1 });
    pitch.circle(pitchX + pitchW / 2, pitchY + pitchH / 2, 22);
    pitch.stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
    c.addChild(title, form, pitch);

    lineup.forEach((slot) => {
      const node = this.ratingDot(slot.player, accent);
      node.x = pitchX + 18 + slot.x * (pitchW - 36);
      node.y = pitchY + 18 + slot.y * (pitchH - 36);
      c.addChild(node);
    });
    this.container.addChild(c);
  }

  private ratingDot(player: PlayerCardData | undefined, fallbackColor: number) {
    const c = new Container();
    const color = player?.color ?? fallbackColor;
    const dot = new Graphics();
    dot.circle(0, 0, 13);
    dot.fill({ color, alpha: 0.95 });
    dot.stroke({ color: 0xffffff, alpha: 0.8, width: 2 });
    const rating = label(player ? String(player.rating) : '+', 12, palette.white, '900');
    rating.anchor.set(0.5);
    c.addChild(dot, rating);
    return c;
  }

  private drawCoreDuel() {
    const y = Math.min(this.game.height - 258, 690 + this.game.contentTopOffset * 0.35);
    const w = this.game.width - 40;
    const h = 218;
    const myCore = this.bestPlayers(this.game.lineup)[0];
    const oppCore = this.bestPlayers(this.opponentLineup())[0];
    const panel = new Container();
    panel.x = 20;
    panel.y = y;
    panel.addChild(glassPanel(w, h, 0x071126, 0x315fff));
    const title = label('核心对位', 22, 0xfff0b3, '900');
    title.x = 18;
    title.y = 14;
    const left = this.coreCard(myCore, 26, 50, 0x318dff, false);
    const right = this.coreCard(oppCore, w - 26, 50, 0xff4d67, true);
    const vs = label('VS', 42, palette.white, '900');
    vs.anchor.set(0.5);
    vs.x = w / 2;
    vs.y = 82;
    panel.addChild(title, left, right, vs);
    this.drawStatRow(panel, '进攻', myCore?.attack ?? 0, oppCore?.attack ?? 0, 38, 126, w - 76);
    this.drawStatRow(panel, '中场', myCore?.speed ?? 0, oppCore?.speed ?? 0, 38, 164, w - 76);
    this.drawStatRow(panel, '防守', myCore?.defense ?? 0, oppCore?.defense ?? 0, 38, 202, w - 76);
    this.container.addChild(panel);
  }

  private coreCard(player: PlayerCardData | undefined, x: number, y: number, accent: number, right: boolean) {
    const c = new Container();
    c.x = x;
    c.y = y;
    const boxW = 154;
    const bg = new Graphics();
    bg.roundRect(right ? -boxW : 0, 0, boxW, 64, 10);
    bg.fill({ color: 0x071126, alpha: 0.9 });
    bg.stroke({ color: accent, alpha: 0.72, width: 2 });
    const avatar = this.squarePortrait(player, 54);
    avatar.x = right ? -boxW + 6 : 6;
    avatar.y = 5;
    const rating = label(player ? String(player.rating) : '--', 25, palette.white, '900');
    rating.x = right ? -72 : 68;
    rating.y = 8;
    if (right) rating.anchor.set(1, 0);
    const name = label(player?.name ?? '待定', 18, palette.white, '900');
    name.x = right ? -72 : 104;
    name.y = 12;
    if (right) name.anchor.set(1, 0);
    const role = label(player ? `${player.position} · ${player.role}` : '核心球员', 14, 0xcfe0ff, '700');
    role.x = right ? -72 : 68;
    role.y = 40;
    if (right) role.anchor.set(1, 0);
    c.addChild(bg, avatar, rating, name, role);
    return c;
  }

  private drawStatRow(parent: Container, title: string, leftValue: number, rightValue: number, x: number, y: number, w: number) {
    const max = Math.max(1, leftValue, rightValue);
    const leftW = (w * 0.36 * leftValue) / max;
    const rightW = (w * 0.36 * rightValue) / max;
    const left = label(String(leftValue), 20, 0x5ca6ff, '900');
    left.x = x;
    left.y = y - 10;
    const text = label(title, 18, palette.white, '900');
    text.anchor.set(0.5);
    text.x = x + w / 2;
    text.y = y;
    const right = label(String(rightValue), 20, 0xff7185, '900');
    right.anchor.set(1, 0);
    right.x = x + w;
    right.y = y - 10;
    const lb = new Graphics();
    lb.roundRect(x + 74, y - 2, leftW, 10, 5);
    lb.fill({ color: 0x3294ff, alpha: 0.92 });
    const rb = new Graphics();
    rb.roundRect(x + w - 74 - rightW, y - 2, rightW, 10, 5);
    rb.fill({ color: 0xff4d67, alpha: 0.92 });
    parent.addChild(left, lb, text, rb, right);
  }

  private drawActions() {
    const y = this.game.height - 104;
    const left = this.circleAction('战术设置', '⚙', 76, y + 36, 0x103c86);
    left.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('formation');
    });
    const right = this.circleAction('更换阵容', '▣', this.game.width - 76, y + 36, 0x103c86);
    right.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('formation');
    });

    const buttonW = Math.min(350, this.game.width - 178);
    const btn = pillButton(buttonW, 76, '开始比赛', '消耗体力：⚡ x5', palette.gold);
    btn.x = (this.game.width - buttonW) / 2;
    btn.y = y;
    btn.on('pointertap', () => {
      this.game.sound.play('kickoff');
      this.game.changeScene('battle');
    });
    this.container.addChild(left, right, btn);
  }

  private circleAction(text: string, icon: string, x: number, y: number, fill: number) {
    const c = new Container();
    c.x = x;
    c.y = y;
    const bg = new Graphics();
    bg.circle(0, 0, 48);
    bg.fill({ color: fill, alpha: 0.92 });
    bg.stroke({ color: 0x5b8cff, alpha: 0.74, width: 3 });
    const i = label(icon, 28, palette.white, '900');
    i.anchor.set(0.5);
    i.y = -12;
    const t = label(text, 16, palette.white, '900');
    t.anchor.set(0.5);
    t.y = 24;
    c.addChild(bg, i, t);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private avatarFrame(player: PlayerCardData | undefined, size: number, accent: number) {
    const c = new Container();
    const frame = new Graphics();
    frame.roundRect(0, 0, size, size, 18);
    frame.fill({ color: 0x071126, alpha: 0.9 });
    frame.stroke({ color: accent, alpha: 0.92, width: 4 });
    const face = this.squarePortrait(player, size - 14);
    face.x = 7;
    face.y = 7;
    const rating = label(player ? String(player.rating) : '--', 17, 0x15213a, '900');
    const badge = new Graphics();
    badge.circle(13, 13, 15);
    badge.fill({ color: 0xffffff, alpha: 0.94 });
    rating.anchor.set(0.5);
    rating.x = 13;
    rating.y = 13;
    c.addChild(frame, face, badge, rating);
    return c;
  }

  private squarePortrait(player: PlayerCardData | undefined, size: number) {
    const c = new Container();
    if (!player) {
      const empty = new Graphics();
      empty.roundRect(0, 0, size, size, 12);
      empty.fill({ color: 0x0c1830, alpha: 0.94 });
      c.addChild(empty);
      return c;
    }
    const face = new Sprite(Texture.from(player.portrait));
    const scale = Math.max(size / (face.texture.width || 1024), size / (face.texture.height || 1024));
    face.scale.set(scale);
    face.x = (size - face.texture.width * scale) / 2;
    face.y = (size - face.texture.height * scale) / 2;
    const mask = new Graphics();
    mask.roundRect(0, 0, size, size, 12);
    mask.fill(0xffffff);
    face.mask = mask;
    c.addChild(face, mask);
    return c;
  }

  private bestPlayers(lineup: LineupSlot[]) {
    return lineup
      .flatMap((slot) => (slot.player ? [slot.player] : []))
      .sort((a, b) => b.rating - a.rating);
  }

  private opponentLineup() {
    return this.game.battleSource.opponentLineup ?? [];
  }

  private power(lineup: LineupSlot[]) {
    return lineup.reduce((sum, slot) => sum + (slot.player?.rating ?? 70), 0);
  }

  private teamTrophy(formation: string) {
    return formation.replace(/-/g, '').slice(0, 4).padEnd(4, '0');
  }
}
