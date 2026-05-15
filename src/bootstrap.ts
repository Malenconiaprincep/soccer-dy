import { Application, Container } from 'pixi.js';
import { DEFAULT_MATCH_SETTINGS, type GameFlow, type MatchSettings, type SceneId } from './core/game-flow';
import { createPlatform, DESIGN_HEIGHT, DESIGN_SCALE_MODE, DESIGN_WIDTH, type Platform } from './platform';
import { loadGameArt } from './render/game-art';
import { tryCreateLoadingOverlay } from './ui/loading-overlay';
import { createMainMenuScene } from './render/scenes/main-menu';
import { createLineupScene } from './render/scenes/lineup';
import { createMatchScene } from './render/scenes/match';
import { createPrepScene } from './render/scenes/prep';
import { createTradingScene } from './render/scenes/trading';

/** Web 加载页最短停留（毫秒）。设为 `0` 即加载完立刻进入游戏；当前便于预览动效。 */
const WEB_LOADING_MIN_MS = 60_000;

function wireMinigamePointerBridge(_app: Application, platform: Platform, canvas: HTMLCanvasElement) {
  if (platform.kind === 'web') return () => {};

  const dispatch = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) => {
    const rect = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const cx = rect.left + (x / canvas.width) * rect.width;
    const cy = rect.top + (y / canvas.height) * rect.height;
    const Cls =
      (globalThis as unknown as { PointerEvent?: typeof PointerEvent }).PointerEvent ?? globalThis.MouseEvent;
    if (!Cls) return;
    const ev = new Cls(type, {
      bubbles: true,
      cancelable: true,
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    } as MouseEventInit);
    canvas.dispatchEvent(ev as unknown as Event);
  };

  return platform.subscribeTouches(canvas, (kind, x, y) => {
    if (kind === 'start') dispatch('pointerdown', x, y);
    else if (kind === 'move') dispatch('pointermove', x, y);
    else dispatch('pointerup', x, y);
  });
}

export async function bootstrap(kind: 'web' | 'wechat' | 'douyin'): Promise<void> {
  const platform = createPlatform(kind);

  const loading = kind === 'web' ? tryCreateLoadingOverlay() : null;
  const loadingStartedAt = loading !== null ? performance.now() : 0;
  const progress = (pct: number, headline?: string) => loading?.setProgress(pct, headline);

  const host = kind === 'web' ? (document.querySelector<HTMLElement>('#app') ?? document.body) : null;
  progress?.(4, '准备画布…');
  const { canvas, screenWidth, screenHeight } = platform.mountMainCanvas(host);

  const dpr = platform.getPixelRatio();

  const app = new Application();
  progress?.(12, '初始化渲染引擎…');
  await app.init({
    canvas,
    width: screenWidth,
    height: screenHeight,
    resolution: dpr,
    autoDensity: true,
    antialias: true,
    backgroundColor: 0x1e2430,
    preference: 'webgl',
  });

  platform.attachView(app);

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  const world = new Container();
  app.stage.addChild(world);

  progress?.(22, '加载游戏素材…');
  const art = await loadGameArt((t, label) => {
    progress?.(22 + t * 68, label);
  });
  progress?.(94, '布置球场…');
  let lastMatch: MatchSettings = DEFAULT_MATCH_SETTINGS;

  const applyLayout = () => {
    const w = app.renderer.width;
    const h = app.renderer.height;
    const sx = w / DESIGN_WIDTH;
    const sy = h / DESIGN_HEIGHT;
    const s = DESIGN_SCALE_MODE === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
    world.scale.set(s);
    world.position.set((w - DESIGN_WIDTH * s) / 2, (h - DESIGN_HEIGHT * s) / 2);
  };
  applyLayout();

  let scene: Container | null = null;
  const flow: GameFlow = {
    goMenu: () => show('menu'),
    goLineup: () => show('lineup'),
    goTrading: () => show('trading'),
    goPrep: () => show('prep'),
    goMatch: (s) => {
      lastMatch = s;
      show('match');
    },
  };

  function show(id: SceneId) {
    if (scene) {
      world.removeChild(scene);
      scene.destroy({ children: true });
    }
    if (id === 'menu') scene = createMainMenuScene(flow, art);
    else if (id === 'lineup') scene = createLineupScene(flow);
    else if (id === 'trading') scene = createTradingScene(flow);
    else if (id === 'prep') scene = createPrepScene(flow);
    else scene = createMatchScene(flow, art, lastMatch);
    world.addChild(scene);
  }

  show('menu');

  progress?.(100, '正在进入球场…');
  if (loading && WEB_LOADING_MIN_MS > 0) {
    const elapsed = performance.now() - loadingStartedAt;
    const remain = WEB_LOADING_MIN_MS - elapsed;
    if (remain > 0) await new Promise((r) => setTimeout(r, remain));
  }
  loading?.dispose();

  const unSub = wireMinigamePointerBridge(app, platform, canvas);

  const onResize = () => {
    if (kind !== 'web') return;
    const el = host ?? document.body;
    const r = el.getBoundingClientRect();
    const nw = Math.max(1, Math.floor(r.width));
    const nh = Math.max(1, Math.floor(r.height));
    app.renderer.resize(nw, nh);
    canvas.style.width = `${nw}px`;
    canvas.style.height = `${nh}px`;
    applyLayout();
  };
  window.addEventListener('resize', onResize);

  globalThis.addEventListener?.('beforeunload', () => {
    window.removeEventListener('resize', onResize);
    unSub();
    app.destroy(true);
  });
}
