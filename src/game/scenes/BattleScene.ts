import { Container, FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { BattleEvent, LineupSlot, PlayerCardData, Position } from '../types';
import { playerDisplayName } from '../playerNames';
import type { GeneratedBattleMoment } from '../services/GameServerClient';
import { spreadEventMinutes } from '../battle/spreadEventMinutes';
import { headerTitleSprite, label, palette } from '../ui';

type MomentType = 'kickoff' | 'attack' | 'shot' | 'post' | 'corner' | 'save' | 'goal' | 'counter';
type GameEventCardKey = 'shot' | 'goal' | 'save' | 'corner' | 'yellow' | 'red' | 'injury' | 'sub';

const runtimeEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env ?? {};
const DEV_BATTLE_EVENTS_KEY = 'soccer.dev.battleEventsAll';
const DEV_BATTLE_STAY_KEY = 'soccer.dev.battleStay';
const DEV_BATTLE_AI_KEY = 'soccer.dev.battleAi';
const GAME_EVENTS = '/assets/ui/gameevents.png';
const GAME_EVENT_CARD_FRAMES: Record<GameEventCardKey, { x: number; y: number; width: number; height: number }> = {
  shot: { x: 25, y: 44, width: 675, height: 110 },
  goal: { x: 25, y: 165, width: 675, height: 110 },
  save: { x: 25, y: 286, width: 675, height: 110 },
  corner: { x: 25, y: 407, width: 675, height: 109 },
  yellow: { x: 25, y: 528, width: 675, height: 109 },
  red: { x: 25, y: 648, width: 675, height: 110 },
  injury: { x: 25, y: 769, width: 675, height: 110 },
  sub: { x: 25, y: 889, width: 675, height: 111 }
};

const OPPONENT_ACCENT = 0xff465d;
const HOME_ACCENT = 0x2f8cff;

const PREPARATION_HINTS = [
  'AI 正在编排比赛剧本...',
  '裁判检查场地与装备...',
  '双方球员热身完毕...',
  '正在同步实时战报...'
];

const FULL_TIME_EVENT_PAUSE_MS = 2400;
const ENDING_UI_DELAY_MS = 800;

const EVENT_CARD_LAYOUT = {
  timeX: 0.228,
  timeY: 0.5,
  textX: 0.32,
  titleY: 0.24,
  detailY: 0.66,
  shadeX: 0.29,
  shadeY: 0.14,
  shadeW: 0.26,
  shadeH: 0.72
} as const;

const GAME_EVENT_TYPE_ALIASES: Record<string, GameEventCardKey> = {
  yellow_card: 'yellow',
  red_card: 'red',
  substitution: 'sub',
  freekick: 'shot',
  free_kick: 'shot',
  wondergoal: 'goal',
  wonder_goal: 'goal',
  attack: 'shot',
  pass: 'shot',
  assist: 'shot',
  tackle: 'shot',
  duel: 'shot',
  dribble: 'shot',
  offside: 'shot',
  whistle: 'shot'
};

interface BattleMoment {
  type: MomentType;
  eventType?: GameEventCardKey | 'freekick' | 'wondergoal';
  title: string;
  detail: string;
  mood: BattleEvent['mood'];
  score?: 'home' | 'away';
  minute?: number;
  actor?: PlayerCardData;
  actorName?: string;
  actors?: PlayerCardData[];
  actorNames?: string[];
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
  team?: 'home' | 'away';
}

interface EventFeedState {
  x: number;
  y: number;
  w: number;
  h: number;
  cardX: number;
  cardY: number;
  cardW: number;
  viewportW: number;
  viewportH: number;
  gap: number;
  rowH: number;
  debugAll: boolean;
  viewport: Container;
  cardLayer: Container;
  viewportMask: Graphics;
  scroll?: Graphics;
  track?: Graphics;
  maxScroll: number;
}

interface EventCardAnimation {
  card: Container;
  age: number;
  duration: number;
  fromY: number;
  toY: number;
}

export class BattleScene extends BaseScene {
  private elapsed = 0;
  private lastPushElapsed = 0;
  private nextEventAt = 700;
  private readonly eventGapMs = 2800;
  private scoreA = 0;
  private scoreB = 0;
  private events: BattleEvent[] = [];
  private leftScoreText?: ReturnType<typeof label>;
  private rightScoreText?: ReturnType<typeof label>;
  private timeText?: ReturnType<typeof label>;
  private possessionLeftText?: ReturnType<typeof label>;
  private possessionRightText?: ReturnType<typeof label>;
  private possessionHintText?: ReturnType<typeof label>;
  private possessionFill?: Graphics;
  private possessionBall?: ReturnType<typeof label>;
  private possessionBar?: { x: number; y: number; width: number; height: number };
  private eventScrollY = 0;
  private eventDrag?: { pointerId: number; startY: number; startScrollY: number };
  private momentQueue: BattleMoment[] = [];
  private momentScriptLoading = false;
  private momentScriptDisabled = false;
  private momentScriptFetched = false;
  private preparationOverlay?: Container;
  private preparationSpinnerRoot?: Container;
  private preparationArc?: Container;
  private preparationHint?: ReturnType<typeof label>;
  private preparationTitle?: ReturnType<typeof label>;
  private preparationBar?: Graphics;
  private preparationElapsed = 0;
  private eventFeedState?: EventFeedState;
  private cardAnimations: EventCardAnimation[] = [];
  private eventPushPausedUntil = 0;
  private goalOverlay?: Container;
  private goalOverlayAge = 0;
  private battlePhase: 'live' | 'ending' = 'live';
  private fullTimeEventPushed = false;
  private endingReadyAt = 0;
  private endingOverlay?: Container;
  private moment: BattleMoment = {
    type: 'attack',
    eventType: 'shot',
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
    this.momentQueue = [];
    this.momentScriptDisabled = false;
    this.momentScriptFetched = false;
    this.lastPushElapsed = 0;
    this.eventPushPausedUntil = 0;
    this.cardAnimations = [];
    this.eventFeedState = undefined;
    this.battlePhase = 'live';
    this.fullTimeEventPushed = false;
    this.endingReadyAt = 0;
    this.clearEndingOverlayRefs();
    this.game.ensureHomeSubstitutes();
    this.game.sound.play('kickoff');
    this.ensureBattleScriptBuffer(true);
  }

  update(deltaMs: number) {
    this.elapsed += deltaMs;
    if (this.timeText) this.timeText.text = this.clockText();
    this.updateCardAnimations(deltaMs);
    this.updateGoalAnimation(deltaMs);
    this.updatePreparationOverlay(deltaMs);
    if (this.isBattleProcessDebug()) return;
    this.updatePossessionPanel();
    if (this.battlePhase === 'live' && this.isLiveBattleComplete()) {
      this.beginBattleEnding();
    }
    if (this.battlePhase === 'ending') {
      this.updateEndingPhase();
    }
    if (this.elapsed > this.nextEventAt) {
      if (this.elapsed < this.eventPushPausedUntil) {
        this.nextEventAt = this.eventPushPausedUntil;
      } else if (this.canPushNextEvent()) {
        this.pushEvent();
        this.nextEventAt += 2200 + Math.random() * 1400;
      } else {
        this.nextEventAt = this.elapsed + 500;
      }
    }
  }

  private saveBattleResult() {
    this.game.battleResult = { scoreA: this.scoreA, scoreB: this.scoreB, events: this.events };
  }

  private goToResult() {
    this.saveBattleResult();
    this.game.changeScene('result');
  }

  private continueAfterBattle() {
    this.saveBattleResult();
    const win = this.scoreA > this.scoreB;
    this.game.awardMatchRewards(win);
    void this.game.recordBattleResult();
    this.game.changeScene('home');
  }

  resize() {
    const preparing = this.momentScriptLoading;
    const endingUiVisible = this.battlePhase === 'ending' && this.endingReadyAt > 0;
    this.clearPreparationOverlayRefs();
    this.clearEndingOverlayRefs();
    this.container.removeChildren();
    this.eventFeedState = undefined;
    this.cardAnimations = [];
    this.possessionLeftText = undefined;
    this.possessionRightText = undefined;
    this.possessionHintText = undefined;
    this.possessionFill = undefined;
    this.possessionBall = undefined;
    this.possessionBar = undefined;
    this.build();
    if (preparing) this.showPreparationOverlay();
    if (endingUiVisible) this.showEndingOverlay();
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
    const rightLogo = this.teamLogo(116, OPPONENT_ACCENT, 0xff5d68, 'AI');
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
    score.y = y + 118;
    const scoreSize = 84;
    const colonSize = 68;
    this.leftScoreText = label(String(this.scoreA), scoreSize, 0x2f8cff, '900');
    this.leftScoreText.anchor.set(1, 0.5);
    this.leftScoreText.x = -38;
    const colon = label(':', colonSize, palette.white, '900');
    colon.anchor.set(0.5);
    this.rightScoreText = label(String(this.scoreB), scoreSize, 0xff5d68, '900');
    this.rightScoreText.anchor.set(0, 0.5);
    this.rightScoreText.x = 38;
    score.addChild(this.leftScoreText, colon, this.rightScoreText);

    const timeBox = this.matchClockBox(178, 58);
    timeBox.x = this.game.width / 2 - 89;
    timeBox.y = y + 176;
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
    c.addChild(frame, glow, shield, stripe, text);
    return c;
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
    const gap = debugAll ? 16 : 10;
    const debugColumns = 1;
    const debugRows = Math.ceil(entries.length / debugColumns);
    const aspectRowH = Math.ceil(cardW / this.eventCardAspect());
    const rowH = debugAll
      ? aspectRowH
      : Math.max(96, Math.min(aspectRowH, Math.round((h - 34) / 4.2)));
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

    viewport.addChild(cardLayer);
    this.container.addChild(viewport);

    this.eventFeedState = {
      x,
      y,
      w,
      h,
      cardX,
      cardY,
      cardW,
      viewportW,
      viewportH,
      gap,
      rowH,
      debugAll,
      viewport,
      cardLayer,
      viewportMask,
      maxScroll
    };

    this.populateEventCards(false);
    this.bindEventFeedScroll(viewport, cardLayer);
    this.ensureEventFeedScrollbar();
  }

  private bindEventFeedScroll(viewport: Container, cardLayer: Container) {
    if ((viewport as Container & { _scrollBound?: boolean })._scrollBound) return;
    (viewport as Container & { _scrollBound?: boolean })._scrollBound = true;

    const applyScroll = (next: number) => {
      const feed = this.eventFeedState;
      if (!feed) return;
      const rows = this.eventEntries().length;
      const liveContentH = Math.max(feed.viewportH, rows * (feed.rowH + feed.gap) - feed.gap);
      const liveMaxScroll = Math.max(0, liveContentH - feed.viewportH);
      feed.maxScroll = liveMaxScroll;
      this.eventScrollY = Math.max(0, Math.min(next, liveMaxScroll));
      cardLayer.y = -this.eventScrollY;
      this.ensureEventFeedScrollbar();
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

  private ensureEventFeedScrollbar() {
    const state = this.eventFeedState;
    if (!state) return;

    const rows = this.eventEntries().length;
    const contentH = Math.max(state.viewportH, rows * (state.rowH + state.gap) - state.gap);
    const maxScroll = Math.max(0, contentH - state.viewportH);
    state.maxScroll = maxScroll;
    this.eventScrollY = Math.max(0, Math.min(this.eventScrollY, maxScroll));
    state.cardLayer.y = -this.eventScrollY;

    if (maxScroll <= 0) {
      state.track?.destroy();
      state.scroll?.destroy();
      state.track = undefined;
      state.scroll = undefined;
      return;
    }

    const trackH = state.h - 120;
    const thumbH = Math.max(54, (state.viewportH / contentH) * trackH);
    const thumbY = state.y + 76 + (this.eventScrollY / maxScroll) * (trackH - thumbH);

    if (!state.track || !state.scroll) {
      const track = new Graphics();
      track.roundRect(state.x + state.w - 18, state.y + 76, 6, trackH, 3);
      track.fill({ color: 0xffffff, alpha: 0.3 });
      const scroll = new Graphics();
      scroll.roundRect(state.x + state.w - 19, thumbY, 8, thumbH, 4);
      scroll.fill({ color: 0x1ee47e, alpha: 0.9 });
      this.container.addChild(track, scroll);
      state.track = track;
      state.scroll = scroll;
      return;
    }

    state.scroll.clear();
    state.scroll.roundRect(state.x + state.w - 19, thumbY, 8, thumbH, 4);
    state.scroll.fill({ color: 0x1ee47e, alpha: 0.9 });
  }

  private refreshEventFeed(animateTop = false) {
    if (!this.eventFeedState) {
      this.drawEventFeed();
      if (animateTop) this.syncEventCards(this.eventEntries(), 0);
      return;
    }
    if (animateTop) this.eventScrollY = 0;
    this.syncEventCards(this.eventEntries(), animateTop ? 0 : -1);
    this.ensureEventFeedScrollbar();
  }

  private syncEventCards(entries: BattleEventEntry[], animateIndex: number) {
    const state = this.eventFeedState;
    if (!state) return;

    state.cardLayer.removeChildren();
    this.cardAnimations = this.cardAnimations.filter((anim) => anim.card.parent === state.cardLayer);

    entries.forEach((entry, index) => {
      const rowY = index * (state.rowH + state.gap);
      const cardW = state.debugAll ? (state.cardW - state.gap) : state.cardW;
      const card = this.eventCard(entry, 0, rowY, cardW, state.rowH, state.debugAll);
      state.cardLayer.addChild(card);
      if (index === animateIndex) this.playEventCardEnter(card, rowY);
    });

    state.cardLayer.y = -this.eventScrollY;
  }

  private populateEventCards(animateTop: boolean) {
    this.syncEventCards(this.eventEntries(), animateTop ? 0 : -1);
  }

  private updateEventFeedScroll() {
    this.ensureEventFeedScrollbar();
  }

  private playEventCardEnter(card: Container, targetY: number) {
    const rowH = this.eventFeedState?.rowH ?? 96;
    const gap = this.eventFeedState?.gap ?? 8;
    const offset = rowH + gap;
    card.y = targetY - offset;
    card.alpha = 0;
    card.scale.set(1);
    this.cardAnimations.push({ card, age: 0, duration: 420, fromY: targetY - offset, toY: targetY });
  }

  private updateCardAnimations(deltaMs: number) {
    this.cardAnimations = this.cardAnimations.filter((anim) => {
      anim.age += deltaMs;
      const t = Math.min(1, anim.age / anim.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      anim.card.y = anim.fromY + (anim.toY - anim.fromY) * eased;
      anim.card.alpha = eased;
      return anim.age < anim.duration;
    });
  }

  private eventCard(entry: BattleEventEntry, x: number, y: number, width: number, height: number, showType = false) {
    if (entry.title === '全场比赛结束') {
      return this.fullTimeEventCard(x, y, width, height, entry);
    }
    const c = new Container();
    c.x = x;
    c.y = y;
    const typeKey = this.normalizeEventType(entry.eventType ?? this.eventCardKey(entry.title, entry.mood));
    const frameRect = GAME_EVENT_CARD_FRAMES[typeKey];

    const cardMask = new Graphics();
    cardMask.roundRect(0, 0, width, height, Math.max(8, height * 0.14));
    cardMask.fill(0xffffff);
    c.addChild(cardMask);
    c.mask = cardMask;

    const base = Texture.from(GAME_EVENTS);
    const bg = new Sprite(
      new Texture({
        source: base.source,
        frame: this.eventCardTextureFrame(frameRect)
      })
    );
    this.fitEventCardSprite(bg, width, height);
    c.addChild(bg);

    const team = this.eventTeam(entry);
    const accent = this.entryAccent(entry, team);
    if (team === 'away') {
      const border = new Graphics();
      border.roundRect(1.5, 1.5, width - 3, height - 3, Math.max(8, height * 0.14));
      border.stroke({ color: OPPONENT_ACCENT, width: 2.5, alpha: 0.95 });
      c.addChild(border);
    }

    const textShade = new Graphics();
    const layout = this.eventCardLayout(entry);
    textShade.roundRect(
      width * layout.shadeX,
      height * layout.shadeY,
      width * layout.shadeW,
      height * layout.shadeH,
      Math.max(6, height * 0.1)
    );
    textShade.fill({ color: 0x020817, alpha: 0.34 });
    c.addChild(textShade);

    const time = label(`${entry.time}'`, Math.round(height * 0.26), accent, '900');
    time.anchor.set(0.5);
    time.x = width * layout.timeX;
    time.y = height * layout.timeY;

    const compact = width < 360;
    const actorText = entry.actor ? playerDisplayName(entry.actor) : entry.title;
    const title = this.eventTitleLine(
      this.trimEventText(actorText, compact ? 4 : 7),
      this.trimEventText(this.eventCardTitle(entry.title), compact ? 5 : 8),
      entry.players ?? (entry.player ? [entry.player] : []),
      Math.round(height * (compact ? 0.2 : 0.24)),
      accent,
      height
    );
    title.x = width * layout.textX;
    title.y = height * layout.titleY;
    const detailText = this.eventCardDetail(entry);
    const detail = label(this.trimEventText(detailText, compact ? 12 : 28), Math.round(height * (compact ? 0.15 : 0.18)), 0xe5efff, '700');
    detail.style.dropShadow = { color: 0x000000, blur: 4, distance: 2, alpha: 0.95, angle: Math.PI / 4 };
    detail.x = width * layout.textX;
    detail.y = height * layout.detailY;
    c.addChild(time, title, detail);

    if (showType) {
      const typeText = label(typeKey, Math.round(height * 0.17), 0xffef9c, '900');
      typeText.anchor.set(1, 0);
      typeText.x = width - 10;
      typeText.y = 5;
      const frameText = label(`${frameRect.x},${frameRect.y} ${frameRect.width}x${frameRect.height}`, Math.round(height * 0.14), 0x9fdcff, '700');
      frameText.anchor.set(1, 0);
      frameText.x = width - 10;
      frameText.y = 5 + typeText.height + 2;
      const badge = new Graphics();
      const badgeW = Math.max(typeText.width, frameText.width) + 14;
      const badgeH = typeText.height + frameText.height + 10;
      badge.roundRect(width - badgeW - 6, 3, badgeW, badgeH, 5);
      badge.fill({ color: 0x020817, alpha: 0.82 });
      badge.stroke({ color: 0x2f8cff, alpha: 0.75, width: 1 });
      c.addChild(badge, typeText, frameText);
    }

    return c;
  }

  private eventCardDetail(entry: BattleEventEntry) {
    if (this.normalizeEventType(entry.eventType) !== 'sub') return entry.text;
    return this.substitutionDetail(entry);
  }

  private substitutionDetail(entry: BattleEventEntry) {
    const players = entry.players ?? [];
    if (players.length >= 2) {
      return `${playerDisplayName(players[0])} 下，${playerDisplayName(players[1])} 上`;
    }
    if (entry.text.includes('下') && entry.text.includes('上')) return entry.text;
    return entry.text;
  }

  private eventCardTextureFrame(frameRect: { x: number; y: number; width: number; height: number }) {
    return new Rectangle(frameRect.x, frameRect.y, frameRect.width, frameRect.height);
  }

  private fitEventCardSprite(sprite: Sprite, cardW: number, cardH: number) {
    const scale = Math.min(cardW / sprite.texture.width, cardH / sprite.texture.height);
    sprite.scale.set(scale);
    sprite.x = (cardW - sprite.texture.width * scale) / 2;
    sprite.y = (cardH - sprite.texture.height * scale) / 2;
  }

  private eventCardAspect() {
    const frames = Object.values(GAME_EVENT_CARD_FRAMES);
    const averageHeight = frames.reduce((sum, frame) => sum + frame.height, 0) / frames.length;
    return GAME_EVENT_CARD_FRAMES.shot.width / averageHeight;
  }

  private eventCardLayout(_entry: BattleEventEntry) {
    return EVENT_CARD_LAYOUT;
  }

  private normalizeEventType(eventType?: string): GameEventCardKey {
    if (!eventType) return 'shot';
    if (eventType in GAME_EVENT_CARD_FRAMES) return eventType as GameEventCardKey;
    return GAME_EVENT_TYPE_ALIASES[eventType] ?? 'shot';
  }

  private eventTitleLine(actor: string, action: string, players: PlayerCardData[], size: number, color: number, cardHeight: number) {
    const c = new Container();
    let cursorX = 0;
    if (players.length) {
      const avatarSize = Math.max(28, Math.min(44, cardHeight * 0.52));
      players.slice(0, 3).forEach((player, index) => {
        const avatar = this.eventPlayerAvatar(player, avatarSize);
        avatar.x = cursorX + avatarSize / 2 + index * (avatarSize * 0.68);
        avatar.y = size * 0.58;
        c.addChild(avatar);
      });
      cursorX += avatarSize + Math.max(0, players.slice(0, 3).length - 1) * (avatarSize * 0.68) + Math.max(5, size * 0.24);
    }
    const actorLabel = label(actor, size, color, '900');
    actorLabel.style.dropShadow = { color: 0x000000, blur: 4, distance: 2, alpha: 0.95, angle: Math.PI / 4 };
    actorLabel.x = cursorX;
    c.addChild(actorLabel);
    cursorX += actorLabel.width + Math.max(4, size * 0.22);
    const actionLabel = label(action, size, color, '900');
    actionLabel.style.dropShadow = { color: 0x000000, blur: 4, distance: 2, alpha: 0.95, angle: Math.PI / 4 };
    actionLabel.x = cursorX;
    c.addChild(actionLabel);
    return c;
  }

  private eventPlayerAvatar(player: PlayerCardData, size: number) {
    const c = new Container();
    const face = new Sprite(Texture.from(player.portrait));
    face.anchor.set(0.5);
    face.width = size;
    face.height = size;
    const mask = new Graphics();
    mask.circle(0, 0, size / 2);
    mask.fill(0xffffff);
    c.addChild(mask, face);
    c.mask = mask;
    return c;
  }

  private eventCardFrame(entry: BattleEventEntry) {
    const key = this.normalizeEventType(entry.eventType ?? this.eventCardKey(entry.title, entry.mood));
    const frame = GAME_EVENT_CARD_FRAMES[key];
    return new Rectangle(frame.x, frame.y, frame.width, frame.height);
  }

  private eventCardKey(title: string, mood: BattleEvent['mood']): GameEventCardKey {
    if (title === '黄牌') return 'yellow';
    if (title === '红牌') return 'red';
    if (title === '角球') return 'corner';
    if (title === '换人') return 'sub';
    if (title === '伤停' || title === '受伤') return 'injury';
    if (title === '扑救') return 'save';
    if (title === '射门') return 'shot';
    if (title === '进球') return 'goal';
    if (mood === 'bad' && title === '危险') return 'yellow';
    return 'shot';
  }

  private eventCardTitle(title: string) {
    if (title === '进球') return '破门！';
    if (title === '射门') return '完成射门';
    if (title === '角球') return '获得角球';
    if (title === '黄牌') return '吃到黄牌';
    if (title === '红牌') return '被罚下';
    if (title === '换人') return '换人调整';
    if (title === '伤停' || title === '受伤') return '受伤治疗';
    if (title === '扑救') return '门前扑救';
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
    const right = label('对方反击', 28, OPPONENT_ACCENT, '900');
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
    const next = this.dequeueMoment() ?? this.createMoment();
    const newEvent: BattleEvent = {
      time: next.minute ?? this.matchMinute(),
      text: next.detail,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      mood: next.mood,
      eventType: next.eventType ?? this.eventTypeForMoment(next),
      title: next.title,
      actor: next.actorName ?? this.playerName(next.actor),
      relatedActors: next.actorNames ?? (next.actors?.map((player) => this.playerName(player)) ?? (next.actor ? [this.playerName(next.actor)] : [])),
      team: next.team
    };
    if (this.events[0] && this.isSameBattleEvent(newEvent, this.events[0])) return;

    this.moment = next;
    const scoringTeam = this.resolveScoringTeam(next);
    if (scoringTeam === 'home') this.scoreA += 1;
    if (scoringTeam === 'away') this.scoreB += 1;
    newEvent.scoreA = this.scoreA;
    newEvent.scoreB = this.scoreB;
    const isGoal = scoringTeam !== undefined;
    if (isGoal) this.game.sound.play('goal');
    else if (next.mood === 'bad') this.game.sound.play('danger');
    else if (next.mood === 'good') this.game.sound.play('confirm');
    else this.game.sound.play('tap');
    this.events.unshift(newEvent);
    if (this.normalizeEventType(newEvent.eventType) === 'sub' && newEvent.relatedActors && newEvent.relatedActors.length >= 2) {
      newEvent.text = `${playerDisplayName(newEvent.relatedActors[0])} 下，${playerDisplayName(newEvent.relatedActors[1])} 上`;
    }
    this.updateScoreDisplay();
    this.lastPushElapsed = this.elapsed;
    const entry = this.momentToEventEntry(next);
    const entries = this.eventEntries();
    const animateIndex = entries.findIndex((item) => this.isSameEventEntry(item, entry));
    if (this.eventFeedState) {
      if (animateIndex === 0 && this.eventScrollY < 8) this.eventScrollY = 0;
      this.syncEventCards(entries, animateIndex);
      this.ensureEventFeedScrollbar();
    } else {
      this.refreshEventFeed(true);
    }
    if (isGoal) {
      this.playGoalAnimation(scoringTeam ?? 'home');
      const goalPauseMs = 1400 + 2800;
      this.eventPushPausedUntil = this.elapsed + goalPauseMs;
      this.nextEventAt = this.eventPushPausedUntil;
    }
  }

  private playGoalAnimation(team: 'home' | 'away') {
    this.goalOverlay?.destroy({ children: true });
    this.goalOverlayAge = 0;
    const c = new Container();
    c.eventMode = 'none';
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020817, alpha: 0.64 });

    const accent = team === 'home' ? 0x27a2ff : 0xff536a;
    const banner = new Graphics();
    const bw = Math.min(this.game.width - 72, 560);
    const bh = 172;
    const bx = (this.game.width - bw) / 2;
    const by = this.game.height * 0.34;
    banner.roundRect(bx, by, bw, bh, 18);
    banner.fill({ color: 0x06142f, alpha: 0.94 });
    banner.stroke({ color: accent, alpha: 0.95, width: 3 });
    banner.rect(bx + 28, by + bh - 8, bw - 56, 4);
    banner.fill({ color: accent, alpha: 0.82 });

    const flash = new Graphics();
    flash.moveTo(bx + 40, by + 36);
    flash.lineTo(bx + bw - 36, by + 16);
    flash.lineTo(bx + bw - 92, by + 60);
    flash.lineTo(bx + 76, by + 86);
    flash.fill({ color: accent, alpha: 0.18 });

    const title = label(team === 'home' ? '破门!' : '对手破门', 58, team === 'home' ? 0x35a8ff : 0xff5d68, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = by + 66;
    title.style.dropShadow = { color: 0x000000, blur: 8, distance: 4, alpha: 0.95, angle: Math.PI / 4 };

    const sub = label(`${this.scoreA} : ${this.scoreB}`, 42, 0xffd632, '900');
    sub.anchor.set(0.5);
    sub.x = this.game.width / 2;
    sub.y = by + 122;

    const ball = label('⚽', 54, palette.white, '900');
    ball.anchor.set(0.5);
    ball.x = bx + bw - 72;
    ball.y = by + 82;

    c.addChild(shade, banner, flash, title, sub, ball);
    this.goalOverlay = c;
    this.container.addChild(c);
  }

  private updateGoalAnimation(deltaMs: number) {
    if (!this.goalOverlay) return;
    this.goalOverlayAge += deltaMs;
    const t = this.goalOverlayAge / 1400;
    const pulse = 1 + Math.sin(this.goalOverlayAge * 0.018) * 0.035;
    this.goalOverlay.scale.set(pulse);
    this.goalOverlay.x = (this.game.width * (1 - pulse)) / 2;
    this.goalOverlay.y = (this.game.height * (1 - pulse)) / 2;
    this.goalOverlay.alpha = t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
    if (this.goalOverlayAge >= 1400) {
      this.goalOverlay.destroy({ children: true });
      this.goalOverlay = undefined;
      this.goalOverlayAge = 0;
    }
  }

  private ensureBattleScriptBuffer(force = false) {
    if (!this.shouldUseBattleAi()) return;
    if (this.momentScriptLoading || this.momentScriptDisabled) return;
    if (!force && this.momentScriptFetched) return;

    this.momentScriptLoading = true;
    this.showPreparationOverlay();
    const startMinute = this.matchMinute();
    const pending: BattleMoment[] = [];
    void this.game.server.streamBattleScript(this.battleScriptPayload(), (moment) => {
      pending.push(this.toBattleMoment(moment));
    }).catch((error) => {
      this.momentScriptDisabled = true;
      console.warn('[battle-ai] script stream failed, falling back to local moments', error);
    }).finally(() => {
      this.momentQueue.push(...spreadEventMinutes(pending, startMinute));
      this.momentQueue.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
      this.momentScriptLoading = false;
      this.momentScriptFetched = true;
      this.hidePreparationOverlay();
    });
  }

  private showPreparationOverlay() {
    if (!this.shouldUseBattleAi() || this.preparationOverlay) return;

    const layout = this.battleLayout();
    const x = 22;
    const y = layout.eventY;
    const w = this.game.width - 44;
    const h = layout.eventHeight;
    const overlay = new Container();
    overlay.x = x;
    overlay.y = y;

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 16);
    bg.fill({ color: 0x041229, alpha: 0.94 });
    bg.stroke({ color: 0x2f8cff, alpha: 0.58, width: 2 });
    const shine = new Graphics();
    shine.rect(28, 0, Math.min(180, w * 0.34), 4);
    shine.fill({ color: 0x28d8ff, alpha: 0.48 });

    const centerX = w / 2;
    const centerY = h * 0.4;
    const spinner = this.preparationSpinner(Math.min(68, w * 0.13));
    spinner.x = centerX;
    spinner.y = centerY;

    const title = label('比赛准备中', 31, palette.white, '900');
    title.anchor.set(0.5);
    title.x = centerX;
    title.y = centerY + 92;
    this.preparationTitle = title;

    const hint = label(PREPARATION_HINTS[0], 20, 0x9fd4ff, '700');
    hint.anchor.set(0.5);
    hint.x = centerX;
    hint.y = title.y + 42;
    this.preparationHint = hint;

    const barW = Math.min(280, w - 80);
    const barX = (w - barW) / 2;
    const barY = hint.y + 38;
    const barTrack = new Graphics();
    barTrack.roundRect(barX, barY, barW, 8, 4);
    barTrack.fill({ color: 0x0a2a52, alpha: 0.92 });
    barTrack.stroke({ color: 0x1d6fd4, alpha: 0.45, width: 1 });
    const bar = new Graphics();
    bar.roundRect(barX, barY, barW * 0.34, 8, 4);
    bar.fill({ color: 0x28d8ff, alpha: 0.92 });
    this.preparationBar = bar;

    overlay.addChild(bg, shine, spinner, title, hint, barTrack, bar);
    overlay.eventMode = 'static';
    overlay.hitArea = new Rectangle(0, 0, w, h);
    this.container.addChild(overlay);
    this.preparationOverlay = overlay;
    this.preparationElapsed = 0;
  }

  private hidePreparationOverlay() {
    if (!this.preparationOverlay) return;
    this.container.removeChild(this.preparationOverlay);
    this.preparationOverlay.destroy({ children: true });
    this.clearPreparationOverlayRefs();
  }

  private clearPreparationOverlayRefs() {
    this.preparationOverlay = undefined;
    this.preparationSpinnerRoot = undefined;
    this.preparationArc = undefined;
    this.preparationHint = undefined;
    this.preparationTitle = undefined;
    this.preparationBar = undefined;
    this.preparationElapsed = 0;
  }

  private updatePreparationOverlay(deltaMs: number) {
    if (!this.preparationOverlay) return;
    this.preparationElapsed += deltaMs;
    const t = this.preparationElapsed * 0.001;
    if (this.preparationSpinnerRoot) {
      this.preparationSpinnerRoot.scale.set(1 + Math.sin(t * 2.4) * 0.014);
    }
    if (this.preparationArc) {
      this.preparationArc.rotation += deltaMs * 0.0042;
    }
    if (this.preparationTitle) {
      const dots = '.'.repeat((Math.floor(this.preparationElapsed / 420) % 3) + 1);
      this.preparationTitle.text = `比赛准备中${dots}`;
    }
    if (this.preparationHint) {
      const hintIndex = Math.floor(this.preparationElapsed / 2600) % PREPARATION_HINTS.length;
      this.preparationHint.text = PREPARATION_HINTS[hintIndex];
    }
    if (this.preparationBar) {
      const layout = this.battleLayout();
      const w = this.game.width - 44;
      const h = layout.eventHeight;
      const barW = Math.min(280, w - 80);
      const barX = (w - barW) / 2;
      const barY = (this.preparationHint?.y ?? h * 0.58) + 38;
      const sweep = (Math.sin(t * 2.8) + 1) / 2;
      const fillW = barW * 0.34;
      const maxX = barX + barW - fillW;
      this.preparationBar.clear();
      this.preparationBar.roundRect(barX + sweep * (maxX - barX), barY, fillW, 8, 4);
      this.preparationBar.fill({ color: 0x28d8ff, alpha: 0.92 });
    }
  }

  private preparationSpinner(radius: number) {
    const root = new Container();
    this.preparationSpinnerRoot = root;

    const arcLayer = new Container();
    this.preparationArc = arcLayer;
    this.preparationArcGlow(arcLayer, radius + 18, -Math.PI * 0.08, Math.PI * 0.52, HOME_ACCENT, 8, 0.92);
    this.preparationArcGlow(arcLayer, radius + 18, Math.PI * 0.38, Math.PI * 0.28, OPPONENT_ACCENT, 7, 0.88);
    this.preparationArcGlow(arcLayer, radius - 6, 0, Math.PI * 2, 0x1d8fff, 2, 0.42);

    const center = new Graphics();
    center.circle(0, 0, 34);
    center.fill({ color: 0x071936, alpha: 0.95 });
    center.circle(0, 0, 34);
    center.stroke({ color: 0x28d8ff, alpha: 0.9, width: 3 });
    const icon = label('⚽', 28, 0xffe45a, '900');
    icon.anchor.set(0.5);

    root.addChild(arcLayer, center, icon);
    return root;
  }

  private preparationArcGlow(target: Container, radius: number, start: number, span: number, color: number, width: number, alpha: number) {
    const end = start + span;
    const halo = new Graphics();
    halo.arc(0, 0, radius, start, end);
    halo.stroke({ color, alpha: alpha * 0.22, width: width + 10 });
    const core = new Graphics();
    core.arc(0, 0, radius, start, end);
    core.stroke({ color, alpha, width });
    target.addChild(halo, core);
  }

  private battleScriptPayload() {
    this.game.ensureHomeSubstitutes();
    return {
      minute: this.matchMinute(),
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      count: 12,
      homePlayers: this.squadForGeneration(this.game.lineup, this.game.substitutes),
      awayPlayers: this.squadForGeneration(this.opponentLineup(), this.opponentSubstitutes()),
      recentEvents: this.events.slice(0, 5).map((event) => ({
        time: event.time,
        text: event.text,
        mood: event.mood,
        eventType: event.eventType,
        title: event.title
      }))
    };
  }

  private dequeueMoment() {
    return this.momentQueue.shift();
  }

  private opponentSubstitutes() {
    return this.game.battleSource.opponentSubstitutes ?? [];
  }

  private squadForGeneration(lineup: LineupSlot[], substitutes: Array<PlayerCardData | undefined>) {
    const starters = lineup
      .map((slot) => slot.player ? {
        id: slot.player.id,
        displayName: playerDisplayName(slot.player),
        position: slot.position,
        rating: slot.player.rating,
        skill: slot.player.skill,
        role: 'starter' as const
      } : undefined)
      .filter(Boolean) as Array<{ id: string; displayName: string; position: string; rating: number; skill: string; role: 'starter' | 'bench' }>;
    const bench = substitutes
      .filter(Boolean)
      .map((player) => ({
        id: player!.id,
        displayName: playerDisplayName(player!),
        position: player!.position,
        rating: player!.rating,
        skill: player!.skill,
        role: 'bench' as const
      }));
    return [...starters, ...bench];
  }

  private updateScoreDisplay() {
    if (this.leftScoreText) this.leftScoreText.text = String(this.scoreA);
    if (this.rightScoreText) this.rightScoreText.text = String(this.scoreB);
  }

  private scoringTeamFromGenerated(moment: GeneratedBattleMoment): 'home' | 'away' | undefined {
    if (moment.eventType === 'goal' || moment.eventType === 'wondergoal') {
      return moment.score === 'home' || moment.score === 'away' ? moment.score : moment.team;
    }
    if (moment.eventType === 'freekick' && (moment.score === 'home' || moment.score === 'away')) {
      return moment.score;
    }
    return undefined;
  }

  private resolveScoringTeam(moment: BattleMoment): 'home' | 'away' | undefined {
    const rawType = moment.eventType;
    const isGoal = moment.type === 'goal'
      || rawType === 'goal'
      || rawType === 'wondergoal'
      || (rawType === 'freekick' && (moment.score === 'home' || moment.score === 'away'));
    if (!isGoal) return undefined;
    if (moment.score === 'home' || moment.score === 'away') return moment.score;
    return moment.team === 'away' ? 'away' : 'home';
  }

  private toBattleMoment(moment: GeneratedBattleMoment): BattleMoment {
    const sanitized = this.sanitizeGeneratedMoment(moment);
    const actors = sanitized.relatedActorNames
      .map((name) => this.findPlayerByName(name))
      .filter(Boolean) as PlayerCardData[];
    const score = this.scoringTeamFromGenerated(sanitized);
    const actor = this.findPlayerByName(sanitized.actorName) ?? actors[0];
    const preservedType = sanitized.eventType === 'freekick' || sanitized.eventType === 'wondergoal'
      ? sanitized.eventType
      : this.safeEventType(sanitized.eventType);
    return {
      type: this.momentTypeFromGenerated(sanitized.eventType),
      eventType: preservedType,
      title: sanitized.title,
      detail: sanitized.detail,
      mood: sanitized.mood,
      score,
      actor,
      actorName: playerDisplayName(sanitized.actorName),
      actors: actors.length ? actors : actor ? [actor] : [],
      actorNames: sanitized.relatedActorNames.map((name) => playerDisplayName(name)),
      team: sanitized.team,
      minute: sanitized.minute
    };
  }

  private sanitizeGeneratedMoment(moment: GeneratedBattleMoment): GeneratedBattleMoment {
    const cardEvents = new Set(['yellow', 'red']);
    const actorName = moment.actorName?.trim() ?? '';
    const isSystemActor = actorName === '裁判' || actorName === '教练组' || actorName.includes('裁判');
    if (!cardEvents.has(moment.eventType) || !isSystemActor) return moment;
    const relatedPlayer = moment.relatedActorNames.find((name) => name !== '裁判' && name !== '教练组' && !name.includes('裁判'));
    if (!relatedPlayer) return moment;
    return { ...moment, actorName: relatedPlayer };
  }

  private safeEventType(eventType?: string): GameEventCardKey | undefined {
    if (!eventType) return undefined;
    return this.normalizeEventType(eventType);
  }

  private momentTypeFromGenerated(eventType: string): MomentType {
    if (eventType === 'wondergoal' || eventType === 'goal') return 'goal';
    const type = this.normalizeEventType(eventType);
    if (type === 'goal') return 'goal';
    if (type === 'shot') return 'shot';
    if (type === 'save') return 'save';
    if (type === 'corner') return 'corner';
    if (type === 'yellow' || type === 'red') return 'counter';
    return 'attack';
  }

  private eventEntries() {
    if (this.isBattleProcessDebug()) return this.debugBattleEntries();
    return this.sortEventEntries(this.events.map((event) => this.battleEventToEntry(event)));
  }

  private battleEventToEntry(event: BattleEvent): BattleEventEntry {
    const actor = event.actor ?? this.eventActor(event.text);
    const relatedActors = event.relatedActors?.length ? event.relatedActors : [actor];
    const entry: BattleEventEntry = {
      eventType: this.safeEventType(event.eventType),
      time: event.time,
      title: this.eventTitle(event),
      actor,
      player: this.findPlayerByName(actor),
      players: this.findPlayersByNames(relatedActors),
      text: event.text,
      mood: event.mood,
      scoreA: event.scoreA,
      scoreB: event.scoreB,
      team: event.team
    };
    entry.text = this.eventCardDetail(entry);
    return entry;
  }

  private momentToEventEntry(moment: BattleMoment): BattleEventEntry {
    const actor = moment.actorName ?? this.playerName(moment.actor);
    const relatedActors = moment.actorNames ?? (moment.actors?.map((player) => this.playerName(player)) ?? (moment.actor ? [this.playerName(moment.actor)] : []));
    const players = moment.actors?.length
      ? moment.actors
      : this.findPlayersByNames(relatedActors);
    const entry: BattleEventEntry = {
      eventType: this.safeEventType(moment.eventType ?? this.eventTypeForMoment(moment)),
      time: moment.minute ?? this.matchMinute(),
      title: moment.title,
      actor,
      player: moment.actor,
      players,
      text: moment.detail,
      mood: moment.mood,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      team: moment.team
    };
    entry.text = this.eventCardDetail(entry);
    return entry;
  }

  private sortEventEntries(entries: BattleEventEntry[]) {
    return [...entries].sort((a, b) => b.time - a.time);
  }

  private isSameEventEntry(a: BattleEventEntry, b: BattleEventEntry) {
    const typeA = this.normalizeEventType(a.eventType);
    const typeB = this.normalizeEventType(b.eventType);
    const actorA = a.actor ? playerDisplayName(a.actor) : '';
    const actorB = b.actor ? playerDisplayName(b.actor) : '';
    return a.time === b.time && a.text === b.text && actorA === actorB && typeA === typeB;
  }

  private isSameBattleEvent(a: BattleEvent, b: BattleEvent) {
    const typeA = this.normalizeEventType(a.eventType);
    const typeB = this.normalizeEventType(b.eventType);
    const actorA = a.actor ? playerDisplayName(a.actor) : '';
    const actorB = b.actor ? playerDisplayName(b.actor) : '';
    return a.time === b.time && a.text === b.text && actorA === actorB && typeA === typeB;
  }

  private debugBattleEntries(): BattleEventEntry[] {
    const home = (name: string) => this.findPlayerByName(name);
    const entries: BattleEventEntry[] = [
      { eventType: 'shot', time: 9, title: '射门', actor: '孙兴慜', player: home('孙兴慜'), text: '接球后直接起脚，门将飞身化解。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'goal', time: 31, title: '进球', actor: '劳塔罗', player: home('劳塔罗'), text: '禁区内冷静推射，皮球应声入网。', mood: 'good', scoreA: 1, scoreB: 0 },
      { eventType: 'save', time: 12, title: '扑救', actor: '门将', player: undefined, text: '门将飞身扑出近距离射门。', mood: 'good', scoreA: 0, scoreB: 0 },
      { eventType: 'corner', time: 42, title: '角球', actor: '蓝焰俱乐部', player: undefined, text: '获得角球，右侧角球开出。', mood: 'good', scoreA: 1, scoreB: 0 },
      { eventType: 'yellow', time: 37, title: '黄牌', actor: '王涛', player: home('王涛'), text: '战术犯规，裁判出示黄牌警告。', mood: 'normal', scoreA: 1, scoreB: 0 },
      { eventType: 'red', time: 81, title: '红牌', actor: '德布劳内', player: undefined, text: '犯规动作过大，被主裁直接罚下。', mood: 'bad', scoreA: 1, scoreB: 0 },
      { eventType: 'injury', time: 72, title: '受伤', actor: '奥斯梅恩', player: home('奥斯梅恩'), text: '冲刺后倒地，需要简单治疗。', mood: 'bad', scoreA: 1, scoreB: 0 },
      { eventType: 'sub', time: 52, title: '换人', actor: '蓝焰俱乐部', player: undefined, text: '教练进行人员调整，加强边路。', mood: 'normal', scoreA: 1, scoreB: 0 }
    ];
    return entries.map((entry) => ({ ...entry, players: entry.players ?? this.findPlayersByActor(entry.actor) }));
  }

  private isBattleProcessDebug() {
    if (!runtimeEnv.DEV) return false;
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    return params.get('battleEvents') === 'all' || globalThis.localStorage?.getItem(DEV_BATTLE_EVENTS_KEY) === '1';
  }

  private isBattleStayDebug() {
    if (!runtimeEnv.DEV) return false;
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    return params.get('battleStay') === '1' || globalThis.localStorage?.getItem(DEV_BATTLE_STAY_KEY) === '1';
  }

  private isBattleAiEnabled() {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    if (params.get('battleAi') === '1') return true;
    if (params.get('battleAi') === '0') return false;
    return globalThis.localStorage?.getItem(DEV_BATTLE_AI_KEY) === '1';
  }

  private shouldUseBattleAi() {
    if (!this.game.server.enabled || this.isBattleProcessDebug()) return false;
    if (runtimeEnv.DEV) return this.isBattleAiEnabled();
    return true;
  }

  private eventTitle(event: BattleEvent) {
    if (event.title) return event.title;
    const eventType = this.safeEventType(event.eventType);
    if (eventType) return this.titleForEventType(eventType);
    if (event.text.includes('破门') || event.text.includes('进球') || event.text.includes('入网')) return '进球';
    if (/射门|起脚|远射|抽射|推射|劲射|打门/.test(event.text)) return '射门';
    if (event.text.includes('抢断')) return '抢断';
    if (event.text.includes('角球')) return '角球';
    if (event.text.includes('扑')) return '扑救';
    if (event.mood === 'bad') return '危险';
    return '配合';
  }

  private titleForEventType(eventType: GameEventCardKey) {
    const titles: Record<GameEventCardKey, string> = {
      shot: '射门',
      goal: '进球',
      save: '扑救',
      corner: '角球',
      yellow: '黄牌',
      red: '红牌',
      injury: '受伤',
      sub: '换人'
    };
    return titles[eventType];
  }

  private eventTypeForMoment(moment: BattleMoment): GameEventCardKey {
    if (moment.eventType) return this.normalizeEventType(moment.eventType);
    if (moment.score || moment.type === 'goal') return 'goal';
    if (moment.type === 'corner') return 'corner';
    if (moment.type === 'save') return 'save';
    return 'shot';
  }

  private eventActor(text: string) {
    return text.split(/[ ，,]/)[0] || '球员';
  }

  private findPlayerByName(name: string) {
    const cleanName = name.split(/[与和]/)[0]?.trim();
    if (!cleanName || cleanName.length > 8) return undefined;
    const players = [
      ...this.game.lineup.map((slot) => slot.player),
      ...this.game.substitutes,
      ...this.opponentLineup().map((slot) => slot.player),
      ...this.opponentSubstitutes()
    ].filter(Boolean) as PlayerCardData[];
    return players.find((player) => {
      const displayName = playerDisplayName(player);
      return player.name === cleanName || displayName === cleanName || cleanName.includes(player.name) || player.name.includes(cleanName) || cleanName.includes(displayName) || displayName.includes(cleanName);
    });
  }

  private findPlayersByActor(actor: string) {
    const names = actor.split(/\s*(?:与|和|、|\/|&|\+)\s*/).map((name) => name.trim()).filter(Boolean);
    return this.findPlayersByNames(names);
  }

  private findPlayersByNames(names: string[]) {
    const result: PlayerCardData[] = [];
    names.forEach((name) => {
      const player = this.findPlayerByName(name);
      if (player && !result.some((item) => item.id === player.id)) result.push(player);
    });
    return result;
  }

  private entryAccent(_entry: BattleEventEntry, team: 'home' | 'away') {
    return team === 'away' ? OPPONENT_ACCENT : HOME_ACCENT;
  }

  private eventTeam(entry: BattleEventEntry): 'home' | 'away' {
    if (entry.team) return entry.team;
    const players = entry.players?.length ? entry.players : entry.player ? [entry.player] : [];
    if (players.some((player) => this.opponentLineup().some((slot) => slot.player?.id === player.id) || this.opponentSubstitutes().some((bench) => bench?.id === player.id))) return 'away';
    const actor = entry.actor?.trim();
    if (actor) {
      for (const slot of this.opponentLineup()) {
        if (slot.player && playerDisplayName(slot.player) === actor) return 'away';
      }
      for (const bench of this.opponentSubstitutes()) {
        if (bench && playerDisplayName(bench) === actor) return 'away';
      }
    }
    return 'home';
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
      return { type: 'goal', eventType: 'goal', title: '进球', detail: `${this.playerName(scorer)} 接到 ${this.playerName(creator)} 的传球，冷静推射破门！`, mood: 'good', score: 'home', actor: scorer, actors: [scorer, creator].filter(Boolean) as PlayerCardData[], team: 'home' };
    }
    if (roll < 0.3) return { type: 'shot', eventType: 'shot', title: '射门', detail: `${this.playerName(scorer)} 在禁区前沿获得起脚空间。`, mood: 'good', actor: scorer, team: 'home' };
    if (roll < 0.42) return { type: 'shot', eventType: 'shot', title: '射门', detail: `${this.playerName(scorer)} 的劲射狠狠砸在门柱上弹出。`, mood: 'normal', actor: scorer, team: 'home' };
    if (roll < 0.54) return { type: 'corner', eventType: 'corner', title: '角球', detail: `${this.playerName(creator)} 边路传中被挡出底线，获得角球。`, mood: 'good', actor: creator, team: 'home' };
    if (roll < 0.68) return { type: 'save', eventType: 'save', title: '扑救', detail: `${this.playerName(defender)} 飞身将 ${this.playerName(awayAttacker)} 的近距离射门扑出。`, mood: 'good', actor: defender, actors: [defender, awayAttacker].filter(Boolean) as PlayerCardData[], team: 'home' };
    if (roll < 0.76) return { type: 'counter', eventType: 'yellow', title: '黄牌', detail: `${this.playerName(defender)} 战术犯规，裁判出示黄牌。`, mood: 'normal', actor: defender, team: 'home' };
    if (roll < 0.82) {
      const team: 'home' | 'away' = Math.random() < 0.55 ? 'home' : 'away';
      const off = this.pickPlayer(team === 'home' ? this.game.lineup : this.opponentLineup(), ['MF', 'FW', 'DF']);
      const on = this.pickSubstitute(team);
      if (off && on) {
        const offName = this.playerName(off);
        const onName = this.playerName(on);
        return {
          type: 'counter',
          eventType: 'sub',
          title: '换人',
          detail: `${offName} 下，${onName} 上`,
          mood: 'normal',
          actorName: '教练组',
          actorNames: [offName, onName],
          actors: [off, on],
          team
        };
      }
      return { type: 'counter', eventType: 'sub', title: '换人', detail: '教练做出换人调整。', mood: 'normal', team: 'home' };
    }
    if (roll < 0.86) return { type: 'counter', eventType: 'injury', title: '受伤', detail: `${this.playerName(scorer)} 拼抢后倒地，队医进场检查。`, mood: 'bad', actor: scorer, team: 'home' };
    if (roll < 0.94) return { type: 'counter', eventType: 'red', title: '红牌', detail: `${this.playerName(awayScorer)} 犯规动作过大，被主裁直接罚下。`, mood: 'bad', actor: awayScorer, team: 'away' };
    return { type: 'shot', eventType: 'shot', title: '射门', detail: `${this.playerName(creator)} 连续传导，耐心寻找最后一传。`, mood: 'normal', actor: creator, team: 'home' };
  }

  private opponentLineup() {
    return this.game.battleSource.opponentLineup ?? [];
  }

  private pickSubstitute(team: 'home' | 'away') {
    const pool = (team === 'home' ? this.game.substitutes : this.opponentSubstitutes())
      .filter(Boolean) as PlayerCardData[];
    if (!pool.length) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
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
    if (this.moment.title) return this.moment.title;
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
    if (this.shouldUseBattleAi()) return this.matchClockMinute();
    return Math.max(1, Math.min(90, Math.round((this.elapsed / 26000) * 90)));
  }

  private matchClockMinute() {
    return Math.max(1, Math.min(90, this.moment.minute ?? this.events[0]?.time ?? 1));
  }

  private clockText() {
    if (this.battlePhase === 'ending' && this.fullTimeEventPushed) {
      return '90:00';
    }
    if (!this.shouldUseBattleAi()) {
      const totalSeconds = Math.max(0, Math.min(90 * 60, Math.floor((this.elapsed / 26000) * 90 * 60)));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = String(totalSeconds % 60).padStart(2, '0');
      return `${minutes}:${seconds}`;
    }

    const current = this.matchClockMinute();
    const next = this.momentQueue[0]?.minute;
    if (!next || next <= current) {
      const tick = Math.floor((this.elapsed - this.lastPushElapsed) / 1000) % 60;
      return `${current}:${String(tick).padStart(2, '0')}`;
    }

    const progress = Math.min(1, (this.elapsed - this.lastPushElapsed) / this.eventGapMs);
    const minute = Math.max(current, Math.min(next, Math.floor(current + (next - current) * progress)));
    const second = Math.floor(progress * 60) % 60;
    return `${minute}:${String(second).padStart(2, '0')}`;
  }

  private canPushNextEvent() {
    if (this.battlePhase !== 'live') return false;
    if (!this.shouldUseBattleAi()) return true;
    if (this.momentQueue.length > 0) return true;
    if (this.momentScriptLoading) return false;
    return this.momentScriptDisabled;
  }

  private isLiveBattleComplete() {
    if (this.isBattleStayDebug()) return false;
    if (this.shouldUseBattleAi()) {
      if (this.momentScriptLoading || this.momentQueue.length > 0) return false;
      if (this.events.length < 3) return false;
      return !this.momentScriptDisabled;
    }
    return this.elapsed > 26000;
  }

  private beginBattleEnding() {
    if (this.battlePhase !== 'live') return;
    this.battlePhase = 'ending';
  }

  private isBattleSettled() {
    if (this.goalOverlay) return false;
    if (this.elapsed < this.eventPushPausedUntil) return false;
    if (this.cardAnimations.length > 0) return false;
    return true;
  }

  private updateEndingPhase() {
    if (!this.isBattleSettled()) return;

    if (!this.fullTimeEventPushed) {
      this.pushFullTimeEvent();
      return;
    }

    if (this.endingReadyAt === 0) {
      if (this.elapsed < this.eventPushPausedUntil + ENDING_UI_DELAY_MS) return;
      this.endingReadyAt = this.elapsed;
      this.showEndingOverlay();
    }
  }

  private pushFullTimeEvent() {
    if (this.fullTimeEventPushed) return;

    const newEvent: BattleEvent = {
      time: 90,
      text: `最终比分 ${this.scoreA} : ${this.scoreB}`,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      mood: 'good',
      eventType: 'fulltime',
      title: '全场比赛结束',
      actor: '裁判'
    };
    if (this.events[0] && this.isSameBattleEvent(newEvent, this.events[0])) {
      this.fullTimeEventPushed = true;
      return;
    }

    this.fullTimeEventPushed = true;
    this.game.sound.play('confirm');
    this.events.unshift(newEvent);
    this.lastPushElapsed = this.elapsed;
    this.eventPushPausedUntil = this.elapsed + FULL_TIME_EVENT_PAUSE_MS;
    this.nextEventAt = this.eventPushPausedUntil;

    const entry = this.battleEventToEntry(newEvent);
    const entries = this.eventEntries();
    const animateIndex = entries.findIndex((item) => this.isSameEventEntry(item, entry));
    if (this.eventFeedState) {
      if (animateIndex === 0 && this.eventScrollY < 8) this.eventScrollY = 0;
      this.syncEventCards(entries, animateIndex);
      this.ensureEventFeedScrollbar();
    } else {
      this.refreshEventFeed(true);
    }
  }

  private fullTimeEventCard(x: number, y: number, width: number, height: number, entry: BattleEventEntry) {
    const c = new Container();
    c.x = x;
    c.y = y;

    const cardMask = new Graphics();
    cardMask.roundRect(0, 0, width, height, Math.max(8, height * 0.14));
    cardMask.fill(0xffffff);
    c.addChild(cardMask);
    c.mask = cardMask;

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, Math.max(8, height * 0.14));
    bg.fill({ color: 0x0a2f1f, alpha: 0.96 });
    bg.stroke({ color: 0x3dff8f, alpha: 0.92, width: 2.5 });
    const shine = new Graphics();
    shine.rect(width * 0.04, 0, width * 0.42, height * 0.08);
    shine.fill({ color: 0x7dffb8, alpha: 0.28 });
    bg.addChild(shine);

    const stripe = new Graphics();
    stripe.rect(width * 0.72, height * 0.12, width * 0.22, height * 0.76);
    stripe.fill({ color: 0x1cff9a, alpha: 0.08 });
    bg.addChild(stripe);

    const time = label(`${entry.time}'`, Math.round(height * 0.26), 0x7dffb8, '900');
    time.anchor.set(0.5);
    time.x = width * 0.12;
    time.y = height * 0.5;

    const icon = label('🏁', Math.round(height * 0.34), 0xffe45a, '900');
    icon.anchor.set(0.5);
    icon.x = width * 0.24;
    icon.y = height * 0.5;

    const title = label('全场比赛结束', Math.round(height * 0.24), palette.white, '900');
    title.x = width * 0.32;
    title.y = height * 0.24;

    const detail = label(entry.text, Math.round(height * 0.18), 0xd8ffe9, '700');
    detail.x = width * 0.32;
    detail.y = height * 0.62;

    c.addChild(bg, time, icon, title, detail);
    return c;
  }

  private showEndingOverlay() {
    if (this.endingOverlay) return;

    const overlay = new Container();
    const btnW = Math.min(248, (this.game.width - 82) / 2);
    const btnH = 66;
    const btnY = this.game.height - btnH - 48 - this.game.contentTopOffset * 0.2;
    const continueBtn = this.actionButton(btnW, btnH, '继续游戏', 0x0b62d8, 0x2aa0ff, false);
    continueBtn.x = 41;
    continueBtn.y = btnY;
    continueBtn.on('pointertap', () => {
      this.game.sound.play('confirm');
      this.continueAfterBattle();
    });

    const summaryBtn = this.actionButton(btnW, btnH, '查看赛后总结', 0xffc341, 0xfff0a2, true);
    summaryBtn.x = this.game.width - 41 - btnW;
    summaryBtn.y = btnY;
    summaryBtn.on('pointertap', () => {
      this.game.sound.play('tap');
      this.goToResult();
    });

    overlay.addChild(continueBtn, summaryBtn);
    this.container.addChild(overlay);
    this.endingOverlay = overlay;

    if (this.possessionHintText) {
      this.possessionHintText.text = '比赛已结束，可查看总结或继续游戏';
      this.possessionHintText.style.fill = 0x7dffb8;
    }
  }

  private clearEndingOverlayRefs() {
    if (this.endingOverlay) {
      this.endingOverlay.destroy({ children: true });
    }
    this.endingOverlay = undefined;
  }

  private actionButton(width: number, height: number, text: string, fill: number, stroke: number, gold: boolean) {
    const button = new Container();
    const glow = new Graphics();
    glow.roundRect(-8, -8, width + 16, height + 16, 12);
    glow.fill({ color: fill, alpha: 0.22 });
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 8);
    bg.fill({ color: fill, alpha: 0.96 });
    bg.stroke({ color: stroke, alpha: 0.95, width: 3 });
    const top = new Graphics();
    top.roundRect(8, 8, width - 16, height * 0.34, 8);
    top.fill({ color: 0xffffff, alpha: gold ? 0.22 : 0.1 });
    const title = label(text, 28, gold ? 0x452600 : palette.white, '900');
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = height / 2 + 1;
    button.addChild(glow, bg, top, title);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    return button;
  }

}
