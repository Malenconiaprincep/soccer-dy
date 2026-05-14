import { Container, Graphics, Sprite, Text, Ticker } from 'pixi.js';
import type { GameFlow, MatchSettings } from '../../core/game-flow';
import { playerById } from '../../core/players-data';
import { ensureStartingXi } from '../../core/session-state';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../platform/constants';
import type { GameArt } from '../game-art';
import { fitSpriteCover } from '../fit-sprite-cover';

const MAX_LOG = 20;
const LOG_W = DESIGN_WIDTH - 56;
const LOG_H = 720;
const LOG_TOP = 300;

interface SimCtx {
  home: string;
  away: string;
  pick: () => string;
}

function pickPlayer(): string {
  const ids = ensureStartingXi();
  const id = ids[Math.floor(Math.random() * ids.length)] ?? 'p12';
  return playerById(id)?.name ?? '前锋·虎牙';
}

function weightedLine(ctx: SimCtx): string {
  const blocks: { w: number; t: string | ((c: SimCtx) => string) }[] = [
    { w: 9, t: (c) => `${c.pick()} 中场拿球，观察队友跑位。` },
    { w: 8, t: (c) => `【场面】${c.home} 前场短传配合，压迫上升。` },
    { w: 8, t: (c) => `【场面】${c.away} 收缩防线，伺机反击。` },
    { w: 5, t: (c) => `${c.pick()} 尝试远射——稍稍偏出。` },
    { w: 4, t: () => `【事件】射门击中门柱！球迷一片叹息。` },
    { w: 3, t: () => `【事件】判罚角球，进攻方球员全部压上。` },
    { w: 2, t: () => `【事件】禁区内犯规！裁判指向点球点！` },
    { w: 3, t: () => `【事件】激烈拼抢，双方各吃一张黄牌。` },
    { w: 2, t: () => `【事件】边裁举旗示意越位，进球无效。` },
    { w: 4, t: (c) => `${c.pick()} 传中，头球攻门被门将没收。` },
    { w: 3, t: () => `VAR 提醒主裁回看，比赛短暂中断。` },
    { w: 5, t: (c) => `${c.away} 断球成功，快速通过中场。` },
  ];
  let sum = 0;
  for (const b of blocks) sum += b.w;
  let r = Math.random() * sum;
  for (const b of blocks) {
    r -= b.w;
    if (r < 0) {
      return typeof b.t === 'function' ? b.t(ctx) : b.t;
    }
  }
  return `${ctx.home} 与 ${ctx.away} 在中场僵持。`;
}

