import { Container, Graphics } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { label, palette } from '../ui';

export class ResultScene extends BaseScene {
  private rewardsGranted = false;

  enter() {
    super.enter();
    const { scoreA, scoreB } = this.game.battleResult;
    const win = scoreA > scoreB;
    if (!this.rewardsGranted) {
      this.game.awardMatchRewards(win);
      this.rewardsGranted = true;
    }
    this.game.sound.play(win ? 'win' : 'lose');
    window.setTimeout(() => this.game.sound.play('reward'), 520);
  }

  protected build() {
    this.container.addChild(this.stadiumBackground());
    this.drawShade();
    this.drawHeader();
    this.drawResultCard();
    this.drawRewards();
    this.drawHighlights();
    this.drawActions();
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  private drawShade() {
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020613, alpha: 0.48 });
    this.container.addChild(shade);
  }

  private drawHeader() {
    const shift = this.game.contentTopOffset * 0.3;
    const title = label('比赛结束', 36, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = 72 + shift;
    this.container.addChild(title);
  }

  private drawResultCard() {
    const shift = this.game.contentTopOffset * 0.64;
    const { scoreA, scoreB } = this.game.battleResult;
    const win = scoreA > scoreB;
    const draw = scoreA === scoreB;
    const card = new Container();
    card.x = 42;
    card.y = 138 + shift;
    const w = this.game.width - 84;
    const h = 390;

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 28);
    bg.fill({ color: 0x081126, alpha: 0.92 });
    bg.stroke({ color: win ? 0xffd35d : 0x8fb2ff, alpha: 0.75, width: 3 });
    const glow = new Graphics();
    glow.roundRect(-10, -10, w + 20, h + 20, 34);
    glow.fill({ color: win ? 0xffc43b : 0x2f8cff, alpha: 0.1 });
    card.addChild(glow, bg);

    const trophy = label(win ? '🏆' : draw ? '🤝' : '⚽', 70);
    trophy.anchor.set(0.5);
    trophy.x = w / 2;
    trophy.y = 74;
    const result = label(win ? '胜利' : draw ? '平局' : '再战一局', 54, win ? 0xffe48a : draw ? 0xd7e4ff : 0xd7e4ff, '900');
    result.anchor.set(0.5);
    result.x = w / 2;
    result.y = 145;
    const score = label(`${scoreA} : ${scoreB}`, 82, palette.white, '900');
    score.anchor.set(0.5);
    score.x = w / 2;
    score.y = 236;

    const teams = label(`本地经理  VS  ${this.game.battleSource.opponentName}`, 23, 0xcfe0ff, '900');
    teams.anchor.set(0.5);
    teams.x = w / 2;
    teams.y = 320;

    card.addChild(trophy, result, score, teams);
    this.container.addChild(card);
  }

  private drawRewards() {
    const shift = this.game.contentTopOffset * 0.8;
    const { scoreA, scoreB } = this.game.battleResult;
    const win = scoreA > scoreB;
    const rewards = [
      { icon: '🪙', label: '金币', value: win ? '+1200' : '+420' },
      { icon: '🎫', label: '球探券', value: win ? '+1' : '+0' },
      { icon: '⚡', label: '体力', value: '-6' }
    ];
    const startX = 58;
    rewards.forEach((item, index) => {
      const card = new Container();
      card.x = startX + index * 204;
      card.y = 560 + shift;
      const bg = new Graphics();
      bg.roundRect(0, 0, 184, 116, 18);
      bg.fill({ color: 0x071126, alpha: 0.88 });
      bg.stroke({ color: 0xffd35d, alpha: 0.46, width: 2 });
      const icon = label(item.icon, 30);
      icon.anchor.set(0.5);
      icon.x = 92;
      icon.y = 30;
      const name = label(item.label, 20, 0xcfe0ff, '900');
      name.anchor.set(0.5);
      name.x = 92;
      name.y = 66;
      const value = label(item.value, 25, 0xfff0b3, '900');
      value.anchor.set(0.5);
      value.x = 92;
      value.y = 94;
      card.addChild(bg, icon, name, value);
      this.container.addChild(card);
    });
  }

  private drawHighlights() {
    const shift = this.game.contentTopOffset;
    const panel = new Container();
    panel.x = 42;
    panel.y = 712 + shift;
    const w = this.game.width - 84;
    const h = 250;
    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 22);
    bg.fill({ color: 0x05070d, alpha: 0.82 });
    bg.stroke({ color: 0x5d80c8, alpha: 0.48, width: 2 });
    panel.addChild(bg);

    const title = label('比赛亮点', 28, 0xffe48a, '900');
    title.x = 24;
    title.y = 20;
    panel.addChild(title);

    const rows = this.game.battleResult.events.slice(0, 4);
    const fallback = [{ time: 90, text: '全队稳住节奏，拿下关键一战。', mood: 'good' as const }];
    (rows.length ? rows : fallback).forEach((event, index) => {
      const color = event.mood === 'bad' ? 0xffaaa6 : event.mood === 'good' ? 0xa6ffb0 : palette.white;
      const row = label(`${event.time}'  ${event.text}`, 21, color, '700');
      row.x = 24;
      row.y = 72 + index * 40;
      panel.addChild(row);
    });
    this.container.addChild(panel);
  }

  private drawActions() {
    const dock = new Container();
    dock.x = 42;
    dock.y = this.game.height - 150;

    const bg = new Graphics();
    bg.roundRect(0, 0, this.game.width - 84, 112, 28);
    bg.fill({ color: 0x06130d, alpha: 0.62 });
    bg.stroke({ color: 0xffd35d, alpha: 0.32, width: 2 });
    dock.addChild(bg);

    const again = this.actionButton(376, 76, '继续匹配', '挑战下个对手', true);
    again.x = 18;
    again.y = 18;
    again.on('pointertap', () => {
      this.game.sound.play('confirm');
      this.game.changeScene('formation');
    });

    const home = this.actionButton(218, 76, '返回首页', '主菜单', false);
    home.x = 416;
    home.y = 18;
    home.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('home');
    });

    const scout = this.actionButton(218, 76, '抽卡', '签新球员', false);
    scout.x = 416;
    scout.y = -82;
    scout.on('pointertap', () => {
      this.game.sound.play('confirm');
      this.game.changeScene('blindBox');
    });

    dock.addChild(again, home, scout);
    this.container.addChild(dock);
  }

  private actionButton(width: number, height: number, title: string, subtitle: string, primary: boolean) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 18);
    bg.fill({ color: primary ? palette.gold : 0x071126, alpha: primary ? 1 : 0.92 });
    bg.stroke({ color: primary ? 0xfff6b6 : 0xffd35d, alpha: primary ? 0.95 : 0.68, width: primary ? 4 : 3 });

    const depth = new Graphics();
    depth.roundRect(8, height * 0.54, width - 16, height * 0.32, 14);
    depth.fill({ color: primary ? palette.orange : 0xffffff, alpha: primary ? 0.55 : 0.08 });

    const shine = new Graphics();
    shine.roundRect(12, 10, width - 24, height * 0.28, 14);
    shine.fill({ color: 0xffffff, alpha: primary ? 0.28 : 0.12 });

    const icon = label(primary ? '⚽' : '‹', primary ? 34 : 42, primary ? palette.white : 0xfff0b3, '900');
    icon.anchor.set(0.5);
    icon.x = primary ? 48 : 38;
    icon.y = height / 2;

    const titleText = label(title, primary ? 25 : 23, primary ? 0xfff8d2 : palette.white, '900');
    titleText.anchor.set(0.5);
    titleText.x = primary ? width / 2 + 20 : width / 2 + 16;
    titleText.y = subtitle ? 30 : height / 2;

    const subtitleText = label(subtitle, 14, primary ? 0xfff2bd : 0xcfe0ff, '900');
    subtitleText.anchor.set(0.5);
    subtitleText.x = titleText.x;
    subtitleText.y = 54;

    c.addChild(bg, depth, shine, icon, titleText);
    if (subtitle) c.addChild(subtitleText);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }
}
