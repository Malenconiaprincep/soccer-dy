import { Application, Assets, Container } from 'pixi.js';
import { BattleScene } from './scenes/BattleScene';
import { BlindBoxScene } from './scenes/BlindBoxScene';
import { FormationScene } from './scenes/FormationScene';
import { HomeScene } from './scenes/HomeScene';
import { LoadingScene } from './scenes/LoadingScene';
import { MatchmakingScene } from './scenes/MatchmakingScene';
import { MatchupScene } from './scenes/MatchupScene';
import { ResultScene } from './scenes/ResultScene';
import { WebPlatform, DouyinPlatform, type PlatformApi } from './platform/Platform';
import { defaultCollectionIds, drawScoutCandidates, formations, players } from './data';
import { defaultBattleSource } from './battle/BattleMode';
import { SoundFx } from './audio/SoundFx';
import type { BattleEvent, FormationData, LineupSlot, PlayerCardData, Position, Scene, SceneName } from './types';
import { PlayerStorage } from './storage/PlayerStorage';
import { GameServerClient, type MatchOpponent } from './services/GameServerClient';
import { defaultShopConfig, type ShopConfig } from '../shopConfig';
import { DEV_MATCH_DURATION_KEY, resolveMatchDurationMs } from './matchmakingConfig';

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const runtimeEnv = (import.meta as unknown as { env?: { DEV?: boolean; VITE_WEB_TEST_AS_DOUYIN?: string; VITE_MATCH_DURATION_MS?: string } }).env ?? {};
const SCENES: SceneName[] = ['loading', 'home', 'formation', 'blindBox', 'matchmaking', 'matchup', 'battle', 'result'];
const DEV_SCENE_KEY = 'soccer.dev.defaultScene';
const DEV_HOLD_LOADING_KEY = 'soccer.dev.holdLoading';
const DEV_SIGN_DAY_KEY = 'soccer.dev.signDay';
const DEV_BATTLE_EVENTS_KEY = 'soccer.dev.battleEventsAll';
const DEV_BATTLE_STAY_KEY = 'soccer.dev.battleStay';
const DEV_BATTLE_AI_KEY = 'soccer.dev.battleAi';
const DEV_PANEL_COLLAPSED_KEY = 'soccer.dev.panelCollapsed';
const DEV_PANEL_POSITION_KEY = 'soccer.dev.panelPosition';

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
  safeAreaBottom?: number;
  safeContentRight?: number;
}

export class GameApp {
  readonly app = new Application();
  readonly root = new Container();
  readonly platform: PlatformApi;
  readonly sound = new SoundFx();
  readonly storage = new PlayerStorage();
  readonly server = new GameServerClient();
  scene?: Scene;
  user = {
    userId: 'local-user',
    nickname: '本地经理',
    avatarUrl: undefined as string | undefined,
    loginCode: undefined as string | undefined
  };
  selectedFormation: FormationData = formations[1];
  lineup: LineupSlot[] = formations[1].slots.map((slot) => ({ ...slot }));
  substitutes: Array<PlayerCardData | undefined> = Array.from({ length: 5 }, () => undefined);
  coins = 1286000;
  gems = 0;
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
  shopConfig: ShopConfig = defaultShopConfig;
  private viewportWidth = DESIGN_WIDTH;
  private viewportHeight = DESIGN_HEIGHT;
  private safeAreaInsetTopPx = 0;
  private safeAreaInsetBottomPx = 0;
  private safeContentRightPx = 0;
  private devPanel?: HTMLDivElement;

