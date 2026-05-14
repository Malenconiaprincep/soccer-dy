import { Container, Graphics, Text } from 'pixi.js';
import type { GameFlow } from '../../core/game-flow';
import { ALL_PLAYERS } from '../../core/players-data';
import { sessionState } from '../../core/session-state';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../platform/constants';

const cx = DESIGN_WIDTH / 2;
const ROW = 72;
const TOP = 200;

export function createTradingScene(flow: GameFlow): Container {
  const root = new Container();

  const dim = new Graphics();
  dim.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  dim.fill({ color: 0x0b0f14, alpha: 0.94 });
  root.addChild(dim);

  const title = new Text({
    text: '球员交易',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 38,
      fill: 0xf5f7fa,
      fontWeight: '700',
    },
  });
  title.anchor.set(0.5, 0.5);
  title.x = cx;
  title.y = 96;
  title.eventMode = 'none';

  const bal = new Text({
    text: '',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 26,
      fill: 0xf5a623,
      fontWeight: '600',
    },
  });
  bal.anchor.set(0.5, 0.5);
  bal.x = cx;
  bal.y = 150;
  bal.eventMode = 'none';

  const list = new Container();
  list.y = TOP;

  const refreshBal = () => {
    bal.text = `资金 ${sessionState.balance} 万（虚构单位）`;
  };

  const removeFromXi = (id: string) => {
    const idx = sessionState.startingIds.indexOf(id);
    if (idx >= 0) sessionState.startingIds.splice(idx, 1);
  };

  const paint = () => {
    list.removeChildren();
    refreshBal();

    const mkSection = (y0: number, heading: string) => {
      const h = new Text({
        text: heading,
        style: {
          fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
          fontSize: 22,
          fill: 0xc8d0dc,
        },
      });
      h.x = 32;
      h.y = y0;
      h.eventMode = 'none';
      list.addChild(h);
      return y0 + 36;
    };

    let y = 0;
    y = mkSection(y, '转会市场 · 签约');
    const market = ALL_PLAYERS.filter((p) => sessionState.marketIds.has(p.id) && !sessionState.ownedIds.has(p.id));
    if (market.length === 0) {
      const em = new Text({
        text: '（暂无挂牌）',
        style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 20, fill: 0x7a8699 },
      });
      em.x = 40;
      em.y = y;
      em.eventMode = 'none';
      list.addChild(em);
      y += 40;
    } else {
      market.forEach((pl) => {
        const row = new Container();
        row.y = y;
        const g = new Graphics();
        g.roundRect(24, 0, DESIGN_WIDTH - 48, ROW - 8, 14);
        g.fill({ color: 0x1e2430, alpha: 0.92 });
        g.stroke({ width: 2, color: 0x3a4556, alpha: 0.5 });
        g.eventMode = 'static';
        g.cursor = 'pointer';
        g.on('pointertap', () => {
          if (sessionState.balance < pl.price) return;
          sessionState.balance -= pl.price;
          sessionState.ownedIds.add(pl.id);
          sessionState.marketIds.delete(pl.id);
          paint();
        });
        const lab = new Text({
          text: `${pl.name}  ${pl.pos}  ·  ${pl.price} 万  点按签约`,
          style: {
            fontFamily: 'system-ui, "PingFang SC", sans-serif',
            fontSize: 20,
            fill: 0xf5f7fa,
          },
        });
        lab.x = 40;
        lab.y = 16;
        lab.eventMode = 'none';
        row.addChild(g, lab);
        list.addChild(row);
        y += ROW;
      });
    }

    y += 16;
    y = mkSection(y, '我的球员 · 出售（回收 70%）');
    const mine = ALL_PLAYERS.filter((p) => sessionState.ownedIds.has(p.id));
    mine.forEach((pl) => {
      const row = new Container();
      row.y = y;
      const g = new Graphics();
      g.roundRect(24, 0, DESIGN_WIDTH - 48, ROW - 8, 14);
      g.fill({ color: 0x2a2438, alpha: 0.9 });
      g.stroke({ width: 2, color: 0x3a4556, alpha: 0.45 });
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointertap', () => {
        if (sessionState.ownedIds.size <= 11) return;
        const gain = Math.floor(pl.price * 0.7);
        sessionState.balance += gain;
        sessionState.ownedIds.delete(pl.id);
        sessionState.marketIds.add(pl.id);
        removeFromXi(pl.id);
        paint();
      });
      const lab = new Text({
        text: `${pl.name}  ${pl.pos}  ·  回收约 ${Math.floor(pl.price * 0.7)} 万`,
        style: {
          fontFamily: 'system-ui, "PingFang SC", sans-serif',
          fontSize: 20,
          fill: 0xe8ecf1,
        },
      });
      lab.x = 40;
      lab.y = 16;
      lab.eventMode = 'none';
      row.addChild(g, lab);
      list.addChild(row);
      y += ROW;
    });
  };

  const back = new Graphics();
  back.roundRect(-170, -42, 340, 84, 18);
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
      fontFamily: 'system-ui, "PingFang SC", sans-serif',
      fontSize: 26,
      fill: 0xe8ecf1,
    },
  });
  backLab.anchor.set(0.5, 0.5);
  backLab.x = back.x;
  backLab.y = back.y;
  backLab.eventMode = 'none';

  paint();
  root.addChild(title, bal, list, back, backLab);
  return root;
}
