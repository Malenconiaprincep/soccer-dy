import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { headerTitleSprite, label, palette } from '../ui';
import type { BattleEvent, PlayerCardData } from '../types';
import { playerDisplayName } from '../playerNames';

interface StatRow {
  icon: string;
  name: string;
  left: string;
  right: string;
  leftValue: number;
  rightValue: number;
}

export class ResultScene extends BaseScene {
  private rewardsGranted = false;
  private activeTab: 'stats' | 'events' = 'stats';

  enter() {
    super.enter();
    const { scoreA, scoreB } = this.game.battleResult;
    const win = scoreA > scoreB;
    if (!this.rewardsGranted) {
      this.game.awardMatchRewards(win);
      void this.game.recordBattleResult();
      this.rewardsGranted = true;
    }
    this.game.sound.play(win ? 'win' : 'lose');
    window.setTimeout(() => this.game.sound.play('reward'), 520);
  }

  protected build() {
    this.container.addChild(this.stadiumBackground());
    this.drawShade();
    this.drawHeader();
    this.drawScoreSummary();
    this.drawTabs();
    if (this.activeTab === 'stats') {
      this.drawStatsPanel();
      this.drawMvpPanel();
      this.drawGoalPanels();
    } else {
      this.drawEventsPanel();
    }
    this.drawActions();
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  private drawShade() {
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020817, alpha: 0.38 });
    this.container.addChild(shade);
  }

  private drawHeader() {
    const title = headerTitleSprite('matchReport', Math.min(300, this.game.width * 0.48));
    title.x = this.game.width / 2 - title.width / 2;
    title.y = 35 + this.topLift();
    this.container.addChild(title);
  }

  private drawScoreSummary() {
    const { scoreA, scoreB } = this.game.battleResult;
    const panel = new Container();
    panel.x = 22;
    panel.y = 108 + this.topLift();
    const w = this.game.width - 44;
    const h = 184;

    panel.addChild(this.panelBg(w, h, 0x06162b, 0x1d75d8, 0.78, 22));

    const myStar = this.starPlayer(this.game.lineup.map((slot) => slot.player));
    const rivalStar = this.starPlayer((this.game.battleSource.opponentLineup ?? []).map((slot) => slot.player));
    this.drawTeamBlock(panel, myStar, 26, 28, true);
    this.drawTeamBlock(panel, rivalStar, w - 186, 28, false);

    const centerX = w / 2;
    const leftScore = label(String(scoreA), 72, 0x3698ff, '900');
    leftScore.anchor.set(1, 0.5);
    leftScore.x = centerX - 28;
    leftScore.y = 86;
    const colon = label(':', 58, palette.white, '900');
    colon.anchor.set(0.5);
    colon.x = centerX;
    colon.y = 84;
    const rightScore = label(String(scoreB), 72, 0xff5d68, '900');
    rightScore.anchor.set(0, 0.5);
    rightScore.x = centerX + 28;
    rightScore.y = 86;

    const scoreBox = new Container();
    scoreBox.x = centerX - 76;
    scoreBox.y = 118;
    const scoreBg = new Graphics();
    scoreBg.roundRect(0, 0, 152, 52, 8);
    scoreBg.fill({ color: 0x07142b, alpha: 0.86 });
    scoreBg.stroke({ color: 0x3275c9, alpha: 0.65, width: 2 });
    const boxTitle = label('全场比分', 19, 0xd9e8ff, '900');
    boxTitle.anchor.set(0.5);
    boxTitle.x = 76;
    boxTitle.y = 17;
    const boxScore = label(`${scoreA}:${scoreB}`, 25, palette.white, '900');
    boxScore.anchor.set(0.5);
    boxScore.x = 76;
    boxScore.y = 39;
    scoreBox.addChild(scoreBg, boxTitle, boxScore);

    panel.addChild(leftScore, colon, rightScore, scoreBox);
    this.container.addChild(panel);
  }

  private drawTabs() {
    const y = 314 + this.topLift();
    const x = 22;
    const w = this.game.width - 44;
    const tabH = 62;
    const bg = new Graphics();
    bg.roundRect(x, y, w, tabH, 14);
    bg.fill({ color: 0x07172d, alpha: 0.86 });
    bg.stroke({ color: 0x185caa, alpha: 0.55, width: 2 });

    const active = new Graphics();
    active.roundRect(this.activeTab === 'stats' ? x : x + w / 2, y, w / 2, tabH, 12);
    active.fill({ color: 0x0a56c7, alpha: 0.92 });
    active.stroke({ color: 0x3aa2ff, alpha: 0.95, width: 2 });

    const stats = label('统计信息', 27, this.activeTab === 'stats' ? palette.white : 0xb8c7dd, '900');
    stats.anchor.set(0.5);
    stats.x = x + w * 0.25;
    stats.y = y + tabH / 2;
    const events = label('比赛事件', 27, this.activeTab === 'events' ? palette.white : 0xb8c7dd, '900');
    events.anchor.set(0.5);
    events.x = x + w * 0.75;
    events.y = y + tabH / 2;

    const statsHit = this.tabHitArea(x, y, w / 2, tabH, 'stats');
    const eventsHit = this.tabHitArea(x + w / 2, y, w / 2, tabH, 'events');
    this.container.addChild(bg, active, stats, events, statsHit, eventsHit);
  }

  private drawStatsPanel() {
    const panel = new Container();
    panel.x = 22;
    panel.y = 392 + this.topLift();
    const w = this.game.width - 44;
    const h = 438;
    panel.addChild(this.panelBg(w, h, 0x061b32, 0x238ce9, 0.82, 16));

    const title = label('全场数据统计', 25, palette.white, '900');
    title.x = 24;
    title.y = 20;
    panel.addChild(title);

    this.statsRows().forEach((row, index) => {
      this.drawStatRow(panel, row, 62 + index * 36, w);
    });
    this.container.addChild(panel);
  }

  private drawMvpPanel() {
    const panel = new Container();
    panel.x = 22;
    panel.y = 846 + this.topLift();
    const w = this.game.width - 44;
    const h = 146;
    panel.addChild(this.panelBg(w, h, 0x061b32, 0x238ce9, 0.82, 14));

    const player = this.starPlayer(this.game.lineup.map((slot) => slot.player));
    const title = label('最佳球员', 24, palette.white, '900');
    title.x = 24;
    title.y = 18;
    const mvp = label('MVP', 22, 0x4b2100, '900');
    const badge = new Graphics();
    badge.roundRect(126, 15, 78, 34, 6);
    badge.fill({ color: 0xffc04d, alpha: 1 });
    badge.stroke({ color: 0xffef9c, alpha: 0.85, width: 2 });
    mvp.anchor.set(0.5);
    mvp.x = 165;
    mvp.y = 32;

    if (player) {
      this.drawRoundAvatar(panel, player, 64, 78, 58, 0x2798ff);
      const name = label(playerDisplayName(player), 27, 0x34a0ff, '900');
      name.x = 216;
      name.y = 54;
      const club = label('🛡 蓝焰俱乐部', 19, 0x19e3ca, '900');
      club.x = 216;
      club.y = 88;
      panel.addChild(name, club);
    }

    const score = label('8.7', 56, 0xffdd8a, '900');
    score.anchor.set(0.5);
    score.x = w - 76;
    score.y = 61;
    const scoreLabel = label('评分', 20, 0xffdd8a, '900');
    scoreLabel.anchor.set(0.5);
    scoreLabel.x = w - 76;
    scoreLabel.y = 104;

    const stats = [
      ['1', '进球'],
      ['1', '助攻'],
      ['3', '关键传球'],
      ['2', '抢断']
    ];
    stats.forEach(([value, name], index) => {
      const x = 250 + index * 88;
      if (index > 0) {
        const line = new Graphics();
        line.rect(x - 22, 88, 1, 34);
        line.fill({ color: 0x2f5a91, alpha: 0.6 });
        panel.addChild(line);
      }
      const v = label(value, 24, palette.white, '900');
      v.anchor.set(0.5);
      v.x = x;
      v.y = 96;
      const n = label(name, 18, 0xc7d6ec, '700');
      n.anchor.set(0.5);
      n.x = x;
      n.y = 122;
      panel.addChild(v, n);
    });

    panel.addChild(title, badge, mvp, score, scoreLabel);
    this.container.addChild(panel);
  }

  private drawGoalPanels() {
    const top = 1010 + this.topLift();
    const gap = 16;
    const x = 22;
    const w = (this.game.width - 44 - gap) / 2;
    const h = 142;
    const goals = this.goalLists();
    this.drawGoalList(x, top, w, h, '⚽', '进球球员', 0x2b9bff, goals.for);
    this.drawGoalList(x + w + gap, top, w, h, '🔴', '失球球员', 0xff4d5f, goals.against);
  }

  private drawEventsPanel() {
    const panel = new Container();
    panel.x = 22;
    panel.y = 392 + this.topLift();
    const w = this.game.width - 44;
    const h = 760;
    panel.addChild(this.panelBg(w, h, 0x061b32, 0x238ce9, 0.82, 16));

    const title = label('比赛事件', 27, palette.white, '900');
    title.x = 26;
    title.y = 22;
    panel.addChild(title);

    const events = this.matchEvents().slice(0, 10);
    const line = new Graphics();
    line.rect(80, 82, 3, Math.max(0, events.length * 62 - 30));
    line.fill({ color: 0x1f67b9, alpha: 0.52 });
    panel.addChild(line);

    events.forEach((event, index) => {
      const y = 74 + index * 62;
      const color = event.mood === 'bad' ? 0xff5362 : event.mood === 'good' ? 0x2f95ff : 0xffd35d;
      const dot = new Graphics();
      dot.circle(81, y + 15, 18);
      dot.fill({ color: 0x071329, alpha: 1 });
      dot.stroke({ color, alpha: 0.96, width: 3 });
      const icon = label(this.eventIcon(event), 18, color, '900');
      icon.anchor.set(0.5);
      icon.x = 81;
      icon.y = y + 15;

      const time = label(`${event.time}'`, 25, color, '900');
      time.anchor.set(1, 0);
      time.x = 58;
      time.y = y + 2;

      const tag = label(this.eventTag(event), 18, color, '900');
      tag.x = 118;
      tag.y = y;
      const text = label(event.text, 21, 0xdbe7ff, '700');
      text.x = 118;
      text.y = y + 28;

      if (event.scoreA !== undefined && event.scoreB !== undefined && (event.text.includes('破门') || event.text.includes('扳回'))) {
        const score = label(`${event.scoreA}:${event.scoreB}`, 24, color, '900');
        score.anchor.set(1, 0);
        score.x = w - 34;
        score.y = y + 14;
        panel.addChild(score);
      }

      const divider = new Graphics();
      divider.rect(116, y + 57, w - 150, 1);
      divider.fill({ color: 0x21466f, alpha: 0.45 });
      panel.addChild(dot, icon, time, tag, text, divider);
    });

    this.container.addChild(panel);
  }

  private drawActions() {
    const y = Math.max(1178 + this.topLift() * 0.15, this.game.height - 112);
    const back = this.actionButton(248, 74, '返回大厅', 0x0b62d8, 0x2aa0ff, false);
    back.x = 82;
    back.y = y;
    back.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('home');
    });

    const next = this.actionButton(248, 74, '继续比赛', 0xffc341, 0xfff0a2, true);
    next.x = this.game.width - 82 - 248;
    next.y = y;
    next.on('pointertap', () => {
      this.game.sound.play('confirm');
      this.game.prepareOpponent();
      this.game.changeScene('matchup');
    });

    this.container.addChild(back, next);
  }

  private drawTeamBlock(parent: Container, player: PlayerCardData | undefined, x: number, y: number, mine: boolean) {
    const avatarX = mine ? x : x + 86;
    const textX = mine ? x + 112 : x + 72;
    if (player) this.drawFramedAvatar(parent, player, avatarX, y, mine ? 0x24a6ff : 0xffc64d);

    const team = label(mine ? '我方球队' : '对手球队', 26, palette.white, '900');
    team.x = textX;
    team.y = y + 10;
    const club = label(mine ? '蓝焰俱乐部' : this.game.battleSource.opponentName, 20, mine ? 0x20d9ff : 0xff575f, '900');
    club.x = textX;
    club.y = y + 48;
    const role = label(mine ? '🛡 本地经理' : 'AI  AI智能', 17, mine ? 0x11e3c6 : 0xdbe7ff, '900');
    role.x = textX;
    role.y = y + 82;
    if (!mine) {
      team.anchor.set(1, 0);
      club.anchor.set(1, 0);
      role.anchor.set(1, 0);
    }
    parent.addChild(team, club, role);
  }

  private drawFramedAvatar(parent: Container, player: PlayerCardData, x: number, y: number, color: number) {
    const size = 94;
    const frame = new Graphics();
    frame.roundRect(x, y, size, size, 12);
    frame.fill({ color: 0x071329, alpha: 0.88 });
    frame.stroke({ color, alpha: 0.96, width: 4 });

    const sprite = new Sprite(Texture.from(player.portrait));
    sprite.x = x + 9;
    sprite.y = y + 9;
    sprite.width = size - 18;
    sprite.height = size - 18;

    const rating = this.ratingChip(player.rating, x - 9, y + 4);
    parent.addChild(frame, sprite, rating);
  }

  private drawRoundAvatar(parent: Container, player: PlayerCardData, x: number, y: number, size: number, color: number) {
    const glow = new Graphics();
    glow.circle(x + size / 2, y + size / 2, size / 2 + 13);
    glow.fill({ color, alpha: 0.18 });
    glow.stroke({ color, alpha: 0.86, width: 3 });
    const bg = new Graphics();
    bg.circle(x + size / 2, y + size / 2, size / 2 + 3);
    bg.fill({ color: 0x07142a, alpha: 1 });
    bg.stroke({ color, alpha: 0.82, width: 3 });
    const sprite = new Sprite(Texture.from(player.portrait));
    sprite.x = x;
    sprite.y = y;
    sprite.width = size;
    sprite.height = size;
    parent.addChild(glow, bg, sprite);
  }

  private drawStatRow(parent: Container, row: StatRow, y: number, w: number) {
    const divider = new Graphics();
    divider.rect(24, y + 30, w - 48, 1);
    divider.fill({ color: 0x21466f, alpha: 0.6 });

    const leftValue = label(row.left, 25, 0x2e98ff, '900');
    leftValue.x = 30;
    leftValue.y = y - 8;
    const rightValue = label(row.right, 25, 0xff5362, '900');
    rightValue.anchor.set(1, 0);
    rightValue.x = w - 30;
    rightValue.y = y - 8;

    this.progressBar(parent, 118, y + 5, 168, 10, row.leftValue, row.leftValue + row.rightValue, 0x2f95ff);
    this.progressBar(parent, w - 286, y + 5, 168, 10, row.rightValue, row.leftValue + row.rightValue, 0xff4f62);

    const icon = label(row.icon, 20, 0xdbe8ff, '900');
    icon.anchor.set(0.5);
    icon.x = w / 2 - 34;
    icon.y = y + 10;
    const name = label(row.name, 21, 0xd9e4f4, '900');
    name.anchor.set(0.5);
    name.x = w / 2 + 30;
    name.y = y + 10;

    parent.addChild(divider, leftValue, rightValue, icon, name);
  }

  private drawGoalList(x: number, y: number, w: number, h: number, iconText: string, titleText: string, color: number, rows: Array<{ time: string; name: string; player?: PlayerCardData }>) {
    const panel = new Container();
    panel.x = x;
    panel.y = y;
    panel.addChild(this.panelBg(w, h, 0x061b32, 0x238ce9, 0.78, 12));
    const icon = label(iconText, 27);
    icon.x = 22;
    icon.y = 16;
    const title = label(titleText, 23, palette.white, '900');
    title.x = 58;
    title.y = 20;
    panel.addChild(icon, title);

    rows.slice(0, 3).forEach((row, index) => {
      const yy = 58 + index * 27;
      const time = label(row.time, 22, color, '900');
      time.x = 28;
      time.y = yy;
      if (row.player) this.drawTinyAvatar(panel, row.player, 92, yy - 2, color);
      const displayName = row.name.length > 7 ? `${row.name.slice(0, 6)}...` : row.name;
      const name = label(displayName, 20, 0xd8e4f8, '700');
      name.x = 132;
      name.y = yy + 1;
      const maxNameWidth = Math.max(64, w - 146);
      if (name.width > maxNameWidth) name.scale.x = maxNameWidth / name.width;
      panel.addChild(time, name);
    });
    this.container.addChild(panel);
  }

  private drawTinyAvatar(parent: Container, player: PlayerCardData, x: number, y: number, color: number) {
    const bg = new Graphics();
    bg.circle(x + 13, y + 13, 15);
    bg.fill({ color: 0x071329, alpha: 1 });
    bg.stroke({ color, alpha: 0.9, width: 2 });
    const sprite = new Sprite(Texture.from(player.portrait));
    sprite.x = x;
    sprite.y = y;
    sprite.width = 26;
    sprite.height = 26;
    parent.addChild(bg, sprite);
  }

  private ratingChip(value: number, x: number, y: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.circle(0, 0, 19);
    bg.fill({ color: 0xf2f7ff, alpha: 1 });
    bg.stroke({ color: 0xb7c4d5, alpha: 0.9, width: 2 });
    const text = label(String(value), 18, 0x111827, '900');
    text.anchor.set(0.5);
    c.x = x + 19;
    c.y = y + 19;
    c.addChild(bg, text);
    return c;
  }

  private progressBar(parent: Container, x: number, y: number, w: number, h: number, value: number, total: number, color: number) {
    const track = new Graphics();
    track.roundRect(x, y, w, h, h / 2);
    track.fill({ color: 0x213b5d, alpha: 0.9 });
    const fill = new Graphics();
    fill.roundRect(x, y, Math.max(h, (w * value) / Math.max(1, total)), h, h / 2);
    fill.fill({ color, alpha: 1 });
    parent.addChild(track, fill);
  }

  private tabHitArea(x: number, y: number, width: number, height: number, tab: 'stats' | 'events') {
    const hit = new Graphics();
    hit.roundRect(x, y, width, height, 12);
    hit.fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointertap', () => {
      if (this.activeTab === tab) return;
      this.game.sound.play('tap');
      this.activeTab = tab;
      this.resize();
    });
    return hit;
  }

  private actionButton(width: number, height: number, text: string, fill: number, stroke: number, gold: boolean) {
    const button = new Container();
    const glow = new Graphics();
    glow.roundRect(-8, -8, width + 16, height + 16, 12);
    glow.fill({ color: fill, alpha: 0.22 });
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 8);
    bg.fill({ color: fill, alpha: 0.96 });
    bg.stroke({ color: stroke, alpha: 0.95, width: 3 });
    const top = new Graphics();
    top.roundRect(8, 8, width - 16, height * 0.34, 8);
    top.fill({ color: 0xffffff, alpha: gold ? 0.22 : 0.1 });
    const title = label(text, 30, gold ? 0x452600 : palette.white, '900');
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = height / 2 + 1;
    button.addChild(glow, bg, top, title);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    return button;
  }

  private panelBg(width: number, height: number, fill: number, stroke: number, alpha: number, radius: number) {
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, radius);
    bg.fill({ color: fill, alpha });
    bg.stroke({ color: stroke, alpha: 0.76, width: 2 });
    const inner = new Graphics();
    inner.roundRect(4, 4, width - 8, height - 8, Math.max(4, radius - 4));
    inner.stroke({ color: 0xffffff, alpha: 0.08, width: 1 });
    const c = new Container();
    c.addChild(bg, inner);
    return c;
  }

  private statsRows(): StatRow[] {
    return [
      { icon: '●', name: '控球率', left: '62%', right: '38%', leftValue: 62, rightValue: 38 },
      { icon: '⊕', name: '射门', left: '14', right: '6', leftValue: 14, rightValue: 6 },
      { icon: '⊕', name: '射正', left: '8', right: '3', leftValue: 8, rightValue: 3 },
      { icon: '⌁', name: '传球成功率', left: '89%', right: '78%', leftValue: 89, rightValue: 78 },
      { icon: '⚑', name: '角球', left: '5', right: '2', leftValue: 5, rightValue: 2 },
      { icon: '⚑', name: '越位', left: '2', right: '1', leftValue: 2, rightValue: 1 },
      { icon: '□', name: '抢断', left: '12', right: '8', leftValue: 12, rightValue: 8 },
      { icon: '▰', name: '犯规', left: '7', right: '11', leftValue: 7, rightValue: 11 },
      { icon: '■', name: '黄牌', left: '1', right: '3', leftValue: 1, rightValue: 3 },
      { icon: '■', name: '红牌', left: '0', right: '0', leftValue: 0, rightValue: 0 }
    ];
  }

  private matchEvents() {
    const events = [...this.game.battleResult.events].sort((a, b) => b.time - a.time);
    if (events.length) return events;
    return [
      { time: 82, text: '林浩 接到罗德里的传球，冷静推射破门！', scoreA: 3, scoreB: 1, mood: 'good' as const },
      { time: 68, text: '苏亚雷斯 反击打穿防线，为星火十一人扳回一球。', scoreA: 2, scoreB: 1, mood: 'bad' as const },
      { time: 58, text: '罗德里 完成关键拦截，稳住中场节奏。', scoreA: 2, scoreB: 0, mood: 'good' as const },
      { time: 21, text: '罗德里 前插接应，扩大领先优势。', scoreA: 2, scoreB: 0, mood: 'good' as const }
    ];
  }

  private eventTag(event: BattleEvent) {
    if (event.text.includes('破门') || event.text.includes('扳回')) return '进球';
    if (event.text.includes('拦截') || event.text.includes('抢断')) return '抢断';
    if (event.text.includes('犯规')) return '犯规';
    if (event.text.includes('机会') || event.text.includes('射')) return '射门';
    return event.mood === 'bad' ? '危险' : '事件';
  }

  private eventIcon(event: BattleEvent) {
    const tag = this.eventTag(event);
    if (tag === '进球') return '●';
    if (tag === '抢断') return '□';
    if (tag === '犯规') return '!';
    if (tag === '射门') return '↗';
    return '•';
  }

  private goalLists() {
    const events = [...this.game.battleResult.events].sort((a, b) => a.time - b.time);
    const mine = this.game.lineup.map((slot) => slot.player).filter(Boolean) as PlayerCardData[];
    const rivals = (this.game.battleSource.opponentLineup ?? []).map((slot) => slot.player).filter(Boolean) as PlayerCardData[];
    const fallbackMine = [mine[2], mine[5], mine[1]].filter(Boolean) as PlayerCardData[];
    const fallbackRival = [rivals[2] ?? rivals[0]].filter(Boolean) as PlayerCardData[];

    const forGoals = this.goalEvents(events, true).slice(0, 3).map((event, index) => ({
      time: `${event.time}'`,
      name: this.eventPlayerName(event.text) ?? playerDisplayName(fallbackMine[index]) ?? '林浩',
      player: fallbackMine[index] ?? fallbackMine[0]
    }));
    const againstGoals = this.goalEvents(events, false).slice(0, 3).map((event, index) => ({
      time: `${event.time}'`,
      name: this.eventPlayerName(event.text) ?? playerDisplayName(fallbackRival[index]) ?? '罗一鸣',
      player: fallbackRival[index] ?? fallbackRival[0]
    }));

    return {
      for: forGoals.length
        ? forGoals
        : [
            { time: "12'", name: playerDisplayName(fallbackMine[0]) ?? '赵启航', player: fallbackMine[0] },
            { time: "68'", name: playerDisplayName(fallbackMine[1]) ?? '苏锋', player: fallbackMine[1] },
            { time: "82'", name: playerDisplayName(fallbackMine[2]) ?? '林浩', player: fallbackMine[2] }
          ],
      against: againstGoals.length
        ? againstGoals
        : [{ time: "45'", name: playerDisplayName(fallbackRival[0]) ?? '罗一鸣', player: fallbackRival[0] }]
    };
  }

  private goalEvents(events: BattleEvent[], mine: boolean) {
    let previousA = 0;
    let previousB = 0;
    const result: BattleEvent[] = [];
    events.forEach((event) => {
      if (mine && event.scoreA > previousA) result.push(event);
      if (!mine && event.scoreB > previousB) result.push(event);
      previousA = event.scoreA;
      previousB = event.scoreB;
    });
    return result;
  }

  private eventPlayerName(text: string) {
    const first = text.trim().split(/[\s，,。.!！]/)[0];
    if (!first || first.length > 5) return undefined;
    if (/禁区|破门|推射|反击|扳回|扩大|抢点|远射|头球|射门|传球|通过/.test(first)) return undefined;
    return playerDisplayName(first);
  }

  private starPlayer(players: Array<PlayerCardData | undefined>) {
    return players.filter(Boolean).sort((a, b) => (b?.rating ?? 0) - (a?.rating ?? 0))[0];
  }

  private topLift() {
    return this.game.contentTopOffset * 0.18;
  }
}
