import { Application, Assets, Container } from 'pixi.js';
import { BattleScene } from './scenes/BattleScene';
import { BlindBoxScene } from './scenes/BlindBoxScene';
import { FormationScene } from './scenes/FormationScene';
import { HomeScene } from './scenes/HomeScene';
import { LoadingScene } from './scenes/LoadingScene';
import { MatchupScene } from './scenes/MatchupScene';
import { ResultScene } from './scenes/ResultScene';
import { WebPlatform, DouyinPlatform, type PlatformApi } from './platform/Platform';
import { defaultCollectionIds, drawScoutCandidates, formations, players } from './data';
import { defaultBattleSource } from './battle/BattleMode';
import { SoundFx } from './audio/SoundFx';
import type { BattleEvent, FormationData, LineupSlot, PlayerCardData, Scene } from './types';
import { PlayerStorage } from './storage/PlayerStorage';

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

interface GameMount {
  clientWidth: number;
  clientHeight: number;
  appendChild?: (child: any) => unknown;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

interface GameRuntime {
  canvas?: any;
  width?: number;
  height?: number;
  pixelRatio?: number;
  miniGame?: boolean;
  safeAreaTop?: number;
  safeContentRight?: number;
}

export class GameApp {
  readonly app = new Application();
  readonly root = new Container();
  readonly platform: PlatformApi;
  readonly sound = new SoundFx();
  readonly storage = new PlayerStorage();
  scene?: Scene;
  user = { userId: 'local-user', nickname: '本地经理', avatarUrl: undefined as string | undefined };
  selectedFormation: FormationData = formations[1];
  lineup: LineupSlot[] = formations[1].slots.map((slot) => ({ ...slot }));
  coins = 1286000;
  gems = 5688;
  energy = 120;
  scoutTickets = 2;
  matchesPlayed = 0;
  wins = 0;
  collectionIds = new Set<string>(defaultCollectionIds);
  claimedTasks = new Set<string>();
  dailyTaskDate = new Date().toISOString().slice(0, 10);
  pendingSlotId?: string;
  pendingScoutChoices: PlayerCardData[] = [];
  battleResult: { scoreA: number; scoreB: number; events: BattleEvent[] } = { scoreA: 0, scoreB: 0, events: [] };
  battleSource = defaultBattleSource;
  private viewportWidth = DESIGN_WIDTH;
  private viewportHeight = DESIGN_HEIGHT;
  private safeAreaInsetTopPx = 0;
  private safeContentRightPx = 0;

  constructor(private readonly mount: GameMount, private readonly runtime: GameRuntime = {}) {
    this.platform = runtime.miniGame ? new DouyinPlatform() : new WebPlatform();
    this.safeAreaInsetTopPx = runtime.safeAreaTop ?? 0;
    this.safeContentRightPx = runtime.safeContentRight ?? 0;
  }

  async start() {
    if (this.runtime.miniGame) {
      Assets.setPreferences({
        preferWorkers: false,
        preferCreateImageBitmap: false,
        crossOrigin: ''
      });
    }

    const initOptions = this.runtime.canvas
      ? {
          canvas: this.runtime.canvas,
          width: this.runtime.width ?? this.mount.clientWidth,
          height: this.runtime.height ?? this.mount.clientHeight
        }
      : {
          resizeTo: this.mount
        };

    await this.app.init({
      ...initOptions,
      background: '#070b1f',
      antialias: true,
      resolution: Math.min(this.runtime.pixelRatio ?? (window.devicePixelRatio || 1), 2),
      autoDensity: !this.runtime.canvas
    } as any);
    if (!this.runtime.canvas) this.mount.appendChild?.(this.app.canvas);
    if (!this.runtime.miniGame) this.sound.installUnlock(this.mount as HTMLElement);
    this.app.stage.addChild(this.root);
    const save = await this.storage.load();
    this.user = { userId: save.userId, nickname: save.nickname, avatarUrl: undefined };
    this.coins = save.coins;
    this.gems = save.gems;
    this.energy = save.energy;
    this.scoutTickets = save.scoutTickets;
    this.matchesPlayed = save.matchesPlayed;
    this.wins = save.wins;
    this.collectionIds = new Set(save.collection);
    this.claimedTasks = new Set(save.claimedTasks);
    this.dailyTaskDate = save.dailyTaskDate;
    const savedLineup = this.storage.applyLineup(save);
    this.selectedFormation = savedLineup.formation;
    this.lineup = savedLineup.lineup;
    const auth = await this.platform.login();
    this.user = {
      userId: auth.userId || this.user.userId,
      nickname: auth.nickname || this.user.nickname,
      avatarUrl: auth.avatarUrl
    };
    await Assets.load([
      '/assets/page-bg.jpg',
      '/assets/home-bg.jpg',
      '/assets/ui/top-button.png',
      '/assets/ui/avatar-bg.png',
      '/assets/ui/buttons.png',
      '/assets/ui/hero.png',
      '/assets/ui/start.png',
      '/assets/ui/bottom-menu.png',
      '/assets/ui/football-backgrond.png',
      '/assets/ui/replace_player.png',
      '/assets/ui/cardbg.png',
      '/assets/ui/players-bg.png',
      '/assets/ui/draft-button.png',
      '/assets/ui/play.png',
      '/assets/ui/squard-qc.png',
      '/assets/ui/vs-squard.png',
      ...new Set(players.map((player) => player.portrait))
    ]);
    this.app.ticker.add((ticker) => this.scene?.update(ticker.deltaMS));
    window.addEventListener?.('resize', () => this.resize());
    this.changeScene('loading');
  }