  constructor(private readonly mount: GameMount, private readonly runtime: GameRuntime = {}) {
    this.platform = runtime.miniGame ? new DouyinPlatform() : new WebPlatform();
    this.safeAreaInsetTopPx = runtime.safeAreaTop ?? 0;
    this.safeAreaInsetBottomPx = runtime.safeAreaBottom ?? 0;
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
    this.user = { userId: save.userId, nickname: save.nickname, avatarUrl: undefined, loginCode: undefined };
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
    this.substitutes = Array.from({ length: 5 }, () => undefined);
    this.ensureHomeSubstitutes();
    const auth = await this.platform.login();
    this.user = {
      userId: auth.userId || this.user.userId,
      nickname: auth.nickname || this.user.nickname,
      avatarUrl: auth.avatarUrl,
      loginCode: auth.loginCode
    };
    await this.syncServerSession();
    await this.loadShopConfig();
    await Assets.load([
      '/assets/loading-bg.png',
      '/assets/page-bg.jpg',
      '/assets/home-bg.jpg',
      '/assets/ui/top-button.png',
      '/assets/ui/avatar-bg.png',
      '/assets/ui/buttons.png',
      '/assets/ui/back.png',
      '/assets/ui/headertitle.png',
      '/assets/ui/gameevents.png',
      '/assets/ui/shoptitle.png',
      '/assets/ui/toolstitle.png',
      '/assets/ui/everyday-active.png',
      '/assets/ui/gift.png',
      '/assets/ui/qiandao.png',
      '/assets/ui/sevenday/giftbg.png',
      '/assets/ui/sevenday/flash.png',
      '/assets/ui/sevenday/diamond.png',
      '/assets/ui/sevenday/ticket.png',
      '/assets/ui/sevenday/accpet.png',
      '/assets/ui/sevenday/accpet-end.png',
      '/assets/ui/hero.png',
      '/assets/ui/start.png',
      '/assets/ui/bottom-menu.png',
      '/assets/ui/football-backgrond.png',
      '/assets/ui/replace_player.png',
      '/assets/ui/cardbg.png',
      '/assets/ui/card-guess1.png',
      '/assets/ui/players-bg.png',
      '/assets/ui/button-ready.png',
      '/assets/ui/gamereadybg.png',
      '/assets/ui/readybutton.png',
      '/assets/ui/playerscore.png',
      '/assets/ui/matchtitle.png',
      '/assets/ui/draft-button.png',
      '/assets/ui/play.png',
      '/assets/ui/playbutton.png',
      '/assets/ui/squard-qc.png',
      '/assets/ui/vs-squard.png',
      ...new Set(players.map((player) => player.portrait))
    ]);
    this.app.ticker.add((ticker) => this.scene?.update(ticker.deltaMS));
    window.addEventListener?.('resize', () => this.resize());
    if (runtimeEnv.DEV && !this.runtime.miniGame) this.installDevPanel();
    const initialScene = this.devInitialScene();
    this.prepareDevScene(initialScene);
    this.changeScene(initialScene);
  }

  changeScene(name: SceneName) {
    if (runtimeEnv.DEV) this.prepareDevScene(name);
    this.scene?.exit();
    this.root.removeChildren();

    if (name === 'loading') this.scene = new LoadingScene(this);
    if (name === 'home') this.scene = new HomeScene(this);
    if (name === 'formation') this.scene = new FormationScene(this);
    if (name === 'blindBox') this.scene = new BlindBoxScene(this);
    if (name === 'matchmaking') this.scene = new MatchmakingScene(this);
    if (name === 'matchup') this.scene = new MatchupScene(this);
    if (name === 'battle') this.scene = new BattleScene(this);
    if (name === 'result') this.scene = new ResultScene(this);

    this.updateViewport();
    this.scene?.enter();
    this.resize();
  }

  isLoadingHeldForDebug() {
    if (!runtimeEnv.DEV || this.runtime.miniGame) return false;
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const queryValue = params.get('holdLoading');
    if (queryValue !== null) return queryValue !== '0' && queryValue !== 'false';
    return globalThis.localStorage?.getItem(DEV_HOLD_LOADING_KEY) === '1';
  }

  signInDayForDebug() {
    if (!runtimeEnv.DEV || this.runtime.miniGame) return 1;
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const raw = params.get('signDay') ?? globalThis.localStorage?.getItem(DEV_SIGN_DAY_KEY);
    const day = Number(raw);
    return Number.isInteger(day) ? Math.min(7, Math.max(1, day)) : 1;
  }

  private devInitialScene(): SceneName {
    if (!runtimeEnv.DEV || this.runtime.miniGame) return 'loading';
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const queryScene = params.get('scene') as SceneName | null;
    if (queryScene && SCENES.includes(queryScene)) return queryScene;
    const savedScene = globalThis.localStorage?.getItem(DEV_SCENE_KEY) as SceneName | null;
    if (savedScene && SCENES.includes(savedScene)) return savedScene;
    return 'loading';
  }

  private prepareDevScene(sceneName: SceneName) {
    if (!runtimeEnv.DEV || this.runtime.miniGame) return;
    if (sceneName === 'matchmaking' || sceneName === 'matchup' || sceneName === 'battle' || sceneName === 'result') {
      this.fillDebugLineup();
    }
    if (sceneName === 'matchup' || sceneName === 'battle' || sceneName === 'result') {
      this.prepareOpponent();
    }
    if (sceneName === 'result') {
      this.battleResult = {
        scoreA: 2,
        scoreB: 1,
        events: [
          { time: 12, text: '开场后快速压迫，边路制造威胁。', scoreA: 0, scoreB: 0, mood: 'normal' },
          { time: 34, text: '核心前锋禁区内抢点破门。', scoreA: 1, scoreB: 0, mood: 'good' },
          { time: 57, text: '对手通过反击扳回一球。', scoreA: 1, scoreB: 1, mood: 'bad' },
          { time: 82, text: '中场送出直塞，完成绝杀。', scoreA: 2, scoreB: 1, mood: 'good' }
        ]
      };
    }
  }