export function createMatchScene(flow: GameFlow, art: GameArt, settings: MatchSettings): Container {
  const root = new Container();

  const bg = new Sprite(art.bgMainMenu);
  fitSpriteCover(bg, DESIGN_WIDTH, DESIGN_HEIGHT, false);
  bg.alpha = 0.14;
  bg.eventMode = 'none';
  root.addChild(bg);

  let minute = 0;
  let homeScore = 0;
  let awayScore = 0;
  let pressure = 0.52;
  let paused = false;
  let ended = false;
  const logLines: string[] = [];
  let accMs = 0;
  const tickMs = Math.max(280, (settings.durationSec * 1000) / 90);

  const ctx: SimCtx = {
    home: settings.homeName,
    away: settings.awayName,
    pick: pickPlayer,
  };

  const hudBar = new Graphics();
  hudBar.roundRect(28, 40, DESIGN_WIDTH - 56, 108, 20);
  hudBar.fill({ color: 0x1e2430, alpha: 0.88 });
  hudBar.stroke({ width: 2, color: 0xffffff, alpha: 0.1 });
  hudBar.eventMode = 'none';
  root.addChild(hudBar);

  const scoreText = new Text({
    text: '',
    style: {
      fontFamily: 'system-ui, "PingFang SC", sans-serif',
      fontSize: 32,
      fill: 0xf5f7fa,
      fontWeight: '700',
    },
  });
  scoreText.anchor.set(0.5, 0.5);
  scoreText.x = DESIGN_WIDTH / 2;
  scoreText.y = 88;
  scoreText.eventMode = 'none';

  const minText = new Text({
    text: '',
    style: {
      fontFamily: 'system-ui, "PingFang SC", sans-serif',
      fontSize: 22,
      fill: 0xf5a623,
      fontWeight: '600',
    },
  });
  minText.anchor.set(0.5, 0.5);
  minText.x = DESIGN_WIDTH / 2;
  minText.y = 128;
  minText.eventMode = 'none';

  const simTag = new Text({
    text: 'AI 模拟解说',
    style: {
      fontFamily: 'system-ui, "PingFang SC", sans-serif',
      fontSize: 18,
      fill: 0x9aa4b2,
    },
  });
  simTag.anchor.set(0, 0.5);
  simTag.x = 44;
  simTag.y = 88;
  simTag.eventMode = 'none';

  const pauseBtn = new Graphics();
  pauseBtn.roundRect(-34, -34, 68, 68, 16);
  pauseBtn.fill({ color: 0x2a3444, alpha: 0.95 });
  pauseBtn.stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
  pauseBtn.x = DESIGN_WIDTH - 80;
  pauseBtn.y = 94;
  pauseBtn.eventMode = 'static';
  pauseBtn.cursor = 'pointer';

  const pauseIcon = new Text({
    text: '‖',
    style: { fontFamily: 'system-ui, sans-serif', fontSize: 26, fill: 0xf5f7fa, fontWeight: '700' },
  });
  pauseIcon.anchor.set(0.5, 0.5);
  pauseIcon.x = pauseBtn.x;
  pauseIcon.y = pauseBtn.y;
  pauseIcon.eventMode = 'none';

  const barBg = new Graphics();
  barBg.roundRect(32, 168, DESIGN_WIDTH - 64, 36, 10);
  barBg.fill({ color: 0x0f1419, alpha: 0.95 });
  barBg.stroke({ width: 1, color: 0x3a4556, alpha: 0.5 });
  barBg.eventMode = 'none';
  root.addChild(barBg);

  const barHome = new Graphics();
  const barAway = new Graphics();
  const pressLab = new Text({
    text: '',
    style: {
      fontFamily: 'system-ui, "PingFang SC", sans-serif',
      fontSize: 18,
      fill: 0xc8d0dc,
    },
  });
  pressLab.anchor.set(0.5, 0.5);
  pressLab.x = DESIGN_WIDTH / 2;
  pressLab.y = 210;
  pressLab.eventMode = 'none';

  const paintBar = () => {
    const bw = DESIGN_WIDTH - 64 - 8;
    const bx = 36;
    const by = 172;
    const h = 28;
    const split = bx + bw * pressure;
    barHome.clear();
    barHome.roundRect(bx, by, Math.max(4, split - bx), h, 8);
    barHome.fill({ color: 0x2d8f47, alpha: 0.95 });
    barAway.clear();
    barAway.roundRect(split, by, Math.max(4, bx + bw - split), h, 8);
    barAway.fill({ color: 0x5c3d8a, alpha: 0.92 });
    const hp = Math.round(pressure * 100);
    pressLab.text = `场面压制  ${settings.homeName} ${hp}%  —  ${100 - hp}%  ${settings.awayName}`;
  };

  const logBg = new Graphics();
  logBg.roundRect(28, LOG_TOP - 12, DESIGN_WIDTH - 56, LOG_H + 24, 16);
  logBg.fill({ color: 0x121820, alpha: 0.78 });
  logBg.stroke({ width: 2, color: 0xffffff, alpha: 0.08 });
  logBg.eventMode = 'none';
  root.addChild(logBg);

  const logText = new Text({
    text: '',
    style: {
      fontFamily: 'system-ui, "PingFang SC", sans-serif',
      fontSize: 19,
      fill: 0xe8ecf1,
      wordWrap: true,
      wordWrapWidth: LOG_W,
      lineHeight: 26,
    },
  });
  logText.x = 40;
  logText.y = LOG_TOP;
  logText.eventMode = 'none';

  const pushLine = (s: string) => {
    logLines.push(s);
    while (logLines.length > MAX_LOG) logLines.shift();
    logText.text = logLines.join('\n');
  };

  const refreshHud = () => {
    scoreText.text = `${settings.homeName}  ${homeScore}  :  ${awayScore}  ${settings.awayName}`;
    minText.text = `${minute}′ / 90′`;
    paintBar();
  };

  const maybeGoal = () => {
    if (Math.random() > 0.07) return;
    if (Math.random() < pressure) {
      homeScore += 1;
      pushLine(`${minute}′ 【进球】${settings.homeName}！${ctx.pick()} 建功！`);
      pressure = Math.min(0.88, pressure + 0.06);
    } else {
      awayScore += 1;
      pushLine(`${minute}′ 【进球】${settings.awayName} 扳平节奏！反击得手！`);
      pressure = Math.max(0.12, pressure - 0.06);
    }
  };

  const stepMinute = () => {
    if (paused || ended) return;
    minute += 1;
    pressure += (Math.random() - 0.5) * 0.06;
    pressure = Math.max(0.1, Math.min(0.9, pressure));
    if (minute === 1) {
      pushLine(`1′ 裁判鸣哨，${settings.homeName} 与 ${settings.awayName} 的 AI 模拟战开始。`);
    } else {
      pushLine(`${minute}′ ${weightedLine(ctx)}`);
    }
    maybeGoal();
    refreshHud();
    if (minute >= 90) openEnd();
  };

  pauseBtn.on('pointertap', () => {
    if (ended) return;
    paused = true;
    pauseOverlay.visible = true;
  });

  const pauseOverlay = new Container();
  pauseOverlay.visible = false;
  pauseOverlay.eventMode = 'static';
  const pauseDim = new Graphics();
  pauseDim.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  pauseDim.fill({ color: 0x05080c, alpha: 0.82 });
  pauseDim.eventMode = 'static';
  const pauseTitle = new Text({
    text: '已暂停',
    style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 38, fill: 0xf5f7fa, fontWeight: '700' },
  });
  pauseTitle.anchor.set(0.5, 0.5);
  pauseTitle.x = DESIGN_WIDTH / 2;
  pauseTitle.y = DESIGN_HEIGHT * 0.42;
  pauseTitle.eventMode = 'none';
  const resume = new Graphics();
  resume.roundRect(-160, -44, 320, 88, 20);
  resume.fill({ color: 0xf5a623 });
  resume.x = DESIGN_WIDTH / 2;
  resume.y = DESIGN_HEIGHT * 0.54;
  resume.eventMode = 'static';
  resume.cursor = 'pointer';
  resume.on('pointertap', () => {
    paused = false;
    pauseOverlay.visible = false;
  });
  const resumeLab = new Text({
    text: '继续',
    style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 30, fill: 0x1e2430, fontWeight: '700' },
  });
  resumeLab.anchor.set(0.5, 0.5);
  resumeLab.x = resume.x;
  resumeLab.y = resume.y;
  resumeLab.eventMode = 'none';
  pauseOverlay.addChild(pauseDim, pauseTitle, resume, resumeLab);

  const endOverlay = new Container();
  endOverlay.visible = false;
  endOverlay.eventMode = 'static';
  const endDim = new Graphics();
  endDim.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  endDim.fill({ color: 0x05080c, alpha: 0.9 });
  endDim.eventMode = 'static';
  const endTitle = new Text({
    text: '全场结束',
    style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 40, fill: 0xf5f7fa, fontWeight: '700' },
  });
  endTitle.anchor.set(0.5, 0.5);
  endTitle.x = DESIGN_WIDTH / 2;
  endTitle.y = DESIGN_HEIGHT * 0.34;
  endTitle.eventMode = 'none';
  const endScore = new Text({
    text: '',
    style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 30, fill: 0xf5a623, fontWeight: '700' },
  });
  endScore.anchor.set(0.5, 0.5);
  endScore.x = DESIGN_WIDTH / 2;
  endScore.y = DESIGN_HEIGHT * 0.44;
  endScore.eventMode = 'none';
  const again = new Graphics();
  again.roundRect(-170, -44, 340, 88, 20);
  again.fill({ color: 0xf5a623 });
  again.x = DESIGN_WIDTH / 2;
  again.y = DESIGN_HEIGHT * 0.58;
  again.eventMode = 'static';
  again.cursor = 'pointer';
  again.on('pointertap', () => flow.goPrep());
  const againLab = new Text({
    text: '再来一局',
    style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 28, fill: 0x1e2430, fontWeight: '700' },
  });
  againLab.anchor.set(0.5, 0.5);
  againLab.x = again.x;
  againLab.y = again.y;
  againLab.eventMode = 'none';
  const toMenu = new Graphics();
  toMenu.roundRect(-170, -44, 340, 88, 18);
  toMenu.stroke({ width: 2, color: 0x3a4556 });
  toMenu.fill({ color: 0x1e2430, alpha: 0.75 });
  toMenu.x = DESIGN_WIDTH / 2;
  toMenu.y = DESIGN_HEIGHT * 0.7;
  toMenu.eventMode = 'static';
  toMenu.cursor = 'pointer';
  toMenu.on('pointertap', () => flow.goMenu());
  const toMenuLab = new Text({
    text: '回主菜单',
    style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 26, fill: 0xe8ecf1 },
  });
  toMenuLab.anchor.set(0.5, 0.5);
  toMenuLab.x = toMenu.x;
  toMenuLab.y = toMenu.y;
  toMenuLab.eventMode = 'none';
  endOverlay.addChild(endDim, endTitle, endScore, again, againLab, toMenu, toMenuLab);

  const openEnd = () => {
    if (ended) return;
    ended = true;
    paused = true;
    endScore.text = `${settings.homeName} ${homeScore} : ${awayScore} ${settings.awayName}`;
    endOverlay.visible = true;
    pauseOverlay.visible = false;
    pushLine(`90+′ 终场哨响。感谢收看本场 AI 文字解说。`);
    refreshHud();
  };

  const onTick = (ticker: Ticker) => {
    if (ended) return;
    accMs += ticker.deltaMS;
    while (accMs >= tickMs && !paused && !ended && minute < 90) {
      accMs -= tickMs;
      stepMinute();
    }
  };

  Ticker.shared.add(onTick);
  root.once('destroyed', () => {
    Ticker.shared.remove(onTick);
  });

  const back = new Graphics();
  back.roundRect(-120, -38, 240, 76, 16);
  back.stroke({ width: 2, color: 0x3a4556 });
  back.fill({ color: 0x1e2430, alpha: 0.6 });
  back.x = DESIGN_WIDTH / 2;
  back.y = DESIGN_HEIGHT - 88;
  back.eventMode = 'static';
  back.cursor = 'pointer';
  back.on('pointertap', () => flow.goMenu());
  const backLab = new Text({
    text: '退出比赛',
    style: { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: 24, fill: 0xf5f7fa },
  });
  backLab.anchor.set(0.5, 0.5);
  backLab.x = back.x;
  backLab.y = back.y;
  backLab.eventMode = 'none';

  refreshHud();
  root.addChild(
    bg,
    hudBar,
    barBg,
    barHome,
    barAway,
    scoreText,
    minText,
    simTag,
    pauseBtn,
    pauseIcon,
    pressLab,
    logBg,
    logText,
    back,
    backLab,
    pauseOverlay,
    endOverlay,
  );
  return root;
}