  changeScene(name: 'loading' | 'home' | 'formation' | 'blindBox' | 'matchup' | 'battle' | 'result') {
    this.scene?.exit();
    this.root.removeChildren();

    if (name === 'loading') this.scene = new LoadingScene(this);
    if (name === 'home') this.scene = new HomeScene(this);
    if (name === 'formation') this.scene = new FormationScene(this);
    if (name === 'blindBox') this.scene = new BlindBoxScene(this);
    if (name === 'matchup') this.scene = new MatchupScene(this);
    if (name === 'battle') this.scene = new BattleScene(this);
    if (name === 'result') this.scene = new ResultScene(this);

    this.updateViewport();
    this.scene?.enter();
    this.resize();
  }

  setFormation(formation: FormationData) {
    this.selectedFormation = formation;
    this.lineup = formation.slots.map((slot) => ({ ...slot, player: undefined }));
    void this.persist();
  }

  clearLineup() {
    this.lineup = this.selectedFormation.slots.map((slot) => ({ ...slot, player: undefined }));
    void this.persist();
  }

  fillSlot(slotId: string, player: PlayerCardData) {
    if (!this.collectionIds.has(player.id)) return;
    this.lineup = this.lineup.map((slot) => {
      if (slot.player?.id === player.id) return { ...slot, player: undefined };
      if (slot.id === slotId) return { ...slot, player };
      return slot;
    });
    void this.persist();
  }

  addPlayerToCollection(player: PlayerCardData) {
    this.collectionIds.add(player.id);
    void this.persist();
  }

  startScoutDraw() {
    if (this.scoutTickets <= 0) return false;
    this.scoutTickets -= 1;
    this.pendingScoutChoices = drawScoutCandidates([...this.collectionIds], 3);
    void this.persist();
    return true;
  }

  awardMatchRewards(win: boolean) {
    this.matchesPlayed += 1;
    if (win) this.wins += 1;
    this.coins += win ? 1200 : 520;
    this.scoutTickets += win ? 1 : 0;
    this.energy = Math.max(0, this.energy - 6);
    void this.persist();
  }

  claimTask(taskId: string, reward: { coins?: number; scoutTickets?: number; gems?: number }) {
    if (this.claimedTasks.has(taskId)) return false;
    this.claimedTasks.add(taskId);
    this.coins += reward.coins ?? 0;
    this.scoutTickets += reward.scoutTickets ?? 0;
    this.gems += reward.gems ?? 0;
    void this.persist();
    return true;
  }

  ownedPlayers(position?: PlayerCardData['position']) {
    return players
      .filter((player) => this.collectionIds.has(player.id) && (!position || player.position === position))
      .sort((a, b) => b.rating - a.rating);
  }

  lineupPower() {
    return this.lineup.reduce((sum, slot) => sum + (slot.player?.rating ?? 0), 0);
  }

  prepareOpponent() {
    const names = ['AI 联队', '星火十一人', '蓝焰俱乐部', '风暴经理人'];
    const formation = formations[Math.floor(Math.random() * formations.length)];
    const usedIds = new Set(this.lineup.flatMap((slot) => (slot.player ? [slot.player.id] : [])));
    const targetAverage = Math.max(66, Math.min(94, this.lineupPower() / this.lineup.length + (Math.random() * 8 - 3)));
    const opponentLineup = formation.slots.map((slot) => {
      const pool = players
        .filter((player) => player.position === slot.position && !usedIds.has(player.id))
        .sort((a, b) => Math.abs(a.rating - targetAverage) - Math.abs(b.rating - targetAverage));
      const topWindow = pool.slice(0, Math.min(10, pool.length));
      const player = topWindow[Math.floor(Math.random() * topWindow.length)] ?? pool[0];
      if (player) usedIds.add(player.id);
      return { ...slot, player };
    });
    this.battleSource = {
      mode: 'ai',
      opponentName: names[Math.floor(Math.random() * names.length)],
      opponentFormation: formation,
      opponentLineup
    };
  }

