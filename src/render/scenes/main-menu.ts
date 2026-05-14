import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { GameFlow } from '../../core/game-flow';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../platform/constants';
import { fitSpriteCover } from '../fit-sprite-cover';
import type { GameArt } from '../game-art';

const cx = DESIGN_WIDTH / 2;
const BTN_W = 420;
const BTN_H = 88;
const GAP = 16;

function mkMenuButton(
  root: Container,
  y: number,
  label: string,
  onTap: () => void,
  accent = true,
): void {
  const btn = new Graphics();
  btn.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 20);
  btn.fill({ color: accent ? 0xf5a623 : 0x2a3444, alpha: accent ? 1 : 0.95 });
  btn.stroke({ width: 2, color: 0xffffff, alpha: accent ? 0.3 : 0.15 });
  btn.x = cx;
  btn.y = y;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointertap', onTap);
  const lab = new Text({
    text: label,
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 28,
      fill: accent ? 0x1e2430 : 0xf5f7fa,
      fontWeight: '700',
    },
  });
  lab.anchor.set(0.5, 0.5);
  lab.x = btn.x;
  lab.y = btn.y;
  lab.eventMode = 'none';
  root.addChild(btn, lab);
}

export function createMainMenuScene(flow: GameFlow, art: GameArt): Container {
  const root = new Container();

  const bgMask = new Graphics();
  bgMask.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  bgMask.fill(0xffffff);
  const bg = new Sprite(art.bgMainMenu);
  fitSpriteCover(bg, DESIGN_WIDTH, DESIGN_HEIGHT, false);
  bg.mask = bgMask;
  root.addChild(bg, bgMask);

  const shade = new Graphics();
  shade.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  shade.fill({ color: 0x0b0f14, alpha: 0.35 });
  root.addChild(shade);

  const title = new Text({
    text: '足球经理对战',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 52,
      fill: 0xf5f7fa,
      fontWeight: '700',
      dropShadow: { alpha: 0.45, angle: Math.PI / 4, blur: 6, color: 0x000000, distance: 2 },
    },
  });
  title.anchor.set(0.5, 0.5);
  title.x = cx;
  title.y = DESIGN_HEIGHT * 0.22;
  title.eventMode = 'none';

  const sub = new Text({
    text: '阵容 · 交易 · AI 文字解说赛',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 24,
      fill: 0xf0f4f8,
      dropShadow: { alpha: 0.35, angle: Math.PI / 4, blur: 4, color: 0x000000, distance: 1 },
    },
  });
  sub.anchor.set(0.5, 0.5);
  sub.x = cx;
  sub.y = DESIGN_HEIGHT * 0.29;
  sub.eventMode = 'none';

  root.addChild(title, sub);

  let y = DESIGN_HEIGHT * 0.38;
  mkMenuButton(root, y, '球队阵容', () => flow.goLineup(), false);
  y += BTN_H + GAP;
  mkMenuButton(root, y, '球员交易', () => flow.goTrading(), false);
  y += BTN_H + GAP;
  mkMenuButton(root, y, 'AI 模拟对战', () => flow.goPrep(), true);

  return root;
}
