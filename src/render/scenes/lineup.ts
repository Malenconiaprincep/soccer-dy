import { Container, Graphics, Text } from 'pixi.js';
import type { GameFlow } from '../../core/game-flow';
import { ALL_PLAYERS } from '../../core/players-data';
import { ensureStartingXi, setStartingXi, sessionState } from '../../core/session-state';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../platform/constants';

const cx = DESIGN_WIDTH / 2;
const ROW_H = 56;
const LIST_TOP = 200;

export function createLineupScene(flow: GameFlow): Container {
  const root = new Container();

  const xi = new Set<string>(ensureStartingXi());

  const dim = new Graphics();
  dim.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  dim.fill({ color: 0x0b0f14, alpha: 0.94 });
  root.addChild(dim);

  const title = new Text({
    text: '球队阵容 · 首发 11 人',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 36,
      fill: 0xf5f7fa,
      fontWeight: '700',
    },
  });
  title.anchor.set(0.5, 0.5);
  title.x = cx;
  title.y = 100;
  title.eventMode = 'none';

  const countLab = new Text({
    text: '',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 24,
      fill: 0xf5a623,
      fontWeight: '600',
    },
  });
  countLab.anchor.set(0.5, 0.5);
  countLab.x = cx;
  countLab.y = 152;
  countLab.eventMode = 'none';

  const list = new Container();
  list.y = LIST_TOP;

  const owned = ALL_PLAYERS.filter((p) => sessionState.ownedIds.has(p.id));

  const refreshCount = () => {
    countLab.text = `已选 ${xi.size} / 11 · 点行切换`;
  };

  const refreshSaveBtn = (save: Graphics) => {
    const ok = xi.size === 11;
    save.clear();
    save.roundRect(-200, -44, 400, 88, 20);
    save.fill({ color: 0xf5a623, alpha: ok ? 1 : 0.42 });
    save.stroke({ width: 2, color: 0xffffff, alpha: ok ? 0.35 : 0.18 });
  };

  const paintRows = () => {
    list.removeChildren();
    owned.forEach((pl, i) => {
      const on = xi.has(pl.id);
      const row = new Container();
      row.y = i * ROW_H;
      const g = new Graphics();
      g.roundRect(24, 0, DESIGN_WIDTH - 48, ROW_H - 6, 14);
      g.fill({ color: on ? 0x1b5e32 : 0x1e2430, alpha: 0.95 });
      g.stroke({ width: 2, color: on ? 0xf5a623 : 0x3a4556, alpha: 0.55 });
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointertap', () => {
        if (on) xi.delete(pl.id);
        else if (xi.size < 11) xi.add(pl.id);
        refreshCount();
        refreshSaveBtn(save);
        paintRows();
      });
      const lab = new Text({
        text: `${on ? '★' : '○'} ${pl.name}  ${pl.pos}  OVR${pl.ovr}`,
        style: {
          fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
          fontSize: 21,
          fill: 0xf5f7fa,
        },
      });
      lab.x = 44;
      lab.y = 12;
      lab.eventMode = 'none';
      row.addChild(g, lab);
      list.addChild(row);
    });
  };

  const save = new Graphics();
  save.x = cx;
  save.y = DESIGN_HEIGHT - 200;
  save.eventMode = 'static';
  save.cursor = 'pointer';
  save.on('pointertap', () => {
    if (xi.size !== 11) return;
    setStartingXi([...xi]);
    flow.goMenu();
  });

  const saveLab = new Text({
    text: '保存首发',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 28,
      fill: 0x1e2430,
      fontWeight: '700',
    },
  });
  saveLab.anchor.set(0.5, 0.5);
  saveLab.x = save.x;
  saveLab.y = save.y;
  saveLab.eventMode = 'none';

  const back = new Graphics();
  back.roundRect(-160, -40, 320, 80, 18);
  back.stroke({ width: 2, color: 0x3a4556 });
  back.fill({ color: 0x1e2430, alpha: 0.65 });
  back.x = cx;
  back.y = DESIGN_HEIGHT - 100;
  back.eventMode = 'static';
  back.cursor = 'pointer';
  back.on('pointertap', () => flow.goMenu());
  const backLab = new Text({
    text: '返回',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 26,
      fill: 0xe8ecf1,
    },
  });
  backLab.anchor.set(0.5, 0.5);
  backLab.x = back.x;
  backLab.y = back.y;
  backLab.eventMode = 'none';

  refreshCount();
  refreshSaveBtn(save);
  paintRows();

  root.addChild(title, countLab, list, save, saveLab, back, backLab);
  return root;
}
