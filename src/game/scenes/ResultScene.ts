import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { headerTitleSprite, label, palette } from '../ui';
import type { BattleEvent, PlayerCardData } from '../types';
import { playerDisplayName } from '../playerNames';

const HOME_ACCENT = 0x2f8cff;
const OPPONENT_ACCENT = 0xff465d;

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
      this.drawReportTimeline();
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
    panel.y = 112 + this.topLift();
    const w = this.game.width - 44;
    const h = 178;

    const soft = new Graphics();
    soft.roundRect(0, 0, w, h, 20);
    soft.fill({ color: 0x020817, alpha: 0.18 });
    panel.addChild(soft);

    const logoSize = 96;
    const logoCenterY = 52;
    const leftX = 86;
    const rightX = w - 86;

    const leftLogo = this.teamLogo(logoSize, HOME_ACCENT, 0x16e2ff, '蓝');
    leftLogo.x = leftX;
    leftLogo.y = logoCenterY;
    const leftTitle = label('我方球队', 27, palette.white, '900');
    leftTitle.anchor.set(0.5);
    leftTitle.x = leftX;
    leftTitle.y = logoCenterY + logoSize / 2 + 26;
    const leftClub = label('蓝焰俱乐部', 19, 0x2ee6d6, '900');
    leftClub.anchor.set(0.5);
    leftClub.x = leftX;
    leftClub.y = leftTitle.y + 34;

    const rightLogo = this.teamLogo(logoSize, OPPONENT_ACCENT, 0xff5d68, 'AI');
    rightLogo.x = rightX;
    rightLogo.y = logoCenterY;
    const rightTitle = label('对手球队', 27, palette.white, '900');
    rightTitle.anchor.set(0.5);
    rightTitle.x = rightX;
    rightTitle.y = leftTitle.y;
    const rightClub = label(this.game.battleSource.opponentName, 19, 0xfff1a8, '900');
    rightClub.anchor.set(0.5);
    rightClub.x = rightX;
    rightClub.y = leftClub.y;

    panel.addChild(leftLogo, leftTitle, leftClub, rightLogo, rightTitle, rightClub);

    const centerX = w / 2;
    const leftScore = label(String(scoreA), 84, 0x2f8cff, '900');
    leftScore.anchor.set(1, 0.5);
    leftScore.x = centerX - 38;
    leftScore.y = 82;
    const colon = label(':', 68, palette.white, '900');
    colon.anchor.set(0.5);
    colon.x = centerX;
    colon.y = 80;
    const rightScore = label(String(scoreB), 84, 0xff5d68, '900');
    rightScore.anchor.set(0, 0.5);
    rightScore.x = centerX + 38;
    rightScore.y = 82;

    const end = this.matchEndBadge(154, 42);
    end.x = centerX - 77;
    end.y = 124;

    panel.addChild(leftScore, colon, rightScore, end);
    this.container.addChild(panel);
  }

  private teamLogo(size: number, accent: number, secondary: number, mark: string) {
    const c = new Container();
    const frame = new Graphics();
    frame.roundRect(-size / 2, -size / 2, size, size, 18);
    frame.fill({ color: 0x071735, alpha: 0.96 });
    frame.stroke({ color: accent, alpha: 0.96, width: 5 });
    const glow = new Graphics();
    glow.roundRect(-size / 2 + 8, -size / 2 + 8, size - 16, size - 16, 14);
    glow.stroke({ color: secondary, alpha: 0.35, width: 2 });
    const shield = new Graphics();
    shield.poly([0, -size * 0.3, size * 0.28, -size * 0.18, size * 0.2, size * 0.22, 0, size * 0.34, -size * 0.2, size * 0.22, -size * 0.28, -size * 0.18]);
    shield.fill({ color: accent, alpha: 0.92 });
    shield.stroke({ color: 0xffffff, alpha: 0.65, width: 2 });
    const stripe = new Graphics();
    stripe.poly([-size * 0.2, -size * 0.08, size * 0.18, -size * 0.2, size * 0.12, -size * 0.05, -size * 0.22, size * 0.08]);
    stripe.fill({ color: secondary, alpha: 0.95 });
    const text = label(mark, mark.length > 1 ? 24 : 34, 0xffffff, '900');
    text.anchor.set(0.5);
    text.y = size * 0.02;
    c.addChild(frame, glow, shield, stripe, text);
    return c;
  }

  private drawTabs() {
    const y = 316 + this.topLift();
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
    const rows = this.statsRows();
    const rowH = 62;
    const startY = 24;
    const h = startY + rows.length * rowH + 18;
    panel.addChild(this.panelBg(w, h, 0x041229, 0x238ce9, 0.92, 16));

    rows.forEach((row, index) => {
      this.drawStatRow(panel, row, startY + index * rowH, w, index < rows.length - 1);
    });
    this.container.addChild(panel);
  }

  private drawMvpPanel() {
    const panel = new Container();
    panel.x = 22;
    panel.y = 824 + this.topLift();
    const w = this.game.width - 44;
    const h = 144;
    panel.addChild(this.panelBg(w, h, 0x061b32, 0x238ce9, 0.82, 14));

    const player = this.starPlayer(this.game.lineup.map((slot) => slot.player));
    const mvpBlock = new Graphics();
    mvpBlock.roundRect(0, 0, 94, h, 12);
    mvpBlock.fill({ color: 0x08224c, alpha: 0.86 });
    const trophy = label('♛', 33, 0xffd755, '900');
    trophy.anchor.set(0.5);
    trophy.x = 47;
    trophy.y = 42;
    const mvp = label('MVP', 25, 0xffd755, '900');
    mvp.anchor.set(0.5);
    mvp.x = 47;
    mvp.y = 87;
    panel.addChild(mvpBlock, trophy, mvp);

    if (player) {
      this.drawRoundAvatar(panel, player, 118, 29, 84, 0x2798ff);
      const name = label(playerDisplayName(player), 31, palette.white, '900');
      name.x = 226;
      name.y = 40;
      const club = label('蓝焰俱乐部', 20, 0x23d9ff, '900');
      club.x = 226;
      club.y = 84;
      panel.addChild(name, club);
    }

    const scoreCircle = new Graphics();
    scoreCircle.circle(0, 0, 48);
    scoreCircle.fill({ color: 0x08204a, alpha: 0.94 });
    scoreCircle.stroke({ color: 0x1e69ad, alpha: 0.82, width: 2 });
    scoreCircle.x = w - 264;
    scoreCircle.y = 72;
    panel.addChild(scoreCircle);
    const score = label('8.7', 42, 0xffdd8a, '900');
    score.anchor.set(0.5);
    score.x = w - 264;
    score.y = 61;
    const scoreLabel = label('评分', 20, 0xffdd8a, '900');
    scoreLabel.anchor.set(0.5);
    scoreLabel.x = w - 264;
    scoreLabel.y = 91;

    const stats = [
      ['⚽', '1', '进球'],
      ['⚑', '1', '助攻']
    ];
    stats.forEach(([iconText, value, name], index) => {
      const x = w - 156 + index * 92;
      if (index > 0) {
        const line = new Graphics();
        line.rect(x - 46, 40, 1, 76);
        line.fill({ color: 0x2f5a91, alpha: 0.6 });
        panel.addChild(line);
      }
      const icon = label(iconText, 24, 0xdbe7ff, '900');
      icon.anchor.set(0.5);
      icon.x = x - 22;
      icon.y = 58;
      const v = label(value, 27, palette.white, '900');
      v.anchor.set(0, 0.5);
      v.x = x;
      v.y = 58;
      const n = label(name, 18, 0xc7d6ec, '700');
      n.anchor.set(0.5);
      n.x = x - 2;
      n.y = 92;
      panel.addChild(icon, v, n);
    });

    panel.addChild(score, scoreLabel);
    this.container.addChild(panel);
  }

  private drawReportTimeline() {
    const panel = new Container();
    panel.x = 22;
    panel.y = 984 + this.topLift();
    const w = this.game.width - 44;
    const events = this.reportEvents();
    const rowH = 62;
    const headerH = 52;
    const h = headerH + events.length * rowH + 24;
    panel.addChild(this.panelBg(w, h, 0x041229, 0x238ce9, 0.88, 14));

    this.drawSectionTitle(panel, w / 2, 26, '关键事件', w);

    const centerX = w / 2;
    const startY = headerH + 8;
    const axis = new Graphics();
    axis.rect(centerX - 1, startY, 2, Math.max(rowH, events.length * rowH - 8));
    axis.fill({ color: 0x3aa2ff, alpha: 0.42 });
    panel.addChild(axis);

    events.forEach((event, index) => {
      const y = startY + index * rowH;
      const nodeY = y + rowH / 2 - 2;
      const homeSide = this.eventTeamSide(event) === 'home';
      const color = this.eventTimelineColor(event, homeSide);
      const iconOffset = 50;
      const textGap = 74;
      const maxTextW = centerX - textGap - 16;

      this.drawTimelineConnector(panel, centerX, nodeY, homeSide, color, iconOffset - 4);

      const dot = new Graphics();
      dot.circle(centerX, nodeY, 15);
      dot.fill({ color: 0x06152d, alpha: 1 });
      dot.stroke({ color, alpha: 0.96, width: 2.5 });
      const time = label(`${event.time}'`, 13, color, '900');
      time.anchor.set(0.5);
      time.x = centerX;
      time.y = nodeY - 1;

      const icon = label(this.eventTimelineIcon(event), 17, this.eventTimelineIconColor(event), '900');
      icon.anchor.set(0.5);
      icon.x = homeSide ? centerX - iconOffset : centerX + iconOffset;
      icon.y = nodeY;

      const headline = label(`${this.eventActorName(event)} ${this.eventTag(event)}`, 19, palette.white, '900');
      const detail = label(this.eventTimelineDetail(event), 15, 0xa8bdd9, '700');
      const textEdge = homeSide ? centerX - textGap : centerX + textGap;

      if (homeSide) {
        headline.anchor.set(1, 0);
        headline.x = textEdge;
        headline.y = nodeY - 16;
        detail.anchor.set(1, 0);
        detail.x = textEdge;
        detail.y = nodeY + 4;
      } else {
        headline.anchor.set(0, 0);
        headline.x = textEdge;
        headline.y = nodeY - 16;
        detail.anchor.set(0, 0);
        detail.x = textEdge;
        detail.y = nodeY + 4;
      }
      if (headline.width > maxTextW) headline.scale.x = maxTextW / headline.width;
      if (detail.width > maxTextW) detail.scale.x = maxTextW / detail.width;

      panel.addChild(dot, time, icon, headline, detail);
    });

    this.container.addChild(panel);
  }

  private drawSectionTitle(parent: Container, centerX: number, y: number, text: string, panelW: number) {
    const title = label(text, 24, palette.white, '900');
    title.anchor.set(0.5);
    title.x = centerX;
    title.y = y;

    const lineW = Math.min(110, panelW * 0.16);
    const gap = title.width / 2 + 14;
    const leftLine = new Graphics();
    leftLine.moveTo(centerX - gap - lineW, y + 2);
    leftLine.lineTo(centerX - gap, y + 2);
    leftLine.stroke({ color: 0x3aa2ff, alpha: 0.55, width: 1.5 });
    const rightLine = new Graphics();
    rightLine.moveTo(centerX + gap, y + 2);
    rightLine.lineTo(centerX + gap + lineW, y + 2);
    rightLine.stroke({ color: 0x3aa2ff, alpha: 0.55, width: 1.5 });

    const leftDot = new Graphics();
    leftDot.circle(centerX - gap - lineW, y + 2, 3);
    leftDot.fill({ color: 0x3aa2ff, alpha: 0.8 });
    const rightDot = new Graphics();
    rightDot.circle(centerX + gap + lineW, y + 2, 3);
    rightDot.fill({ color: 0x3aa2ff, alpha: 0.8 });

    parent.addChild(leftLine, rightLine, leftDot, rightDot, title);
  }

  private drawEventsPanel() {
    const panel = new Container();
    panel.x = 22;
    panel.y = 392 + this.topLift();
    const w = this.game.width - 44;
    const h = 760;
    panel.addChild(this.panelBg(w, h, 0x041229, 0x238ce9, 0.92, 16));

    const title = label('比赛事件', 28, palette.white, '900');
    title.x = 28;
    title.y = 24;
    panel.addChild(title);

    const events = this.timelineEvents();
    const centerX = w / 2;
    const rowH = 74;
    const startY = 70;
    const axisHeight = Math.max(rowH, events.length * rowH - 10);

    const axis = new Graphics();
    axis.rect(centerX - 1, startY, 2, axisHeight);
    axis.fill({ color: 0x3aa2ff, alpha: 0.42 });
    panel.addChild(axis);

    events.forEach((event, index) => {
      const y = startY + index * rowH;
      const nodeY = y + rowH / 2 - 2;
      const homeSide = this.eventTeamSide(event) === 'home';
      const color = this.eventTimelineColor(event, homeSide);
      const iconOffset = 56;
      const textGap = 82;
      const maxTextW = centerX - textGap - 18;

      this.drawTimelineConnector(panel, centerX, nodeY, homeSide, color, iconOffset - 6);

      const dot = new Graphics();
      dot.circle(centerX, nodeY, 18);
      dot.fill({ color: 0x06152d, alpha: 1 });
      dot.stroke({ color, alpha: 0.96, width: 2.5 });
      const time = label(`${event.time}'`, 14, color, '900');
      time.anchor.set(0.5);
      time.x = centerX;
      time.y = nodeY - 1;

      const icon = label(this.eventTimelineIcon(event), 19, this.eventTimelineIconColor(event), '900');
      icon.anchor.set(0.5);
      icon.x = homeSide ? centerX - iconOffset : centerX + iconOffset;
      icon.y = nodeY;

      const actor = this.eventActorName(event);
      const tag = this.eventTag(event);
      const headline = label(`${actor} ${tag}`, 21, palette.white, '900');
      const detail = label(this.eventTimelineDetail(event), 16, 0xa8bdd9, '700');
      const textEdge = homeSide ? centerX - textGap : centerX + textGap;

      if (homeSide) {
        headline.anchor.set(1, 0);
        headline.x = textEdge;
        headline.y = nodeY - 18;
        detail.anchor.set(1, 0);
        detail.x = textEdge;
        detail.y = nodeY + 5;
      } else {
        headline.anchor.set(0, 0);
        headline.x = textEdge;
        headline.y = nodeY - 18;
        detail.anchor.set(0, 0);
        detail.x = textEdge;
        detail.y = nodeY + 5;
      }
      if (headline.width > maxTextW) headline.scale.x = maxTextW / headline.width;
      if (detail.width > maxTextW) detail.scale.x = maxTextW / detail.width;

      panel.addChild(dot, time, icon, headline, detail);

      if (this.isGoalEvent(event)) {
        const score = label(`${event.scoreA}:${event.scoreB}`, 24, color, '900');
        score.anchor.set(homeSide ? 0 : 1, 0.5);
        score.x = homeSide ? 22 : w - 22;
        score.y = nodeY;
        panel.addChild(score);
      }
    });

    this.container.addChild(panel);
  }

  private timelineEvents() {
    return this.matchEvents()
      .filter((event) => event.title !== '全场比赛结束' && event.eventType !== 'fulltime')
      .slice(0, 12);
  }

  private eventTimelineColor(event: BattleEvent, homeSide: boolean) {
    if (this.isCardEvent(event)) return 0xffd632;
    return homeSide ? HOME_ACCENT : OPPONENT_ACCENT;
  }

  private isCardEvent(event: BattleEvent) {
    const tag = this.eventTag(event);
    return tag === '犯规' || event.eventType === 'yellow' || event.eventType === 'red';
  }

  private eventTimelineIconColor(event: BattleEvent) {
    if (this.isCardEvent(event)) return 0xffd632;
    return palette.white;
  }

  private drawTimelineConnector(parent: Container, centerX: number, nodeY: number, homeSide: boolean, color: number, length = 50) {
    const connector = new Graphics();
    const endX = homeSide ? centerX - length : centerX + length;
    connector.moveTo(centerX, nodeY);
    connector.lineTo(endX, nodeY);
    connector.stroke({ color, alpha: 0.38, width: 1.5 });
    parent.addChild(connector);
  }

  private eventTeamSide(event: BattleEvent): 'home' | 'away' {
    if (event.team === 'away') return 'away';
    if (event.team === 'home') return 'home';
    if (event.mood === 'bad' && /对手|扳回|反击|对方/.test(event.text)) return 'away';
    return 'home';
  }

  private eventTimelineIcon(event: BattleEvent) {
    const tag = this.eventTag(event);
    if (tag === '神仙球') return '✨';
    if (tag === '任意球') return '🎯';
    if (tag === '进球') return '⚽';
    if (tag === '犯规') return '▮';
    if (tag === '角球') return '⚑';
    if (tag === '扑救') return '🧤';
    if (tag === '射门') return '↗';
    if (tag === '换人') return '⇄';
    if (tag === '受伤') return '✚';
    return '•';
  }

  private eventTimelineDetail(event: BattleEvent) {
    const tag = this.eventTag(event);
    if (tag === '进球' || tag === '神仙球') {
      const assist = event.relatedActors?.find((name) => playerDisplayName(name) !== this.eventActorName(event));
      if (assist) return `助攻：${playerDisplayName(assist)}`;
    }
    if (tag === '换人' && event.text.includes('下') && event.text.includes('上')) return event.text;
    const text = event.text.trim();
    if (!text) return '';
    if (text.length > 32) return `${text.slice(0, 31)}...`;
    return text;
  }

  private isGoalEvent(event: BattleEvent) {
    if (event.scoreA === undefined || event.scoreB === undefined) return false;
    if (event.eventType === 'goal' || event.eventType === 'wondergoal') return true;
    if (event.eventType === 'freekick' && /破门|入网|直挂|死角|轰|得分/.test(event.text)) return true;
    return this.eventTag(event) === '进球';
  }

  private drawActions() {
    const y = Math.max(1206 + this.topLift() * 0.15, this.game.height - 112);
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

  private drawStatRow(parent: Container, row: StatRow, y: number, w: number, showDivider: boolean) {
    const padX = 28;
    const barX = padX;
    const barW = w - padX * 2;
    const barH = 12;
    const valueY = y + 2;
    const barY = y + 36;
    const centerY = y + 14;

    if (showDivider) {
      const divider = new Graphics();
      divider.rect(padX, y + 58, barW, 1);
      divider.fill({ color: 0x15345a, alpha: 0.85 });
      parent.addChild(divider);
    }

    const leftValue = label(row.left, 34, HOME_ACCENT, '900');
    leftValue.x = padX;
    leftValue.y = valueY;

    const rightValue = label(row.right, 34, OPPONENT_ACCENT, '900');
    rightValue.anchor.set(1, 0);
    rightValue.x = w - padX;
    rightValue.y = valueY;

    const center = new Container();
    center.x = w / 2;
    center.y = centerY;
    const icon = label(row.icon, 21, 0xe8f2ff, '900');
    icon.anchor.set(1, 0.5);
    icon.x = -6;
    const name = label(row.name, 20, 0xd9e4f4, '700');
    name.anchor.set(0, 0.5);
    name.x = 6;
    center.addChild(icon, name);

    this.drawComparisonBar(parent, barX, barY, barW, barH, row.leftValue, row.rightValue);

    parent.addChild(leftValue, rightValue, center);
  }

  private drawComparisonBar(parent: Container, x: number, y: number, w: number, h: number, leftVal: number, rightVal: number) {
    const total = Math.max(1, leftVal + rightVal);
    const leftShare = leftVal / total;
    const leftW = Math.max(h, w * leftShare);
    const rightW = Math.max(h, w - leftW);
    const leftPct = Math.round(leftShare * 100);
    const rightPct = 100 - leftPct;
    const radius = h / 2;

    const track = new Graphics();
    track.roundRect(x, y, w, h, radius);
    track.fill({ color: 0x0a1e3a, alpha: 0.96 });
    track.stroke({ color: 0x143258, alpha: 0.65, width: 1 });

    const leftFill = new Graphics();
    if (leftW >= w - 1) {
      leftFill.roundRect(x, y, leftW, h, radius);
    } else if (leftW <= radius * 2) {
      leftFill.roundRect(x, y, leftW, h, radius);
    } else {
      leftFill.roundRect(x, y, leftW, h, radius);
      leftFill.rect(x + leftW - radius, y, radius, h);
    }
    leftFill.fill({ color: HOME_ACCENT, alpha: 0.96 });

    const rightFill = new Graphics();
    const rightX = x + leftW;
    if (rightW >= w - 1) {
      rightFill.roundRect(rightX, y, rightW, h, radius);
    } else if (rightW <= radius * 2) {
      rightFill.roundRect(rightX, y, rightW, h, radius);
    } else {
      rightFill.rect(rightX, y, radius, h);
      rightFill.roundRect(rightX, y, rightW, h, radius);
    }
    rightFill.fill({ color: OPPONENT_ACCENT, alpha: 0.96 });

    parent.addChild(track, leftFill, rightFill);

    if (leftW >= 34) {
      const leftLabel = label(`${leftPct}%`, 11, 0xffffff, '900');
      leftLabel.anchor.set(0.5);
      leftLabel.x = x + leftW / 2;
      leftLabel.y = y + h / 2 + 1;
      parent.addChild(leftLabel);
    }
    if (rightW >= 34) {
      const rightLabel = label(`${rightPct}%`, 11, 0xffffff, '900');
      rightLabel.anchor.set(0.5);
      rightLabel.x = rightX + rightW / 2;
      rightLabel.y = y + h / 2 + 1;
      parent.addChild(rightLabel);
    }
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

  private matchEndBadge(width: number, height: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 8);
    bg.fill({ color: 0x071936, alpha: 0.9 });
    bg.stroke({ color: 0x1d75d8, alpha: 0.92, width: 2 });
    const shine = new Graphics();
    shine.moveTo(18, 0);
    shine.lineTo(width - 18, 0);
    shine.lineTo(width - 32, 8);
    shine.lineTo(32, 8);
    shine.fill({ color: 0x2d9cff, alpha: 0.18 });
    const text = label('全场结束', 22, palette.white, '900');
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2 + 1;
    c.addChild(bg, shine, text);
    return c;
  }

  private statsRows(): StatRow[] {
    const derived = this.deriveMatchStats();
    return [
      { icon: '⚽', name: '控球率', left: `${derived.possessionHome}%`, right: `${derived.possessionAway}%`, leftValue: derived.possessionHome, rightValue: derived.possessionAway },
      { icon: '◎', name: '射门', left: String(derived.shotsHome), right: String(derived.shotsAway), leftValue: derived.shotsHome, rightValue: derived.shotsAway },
      { icon: '◉', name: '射正', left: String(derived.onTargetHome), right: String(derived.onTargetAway), leftValue: derived.onTargetHome, rightValue: derived.onTargetAway },
      { icon: '⌁', name: '传球成功率', left: `${derived.passHome}%`, right: `${derived.passAway}%`, leftValue: derived.passHome, rightValue: derived.passAway },
      { icon: '⚑', name: '角球', left: String(derived.cornersHome), right: String(derived.cornersAway), leftValue: derived.cornersHome, rightValue: derived.cornersAway },
      { icon: '◧', name: '抢断', left: String(derived.tacklesHome), right: String(derived.tacklesAway), leftValue: derived.tacklesHome, rightValue: derived.tacklesAway }
    ];
  }

  private deriveMatchStats() {
    const { scoreA, scoreB, events } = this.game.battleResult;
    const win = scoreA > scoreB;
    const draw = scoreA === scoreB;
    const possessionHome = draw ? 50 : win ? 58 + Math.min(8, scoreA * 2) : 42 - Math.min(8, scoreB * 2);
    const possessionAway = 100 - possessionHome;

    let shotsHome = 0;
    let shotsAway = 0;
    let onTargetHome = 0;
    let onTargetAway = 0;
    let cornersHome = 0;
    let cornersAway = 0;
    let tacklesHome = 0;
    let tacklesAway = 0;

    events.forEach((event) => {
      const away = this.eventTeamSide(event) === 'away';
      const tag = this.eventTag(event);
      const shotLike = ['射门', '进球', '神仙球', '任意球', '扑救'].includes(tag);
      const onTarget = ['进球', '神仙球', '扑救'].includes(tag) || (tag === '任意球' && /破门|入网|射正|被扑/.test(event.text));
      if (shotLike) {
        if (away) shotsAway += 1;
        else shotsHome += 1;
      }
      if (onTarget) {
        if (away) onTargetAway += 1;
        else onTargetHome += 1;
      }
      if (tag === '角球') {
        if (away) cornersAway += 1;
        else cornersHome += 1;
      }
      if (tag === '抢断') {
        if (away) tacklesAway += 1;
        else tacklesHome += 1;
      }
    });

    shotsHome = Math.max(scoreA * 2 + 4, shotsHome, scoreA + 3);
    shotsAway = Math.max(scoreB * 2 + 3, shotsAway, scoreB + 2);
    onTargetHome = Math.max(scoreA + 2, onTargetHome, Math.round(shotsHome * 0.55));
    onTargetAway = Math.max(scoreB + 1, onTargetAway, Math.round(shotsAway * 0.45));
    cornersHome = Math.max(2, cornersHome, scoreA + 1);
    cornersAway = Math.max(1, cornersAway, scoreB);
    tacklesHome = Math.max(6, tacklesHome, 8 + scoreA);
    tacklesAway = Math.max(5, tacklesAway, 6 + scoreB);

    const passHome = Math.min(94, 78 + possessionHome * 0.12 + scoreA * 2);
    const passAway = Math.min(92, 72 + possessionAway * 0.1 + scoreB * 2);

    return {
      possessionHome,
      possessionAway,
      shotsHome,
      shotsAway,
      onTargetHome,
      onTargetAway,
      passHome: Math.round(passHome),
      passAway: Math.round(passAway),
      cornersHome,
      cornersAway,
      tacklesHome,
      tacklesAway
    };
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

  private reportEvents() {
    const events = [...this.matchEvents()]
      .filter((event) => this.isReportEvent(event))
      .sort((a, b) => a.time - b.time)
      .slice(0, 4);
    if (events.length) return events;
    return this.matchEvents().sort((a, b) => a.time - b.time).slice(0, 4);
  }

  private isReportEvent(event: BattleEvent) {
    const type = event.eventType ?? '';
    return ['goal', 'wondergoal', 'freekick', 'yellow', 'red', 'yellow_card', 'red_card', 'corner', 'save', 'shot', 'injury', 'sub', 'substitution'].includes(type) || this.eventTag(event) !== '事件';
  }

  private eventTag(event: BattleEvent) {
    if (event.eventType === 'wondergoal') return '神仙球';
    if (event.eventType === 'freekick') return '任意球';
    if (event.eventType === 'goal') return '进球';
    if (event.eventType === 'yellow' || event.eventType === 'yellow_card') return '犯规';
    if (event.eventType === 'red' || event.eventType === 'red_card') return '犯规';
    if (event.eventType === 'corner') return '角球';
    if (event.eventType === 'save') return '扑救';
    if (event.eventType === 'shot') return '射门';
    if (event.eventType === 'injury') return '受伤';
    if (event.eventType === 'sub' || event.eventType === 'substitution') return '换人';
    if (event.text.includes('破门') || event.text.includes('扳回')) return '进球';
    if (event.text.includes('拦截') || event.text.includes('抢断')) return '抢断';
    if (event.text.includes('犯规')) return '犯规';
    if (event.text.includes('角球')) return '角球';
    if (event.text.includes('扑')) return '扑救';
    if (event.text.includes('机会') || event.text.includes('射')) return '射门';
    return event.mood === 'bad' ? '危险' : '事件';
  }

  private eventIcon(event: BattleEvent) {
    const tag = this.eventTag(event);
    if (tag === '进球') return '●';
    if (tag === '抢断') return '□';
    if (tag === '犯规') return '!';
    if (tag === '角球') return '⚑';
    if (tag === '扑救') return '▣';
    if (tag === '射门') return '↗';
    return '•';
  }

  private eventActorName(event: BattleEvent) {
    if (event.actor) return playerDisplayName(event.actor);
    return this.eventPlayerName(event.text) ?? '球员';
  }

  private eventAssistText(event: BattleEvent) {
    const assist = event.relatedActors?.find((name) => playerDisplayName(name) !== this.eventActorName(event));
    if (assist && this.eventTag(event) === '进球') return `助攻：${playerDisplayName(assist)}`;
    if (event.title) return event.title;
    return event.text.length > 16 ? `${event.text.slice(0, 15)}...` : event.text;
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
