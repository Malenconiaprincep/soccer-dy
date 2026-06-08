import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { headerTitleSprite, label, palette } from '../ui';
import type { BattleEvent, PlayerCardData } from '../types';
import { playerDisplayName } from '../playerNames';

const HOME_ACCENT = 0x2f8cff;
const OPPONENT_ACCENT = 0xff465d;
const GAME_BUTTON = '/assets/ui/gamebutton.png';
const GAME_BUTTON_FRAMES = {
  blue: new Rectangle(47, 266, 471, 168),
  gold: new Rectangle(574, 266, 471, 168)
};
const RESULT_PANEL_X = 22;
const STATS_PANEL_Y = 310;
const STATS_BLOCK_GAP = 36;
const RESULT_ACTION_H = 88;

interface StatRow {
  icon: 'possession' | 'shots' | 'target' | 'pass' | 'corner' | 'tackle';
  name: string;
  left: string;
  right: string;
  leftValue: number;
  rightValue: number;
}

export class ResultScene extends BaseScene {
  private rewardsGranted = false;
  private activeReportTab: 'stats' | 'events' = 'stats';

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
    this.drawReportTabsPanel();
    this.drawMvpPanel();
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

  private reportTabLayout() {
    const w = this.game.width - 44;
    const y = STATS_PANEL_Y + this.topLift();
    const tabBarH = 58;
    const tabCaretH = 10;
    const blockGap = 16;
    const contentPadTop = 18;
    const contentPadBottom = 24;
    const rowH = 82;
    const contentH = contentPadTop + this.statsRows().length * rowH + contentPadBottom;
    const contentY = y + tabBarH + tabCaretH + blockGap;
    const totalH = contentY - y + contentH;
    return {
      x: RESULT_PANEL_X,
      y,
      w,
      tabBarH,
      tabCaretH,
      blockGap,
      contentY,
      contentH,
      contentPadTop,
      rowH,
      totalH
    };
  }

  private mvpBlockLayout() {
    const stats = this.reportTabLayout();
    const h = 144;
    return { x: stats.x, y: stats.y + stats.totalH + STATS_BLOCK_GAP, w: stats.w, h };
  }

  private drawReportTabsPanel() {
    const layout = this.reportTabLayout();

    const tabPanel = new Container();
    tabPanel.x = layout.x;
    tabPanel.y = layout.y;
    this.drawReportTabBar(tabPanel, 0, 0, layout.w, layout.tabBarH);
    this.container.addChild(tabPanel);

    const contentPanel = new Container();
    contentPanel.x = layout.x;
    contentPanel.y = layout.contentY;
    contentPanel.addChild(this.panelBg(layout.w, layout.contentH, 0x041229, 0x238ce9, 0.92, 16));

    if (this.activeReportTab === 'stats') {
      const rows = this.statsRows();
      rows.forEach((row, index) => {
        this.drawStatRow(contentPanel, row, layout.contentPadTop + index * layout.rowH, layout.w, index < rows.length - 1);
      });
    } else {
      const cardH = 76;
      const eventRowH = 88;
      const availableRows = Math.max(1, Math.floor((layout.contentH - layout.contentPadTop - 24) / eventRowH));
      const events = this.reportEvents().slice(0, availableRows);
      this.drawTimelineEventList(contentPanel, events, layout.w, layout.contentPadTop + 10, cardH, eventRowH, 290);
    }

    this.container.addChild(contentPanel);
  }

  private drawReportTabBar(parent: Container, x: number, y: number, w: number, h: number) {
    const statsActive = this.activeReportTab === 'stats';
    const segmentW = w / 2;
    const radius = h / 2;
    const bar = new Container();
    bar.x = x;
    bar.y = y;

    const track = new Graphics();
    track.roundRect(0, 0, w, h, radius);
    track.fill({ color: 0x041a35, alpha: 0.96 });
    track.stroke({ color: 0x238ce9, alpha: 0.9, width: 2 });

    const indicator = new Graphics();
    const r = Math.min(radius, segmentW, h / 2);
    if (statsActive) {
      indicator.moveTo(r, 0);
      indicator.lineTo(segmentW, 0);
      indicator.lineTo(segmentW, h);
      indicator.lineTo(r, h);
      indicator.arc(r, r, r, Math.PI / 2, -Math.PI / 2);
      indicator.closePath();
    } else {
      indicator.moveTo(segmentW, 0);
      indicator.lineTo(w - r, 0);
      indicator.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2);
      indicator.lineTo(segmentW, h);
      indicator.closePath();
    }
    indicator.fill({ color: 0x1f83ed, alpha: 1 });

