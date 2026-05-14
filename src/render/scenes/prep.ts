import { Container, Graphics, Text } from 'pixi.js';
import type { GameFlow, MatchSettings } from '../../core/game-flow';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../platform/constants';

const cx = DESIGN_WIDTH / 2;
const DURATIONS = [60, 90, 120] as const;
const HOME_NAMES = ['绿狮联', '海浪 SC', '城北联'] as const;
const AWAY_NAMES = ['紫星联', '赤焰 FC', '疾风联'] as const;

export function createPrepScene(flow: GameFlow): Container {
  const root = new Container();

  let durationSec: (typeof DURATIONS)[number] = 90;
  let homeIdx = 0;
  let awayIdx = 0;

  const dim = new Graphics();
  dim.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  dim.fill({ color: 0x0b0f14, alpha: 0.72 });
  root.addChild(dim);

  const title = new Text({
    text: 'AI 模拟 · 赛前',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 44,
      fill: 0xf5f7fa,
      fontWeight: '700',
    },
  });
  title.anchor.set(0.5, 0.5);
  title.x = cx;
  title.y = 140;

  const mkLabel = (y: number, t: string) => {
    const tx = new Text({
      text: t,
      style: {
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        fontSize: 24,
        fill: 0xc8d0dc,
      },
    });
    tx.anchor.set(0.5, 0.5);
    tx.x = cx;
    tx.y = y;
    return tx;
  };

  const durationTitle = mkLabel(240, '比赛时长');

  const durRow = new Container();
  durRow.y = 300;
  root.addChild(durRow);

  const durCells: { g: Graphics; lab: Text }[] = [];
  const refreshDuration = () => {
    durCells.forEach(({ g, lab }, i) => {
      const sec = DURATIONS[i];
      const on = sec === durationSec;
      g.clear();
      g.roundRect(-58, -40, 116, 80, 16);
      g.fill({ color: on ? 0xf5a623 : 0x1e2430, alpha: on ? 1 : 0.85 });
      g.stroke({ width: 2, color: on ? 0xffffff : 0x3a4556, alpha: 0.5 });
      lab.style.fill = on ? 0x1e2430 : 0xf5f7fa;
    });
  };

  DURATIONS.forEach((sec, i) => {
    const g = new Graphics();
    g.x = cx + (i - 1) * 140;
    g.y = 0;
    g.eventMode = 'static';
    g.cursor = 'pointer';
    g.on('pointertap', () => {
      durationSec = sec;
      refreshDuration();
    });
    const lab = new Text({
      text: `${sec}秒`,
      style: {
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        fontSize: 26,
        fill: 0xf5f7fa,
        fontWeight: '600',
      },
    });
    lab.anchor.set(0.5, 0.5);
    lab.x = g.x;
    lab.y = g.y;
    durCells.push({ g, lab });
    durRow.addChild(g, lab);
  });
  refreshDuration();

  const teamTitle = mkLabel(420, '队伍（虚构名 · 点按切换）');

  const mkTeamRow = (y: number, kind: 'home' | 'away') => {
    const row = new Container();
    row.y = y;
    const tag = new Text({
      text: kind === 'home' ? '主队' : '客队',
      style: {
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        fontSize: 22,
        fill: 0x9aa4b2,
      },
    });
    tag.anchor.set(0, 0.5);
    tag.x = 56;
    tag.y = 0;

    const pill = new Graphics();
    pill.x = cx;
    pill.y = 0;
    pill.eventMode = 'static';
    pill.cursor = 'pointer';

    const nameText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        fontSize: 30,
        fill: 0xf5f7fa,
        fontWeight: '600',
      },
    });
    nameText.anchor.set(0.5, 0.5);
    nameText.x = cx;
    nameText.y = 0;

    const paint = () => {
      const name = kind === 'home' ? HOME_NAMES[homeIdx] : AWAY_NAMES[awayIdx];
      nameText.text = name;
      pill.clear();
      pill.roundRect(-200, -44, 400, 88, 20);
      pill.fill({ color: kind === 'home' ? 0x1b5e32 : 0x3d2a5c, alpha: 0.95 });
      pill.stroke({ width: 2, color: 0xffffff, alpha: 0.2 });
    };

    pill.on('pointertap', () => {
      if (kind === 'home') homeIdx = (homeIdx + 1) % HOME_NAMES.length;
      else awayIdx = (awayIdx + 1) % AWAY_NAMES.length;
      paint();
    });

    paint();
    row.addChild(tag, pill, nameText);
    root.addChild(row);
  };

  mkTeamRow(500, 'home');
  mkTeamRow(600, 'away');

  const start = new Graphics();
  start.roundRect(-200, -48, 400, 96, 22);
  start.fill({ color: 0xf5a623 });
  start.stroke({ width: 3, color: 0xffffff, alpha: 0.35 });
  start.x = cx;
  start.y = DESIGN_HEIGHT - 280;
  start.eventMode = 'static';
  start.cursor = 'pointer';
  start.on('pointertap', () => {
    const settings: MatchSettings = {
      durationSec,
      homeName: HOME_NAMES[homeIdx],
      awayName: AWAY_NAMES[awayIdx],
    };
    flow.goMatch(settings);
  });

  const startLabel = new Text({
    text: '进入比赛',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 32,
      fill: 0x1e2430,
      fontWeight: '700',
    },
  });
  startLabel.anchor.set(0.5, 0.5);
  startLabel.x = start.x;
  startLabel.y = start.y;

  const back = new Graphics();
  back.roundRect(-160, -40, 320, 80, 18);
  back.stroke({ width: 2, color: 0x3a4556 });
  back.fill({ color: 0x1e2430, alpha: 0.55 });
  back.x = cx;
  back.y = DESIGN_HEIGHT - 160;
  back.eventMode = 'static';
  back.cursor = 'pointer';
  back.on('pointertap', () => flow.goMenu());

  const backLabel = new Text({
    text: '返回主菜单',
    style: {
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      fontSize: 26,
      fill: 0xe8ecf1,
    },
  });
  backLabel.anchor.set(0.5, 0.5);
  backLabel.x = back.x;
  backLabel.y = back.y;

  root.addChild(
    title,
    durationTitle,
    durRow,
    teamTitle,
    start,
    startLabel,
    back,
    backLabel,
  );
  return root;
}
