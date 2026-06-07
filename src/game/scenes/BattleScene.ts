import { Container, FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { BattleEvent, LineupSlot, PlayerCardData, Position } from '../types';
import { playerDisplayName } from '../playerNames';
import { headerTitleSprite, label, palette } from '../ui';

type MomentType = 'kickoff' | 'attack' | 'shot' | 'post' | 'corner' | 'save' | 'goal' | 'counter';
type GameEventCardKey =
  | 'goal'
  | 'shot'
  | 'attack'
  | 'save'
  | 'goal_confirm'
  | 'corner'
  | 'duel'
  | 'assist'
  | 'pass'
  | 'tackle'
  | 'dribble'
  | 'whistle'
  | 'yellow_card'
  | 'red_card'
  | 'offside'
  | 'substitution'
  | 'jersey_change'
  | 'injury'
  | 'player_injury'
  | 'tactic'
  | 'timer'
  | 'half_time'
  | 'kick_off'
  | 'match_end';

const runtimeEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env ?? {};
const DEV_BATTLE_EVENTS_KEY = 'soccer.dev.battleEventsAll';
const GAME_EVENTS = '/assets/ui/gameevents.png';
const GAME_EVENT_CARD_FRAMES: Record<GameEventCardKey, { x: number; y: number; width: number; height: number }> = {
  goal: { x: 15, y: 16, width: 508, height: 72 },
  shot: { x: 15, y: 96, width: 508, height: 72 },
  attack: { x: 15, y: 176, width: 508, height: 72 },
  save: { x: 15, y: 256, width: 508, height: 72 },
  goal_confirm: { x: 15, y: 336, width: 508, height: 72 },
  corner: { x: 15, y: 416, width: 508, height: 72 },
  duel: { x: 15, y: 496, width: 508, height: 72 },
  assist: { x: 15, y: 576, width: 508, height: 72 },
  pass: { x: 15, y: 656, width: 508, height: 72 },
  tackle: { x: 15, y: 736, width: 508, height: 72 },
  dribble: { x: 15, y: 816, width: 508, height: 56 },
  whistle: { x: 15, y: 872, width: 508, height: 60 },
  yellow_card: { x: 550, y: 16, width: 515, height: 72 },
  red_card: { x: 550, y: 96, width: 515, height: 72 },
  offside: { x: 550, y: 176, width: 515, height: 72 },
  substitution: { x: 550, y: 256, width: 515, height: 72 },
  jersey_change: { x: 550, y: 336, width: 515, height: 72 },
  injury: { x: 550, y: 416, width: 515, height: 72 },
  player_injury: { x: 550, y: 496, width: 515, height: 72 },
  tactic: { x: 550, y: 576, width: 515, height: 72 },
  timer: { x: 550, y: 656, width: 515, height: 72 },
  half_time: { x: 550, y: 736, width: 515, height: 72 },
  kick_off: { x: 550, y: 816, width: 515, height: 56 },
  match_end: { x: 550, y: 872, width: 515, height: 60 }
};

interface BattleMoment {
  type: MomentType;
  title: string;
  detail: string;
  mood: BattleEvent['mood'];
  score?: 'home' | 'away';
  actor?: PlayerCardData;
  actors?: PlayerCardData[];
  team?: 'home' | 'away';
}

interface BattleEventEntry {
  eventType?: GameEventCardKey;
  time: number;
  title: string;
  actor: string;
  player?: PlayerCardData;
  players?: PlayerCardData[];
  text: string;
  mood: BattleEvent['mood'];
  scoreA: number;
  scoreB: number;
}

export class BattleScene extends BaseScene {
  private elapsed = 0;
  private nextEventAt = 700;
  private scoreA = 0;
  private scoreB = 0;
  private events: BattleEvent[] = [];
  private scoreText?: ReturnType<typeof label>;
  private timeText?: ReturnType<typeof label>;
  private possessionLeftText?: ReturnType<typeof label>;
  private possessionRightText?: ReturnType<typeof label>;
  private possessionHintText?: ReturnType<typeof label>;
  private possessionFill?: Graphics;
  private possessionBall?: ReturnType<typeof label>;
  private possessionBar?: { x: number; y: number; width: number; height: number };
  private eventScrollY = 0;
  private eventDrag?: { pointerId: number; startY: number; startScrollY: number };
  private moment: BattleMoment = {
    type: 'kickoff',
    title: '比赛开始',
    detail: '双方进入试探阶段，教练正在观察对手站位。',
    mood: 'normal'
  };

  protected build() {
    this.drawBackground();
    this.drawMatchHeader();
    if (!this.isBattleProcessDebug()) this.drawPossessionPanel();
    this.drawEventFeed();
  }

  enter() {
    super.enter();
    this.game.sound.play('kickoff');
  }

  update(deltaMs: number) {
    this.elapsed += deltaMs;
    if (this.timeText) this.timeText.text = this.clockText();
    if (this.isBattleProcessDebug()) return;
    this.updatePossessionPanel();
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
    this.possessionLeftText = undefined;
    this.possessionRightText = undefined;
    this.possessionHintText = undefined;
    this.possessionFill = undefined;
    this.possessionBall = undefined;
    this.possessionBar = undefined;
    this.build();
  }

  private drawBackground() {
    this.container.addChild(this.stadiumBackground());
    const shift = this.game.contentTopOffset;
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020817, alpha: 0.24 });
    shade.rect(0, 0, this.game.width, 350 + shift * 0.4);
    shade.fill({ color: 0x030817, alpha: 0.16 });
    shade.rect(0, 760 + shift, this.game.width, 520 + shift);
    shade.fill({ color: 0x020817, alpha: 0.2 });
    this.container.addChild(shade);
  }

  private drawMatchHeader() {
    const shift = this.game.contentTopOffset * 0.34;
    const y = 56 + shift;
    const title = headerTitleSprite('liveMatch', Math.min(this.game.width * 0.62, 245));
    title.x = this.game.width / 2 - title.width / 2;
    title.y = 32 + shift;

    const leftLogo = this.teamLogo(116, 0x2f8cff, 0x16e2ff, '蓝');
    leftLogo.x = 86;
    leftLogo.y = y + 116;
    const rightLogo = this.teamLogo(116, 0xffd34a, 0xff7042, 'AI');
    rightLogo.x = this.game.width - 86;
    rightLogo.y = y + 116;

    const leftTitle = label('我方球队', 27, palette.white, '900');
    leftTitle.anchor.set(0.5);
    leftTitle.x = leftLogo.x;
    leftTitle.y = y + 198;
    const leftClub = label('蓝焰俱乐部', 19, 0x2ee6d6, '900');
    leftClub.anchor.set(0.5);
    leftClub.x = leftLogo.x;
    leftClub.y = y + 232;
    const rightTitle = label('对手球队', 27, palette.white, '900');
    rightTitle.anchor.set(0.5);
    rightTitle.x = rightLogo.x;
    rightTitle.y = y + 198;
    const rightClub = label(this.game.battleSource.opponentName, 19, 0xfff1a8, '900');
    rightClub.anchor.set(0.5);
    rightClub.x = rightLogo.x;
    rightClub.y = y + 232;

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

    const timeBox = this.matchClockBox(178, 58);
    timeBox.x = this.game.width / 2 - 89;
    timeBox.y = y + 186;
    this.timeText = label(this.clockText(), 34, 0xffd632, '900');
    this.timeText.anchor.set(0.5);
    this.timeText.x = 89;
    this.timeText.y = 29;
    timeBox.addChild(this.timeText);
    this.container.addChild(title, leftLogo, rightLogo, leftTitle, leftClub, rightTitle, rightClub, score, timeBox);
  }

  private teamLogo(size: number, accent: number, secondary: number, mark: string) {
    const c = new Container();
    const frame = new Graphics();
    frame.roundRect(-size / 2, -size / 2, size, size, 18);
    frame.fill({ color: 0x071735, alpha: 0.96 });
    frame.stroke({ color: accent, alpha: 0.96, width: 5 });
    const glow = new Graphics();
    glow.roundRect(-size / 2 + 8, -size / 2 + 8, size - 16, size - 16, 14);
    glow.stroke({ color: secondary, alpha: 0.35, width: 2 });
    const shield = new Graphics();
    shield.poly([0, -size * 0.3, size * 0.28, -size * 0.18, size * 0.2, size * 0.22, 0, size * 0.34, -size * 0.2, size * 0.22, -size * 0.28, -size * 0.18]);
    shield.fill({ color: accent, alpha: 0.92 });
    shield.stroke({ color: 0xffffff, alpha: 0.65, width: 2 });
    const stripe = new Graphics();
    stripe.poly([-size * 0.2, -size * 0.08, size * 0.18, -size * 0.2, size * 0.12, -size * 0.05, -size * 0.22, size * 0.08]);
    stripe.fill({ color: secondary, alpha: 0.95 });
    const text = label(mark, mark.length > 1 ? 24 : 34, 0xffffff, '900');
    text.anchor.set(0.5);
    text.y = size * 0.02;
    const rating = label(String(Math.round(this.logoRating(mark))), 18, palette.white, '900');
    rating.x = -size / 2 - 11;
    rating.y = -size / 2 - 8;
    c.addChild(frame, glow, shield, stripe, text, rating);
    return c;
  }

  private logoRating(mark: string) {
    const lineup = mark === '蓝' ? this.game.lineup : this.opponentLineup();
    const players = lineup.map((slot) => slot.player).filter(Boolean) as PlayerCardData[];
    if (!players.length) return 72;
    return players.reduce((sum, player) => sum + player.rating, 0) / players.length;
  }

  private matchClockBox(width: number, height: number) {
    const c = new Container();
    const g = new Graphics();
    const cut = 20;
    g.poly([cut, 0, width - cut, 0, width, height / 2, width - cut, height, cut, height, 0, height / 2]);
    g.fill({ color: 0x07142b, alpha: 0.86 });
    g.stroke({ color: 0x177cff, alpha: 0.72, width: 2 });
    const inner = new Graphics();
    inner.poly([cut + 8, 7, width - cut - 8, 7, width - 10, height / 2, width - cut - 8, height - 7, cut + 8, height - 7, 10, height / 2]);
    inner.stroke({ color: 0x1deaff, alpha: 0.16, width: 2 });
    const glow = new Graphics();
    glow.rect(width * 0.18, height - 3, width * 0.64, 3);
    glow.fill({ color: 0x18e7ff, alpha: 0.52 });
    c.addChild(g, inner, glow);
    return c;
  }

  private drawEventFeed() {
    const layout = this.battleLayout();
    const debugAll = this.isBattleProcessDebug();
    const x = 22;
    const y = layout.eventY;
    const w = this.game.width - 44;
    const h = layout.eventHeight;
    const panel = new Graphics();
    panel.roundRect(x, y, w, h, 16);
    panel.fill({ color: 0x06142f, alpha: 0.72 });
    panel.stroke({ color: 0x2f8cff, alpha: 0.48, width: 2 });
    this.container.addChild(panel);

    const entries = this.eventEntries();
    const cardX = x + 18;
    const cardY = y + 18;
    const cardW = w - 36;
    const viewportW = cardW;
    const viewportH = h - 36;
    const gap = debugAll ? 6 : 10;
    const debugColumns = 2;
    const debugRows = Math.ceil(entries.length / debugColumns);
    const rowH = debugAll ? Math.min(66, Math.max(46, (h - 36 - gap * (debugRows - 1)) / debugRows)) : Math.min(96, Math.max(78, (h - 34) / 5.6));
    const rows = debugAll ? debugRows : entries.length;
    const contentH = Math.max(viewportH, rows * (rowH + gap) - gap);
    const maxScroll = Math.max(0, contentH - viewportH);
    this.eventScrollY = Math.max(0, Math.min(this.eventScrollY, maxScroll));

    const viewport = new Container();
    viewport.x = cardX;
    viewport.y = cardY;
    viewport.hitArea = new Rectangle(0, 0, viewportW, viewportH);
    viewport.eventMode = 'static';

    const viewportMask = new Graphics();
    viewportMask.roundRect(cardX, cardY, viewportW, viewportH, 10);
    viewportMask.fill(0xffffff);
    viewport.mask = viewportMask;
    this.container.addChild(viewportMask);

    const cardLayer = new Container();
    cardLayer.y = -this.eventScrollY;

    entries.forEach((entry, index) => {
      const col = debugAll ? index % debugColumns : 0;
      const row = debugAll ? Math.floor(index / debugColumns) : index;
      const debugCardW = (cardW - gap) / debugColumns;
      const rowX = debugAll ? col * (debugCardW + gap) : 0;
      const rowY = row * (rowH + gap);
      cardLayer.addChild(this.eventCard(entry, rowX, rowY, debugAll ? debugCardW : cardW, rowH));
    });
    viewport.addChild(cardLayer);
    this.container.addChild(viewport);

    if (maxScroll > 0) {
      const track = new Graphics();
      track.roundRect(x + w - 18, y + 76, 6, h - 120, 3);
      track.fill({ color: 0xffffff, alpha: 0.3 });
      const thumbH = Math.max(54, (viewportH / contentH) * (h - 120));
      const thumbY = y + 76 + (this.eventScrollY / maxScroll) * (h - 120 - thumbH);
      const scroll = new Graphics();
      scroll.roundRect(x + w - 19, thumbY, 8, thumbH, 4);
      scroll.fill({ color: 0x1ee47e, alpha: 0.9 });
      this.container.addChild(track, scroll);

      const applyScroll = (next: number) => {
        this.eventScrollY = Math.max(0, Math.min(next, maxScroll));
        cardLayer.y = -this.eventScrollY;
        const nextThumbY = y + 76 + (this.eventScrollY / maxScroll) * (h - 120 - thumbH);
        scroll.clear();
        scroll.roundRect(x + w - 19, nextThumbY, 8, thumbH, 4);
        scroll.fill({ color: 0x1ee47e, alpha: 0.9 });
      };

      viewport.on('wheel', (event) => {
        const deltaY = (event as unknown as { deltaY?: number }).deltaY ?? 0;
        applyScroll(this.eventScrollY + deltaY * 0.8);
      });
      viewport.on('pointerdown', (event: FederatedPointerEvent) => {
        this.eventDrag = { pointerId: event.pointerId, startY: event.global.y, startScrollY: this.eventScrollY };
      });
      viewport.on('pointermove', (event: FederatedPointerEvent) => {
        if (!this.eventDrag || this.eventDrag.pointerId !== event.pointerId) return;
        applyScroll(this.eventDrag.startScrollY - (event.global.y - this.eventDrag.startY) * 1.3);
      });
      const endDrag = (event: FederatedPointerEvent) => {
        if (this.eventDrag?.pointerId === event.pointerId) this.eventDrag = undefined;
      };
      viewport.on('pointerup', endDrag);
      viewport.on('pointerupoutside', endDrag);
      viewport.on('pointercancel', endDrag);
    }
  }

  private eventCard(entry: BattleEventEntry, x: number, y: number, width: number, height: number) {
    const c = new Container();
    c.x = x;
    c.y = y;
    const frame = this.eventCardFrame(entry);
    const base = Texture.from(GAME_EVENTS);
    const bg = new Sprite(new Texture({ source: base.source, frame }));
    bg.width = width;
    bg.height = height;
    c.addChild(bg);

    const textShade = new Graphics();
    textShade.roundRect(width * 0.31, height * 0.13, width * 0.56, height * 0.72, Math.max(7, height * 0.12));
    textShade.fill({ color: 0x020817, alpha: 0.46 });
    c.addChild(textShade);

    const accent = this.entryColor(entry.mood);
    const time = label(`${entry.time}'`, Math.round(height * 0.31), entry.mood === 'normal' ? 0xffd632 : accent, '900');
    time.anchor.set(0.5);
    time.x = width * 0.2;
    time.y = height * 0.5;

    const compact = width < 360;
    const actorText = entry.actor ? playerDisplayName(entry.actor) : entry.title;
    const title = this.eventTitleLine(
      this.trimEventText(actorText, compact ? 4 : 7),
      this.trimEventText(this.eventCardTitle(entry.title), compact ? 5 : 8),
      entry.players ?? (entry.player ? [entry.player] : []),
      Math.round(height * (compact ? 0.2 : 0.26)),
      accent,
      height
    );
    title.x = width * 0.35;
    title.y = height * 0.2;
    const detail = label(this.trimEventText(entry.text, compact ? 12 : 28), Math.round(height * (compact ? 0.15 : 0.19)), 0xe5efff, '700');
    detail.style.dropShadow = { color: 0x000000, blur: 4, distance: 2, alpha: 0.95, angle: Math.PI / 4 };
    detail.x = width * 0.35;
    detail.y = height * 0.55;
    c.addChild(time, title, detail);
    const cardMask = new Graphics();
    cardMask.roundRect(0, 0, width, height, Math.max(8, height * 0.14));
    cardMask.fill(0xffffff);
    c.addChild(cardMask);
    c.mask = cardMask;
    return c;
  }

  private eventTitleLine(actor: string, action: string, players: PlayerCardData[], size: number, color: number, cardHeight: number) {
    const c = new Container();
    const actorLabel = label(actor, size, color, '900');
    actorLabel.style.dropShadow = { color: 0x000000, blur: 4, distance: 2, alpha: 0.95, angle: Math.PI / 4 };
    c.addChild(actorLabel);
    let cursorX = actorLabel.width + Math.max(4, size * 0.22);
    if (players.length) {
      const avatarSize = Math.max(16, Math.min(24, cardHeight * 0.32));
      players.slice(0, 3).forEach((player, index) => {
        const avatar = this.eventPlayerAvatar(player, avatarSize, color);
        avatar.x = cursorX + avatarSize / 2 + index * (avatarSize * 0.68);
        avatar.y = size * 0.58;
        c.addChild(avatar);
      });
      cursorX += avatarSize + Math.max(0, players.slice(0, 3).length - 1) * (avatarSize * 0.68) + Math.max(5, size * 0.24);
    }
    const actionLabel = label(action, size, color, '900');
    actionLabel.style.dropShadow = { color: 0x000000, blur: 4, distance: 2, alpha: 0.95, angle: Math.PI / 4 };
    actionLabel.x = cursorX;
    c.addChild(actionLabel);
    return c;
  }

  private eventPlayerAvatar(player: PlayerCardData, size: number, color: number) {
    const c = new Container();
    const frame = new Graphics();
    frame.circle(0, 0, size / 2);
    frame.fill({ color: 0x071735, alpha: 0.96 });
    frame.stroke({ color, alpha: 0.9, width: 3 });
    const face = new Sprite(Texture.from(player.portrait));
    face.anchor.set(0.5);
    face.width = size - 6;
    face.height = size - 6;
    c.addChild(frame, face);
    return c;
  }

  private eventCardFrame(entry: BattleEventEntry) {
    const key = entry.eventType ?? this.eventCardKey(entry.title, entry.mood);
    const frame = GAME_EVENT_CARD_FRAMES[key];
    return new Rectangle(frame.x, frame.y, frame.width, frame.height);
  }

  private eventCardKey(title: string, mood: BattleEvent['mood']): GameEventCardKey {
    if (title === '黄牌') return 'yellow_card';
    if (title === '红牌') return 'red_card';
    if (title === '角球') return 'corner';
    if (title === '换人') return 'substitution';
    if (title === '伤停') return 'injury';
    if (title === '扑救') return 'save';
    if (title === '射门') return 'shot';
    if (title === '抢断') return 'tackle';
    if (title === '危险' || mood === 'bad') return 'attack';
    if (title === '进球') return 'goal';
    if (title === '配合') return 'assist';
    return 'whistle';
  }

  private eventCardTitle(title: string) {
    if (title === '进球') return '破门！';
    if (title === '射门') return '射门被扑';
    if (title === '角球') return '获得角球';
    if (title === '黄牌') return '吃到黄牌';
    if (title === '红牌') return '被罚下';
    if (title === '换人') return '换人调整';
    if (title === '伤停') return '伤停';
    if (title === '危险') return '危险时刻';
    if (title === '进攻') return '推进';
    if (title === '进球确认') return '进球有效';
    if (title === '拼抢') return '身体对抗';
    if (title === '助攻') return '送出助攻';
    if (title === '传球') return '关键传球';
    if (title === '抢断') return '完成抢断';
    if (title === '过人') return '连续过人';
    if (title === '哨响') return '裁判鸣哨';
    if (title === '越位') return '越位在先';
    if (title === '阵容') return '阵容变化';
    if (title === '受伤') return '受伤治疗';
    if (title === '球员受伤') return '倒地不起';
    if (title === '战术') return '战术调整';
    if (title === '补时') return '伤停补时';
    if (title === '半场') return '半场结束';
    if (title === '开球') return '比赛开始';
    if (title === '结束') return '比赛结束';
    return title;
  }

  private trimEventText(text: string, maxLength: number) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }

  private drawPossessionPanel() {
    const y = this.battleLayout().momentumY;
    const x = 22;
    const w = this.game.width - 44;
    const h = 206;
    const panel = this.momentumPanelBg(x, y, w, h);
    const titleCenterY = y + 46;
    const titleWingLeft = this.momentumWing(0x1a8cff);
    titleWingLeft.x = this.game.width / 2 - 150;
    titleWingLeft.y = titleCenterY;
    const titleWingRight = this.momentumWing(0x1a8cff, true);
    titleWingRight.x = this.game.width / 2 + 150;
    titleWingRight.y = titleCenterY;
    const title = label('比赛势头', 30, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = titleCenterY;
    const left = label('我方压制', 28, 0x24a8ff, '900');
    left.anchor.set(0, 0.5);
    left.x = x + 50;
    left.y = y + 112;
    const right = label('对方反击', 28, 0xff465d, '900');
    right.anchor.set(1, 0.5);
    right.x = x + w - 50;
    right.y = y + 112;
    const bar = new Graphics();
    const barX = x + 192;
    const barY = y + 98;
    const barW = w - 384;
    const barH = 34;
    const ball = label('⚽', 34, palette.white, '900');
    ball.anchor.set(0.5);
    ball.y = y + 115;
    const hint = label('', 25, 0x28f5ff, '900');
    hint.anchor.set(0.5);
    hint.x = this.game.width / 2;
    hint.y = y + 166;
    this.possessionLeftText = left;
    this.possessionRightText = right;
    this.possessionHintText = hint;
    this.possessionFill = bar;
    this.possessionBall = ball;
    this.possessionBar = { x: barX, y: barY, width: barW, height: barH };
    this.updatePossessionPanel();
    this.container.addChild(panel, titleWingLeft, titleWingRight, title, left, right, bar, ball, hint);
  }

  private momentumPanelBg(x: number, y: number, w: number, h: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 10);
    bg.fill({ color: 0x06142f, alpha: 0.84 });
    bg.stroke({ color: 0x178dff, alpha: 0.72, width: 2 });
    const corner = new Graphics();
    const s = 24;
    [
      [x + 8, y + 8, 1, 1],
      [x + w - 8, y + 8, -1, 1],
      [x + 8, y + h - 8, 1, -1],
      [x + w - 8, y + h - 8, -1, -1]
    ].forEach(([cx, cy, sx, sy]) => {
      corner.moveTo(cx, cy + sy * s);
      corner.lineTo(cx, cy);
      corner.lineTo(cx + sx * s, cy);
    });
    corner.stroke({ color: 0x1ca0ff, alpha: 0.9, width: 2 });
    const topGlow = new Graphics();
    topGlow.rect(x + w * 0.23, y - 2, w * 0.54, 4);
    topGlow.fill({ color: 0x17e7ff, alpha: 0.5 });
    c.addChild(bg, corner, topGlow);
    return c;
  }

  private momentumWing(color: number, flip = false) {
    const c = new Container();
    const g = new Graphics();
    for (let i = 0; i < 4; i += 1) {
      const offset = i * 16;
      g.poly([offset, -4, offset + 11, -4, offset + 4, 4, offset - 7, 4]);
      g.fill({ color, alpha: 0.82 - i * 0.08 });
    }
    c.addChild(g);
    if (flip) c.scale.x = -1;
    return c;
  }

  private battleLayout() {
    if (this.isBattleProcessDebug()) {
      const eventY = 314 + this.game.contentTopOffset * 0.28;
      return {
        momentumY: eventY,
        eventY,
        eventHeight: Math.max(500, this.game.height - eventY - 26)
      };
    }
    const momentumHeight = 206;
    const bottomPad = 44;
    const gap = 28;
    const momentumY = 316 + this.game.contentTopOffset * 0.52;
    const eventY = momentumY + momentumHeight + gap;
    return {
      momentumY,
      eventY,
      eventHeight: Math.max(420, this.game.height - bottomPad - eventY)
    };
  }

  private updatePossessionPanel() {
    if (!this.possessionLeftText || !this.possessionRightText || !this.possessionHintText || !this.possessionFill || !this.possessionBall || !this.possessionBar) return;
    const homeShare = this.currentPossessionShare();
    const { x, y, width, height } = this.possessionBar;
    const split = Math.max(0, Math.min(width, width * homeShare));
    const homeDominant = homeShare >= 0.54;
    const awayDominant = homeShare <= 0.46;
    this.possessionLeftText.text = homeDominant ? '我方压制' : '我方稳控';
    this.possessionRightText.text = awayDominant ? '对方压制' : '对方反击';
    this.possessionHintText.text = homeDominant ? '我方占据场上优势，继续保持！' : awayDominant ? '对方反击正在升温，注意回防！' : '双方拉锯中，寻找下一次机会！';
    this.possessionHintText.style.fill = homeDominant ? 0x28f5ff : awayDominant ? 0xffd34a : 0xdbe7ff;
    this.possessionFill.clear();
    this.drawMomentumArrows(this.possessionFill, x, y, split, height, 0x249dff, true);
    this.drawMomentumArrows(this.possessionFill, x + split, y, width - split, height, 0xff465d, false);
    this.possessionBall.x = x + split;
  }

  private drawMomentumArrows(g: Graphics, x: number, y: number, width: number, height: number, color: number, right: boolean) {
    const step = 25;
    const arrowW = 20;
    const arrowH = height;
    const count = Math.max(0, Math.floor(width / step));
    for (let i = 0; i < count; i += 1) {
      const px = right ? x + i * step : x + width - i * step - arrowW;
      const points = right
        ? [px, y, px + arrowW * 0.64, y, px + arrowW, y + arrowH / 2, px + arrowW * 0.64, y + arrowH, px, y + arrowH, px + arrowW * 0.36, y + arrowH / 2]
        : [px + arrowW, y, px + arrowW * 0.36, y, px, y + arrowH / 2, px + arrowW * 0.36, y + arrowH, px + arrowW, y + arrowH, px + arrowW * 0.64, y + arrowH / 2];
      g.poly(points);
      g.fill({ color, alpha: 0.38 + Math.min(0.5, i * 0.045) });
    }
  }

  private currentPossessionShare() {
    const homePower = this.lineupPower(this.game.lineup);
    const awayPower = this.lineupPower(this.opponentLineup());
    const powerSwing = Math.max(-0.11, Math.min(0.11, (homePower - awayPower) / 1200));
    const scoreSwing = Math.max(-0.08, Math.min(0.08, (this.scoreA - this.scoreB) * 0.035));
    const momentSwing = this.moment.team === 'home' ? 0.08 : this.moment.team === 'away' ? -0.08 : 0;
    const moodSwing = this.moment.mood === 'good' ? 0.035 : this.moment.mood === 'bad' ? -0.045 : 0;
    const t = this.elapsed * 0.001;
    const wave = Math.sin(t * 1.45) * 0.025 + Math.sin(t * 0.47 + 1.2) * 0.018;
    return Math.max(0.32, Math.min(0.78, 0.5 + powerSwing + scoreSwing + momentSwing + moodSwing + wave));
  }

  private lineupPower(lineup: LineupSlot[]) {
    const players = lineup.map((slot) => slot.player).filter(Boolean) as PlayerCardData[];
    if (!players.length) return lineup.length * 72;
    return players.reduce((sum, player) => sum + player.rating, 0) + (lineup.length - players.length) * 72;
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
    if (this.isBattleProcessDebug()) return this.debugBattleEntries();
    const current = {
      time: this.matchMinute(),
      title: this.cardTitle(),
      actor: this.playerName(this.moment.actor),
      player: this.moment.actor,
      players: this.moment.actors ?? (this.moment.actor ? [this.moment.actor] : []),
      text: this.moment.detail,
      mood: this.moment.mood,
      scoreA: this.scoreA,
      scoreB: this.scoreB
    };
    const history = this.events.map((event) => {
      const actor = this.eventActor(event.text);
      return {
        time: event.time,
        title: this.eventTitle(event),
        actor,
        player: this.findPlayerByName(actor),
        players: this.findPlayersByActor(actor),
        text: event.text,
        mood: event.mood,
        scoreA: event.scoreA,
        scoreB: event.scoreB
      };
    });
    const newest = history[0];
    if (newest && newest.time === current.time && newest.text === current.text) return history;
    return [current, ...history];
  }

  private debugBattleEntries(): BattleEventEntry[] {
    const home = (name: string) => this.findPlayerByName(name);
    const entries: BattleEventEntry[] = [
      { eventType: 'kick_off', time: 1, title: '开球', actor: '裁判', player: undefined, text: '哨声响起，比赛正式开始。', mood: 'normal', scoreA: 0, scoreB: 0 },
      { eventType: 'attack', time: 5, title: '进攻', actor: '哈兰德', player: undefined, text: '中路提速推进，防线被迫后撤。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'shot', time: 9, title: '射门', actor: '孙兴慜', player: home('孙兴慜'), text: '接球后直接起脚，门将飞身化解。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'save', time: 12, title: '扑救', actor: '门前险情', player: undefined, text: '门将飞身扑出近距离射门。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'offside', time: 16, title: '越位', actor: '姆巴佩', player: undefined, text: '前插过早，边裁举旗示意越位。', mood: 'normal', scoreA: 0, scoreB: 0 },
      { eventType: 'duel', time: 20, title: '拼抢', actor: '维尔茨', player: home('维尔茨'), text: '中场强硬对抗，赢下关键球权。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'pass', time: 24, title: '传球', actor: '罗一鸣', player: home('罗一鸣'), text: '长传转移，直接找到弱侧空当。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'assist', time: 28, title: '助攻', actor: '林浩', player: home('林浩'), text: '精准直塞，送出致命助攻。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'goal', time: 31, title: '进球', actor: '劳塔罗', player: home('劳塔罗'), text: '禁区内冷静推射，皮球应声入网。', mood: 'good', scoreA: 1, scoreB: 0 },
      { eventType: 'goal_confirm', time: 32, title: '进球确认', actor: 'VAR', player: undefined, text: '裁判确认进球有效，比分改写。', mood: 'good', scoreA: 1, scoreB: 0 },
      { eventType: 'yellow_card', time: 37, title: '黄牌', actor: '王涛', player: home('王涛'), text: '战术犯规，裁判出示黄牌警告。', mood: 'normal', scoreA: 1, scoreB: 0 },
      { eventType: 'corner', time: 42, title: '角球', actor: '蓝焰俱乐部', player: undefined, text: '获得角球，右侧角球开出。', mood: 'good', scoreA: 1, scoreB: 0 },
      { eventType: 'half_time', time: 45, title: '半场', actor: '裁判', player: undefined, text: '上半场结束，双方进入休息。', mood: 'normal', scoreA: 1, scoreB: 0 },
      { eventType: 'substitution', time: 52, title: '换人', actor: '蓝焰俱乐部', player: undefined, text: '教练进行人员调整，加强边路。', mood: 'normal', scoreA: 1, scoreB: 0 },
      { eventType: 'jersey_change', time: 56, title: '阵容', actor: '蓝焰俱乐部', player: undefined, text: '阵型切换，边翼卫位置前提。', mood: 'normal', scoreA: 1, scoreB: 0 },
      { eventType: 'tactic', time: 60, title: '战术', actor: '教练组', player: undefined, text: '临场调整，压迫强度继续提升。', mood: 'normal', scoreA: 1, scoreB: 0 },
      { eventType: 'tackle', time: 64, title: '抢断', actor: '凯恩', player: home('凯恩'), text: '倒地铲断，阻止对方快速反击。', mood: 'good', scoreA: 1, scoreB: 0 },
      { eventType: 'dribble', time: 68, title: '过人', actor: '孙兴慜', player: home('孙兴慜'), text: '连续变向摆脱，突破到禁区前沿。', mood: 'good', scoreA: 1, scoreB: 0 },
      { eventType: 'injury', time: 72, title: '受伤', actor: '队医', player: undefined, text: '队医进场检查，比赛短暂停顿。', mood: 'bad', scoreA: 1, scoreB: 0 },
      { eventType: 'player_injury', time: 75, title: '球员受伤', actor: '奥斯梅恩', player: home('奥斯梅恩'), text: '冲刺后倒地，需要简单治疗。', mood: 'bad', scoreA: 1, scoreB: 0 },
      { eventType: 'red_card', time: 81, title: '红牌', actor: '德布劳内', player: undefined, text: '犯规动作过大，被主裁直接罚下。', mood: 'bad', scoreA: 1, scoreB: 0 },
      { eventType: 'whistle', time: 87, title: '哨响', actor: '裁判', player: undefined, text: '裁判鸣哨，示意一次犯规。', mood: 'normal', scoreA: 2, scoreB: 0 },
      { eventType: 'timer', time: 90, title: '补时', actor: '第四官员', player: undefined, text: '场边举牌，伤停补时三分钟。', mood: 'normal', scoreA: 2, scoreB: 0 },
      { eventType: 'match_end', time: 90, title: '结束', actor: '裁判', player: undefined, text: '全场比赛结束，比分定格。', mood: 'normal', scoreA: 2, scoreB: 0 }
    ];
    return entries.map((entry) => ({ ...entry, players: entry.players ?? this.findPlayersByActor(entry.actor) }));
  }

  private isBattleProcessDebug() {
    if (!runtimeEnv.DEV) return false;
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    return params.get('battleEvents') === 'all' || globalThis.localStorage?.getItem(DEV_BATTLE_EVENTS_KEY) === '1';
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

  private findPlayerByName(name: string) {
    const cleanName = name.split(/[与和]/)[0]?.trim();
    if (!cleanName || cleanName.length > 8) return undefined;
    const players = [
      ...this.game.lineup.map((slot) => slot.player),
      ...this.opponentLineup().map((slot) => slot.player)
    ].filter(Boolean) as PlayerCardData[];
    return players.find((player) => {
      const displayName = playerDisplayName(player);
      return player.name === cleanName || displayName === cleanName || cleanName.includes(player.name) || player.name.includes(cleanName) || cleanName.includes(displayName) || displayName.includes(cleanName);
    });
  }

  private findPlayersByActor(actor: string) {
    const names = actor.split(/\s*(?:与|和|、|\/|&|\+)\s*/).map((name) => name.trim()).filter(Boolean);
    const result: PlayerCardData[] = [];
    names.forEach((name) => {
      const player = this.findPlayerByName(name);
      if (player && !result.some((item) => item.id === player.id)) result.push(player);
    });
    return result;
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
      return { type: 'goal', title: '进球', detail: `${this.playerName(scorer)} 接到 ${this.playerName(creator)} 的传球，冷静推射破门！`, mood: 'good', score: 'home', actor: scorer, actors: [scorer, creator].filter(Boolean) as PlayerCardData[], team: 'home' };
    }
    if (roll < 0.3) return { type: 'shot', title: '得分机会', detail: `${this.playerName(scorer)} 在禁区前沿获得起脚空间。`, mood: 'good', actor: scorer, team: 'home' };
    if (roll < 0.42) return { type: 'post', title: '击中门柱', detail: `${this.playerName(scorer)} 的劲射狠狠砸在门柱上弹出。`, mood: 'normal', actor: scorer, team: 'home' };
    if (roll < 0.54) return { type: 'corner', title: '角球机会', detail: `${this.playerName(creator)} 边路传中被挡出底线，获得角球。`, mood: 'good', actor: creator, team: 'home' };
    if (roll < 0.68) return { type: 'save', title: '精彩扑救', detail: `${this.playerName(defender)} 飞身将 ${this.playerName(awayAttacker)} 的近距离射门扑出。`, mood: 'good', actor: defender, actors: [defender, awayAttacker].filter(Boolean) as PlayerCardData[], team: 'home' };
    if (roll < 0.8) return { type: 'counter', title: '危险反击', detail: `${this.playerName(awayCreator)} 突然提速，${this.playerName(awayAttacker)} 已经前插到防线身后。`, mood: 'bad', actor: awayAttacker, actors: [awayCreator, awayAttacker].filter(Boolean) as PlayerCardData[], team: 'away' };
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
    return playerDisplayName(player);
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
