import { _decorator, Color, Component, Graphics, Label, macro, Node, ResolutionPolicy, sys, UITransform, view } from 'cc';
import { GameState } from '../domain/GameState';
import { formations } from '../domain/data';
import type { BattleEvent, PlayerCardData } from '../domain/types';
import { GameServerClient } from '../services/GameServerClient';
import { addCoverImage, addImage } from './ImageUi';
import { button, colors, DESIGN_HEIGHT, DESIGN_WIDTH, divider, formatNumber, layer, panel, text } from './UiFactory';

const { ccclass } = _decorator;
type ScreenName = 'loading' | 'home' | 'formation' | 'blindBox' | 'matchmaking' | 'matchup' | 'battle' | 'result';

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
  private battleFeed?: Label;
  private screenMount?: Node;
  private modal?: Node;
  private followVisitStarted = false;
  private followMessage = '';
  private selectedLineupSlotId?: string;
  private selectedBenchIndex?: number;

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
    const canvas = globalThis.document?.querySelector('canvas');
    if (canvas) canvas.dataset.soccerScreen = name;
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
    void addCoverImage(this.screenHost!, 'home-bg', visible.width, visible.height);
    void addImage(root, 'ui/top-button-v2', { x: 0, y: 550, width: 640, height: 69 });
    text(root, formatNumber(this.state.gems), -160, 550, 20, colors.white, 120);
    text(root, `${this.state.energy}/120`, 160, 550, 20, colors.white, 130);
    void addImage(root, 'ui/hero', { x: 0, y: -55, width: 500, height: 750 });
    void addImage(root, 'ui/start-v2', {
      x: 0,
      y: -520,
      width: 520,
      height: 117,
      onClick: () => this.show('formation')
    });
    text(root, this.state.nickname, -250, 470, 20, colors.white, 180);
    this.homeShortcut(root, '七日签到', -265, 350, colors.gold, () => this.openSignModal());
    this.homeShortcut(root, '商城', -265, 255, colors.primary, () => this.openShopModal());
    this.homeShortcut(root, '关注领奖', 265, 350, colors.danger, () => this.openFollowModal());
    this.homeShortcut(root, '每日任务', 265, 255, colors.success, () => this.openTasksModal());
  }

  private homeShortcut(parent: Node, title: string, x: number, y: number, color: typeof colors.gold, onClick: () => void): void {
    button(parent, title, x, y, 150, 66, onClick, color);
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
    const card = this.createModal('七日签到', '每日登录领取球队成长资源');
    const rewards = [
      { label: '体力 +30', reward: { energy: 30 } },
      { label: '钻石 +20', reward: { gems: 20 } },
      { label: '球探券 +1', reward: { scoutTickets: 1 } },
      { label: '体力 +30', reward: { energy: 30 } },
      { label: '钻石 +20', reward: { gems: 20 } },
      { label: '球探券 +1', reward: { scoutTickets: 1 } },
      { label: '体力 +50', reward: { energy: 50 } }
    ];
    const day = ((new Date().getDate() - 1) % 7) + 1;
    const claimId = `signin-${this.state.dailyTaskDate}`;
    const claimed = this.state.claimedTasks.has(claimId);
    rewards.forEach((item, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const rewardCard = panel(card, -225 + column * 150, 235 - row * 190, 132, 155, index + 1 === day ? colors.primary : colors.panelSoft, 18);
      text(rewardCard, `第 ${index + 1} 天`, 0, 42, 18, colors.white, 110);
      text(rewardCard, item.label, 0, -25, 17, colors.gold, 112);
    });
    text(card, claimed ? '今日奖励已领取' : `今日是第 ${day} 天`, 0, -175, 23, claimed ? colors.muted : colors.white);
    button(card, claimed ? '已领取' : '领取奖励', 0, -275, 320, 76, () => {
      if (!claimed && this.state.claimReward(claimId, rewards[day - 1].reward)) this.openSignModal();
    }, claimed ? colors.panelSoft : colors.primary);
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

  private openShopModal(message = ''): void {
    const card = this.createModal('球队商城', `当前钻石 ${this.state.gems}${message ? `  ·  ${message}` : ''}`);
    const goods = [
      { title: '体力补给', detail: '体力 +30', cost: 20, reward: { energy: 30 } },
      { title: '球探券', detail: '球探券 +1', cost: 30, reward: { scoutTickets: 1 } },
      { title: '金币箱', detail: '金币 +5000', cost: 50, reward: { coins: 5000 } }
    ];
    goods.forEach((item, index) => {
      const y = 245 - index * 190;
      const row = panel(card, 0, y, 560, 150, colors.panelSoft, 20);
      text(row, item.title, -145, 28, 25, colors.white, 220);
      text(row, item.detail, -145, -30, 19, colors.muted, 220);
      button(row, `${item.cost} 钻石`, 155, 0, 190, 64, () => {
        const ok = this.state.spendGems(item.cost, item.reward);
        this.openShopModal(ok ? '兑换成功' : '钻石不足');
      }, colors.primary);
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
    void addImage(root, 'ui/football-backgrond', { x: 0, y: 40, width: 650, height: 720 });
    text(root, '阵容调整', 0, 580, 34, colors.gold);
    text(root, `战力 ${this.state.power}  ·  点击两张卡可互换`, 0, 535, 18, colors.white);
    const formationIndex = formations.findIndex((item) => item.id === this.state.selectedFormation.id);
    button(root, '‹', -255, 475, 70, 58, () => this.changeFormation(-1), colors.panelSoft);
    text(root, `${this.state.selectedFormation.name}  ${this.state.selectedFormation.style}`, 0, 475, 25, colors.gold, 340);
    button(root, '›', 255, 475, 70, 58, () => this.changeFormation(1), colors.panelSoft);

    this.state.lineup.forEach((slot) => {
      const x = (slot.x - 0.5) * 570;
      const y = (0.52 - slot.y) * 570 + 65;
      const selected = this.selectedLineupSlotId === slot.id;
      const card = panel(root, x, y, 96, 66, selected ? colors.gold : colors.panelSoft, 12);
      text(card, `${slot.position} ${slot.player?.rating ?? '--'}\n${slot.player?.name ?? '待选择'}`, 0, 0, 15, selected ? colors.background : colors.white, 88);
      card.on(Node.EventType.TOUCH_END, () => this.selectLineupSlot(slot.id));
    });

    text(root, '替补席', -275, -365, 18, colors.gold, 100);
    this.state.substitutes.forEach((player, index) => {
      const x = -200 + index * 105;
      const selected = this.selectedBenchIndex === index;
      const card = panel(root, x, -415, 94, 72, selected ? colors.gold : colors.panelSoft, 12);
      text(card, `${player?.position ?? '空'} ${player?.rating ?? ''}\n${player?.name ?? '待选择'}`, 0, 0, 14, selected ? colors.background : colors.white, 86);
      card.on(Node.EventType.TOUCH_END, () => this.selectBench(index));
    });
    text(root, formationIndex >= 0 ? `阵型 ${formationIndex + 1}/${formations.length}` : '', 265, -365, 16, colors.muted, 120);
    button(root, '球员仓库', -235, -500, 180, 62, () => this.openPlayerWarehouse(), colors.panelSoft);
    button(root, `球探盲盒 ×${this.state.scoutTickets}`, -25, -500, 210, 62, () => this.show('blindBox'), colors.gold);
    button(root, '返回', 185, -500, 150, 62, () => this.show('home'), colors.panelSoft);
    void addImage(root, 'ui/button-ready', {
      x: 0,
      y: -580,
      width: 330,
      height: 91,
      onClick: () => this.show('matchmaking')
    });
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
    if (this.selectedLineupSlotId) {
      this.state.swapLineupWithSubstitute(this.selectedLineupSlotId, index);
      this.selectedLineupSlotId = undefined;
      this.selectedBenchIndex = undefined;
    } else {
      this.selectedBenchIndex = this.selectedBenchIndex === index ? undefined : index;
    }
    this.show('formation');
  }

  private openPlayerWarehouse(): void {
    const card = this.createModal('球员仓库', this.selectedLineupSlotId ? '选择球员替换当前首发' : this.selectedBenchIndex != null ? '选择球员加入替补席' : '请先选择一个首发或替补位置');
    if (!this.selectedLineupSlotId && this.selectedBenchIndex == null) return;
    const target = this.state.lineup.find((slot) => slot.id === this.selectedLineupSlotId);
    const pool = this.state.ownedPlayers(target?.position).slice(0, 12);
    pool.forEach((player, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const playerCard = panel(card, -190 + column * 190, 275 - row * 150, 170, 125, colors.panelSoft, 16);
      text(playerCard, `${player.position}  ${player.rating}\n${player.name}\n${player.skill}`, 0, 0, 17, colors.white, 155);
      playerCard.on(Node.EventType.TOUCH_END, () => {
        if (this.selectedLineupSlotId) this.state.fillSlot(this.selectedLineupSlotId, player);
        else if (this.selectedBenchIndex != null) this.state.fillSubstitute(this.selectedBenchIndex, player);
        this.closeModal();
        this.selectedLineupSlotId = undefined;
        this.selectedBenchIndex = undefined;
        this.show('formation');
      });
    });
  }

  private renderBlindBox(): void {
    const root = this.screen!;
    const visible = view.getVisibleSize();
    void addCoverImage(this.screenHost!, 'page-bg', visible.width, visible.height);
    text(root, '球探盲盒', 0, 535, 42, colors.gold);
    text(root, `球探券 ${this.state.scoutTickets}  ·  三选一签下球员`, 0, 475, 22, colors.white);
    if (!this.state.pendingScoutChoices.length) {
      text(root, '消耗 1 张球探券，随机发现 3 名球员', 0, 120, 24, colors.muted);
      button(root, this.state.scoutTickets > 0 ? '开启盲盒' : '球探券不足', 0, -20, 360, 88, () => {
        if (this.state.startScoutDraw()) this.show('blindBox');
      }, this.state.scoutTickets > 0 ? colors.gold : colors.panelSoft);
    } else {
      this.state.pendingScoutChoices.forEach((player, index) => {
        const x = -220 + index * 220;
        const playerCard = panel(root, x, 80, 195, 360, colors.panelSoft, 22);
        text(playerCard, player.position, 0, 145, 20, colors.gold, 160);
        text(playerCard, player.name, 0, 105, 23, colors.white, 170);
        void addImage(playerCard, this.playerResourcePath(player), { x: 0, y: 28, width: 110, height: 110 });
        text(playerCard, String(player.rating), 0, -55, 40, colors.gold, 150);
        text(playerCard, `${player.skill}\n攻 ${player.attack}  防 ${player.defense}  速 ${player.speed}`, 0, -120, 15, colors.muted, 165);
        button(playerCard, '签下', 0, -220, 150, 60, () => {
          this.state.claimScoutPlayer(player);
          this.show('formation');
        }, colors.primary);
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
    text(root, '正在匹配对手', 0, 400, 42);
    text(root, String(this.state.power), 0, 180, 86, colors.gold);
    text(root, '当前球队战力', 0, 105, 22, colors.muted);
    text(root, `${this.state.selectedFormation.name}  ·  首发 ${this.state.lineup.filter((slot) => !!slot.player).length}/11  ·  替补 ${this.state.substitutes.filter(Boolean).length}/5`, 0, 55, 18, colors.muted);
    const status = text(root, '搜索实力相近的球队…', 0, -40, 25, colors.white);
    button(root, '取消匹配', 0, -390, 360, 82, () => {
      void this.cancelMatch();
      this.show('home');
    }, colors.panelSoft);

    let dots = 0;
    this.schedule(() => {
      dots = (dots + 1) % 4;
      status.string = `搜索实力相近的球队${'.'.repeat(dots)}`;
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
    text(root, '比赛对阵', 0, 560, 36, colors.gold);
    const left = panel(root, -180, 285, 320, 360, colors.panelSoft);
    const right = panel(root, 180, 285, 320, 360, colors.panelSoft);
    this.renderTeamSummary(left, '我方', '蓝焰俱乐部', this.state.selectedFormation.name, this.state.power, this.state.lineup, colors.success);
    this.renderTeamSummary(right, '对手', this.state.opponent.nickname, this.state.opponentFormation.name, opponentPower, this.state.opponentLineup, colors.danger);
    text(root, 'VS', 0, 290, 42, colors.gold, 90);
    text(root, '首发阵容预览', 0, 55, 22, colors.gold);
    this.renderMiniLineup(root, this.state.lineup, -180);
    this.renderMiniLineup(root, this.state.opponentLineup, 180);
    button(root, '调整阵容', -175, -500, 260, 72, () => this.show('formation'), colors.panelSoft);
    button(root, '进入比赛', 175, -500, 260, 72, () => this.show('battle'), colors.primary);
  }

  private renderTeamSummary(parent: Node, side: string, club: string, formation: string, power: number, lineup: typeof this.state.lineup, accent: Color): void {
    const core = [...lineup].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0))[0]?.player;
    text(parent, side, 0, 135, 18, accent, 260);
    text(parent, club, 0, 90, 24, colors.white, 280);
    text(parent, String(power), 0, 20, 48, colors.gold, 240);
    text(parent, `${formation}  ·  核心 ${core?.name ?? '待定'} ${core?.rating ?? ''}`, 0, -55, 17, colors.muted, 280);
  }

  private renderMiniLineup(parent: Node, lineup: typeof this.state.lineup, centerX: number): void {
    const pitch = panel(parent, centerX, -205, 310, 430, new Color(15, 92, 70, 235), 18);
    lineup.forEach((slot) => {
      const x = (slot.x - 0.5) * 270;
      const y = (0.5 - slot.y) * 350;
      const chip = panel(pitch, x, y, 48, 36, slot.player ? colors.primary : colors.panelSoft, 8);
      text(chip, `${slot.player?.rating ?? '--'}`, 0, 0, 13, colors.white, 44);
    });
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
    text(root, '实时战报', 0, 550, 34, colors.gold);
    text(root, `蓝焰俱乐部     ${this.state.opponent.nickname}`, 0, 470, 22, colors.muted);
    text(root, `${this.state.selectedFormation.name}                         ${this.state.opponentFormation.name}`, 0, 430, 17, colors.muted);
    this.battleScore = text(root, '0  :  0', 0, 370, 72);
    this.battleClock = text(root, "00'", 0, 300, 22, colors.gold);
    const feed = panel(root, 0, -80, 650, 650, colors.panelSoft);
    this.battleFeed = text(feed, '裁判正在确认双方阵容…', 0, 0, 25, colors.white, 570);
    this.battleFeed.horizontalAlign = Label.HorizontalAlign.LEFT;
    this.battleFeed.verticalAlign = Label.VerticalAlign.TOP;
    this.battleFeed.node.getComponent(UITransform)?.setContentSize(570, 570);
    this.schedule(this.pushBattleMoment, 1.35, LOCAL_MOMENTS.length - 1, 0.7);
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
    this.battleFeed!.string = this.battleEvents.slice(-7).map((item) => `${String(item.time).padStart(2, '0')}'  ${item.title}${item.actor ? ` · ${item.actor}` : ''}\n      ${item.text}`).join('\n\n');
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
