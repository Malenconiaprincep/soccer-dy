import { _decorator, Color, Component, Graphics, Label, macro, Node, ResolutionPolicy, sys, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { GameState } from '../domain/GameState';
import { formations } from '../domain/data';
import type { BattleEvent, PlayerCardData } from '../domain/types';
import { GameServerClient } from '../services/GameServerClient';
import { GameAudio } from './GameAudio';
import { addCoverImage, addFrameImage, addImage } from './ImageUi';
import { button, colors, DESIGN_HEIGHT, DESIGN_WIDTH, divider, formatNumber, layer, panel, sectionTitle, text } from './UiFactory';

const { ccclass } = _decorator;
type ScreenName = 'loading' | 'home' | 'shop' | 'formation' | 'blindBox' | 'matchmaking' | 'matchup' | 'battle' | 'result';

interface BattleMoment {
  title: string;
  detail: string;
  team?: 'home' | 'away';
  goal?: boolean;
  eventType?: string;
  mood: BattleEvent['mood'];
}

const LOCAL_MOMENTS: BattleMoment[] = [
  { title: '比赛开始', detail: '双方在中场展开争夺。', eventType: 'shot', mood: 'normal' },
  { title: '快速推进', detail: '边路连续传递，进攻进入危险区域。', team: 'home', eventType: 'shot', mood: 'good' },
  { title: '门将扑救', detail: '对方射门被门将稳稳抱住。', team: 'away', eventType: 'save', mood: 'good' },
  { title: '进球', detail: '禁区内冷静推射，皮球滚入网窝！', team: 'home', goal: true, eventType: 'goal', mood: 'good' },
  { title: '黄牌', detail: '防守动作过大，裁判出示黄牌。', team: 'away', eventType: 'yellow', mood: 'bad' },
  { title: '反击', detail: '对手抓住身后空间形成单刀。', team: 'away', eventType: 'shot', mood: 'bad' },
  { title: '角球', detail: '高球传入禁区，双方争抢第一点。', team: 'home', eventType: 'corner', mood: 'normal' },
  { title: '远射', detail: '禁区外突然起脚，皮球擦柱而出。', team: 'away', eventType: 'shot', mood: 'bad' },
  { title: '全场结束', detail: '裁判吹响终场哨。', eventType: 'shot', mood: 'normal' }
];

@ccclass('GameRoot')
export class GameRoot extends Component {
  private readonly state = new GameState();
  private readonly server = new GameServerClient();
  private screenHost?: Node;
  private screen?: Node;
  private current: ScreenName = 'loading';
  private matchTicket?: string;
  private matchCancelled = false;
  private battleEvents: BattleEvent[] = [];
  private scoreA = 0;
  private scoreB = 0;
  private battleIndex = 0;
  private battleClock?: Label;
  private battleScoreHome?: Label;
  private battleScoreAway?: Label;
  private battleEventLayer?: Node;
  private battlePossession?: Graphics;
  private battlePossessionBall?: Label;
  private battlePossessionHint?: Label;
  private battlePossessionLeft?: Label;
  private battlePossessionRight?: Label;
  private screenMount?: Node;
  private modal?: Node;
  private followVisitStarted = false;
  private followMessage = '';
  private selectedLineupSlotId?: string;
  private selectedBenchIndex?: number;
  private revealedScoutIds = new Set<string>();
  private shopMessage = '';

  onLoad(): void {
    console.info('[soccer] GameRoot starting');
    GameAudio.attach(this.node);
    view.setOrientation(macro.ORIENTATION_PORTRAIT);
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_WIDTH);
    this.state.load();
    this.screenMount = this.node.getChildByName('RuntimeScreens') ?? this.node;

    // Creator applies the new design resolution at the end of the frame. Waiting
    // here prevents the loading background from being sized with the old viewport.
    this.scheduleOnce(() => {
      this.show('loading');
      this.scheduleOnce(() => this.show('home'), 0.8);
    }, 0);
  }

  onDestroy(): void {
    this.unscheduleAllCallbacks();
    void this.cancelMatch();
  }

  private show(name: ScreenName): void {
    this.unscheduleAllCallbacks();
    this.screenHost?.destroy();
    this.modal = undefined;
    this.current = name;
    (globalThis as typeof globalThis & { __SOCCER_COCOS_SCREEN__?: ScreenName }).__SOCCER_COCOS_SCREEN__ = name;
    const canvas = globalThis.document?.querySelector('canvas') as { dataset?: Record<string, string> } | null | undefined;
    if (canvas?.dataset) canvas.dataset.soccerScreen = name;
    const visible = view.getVisibleSize();
    const safe = sys.getSafeAreaRect(false);
    this.screenHost = layer(`Screen:${name}`, this.screenMount ?? this.node, visible.width, visible.height);
    const graphics = this.screenHost.addComponent(Graphics);
    graphics.fillColor = colors.background;
    graphics.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    graphics.fill();

    this.screen = layer('SafeContent', this.screenHost);
    const contentScale = Math.min(1, safe.width / DESIGN_WIDTH, safe.height / DESIGN_HEIGHT);
    this.screen.setScale(contentScale, contentScale, 1);
    this.screen.setPosition(
      safe.x + safe.width / 2 - visible.width / 2,
      safe.y + safe.height / 2 - visible.height / 2
    );

    if (name === 'loading') this.renderLoading();
    if (name === 'home') this.renderHome();
    if (name === 'shop') this.renderShop();
    if (name === 'formation') this.renderFormation();
    if (name === 'blindBox') this.renderBlindBox();
    if (name === 'matchmaking') this.renderMatchmaking();
    if (name === 'matchup') this.renderMatchup();
    if (name === 'battle') this.renderBattle();
    if (name === 'result') this.renderResult();
  }

  private renderLoading(): void {
    const root = this.screen!;
    const visible = view.getVisibleSize();
    void addCoverImage(this.screenHost!, 'loading-bg', visible.width, visible.height);
    text(root, '正在进入绿茵赛场…', 0, -475, 23, colors.white);
    const bar = panel(root, 0, -525, 420, 14, colors.panelSoft, 7);
    panel(bar, -105, 0, 210, 14, colors.primary, 7);
  }

  private renderHome(): void {
    const root = this.screen!;
    const visible = view.getVisibleSize();
    const hud = this.homeHudLayout();
    void addCoverImage(this.screenHost!, 'home-bg', visible.width, visible.height);
    void addImage(root, 'players/generated/saka', { x: hud.avatarX, y: hud.y, width: hud.avatarSize * 0.64, height: hud.avatarSize * 0.64, siblingIndex: 0 });
    void addFrameImage(root, 'ui/avatar-bg', { x: 291, y: 118, width: 503, height: 503 }, {
      x: hud.avatarX,
      y: hud.y,
      width: hud.avatarSize,
      height: hud.avatarSize,
      siblingIndex: 1
    });
    const resourceGap = 8;
    const resourceWidth = (hud.barWidth - resourceGap) / 2;
    this.renderHomeResourceBar(root, hud.barX - (resourceWidth + resourceGap) / 2, hud.y, resourceWidth, hud.barHeight, 'gems', formatNumber(this.state.gems));
    this.renderHomeResourceBar(root, hud.barX + (resourceWidth + resourceGap) / 2, hud.y, resourceWidth, hud.barHeight, 'energy', `${this.state.energy}/120`);
    void addImage(root, 'ui/hero', { x: 0, y: -213, width: 628, height: 942 });
    void addImage(root, 'ui/start', {
      x: 0,
      y: -515,
      width: 436,
      height: 176,
      onClick: () => {
        this.state.clearLineup();
        this.selectedLineupSlotId = undefined;
        this.selectedBenchIndex = undefined;
        this.show('formation');
      }
    });
    this.homeImageShortcut(root, 0, '七日签到', -300, 465, () => this.openSignModal());
    this.homeImageShortcut(root, 1, '商城', -300, 325, () => this.show('shop'));
    this.homeImageShortcut(root, 2, '关注领奖', 300, 465, () => this.openFollowModal());
    this.homeImageShortcut(root, 1, '每日任务', 300, 325, () => this.openTasksModal());
    this.renderMusicToggle(root);
  }

  private renderMusicToggle(parent: Node): void {
    const enabled = GameAudio.isMusicEnabled();
    const host = panel(parent, 300, 585, 64, 64, new Color(4, 19, 49, 242), 32);
    host.name = 'MusicToggle';
    void addImage(host, enabled ? 'ui/music-on' : 'ui/music-off', {
      width: 52,
      height: 52,
      onClick: () => {
        GameAudio.setMusicEnabled(!enabled);
        host.destroy();
        this.renderMusicToggle(parent);
      }
    });
  }

  private renderHomeResourceBar(
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    kind: 'gems' | 'energy',
    value: string
  ): void {
    const bar = layer(`HomeResource:${kind}`, parent, width, height);
    bar.setPosition(x, y);
    const graphics = bar.addComponent(Graphics);
    graphics.fillColor = new Color(4, 19, 49, 242);
    graphics.strokeColor = new Color(38, 143, 255, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-width / 2, -height / 2, width, height, height / 2);
    graphics.fill();
    graphics.stroke();
    graphics.strokeColor = new Color(31, 88, 174, 190);
    graphics.lineWidth = 2;
    graphics.circle(width / 2 - height * 0.48, 0, height * 0.37);
    graphics.stroke();
    const iconFrame = kind === 'gems'
      ? { x: 30, y: 18, width: 112, height: 102 }
      : { x: 700, y: 17, width: 92, height: 105 };
    void addFrameImage(bar, 'ui/top-button-v2', iconFrame, {
      x: -width / 2 + height * 0.53,
      y: 0,
      width: kind === 'gems' ? height * 0.7 : height * 0.5,
      height: height * 0.7,
      siblingIndex: 1
    });
    text(bar, value, 2, 0, 19, colors.white, Math.max(60, width - height * 1.75));
    text(bar, '+', width / 2 - height * 0.48, 1, 30, colors.white, height * 0.62);
  }

  private homeHudLayout(): { y: number; avatarX: number; avatarSize: number; barX: number; barWidth: number; barHeight: number } {
    type MiniProgramLayoutApi = {
      getSystemInfoSync?: () => { windowWidth?: number };
      getMenuButtonBoundingClientRect?: () => { left?: number; top?: number; right?: number; bottom?: number };
    };
    const visible = view.getVisibleSize();
    const rootX = this.screen?.position.x ?? 0;
    const rootY = this.screen?.position.y ?? 0;
    let right = DESIGN_WIDTH / 2 - 18;
    let y = 590;
    try {
      const api = (globalThis as typeof globalThis & { tt?: MiniProgramLayoutApi }).tt;
      const info = api?.getSystemInfoSync?.();
      const menu = api?.getMenuButtonBoundingClientRect?.();
      if (info?.windowWidth && menu?.left != null) {
        const designPerPixel = visible.width / info.windowWidth;
        right = -visible.width / 2 + menu.left * designPerPixel - rootX - 14;
        if (menu.top != null && menu.bottom != null) {
          const worldY = visible.height / 2 - ((menu.top + menu.bottom) / 2) * designPerPixel;
          y = worldY - rootY + 18;
        }
      }
    } catch (error) {
      console.warn('[layout] unable to read Douyin menu button bounds', error);
    }
    const left = -DESIGN_WIDTH / 2 + 18;
    const gap = 8;
    const avatarSize = Math.max(66, Math.min(76, right - left - 350));
    const barWidth = Math.max(330, Math.min(430, right - left - avatarSize - gap));
    const avatarX = left + avatarSize / 2;
    const barX = left + avatarSize + gap + barWidth / 2;
    const topLimit = Math.max(650, visible.height / 2 - rootY - 36);
    return {
      y: Math.max(575, Math.min(topLimit, y)),
      avatarX,
      avatarSize,
      barX,
      barWidth,
      barHeight: Math.max(64, barWidth * (180 / 1280))
    };
  }

  private topControlY(): number {
    return this.homeHudLayout().y;
  }

  private homeImageShortcut(parent: Node, iconIndex: number, title: string, x: number, y: number, onClick: () => void): void {
    void addFrameImage(parent, 'ui/buttons', { x: iconIndex * 256, y: 96, width: 256, height: 280 }, {
      x,
      y,
      width: 84,
      height: 92,
      onClick
    });
    text(parent, title, x, y - 67, 17, colors.white, 120);
  }

  private renderShop(): void {
    const root = this.screen!;
    const visible = view.getVisibleSize();
    const headerY = this.topControlY();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    const wash = root.addComponent(Graphics);
    wash.fillColor = new Color(0, 16, 55, 190);
    wash.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    wash.fill();

    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, {
      x: -305,
      y: headerY,
      width: 66,
      height: 66,
      onClick: () => this.show('home')
    });
    void addFrameImage(root, 'ui/headertitle', { x: 75, y: 52, width: 360, height: 110 }, {
      x: -135,
      y: headerY,
      width: 210,
      height: 64
    });
    const balance = panel(root, 90, headerY, 180, 58, new Color(6, 21, 47, 245), 28);
    void addFrameImage(balance, 'ui/sevenday/diamond', { x: 423, y: 90, width: 229, height: 193 }, { x: -65, y: 0, width: 43, height: 36 });
    text(balance, String(this.state.gems), 10, 0, 24, colors.white, 90);
    text(balance, '+', 72, 0, 32, colors.white, 40);
    if (this.shopMessage) text(root, this.shopMessage, 0, 520, 18, colors.gold, 520);

    const daily = new Date().getDate() % 2 === 0
      ? { title: '体力补给', count: '×1', sub: '恢复 30 点体力', cost: 20, reward: { energy: 30 } }
      : { title: '球探券', count: '×5', sub: '用于招募随机球员', cost: 120, reward: { scoutTickets: 5 } };
    const feature = layer('DailyOffer', root, 660, 364);
    feature.setPosition(0, 300);
    void addFrameImage(feature, 'ui/everyday-active', { x: 30, y: 60, width: 1479, height: 816 }, { x: 0, y: 0, width: 660, height: 364, siblingIndex: 0 });
    text(feature, `${daily.title}  ${daily.count}`, -210, 65, 29, colors.white, 280);
    text(feature, daily.sub, -210, 25, 17, colors.white, 280);
    void addFrameImage(feature, 'ui/sevenday/ticket', { x: 418, y: 79, width: 266, height: 207 }, { x: 140, y: 45, width: 150, height: 117 });
    void addFrameImage(feature, 'ui/sevenday/diamond', { x: 423, y: 90, width: 229, height: 193 }, { x: -275, y: -60, width: 34, height: 29 });
    text(feature, String(daily.cost), -230, -60, 27, colors.gold, 70);
    text(feature, '原价 150', -125, -60, 15, colors.muted, 100);
    text(feature, `刷新倒计时：${this.shopCountdown()}`, -180, -140, 18, colors.gold, 300);
    const dailyBuy = layer('DailyBuy', feature, 190, 70);
    dailyBuy.setPosition(205, -83);
    dailyBuy.on(Node.EventType.TOUCH_END, () => this.purchaseShopItem(daily.title, daily.cost, daily.reward));

    void addFrameImage(root, 'ui/toolstitle', { x: 82, y: 172, width: 923, height: 114 }, { x: -165, y: 75, width: 300, height: 37 });
    const goods = [
      { key: 'energy' as const, title: '体力补给', sub: '恢复 30 点体力', price: '20', cost: 20, reward: { energy: 30 }, limit: '今日限购 5/5' },
      { key: 'ticket' as const, title: '球探券 ×1', sub: '用于招募随机球员', price: '30', cost: 30, reward: { scoutTickets: 1 }, limit: '今日限购 10/10' },
      { key: 'gems' as const, title: '钻石 ×100', sub: '游戏通用货币', price: '¥6', reward: undefined, limit: '今日限购 1/1' }
    ];
    goods.forEach((item, index) => this.renderShopRow(root, item, -75 - index * 220));
    text(root, 'ⓘ 适度娱乐，理性消费', 0, -610, 17, colors.muted, 400);
  }

  private renderShopRow(
    parent: Node,
    item: { key: 'energy' | 'ticket' | 'gems'; title: string; sub: string; price: string; cost?: number; reward?: { energy?: number; scoutTickets?: number }; limit: string },
    y: number
  ): void {
    const row = layer(`ShopItem:${item.key}`, parent, 660, 202);
    row.setPosition(0, y);
    const frame = item.key === 'energy'
      ? { x: 0, y: 0, width: 1080, height: 330 }
      : item.key === 'ticket'
        ? { x: 0, y: 330, width: 1080, height: 330 }
        : { x: 0, y: 660, width: 1080, height: 310 };
    void addFrameImage(row, 'ui/gift', frame, { x: 0, y: 0, width: 660, height: item.key === 'gems' ? 189 : 202, siblingIndex: 0 });
    text(row, item.title, 0, 48, 27, colors.white, 250);
    text(row, item.sub, 0, 5, 18, new Color(157, 200, 248, 255), 260);
    if (item.key !== 'gems') {
      void addFrameImage(row, 'ui/sevenday/diamond', { x: 423, y: 90, width: 229, height: 193 }, { x: -45, y: -45, width: 32, height: 27 });
      text(row, item.price, 0, -45, 25, colors.gold, 90);
    } else {
      text(row, item.price, -10, -45, 27, colors.white, 100);
    }
    text(row, item.limit, 205, -65, 15, new Color(158, 201, 255, 255), 190);
    const buy = layer('BuyHit', row, 185, 76);
    buy.setPosition(210, 12);
    buy.on(Node.EventType.TOUCH_END, () => {
      if (item.cost != null && item.reward) this.purchaseShopItem(item.title, item.cost, item.reward);
      else {
        this.shopMessage = '抖音支付能力尚未接入 Cocos 客户端';
        this.show('shop');
      }
    });
  }

  private purchaseShopItem(title: string, cost: number, reward: { energy?: number; scoutTickets?: number }): void {
    const ok = this.state.spendGems(cost, reward);
    GameAudio.play(ok ? 'reward' : 'danger');
    this.shopMessage = ok ? `${title}购买成功，道具已发放` : '钻石不足';
    this.show('shop');
  }

  private shopCountdown(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const seconds = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
  }

  private createModal(title: string, subtitle: string): Node {
    this.modal?.destroy();
    const modal = layer('Modal', this.screenHost!, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.modal = modal;
    modal.on(Node.EventType.TOUCH_START, () => undefined);
    modal.on(Node.EventType.TOUCH_END, () => undefined);
    const shade = modal.addComponent(Graphics);
    shade.fillColor = new Color(0, 0, 0, 190);
    shade.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    shade.fill();
    const card = panel(modal, 0, 0, 650, 1050, colors.panel, 30);
    text(card, title, 0, 445, 38, colors.gold, 560);
    text(card, subtitle, 0, 395, 19, colors.muted, 560);
    button(card, '关闭', 0, -445, 220, 64, () => this.closeModal(), colors.panelSoft);
    return card;
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = undefined;
  }

  private openSignModal(): void {
    this.modal?.destroy();
    const visible = view.getVisibleSize();
    const modal = layer('SignModal', this.screenHost!, visible.width, visible.height);
    this.modal = modal;
    modal.on(Node.EventType.TOUCH_START, () => undefined);
    modal.on(Node.EventType.TOUCH_END, () => undefined);
    const shade = modal.addComponent(Graphics);
    shade.fillColor = new Color(0, 0, 0, 190);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();

    const panelWidth = 636;
    const panelHeight = 722;
    const card = layer('SignPanel', modal, panelWidth, panelHeight);
    void addImage(card, 'ui/qiandao', { x: 0, y: 0, width: panelWidth, height: panelHeight, siblingIndex: 0 });
    const rewards = [
      { label: '体力值 +30', kind: 'energy' as const, reward: { energy: 30 } },
      { label: '钻石 +20', kind: 'gems' as const, reward: { gems: 20 } },
      { label: '抽卡券 +1', kind: 'ticket' as const, reward: { scoutTickets: 1 } },
      { label: '体力值 +30', kind: 'energy' as const, reward: { energy: 30 } },
      { label: '钻石 +20', kind: 'gems' as const, reward: { gems: 20 } },
      { label: '抽卡券 +1', kind: 'ticket' as const, reward: { scoutTickets: 1 } },
      { label: '体力值 +50', kind: 'energy' as const, reward: { energy: 50 } }
    ];
    const day = ((new Date().getDate() - 1) % 7) + 1;
    const claimId = `signin-${this.state.dailyTaskDate}`;
    const claimed = this.state.claimedTasks.has(claimId);
    rewards.forEach((item, index) => {
      const today = index + 1 === day;
      const alreadyClaimed = index + 1 < day || (today && claimed);
      const stateIndex = alreadyClaimed ? 2 : today ? 0 : 1;
      const topRow = index < 4;
      const cardWidth = topRow ? 126.72 : 142.08;
      const cardHeight = cardWidth * (470 / 290) * (topRow ? 1 : 0.9);
      const gap = topRow ? 13.44 : 15.36;
      const count = topRow ? 4 : 3;
      const rowWidth = cardWidth * count + gap * (count - 1);
      const localX = (panelWidth - rowWidth) / 2 + (topRow ? index : index - 4) * (cardWidth + gap);
      const localY = topRow ? 168 : 168 + 126.72 * (470 / 290) + 8;
      this.renderSignRewardCard(card, index + 1, item.label, item.kind, stateIndex, localX, localY, cardWidth, cardHeight);
    });

    const acceptPath = claimed ? 'ui/sevenday/accpet-end' : 'ui/sevenday/accpet';
    const acceptFrame = claimed
      ? { x: 46, y: 221, width: 985, height: 233 }
      : { x: 56, y: 218, width: 959, height: 218 };
    const buttonWidth = 360;
    const buttonHeight = buttonWidth * acceptFrame.height / acceptFrame.width;
    void addFrameImage(card, acceptPath, acceptFrame, {
      x: 0,
      y: -panelHeight / 2 + buttonHeight / 2 + 32,
      width: buttonWidth,
      height: buttonHeight,
      onClick: () => {
        if (!claimed && this.state.claimReward(claimId, rewards[day - 1].reward)) {
          GameAudio.play('reward');
          this.openSignModal();
        }
      }
    });

    const close = layer('SignClose', card, 90, 80);
    close.setPosition(panelWidth * 0.39, panelHeight * 0.43);
    close.on(Node.EventType.TOUCH_END, () => {
      GameAudio.play('tap');
      this.closeModal();
    });
  }

  private renderSignRewardCard(
    parent: Node,
    day: number,
    rewardText: string,
    kind: 'energy' | 'gems' | 'ticket',
    stateIndex: number,
    localX: number,
    localY: number,
    width: number,
    height: number
  ): void {
    const panelWidth = 636;
    const panelHeight = 722;
    const x = localX + width / 2 - panelWidth / 2;
    const y = panelHeight / 2 - localY - height / 2;
    const node = layer(`SignDay${day}`, parent, width, height);
    node.setPosition(x, y);
    const cardFrames = [
      { x: 62, y: 16, width: 290, height: 470 },
      { x: 394, y: 16, width: 290, height: 470 },
      { x: 726, y: 16, width: 290, height: 470 }
    ];
    void addFrameImage(node, 'ui/sevenday/giftbg', cardFrames[stateIndex], { x: 0, y: 0, width, height, siblingIndex: 0 });
    const tone = stateIndex === 0 ? new Color(255, 243, 163, 255) : stateIndex === 1 ? new Color(87, 185, 255, 255) : new Color(215, 219, 229, 255);
    text(node, `第${day}天`, 0, height * 0.37, Math.round(width * 0.15), tone, width * 0.8);
    this.renderSignRewardIcon(node, kind, stateIndex, 0, height * 0.10, width * 0.44);
    text(node, rewardText, 0, -height * (day >= 5 ? 0.08 : 0.16), Math.round(width * 0.12), stateIndex === 2 ? tone : colors.white, width * 0.9);
  }

  private renderSignRewardIcon(parent: Node, kind: 'energy' | 'gems' | 'ticket', stateIndex: number, x: number, y: number, size: number): void {
    const frames = kind === 'energy'
      ? [{ x: 79, y: 144, width: 232, height: 329 }, { x: 433, y: 144, width: 231, height: 329 }, { x: 771, y: 144, width: 231, height: 328 }]
      : kind === 'gems'
        ? [{ x: 97, y: 92, width: 224, height: 190 }, { x: 423, y: 90, width: 229, height: 193 }, { x: 759, y: 93, width: 221, height: 188 }]
        : [{ x: 78, y: 77, width: 268, height: 209 }, { x: 418, y: 79, width: 266, height: 207 }, { x: 750, y: 78, width: 264, height: 208 }];
    const frame = frames[stateIndex];
    const scale = (kind === 'ticket' ? size * 1.15 : size) / Math.max(frame.width, frame.height);
    void addFrameImage(parent, `ui/sevenday/${kind === 'energy' ? 'flash' : kind === 'gems' ? 'diamond' : 'ticket'}`, frame, {
      x,
      y,
      width: frame.width * scale,
      height: frame.height * scale
    });
  }

  private openFollowModal(): void {
    const card = this.createModal('关注领奖', '关注后可领取一次专属奖励');
    const claimId = 'follow-reward-v1';
    const claimed = this.state.permanentClaims.has(claimId);
    text(card, '关注官方账号', 0, 210, 34, colors.white);
    text(card, '钻石 +100  ·  球探券 +1', 0, 100, 27, colors.gold);
    text(card, claimed ? '奖励已领取' : this.followMessage || (this.followVisitStarted ? '返回游戏后可领取奖励' : '请先前往关注主页'), 0, -40, 22, colors.muted);
    button(card, claimed ? '已领取' : this.followVisitStarted ? '领取奖励' : '前往关注', 0, -180, 360, 82, () => {
      if (claimed) return;
      if (!this.followVisitStarted) {
        this.openFollowProfile();
        return;
      }
      if (this.state.claimReward(claimId, { gems: 100, scoutTickets: 1 }, true)) this.openFollowModal();
    }, claimed ? colors.panelSoft : colors.danger);
  }

  private openFollowProfile(): void {
    type FollowApi = { openAwemeUserProfile?: (options: { success?: () => void; fail?: (error: { errMsg?: string }) => void }) => void };
    const api = (globalThis as typeof globalThis & { tt?: FollowApi }).tt;
    if (!api?.openAwemeUserProfile) {
      this.followMessage = 'Web 预览不发奖，请在抖音端完成关注';
      this.openFollowModal();
      return;
    }
    api.openAwemeUserProfile({
      success: () => {
        this.followVisitStarted = true;
        this.followMessage = '';
        this.openFollowModal();
      },
      fail: (error) => {
        this.followMessage = error.errMsg || '打开关注主页失败，请稍后重试';
        this.openFollowModal();
      }
    });
  }

  private openTasksModal(): void {
    const card = this.createModal('每日任务', '完成比赛目标，领取每日奖励');
    const tasks = [
      { id: 'task-play', title: '完成 1 场比赛', current: this.state.matchesPlayed, target: 1, rewardText: '球探券 +1', reward: { scoutTickets: 1 } },
      { id: 'task-win', title: '赢下 1 场比赛', current: this.state.wins, target: 1, rewardText: '金币 +800', reward: { coins: 800 } }
    ];
    tasks.forEach((item, index) => {
      const claimed = this.state.claimedTasks.has(item.id);
      const ready = item.current >= item.target;
      const row = panel(card, 0, 210 - index * 210, 560, 165, colors.panelSoft, 20);
      text(row, item.title, -105, 35, 23, colors.white, 310);
      text(row, `${Math.min(item.current, item.target)}/${item.target}  ·  ${item.rewardText}`, -105, -30, 19, colors.gold, 310);
      button(row, claimed ? '已领取' : ready ? '领取' : '未完成', 180, 0, 145, 60, () => {
        if (ready && !claimed && this.state.claimReward(item.id, item.reward)) this.openTasksModal();
      }, ready && !claimed ? colors.success : colors.panelSoft);
    });
  }

  private renderFormation(): void {
    const root = this.screen!;
    const visible = view.getVisibleSize();
    const headerY = this.topControlY();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, { x: -305, y: headerY, width: 66, height: 66, onClick: () => this.show('home') });
    void addFrameImage(root, 'ui/headertitle', { x: 74, y: 228, width: 350, height: 104 }, { x: -135, y: headerY, width: 210, height: 62 });
    const formationIndex = formations.findIndex((item) => item.id === this.state.selectedFormation.id);
    const previous = (formationIndex - 1 + formations.length) % formations.length;
    const next = (formationIndex + 1) % formations.length;
    const contentOffsetY = -48;
    this.renderFormationChoice(root, formations[previous], previous, -225, 448 + contentOffsetY, 174, 152, false);
    this.renderFormationChoice(root, this.state.selectedFormation, formationIndex, 0, 450 + contentOffsetY, 216, 190, true);
    this.renderFormationChoice(root, formations[next], next, 225, 448 + contentOffsetY, 174, 152, false);
    button(root, '‹', -318, 448 + contentOffsetY, 54, 54, () => this.changeFormation(-1), colors.panelSoft);
    button(root, '›', 318, 448 + contentOffsetY, 54, 54, () => this.changeFormation(1), colors.panelSoft);

    const fieldY = 20 + contentOffsetY;
    const fieldHeight = 760;
    void addImage(root, 'ui/football-backgrond', { x: 0, y: fieldY, width: 740, height: fieldHeight, siblingIndex: 0 });

    this.state.lineup.forEach((slot) => {
      const x = (slot.x - 0.5) * 608;
      const y = fieldY + (0.5 - slot.y) * 610;
      const selected = this.selectedLineupSlotId === slot.id;
      const card = this.playerHex(root, x, y, slot.player, slot.position, selected, 52);
      card.on(Node.EventType.TOUCH_END, () => this.selectLineupSlot(slot.id));
    });
    this.renderFormationBench(root, contentOffsetY);
    this.renderFormationRecommend(root, headerY);
  }

  private renderFormationRecommend(parent: Node, y: number): void {
    const recommend = panel(parent, 120, y, 135, 58, colors.panelSoft, 18);
    recommend.name = 'Button:RecommendStrongest';
    text(recommend, '推荐\n最强阵容', 0, 0, 16, colors.white, 120);
    recommend.on(Node.EventType.TOUCH_START, () => recommend.setScale(0.96, 0.96, 1));
    recommend.on(Node.EventType.TOUCH_CANCEL, () => recommend.setScale(1, 1, 1));
    recommend.on(Node.EventType.TOUCH_END, () => {
      recommend.setScale(1, 1, 1);
      this.autoFillStrongest();
    });
    recommend.setSiblingIndex(parent.children.length - 1);
  }

  private renderFormationBench(parent: Node, offsetY = 0): void {
    const bench = layer('FormationBench', parent, 682, 250);
    bench.setPosition(0, -442 + offsetY);
    void addFrameImage(bench, 'ui/replace_player', { x: 37, y: 47, width: 1006, height: 449 }, {
      x: 0,
      y: 0,
      width: 682,
      height: 250,
      siblingIndex: 0
    });
    sectionTitle(bench, '替补球员', -240, 88, 190, colors.cyan, 20);
    this.renderFormationReadyButton(bench);
    this.state.substitutes.forEach((player, index) => {
      const x = -245 + index * 122.5;
      const selected = this.selectedBenchIndex === index;
      const card = this.playerHex(bench, x, -32, player, player ? this.positionName(player.position) : '空位', selected, 42);
      card.on(Node.EventType.TOUCH_END, () => this.selectBench(index));
    });
  }

  private renderFormationReadyButton(parent: Node): void {
    const lineupFilled = this.state.lineup.filter((slot) => slot.player).length;
    const benchFilled = this.state.substitutes.filter(Boolean).length;
    const lineupMissing = this.state.lineup.length - lineupFilled;
    const benchMissing = this.state.substitutes.length - benchFilled;
    const ready = lineupMissing === 0 && benchMissing === 0;
    if (ready) {
      void addFrameImage(parent, 'ui/button-ready', { x: 63, y: 203, width: 995, height: 275 }, {
        x: 193,
        y: 69,
        width: 236,
        height: 65,
        onClick: () => this.openFormationConfirmModal()
      });
      return;
    }
    const missing = lineupMissing + benchMissing;
    const disabled = panel(parent, 205, 74, 214, 54, new Color(16, 35, 75, 205), 14);
    text(disabled, `还差${missing}人`, 0, 10, 19, colors.muted, 180);
    text(disabled, lineupMissing > 0 ? '补满首发' : '补满替补', 0, -13, 13, new Color(108, 232, 255, 255), 180);
  }

  private openFormationConfirmModal(): void {
    this.modal?.destroy();
    const visible = view.getVisibleSize();
    const modal = layer('FormationConfirm', this.screenHost!, visible.width, visible.height);
    this.modal = modal;
    const shade = modal.addComponent(Graphics);
    shade.fillColor = new Color(1, 5, 17, 205);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();
    const card = layer('FormationConfirmCard', modal, 640, 760);
    void addImage(card, 'ui/gamereadybg', { x: 0, y: 0, width: 640, height: 754, siblingIndex: 0 });
    const close = layer('FormationConfirmClose', card, 92, 82);
    close.setPosition(270, 326);
    close.on(Node.EventType.TOUCH_END, () => this.closeModal());
    text(card, '赛前确认', 0, 300, 44, colors.white, 500);
    text(card, `${this.state.selectedFormation.name}  ${this.state.selectedFormation.style}`, 0, 245, 27, colors.gold, 480);
    sectionTitle(card, '核心球员', 0, 180, 300, colors.cyan, 26);
    this.renderConfirmTitleMark(card, -165, 180, false);
    this.renderConfirmTitleMark(card, 165, 180, true);
    const cores = this.state.lineup
      .flatMap((slot) => slot.player ? [slot.player] : [])
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
    cores.forEach((player, index) => {
      const x = -170 + index * 170;
      this.renderConfirmCoreCard(card, player, x, 56);
    });
    const power = panel(card, 0, -130, 488, 100, new Color(6, 26, 56, 225), 18);
    void addFrameImage(power, 'ui/playerscore', { x: 416, y: 172, width: 246, height: 288 }, {
      x: -162,
      y: 0,
      width: 58,
      height: 68,
      siblingIndex: 1
    });
    text(power, '当前战力', -42, 12, 25, colors.white, 190);
    text(power, String(this.state.power), 123, 12, 40, colors.gold, 150);
    text(power, '阵容已保存，状态良好', 45, -27, 18, colors.muted, 330);
    void addFrameImage(card, 'ui/readybutton', { x: 31, y: 132, width: 489, height: 182 }, {
      x: -150,
      y: -292,
      width: 250,
      height: 93,
      onClick: () => this.closeModal()
    });
    void addFrameImage(card, 'ui/readybutton', { x: 557, y: 132, width: 489, height: 180 }, {
      x: 150,
      y: -292,
      width: 250,
      height: 92,
      onClick: () => {
        this.closeModal();
        GameAudio.play('confirm');
        this.show('matchmaking');
      }
    });
  }

  private renderConfirmTitleMark(parent: Node, x: number, y: number, flip: boolean): void {
    const mark = layer('CoreTitleMark', parent, 96, 20);
    mark.setPosition(x, y);
    if (flip) mark.setScale(-1, 1, 1);
    const graphics = mark.addComponent(Graphics);
    graphics.fillColor = new Color(11, 101, 255, 185);
    graphics.moveTo(-48, 8);
    graphics.lineTo(30, 8);
    graphics.lineTo(46, 0);
    graphics.lineTo(30, -8);
    graphics.lineTo(-48, -8);
    graphics.close();
    graphics.fill();
    graphics.fillColor = new Color(102, 234, 255, 220);
    graphics.rect(-30, -8, 14, 16);
    graphics.fill();
  }

  private renderConfirmCoreCard(parent: Node, player: PlayerCardData, x: number, y: number): void {
    const core = layer(`ConfirmCore:${player.id}`, parent, 146, 205);
    core.setPosition(x, y);
    const frames: Record<PlayerCardData['rarity'], { x: number; y: number; width: number; height: number }> = {
      bronze: { x: 77, y: 0, width: 249, height: 347 },
      silver: { x: 413, y: 0, width: 251, height: 347 },
      purple: { x: 747, y: 0, width: 250, height: 347 },
      gold: { x: 76, y: 350, width: 253, height: 327 },
      legend: { x: 399, y: 348, width: 276, height: 331 },
      orange: { x: 721, y: 347, width: 304, height: 337 }
    };
    void addFrameImage(core, 'ui/cardbg', frames[player.rarity], { x: 0, y: 18, width: 122, height: 156, siblingIndex: 0 });
    void addImage(core, this.playerResourcePath(player), { x: 0, y: 29, width: 84, height: 84, siblingIndex: 1 });
    text(core, String(player.rating), -43, 72, 25, colors.white, 54);
    text(core, this.positionName(player.position), -39, 45, 17, colors.white, 66);
    const nameBg = panel(core, 0, -80, 136, 42, new Color(7, 30, 65, 240), 9);
    const outline = nameBg.getComponent(Graphics)!;
    outline.strokeColor = new Color(86, 168, 255, 150);
    outline.lineWidth = 2;
    outline.roundRect(-67, -20, 134, 40, 8);
    outline.stroke();
    text(nameBg, player.name, 0, 0, 20, colors.white, 120);
  }

  private renderFormationChoice(parent: Node, formation: typeof formations[number], index: number, x: number, y: number, width: number, height: number, selected: boolean): void {
    const card = panel(parent, x, y, width, height, selected ? new Color(19, 36, 23, 245) : new Color(7, 18, 13, 230), 18);
    const pitch = card.addComponent(Graphics);
    pitch.strokeColor = new Color(207, 255, 240, 95);
    pitch.lineWidth = 2;
    pitch.rect(-width * 0.36, 10, width * 0.72, height * 0.34);
    pitch.circle(0, height * 0.17, 12);
    pitch.stroke();
    formation.slots.forEach((slot) => {
      const dot = panel(card, (slot.x - 0.5) * width * 0.65, height * 0.31 - slot.y * height * 0.27, selected ? 7 : 6, selected ? 7 : 6, slot.position === 'FW' ? colors.gold : colors.white, 4);
      dot.getComponent(Graphics);
    });
    text(card, formation.name, 0, -height * 0.18, selected ? 27 : 22, colors.white, width - 20);
    text(card, formation.style, 0, -height * 0.36, selected ? 19 : 16, selected ? colors.gold : colors.success, width - 20);
    card.on(Node.EventType.TOUCH_END, () => {
      GameAudio.play('select');
      this.state.setFormation(formations[index]);
      this.show('formation');
    });
  }

  private playerHex(parent: Node, x: number, y: number, player: PlayerCardData | undefined, position: string, selected: boolean, radius: number): Node {
    const node = layer('PlayerHex', parent, radius * 2.2, radius * 2.35);
    node.setPosition(x, y);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = selected ? colors.gold : new Color(7, 24, 34, 245);
    graphics.strokeColor = selected ? colors.white : new Color(91, 225, 220, 255);
    graphics.lineWidth = 3;
    for (let index = 0; index < 6; index += 1) {
      const angle = Math.PI / 3 * index + Math.PI / 6;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (index === 0) graphics.moveTo(px, py);
      else graphics.lineTo(px, py);
    }
    graphics.close();
    graphics.fill();
    graphics.stroke();
    if (player) {
      void addImage(node, this.playerResourcePath(player), {
        x: 0,
        y: 8,
        width: radius * 1.3,
        height: radius * 1.3,
        siblingIndex: 0
      });
      text(node, String(player.rating), -radius * 0.52, radius * 0.48, Math.max(13, radius * 0.34), colors.white, radius * 0.62);
      text(node, player.name, 0, -radius * 0.62, Math.max(12, radius * 0.27), colors.white, radius * 1.7);
    } else {
      text(node, '+', 0, 5, 30, selected ? colors.background : colors.gold, radius * 1.7);
    }
    text(node, position, 0, -radius - 14, 14, colors.white, radius * 1.8);
    return node;
  }

  private autoFillStrongest(): void {
    GameAudio.play('confirm');
    this.state.autoFillStrongestSquad();
    this.selectedLineupSlotId = undefined;
    this.selectedBenchIndex = undefined;
    this.show('formation');
  }

  private changeFormation(direction: number): void {
    GameAudio.play('select');
    const current = formations.findIndex((item) => item.id === this.state.selectedFormation.id);
    const next = formations[(current + direction + formations.length) % formations.length];
    this.selectedLineupSlotId = undefined;
    this.selectedBenchIndex = undefined;
    this.state.setFormation(next);
    this.show('formation');
  }

  private selectLineupSlot(slotId: string): void {
    GameAudio.play('select');
    const slot = this.state.lineup.find((item) => item.id === slotId);
    if (!slot) return;
    if (!slot.player && this.selectedBenchIndex == null && !this.selectedLineupSlotId) {
      this.openPositionBlindBox({ slotId });
      return;
    }
    if (this.selectedBenchIndex != null) {
      this.state.swapLineupWithSubstitute(slotId, this.selectedBenchIndex);
      this.selectedBenchIndex = undefined;
      this.selectedLineupSlotId = undefined;
    } else if (this.selectedLineupSlotId && this.selectedLineupSlotId !== slotId) {
      this.state.swapLineupSlots(this.selectedLineupSlotId, slotId);
      this.selectedLineupSlotId = undefined;
    } else {
      this.selectedLineupSlotId = this.selectedLineupSlotId === slotId ? undefined : slotId;
    }
    this.show('formation');
  }

  private selectBench(index: number): void {
    GameAudio.play('select');
    const player = this.state.substitutes[index];
    if (!player && !this.selectedLineupSlotId && this.selectedBenchIndex == null) {
      this.openPositionBlindBox({ benchIndex: index });
      return;
    }
    if (this.selectedLineupSlotId) {
      this.state.swapLineupWithSubstitute(this.selectedLineupSlotId, index);
      this.selectedLineupSlotId = undefined;
      this.selectedBenchIndex = undefined;
    } else {
      this.selectedBenchIndex = this.selectedBenchIndex === index ? undefined : index;
    }
    this.show('formation');
  }

  private openPositionBlindBox(
    target: { slotId?: string; benchIndex?: number },
    candidates?: PlayerCardData[],
    revealed = new Set<string>()
  ): void {
    const slot = target.slotId ? this.state.lineup.find((item) => item.id === target.slotId) : undefined;
    const used = new Set([
      ...this.state.lineup.flatMap((item) => item.player ? [item.player.id] : []),
      ...this.state.substitutes.flatMap((item, index) => item && index !== target.benchIndex ? [item.id] : [])
    ]);
    const choices = candidates ?? this.state.ownedPlayers()
      .filter((player) => !used.has(player.id) && (!slot || (slot.position === 'GK' ? player.position === 'GK' : player.position !== 'GK')))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    this.modal?.destroy();
    const visible = view.getVisibleSize();
    const modal = layer('PositionBlindBox', this.screenHost!, visible.width, visible.height);
    this.modal = modal;
    modal.on(Node.EventType.TOUCH_START, () => undefined);
    modal.on(Node.EventType.TOUCH_END, () => undefined);
    const shade = modal.addComponent(Graphics);
    shade.fillColor = new Color(2, 6, 19, 184);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();
    const positionName = slot ? this.positionName(slot.position) : `替补${(target.benchIndex ?? 0) + 1}`;
    text(modal, `${positionName} 3选1`, 0, 515, 42, colors.white);
    text(modal, '点击卡片全部开启后，再选择球员', 0, 458, 21, new Color(207, 224, 255, 255));
    if (!choices.length) {
      text(modal, '当前没有可用球员，请返回调整已选阵容', 0, 40, 24, colors.gold, 600);
      button(modal, '返回阵容', 0, -90, 240, 66, () => this.closeModal(), colors.panelSoft);
      return;
    }
    const allRevealed = choices.length > 0 && choices.every((player) => revealed.has(player.id));
    choices.forEach((player, index) => {
      const x = -220 + index * 220;
      if (!revealed.has(player.id)) {
        void addFrameImage(modal, 'ui/card-guess1', { x: 185, y: 298, width: 350, height: 488 }, {
          x,
          y: 25,
          width: 218,
          height: 304,
          onClick: () => {
            GameAudio.play('reveal');
            revealed.add(player.id);
            this.openPositionBlindBox(target, choices, revealed);
          }
        });
        return;
      }
      const playerCard = this.renderBlindPlayerCard(modal, player, x, 25, allRevealed);
      playerCard.on(Node.EventType.TOUCH_END, () => {
        if (!allRevealed) return;
        GameAudio.play('reward');
        if (target.slotId) this.state.fillSlot(target.slotId, player);
        else if (target.benchIndex != null) this.state.fillSubstitute(target.benchIndex, player);
        this.closeModal();
        this.show('formation');
      });
    });
  }

  private renderBlindPlayerCard(parent: Node, player: PlayerCardData, x: number, y: number, selectable: boolean): Node {
    const width = 188;
    const height = 262;
    const card = layer(`BlindCard:${player.id}`, parent, width, height);
    card.setPosition(x, y);
    const frames: Record<PlayerCardData['rarity'], { x: number; y: number; width: number; height: number }> = {
      bronze: { x: 77, y: 0, width: 249, height: 347 },
      silver: { x: 413, y: 0, width: 251, height: 347 },
      purple: { x: 747, y: 0, width: 250, height: 347 },
      gold: { x: 76, y: 350, width: 253, height: 327 },
      legend: { x: 399, y: 348, width: 276, height: 331 },
      orange: { x: 721, y: 347, width: 304, height: 337 }
    };
    void addFrameImage(card, 'ui/cardbg', frames[player.rarity], { x: 0, y: 0, width, height, siblingIndex: 0 });
    void addImage(card, this.playerResourcePath(player), { x: 10, y: 28, width: 118, height: 118, siblingIndex: 1 });
    text(card, String(player.rating), -58, 100, 29, colors.white, 58);
    text(card, this.positionName(player.position), -58, 68, 14, colors.white, 62);
    text(card, player.name, 0, -65, 21, colors.white, 155);
    text(card, `#${player.skill}`, 0, -96, 14, colors.white, 160);
    text(card, selectable ? '点击选择' : '继续翻牌', 0, -126, 14, selectable ? colors.gold : colors.muted, 155);
    return card;
  }

  private positionName(position: PlayerCardData['position']): string {
    return position === 'GK' ? '门将' : position === 'DF' ? '后卫' : position === 'MF' ? '中场' : '前锋';
  }

  private renderBlindBox(): void {
    const root = this.screen!;
    const visible = view.getVisibleSize();
    const headerY = this.topControlY();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    void addImage(root, 'ui/football-backgrond', { x: 0, y: -20, width: 690, height: 900 });
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(2, 6, 19, 185);
    shade.rect(-360, -640, 720, 1280);
    shade.fill();
    text(root, '球探盲盒 3选1', 0, headerY - 70, 42, colors.white);
    text(root, `球探券 ${this.state.scoutTickets}  ·  先翻开全部卡牌，再选择球员`, 0, headerY - 125, 21, colors.muted);
    if (!this.state.pendingScoutChoices.length) {
      text(root, '消耗 1 张球探券，随机发现 3 名球员', 0, 120, 24, colors.muted);
      button(root, this.state.scoutTickets > 0 ? '开启盲盒' : '球探券不足', 0, -20, 360, 88, () => {
        if (this.state.startScoutDraw()) {
          GameAudio.play('reveal');
          this.show('blindBox');
        } else {
          GameAudio.play('danger');
        }
      }, this.state.scoutTickets > 0 ? colors.gold : colors.panelSoft);
    } else {
      const allRevealed = this.state.pendingScoutChoices.every((player) => this.revealedScoutIds.has(player.id));
      this.state.pendingScoutChoices.forEach((player, index) => {
        const x = -220 + index * 220;
        if (!this.revealedScoutIds.has(player.id)) {
          void addFrameImage(root, 'ui/card-guess1', { x: 185, y: 298, width: 350, height: 488 }, {
            x,
            y: 10,
            width: 205,
            height: 286,
            onClick: () => {
              GameAudio.play('reveal');
              this.revealedScoutIds.add(player.id);
              this.show('blindBox');
            }
          });
          return;
        }
        const playerCard = panel(root, x, 80, 195, 360, colors.panelSoft, 22);
        text(playerCard, player.position, 0, 145, 20, colors.gold, 160);
        text(playerCard, player.name, 0, 105, 23, colors.white, 170);
        void addImage(playerCard, this.playerResourcePath(player), { x: 0, y: 28, width: 110, height: 110 });
        text(playerCard, String(player.rating), 0, -55, 40, colors.gold, 150);
        text(playerCard, `${player.skill}\n攻 ${player.attack}  防 ${player.defense}  速 ${player.speed}`, 0, -120, 15, colors.muted, 165);
        button(playerCard, allRevealed ? '签下' : '继续翻牌', 0, -220, 150, 60, () => {
          if (!allRevealed) return;
          GameAudio.play('reward');
          this.state.claimScoutPlayer(player);
          this.revealedScoutIds.clear();
          this.show('formation');
        }, allRevealed ? colors.primary : colors.panelSoft);
      });
    }
    button(root, '返回阵容', 0, -520, 260, 68, () => this.show('formation'), colors.panelSoft);
  }

  private playerResourcePath(player: PlayerCardData): string {
    return player.portrait.replace(/^\/assets\//, '').replace(/\.[a-z0-9]+$/i, '');
  }

  private renderMatchmaking(): void {
    const root = this.screen!;
    this.matchCancelled = false;
    this.matchTicket = undefined;
    const visible = view.getVisibleSize();
    const headerY = this.topControlY();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(2, 6, 19, 52);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();
    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, { x: -305, y: headerY, width: 66, height: 66, onClick: () => this.show('formation') });
    void addFrameImage(root, 'ui/headertitle', { x: 557, y: 226, width: 474, height: 124 }, { x: -115, y: headerY, width: 245, height: 64 });
    this.renderMatchSearchSpinner(root, 0, 210);
    text(root, '正在寻找对手', 0, 25, 40, colors.white);
    const status = text(root, '正在为你寻找在线玩家', 0, -28, 23, colors.success);
    this.renderMatchInfo(root, -160);
    this.renderMatchCancelButton(root, -355);
    text(root, '预计等待时间', -62, -455, 21, colors.white, 210);
    const waitValue = text(root, '00:00', 118, -455, 25, new Color(94, 255, 111, 255), 130);
    text(root, '搜索时间过长可尝试更换阵型，可更快匹配', 0, -505, 18, colors.muted);

    let dots = 0;
    let waitSeconds = 0;
    this.schedule(() => {
      dots = (dots + 1) % 4;
      status.string = `正在为你寻找在线玩家${'.'.repeat(dots)}`;
    }, 0.45);
    this.schedule(() => {
      waitSeconds += 1;
      waitValue.string = `${String(Math.floor(waitSeconds / 60)).padStart(2, '0')}:${String(waitSeconds % 60).padStart(2, '0')}`;
    }, 1);
    void this.findOpponent();
  }

  private renderMatchSearchSpinner(parent: Node, x: number, y: number): void {
    const spinner = layer('MatchSearchSpinner', parent, 360, 360);
    spinner.setPosition(x, y);
    const sparkles = layer('MatchSparkles', spinner, 360, 360);
    const sparkleGraphics = sparkles.addComponent(Graphics);
    for (let index = 0; index < 16; index += 1) {
      const angle = Math.PI * 2 * index / 16 + (index % 3) * 0.09;
      const distance = 164 + (index % 4) * 8;
      const px = Math.cos(angle) * distance;
      const py = Math.sin(angle) * distance;
      sparkleGraphics.fillColor = [new Color(27, 188, 255, 120), new Color(255, 226, 45, 115), new Color(121, 255, 56, 110), new Color(255, 55, 126, 105)][index % 4];
      sparkleGraphics.moveTo(px - 3, py - 7);
      sparkleGraphics.lineTo(px + 5, py - 2);
      sparkleGraphics.lineTo(px + 2, py + 7);
      sparkleGraphics.lineTo(px - 5, py + 2);
      sparkleGraphics.close();
      sparkleGraphics.fill();
    }
    const orbit = layer('MatchOrbit', spinner, 320, 320);
    const orbitGraphics = orbit.addComponent(Graphics);
    for (let index = 0; index < 10; index += 1) {
      const angle = Math.PI * 2 * index / 10 - Math.PI / 2;
      orbitGraphics.fillColor = index === 2 || index === 7 ? new Color(255, 221, 37, 245) : new Color(33, 183, 244, 238);
      orbitGraphics.circle(Math.cos(angle) * 126, Math.sin(angle) * 126, 10);
      orbitGraphics.fill();
    }
    const blueArc = layer('MatchBlueArc', spinner, 360, 360);
    const blue = blueArc.addComponent(Graphics);
    blue.strokeColor = new Color(25, 170, 255, 245);
    blue.lineWidth = 10;
    blue.arc(0, 0, 160, -0.15, 1.82, false);
    blue.stroke();
    const greenArc = layer('MatchGreenArc', spinner, 360, 360);
    const green = greenArc.addComponent(Graphics);
    green.strokeColor = new Color(149, 255, 49, 245);
    green.lineWidth = 9;
    green.arc(0, 0, 160, 1.0, 2.66, false);
    green.stroke();
    const inner = spinner.addComponent(Graphics);
    inner.strokeColor = new Color(34, 185, 255, 145);
    inner.lineWidth = 3;
    inner.circle(0, 0, 118);
    inner.stroke();
    inner.fillColor = new Color(6, 25, 54, 238);
    inner.circle(0, 0, 58);
    inner.fill();
    inner.strokeColor = new Color(40, 191, 255, 245);
    inner.lineWidth = 4;
    inner.circle(0, 0, 58);
    inner.stroke();
    text(spinner, 'VS', 0, 0, 39, colors.gold, 100);
    this.schedule(() => {
      blueArc.angle -= 3.1;
      greenArc.angle += 1.6;
      orbit.angle -= 1;
      sparkles.angle += 0.7;
    }, 1 / 60);
  }

  private renderMatchInfo(parent: Node, y: number): void {
    const width = 628;
    const height = 156;
    const info = layer('MatchInfo', parent, width, height);
    info.setPosition(0, y);
    const graphics = info.addComponent(Graphics);
    graphics.fillColor = new Color(6, 21, 45, 225);
    graphics.strokeColor = new Color(31, 123, 255, 235);
    graphics.lineWidth = 4;
    graphics.moveTo(-width / 2 + 28, height / 2);
    graphics.lineTo(width / 2 - 18, height / 2);
    graphics.lineTo(width / 2, height / 2 - 22);
    graphics.lineTo(width / 2, -height / 2 + 30);
    graphics.lineTo(width / 2 - 28, -height / 2);
    graphics.lineTo(-width / 2, -height / 2);
    graphics.lineTo(-width / 2, height / 2 - 22);
    graphics.close();
    graphics.fill();
    graphics.stroke();
    text(info, '阵型', -230, 32, 23, colors.gold, 90);
    text(info, this.state.selectedFormation.name, -115, 32, 23, colors.gold, 150);
    text(info, '战力', -230, -25, 29, colors.white, 90);
    text(info, String(this.state.power), -105, -25, 31, colors.white, 160);
    text(info, '实时对战准备中', 175, -2, 24, new Color(96, 238, 255, 255), 260);
  }

  private renderMatchCancelButton(parent: Node, y: number): void {
    const cancel = layer('Button:CancelMatch', parent, 300, 78);
    cancel.setPosition(0, y);
    const graphics = cancel.addComponent(Graphics);
    graphics.fillColor = new Color(16, 42, 93, 242);
    graphics.strokeColor = new Color(43, 140, 255, 220);
    graphics.lineWidth = 4;
    graphics.moveTo(-118, 39);
    graphics.lineTo(118, 39);
    graphics.lineTo(150, 0);
    graphics.lineTo(118, -39);
    graphics.lineTo(-118, -39);
    graphics.lineTo(-150, 0);
    graphics.close();
    graphics.fill();
    graphics.stroke();
    text(cancel, '取消匹配', 0, 0, 28, colors.white, 240);
    cancel.on(Node.EventType.TOUCH_START, () => cancel.setScale(0.97, 0.97, 1));
    cancel.on(Node.EventType.TOUCH_CANCEL, () => cancel.setScale(1, 1, 1));
    cancel.on(Node.EventType.TOUCH_END, () => {
      cancel.setScale(1, 1, 1);
      GameAudio.play('tap');
      void this.cancelMatch();
      this.show('formation');
    });
  }

  private async findOpponent(): Promise<void> {
    try {
      const joined = await this.server.joinMatch({
        userId: this.state.userId,
        nickname: this.state.nickname,
        power: this.state.power,
        formationId: this.state.selectedFormation.id,
        lineup: this.state.lineup
      });
      if (this.matchCancelled || this.current !== 'matchmaking') return;
      if (joined?.opponent) return this.acceptOpponent(joined.opponent);
      this.matchTicket = joined?.ticketId;
      const startedAt = Date.now();
      while (!this.matchCancelled && this.current === 'matchmaking' && this.matchTicket) {
        await this.delay(900);
        const result = await this.server.pollMatch(this.matchTicket);
        if (result?.opponent) return this.acceptOpponent(result.opponent);
        if (Date.now() - startedAt > 5500) break;
      }
    } catch (error) {
      console.warn('[matchmaking] server unavailable, using local opponent', error);
    }
    if (!this.matchCancelled && this.current === 'matchmaking') {
      await this.delay(900);
      this.acceptOpponent({ nickname: '星河 AI 联队', isBot: true, mode: 'ai' });
    }
  }

  private acceptOpponent(opponent: typeof this.state.opponent): void {
    if (this.matchCancelled || this.current !== 'matchmaking') return;
    this.state.opponent = opponent;
    this.state.prepareOpponent();
    GameAudio.play('confirm');
    this.show('matchup');
  }

  private async cancelMatch(): Promise<void> {
    this.matchCancelled = true;
    const ticket = this.matchTicket;
    this.matchTicket = undefined;
    if (ticket) {
      try { await this.server.cancelMatch(ticket); } catch { /* Best-effort cancellation. */ }
    }
  }

  private renderMatchup(): void {
    const root = this.screen!;
    const opponentPower = this.lineupPower(this.state.opponentLineup);
    const visible = view.getVisibleSize();
    const headerY = this.topControlY();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(2, 8, 24, 90);
    shade.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    shade.fill();
    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, { x: -305, y: headerY, width: 66, height: 66, onClick: () => this.show('formation') });
    void addFrameImage(root, 'ui/headertitle', { x: 588, y: 54, width: 448, height: 108 }, { x: -125, y: headerY, width: 255, height: 61 });

    this.renderMatchTeamHero(root, false, this.state.lineup, '我方球队', '蓝焰俱乐部', this.state.selectedFormation.name);
    this.renderMatchTeamHero(root, true, this.state.opponentLineup, '对手球队', this.state.opponent.nickname, this.state.opponentFormation.name);
    void addImage(root, 'ui/vs', { x: 0, y: 465, width: 128, height: 119 });
    this.renderPowerComparison(root, this.state.power, opponentPower, 320);

    this.renderMiniLineup(root, this.state.lineup, -180, '我方阵型', this.state.selectedFormation.name, true);
    this.renderMiniLineup(root, this.state.opponentLineup, 180, '对方阵型', this.state.opponentFormation.name, false);
    this.renderCoreDuel(root);
    void addImage(root, 'ui/playbutton', {
      x: 0,
      y: -580,
      width: 370,
      height: 140,
      onClick: () => {
        GameAudio.play('kickoff');
        this.show('battle');
      }
    });
  }

  private renderMatchTeamHero(parent: Node, right: boolean, lineup: typeof this.state.lineup, titleValue: string, club: string, formation: string): void {
    const core = [...lineup].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0))[0]?.player;
    const accent = right ? colors.danger : colors.success;
    const avatarX = right ? 275 : -275;
    const labelX = right ? 170 : -170;
    const avatar = panel(parent, avatarX, 470, 88, 88, new Color(7, 17, 38, 245), 18);
    const border = avatar.getComponent(Graphics)!;
    border.strokeColor = accent;
    border.lineWidth = 4;
    border.roundRect(-42, -42, 84, 84, 16);
    border.stroke();
    if (core) void addImage(avatar, this.playerResourcePath(core), { x: 0, y: 0, width: 74, height: 74, siblingIndex: 0 });
    const badge = panel(avatar, -31, 31, 30, 30, colors.white, 15);
    text(badge, String(core?.rating ?? '--'), 0, 0, 12, new Color(21, 33, 58, 255), 28);
    text(parent, titleValue, labelX, 496, 24, colors.white, 185);
    text(parent, club, labelX, 461, 17, accent, 200);
    text(parent, `🏆 ${this.teamTrophy(formation)}`, labelX, 430, 16, new Color(248, 232, 175, 255), 190);
  }

  private renderPowerComparison(parent: Node, home: number, away: number, y: number): void {
    const box = panel(parent, 0, y, 680, 106, new Color(7, 17, 38, 235), 18);
    const shade = box.getComponent(Graphics)!;
    shade.fillColor = new Color(50, 148, 255, 210);
    shade.roundRect(-338, -35, 5, 70, 3);
    shade.fill();
    shade.fillColor = new Color(255, 77, 103, 210);
    shade.roundRect(333, -35, 5, 70, 3);
    shade.fill();
    text(box, '战力对比', 0, 35, 13, colors.muted, 100);
    text(box, '我方战力', -270, 24, 17, new Color(207, 224, 255, 255), 120);
    text(box, String(home), -265, -16, 32, new Color(77, 157, 255, 255), 120);
    text(box, '对方战力', 270, 24, 17, new Color(255, 200, 200, 255), 120);
    text(box, String(away), 265, -16, 32, new Color(255, 113, 133, 255), 120);
    const total = Math.max(1, home + away);
    const leftWidth = 360 * home / total;
    const bar = layer('PowerBar', box, 360, 24).addComponent(Graphics);
    bar.fillColor = new Color(25, 54, 91, 255);
    bar.roundRect(-180, -8, 360, 20, 10);
    bar.fill();
    bar.fillColor = colors.primary;
    bar.roundRect(-176, -4, Math.max(6, leftWidth - 4), 12, 6);
    bar.fill();
    bar.fillColor = colors.danger;
    bar.roundRect(-180 + leftWidth, -4, Math.max(6, 356 - leftWidth), 12, 6);
    bar.fill();
    bar.fillColor = new Color(255, 255, 255, 180);
    bar.circle(-180 + leftWidth, 2, 10);
    bar.fill();
  }

  private renderMiniLineup(parent: Node, lineup: typeof this.state.lineup, centerX: number, titleValue: string, formation: string, home: boolean): void {
    const holder = layer(`Lineup:${home ? 'home' : 'away'}`, parent, 344, 520);
    holder.setPosition(centerX, -18);
    const pitchOffsetX = home ? 8 : -8;
    void addFrameImage(holder, 'ui/vs-squard', home ? { x: 0, y: 0, width: 520, height: 733 } : { x: 560, y: 0, width: 520, height: 733 }, { x: 0, y: -4, width: 344, height: 500, siblingIndex: 0 });
    text(holder, titleValue, 0, 208, 18, colors.white, 280);
    text(holder, formation, 0, 178, 17, home ? colors.success : colors.gold, 280);
    void addFrameImage(holder, 'ui/squard-qc', { x: 24, y: 24, width: 816, height: 1032 }, { x: pitchOffsetX, y: -48, width: 306, height: 386, siblingIndex: 1 });
    lineup.forEach((slot) => {
      const x = pitchOffsetX + (slot.x - 0.5) * 268;
      const y = 132 - slot.y * 338;
      this.renderMiniPlayerCard(holder, slot.player, x, y, home);
    });
  }

  private renderMiniPlayerCard(parent: Node, player: PlayerCardData | undefined, x: number, y: number, home: boolean): void {
    const chip = layer(`MiniPlayer:${player?.id ?? 'empty'}`, parent, 62, 76);
    chip.setPosition(x, y);
    const frame = chip.addComponent(Graphics);
    const accent = player ? this.colorFromNumber(player.color) : (home ? colors.primary : colors.danger);
    frame.fillColor = new Color(4, 17, 39, 248);
    frame.strokeColor = accent;
    frame.lineWidth = 2;
    frame.moveTo(0, 37);
    frame.lineTo(29, 22);
    frame.lineTo(29, -19);
    frame.lineTo(0, -37);
    frame.lineTo(-29, -19);
    frame.lineTo(-29, 22);
    frame.close();
    frame.fill();
    frame.stroke();
    if (player) {
      void addImage(chip, this.playerResourcePath(player), { x: 0, y: 7, width: 48, height: 48, siblingIndex: 0 });
    } else {
      text(chip, '+', 0, 5, 24, colors.muted, 36);
    }
    const ratingBg = panel(chip, 0, -25, 44, 22, new Color(6, 27, 59, 245), 7);
    text(ratingBg, `${player?.rating ?? '--'}`, 0, 0, 13, colors.white, 38);
  }

  private renderCoreDuel(parent: Node): void {
    const home = [...this.state.lineup].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0))[0]?.player;
    const away = [...this.state.opponentLineup].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0))[0]?.player;
    const duel = layer('CoreDuel', parent, 680, 230);
    duel.setPosition(0, -385);
    void addImage(duel, 'ui/playercore', { x: 0, y: 0, width: 680, height: 230, siblingIndex: 0 });
    sectionTitle(duel, '核心对位', -225, 72, 210, colors.gold, 18);
    const leftCard = panel(duel, -210, 35, 205, 72, new Color(7, 17, 38, 235), 13);
    const rightCard = panel(duel, 210, 35, 205, 72, new Color(7, 17, 38, 235), 13);
    if (home) void addImage(leftCard, this.playerResourcePath(home), { x: -68, y: 0, width: 52, height: 52, siblingIndex: 0 });
    if (away) void addImage(rightCard, this.playerResourcePath(away), { x: 68, y: 0, width: 52, height: 52, siblingIndex: 0 });
    text(leftCard, `${home?.rating ?? '--'}  ${home?.name ?? '待定'}`, 25, 12, 17, colors.white, 135);
    text(leftCard, home ? `${this.positionName(home.position)} · ${home.role}` : '核心球员', 25, -16, 13, colors.muted, 135);
    text(rightCard, `${away?.name ?? '待定'}  ${away?.rating ?? '--'}`, -25, 12, 17, colors.white, 135);
    text(rightCard, away ? `${this.positionName(away.position)} · ${away.role}` : '核心球员', -25, -16, 13, colors.muted, 135);
    text(duel, 'VS', 0, 36, 31, colors.white, 70);
    this.renderCoreStat(duel, '进攻', home?.attack ?? 0, away?.attack ?? 0, -12);
    this.renderCoreStat(duel, '中场', home?.speed ?? 0, away?.speed ?? 0, -48);
    this.renderCoreStat(duel, '防守', home?.defense ?? 0, away?.defense ?? 0, -84);
  }

  private renderCoreStat(parent: Node, titleValue: string, home: number, away: number, y: number): void {
    const max = Math.max(1, home, away);
    text(parent, String(home), -290, y, 16, new Color(92, 166, 255, 255), 60);
    text(parent, titleValue, 0, y, 15, colors.white, 80);
    text(parent, String(away), 290, y, 16, new Color(255, 113, 133, 255), 60);
    const bars = layer(`CoreStat:${titleValue}`, parent, 420, 14);
    bars.setPosition(0, y);
    const graphics = bars.addComponent(Graphics);
    graphics.fillColor = new Color(7, 17, 38, 150);
    graphics.roundRect(-210, -5, 160, 10, 5);
    graphics.roundRect(50, -5, 160, 10, 5);
    graphics.fill();
    graphics.fillColor = colors.primary;
    graphics.roundRect(-210, -5, 160 * home / max, 10, 5);
    graphics.fill();
    graphics.fillColor = colors.danger;
    graphics.roundRect(50, -5, 160 * away / max, 10, 5);
    graphics.fill();
  }

  private lineupPower(lineup: typeof this.state.lineup): number {
    return lineup.reduce((sum, slot) => sum + (slot.player?.rating ?? 70), 0);
  }

  private teamTrophy(formation: string): string {
    return formation.replace(/-/g, '').slice(0, 4).padEnd(4, '0');
  }

  private colorFromNumber(value: number): Color {
    return new Color((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff, 255);
  }

  private renderBattle(): void {
    const root = this.screen!;
    this.scoreA = 0;
    this.scoreB = 0;
    this.battleIndex = 0;
    this.battleEvents = [];
    const visible = view.getVisibleSize();
    const headerY = this.topControlY();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(2, 8, 23, 62);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();
    void addFrameImage(root, 'ui/headertitle', { x: 557, y: 226, width: 474, height: 124 }, { x: -115, y: headerY, width: 245, height: 64 });
    this.renderBattleTeamMark(root, -274, 470, '蓝', colors.primary, '我方球队', '蓝焰俱乐部');
    this.renderBattleTeamMark(root, 274, 470, 'AI', colors.danger, '对手球队', this.state.opponent.nickname);
    this.battleScoreHome = text(root, '0', -62, 470, 78, colors.primary, 90);
    text(root, ':', 0, 470, 62, colors.white, 60);
    this.battleScoreAway = text(root, '0', 62, 470, 78, colors.danger, 90);
    const clockBox = panel(root, 0, 380, 174, 54, new Color(5, 21, 49, 240), 8);
    this.battleClock = text(clockBox, "00'", 0, 0, 28, colors.gold, 140);
    this.renderPossession(root);
    const feed = panel(root, 0, -245, 676, 680, new Color(6, 20, 47, 205), 16);
    this.battleEventLayer = layer('BattleEvents', feed, 630, 640);
    this.battleEventLayer.setPosition(0, 0);
    this.renderBattleEventCards();
    this.schedule(this.pushBattleMoment, 1.35, LOCAL_MOMENTS.length - 1, 0.7);
  }

  private renderBattleTeamMark(parent: Node, x: number, y: number, mark: string, accent: Color, titleValue: string, club: string): void {
    const badge = layer(`TeamMark:${mark}`, parent, 116, 116);
    badge.setPosition(x, y);
    const graphics = badge.addComponent(Graphics);
    graphics.fillColor = new Color(7, 23, 53, 245);
    graphics.strokeColor = accent;
    graphics.lineWidth = 5;
    graphics.roundRect(-56, -56, 112, 112, 18);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = accent;
    graphics.moveTo(0, 38);
    graphics.lineTo(32, 20);
    graphics.lineTo(23, -27);
    graphics.lineTo(0, -40);
    graphics.lineTo(-23, -27);
    graphics.lineTo(-32, 20);
    graphics.close();
    graphics.fill();
    text(badge, mark, 0, 0, mark.length > 1 ? 20 : 29, colors.white, 70);
    text(parent, titleValue, x, 385, 22, colors.white, 180);
    text(parent, club, x, 352, 16, mark === 'AI' ? colors.gold : colors.success, 200);
  }

  private renderPossession(parent: Node): void {
    const box = panel(parent, 0, 220, 676, 206, new Color(6, 20, 47, 220), 12);
    sectionTitle(box, '比赛势头', 0, 65, 360, colors.cyan, 23);
    this.battlePossessionLeft = text(box, '我方稳控', -255, 8, 20, colors.primary, 135);
    this.battlePossessionRight = text(box, '对方反击', 255, 8, 20, colors.danger, 135);
    const fillLayer = layer('PossessionFill', box, 300, 36);
    fillLayer.setPosition(0, 8);
    this.battlePossession = fillLayer.addComponent(Graphics);
    this.battlePossessionBall = text(box, '⚽', 0, 8, 27, colors.white, 45);
    this.battlePossessionHint = text(box, '双方拉锯中，寻找下一次机会！', 0, -63, 18, colors.muted, 540);
    this.updateBattlePossession();
  }

  private updateBattlePossession(): void {
    if (!this.battlePossession) return;
    const home = Math.max(0.32, Math.min(0.68, 0.5 + (this.state.power - this.lineupPower(this.state.opponentLineup)) / 1800 + (this.scoreA - this.scoreB) * 0.025));
    const width = 300;
    const split = width * home;
    this.battlePossession.clear();
    this.battlePossession.fillColor = new Color(7, 17, 38, 220);
    this.battlePossession.roundRect(-width / 2, -13, width, 26, 13);
    this.battlePossession.fill();
    this.battlePossession.fillColor = colors.primary;
    this.battlePossession.roundRect(-width / 2, -13, split, 26, 13);
    this.battlePossession.fill();
    this.battlePossession.fillColor = colors.danger;
    this.battlePossession.roundRect(-width / 2 + split, -13, width - split, 26, 13);
    this.battlePossession.fill();
    if (this.battlePossessionBall) this.battlePossessionBall.node.setPosition(-width / 2 + split, 8);
    const homeDominant = home >= 0.54;
    const awayDominant = home <= 0.46;
    if (this.battlePossessionLeft) this.battlePossessionLeft.string = homeDominant ? '我方压制' : '我方稳控';
    if (this.battlePossessionRight) this.battlePossessionRight.string = awayDominant ? '对方压制' : '对方反击';
    if (this.battlePossessionHint) {
      this.battlePossessionHint.string = homeDominant ? '我方占据场上优势，继续保持！' : awayDominant ? '对方反击正在升温，注意回防！' : '双方拉锯中，寻找下一次机会！';
      this.battlePossessionHint.color = homeDominant ? new Color(40, 245, 255, 255) : awayDominant ? colors.gold : colors.muted;
    }
  }

  private renderBattleEventCards(): void {
    const layerNode = this.battleEventLayer;
    if (!layerNode) return;
    layerNode.removeAllChildren();
    const entries = this.battleEvents.length ? this.battleEvents.slice(-5) : [{ time: 0, title: '比赛准备', text: '裁判正在确认双方阵容…', mood: 'normal', scoreA: 0, scoreB: 0 } as BattleEvent];
    entries.forEach((event, index) => {
      const card = layer(`Event:${event.time}`, layerNode, 600, 96);
      const targetY = 260 - index * 112;
      card.setPosition(index === entries.length - 1 ? 46 : 0, targetY);
      const frame = this.battleEventFrame(event);
      void addFrameImage(card, 'ui/gameevents', frame, { x: 0, y: 0, width: 600, height: 96, siblingIndex: 0 });
      const accent = event.team === 'away' ? colors.danger : event.team === 'home' ? colors.primary : colors.gold;
      text(card, `${String(event.time).padStart(2, '0')}'`, -165, 0, 22, accent, 82);
      const titleValue = event.title ?? '比赛动态';
      const actor = this.battleActor(event.actor);
      if (actor) void addImage(card, this.playerResourcePath(actor), { x: -96, y: 19, width: 34, height: 34, siblingIndex: 1 });
      text(card, `${event.actor ? `${event.actor} · ` : ''}${titleValue}`, 92, 19, 18, accent, 400);
      text(card, event.text, 92, -20, 14, colors.white, 400);
      if (event.team === 'away') {
        const borderNode = layer('AwayEventBorder', card, 600, 96);
        const border = borderNode.addComponent(Graphics);
        border.strokeColor = colors.danger;
        border.lineWidth = 2;
        border.roundRect(-299, -47, 598, 94, 13);
        border.stroke();
      }
      if (index === entries.length - 1) {
        card.setScale(0.96, 0.96, 1);
        tween(card)
          .to(0.24, { position: new Vec3(0, targetY, 0), scale: new Vec3(1, 1, 1) }, { easing: 'cubicOut' })
          .start();
      }
    });
  }

  private battleActor(name?: string): PlayerCardData | undefined {
    if (!name) return undefined;
    return [...this.state.lineup, ...this.state.opponentLineup].find((slot) => slot.player?.name === name)?.player;
  }

  private battleEventFrame(event: BattleEvent): { x: number; y: number; width: number; height: number } {
    const titleValue = event.title ?? '';
    const frames = {
      shot: { x: 25, y: 44, width: 675, height: 110 },
      goal: { x: 25, y: 165, width: 675, height: 110 },
      save: { x: 25, y: 286, width: 675, height: 110 },
      corner: { x: 25, y: 407, width: 675, height: 109 },
      yellow: { x: 25, y: 528, width: 675, height: 109 },
      red: { x: 25, y: 648, width: 675, height: 110 },
      injury: { x: 25, y: 769, width: 675, height: 110 },
      sub: { x: 25, y: 889, width: 675, height: 111 }
    };
    const aliases: Record<string, keyof typeof frames> = {
      yellow_card: 'yellow',
      red_card: 'red',
      substitution: 'sub'
    };
    const explicit = event.eventType ? aliases[event.eventType] ?? event.eventType : undefined;
    const key: keyof typeof frames = explicit && explicit in frames
      ? explicit as keyof typeof frames
      : titleValue.includes('进球') ? 'goal'
        : titleValue.includes('扑救') || titleValue.includes('门将') ? 'save'
          : titleValue.includes('角球') ? 'corner'
            : titleValue.includes('黄牌') ? 'yellow'
              : titleValue.includes('红牌') ? 'red'
                : titleValue.includes('伤') ? 'injury'
                  : titleValue.includes('换人') ? 'sub' : 'shot';
    return frames[key];
  }

  private playBattleEventEffect(event: BattleEvent): void {
    const type = event.eventType ?? '';
    const titleValue = event.title ?? '';
    const isGoal = type === 'goal' || titleValue.includes('进球');
    const isSave = type === 'save' || titleValue.includes('扑救') || titleValue.includes('门将');
    const isYellow = type === 'yellow' || type === 'yellow_card' || titleValue.includes('黄牌');
    const isRed = type === 'red' || type === 'red_card' || titleValue.includes('红牌');
    if (!isGoal && !isSave && !isYellow && !isRed) return;

    const accent = isGoal
      ? (event.team === 'away' ? colors.danger : colors.primary)
      : isSave ? new Color(61, 198, 255, 255)
        : isRed ? new Color(255, 48, 69, 255) : colors.gold;
    const headline = isGoal ? (event.team === 'away' ? '对手破门' : '破门！') : isSave ? '神扑！' : isRed ? '红牌！' : '黄牌！';
    const displayTitle = event.actor && !isGoal ? `${event.actor} · ${headline}` : headline;
    const subtitle = isGoal ? `${this.scoreA} : ${this.scoreB}` : event.text;
    const overlay = layer(`BattleEffect:${headline}`, this.screen!, DESIGN_WIDTH, DESIGN_HEIGHT);
    const opacity = overlay.addComponent(UIOpacity);
    opacity.opacity = 0;
    const shade = overlay.addComponent(Graphics);
    shade.fillColor = new Color(1, 7, 22, isGoal ? 158 : 42);
    shade.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    shade.fill();

    const banner = layer('SpecialEventBanner', overlay, 590, 156);
    banner.setPosition(0, 38);
    const bannerGraphics = banner.addComponent(Graphics);
    bannerGraphics.fillColor = new Color(3, 17, 43, 250);
    bannerGraphics.strokeColor = accent;
    bannerGraphics.lineWidth = 3;
    bannerGraphics.roundRect(-285, -70, 570, 140, 18);
    bannerGraphics.fill();
    bannerGraphics.stroke();
    bannerGraphics.fillColor = new Color(accent.r, accent.g, accent.b, 38);
    bannerGraphics.moveTo(-174, 68);
    bannerGraphics.lineTo(280, 68);
    bannerGraphics.lineTo(215, 16);
    bannerGraphics.lineTo(-174, -12);
    bannerGraphics.close();
    bannerGraphics.fill();
    bannerGraphics.fillColor = accent;
    bannerGraphics.roundRect(-282, -55, 6, 110, 3);
    bannerGraphics.fill();

    const iconPlate = layer('SpecialEventIcon', banner, 104, 104);
    iconPlate.setPosition(-218, 0);
    const iconGraphics = iconPlate.addComponent(Graphics);
    iconGraphics.fillColor = new Color(3, 12, 31, 235);
    iconGraphics.strokeColor = accent;
    iconGraphics.lineWidth = 3;
    iconGraphics.circle(0, 0, 48);
    iconGraphics.fill();
    iconGraphics.stroke();
    if (isYellow || isRed) {
      const cardIcon = layer('RefereeCard', iconPlate, 42, 62);
      cardIcon.angle = -11;
      const cardGraphics = cardIcon.addComponent(Graphics);
      cardGraphics.fillColor = accent;
      cardGraphics.roundRect(-17, -27, 34, 54, 5);
      cardGraphics.fill();
    } else {
      void addImage(iconPlate, isSave ? 'ui/result/event-save' : 'ui/result/event-ball', {
        x: 0,
        y: 0,
        width: 76,
        height: 76,
        siblingIndex: 0
      });
    }

    text(banner, `${event.time}'`, -218, -52, 16, accent, 80);
    text(banner, displayTitle, 68, 24, isGoal ? 43 : 31, accent, 390);
    text(banner, subtitle, 68, -28, isGoal ? 31 : 18, isGoal ? colors.gold : colors.white, 390);
    banner.setScale(0.82, 0.82, 1);

    tween(banner)
      .to(0.16, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'backOut' })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .start();
    tween(opacity)
      .to(0.1, { opacity: 255 })
      .delay(isGoal ? 1.1 : 0.82)
      .to(0.22, { opacity: 0 })
      .call(() => { if (overlay.isValid) overlay.destroy(); })
      .start();
  }

  private readonly pushBattleMoment = (): void => {
    if (this.current !== 'battle') return;
    const moment = LOCAL_MOMENTS[this.battleIndex];
    const minute = this.battleIndex === LOCAL_MOMENTS.length - 1 ? 90 : Math.min(89, 4 + this.battleIndex * 12);
    let eventTeam = moment.team;
    if (moment.goal) {
      const homeAdvantage = this.state.power >= 850 ? 0.62 : 0.5;
      if (Math.random() < homeAdvantage) {
        this.scoreA += 1;
        eventTeam = 'home';
      } else {
        this.scoreB += 1;
        eventTeam = 'away';
      }
    } else if (this.battleIndex === 5 && Math.random() > 0.58) {
      this.scoreB += 1;
      eventTeam = 'away';
    }
    const event: BattleEvent = {
      time: minute,
      title: moment.title,
      text: moment.detail,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      mood: moment.mood,
      team: eventTeam,
      eventType: moment.eventType,
      actor: this.pickEventPlayer(eventTeam)?.name
    };
    this.battleEvents.push(event);
    this.battleClock!.string = `${minute}'`;
    this.battleScoreHome!.string = String(this.scoreA);
    this.battleScoreAway!.string = String(this.scoreB);
    this.updateBattlePossession();
    this.renderBattleEventCards();
    this.playBattleEventSound(event);
    this.playBattleEventEffect(event);
    this.battleIndex += 1;
    if (this.battleIndex >= LOCAL_MOMENTS.length) this.scheduleOnce(() => this.finishBattle(), 0.9);
  };

  private playBattleEventSound(event: BattleEvent): void {
    const type = event.eventType ?? '';
    const titleValue = event.title ?? '';
    if (titleValue.includes('全场结束')) return GameAudio.play('whistle');
    if (type === 'goal' || titleValue.includes('进球')) return GameAudio.play('goal');
    if (type === 'save' || titleValue.includes('扑救') || titleValue.includes('门将')) return GameAudio.play('save');
    if (type === 'yellow' || type === 'red' || type === 'yellow_card' || type === 'red_card' || /黄牌|红牌/.test(titleValue)) return GameAudio.play('card');
    GameAudio.play(event.mood === 'bad' ? 'danger' : event.mood === 'good' ? 'confirm' : 'tap');
  }

  private pickEventPlayer(team?: 'home' | 'away'): PlayerCardData | undefined {
    const lineup = team === 'away' ? this.state.opponentLineup : this.state.lineup;
    const available = lineup.flatMap((slot) => slot.player ? [slot.player] : []);
    return available[Math.floor(Math.random() * available.length)];
  }

  private finishBattle(): void {
    const result = { scoreA: this.scoreA, scoreB: this.scoreB, events: this.battleEvents };
    this.state.applyBattleResult(result);
    void this.server.recordMatch({
      playerId: this.state.userId,
      opponent: this.state.opponent,
      playerScore: result.scoreA,
      opponentScore: result.scoreB,
      formationId: this.state.selectedFormation.id,
      lineup: this.state.lineup,
      events: result.events
    }).catch((error) => console.warn('[match] result sync deferred', error));
    this.show('result');
  }

  private renderResult(): void {
    const root = this.screen!;
    const result = this.state.battleResult;
    const won = result.scoreA > result.scoreB;
    const draw = result.scoreA === result.scoreB;
    this.scheduleOnce(() => GameAudio.play(won ? 'win' : draw ? 'confirm' : 'lose'), 0.18);
    this.scheduleOnce(() => GameAudio.play('reward'), 0.72);
    const visible = view.getVisibleSize();
    const headerY = this.topControlY();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    const wash = root.addComponent(Graphics);
    wash.fillColor = new Color(1, 8, 27, 80);
    wash.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    wash.fill();
    void addFrameImage(root, 'ui/headertitle', { x: 55, y: 408, width: 463, height: 116 }, { x: 0, y: headerY, width: 300, height: 75 });
    text(root, won ? '比赛胜利' : draw ? '握手言和' : '比赛结束', 0, headerY - 82, 45, won ? colors.gold : colors.white, 520);
    this.renderResultTeamBadge(root, -245, headerY - 190, '蓝', colors.primary, '蓝焰俱乐部');
    this.renderResultTeamBadge(root, 245, headerY - 190, 'AI', colors.danger, this.state.opponent.nickname);
    text(root, String(result.scoreA), -58, headerY - 188, 76, colors.primary, 90);
    text(root, ':', 0, headerY - 188, 62, colors.white, 55);
    text(root, String(result.scoreB), 58, headerY - 188, 76, colors.danger, 90);

    const homePower = this.state.power;
    const awayPower = this.lineupPower(this.state.opponentLineup);
    const possession = Math.max(35, Math.min(65, Math.round(50 + (homePower - awayPower) / Math.max(20, homePower + awayPower) * 100)));
    const count = (team: 'home' | 'away', pattern: RegExp) => result.events.filter((event) => event.team === team && pattern.test(event.title ?? '')).length;
    const matchStats = [
      { label: '控球率', home: possession, away: 100 - possession, suffix: '%' },
      { label: '射门', home: 4 + result.scoreA * 2 + count('home', /射门|远射|推进/), away: 4 + result.scoreB * 2 + count('away', /射门|远射|推进/), suffix: '' },
      { label: '角球', home: 1 + count('home', /角球/), away: 1 + count('away', /角球/), suffix: '' },
      { label: '黄牌', home: count('home', /黄牌/), away: count('away', /黄牌/), suffix: '' },
      { label: '红牌', home: count('home', /红牌/), away: count('away', /红牌/), suffix: '' }
    ];
    this.renderResultStats(root, matchStats, headerY - 455);
    this.renderResultTimeline(root, result.events, headerY - 760);
    this.renderResultReward(root, won, headerY - 965);
    this.renderResultHomeButton(root, headerY - 1080);
    text(root, `生涯战绩  ${this.state.matchesPlayed} 场 ${this.state.wins} 胜`, 0, headerY - 1140, 17, colors.muted, 420);
  }

  private renderResultTeamBadge(parent: Node, x: number, y: number, mark: string, accent: Color, club: string): void {
    const node = layer(`ResultTeam:${mark}`, parent, 210, 150);
    node.setPosition(x, y);
    void addImage(node, mark === 'AI' ? 'ui/result/team-away' : 'ui/result/team-home', {
      x: 0,
      y: 25,
      width: mark === 'AI' ? 100 : 96,
      height: 120,
      siblingIndex: 0
    });
    text(node, club, 0, -55, 19, colors.white, 200);
  }

  private renderResultStats(
    parent: Node,
    rows: Array<{ label: string; home: number; away: number; suffix: string }>,
    y: number
  ): void {
    const card = layer('ResultStatsPanel', parent, 650, 330);
    card.setPosition(0, y);
    void addImage(card, 'ui/result/stats-panel', { x: 0, y: 0, width: 650, height: 330, siblingIndex: 0 });
    text(card, '比赛数据', 0, 133, 25, colors.gold, 240);
    rows.forEach((row, index) => {
      const rowY = 82 - index * 49;
      const max = Math.max(1, row.home, row.away);
      const homeWidth = 140 * row.home / max;
      const awayWidth = 140 * row.away / max;
      text(card, `${row.home}${row.suffix}`, -278, rowY, 21, colors.primary, 72);
      text(card, row.label, 0, rowY, 18, colors.white, 100);
      text(card, `${row.away}${row.suffix}`, 278, rowY, 21, colors.danger, 72);
      const bars = layer(`ResultStat:${row.label}`, card, 430, 12);
      bars.setPosition(0, rowY);
      const graphics = bars.addComponent(Graphics);
      graphics.fillColor = new Color(24, 49, 83, 220);
      graphics.roundRect(-210, -5, 140, 10, 5);
      graphics.roundRect(70, -5, 140, 10, 5);
      graphics.fill();
      graphics.fillColor = colors.primary;
      graphics.roundRect(-70 - homeWidth, -5, homeWidth, 10, 5);
      graphics.fill();
      graphics.fillColor = colors.danger;
      graphics.roundRect(70, -5, awayWidth, 10, 5);
      graphics.fill();
      if (index < rows.length - 1) divider(card, 0, rowY - 24, 560, new Color(49, 92, 137, 60));
    });
  }

  private renderResultTimeline(parent: Node, events: BattleEvent[], y: number): void {
    const card = layer('ResultTimelinePanel', parent, 650, 220);
    card.setPosition(0, y);
    void addImage(card, 'ui/result/timeline-panel', { x: 0, y: 0, width: 650, height: 220, siblingIndex: 0 });
    text(card, '关键事件', 0, 82, 24, colors.gold, 240);
    const useful = events.filter((event) => !/比赛开始/.test(event.title ?? ''));
    const selected = useful.length <= 4
      ? useful
      : [useful[0], useful[Math.floor((useful.length - 1) / 3)], useful[Math.floor((useful.length - 1) * 2 / 3)], useful[useful.length - 1]];
    const timelineLayer = layer('ResultTimelineLine', card, 520, 6);
    timelineLayer.setPosition(0, 12);
    const timeline = timelineLayer.addComponent(Graphics);
    timeline.strokeColor = new Color(105, 144, 188, 180);
    timeline.lineWidth = 3;
    timeline.moveTo(-238, 0);
    timeline.lineTo(238, 0);
    timeline.stroke();
    const entries = selected.length ? selected.slice(0, 4) : [{ time: 90, title: '全场结束', text: '比赛结束', scoreA: 0, scoreB: 0, mood: 'normal' } as BattleEvent];
    entries.forEach((event, index) => {
      const x = entries.length === 1 ? 0 : -225 + index * (450 / (entries.length - 1));
      const accent = event.team === 'away' ? colors.danger : event.team === 'home' ? colors.primary : colors.gold;
      const icon = /扑救/.test(event.title ?? '') ? 'ui/result/event-save' : /结束/.test(event.title ?? '') ? 'ui/result/event-whistle' : 'ui/result/event-ball';
      const fullTime = /结束/.test(event.title ?? '');
      void addImage(card, icon, { x, y: 12, width: 50, height: 50, siblingIndex: 1 });
      text(card, `${event.time}'`, x, 52, 18, accent, 76);
      text(card, fullTime ? '全场结束' : event.actor ?? event.title ?? '比赛事件', x, -34, 16, colors.white, 136);
      text(card, fullTime ? '裁判终场哨' : event.title ?? '', x, -63, 13, colors.muted, 132);
    });
  }

  private renderResultReward(parent: Node, won: boolean, y: number): void {
    const reward = layer('ResultRewardPanel', parent, 650, 128);
    reward.setPosition(0, y);
    void addImage(reward, 'ui/result/reward-panel', { x: 0, y: 0, width: 650, height: 128, siblingIndex: 0 });
    text(reward, '比赛奖励', 0, 42, 22, colors.gold, 240);
    void addImage(reward, 'ui/result/reward-coin', { x: -248, y: -15, width: 48, height: 56, siblingIndex: 1 });
    void addImage(reward, 'ui/result/reward-energy', { x: 58, y: -15, width: 48, height: 48, siblingIndex: 1 });
    text(reward, `金币  +${won ? 1200 : 520}`, -145, -15, 23, colors.white, 180);
    text(reward, '体力  -5', 160, won ? 0 : -15, 20, colors.white, 150);
    if (won) text(reward, '球探券  +1', 160, -29, 17, colors.gold, 150);
    const rewardSplit = layer('ResultRewardSplit', reward, 2, 54);
    rewardSplit.setPosition(0, -15);
    const splitGraphics = rewardSplit.addComponent(Graphics);
    splitGraphics.fillColor = new Color(92, 137, 198, 105);
    splitGraphics.rect(-1, -27, 2, 54);
    splitGraphics.fill();
  }

  private renderResultHomeButton(parent: Node, y: number): void {
    const buttonNode = layer('Button:ResultHome', parent, 380, 76);
    buttonNode.setPosition(0, y);
    void addImage(buttonNode, 'ui/result/primary-button', { x: 0, y: 0, width: 380, height: 65, siblingIndex: 0 });
    text(buttonNode, '返回首页', 0, 0, 27, colors.white, 300);
    buttonNode.on(Node.EventType.TOUCH_START, () => buttonNode.setScale(0.97, 0.97, 1));
    buttonNode.on(Node.EventType.TOUCH_CANCEL, () => buttonNode.setScale(1, 1, 1));
    buttonNode.on(Node.EventType.TOUCH_END, () => {
      buttonNode.setScale(1, 1, 1);
      GameAudio.play('tap');
      this.show('home');
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