    const caretX = statsActive ? segmentW / 2 : segmentW + segmentW / 2;
    const caret = new Graphics();
    caret.moveTo(caretX - 8, h);
    caret.lineTo(caretX + 8, h);
    caret.lineTo(caretX, h + 9);
    caret.closePath();
    caret.fill({ color: 0x1f83ed, alpha: 1 });

    const statsLabel = label('统计信息', 26, statsActive ? 0xffffff : 0xa8bdd9, '900');
    statsLabel.anchor.set(0.5);
    statsLabel.x = segmentW / 2;
    statsLabel.y = h / 2 + 1;

    const eventsLabel = label('比赛事件', 26, statsActive ? 0xa8bdd9 : 0xffffff, '900');
    eventsLabel.anchor.set(0.5);
    eventsLabel.x = segmentW + segmentW / 2;
    eventsLabel.y = h / 2 + 1;

    const statsHit = new Graphics();
    statsHit.rect(0, 0, segmentW, h + 10);
    statsHit.fill({ color: 0xffffff, alpha: 0.001 });
    statsHit.eventMode = 'static';
    statsHit.cursor = 'pointer';
    statsHit.on('pointertap', () => this.switchReportTab('stats'));

    const eventsHit = new Graphics();
    eventsHit.rect(segmentW, 0, segmentW, h + 10);
    eventsHit.fill({ color: 0xffffff, alpha: 0.001 });
    eventsHit.eventMode = 'static';
    eventsHit.cursor = 'pointer';
    eventsHit.on('pointertap', () => this.switchReportTab('events'));