  private async persist() {
    await this.storage.save({
      userId: this.user.userId,
      nickname: this.user.nickname,
      coins: this.coins,
      gems: this.gems,
      energy: this.energy,
      scoutTickets: this.scoutTickets,
      matchesPlayed: this.matchesPlayed,
      wins: this.wins,
      collection: [...this.collectionIds],
      claimedTasks: [...this.claimedTasks],
      dailyTaskDate: this.dailyTaskDate,
      selectedFormationId: this.selectedFormation.id,
      lineup: this.lineup.map((slot) => ({ slotId: slot.id, playerId: slot.player?.id })),
      updatedAt: new Date().toISOString()
    });
  }

  private bestOwnedForPosition(position: PlayerCardData['position'], usedIds: Set<string>) {
    return this.ownedPlayers(position).find((player) => !usedIds.has(player.id));
  }

  get width() {
    return this.viewportWidth;
  }

  get height() {
    return this.viewportHeight;
  }

  get isMiniGame() {
    return !!this.runtime.miniGame;
  }

  get safeAreaTop() {
    return this.screenPxToDesignY(this.safeAreaInsetTopPx);
  }

  get safeContentRight() {
    if (!this.isMiniGame || this.safeContentRightPx <= 0) return this.viewportWidth;
    return Math.max(this.viewportWidth * 0.52, this.screenPxToDesignX(this.safeContentRightPx) - 14);
  }

  get contentTopOffset() {
    const tallBonus = Math.max(0, this.viewportHeight - DESIGN_HEIGHT) * 0.42;
    const miniPad = this.isMiniGame ? 12 : 0;
    return this.safeAreaTop + miniPad + tallBonus;
  }

  setSafeAreaInsets(insets: { top?: number; contentRight?: number }) {
    if (insets.top != null) this.safeAreaInsetTopPx = Math.max(0, insets.top);
    if (insets.contentRight != null) this.safeContentRightPx = Math.max(0, insets.contentRight);
  }

  setSafeAreaInsetTop(topPx: number) {
    this.setSafeAreaInsets({ top: topPx });
  }

  onViewportResize() {
    this.resize();
  }

  private screenPxToDesignX(screenX: number) {
    if (screenX <= 0) return 0;
    const scale = this.getLayoutScale();
    if (scale <= 0) return screenX;
    const rootX = (this.app.renderer.width - this.viewportWidth * scale) / 2;
    return (screenX - rootX) / scale;
  }

  private screenPxToDesignY(screenY: number) {
    if (screenY <= 0) return 0;
    const scale = this.getLayoutScale();
    if (scale <= 0) return screenY;
    const rootY = (this.app.renderer.height - this.viewportHeight * scale) / 2;
    return Math.max(0, (screenY - rootY) / scale);
  }

  private getLayoutScale() {
    return Math.min(
      this.app.renderer.width / this.viewportWidth,
      this.app.renderer.height / this.viewportHeight
    );
  }

  private resize() {
    this.updateViewport();
    const scale = this.getLayoutScale();
    this.root.scale.set(scale);
    this.root.x = (this.app.renderer.width - this.viewportWidth * scale) / 2;
    this.root.y = (this.app.renderer.height - this.viewportHeight * scale) / 2;
    this.scene?.resize(this.width, this.height);
  }

  private updateViewport() {
    const rendererWidth = this.app.renderer.width || DESIGN_WIDTH;
    const rendererHeight = this.app.renderer.height || DESIGN_HEIGHT;
    const rendererAspect = rendererWidth / rendererHeight;
    const designAspect = DESIGN_WIDTH / DESIGN_HEIGHT;

    if (rendererAspect < designAspect) {
      this.viewportWidth = DESIGN_WIDTH;
      this.viewportHeight = DESIGN_WIDTH / rendererAspect;
      return;
    }

    this.viewportWidth = DESIGN_HEIGHT * rendererAspect;
    this.viewportHeight = DESIGN_HEIGHT;
  }
}
