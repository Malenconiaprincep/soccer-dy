import { Container, Graphics } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { BattleEvent, LineupSlot, PlayerCardData, Position } from '../types';
import { glassPanel, label, palette } from '../ui';

type MomentType = 'kickoff' | 'attack' | 'shot' | 'post' | 'corner' | 'save' | 'goal' | 'counter';

interface BattleMoment {
  type: MomentType;
  title: string;
  detail: string;
  mood: BattleEvent['mood'];
  score?: 'home' | 'away';
  actor?: PlayerCardData;
  team?: 'home' | 'away';
}

export class BattleScene extends BaseScene {
  private elapsed = 0;
  private nextEventAt = 700;
  private scoreA = 0;
  private scoreB = 0;
  private events: BattleEvent[] = [];
  private scoreText?: ReturnType<typeof label>;
  private timeText?: ReturnType<typeof label>;
  private pitchLayer?: Container;
  private cardLayer?: Container;
  private moment: BattleMoment = {
    type: 'kickoff',
    title: '比赛开始',
    detail: '双方进入试探阶段，教练正在观察对手站位。',
    mood: 'normal'
  };

  protected build() {
    this.drawBackground();
    this.drawScoreHeader();
    this.drawTimeline();
    this.drawPitch();
    this.drawMomentum();
    this.drawMomentCard();
  }

  enter() {
    super.enter();
    this.game.sound.play('kickoff');
  }

