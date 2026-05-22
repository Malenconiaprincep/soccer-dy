import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { BattleEvent, LineupSlot, PlayerCardData, Position } from '../types';
import { label, palette } from '../ui';

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
  private moment: BattleMoment = {
    type: 'kickoff',
    title: '比赛开始',
    detail: '双方进入试探阶段，教练正在观察对手站位。',
    mood: 'normal'
  };

  protected build() {
    this.drawBackground();
    this.drawMatchHeader();
    this.drawEventFeed();
    this.drawPossessionPanel();
  }

  enter() {
    super.enter();
    this.game.sound.play('kickoff');
  }

  update(deltaMs: number) {
    this.elapsed += deltaMs;
    if (this.timeText) this.timeText.text = this.clockText();
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

  private drawMatchHeader() {
    const shift = this.game.contentTopOffset * 0.34;
    const y = 56 + shift;
    const myHero = this.pickPlayer(this.game.lineup, ['FW', 'MF', 'GK']);
    const oppHero = this.pickPlayer(this.opponentLineup(), ['FW', 'MF', 'GK']);
    const title = label('比赛日 1', 30, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = y;

    const leftAvatar = this.playerBadge(myHero, 126, 0x2f8cff);
    leftAvatar.x = 86;
    leftAvatar.y = y + 132;
    const rightAvatar = this.playerBadge(oppHero, 126, 0xffd34a);
    rightAvatar.x = this.game.width - 86;
    rightAvatar.y = y + 132;

    const leftTitle = label('我方球队', 30, palette.white, '900');
    leftTitle.x = 166;
    leftTitle.y = y + 82;
    const leftClub = label('蓝焰俱乐部', 22, 0x2ee6d6, '900');
    leftClub.x = 166;
    leftClub.y = y + 122;
    const rightTitle = label('对手球队', 30, palette.white, '900');
    rightTitle.anchor.set(1, 0);
    rightTitle.x = this.game.width - 166;
    rightTitle.y = y + 82;
    const rightClub = label('蓝焰俱乐部', 22, 0xcfe0ff, '900');
    rightClub.anchor.set(1, 0);
    rightClub.x = this.game.width - 166;
    rightClub.y = y + 122;
    const ai = label(`AI  ${this.game.battleSource.opponentName}`, 20, 0xfff1a8, '900');
    ai.anchor.set(1, 0);
    ai.x = this.game.width - 166;
    ai.y = y + 162;

    const score = new Container();
    score.x = this.game.width / 2;
    score.y = y + 122;
    const leftScore = label(String(this.scoreA), 66, 0x2f8cff, '900');
    leftScore.anchor.set(1, 0.5);
    leftScore.x = -30;
    const colon = label(':', 54, palette.white, '900');
    colon.anchor.set(0.5);
    const rightScore = label(String(this.scoreB), 66, 0xff5d68, '900');
    rightScore.anchor.set(0, 0.5);
    rightScore.x = 30;
    this.scoreText = label(`${this.scoreA} : ${this.scoreB}`, 1, palette.white, '900');
    this.scoreText.visible = false;
    score.addChild(leftScore, colon, rightScore, this.scoreText);

    this.timeText = label(this.clockText(), 34, 0xffd632, '900');
    this.timeText.anchor.set(0.5);
    this.timeText.x = this.game.width / 2;
    this.timeText.y = y + 196;
    this.container.addChild(title, leftAvatar, rightAvatar, leftTitle, leftClub, rightTitle, rightClub, ai, score, this.timeText);
  }

  private drawEventFeed() {
    const shift = this.game.contentTopOffset * 0.52;
    const x = 22;
    const y = 316 + shift;
    const w = this.game.width - 44;
    const h = 720 + this.game.contentTopOffset * 0.18;
    const panel = new Graphics();
    panel.roundRect(x, y, w, h, 16);
    panel.fill({ color: 0x06142f, alpha: 0.72 });
    panel.stroke({ color: 0x2f8cff, alpha: 0.48, width: 2 });
    this.container.addChild(panel);

    const entries = this.eventEntries();
    const lineX = x + 70;
    const top = y + 74;
    const rowH = 82;
    const line = new Graphics();
    line.moveTo(lineX, top - 30);
    line.lineTo(lineX, Math.min(y + h - 36, top + rowH * (entries.length - 1) + 26));
    line.stroke({ color: 0x348dff, alpha: 0.42, width: 3 });
    this.container.addChild(line);

    entries.slice(0, 8).forEach((entry, index) => {
      const rowY = top + index * rowH;
      const color = this.entryColor(entry.mood);
      const icon = this.eventIcon(entry, color);
      icon.x = lineX;
      icon.y = rowY;
      const minute = label(`${entry.time}'`, 30, color, '900');
      minute.x = x + 106;
      minute.y = rowY - 22;
      const tag = this.eventTag(entry.title, color);
      tag.x = x + 178;
      tag.y = rowY - 26;
      const name = label(entry.actor ?? entry.title, 26, color, '900');
      name.x = x + 250;
      name.y = rowY - 22;
      const detail = label(entry.text, 22, 0xd9e6ff, '700');
      detail.x = x + 178;
      detail.y = rowY + 18;
      const rightIcon = label(this.rightEventIcon(entry.title), 42, color, '900');
      rightIcon.anchor.set(0.5);
      rightIcon.x = x + w - 76;
      rightIcon.y = rowY + 8;
      this.container.addChild(icon, minute, tag, name, detail, rightIcon);
    });

    const scroll = new Graphics();
    scroll.roundRect(x + w - 18, y + 76, 6, h - 120, 3);
    scroll.fill({ color: 0xffffff, alpha: 0.3 });
    scroll.roundRect(x + w - 18, y + 76 + (h - 170) * 0.12, 6, 72, 3);
    scroll.fill({ color: 0x1ee47e, alpha: 0.9 });
    this.container.addChild(scroll);
  }

  private drawPossessionPanel() {
    const y = this.game.height - 250;
    const x = 22;
    const w = this.game.width - 44;
    const h = 206;
    const panel = new Graphics();
    panel.roundRect(x, y, w, h, 18);
    panel.fill({ color: 0x06142f, alpha: 0.78 });
    panel.stroke({ color: 0x2f8cff, alpha: 0.46, width: 2 });
    const titleMark = new Graphics();
    titleMark.rect(x + 26, y + 28, 6, 32);
    titleMark.fill({ color: 0x23d0ad, alpha: 1 });
    const title = label('比赛势头', 30, palette.white, '900');
    title.x = x + 42;
    title.y = y + 20;
    const sub = label('控球率', 20, 0xcfe0ff, '700');
    sub.x = x + 42;
    sub.y = y + 82;
    const left = label('62%', 40, 0x2f8cff, '900');
    left.x = x + 42;
    left.y = y + 126;
    const right = label('38%', 40, 0xff5d68, '900');
    right.anchor.set(1, 0);
    right.x = x + w - 42;
    right.y = y + 126;
    const bar = new Graphics();
    bar.roundRect(x + 160, y + 143, w - 320, 20, 10);
    bar.fill({ color: 0x183451, alpha: 1 });
    bar.roundRect(x + 160, y + 143, (w - 320) * 0.62, 20, 10);
    bar.fill({ color: 0x2f8cff, alpha: 0.95 });
    bar.roundRect(x + 160 + (w - 320) * 0.62, y + 143, (w - 320) * 0.38, 20, 10);
    bar.fill({ color: 0xff465d, alpha: 0.95 });
    const ball = label('⚽', 34, palette.white, '900');
    ball.anchor.set(0.5);
    ball.x = x + 160 + (w - 320) * 0.62;
    ball.y = y + 152;
    const leftClub = label('蓝焰俱乐部', 21, 0x2f8cff, '900');
    leftClub.x = x + 42;
    leftClub.y = y + 176;
    const rightClub = label(this.game.battleSource.opponentName, 21, 0xff5d68, '900');
    rightClub.anchor.set(1, 0);
    rightClub.x = x + w - 42;
    rightClub.y = y + 176;
    this.container.addChild(panel, titleMark, title, sub, left, right, bar, ball, leftClub, rightClub);
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

  private eventEntries() {
    const current = {
      time: this.matchMinute(),
      title: this.cardTitle(),
      actor: this.playerName(this.moment.actor),
      text: this.moment.detail,
      mood: this.moment.mood,
      scoreA: this.scoreA,
      scoreB: this.scoreB
    };
    const history = this.events.map((event) => ({
      time: event.time,
      title: this.eventTitle(event),
      actor: this.eventActor(event.text),
      text: event.text,
      mood: event.mood,
      scoreA: event.scoreA,
      scoreB: event.scoreB
    }));
    const fallback = [
      { time: 45, title: '黄牌', actor: '王涛', text: '战术犯规，吃到本场比赛第一张黄牌！', mood: 'normal' as const, scoreA: this.scoreA, scoreB: this.scoreB },
      { time: 38, title: '角球', actor: '蓝焰俱乐部', text: '获得角球，右侧角球开出！', mood: 'good' as const, scoreA: this.scoreA, scoreB: this.scoreB },
      { time: 24, title: '配合', actor: '林浩 与 罗一鸣', text: '精妙配合，连续传递撕开防线！', mood: 'good' as const, scoreA: this.scoreA, scoreB: this.scoreB }
    ];
    return [current, ...history, ...fallback].slice(0, 8);
  }

  private eventTitle(event: BattleEvent) {
    if (event.text.includes('破门') || event.text.includes('进球') || event.scoreA || event.scoreB) return '进球';
    if (event.text.includes('射门') || event.text.includes('起脚')) return '射门';
    if (event.text.includes('抢断')) return '抢断';
    if (event.text.includes('角球')) return '角球';
    if (event.text.includes('扑')) return '扑救';
    if (event.mood === 'bad') return '危险';
    return '配合';
  }

  private eventActor(text: string) {
    return text.split(/[ ，,]/)[0] || '球员';
  }

  private entryColor(mood: BattleEvent['mood']) {
    if (mood === 'bad') return 0xff5d68;
    if (mood === 'good') return 0x2f8cff;
    return 0xffd632;
  }

  private eventTag(text: string, color: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, 60, 34, 8);
    bg.fill({ color: 0x071735, alpha: 0.75 });
    bg.stroke({ color, alpha: 0.55, width: 2 });
    const tag = label(text, 20, color, '900');
    tag.anchor.set(0.5);
    tag.x = 30;
    tag.y = 17;
    c.addChild(bg, tag);
    return c;
  }

  private eventIcon(entry: { title: string; mood: BattleEvent['mood'] }, color: number) {
    const c = new Container();
    const outer = new Graphics();
    outer.circle(0, 0, 28);
    outer.fill({ color: 0x06142f, alpha: 0.96 });
    outer.stroke({ color, alpha: 0.82, width: 4 });
    const icon = label(this.leftEventIcon(entry.title), 28, palette.white, '900');
    icon.anchor.set(0.5);
    icon.y = -1;
    c.addChild(outer, icon);
    return c;
  }

  private leftEventIcon(title: string) {
    if (title === '黄牌') return '▮';
    if (title === '抢断') return '⬟';
    if (title === '危险') return '!';
    if (title === '角球') return '⚑';
    return '⚽';
  }

  private rightEventIcon(title: string) {
    if (title === '黄牌') return '▉';
    if (title === '抢断') return '▰';
    if (title === '危险') return '⚡';
    if (title === '角球') return '⚑';
    if (title === '扑救') return '☝';
    return '➜';
  }

  private playerBadge(player: PlayerCardData | undefined, size: number, color: number) {
    const c = new Container();
    const frame = new Graphics();
    frame.roundRect(-size / 2, -size / 2, size, size, 22);
    frame.fill({ color: 0x071735, alpha: 0.96 });
    frame.stroke({ color, alpha: 0.92, width: 5 });
    if (player) {
      const face = new Sprite(Texture.from(player.portrait));
      face.anchor.set(0.5);
      face.width = size - 18;
      face.height = size - 18;
      c.addChild(face);
      const rating = label(String(player.rating), 22, palette.white, '900');
      rating.x = -size / 2 - 12;
      rating.y = -size / 2 - 8;
      c.addChild(rating);
    }
    c.addChild(frame);
    c.setChildIndex(frame, 0);
    return c;
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

  private clockText() {
    const totalSeconds = Math.max(0, Math.min(90 * 60, Math.floor((this.elapsed / 26000) * 90 * 60)));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}