  private fillDebugLineup() {
    const usedIds = new Set<string>();
    this.lineup.forEach((slot) => {
      if (slot.player) usedIds.add(slot.player.id);
    });
    this.lineup = this.lineup.map((slot) => {
      if (slot.player) return slot;
      const pool = players
        .filter((player) => player.position === slot.position && !usedIds.has(player.id))
        .sort((a, b) => b.rating - a.rating);
      const fallback = players
        .filter((player) => !usedIds.has(player.id))
        .sort((a, b) => b.rating - a.rating);
      const player = pool[0] ?? fallback[0];
      if (player) usedIds.add(player.id);
      return { ...slot, player };
    });
  }

  private installDevPanel() {
    if (this.devPanel || !globalThis.document) return;
    const panel = document.createElement('div');
    const savedPosition = this.readDevPanelPosition();
    panel.style.position = 'fixed';
    panel.style.left = `${savedPosition.x}px`;
    panel.style.top = `${savedPosition.y}px`;
    panel.style.zIndex = '9999';
    panel.style.display = 'grid';
    panel.style.gap = '6px';
    panel.style.width = '188px';
    panel.style.padding = '10px';
    panel.style.border = '1px solid rgba(103, 216, 255, 0.78)';
    panel.style.borderRadius = '8px';
    panel.style.background = 'rgba(3, 10, 28, 0.9)';
    panel.style.color = '#eaf7ff';
    panel.style.font = '12px Arial, "Microsoft YaHei", sans-serif';
    panel.style.boxShadow = '0 0 0 1px rgba(47,140,255,0.28), 0 8px 24px rgba(0,0,0,0.34)';
    panel.style.userSelect = 'none';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.gap = '8px';
    header.style.cursor = 'move';

    const title = document.createElement('strong');
    title.textContent = 'DEV 场景调试';
    title.style.fontSize = '13px';
    title.style.lineHeight = '24px';

    const toggle = this.devPanelButton('收起');
    toggle.style.width = '54px';
    toggle.style.height = '24px';
    toggle.style.fontSize = '12px';
    header.append(title, toggle);

    const select = this.devPanelSelect();
    SCENES.forEach((scene) => {
      const option = document.createElement('option');
      option.value = scene;
      option.textContent = scene;
      select.appendChild(option);
    });
    select.value = this.devInitialScene();

    const holdLabel = document.createElement('label');
    holdLabel.style.display = 'flex';
    holdLabel.style.alignItems = 'center';
    holdLabel.style.gap = '6px';
    const hold = document.createElement('input');
    hold.type = 'checkbox';
    hold.checked = this.isLoadingHeldForDebug();
    holdLabel.append(hold, '暂停 loading 跳转');

    const signDayLabel = document.createElement('label');
    signDayLabel.style.display = 'grid';
    signDayLabel.style.gridTemplateColumns = '72px 1fr';
    signDayLabel.style.alignItems = 'center';
    signDayLabel.style.gap = '6px';
    signDayLabel.textContent = '签到天数';
    const signDay = this.devPanelSelect();
    Array.from({ length: 7 }, (_, index) => index + 1).forEach((day) => {
      const option = document.createElement('option');
      option.value = String(day);
      option.textContent = `第 ${day} 天`;
      signDay.appendChild(option);
    });
    signDay.value = String(this.signInDayForDebug());
    signDayLabel.appendChild(signDay);

    const battleEventsLabel = document.createElement('label');
    battleEventsLabel.style.display = 'flex';
    battleEventsLabel.style.alignItems = 'center';
    battleEventsLabel.style.gap = '6px';
    const battleEvents = document.createElement('input');
    battleEvents.type = 'checkbox';
    battleEvents.checked = globalThis.localStorage?.getItem(DEV_BATTLE_EVENTS_KEY) === '1';
    battleEventsLabel.append(battleEvents, '显示全部比赛过程');

    const battleStayLabel = document.createElement('label');
    battleStayLabel.style.display = 'flex';
    battleStayLabel.style.alignItems = 'center';
    battleStayLabel.style.gap = '6px';
    const battleStay = document.createElement('input');
    battleStay.type = 'checkbox';
    battleStay.checked = globalThis.localStorage?.getItem(DEV_BATTLE_STAY_KEY) === '1';
    battleStayLabel.append(battleStay, '停留比赛中');

    const battleAiLabel = document.createElement('label');
    battleAiLabel.style.display = 'flex';
    battleAiLabel.style.alignItems = 'center';
    battleAiLabel.style.gap = '6px';
    const battleAi = document.createElement('input');
    battleAi.type = 'checkbox';
    battleAi.checked = globalThis.localStorage?.getItem(DEV_BATTLE_AI_KEY) === '1';
    battleAiLabel.append(battleAi, '比赛走大模型');

    const matchWaitLabel = document.createElement('label');
    matchWaitLabel.style.display = 'grid';
    matchWaitLabel.style.gridTemplateColumns = '72px 1fr';
    matchWaitLabel.style.alignItems = 'center';
    matchWaitLabel.style.gap = '6px';
    matchWaitLabel.textContent = '匹配秒数';
    const matchWait = document.createElement('input');
    matchWait.type = 'number';
    matchWait.min = '3';
    matchWait.max = '120';
    matchWait.step = '1';
    matchWait.value = String(Math.round(this.matchDurationMs() / 1000));
    matchWait.style.height = '30px';
    matchWait.style.borderRadius = '6px';
    matchWait.style.border = '1px solid #2f8cff';
    matchWait.style.background = '#071936';
    matchWait.style.color = '#fff';
    matchWait.style.padding = '0 8px';
    matchWaitLabel.appendChild(matchWait);

    const actions = document.createElement('div');
    actions.style.display = 'grid';
    actions.style.gridTemplateColumns = '1fr 1fr';
    actions.style.gap = '6px';

    const go = this.devPanelButton('跳转');
    const save = this.devPanelButton('设默认');
    actions.append(go, save);

    const hint = document.createElement('div');
    hint.textContent = '?scene=battle&battleAi=1 可直开大模型比赛';
    hint.style.color = '#9fdcff';
    hint.style.lineHeight = '1.35';
    const bodyItems = [select, holdLabel, signDayLabel, matchWaitLabel, battleEventsLabel, battleStayLabel, battleAiLabel, actions, hint];
    let collapsedState = globalThis.localStorage?.getItem(DEV_PANEL_COLLAPSED_KEY) === '1';
    let dragMoved = false;

    const setCollapsed = (collapsed: boolean) => {
      collapsedState = collapsed;
      globalThis.localStorage?.setItem(DEV_PANEL_COLLAPSED_KEY, collapsed ? '1' : '0');
      bodyItems.forEach((item) => {
        item.style.display = collapsed ? 'none' : '';
      });
      panel.style.width = collapsed ? '88px' : '188px';
      panel.style.minHeight = collapsed ? '30px' : '';
      panel.style.padding = collapsed ? '3px 5px' : '10px';
      panel.style.gap = collapsed ? '0' : '6px';
      panel.style.cursor = collapsed ? 'move' : 'default';
      panel.style.borderRadius = collapsed ? '8px' : '8px';
      header.style.gap = collapsed ? '5px' : '8px';
      title.textContent = collapsed ? 'DEV' : 'DEV 场景调试';
      title.style.fontSize = collapsed ? '12px' : '13px';
      title.style.flex = collapsed ? '0 0 auto' : '';
      toggle.textContent = collapsed ? '展开' : '收起';
      toggle.style.width = collapsed ? '42px' : '54px';
      toggle.style.height = collapsed ? '24px' : '24px';
      this.clampDevPanel(panel);
    };

    go.onclick = () => this.changeScene(select.value as SceneName);
    save.onclick = () => {
      globalThis.localStorage?.setItem(DEV_SCENE_KEY, select.value);
      globalThis.localStorage?.setItem(DEV_HOLD_LOADING_KEY, hold.checked ? '1' : '0');
      globalThis.localStorage?.setItem(DEV_SIGN_DAY_KEY, signDay.value);
      globalThis.localStorage?.setItem(DEV_BATTLE_EVENTS_KEY, battleEvents.checked ? '1' : '0');
      globalThis.localStorage?.setItem(DEV_BATTLE_STAY_KEY, battleStay.checked ? '1' : '0');
      globalThis.localStorage?.setItem(DEV_BATTLE_AI_KEY, battleAi.checked ? '1' : '0');
      globalThis.localStorage?.setItem(DEV_MATCH_DURATION_KEY, matchWait.value || '15');
      save.textContent = '已保存';
      window.setTimeout(() => {
        save.textContent = '设默认';
      }, 900);
    };
    hold.onchange = () => {
      globalThis.localStorage?.setItem(DEV_HOLD_LOADING_KEY, hold.checked ? '1' : '0');
      if (this.scene instanceof LoadingScene) this.changeScene('loading');
    };
    signDay.onchange = () => {
      globalThis.localStorage?.setItem(DEV_SIGN_DAY_KEY, signDay.value);
      if (this.scene instanceof HomeScene) this.changeScene('home');
    };
    battleEvents.onchange = () => {
      globalThis.localStorage?.setItem(DEV_BATTLE_EVENTS_KEY, battleEvents.checked ? '1' : '0');
      if (this.scene instanceof BattleScene) this.changeScene('battle');
    };
    battleStay.onchange = () => {
      globalThis.localStorage?.setItem(DEV_BATTLE_STAY_KEY, battleStay.checked ? '1' : '0');
    };
    battleAi.onchange = () => {
      globalThis.localStorage?.setItem(DEV_BATTLE_AI_KEY, battleAi.checked ? '1' : '0');
      if (this.scene instanceof BattleScene) this.changeScene('battle');
    };
    matchWait.onchange = () => {
      const seconds = Math.max(3, Math.min(120, Number(matchWait.value) || 15));
      matchWait.value = String(seconds);
      globalThis.localStorage?.setItem(DEV_MATCH_DURATION_KEY, String(seconds));
    };
    toggle.onclick = () => {
      if (dragMoved) return;
      setCollapsed(!collapsedState);
    };

    panel.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement | null;
      const interactive = target?.closest('button, select, input, label');
      if (!collapsedState && interactive && target !== toggle) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = panel.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;
      dragMoved = false;
      panel.setPointerCapture?.(event.pointerId);
      const onMove = (moveEvent: PointerEvent) => {
        const x = moveEvent.clientX - offsetX;
        const y = moveEvent.clientY - offsetY;
        if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) dragMoved = true;
        this.placeDevPanel(panel, x, y);
      };
      const onUp = () => {
        panel.removeEventListener('pointermove', onMove);
        panel.removeEventListener('pointerup', onUp);
        panel.removeEventListener('pointercancel', onUp);
        this.storeDevPanelPosition(panel);
        window.setTimeout(() => {
          dragMoved = false;
        }, 0);
      };
      panel.addEventListener('pointermove', onMove);
      panel.addEventListener('pointerup', onUp);
      panel.addEventListener('pointercancel', onUp);
    });

    panel.append(header, ...bodyItems);
    document.body.appendChild(panel);
    setCollapsed(collapsedState);
    this.devPanel = panel;
  }

  private readDevPanelPosition() {
    const fallback = { x: Math.max(8, window.innerWidth - 106), y: 10 };
    try {
      const raw = globalThis.localStorage?.getItem(DEV_PANEL_POSITION_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      return {
        x: Number.isFinite(parsed.x) ? Number(parsed.x) : fallback.x,
        y: Number.isFinite(parsed.y) ? Number(parsed.y) : fallback.y
      };
    } catch {
      return fallback;
    }
  }

  private placeDevPanel(panel: HTMLDivElement, x: number, y: number) {
    const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
    panel.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
    panel.style.top = `${Math.min(Math.max(0, y), maxY)}px`;
  }

  private clampDevPanel(panel: HTMLDivElement) {
    const rect = panel.getBoundingClientRect();
    this.placeDevPanel(panel, rect.left, rect.top);
    this.storeDevPanelPosition(panel);
  }

  private storeDevPanelPosition(panel: HTMLDivElement) {
    const rect = panel.getBoundingClientRect();
    globalThis.localStorage?.setItem(
      DEV_PANEL_POSITION_KEY,
      JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) })
    );
  }

  private devPanelButton(text: string) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.height = '30px';
    button.style.border = '1px solid #56a8ff';
    button.style.borderRadius = '6px';
    button.style.background = '#10234b';
    button.style.color = '#fff';
    button.style.fontWeight = '700';
    button.style.cursor = 'pointer';
    return button;
  }

  private devPanelSelect() {
    const select = document.createElement('select');
    select.style.height = '36px';
    select.style.borderRadius = '7px';
    select.style.background = '#071936';
    select.style.color = '#fff';
    select.style.border = '1px solid #2f83d6';
    select.style.fontSize = '15px';
    select.style.fontWeight = '700';
    select.style.lineHeight = '36px';
    select.style.padding = '0 10px';
    select.style.outline = 'none';
    return select;
  }

  setFormation(formation: FormationData) {
    this.selectedFormation = formation;
    this.lineup = this.arrangeLineupForFormation(formation);
    void this.persist();
  }

  private arrangeLineupForFormation(formation: FormationData) {
    const previous = this.lineup.flatMap((slot) => (slot.player ? [{ player: slot.player, slotPosition: slot.position }] : []));
    const usedIds = new Set<string>();
    const next = formation.slots.map((slot) => ({ ...slot, player: undefined as PlayerCardData | undefined }));

    const takePlayer = (positions: Position[]) => {
      const player = previous.find(
        (item) =>
          !usedIds.has(item.player.id) &&
          item.player.position !== 'GK' &&
          positions.includes(item.player.position)
      )?.player;
      if (player) usedIds.add(player.id);
      return player;
    };

    const gkSlot = next.find((slot) => slot.position === 'GK');
    const goalkeeper = previous.find(
      (item) => !usedIds.has(item.player.id) && item.slotPosition === 'GK' && item.player.position === 'GK'
    )?.player;
    if (gkSlot && goalkeeper) {
      gkSlot.player = goalkeeper;
      usedIds.add(goalkeeper.id);
    }

    const fallbackBySlot: Record<Exclude<Position, 'GK'>, Position[]> = {
      FW: ['FW', 'MF', 'DF'],
      MF: ['MF', 'FW', 'DF'],
      DF: ['DF', 'MF', 'FW']
    };

    next.forEach((slot) => {
      if (slot.position === 'GK') return;
      slot.player = takePlayer(fallbackBySlot[slot.position]);
    });

    next.forEach((slot) => {
      if (slot.position === 'GK' || slot.player) return;
      slot.player = takePlayer(['FW', 'MF', 'DF']);
    });

    return next;
  }

  clearLineup() {
    this.lineup = this.selectedFormation.slots.map((slot) => ({ ...slot, player: undefined }));
    void this.persist();
  }

  fillSlot(slotId: string, player: PlayerCardData) {
    if (!this.collectionIds.has(player.id)) return;
    const targetSlot = this.lineup.find((slot) => slot.id === slotId);
    if (!targetSlot || !this.canPlacePlayerInSlot(player, targetSlot.position)) return;
    this.lineup = this.lineup.map((slot) => {
      if (slot.player?.id === player.id) return { ...slot, player: undefined };
      if (slot.id === slotId) return { ...slot, player };
      return slot;
    });
    this.substitutes = this.substitutes.map((substitute) => (substitute?.id === player.id ? undefined : substitute));
    void this.persist();
  }

  swapLineupSlots(fromSlotId: string, toSlotId: string) {
    if (fromSlotId === toSlotId) return false;
    const fromSlot = this.lineup.find((slot) => slot.id === fromSlotId);
    const toSlot = this.lineup.find((slot) => slot.id === toSlotId);
    if (!fromSlot || !toSlot || !fromSlot.player) return false;
    if (!this.canPlacePlayerInSlot(fromSlot.player, toSlot.position)) return false;
    if (toSlot.player && !this.canPlacePlayerInSlot(toSlot.player, fromSlot.position)) return false;

    const fromPlayer = fromSlot.player;
    const toPlayer = toSlot.player;
    this.lineup = this.lineup.map((slot) => {
      if (slot.id === fromSlotId) return { ...slot, player: toPlayer };
      if (slot.id === toSlotId) return { ...slot, player: fromPlayer };
      return slot;
    });
    void this.persist();
    return true;
  }

  swapLineupWithSubstitute(slotId: string, substituteIndex: number) {
    if (substituteIndex < 0 || substituteIndex >= this.substitutes.length) return false;
    const slot = this.lineup.find((item) => item.id === slotId);
    if (!slot) return false;
    const substitute = this.substitutes[substituteIndex];
    if (!slot.player && !substitute) return false;
    if (substitute && !this.canPlacePlayerInSlot(substitute, slot.position)) return false;

    this.lineup = this.lineup.map((item) => (item.id === slotId ? { ...item, player: substitute } : item));
    this.substitutes = this.substitutes.map((item, index) => (index === substituteIndex ? slot.player : item));
    void this.persist();
    return true;
  }

  swapSubstitutes(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return false;
    if (fromIndex < 0 || fromIndex >= this.substitutes.length || toIndex < 0 || toIndex >= this.substitutes.length) {
      return false;
    }
    const next = [...this.substitutes];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    this.substitutes = next;
    return true;
  }

  fillSubstitute(index: number, player: PlayerCardData) {
    if (!this.collectionIds.has(player.id) || index < 0 || index >= this.substitutes.length) return;
    this.lineup = this.lineup.map((slot) => (slot.player?.id === player.id ? { ...slot, player: undefined } : slot));
    this.substitutes = this.substitutes.map((substitute, itemIndex) => {
      if (substitute?.id === player.id) return undefined;
      if (itemIndex === index) return player;
      return substitute;
    });
    void this.persist();
  }

  private canPlacePlayerInSlot(player: PlayerCardData, slotPosition: Position) {
    return slotPosition === 'GK' ? player.position === 'GK' : player.position !== 'GK';
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

  claimTask(taskId: string, reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number }) {
    if (this.claimedTasks.has(taskId)) return false;
    this.claimedTasks.add(taskId);
    this.coins += reward.coins ?? 0;
    this.scoutTickets += reward.scoutTickets ?? 0;
    this.gems += reward.gems ?? 0;
    this.energy = Math.min(120, this.energy + (reward.energy ?? 0));
    void this.persist();
    return true;
  }

  spendGems(cost: number, reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number }) {
    if (this.gems < cost) return false;
    this.gems -= cost;
    this.coins += reward.coins ?? 0;
    this.scoutTickets += reward.scoutTickets ?? 0;
    this.gems += reward.gems ?? 0;
    this.energy = Math.min(120, this.energy + (reward.energy ?? 0));
    void this.persist();
    return true;
  }

  async purchaseShopItem(item: {
    id: string;
    title: string;
    cost: number;
    reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number };
  }) {
    const result = await this.platform.purchaseGameItem({
      id: item.id,
      title: item.title,
      diamondAmount: item.cost,
      quantity: item.reward.scoutTickets ?? item.reward.gems ?? item.reward.coins ?? item.reward.energy ?? 1,
      extra: { reward: item.reward }
    });
    if (!result.ok) return result;
    this.coins += item.reward.coins ?? 0;
    this.scoutTickets += item.reward.scoutTickets ?? 0;
    this.gems += item.reward.gems ?? 0;
    this.energy = Math.min(120, this.energy + (item.reward.energy ?? 0));
    void this.persist();
    void this.server.grantShopReward({
      userId: this.user.userId,
      itemId: item.id,
      coins: item.reward.coins,
      scoutTickets: item.reward.scoutTickets,
      gems: item.reward.gems,
      energy: item.reward.energy
    }).catch((error) => {
      console.warn('[shop] reward sync failed', error);
    });
    return result;
  }

  ownedPlayers(position?: PlayerCardData['position']) {
    return players
      .filter((player) => this.collectionIds.has(player.id) && (!position || player.position === position))
      .sort((a, b) => b.rating - a.rating);
  }

  lineupPower() {
    return this.lineup.reduce((sum, slot) => sum + (slot.player?.rating ?? 0), 0);
  }

  matchDurationMs() {
    return resolveMatchDurationMs();
  }

  ensureHomeSubstitutes() {
    const usedIds = new Set([
      ...this.lineup.flatMap((slot) => (slot.player ? [slot.player.id] : [])),
      ...this.substitutes.filter(Boolean).map((player) => player!.id)
    ]);
    const benchPool = this.ownedPlayers()
      .filter((player) => !usedIds.has(player.id))
      .sort((a, b) => b.rating - a.rating);
    let poolIndex = 0;
    this.substitutes = this.substitutes.map((substitute) => {
      if (substitute) return substitute;
      const next = benchPool[poolIndex];
      poolIndex += 1;
      return next;
    });
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
    const benchPool = players
      .filter((player) => !usedIds.has(player.id))
      .sort((a, b) => Math.abs(a.rating - targetAverage) - Math.abs(b.rating - targetAverage));
    const opponentSubstitutes = Array.from({ length: 5 }, (_, index) => {
      const player = benchPool[index];
      if (player) usedIds.add(player.id);
      return player;
    });
    this.battleSource = {
      mode: 'ai',
      opponentIsBot: true,
      opponentName: names[Math.floor(Math.random() * names.length)],
      opponentFormation: formation,
      opponentLineup,
      opponentSubstitutes
    };
  }

  async findOpponent() {
    if (!this.server.enabled) {
      this.prepareOpponent();
      return true;
    }

    const matchDurationMs = this.matchDurationMs();
    const ticket = await this.server.joinMatch({
      userId: this.user.userId,
      nickname: this.user.nickname,
      avatarUrl: this.user.avatarUrl,
      power: this.lineupPower(),
      formationId: this.selectedFormation.id,
      lineup: this.lineup.map((slot) => ({
        slotId: slot.id,
        playerId: slot.player?.id,
        rating: slot.player?.rating
      })),
      ...(runtimeEnv.DEV ? { botAfterMs: matchDurationMs } : {})
    });
    if (!ticket) {
      this.prepareOpponent();
      return true;
    }
    if (ticket.status === 'matched' && ticket.opponent) {
      this.applyMatchedOpponent(ticket.opponent);
      return true;
    }

    const ticketId = ticket.ticketId;
    const waitMs = ticket.botAfterMs ?? matchDurationMs;
    const maxAttempts = Math.ceil(waitMs / 1000) + 8;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await this.wait(1000);
      const result = await this.server.pollMatch(ticketId);
      if (result?.status === 'matched' && result.opponent) {
        this.applyMatchedOpponent(result.opponent);
        return true;
      }
      if (result?.status === 'expired') break;
    }

    this.prepareOpponent();
    return true;
  }

  async cancelMatchmaking(ticketId?: string) {
    if (!ticketId) return;
    await this.server.cancelMatch(ticketId).catch((error) => {
      console.warn('[matchmaking] cancel failed', error);
    });
  }

  async recordBattleResult() {
    if (!this.server.enabled) return;
    const { scoreA, scoreB, events } = this.battleResult;
    await this.server.recordMatch({
      playerId: this.user.userId,
      opponentId: this.battleSource.opponentId,
      opponentIsBot: this.battleSource.opponentIsBot !== false,
      opponentName: this.battleSource.opponentName,
      mode: this.battleSource.mode,
      playerScore: scoreA,
      opponentScore: scoreB,
      formationId: this.selectedFormation.id,
      lineup: this.lineup,
      opponentFormationId: this.battleSource.opponentFormation?.id,
      opponentLineup: this.battleSource.opponentLineup,
      events
    }).catch((error) => {
      console.warn('[match] record failed', error);
    });
  }

  private async syncServerSession() {
    if (!this.server.enabled) return;
    try {
      const session = await this.server.syncSession({
        platform: this.sessionPlatformName(),
        platformUserId: this.user.userId,
        nickname: this.user.nickname,
        avatarUrl: this.user.avatarUrl,
        loginCode: this.user.loginCode
      });
      if (!session) return;
      this.user = { ...session.user, avatarUrl: session.user.avatarUrl, loginCode: undefined };
      this.coins = Number(session.state.coins ?? this.coins);
      this.gems = Number(session.state.gems ?? this.gems);
      this.energy = Number(session.state.energy ?? this.energy);
      this.scoutTickets = Number(session.state.scout_tickets ?? this.scoutTickets);
      this.matchesPlayed = Number(session.state.matches_played ?? this.matchesPlayed);
      this.wins = Number(session.state.wins ?? this.wins);
      this.claimedTasks = new Set(Array.isArray(session.state.claimed_tasks) ? session.state.claimed_tasks : []);
      this.dailyTaskDate = String(session.state.daily_task_date ?? this.dailyTaskDate);
      void this.persist();
    } catch (error) {
      console.warn('[server] session sync failed, using local state', error);
    }
  }

  private async loadShopConfig() {
    try {
      this.shopConfig = await this.server.getShopConfig();
    } catch (error) {
      console.warn('[shop] config load failed, using defaults', error);
      this.shopConfig = defaultShopConfig;
    }
  }

  private applyMatchedOpponent(opponent: MatchOpponent) {
    this.prepareOpponent();
    this.battleSource = {
      ...this.battleSource,
      mode: opponent.mode,
      opponentId: opponent.userId,
      opponentIsBot: opponent.isBot,
      opponentName: opponent.nickname || this.battleSource.opponentName
    };
  }

  private sessionPlatformName() {
    if (this.platform.name === 'web' && runtimeEnv.VITE_WEB_TEST_AS_DOUYIN !== '0') return 'douyin';
    return this.platform.name;
  }

  private wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
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

  get safeAreaBottom() {
    return this.screenPxToDesignY(this.safeAreaInsetBottomPx);
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

  setSafeAreaInsets(insets: { top?: number; bottom?: number; contentRight?: number }) {
    if (insets.top != null) this.safeAreaInsetTopPx = Math.max(0, insets.top);
    if (insets.bottom != null) this.safeAreaInsetBottomPx = Math.max(0, insets.bottom);
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