  update(deltaMs: number) {
    this.elapsed += deltaMs;
    if (this.timeText) this.timeText.text = `${this.matchMinute()}'`;
    if (this.elapsed > this.nextEventAt) {
      this.pushEvent();
      this.nextEventAt += 2200 + Math.random() * 1400;
    }
    if (this.elapsed > 26000) {
      this.game.battleResult = { scoreA: this.scoreA, scoreB: this.scoreB, events: this.events };
      this.game.changeScene('result');
    }
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  private drawBackground() {
    this.container.addChild(this.stadiumBackground());
    const shift = this.game.contentTopOffset;
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020817, alpha: 0.48 });
    shade.rect(0, 0, this.game.width, 350 + shift * 0.4);
    shade.fill({ color: 0x030817, alpha: 0.34 });
    shade.rect(0, 760 + shift, this.game.width, 520 + shift);
    shade.fill({ color: 0x020817, alpha: 0.42 });
    this.container.addChild(shade);
  }

  private drawScoreHeader() {
    const shift = this.game.contentTopOffset * 0.45;
    const panel = new Container();
    panel.x = 28;
    panel.y = 36 + shift;
    panel.addChild(glassPanel(this.game.width - 56, 282, 0x07120d, 0xffd632));
    this.container.addChild(panel);

    const day = label('比赛日 1', 28, 0xf2fff7, '900');
    day.anchor.set(0.5);
    day.x = this.game.width / 2;
    day.y = 72 + shift;
    this.container.addChild(day);

    const divider = new Graphics();
    divider.moveTo(this.game.width * 0.34, 108 + shift);
    divider.lineTo(this.game.width * 0.66, 108 + shift);
    divider.stroke({ color: 0xffd632, alpha: 0.5, width: 3 });
    this.container.addChild(divider);

    const leftBadge = this.badge(0x40d990, '我');
    leftBadge.x = 126;
    leftBadge.y = 190 + shift;
    const rightBadge = this.badge(0xffd632, 'AI');
    rightBadge.x = this.game.width - 126;
    rightBadge.y = 190 + shift;
    this.container.addChild(leftBadge, rightBadge);

    const home = label('本地经理', 20, 0x9fffc6, '900');
    home.anchor.set(0.5);
    home.x = 130;
    home.y = 262 + shift;
    const away = label(this.game.battleSource.opponentName, 20, 0xfff1a8, '900');
    away.anchor.set(0.5);
    away.x = this.game.width - 130;
    away.y = 262 + shift;

    this.scoreText = label(`${this.scoreA} : ${this.scoreB}`, 76, palette.white, '900');
    this.scoreText.anchor.set(0.5);
    this.scoreText.x = this.game.width / 2;
    this.scoreText.y = 190 + shift;
    this.container.addChild(home, away, this.scoreText);

    const clock = new Graphics();
    clock.circle(this.game.width / 2, 312 + shift, 42);
    clock.fill({ color: 0x06130d, alpha: 0.94 });
    clock.stroke({ color: 0xffd632, alpha: 0.78, width: 4 });
    this.timeText = label("0'", 32, 0xfff1a8, '900');
    this.timeText.anchor.set(0.5);
    this.timeText.x = this.game.width / 2;
    this.timeText.y = 312 + shift;
    this.container.addChild(clock, this.timeText);
  }

  private drawTimeline() {
    const y = 374 + this.game.contentTopOffset * 0.58;
    const line = new Graphics();
    line.roundRect(58, y - 5, 604, 10, 5);
    line.fill({ color: 0x07120d, alpha: 0.85 });
    line.stroke({ color: 0xd7fff0, alpha: 0.18, width: 2 });
    const progress = Math.min(1, this.matchMinute() / 90);
    line.roundRect(60, y - 4, 600 * progress, 8, 4);
    line.fill({ color: this.accentColor(), alpha: 0.95 });
    this.container.addChild(line);
  }

  private drawPitch() {
    this.pitchLayer = new Container();
    this.pitchLayer.x = 32;
    this.pitchLayer.y = 430 + this.game.contentTopOffset * 0.72;
    this.container.addChild(this.pitchLayer);
    this.renderPitch();
  }

  private renderPitch() {
    if (!this.pitchLayer) return;
    this.pitchLayer.removeChildren();
    const w = this.game.width - 64;
    const h = 260;
    const shadow = new Graphics();
    shadow.ellipse(w / 2, h + 22, w * 0.46, 28);
    shadow.fill({ color: 0x000000, alpha: 0.35 });
    this.pitchLayer.addChild(shadow);

    const p = new Graphics();
    p.roundRect(0, 8, w, h, 18);
    p.fill({ color: 0x06130d, alpha: 0.52 });
    p.stroke({ color: 0x54ffe4, alpha: 0.18, width: 2 });
    p.moveTo(64, 42);
    p.lineTo(w - 64, 42);
    p.lineTo(w - 18, h - 34);
    p.lineTo(18, h - 34);
    p.closePath();
    p.fill({ color: 0x19351e, alpha: 0.96 });
    p.stroke({ color: 0xd8ffe1, alpha: 0.28, width: 2 });
    for (let i = 0; i < 8; i += 1) {
      const x = 32 + (w - 64) * (i / 8);
      p.rect(x, 44, (w - 64) / 16, h - 80);
      p.fill({ color: 0x3ea354, alpha: 0.12 });
    }
    p.moveTo(w / 2, 44);
    p.lineTo(w / 2, h - 34);
    p.stroke({ color: 0xffffff, alpha: 0.22, width: 2 });
    p.circle(w / 2, h / 2, 42);
    p.stroke({ color: 0xffffff, alpha: 0.22, width: 2 });
    p.roundRect(w * 0.12, 82, 104, 94, 0);
    p.stroke({ color: 0xffffff, alpha: 0.16, width: 2 });
    p.roundRect(w * 0.72, 82, 104, 94, 0);
    p.stroke({ color: 0xffffff, alpha: 0.16, width: 2 });
    this.pitchLayer.addChild(p);

    this.drawPitchMoment(w, h);
  }

  private drawPitchMoment(w: number, h: number) {
    const g = new Graphics();
    const isBad = this.moment.mood === 'bad';
    const color = this.accentColor();
    const zoneX = isBad ? 56 : w - 214;
    const arrows = isBad ? '‹‹‹' : '›››';
    g.roundRect(zoneX, 92, 158, 86, 12);
    g.fill({ color, alpha: 0.24 });
    g.stroke({ color, alpha: 0.72, width: 2 });
    const arrowText = label(arrows, 58, color, '900');
    arrowText.anchor.set(0.5);
    arrowText.x = zoneX + 79;
    arrowText.y = 132;
    this.pitchLayer?.addChild(g, arrowText);
  }

  private drawMomentum() {
    const y = 720 + this.game.contentTopOffset * 0.88;
    const text = label('比赛势头', 22, 0xfff1a8, '900');
    text.x = 46;
    text.y = y - 36;
    const bar = new Graphics();
    bar.roundRect(34, y - 4, this.game.width - 68, 20, 10);
    bar.fill({ color: 0x06130d, alpha: 0.82 });
    bar.stroke({ color: 0xd7fff0, alpha: 0.16, width: 2 });
    const value = this.moment.mood === 'bad' ? 0.38 : this.moment.mood === 'good' ? 0.68 : 0.5;
    for (let i = 0; i < 30; i += 1) {
      const active = i / 30 < value;
      bar.moveTo(34 + i * 21, y + 15);
      bar.lineTo(46 + i * 21, y + 3);
      bar.lineTo(58 + i * 21, y + 3);
      bar.lineTo(46 + i * 21, y + 15);
      bar.closePath();
      bar.fill({ color: active ? this.accentColor() : 0xffffff, alpha: active ? 0.9 : 0.15 });
    }
    this.container.addChild(text, bar);
  }

  private drawMomentCard() {
    this.cardLayer = new Container();
    this.cardLayer.x = 22;
    this.cardLayer.y = 792 + this.game.contentTopOffset;
    this.container.addChild(this.cardLayer);
    this.renderMomentCard();
  }

  private renderMomentCard() {
    if (!this.cardLayer) return;
    this.cardLayer.removeChildren();
    const w = this.game.width - 44;
    const h = 392;
    const accent = this.accentColor();
    const panel = new Graphics();
    panel.roundRect(0, 0, w, h, 24);
    panel.fill({ color: 0x06130d, alpha: 0.78 });
    panel.stroke({ color: accent, alpha: 0.58, width: 3 });
    for (let i = 0; i < 9; i += 1) {
      panel.moveTo(30 + i * 76, 30);
      panel.lineTo(100 + i * 76, h - 24);
      panel.stroke({ color: 0xffffff, alpha: 0.045, width: 1 });
    }
    this.cardLayer.addChild(panel);

    const badge = new Graphics();
    badge.circle(w / 2, 0, 44);
    badge.fill({ color: 0x07120d, alpha: 0.96 });
    badge.stroke({ color: accent, alpha: 0.8, width: 4 });
    const exclamation = label('!', 54, palette.white, '900');
    exclamation.anchor.set(0.5);
    exclamation.x = w / 2;
    exclamation.y = 2;
    this.cardLayer.addChild(badge, exclamation);

    const title = label(this.cardTitle(), 34, accent, '900');
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = 92;
    const detail = label(this.moment.detail, 24, palette.white, '700');
    detail.anchor.set(0.5);
    detail.x = w / 2;
    detail.y = 154;
    const sub = label(this.moment.mood === 'bad' ? '注意防线回收' : this.moment.mood === 'good' ? '继续压迫对手' : '保持控球节奏', 20, 0xcfffe8, '900');
    sub.anchor.set(0.5);
    sub.x = w / 2;
    sub.y = 206;
    const arrows = label(this.moment.mood === 'bad' ? '‹‹‹' : '›››', 82, accent, '900');
    arrows.anchor.set(0.5);
    arrows.x = w / 2;
    arrows.y = 294;
    this.cardLayer.addChild(title, detail, sub, arrows);
  }

  private pushEvent() {
    const next = this.createMoment();
    this.moment = next;
    if (next.score === 'home') this.scoreA += 1;
    if (next.score === 'away') this.scoreB += 1;
    if (next.type === 'goal') this.game.sound.play('goal');
    else if (next.mood === 'bad') this.game.sound.play('danger');
    else if (next.mood === 'good') this.game.sound.play('confirm');
    else this.game.sound.play('tap');
    this.events.unshift({
      time: this.matchMinute(),
      text: next.detail,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      mood: next.mood
    });
    if (this.scoreText) this.scoreText.text = `${this.scoreA} : ${this.scoreB}`;
    this.resize();
  }

  private createMoment(): BattleMoment {
    const power = this.game.lineup.reduce((sum, slot) => sum + (slot.player?.rating ?? 70), 0);
    const scorer = this.pickPlayer(this.game.lineup, ['FW', 'MF']);
    const creator = this.pickPlayer(this.game.lineup, ['MF', 'FW']);
    const defender = this.pickPlayer(this.game.lineup, ['GK', 'DF']);
    const awayAttacker = this.pickPlayer(this.opponentLineup(), ['FW', 'MF']);
    const awayCreator = this.pickPlayer(this.opponentLineup(), ['MF', 'FW']);
    const awayScorer = awayAttacker ?? awayCreator;
    const roll = Math.random();
    const advantage = power > 520 ? 0.12 : 0;

    if (roll < 0.15 + advantage) {
      return { type: 'goal', title: '进球', detail: `${this.playerName(scorer)} 接到 ${this.playerName(creator)} 的传球，冷静推射破门！`, mood: 'good', score: 'home', actor: scorer, team: 'home' };
    }
    if (roll < 0.3) return { type: 'shot', title: '得分机会', detail: `${this.playerName(scorer)} 在禁区前沿获得起脚空间。`, mood: 'good', actor: scorer, team: 'home' };
    if (roll < 0.42) return { type: 'post', title: '击中门柱', detail: `${this.playerName(scorer)} 的劲射狠狠砸在门柱上弹出。`, mood: 'normal', actor: scorer, team: 'home' };
    if (roll < 0.54) return { type: 'corner', title: '角球机会', detail: `${this.playerName(creator)} 边路传中被挡出底线，获得角球。`, mood: 'good', actor: creator, team: 'home' };
    if (roll < 0.68) return { type: 'save', title: '精彩扑救', detail: `${this.playerName(defender)} 飞身将 ${this.playerName(awayAttacker)} 的近距离射门扑出。`, mood: 'good', actor: defender, team: 'home' };
    if (roll < 0.8) return { type: 'counter', title: '危险反击', detail: `${this.playerName(awayCreator)} 突然提速，${this.playerName(awayAttacker)} 已经前插到防线身后。`, mood: 'bad', actor: awayAttacker, team: 'away' };
    if (roll < 0.88) return { type: 'counter', title: '失球', detail: `${this.playerName(awayScorer)} 反击打穿防线，为${this.game.battleSource.opponentName}扳回一球。`, mood: 'bad', score: 'away', actor: awayScorer, team: 'away' };
    return { type: 'attack', title: '组织推进', detail: `${this.playerName(creator)} 在中场连续传导，耐心寻找最后一传。`, mood: 'normal', actor: creator, team: 'home' };
  }

  private opponentLineup() {
    return this.game.battleSource.opponentLineup ?? [];
  }

  private pickPlayer(lineup: LineupSlot[], positions: Position[]) {
    const pool = lineup
      .flatMap((slot) => (slot.player && positions.includes(slot.position) ? [slot.player] : []))
      .sort((a, b) => b.rating - a.rating);
    const window = pool.slice(0, Math.min(5, pool.length));
    return window[Math.floor(Math.random() * window.length)] ?? pool[0];
  }

  private playerName(player?: PlayerCardData) {
    return player?.name ?? '球员';
  }

  private cardTitle() {
    if (this.moment.type === 'goal') return '进球时刻';
    if (this.moment.type === 'counter') return '危险时刻';
    if (this.moment.type === 'save') return '门前险情';
    if (this.moment.type === 'post') return '差之毫厘';
    if (this.moment.type === 'corner') return '定位球机会';
    if (this.moment.type === 'shot') return '得分机会';
    return '进攻推进';
  }

  private badge(color: number, text: string) {
    const c = new Container();
    const outer = new Graphics();
    outer.circle(0, 0, 52);
    outer.fill({ color: 0x06130d, alpha: 0.94 });
    outer.stroke({ color, alpha: 0.9, width: 5 });
    const inner = new Graphics();
    inner.circle(0, 0, 38);
    inner.fill({ color, alpha: 0.18 });
    inner.stroke({ color: 0xffffff, alpha: 0.18, width: 2 });
    const t = label(text, 26, color, '900');
    t.anchor.set(0.5);
    c.addChild(outer, inner, t);
    return c;
  }

  private accentColor() {
    if (this.moment.mood === 'bad') return 0xff6969;
    if (this.moment.mood === 'good') return 0xffd632;
    return 0x54ffe4;
  }

  private matchMinute() {
    return Math.max(1, Math.min(90, Math.round((this.elapsed / 26000) * 90)));
  }
}
