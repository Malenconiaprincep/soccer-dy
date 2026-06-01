import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { LineupSlot, PlayerCardData, Position } from '../types';
import { glassPanel, label, palette } from '../ui';

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
    shade.fill({ color: 0x020817, alpha: 0.32 });
    const fieldGlow = new Graphics();
    fieldGlow.ellipse(this.game.width / 2, this.game.height * 0.62, this.game.width * 0.92, this.game.height * 0.34);
    fieldGlow.fill({ color: 0x0e6b7d, alpha: 0.11 });
    fieldGlow.ellipse(this.game.width / 2, this.game.height * 0.82, this.game.width * 0.82, this.game.height * 0.26);
    fieldGlow.fill({ color: 0x2b7b38, alpha: 0.1 });
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
    const { x, y, w, h, gap } = this.lineupLayout();
    this.drawMiniPitch('我方阵型', this.game.selectedFormation.name, this.game.lineup, x, y, w, h, 0x35d49a, 'left');
    this.drawMiniPitch('对方阵型', this.game.battleSource.opponentFormation?.name ?? '阵型', this.opponentLineup(), x + w + gap, y, w, h, 0xff4d67, 'right');
  }

  private lineupLayout() {
    const x = 2;
    const y = 390 + this.game.contentTopOffset * 0.42;
    const gap = 6;
    const w = (this.game.width - x * 2 - gap) / 2;
    const h = Math.round(w * 1.58);
    return { x, y, w, h, gap };
  }

  private drawMiniPitch(
    titleText: string,
    formationName: string,
    lineup: LineupSlot[],
    x: number,
    y: number,
    w: number,
    h: number,
    accent: number,
    side: 'left' | 'right'
  ) {
    const c = new Container();
    c.x = x;
    c.y = y;
    c.addChild(this.vsSquareFrame(side, w, h, accent));
    const title = label(titleText, 24, palette.white, '900');
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = 50;
    const form = label(formationName, 21, accent === 0xff4d67 ? 0xffd632 : accent, '900');
    form.anchor.set(0.5);
    form.x = w / 2;
    form.y = 80;

    const pitchX = 22 + (side === 'left' ? 8 : -8);
    const pitchY = 104;
    const pitchW = w - 44;
    const pitchH = h - pitchY - 28;
    const pitch = this.pitchSprite(pitchW, pitchH);
    pitch.x = pitchX;
    pitch.y = pitchY;
    c.addChild(title, form, pitch);

    const playerInsetX = 4;
    const playerOffsetX = side === 'left' ? 8 : -8;
    lineup.forEach((slot) => {
      const node = this.miniPlayerCard(slot.player, accent);
      const visualY = this.previewSlotY(slot.y);
      const spreadX = 0.5 + (slot.x - 0.5) * 1.08;
      node.x = pitchX + playerInsetX + playerOffsetX + spreadX * (pitchW - playerInsetX * 2);
      node.y = pitchY + 36 + visualY * (pitchH - 72);
      c.addChild(node);
    });
    this.container.addChild(c);
  }

  private pitchSprite(width: number, height: number) {
    const c = new Container();
    const fallback = this.pitchFallback(width, height);
    const sprite = new Sprite(Texture.EMPTY);
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = 0.86;
    c.addChild(fallback, sprite);
    void Assets.load<Texture>('/assets/ui/squard-qc.png').then((texture) => {
      if (sprite.destroyed) return;
      sprite.texture = new Texture({ source: texture.source, frame: new Rectangle(24, 24, 816, 1032) });
      sprite.width = width;
      sprite.height = height;
    });
    return c;
  }

  private pitchFallback(width: number, height: number) {
    const g = new Graphics();
    g.roundRect(0, 0, width, height, 14);
    g.fill({ color: 0x0b3f1f, alpha: 0.9 });
    for (let i = 0; i < 8; i += 1) {
      g.rect(0, (height / 8) * i, width, height / 8);
      g.fill({ color: i % 2 === 0 ? 0x0e5228 : 0x0a381d, alpha: 0.38 });
    }
    g.moveTo(0, height / 2);
    g.lineTo(width, height / 2);
    g.circle(width / 2, height / 2, Math.min(width, height) * 0.16);
    g.stroke({ color: 0xbce4bf, alpha: 0.28, width: 2 });
    return g;
  }

  private previewSlotY(y: number) {
    if (y < 0.28) return Math.max(0.08, y - 0.02);
    if (y < 0.58) return Math.max(0.18, y - 0.05);
    if (y < 0.82) return Math.min(0.86, y + 0.04);
    return Math.min(0.94, y + 0.02);
  }

  private vsSquareFrame(side: 'left' | 'right', width: number, height: number, accent: number) {
    const c = new Container();
    const sprite = new Sprite(Texture.EMPTY);
    sprite.width = width;
    sprite.height = height;
    c.addChild(sprite);
    void Assets.load<Texture>('/assets/ui/vs-squard.png').then((texture) => {
      if (sprite.destroyed) return;
      const frame = side === 'left' ? new Rectangle(0, 0, 520, 733) : new Rectangle(560, 0, 520, 733);
      sprite.texture = new Texture({ source: texture.source, frame });
      sprite.width = width;
      sprite.height = height;
    });
    return c;
  }

  private miniPlayerCard(player: PlayerCardData | undefined, fallbackColor: number) {
    if (!player) return this.ratingDot(undefined, fallbackColor);
    const c = new Container();
    const w = 58;
    const h = 72;
    const frame = new Graphics();
    this.hexPath(frame, 0, 0, w / 2, h / 2);
    frame.fill({ color: 0x071126, alpha: 0.96 });
    frame.stroke({ color: player.color, alpha: 0.9, width: 2 });
    const face = this.squarePortrait(player, 48);
    face.x = -24;
    face.y = -33;
    const rating = label(String(player.rating), 17, palette.white, '900');
    rating.anchor.set(0.5);
    rating.y = 24;
    c.addChild(frame, face, rating);
    return c;
  }

  private hexPath(g: Graphics, x: number, y: number, rx: number, ry: number) {
    g.poly([x, y - ry, x + rx, y - ry * 0.48, x + rx, y + ry * 0.48, x, y + ry, x - rx, y + ry * 0.48, x - rx, y - ry * 0.48]);
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
    const lineup = this.lineupLayout();
    const y = lineup.y + lineup.h + 0;
    const w = this.game.width - 16;
    const h = Math.round(w * 0.48);
    const myCore = this.bestPlayers(this.game.lineup)[0];
    const oppCore = this.bestPlayers(this.opponentLineup())[0];
    const panel = new Container();
    panel.x = 8;
    panel.y = y;
    panel.addChild(this.playerCoreFrame(w, h));
    const title = label('‹ 核心对位 ›', 21, 0xfff0b3, '900');
    title.x = w * 0.055;
    title.y = h * 0.12;
    const coreY = h * 0.205 + 8;
    const left = this.coreCard(myCore, w * 0.07, coreY, 0x318dff, false, w * 0.3, h * 0.26);
    const right = this.coreCard(oppCore, w * 0.93, coreY, 0xff4d67, true, w * 0.3, h * 0.26);
    const vs = label('VS', 44, palette.white, '900');
    vs.anchor.set(0.5);
    vs.x = w / 2;
    vs.y = h * 0.325 + 8;
    panel.addChild(title, left, right, vs);
    this.drawStatRow(panel, '进攻', myCore?.attack ?? 0, oppCore?.attack ?? 0, w * 0.07, h * 0.58, w * 0.86);
    this.drawStatRow(panel, '中场', myCore?.speed ?? 0, oppCore?.speed ?? 0, w * 0.07, h * 0.71, w * 0.86);
    this.drawStatRow(panel, '防守', myCore?.defense ?? 0, oppCore?.defense ?? 0, w * 0.07, h * 0.84, w * 0.86);
    this.container.addChild(panel);
  }

  private playerCoreFrame(width: number, height: number) {
    const c = new Container();
    const fallback = new Graphics();
    fallback.rect(0, 0, width, height);
    fallback.fill({ color: 0x071126, alpha: 0.22 });
    c.addChild(fallback);
    const sprite = new Sprite(Texture.EMPTY);
    sprite.width = width;
    sprite.height = height;
    c.addChild(sprite);
    void Assets.load<Texture>('/assets/ui/playercore.png').then((texture) => {
      if (sprite.destroyed) return;
      sprite.texture = texture;
      sprite.width = width;
      sprite.height = height;
    });
    return c;
  }

  private coreCard(player: PlayerCardData | undefined, x: number, y: number, accent: number, right: boolean, boxW = 156, boxH = 72) {
    const c = new Container();
    c.x = x;
    c.y = y;
    const bg = new Graphics();
    bg.roundRect(right ? -boxW : 0, 0, boxW, boxH, 14);
    bg.fill({ color: 0x071126, alpha: 0.9 });
    bg.stroke({ color: accent, alpha: 0.72, width: 2 });
    const avatarSize = boxH - 20;
    const avatar = this.squarePortrait(player, avatarSize);
    avatar.x = right ? -boxW + 10 : 10;
    avatar.y = 10;
    const rating = label(player ? String(player.rating) : '--', 24, palette.white, '900');
    rating.x = right ? -boxW + avatarSize + 16 : avatarSize + 16;
    rating.y = 9;
    const name = label(player?.name ?? '待定', 18, palette.white, '900');
    name.x = right ? -boxW + avatarSize + 58 : avatarSize + 58;
    name.y = 12;
    const role = label(player ? `${this.positionName(player.position)} · ${player.role}` : '核心球员', 14, 0xcfe0ff, '700');
    role.x = right ? -boxW + avatarSize + 16 : avatarSize + 16;
    role.y = 41;
    c.addChild(bg, avatar, rating, name, role);
    return c;
  }

  private positionName(position: Position) {
    if (position === 'GK') return '门将';
    if (position === 'DF') return '后卫';
    if (position === 'MF') return '中场';
    return '前锋';
  }

  private drawStatRow(parent: Container, title: string, leftValue: number, rightValue: number, x: number, y: number, w: number) {
    const max = Math.max(1, leftValue, rightValue);
    const centerX = x + w / 2;
    const labelGap = 48;
    const leftBarX = x + 78;
    const leftBarMaxW = Math.max(24, centerX - labelGap - leftBarX);
    const rightBarX = centerX + labelGap;
    const rightBarMaxW = Math.max(24, x + w - 78 - rightBarX);
    const leftW = (leftBarMaxW * leftValue) / max;
    const rightW = (rightBarMaxW * rightValue) / max;
    const left = label(String(leftValue), 20, 0x5ca6ff, '900');
    left.anchor.set(0, 0.5);
    left.x = x;
    left.y = y + 3;
    const text = label(title, 18, palette.white, '900');
    text.anchor.set(0.5);
    text.x = centerX;
    text.y = y + 3;
    const right = label(String(rightValue), 20, 0xff7185, '900');
    right.anchor.set(1, 0.5);
    right.x = x + w;
    right.y = y + 3;
    const leftTrack = new Graphics();
    leftTrack.roundRect(leftBarX, y - 3, leftBarMaxW, 12, 6);
    leftTrack.fill({ color: 0x071126, alpha: 0.42 });
    const rightTrack = new Graphics();
    rightTrack.roundRect(rightBarX, y - 3, rightBarMaxW, 12, 6);
    rightTrack.fill({ color: 0x071126, alpha: 0.42 });
    const lb = new Graphics();
    lb.roundRect(leftBarX, y - 3, leftW, 12, 6);
    lb.fill({ color: 0x3294ff, alpha: 0.92 });
    const rb = new Graphics();
    rb.roundRect(rightBarX, y - 3, rightW, 12, 6);
    rb.fill({ color: 0xff4d67, alpha: 0.92 });
    parent.addChild(leftTrack, rightTrack, lb, rb, left, text, right);
  }

  private drawActions() {
    const buttonW = Math.min(420, this.game.width - 160);
    const buttonH = buttonW * (410 / 1080);
    const btn = new Container();
    btn.x = (this.game.width - buttonW) / 2;
    btn.y = this.game.height - buttonH - 28;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new Rectangle(0, 0, buttonW, buttonH);
    const art = new Sprite(Texture.from('/assets/ui/playbutton.png'));
    art.width = buttonW;
    art.height = buttonH;
    btn.addChild(art);
    btn.on('pointertap', () => {
      this.game.sound.play('kickoff');
      this.game.changeScene('battle');
    });
    this.container.addChild(btn);
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