    bar.addChild(track, indicator, caret, statsLabel, eventsLabel, statsHit, eventsHit);
    parent.addChild(bar);
  }

  private switchReportTab(tab: 'stats' | 'events') {
    if (this.activeReportTab === tab) return;
    this.game.sound.play('tap');
    this.activeReportTab = tab;
    this.resize();
  }

  private drawMvpPanel() {
    const layout = this.mvpBlockLayout();
    const panel = new Container();
    panel.x = layout.x;
    panel.y = layout.y;
    const w = layout.w;
    const h = layout.h;
    panel.addChild(this.panelBg(w, h, 0x061b32, 0xffc341, 0.88, 14));

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
      const x = w - 168 + index * 102;
      if (index > 0) {
        const line = new Graphics();
        line.rect(x - 51, 34, 1, 84);
        line.fill({ color: 0x2f5a91, alpha: 0.6 });
        panel.addChild(line);
      }
      const icon = label(iconText, 30, 0xdbe7ff, '900');
      icon.anchor.set(0.5);
      icon.x = x - 26;
      icon.y = 56;
      const v = label(value, 34, palette.white, '900');
      v.anchor.set(0, 0.5);
      v.x = x;
      v.y = 56;
      const n = label(name, 22, 0xc7d6ec, '700');
      n.anchor.set(0.5);
      n.x = x - 4;
      n.y = 96;
      panel.addChild(icon, v, n);
    });

    panel.addChild(score, scoreLabel);
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

  private eventTimelineColor(event: BattleEvent, homeSide: boolean) {
    if (this.isCardEvent(event)) return 0xffd632;
    return homeSide ? HOME_ACCENT : OPPONENT_ACCENT;
  }

  private isCardEvent(event: BattleEvent) {
    const tag = this.eventTag(event);
    return tag === '犯规' || event.eventType === 'yellow' || event.eventType === 'red';
  }

  private drawTimelineEventList(
    parent: Container,
    events: BattleEvent[],
    panelW: number,
    startY: number,
    cardH: number,
    rowH: number,
    maxCardW: number
  ) {
    if (!events.length) return;

    const centerX = panelW / 2;
    const cardGap = 18;
    const cardW = Math.min(maxCardW, centerX - cardGap - 24);
    const firstNodeY = startY + cardH / 2;
    const lastNodeY = startY + (events.length - 1) * rowH + cardH / 2;

    if (events.length > 1) {
      const axis = new Graphics();
      axis.moveTo(centerX, firstNodeY);
      axis.lineTo(centerX, lastNodeY);
      axis.stroke({ color: 0x3aa2ff, alpha: 0.5, width: 2 });
      parent.addChild(axis);
    }

    events.forEach((event, index) => {
      const cardY = startY + index * rowH;
      const nodeY = cardY + cardH / 2;
      const homeSide = this.eventTeamSide(event) === 'home';
      const color = this.eventTimelineColor(event, homeSide);
      const cardX = homeSide ? centerX - cardGap - cardW : centerX + cardGap;
      const cardEdgeX = homeSide ? cardX + cardW : cardX;

      this.drawTimelineConnector(parent, centerX, nodeY, homeSide, color, cardGap);
      this.drawTimelineNode(parent, centerX, nodeY, color);
      this.drawTimelineConnectorDot(parent, cardEdgeX, nodeY, color);
      this.drawTimelineEventCard(parent, event, cardX, cardY, cardW, cardH, color);
    });
  }

  private drawTimelineEventCard(
    parent: Container,
    event: BattleEvent,
    x: number,
    y: number,
    w: number,
    h: number,
    accent: number
  ) {
    const card = new Container();
    card.x = x;
    card.y = y;

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 10);
    bg.fill({ color: 0x061630, alpha: 0.94 });
    bg.stroke({ color: accent, alpha: 0.9, width: 2.5 });

    const icon = this.drawTimelineCardIcon(event, 12, 20, accent);
    card.addChild(bg, icon);

    const textX = 50;
    const maxTextW = w - textX - 12;
    const timeLabel = label(`${event.time}'`, 24, accent, '900');
    timeLabel.x = textX;
    timeLabel.y = 12;

    let actorName = this.eventActorName(event);
    const tag = this.eventTag(event);
    let actorLabel = label(actorName, 24, palette.white, '900');
    actorLabel.x = textX + timeLabel.width + 8;
    actorLabel.y = 12;

    const tagLabel = label(tag, 24, accent, '900');
    tagLabel.x = actorLabel.x + actorLabel.width + 8;
    tagLabel.y = 12;

    let headlineW = tagLabel.x + tagLabel.width - textX;
    while (headlineW > maxTextW && actorName.length > 2) {
      actorName = `${actorName.slice(0, actorName.length - 2)}...`;
      actorLabel.text = actorName;
      tagLabel.x = actorLabel.x + actorLabel.width + 8;
      headlineW = tagLabel.x + tagLabel.width - textX;
    }
    if (headlineW > maxTextW && tagLabel.width > 40) {
      tagLabel.scale.x = Math.max(0.72, (maxTextW - (timeLabel.width + actorLabel.width + 16)) / tagLabel.width);
    }

    const subtext = this.eventTimelineDetail(event) || this.cardEventSubtext(event);
    const detail = label(subtext, 19, 0x9eb4d0, '700');
    detail.x = textX;
    detail.y = 46;
    if (detail.width > maxTextW) detail.scale.x = maxTextW / detail.width;

    card.addChild(timeLabel, actorLabel, tagLabel, detail);
    parent.addChild(card);
  }

  private drawTimelineCardIcon(event: BattleEvent, x: number, y: number, accent: number) {
    const iconWrap = new Container();
    iconWrap.x = x;
    iconWrap.y = y;

    if (this.isCardEvent(event)) {
      const cardColor = event.eventType === 'red' || event.eventType === 'red_card' ? 0xff465d : 0xffd632;
      const cardIcon = new Graphics();
      cardIcon.roundRect(0, 0, 20, 28, 3);
      cardIcon.fill({ color: cardColor, alpha: 1 });
      iconWrap.addChild(cardIcon);
      return iconWrap;
    }

    const icon = label(this.eventTimelineIcon(event), 30, accent, '900');
    icon.y = 2;
    iconWrap.addChild(icon);
    return iconWrap;
  }

  private drawTimelineNode(parent: Container, centerX: number, nodeY: number, color: number) {
    const dot = new Graphics();
    dot.circle(centerX, nodeY, 6);
    dot.fill({ color: 0x06152d, alpha: 1 });
    dot.stroke({ color, alpha: 0.95, width: 2.5 });
    parent.addChild(dot);
  }

  private drawTimelineConnectorDot(parent: Container, x: number, nodeY: number, color: number) {
    const dot = new Graphics();
    dot.circle(x, nodeY, 3.5);
    dot.fill({ color, alpha: 0.92 });
    parent.addChild(dot);
  }

  private cardEventSubtext(event: BattleEvent) {
    if (event.eventType === 'yellow' || event.eventType === 'yellow_card') return '吃到黄牌';
    if (event.eventType === 'red' || event.eventType === 'red_card') return '被罚下场';
    if (this.eventTag(event) === '换人') return event.text || '教练组换人调整';
    if (this.eventTag(event) === '角球') return event.text || '获得角球机会';
    if (this.eventTag(event) === '扑救') return event.text || '完成关键扑救';
    return event.text;
  }

  private drawTimelineConnector(parent: Container, centerX: number, nodeY: number, homeSide: boolean, color: number, length = 50) {
    const connector = new Graphics();
    const endX = homeSide ? centerX - length : centerX + length;
    connector.moveTo(centerX, nodeY);
    connector.lineTo(endX, nodeY);
    connector.stroke({ color, alpha: 0.55, width: 2 });
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
    if (event.eventType === 'goal' || event.eventType === 'wondergoal') return true;
    if (event.eventType === 'freekick' && /破门|入网|直挂|死角|轰|得分/.test(event.text)) return true;
    return this.eventTag(event) === '进球';
  }

  private drawActions() {
    const mvp = this.mvpBlockLayout();
    const preferredY = mvp.y + mvp.h + 28;
    const maxY = this.game.height - RESULT_ACTION_H - Math.max(24, this.game.safeAreaBottom + 18);
    const y = Math.min(preferredY, maxY);
    const back = this.actionButton(248, RESULT_ACTION_H, '返回大厅', 0x0b62d8, 0x2aa0ff, false);
    back.x = 82;
    back.y = y;
    back.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('home');
    });

    const next = this.actionButton(248, RESULT_ACTION_H, '继续比赛', 0xffc341, 0xfff0a2, true);
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
    const barH = 32;
    const titleY = y + 14;
    const barY = y + 38;

    const icon = this.statIcon(row.icon, 28);
    const name = label(row.name, 26, 0xd9e4f4, '700');
    name.anchor.set(0, 0.5);
    const titleGap = 12;
    name.x = 28 + titleGap;
    const title = new Container();
    title.x = (w - (name.x + name.width)) / 2;
    title.y = titleY;
    icon.y = -14;
    title.addChild(icon, name);

    if (showDivider) {
      const divider = new Graphics();
      divider.rect(padX, barY + barH + 12, barW, 1);
      divider.fill({ color: 0x15345a, alpha: 0.45 });
      parent.addChild(divider);
    }

    this.drawComparisonBar(parent, barX, barY, barW, barH, row.leftValue, row.rightValue, row.left, row.right);
    parent.addChild(title);
  }

  private statIcon(type: StatRow['icon'], size: number) {
    const c = new Container();
    const g = new Graphics();
    const color = 0xe8f2ff;
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.36;

    if (type === 'possession') {
      g.circle(cx, cy, r);
      g.fill({ color: 0xffffff, alpha: 0.96 });
      g.stroke({ color: 0x0a1830, alpha: 0.85, width: 2 });
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.52, cy - r * 0.18);
      g.lineTo(cx + r * 0.32, cy + r * 0.62);
      g.lineTo(cx - r * 0.32, cy + r * 0.62);
      g.lineTo(cx - r * 0.52, cy - r * 0.18);
      g.closePath();
      g.fill({ color: 0x1b2233, alpha: 0.92 });
    } else if (type === 'shots') {
      g.circle(cx, cy, r);
      g.stroke({ color, alpha: 0.95, width: 3 });
      g.circle(cx, cy, r * 0.5);
      g.stroke({ color, alpha: 0.75, width: 2 });
    } else if (type === 'target') {
      g.circle(cx, cy, r);
      g.fill({ color, alpha: 0.95 });
      g.stroke({ color: 0x8fb6e8, alpha: 0.9, width: 2 });
    } else if (type === 'pass') {
      g.moveTo(size * 0.16, size * 0.58);
      g.lineTo(size * 0.56, size * 0.38);
      g.lineTo(size * 0.46, size * 0.25);
      g.lineTo(size * 0.82, size * 0.38);
      g.lineTo(size * 0.54, size * 0.66);
      g.lineTo(size * 0.58, size * 0.5);
      g.lineTo(size * 0.22, size * 0.7);
      g.stroke({ color, alpha: 0.95, width: 3 });
    } else if (type === 'corner') {
      g.rect(size * 0.22, size * 0.2, 3, size * 0.6);
      g.fill({ color, alpha: 0.95 });
      g.poly([size * 0.28, size * 0.2, size * 0.74, size * 0.32, size * 0.28, size * 0.48]);
      g.fill({ color, alpha: 0.95 });
    } else {
      g.rect(size * 0.32, size * 0.28, size * 0.36, size * 0.44);
      g.fill({ color, alpha: 0.95 });
      g.rect(size * 0.42, size * 0.38, size * 0.16, size * 0.24);
      g.fill({ color: 0x06142c, alpha: 0.95 });
    }

    c.addChild(g);
    return c;
  }

  private drawComparisonBar(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    leftVal: number,
    rightVal: number,
    leftText: string,
    rightText: string
  ) {
    const total = Math.max(1, leftVal + rightVal);
    const leftShare = leftVal / total;
    const iw = Math.max(2, Math.round(w));
    const ih = Math.max(2, Math.round(h));
    const splitX = Math.round(iw * leftShare);
    const leftW = Math.max(0, Math.min(iw, splitX));
    const rightW = iw - leftW;
    const radius = ih / 2;
    const seamOverlap = leftW > 0 && rightW > 0 ? 1 : 0;

    const bar = new Container();
    bar.x = Math.round(x);
    bar.y = Math.round(y);

    const track = new Graphics();
    track.roundRect(0, 0, iw, ih, radius);
    track.fill({ color: 0x0a1e3a, alpha: 0.96 });

    const leftFill = new Graphics();
    if (rightW <= 0) {
      leftFill.roundRect(0, 0, iw, ih, radius);
    } else if (leftW <= radius * 2) {
      leftFill.roundRect(0, 0, leftW + seamOverlap, ih, radius);
    } else {
      leftFill.roundRect(0, 0, leftW, ih, radius);
      leftFill.rect(leftW - radius, 0, radius + seamOverlap, ih);
    }
    leftFill.fill({ color: HOME_ACCENT, alpha: 0.96 });

    const rightFill = new Graphics();
    rightFill.y = 1.5;
    if (leftW <= 0) {
      rightFill.roundRect(0, 0, iw, ih, radius);
    } else if (rightW <= radius * 2) {
      rightFill.roundRect(leftW, 0, rightW, ih, radius);
    } else {
      rightFill.rect(leftW, 0, radius, ih);
      rightFill.roundRect(leftW, 0, rightW, ih, radius);
    }
    rightFill.fill({ color: OPPONENT_ACCENT, alpha: 0.96 });

    const border = new Graphics();
    border.roundRect(0, 0, iw, ih, radius);
    border.stroke({ color: 0x1a3d66, alpha: 0.78, width: 1 });

    bar.addChild(track, leftFill, rightFill, border);

    const textSize = Math.max(22, Math.round(ih * 0.68));
    const edgePad = Math.max(14, radius + 4);
    const textShadow = { color: 0x000000, blur: 3, distance: 1, alpha: 0.85, angle: Math.PI / 2 };

    const leftLabel = label(leftText, textSize, 0xffffff, '900');
    leftLabel.anchor.set(0, 0.5);
    leftLabel.x = edgePad;
    leftLabel.y = ih / 2;
    leftLabel.style.dropShadow = textShadow;
    bar.addChild(leftLabel);

    const rightLabel = label(rightText, textSize, 0xffffff, '900');
    rightLabel.anchor.set(1, 0.5);
    rightLabel.x = iw - edgePad;
    rightLabel.y = ih / 2;
    rightLabel.style.dropShadow = textShadow;
    bar.addChild(rightLabel);

    parent.addChild(bar);
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

  private actionButton(width: number, height: number, text: string, fill: number, stroke: number, gold: boolean) {
    const button = new Container();
    const source = Texture.from(GAME_BUTTON).source;
    const frame = gold ? GAME_BUTTON_FRAMES.gold : GAME_BUTTON_FRAMES.blue;
    const sprite = new Sprite(new Texture({ source, frame }));
    sprite.width = width;
    sprite.height = height;
    button.addChild(sprite);
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
      { icon: 'possession', name: '控球率', left: `${derived.possessionHome}%`, right: `${derived.possessionAway}%`, leftValue: derived.possessionHome, rightValue: derived.possessionAway },
      { icon: 'shots', name: '射门', left: String(derived.shotsHome), right: String(derived.shotsAway), leftValue: derived.shotsHome, rightValue: derived.shotsAway },
      { icon: 'target', name: '射正', left: String(derived.onTargetHome), right: String(derived.onTargetAway), leftValue: derived.onTargetHome, rightValue: derived.onTargetAway },
      { icon: 'pass', name: '传球成功率', left: `${derived.passHome}%`, right: `${derived.passAway}%`, leftValue: derived.passHome, rightValue: derived.passAway },
      { icon: 'corner', name: '角球', left: String(derived.cornersHome), right: String(derived.cornersAway), leftValue: derived.cornersHome, rightValue: derived.cornersAway },
      { icon: 'tackle', name: '抢断', left: String(derived.tacklesHome), right: String(derived.tacklesAway), leftValue: derived.tacklesHome, rightValue: derived.tacklesAway }
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
    const events = this.matchEvents().filter(
      (event) => event.title !== '全场比赛结束' && event.eventType !== 'fulltime'
    );
    const picked = this.pickKeyReportEvents(events);
    if (picked.length) return picked;
    return this.pickKeyReportEvents(this.matchEvents());
  }

  private pickKeyReportEvents(events: BattleEvent[]) {
    const sorted = [...events].sort((a, b) => a.time - b.time);
    const scoring = this.scoringEvents(sorted);
    const scoringSet = new Set(scoring);
    const others = sorted.filter(
      (event) => !scoringSet.has(event) && this.isNotableReportEvent(event)
    );
    const maxOthers = Math.max(0, 8 - scoring.length);
    return [...scoring, ...others.slice(0, maxOthers)];
  }

  private scoringEvents(events: BattleEvent[]) {
    let previousA = 0;
    let previousB = 0;
    const result: BattleEvent[] = [];
    events.forEach((event) => {
      const scoreA = event.scoreA ?? 0;
      const scoreB = event.scoreB ?? 0;
      if (scoreA > previousA || scoreB > previousB) {
        result.push(event);
      }
      previousA = scoreA;
      previousB = scoreB;
    });
    return result;
  }

  private isNotableReportEvent(event: BattleEvent) {
    const type = event.eventType ?? '';
    if (['yellow', 'red', 'yellow_card', 'red_card', 'injury', 'sub', 'substitution', 'wondergoal'].includes(type)) {
      return true;
    }
    const tag = this.eventTag(event);
    return tag === '犯规' || tag === '换人' || tag === '受伤' || tag === '神仙球';
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
    if (event.text.includes('破门') || event.text.includes('扳回') || event.text.includes('进球')) return '进球';
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
      const scoreA = event.scoreA ?? 0;
      const scoreB = event.scoreB ?? 0;
      if (mine && scoreA > previousA) result.push(event);
      if (!mine && scoreB > previousB) result.push(event);
      previousA = scoreA;
      previousB = scoreB;
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
