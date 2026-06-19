import { _decorator, Color, Component, Graphics, Label, macro, Node, ResolutionPolicy, sys, UITransform, view } from 'cc';
import { GameState } from '../domain/GameState';
import { formations } from '../domain/data';
import type { BattleEvent, PlayerCardData } from '../domain/types';
import { GameServerClient } from '../services/GameServerClient';
import { addCoverImage, addFrameImage, addImage } from './ImageUi';
import { button, colors, DESIGN_HEIGHT, DESIGN_WIDTH, divider, formatNumber, layer, panel, text } from './UiFactory';

const { ccclass } = _decorator;
type ScreenName = 'loading' | 'home' | 'shop' | 'formation' | 'blindBox' | 'matchmaking' | 'matchup' | 'battle' | 'result';

interface BattleMoment {
  title: string;
  detail: string;
  team?: 'home' | 'away';
  goal?: boolean;
  mood: BattleEvent['mood'];
}

const LOCAL_MOMENTS: BattleMoment[] = [
  { title: '比赛开始', detail: '双方在中场展开争夺。', mood: 'normal' },
  { title: '快速推进', detail: '边路连续传递，进攻进入危险区域。', team: 'home', mood: 'good' },
  { title: '门将扑救', detail: '对方射门被门将稳稳抱住。', team: 'away', mood: 'good' },
  { title: '进球', detail: '禁区内冷静推射，皮球滚入网窝！', team: 'home', goal: true, mood: 'good' },
  { title: '反击', detail: '对手抓住身后空间形成单刀。', team: 'away', mood: 'bad' },
  { title: '角球', detail: '高球传入禁区，双方争抢第一点。', team: 'home', mood: 'normal' },
  { title: '远射', detail: '禁区外突然起脚，皮球擦柱而出。', team: 'away', mood: 'bad' },
  { title: '全场结束', detail: '裁判吹响终场哨。', mood: 'normal' }
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
  private battleScore?: Label;
  private battleEventLayer?: Node;
  private battlePossession?: Graphics;
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
    void addImage(root, 'ui/top-button-v2', { x: hud.barX, y: hud.y, width: hud.barWidth, height: hud.barHeight });
    text(root, formatNumber(this.state.gems), hud.barX - hud.barWidth * 0.25, hud.y, 19, colors.white, hud.barWidth * 0.27);
    text(root, `${this.state.energy}/120`, hud.barX + hud.barWidth * 0.25, hud.y, 19, colors.white, hud.barWidth * 0.29);
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
    this.homeImageShortcut(root, 0, '七日签到', -300, 430, () => this.openSignModal());
    this.homeImageShortcut(root, 1, '商城', -300, 290, () => this.show('shop'));
    this.homeImageShortcut(root, 2, '关注领奖', 300, 430, () => this.openFollowModal());
    this.homeImageShortcut(root, 1, '每日任务', 300, 290, () => this.openTasksModal());
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
    return {
      y: Math.max(575, Math.min(650, y)),
      avatarX,
      avatarSize,
      barX,
      barWidth,
      barHeight: Math.max(64, barWidth * (180 / 1280))
    };
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
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    const wash = root.addComponent(Graphics);
    wash.fillColor = new Color(0, 16, 55, 190);
    wash.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    wash.fill();

    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, {
      x: -305,
      y: 575,
      width: 66,
      height: 66,
      onClick: () => this.show('home')
    });
    void addFrameImage(root, 'ui/headertitle', { x: 75, y: 52, width: 360, height: 110 }, {
      x: -135,
      y: 575,
      width: 210,
      height: 64
    });
    const balance = panel(root, 235, 575, 200, 58, new Color(6, 21, 47, 245), 28);
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
        if (!claimed && this.state.claimReward(claimId, rewards[day - 1].reward)) this.openSignModal();
      }
    });

    const close = layer('SignClose', card, 90, 80);
    close.setPosition(panelWidth * 0.39, panelHeight * 0.43);
    close.on(Node.EventType.TOUCH_END, () => this.closeModal());
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
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, { x: -305, y: 570, width: 66, height: 66, onClick: () => this.show('home') });
    void addFrameImage(root, 'ui/headertitle', { x: 74, y: 228, width: 350, height: 104 }, { x: -135, y: 570, width: 210, height: 62 });
    const recommend = panel(root, 260, 565, 135, 58, colors.panelSoft, 18);
    text(recommend, `推荐\n最强阵容`, 0, 0, 16, colors.white, 120);
    recommend.on(Node.EventType.TOUCH_END, () => this.autoFillStrongest());
    const formationIndex = formations.findIndex((item) => item.id === this.state.selectedFormation.id);
    const previous = (formationIndex - 1 + formations.length) % formations.length;
    const next = (formationIndex + 1) % formations.length;
    this.renderFormationChoice(root, formations[previous], previous, -225, 440, 170, 145, false);
    this.renderFormationChoice(root, this.state.selectedFormation, formationIndex, 0, 435, 215, 180, true);
    this.renderFormationChoice(root, formations[next], next, 225, 440, 170, 145, false);
    button(root, '‹', -320, 440, 54, 54, () => this.changeFormation(-1), colors.panelSoft);
    button(root, '›', 320, 440, 54, 54, () => this.changeFormation(1), colors.panelSoft);

    void addImage(root, 'ui/football-backgrond', { x: 0, y: -5, width: 690, height: 650, siblingIndex: 0 });

    this.state.lineup.forEach((slot) => {
      const x = (slot.x - 0.5) * 570;
      const y = (0.52 - slot.y) * 500 + 5;
      const selected = this.selectedLineupSlotId === slot.id;
      const card = this.playerHex(root, x, y, slot.player, slot.position, selected, 48);
      card.on(Node.EventType.TOUCH_END, () => this.selectLineupSlot(slot.id));
    });

    void addImage(root, 'ui/players-bg', { x: 0, y: -410, width: 680, height: 205, siblingIndex: 1 });
    text(root, '替补球员', -270, -345, 20, colors.white, 130);
    this.state.substitutes.forEach((player, index) => {
      const x = -200 + index * 105;
      const selected = this.selectedBenchIndex === index;
      const card = this.playerHex(root, x, -415, player, player?.position ?? '空', selected, 38);
      card.on(Node.EventType.TOUCH_END, () => this.selectBench(index));
    });
    void addFrameImage(root, 'ui/button-ready', { x: 63, y: 203, width: 995, height: 275 }, {
      x: 0,
      y: -580,
      width: 330,
      height: 91,
      onClick: () => this.show('matchmaking')
    });
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
    const used = new Set<string>();
    this.state.lineup.forEach((slot) => {
      const player = this.state.ownedPlayers(slot.position).find((candidate) => !used.has(candidate.id));
      if (player) {
        this.state.fillSlot(slot.id, player);
        used.add(player.id);
      }
    });
    this.show('formation');
  }

  private changeFormation(direction: number): void {
    const current = formations.findIndex((item) => item.id === this.state.selectedFormation.id);
    const next = formations[(current + direction + formations.length) % formations.length];
    this.selectedLineupSlotId = undefined;
    this.selectedBenchIndex = undefined;
    this.state.setFormation(next);
    this.show('formation');
  }

  private selectLineupSlot(slotId: string): void {
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
            revealed.add(player.id);
            this.openPositionBlindBox(target, choices, revealed);
          }
        });
        return;
      }
      const playerCard = this.renderBlindPlayerCard(modal, player, x, 25, allRevealed);
      playerCard.on(Node.EventType.TOUCH_END, () => {
        if (!allRevealed) return;
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
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    void addImage(root, 'ui/football-backgrond', { x: 0, y: -20, width: 690, height: 900 });
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(2, 6, 19, 185);
    shade.rect(-360, -640, 720, 1280);
    shade.fill();
    text(root, '球探盲盒 3选1', 0, 520, 42, colors.white);
    text(root, `球探券 ${this.state.scoutTickets}  ·  先翻开全部卡牌，再选择球员`, 0, 465, 21, colors.muted);
    if (!this.state.pendingScoutChoices.length) {
      text(root, '消耗 1 张球探券，随机发现 3 名球员', 0, 120, 24, colors.muted);
      button(root, this.state.scoutTickets > 0 ? '开启盲盒' : '球探券不足', 0, -20, 360, 88, () => {
        if (this.state.startScoutDraw()) this.show('blindBox');
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
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, { x: -305, y: 570, width: 66, height: 66, onClick: () => this.show('formation') });
    void addFrameImage(root, 'ui/headertitle', { x: 588, y: 54, width: 448, height: 108 }, { x: -120, y: 570, width: 250, height: 60 });
    const spinner = layer('MatchSpinner', root, 330, 330);
    spinner.setPosition(0, 215);
    const rings = spinner.addComponent(Graphics);
    rings.lineWidth = 8;
    rings.strokeColor = new Color(30, 220, 255, 255);
    rings.arc(0, 0, 145, 0.35, 3.8, false);
    rings.stroke();
    rings.lineWidth = 4;
    rings.strokeColor = new Color(90, 190, 255, 210);
    rings.circle(0, 0, 95);
    rings.stroke();
    text(spinner, 'VS', 0, 0, 42, colors.gold, 100);
    text(root, '正在寻找对手', 0, 5, 40, colors.white);
    const status = text(root, '正在为你寻找在线玩家', 0, -50, 23, colors.success);
    const info = panel(root, 0, -195, 630, 155, new Color(8, 25, 55, 240), 18);
    text(info, `阵型   ${this.state.selectedFormation.name}`, -170, 35, 21, colors.gold, 230);
    text(info, `战力   ${this.state.power}`, -170, -25, 31, colors.white, 230);
    text(info, '实时对战准备中', 170, 0, 24, new Color(80, 220, 255, 255), 250);
    button(root, '取消匹配', 0, -405, 300, 78, () => {
      void this.cancelMatch();
      this.show('formation');
    }, new Color(22, 55, 102, 255));
    text(root, '搜索时间过长可尝试更换阵型，可更快匹配', 0, -500, 17, colors.muted);

    let dots = 0;
    this.schedule(() => {
      dots = (dots + 1) % 4;
      status.string = `正在为你寻找在线玩家${'.'.repeat(dots)}`;
    }, 0.45);
    void this.findOpponent();
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
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(2, 8, 24, 90);
    shade.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    shade.fill();
    void addFrameImage(root, 'ui/back', { x: 155, y: 148, width: 713, height: 711 }, { x: -305, y: 570, width: 66, height: 66, onClick: () => this.show('formation') });
    void addFrameImage(root, 'ui/headertitle', { x: 588, y: 54, width: 448, height: 108 }, { x: -125, y: 570, width: 255, height: 61 });

    const left = panel(root, -185, 420, 322, 190, new Color(15, 43, 86, 235), 22);
    const right = panel(root, 185, 420, 322, 190, new Color(15, 43, 86, 235), 22);
    this.renderTeamSummary(left, '我方', '蓝焰俱乐部', this.state.selectedFormation.name, this.state.power, this.state.lineup, colors.success);
    this.renderTeamSummary(right, '对手', this.state.opponent.nickname, this.state.opponentFormation.name, opponentPower, this.state.opponentLineup, colors.danger);
    void addImage(root, 'ui/vs', { x: 0, y: 420, width: 76, height: 71 });
    this.renderPowerComparison(root, this.state.power, opponentPower, 292);

    text(root, '首发阵容预览', 0, 220, 22, colors.gold);
    this.renderMiniLineup(root, this.state.lineup, -180, '我方阵型', this.state.selectedFormation.name, true);
    this.renderMiniLineup(root, this.state.opponentLineup, 180, '对方阵型', this.state.opponentFormation.name, false);
    this.renderCoreDuel(root);
    button(root, '调整阵容', -175, -574, 270, 70, () => this.show('formation'), colors.panelSoft);
    button(root, '进入比赛', 175, -574, 270, 70, () => this.show('battle'), colors.primary);
  }

  private renderTeamSummary(parent: Node, side: string, club: string, formation: string, power: number, lineup: typeof this.state.lineup, accent: Color): void {
    const core = [...lineup].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0))[0]?.player;
    text(parent, side, 0, 67, 16, accent, 260);
    text(parent, club, 0, 36, 21, colors.white, 280);
    if (core) void addImage(parent, this.playerResourcePath(core), { x: -82, y: -31, width: 62, height: 62 });
    text(parent, String(power), 50, -25, 38, colors.gold, 135);
    text(parent, `${formation} · 核心 ${core?.name ?? '待定'} ${core?.rating ?? ''}`, 0, -76, 15, colors.muted, 280);
  }

  private renderPowerComparison(parent: Node, home: number, away: number, y: number): void {
    const box = panel(parent, 0, y, 610, 92, new Color(8, 25, 57, 232), 18);
    text(box, '我方战力', -218, 22, 15, colors.success, 120);
    text(box, String(home), -215, -12, 27, colors.white, 120);
    text(box, '对方战力', 218, 22, 15, colors.danger, 120);
    text(box, String(away), 215, -12, 27, colors.white, 120);
    const total = Math.max(1, home + away);
    const leftWidth = 330 * home / total;
    const bar = box.addComponent(Graphics);
    bar.fillColor = new Color(25, 54, 91, 255);
    bar.roundRect(-165, -25, 330, 15, 7);
    bar.fill();
    bar.fillColor = colors.primary;
    bar.roundRect(-165, -25, leftWidth, 15, 7);
    bar.fill();
    bar.fillColor = colors.danger;
    bar.roundRect(-165 + leftWidth, -25, 330 - leftWidth, 15, 7);
    bar.fill();
  }

  private renderMiniLineup(parent: Node, lineup: typeof this.state.lineup, centerX: number, titleValue: string, formation: string, home: boolean): void {
    const holder = layer(`Lineup:${home ? 'home' : 'away'}`, parent, 344, 690);
    holder.setPosition(centerX, -158);
    void addFrameImage(holder, 'ui/vs-squard', home ? { x: 0, y: 0, width: 520, height: 733 } : { x: 560, y: 0, width: 520, height: 733 }, { x: 0, y: 0, width: 344, height: 486, siblingIndex: 0 });
    text(holder, titleValue, 0, 208, 18, colors.white, 280);
    text(holder, formation, 0, 178, 17, home ? colors.success : colors.gold, 280);
    void addFrameImage(holder, 'ui/squard-qc', { x: 24, y: 24, width: 816, height: 1032 }, { x: 0, y: -38, width: 278, height: 352, siblingIndex: 1 });
    lineup.forEach((slot) => {
      const x = (slot.x - 0.5) * 245;
      const y = 115 - slot.y * 300;
      const chip = panel(holder, x, y, 48, 58, slot.player ? colors.primary : colors.panelSoft, 9);
      if (slot.player) void addImage(chip, this.playerResourcePath(slot.player), { x: 0, y: 7, width: 39, height: 39 });
      text(chip, `${slot.player?.rating ?? '--'}`, 0, -20, 12, colors.white, 44);
    });
  }

  private renderCoreDuel(parent: Node): void {
    const home = [...this.state.lineup].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0))[0]?.player;
    const away = [...this.state.opponentLineup].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0))[0]?.player;
    const duel = layer('CoreDuel', parent, 650, 104);
    duel.setPosition(0, -462);
    void addImage(duel, 'ui/playercore', { x: 0, y: 0, width: 650, height: 104, siblingIndex: 0 });
    text(duel, '核心对位', 0, 31, 16, colors.gold, 140);
    if (home) void addImage(duel, this.playerResourcePath(home), { x: -247, y: -9, width: 54, height: 54, siblingIndex: 1 });
    if (away) void addImage(duel, this.playerResourcePath(away), { x: 247, y: -9, width: 54, height: 54, siblingIndex: 1 });
    text(duel, `${home?.name ?? '待定'}  ${home?.rating ?? '--'}`, -135, -8, 17, colors.white, 180);
    text(duel, 'VS', 0, -12, 23, colors.white, 70);
    text(duel, `${away?.rating ?? '--'}  ${away?.name ?? '待定'}`, 135, -8, 17, colors.white, 180);
  }

  private lineupPower(lineup: typeof this.state.lineup): number {
    return lineup.reduce((sum, slot) => sum + (slot.player?.rating ?? 0), 0);
  }

  private renderBattle(): void {
    const root = this.screen!;
    this.scoreA = 0;
    this.scoreB = 0;
    this.battleIndex = 0;
    this.battleEvents = [];
    const visible = view.getVisibleSize();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    void addFrameImage(root, 'ui/headertitle', { x: 557, y: 226, width: 474, height: 124 }, { x: -115, y: 570, width: 245, height: 64 });
    this.renderBattleTeamMark(root, -245, 450, '蓝', colors.primary, '我方球队', '蓝焰俱乐部');
    this.renderBattleTeamMark(root, 245, 450, 'AI', colors.danger, '对手球队', this.state.opponent.nickname);
    this.battleScore = text(root, '0  :  0', 0, 465, 66, colors.white, 250);
    const clockBox = panel(root, 0, 380, 174, 54, new Color(5, 21, 49, 240), 8);
    this.battleClock = text(clockBox, "00'", 0, 0, 28, colors.gold, 140);
    this.renderPossession(root);
    const feed = panel(root, 0, -190, 666, 670, new Color(6, 20, 47, 224), 16);
    text(feed, '实时战报', 0, 300, 22, colors.white, 560);
    this.battleEventLayer = layer('BattleEvents', feed, 620, 590);
    this.battleEventLayer.setPosition(0, -20);
    this.renderBattleEventCards();
    this.schedule(this.pushBattleMoment, 1.35, LOCAL_MOMENTS.length - 1, 0.7);
  }

  private renderBattleTeamMark(parent: Node, x: number, y: number, mark: string, accent: Color, titleValue: string, club: string): void {
    const badge = panel(parent, x, y + 25, 92, 92, new Color(7, 23, 53, 245), 18);
    const outline = badge.addComponent(Graphics);
    outline.strokeColor = accent;
    outline.lineWidth = 4;
    outline.roundRect(-44, -44, 88, 88, 17);
    outline.stroke();
    text(badge, mark, 0, 0, mark.length > 1 ? 22 : 30, colors.white, 70);
    text(parent, titleValue, x, y - 48, 19, colors.white, 180);
    text(parent, club, x, y - 76, 15, accent, 200);
  }

  private renderPossession(parent: Node): void {
    const box = panel(parent, 0, 278, 650, 142, new Color(6, 20, 47, 224), 14);
    text(box, '比赛势头', 0, 46, 21, colors.white, 220);
    text(box, '我方压制', -225, 5, 17, colors.primary, 130);
    text(box, '对方反击', 225, 5, 17, colors.danger, 130);
    this.battlePossession = box.addComponent(Graphics);
    this.updateBattlePossession();
    text(box, '双方拉锯中，寻找下一次机会', 0, -45, 15, colors.muted, 500);
  }

  private updateBattlePossession(): void {
    if (!this.battlePossession) return;
    const home = Math.max(0.32, Math.min(0.68, 0.5 + (this.state.power - this.lineupPower(this.state.opponentLineup)) / 1800 + (this.scoreA - this.scoreB) * 0.025));
    const width = 330;
    const split = width * home;
    this.battlePossession.clear();
    this.battlePossession.fillColor = colors.primary;
    this.battlePossession.roundRect(-width / 2, -13, split, 25, 12);
    this.battlePossession.fill();
    this.battlePossession.fillColor = colors.danger;
    this.battlePossession.roundRect(-width / 2 + split, -13, width - split, 25, 12);
    this.battlePossession.fill();
  }

  private renderBattleEventCards(): void {
    const layerNode = this.battleEventLayer;
    if (!layerNode) return;
    layerNode.removeAllChildren();
    const entries = this.battleEvents.length ? this.battleEvents.slice(-5) : [{ time: 0, title: '比赛准备', text: '裁判正在确认双方阵容…', mood: 'normal', scoreA: 0, scoreB: 0 } as BattleEvent];
    entries.forEach((event, index) => {
      const card = layer(`Event:${event.time}`, layerNode, 600, 96);
      card.setPosition(0, 230 - index * 112);
      const frame = this.battleEventFrame(event);
      void addFrameImage(card, 'ui/gameevents', frame, { x: 0, y: 0, width: 600, height: 96, siblingIndex: 0 });
      text(card, `${String(event.time).padStart(2, '0')}'`, -220, 0, 20, colors.gold, 76);
      const titleValue = event.title ?? '比赛动态';
      text(card, `${titleValue}${event.actor ? ` · ${event.actor}` : ''}`, 35, 19, 18, colors.white, 400);
      text(card, event.text, 35, -20, 14, colors.muted, 400);
    });
  }

  private battleEventFrame(event: BattleEvent): { x: number; y: number; width: number; height: number } {
    const titleValue = event.title ?? '';
    const key = titleValue.includes('进球') ? 'goal' : titleValue.includes('扑救') || titleValue.includes('门将') ? 'save' : titleValue.includes('角球') ? 'corner' : 'shot';
    const frames = {
      shot: { x: 25, y: 44, width: 675, height: 110 },
      goal: { x: 25, y: 165, width: 675, height: 110 },
      save: { x: 25, y: 286, width: 675, height: 110 },
      corner: { x: 25, y: 407, width: 675, height: 109 }
    };
    return frames[key];
  }

  private readonly pushBattleMoment = (): void => {
    if (this.current !== 'battle') return;
    const moment = LOCAL_MOMENTS[this.battleIndex];
    const minute = this.battleIndex === LOCAL_MOMENTS.length - 1 ? 90 : Math.min(89, 4 + this.battleIndex * 12);
    if (moment.goal) {
      const homeAdvantage = this.state.power >= 850 ? 0.62 : 0.5;
      if (Math.random() < homeAdvantage) this.scoreA += 1;
      else this.scoreB += 1;
    } else if (this.battleIndex === 4 && Math.random() > 0.58) {
      this.scoreB += 1;
    }
    const event: BattleEvent = {
      time: minute,
      title: moment.title,
      text: moment.detail,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      mood: moment.mood,
      team: moment.team,
      actor: this.pickEventPlayer(moment.team)?.name
    };
    this.battleEvents.push(event);
    this.battleClock!.string = `${minute}'`;
    this.battleScore!.string = `${this.scoreA}  :  ${this.scoreB}`;
    this.updateBattlePossession();
    this.renderBattleEventCards();
    this.battleIndex += 1;
    if (this.battleIndex >= LOCAL_MOMENTS.length) this.scheduleOnce(() => this.finishBattle(), 0.9);
  };

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
    const visible = view.getVisibleSize();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    void addFrameImage(root, 'ui/headertitle', { x: 55, y: 408, width: 463, height: 116 }, { x: -115, y: 570, width: 245, height: 61 });
    text(root, won ? '比赛胜利' : draw ? '握手言和' : '比赛结束', 0, 470, 52, won ? colors.gold : colors.white);
    text(root, `${result.scoreA}  :  ${result.scoreB}`, 0, 300, 110, colors.white);
    text(root, `蓝焰俱乐部     ${this.state.opponent.nickname}`, 0, 205, 23, colors.muted);
    const reward = panel(root, 0, -10, 600, 250, colors.panelSoft);
    text(reward, '比赛奖励', 0, 72, 25, colors.gold);
    text(reward, `金币 +${won ? 1200 : 520}`, -140, -20, 28, colors.white, 260);
    text(reward, `体力 -6${won ? '   球探券 +1' : ''}`, 140, -20, 25, colors.white, 280);
    const homePower = this.state.power;
    const awayPower = this.lineupPower(this.state.opponentLineup);
    const possession = Math.round(45 + (homePower - awayPower) / Math.max(20, homePower + awayPower) * 100);
    const stats = panel(root, 0, -245, 600, 185, colors.panelSoft);
    text(stats, '比赛数据', 0, 60, 20, colors.gold);
    text(stats, `${Math.max(35, Math.min(65, possession))}%    控球率    ${100 - Math.max(35, Math.min(65, possession))}%`, 0, 10, 19, colors.white, 530);
    text(stats, `${4 + result.scoreA * 2}       射门       ${4 + result.scoreB * 2}`, 0, -38, 19, colors.white, 530);
    const keyEvent = result.events.filter((event) => event.scoreA || event.scoreB).slice(-2).map((event) => `${event.time}' ${event.actor ?? ''} ${event.title ?? ''}`).join('  ·  ');
    text(root, keyEvent || '双方鏖战至终场', 0, -375, 17, colors.muted, 620);
    button(root, '返回首页', 0, -475, 360, 72, () => this.show('home'), colors.primary);
    text(root, `生涯战绩  ${this.state.matchesPlayed} 场 ${this.state.wins} 胜`, 0, -545, 18, colors.muted);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
