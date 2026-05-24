import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { rarityMeta, rarityName } from '../data';
import type { PlayerCardData } from '../types';
import { glassPanel, label, palette, pillButton } from '../ui';

export class BlindBoxScene extends BaseScene {
  private revealed = new Set<string>();
  private drawStarted = false;

  protected build() {
    this.container.addChild(this.stadiumBackground());
    this.drawShade();
    this.drawHeader();
    this.drawTicketPanel();
    if (this.game.pendingScoutChoices.length) this.drawCards();
    else this.drawEmptyState();
    this.drawActions();
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  private drawShade() {
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020613, alpha: 0.54 });
    this.container.addChild(shade);
  }

  private drawHeader() {
    const shift = this.game.contentTopOffset * 0.32;
    const back = label('‹', 60, palette.white, '900');
    back.anchor.set(0.5);
    back.x = 42;
    back.y = 58 + shift;
    back.eventMode = 'static';
    back.cursor = 'pointer';
    back.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('home');
    });

    const title = label('球探中心', 44, 0xfff3b0, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = 66 + shift;
    const sub = label('消耗球探券，三选一签下新球员', 22, 0xcfe0ff, '900');
    sub.anchor.set(0.5);
    sub.x = this.game.width / 2;
    sub.y = 112 + shift;
    this.container.addChild(back, title, sub);
  }

  private drawTicketPanel() {
    const shift = this.game.contentTopOffset * 0.56;
    const panel = new Container();
    panel.x = 42;
    panel.y = 158 + shift;
    const w = this.game.width - 84;
    panel.addChild(glassPanel(w, 118, 0x071126, 0xffd632));
    const owned = label(`已拥有 ${this.game.ownedPlayers().length} 名球员`, 24, palette.white, '900');
    owned.x = 28;
    owned.y = 24;
    const tickets = label(`球探券 ${this.game.scoutTickets}`, 36, 0xfff0b3, '900');
    tickets.x = 28;
    tickets.y = 58;
    const odds = label('紫卡/橙卡/传奇有更高战力和专属技能', 19, 0xcfe0ff, '700');
    odds.x = w - 358;
    odds.y = 46;
    panel.addChild(owned, tickets, odds);
    this.container.addChild(panel);
  }

  private drawEmptyState() {
    const shift = this.game.contentTopOffset * 0.82;
    const panel = new Container();
    const w = this.game.width - 96;
    panel.x = 48;
    panel.y = 340 + shift;
    panel.addChild(glassPanel(w, 420, 0x07120d, 0x9b45ff));
    const ball = label('⚽', 92);
    ball.anchor.set(0.5);
    ball.x = w / 2;
    ball.y = 120;
    const title = label('等待球探报告', 36, palette.white, '900');
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = 214;
    const sub = label('点击下方按钮，立刻发现 3 名候选球员', 23, 0xcfe0ff, '900');
    sub.anchor.set(0.5);
    sub.x = w / 2;
    sub.y = 270;
    panel.addChild(ball, title, sub);
    this.container.addChild(panel);
  }

  private drawCards() {
    const shift = this.game.contentTopOffset * 0.78;
    const cardW = Math.min(210, (this.game.width - 76) / 3);
    const cardH = 360;
    const gap = 12;
    const startX = (this.game.width - (cardW * 3 + gap * 2)) / 2;
    this.game.pendingScoutChoices.forEach((player, index) => {
      const card = this.card(player, cardW, cardH);
      card.x = startX + index * (cardW + gap);
      card.y = 342 + shift;
      this.container.addChild(card);
    });
  }

  private card(player: PlayerCardData, w: number, h: number) {
    const c = new Container();
    const isOpen = this.revealed.has(player.id);
    const meta = rarityMeta[player.rarity];
    const glow = new Graphics();
    glow.roundRect(-10, -10, w + 20, h + 20, 28);
    glow.fill({ color: meta.glow, alpha: isOpen ? 0.28 : 0.12 });
    c.addChild(glow, glassPanel(w, h, isOpen ? meta.color : 0x17234f, isOpen ? meta.glow : 0x5d74bd));

    if (!isOpen) {
      const q = label('?', 92, 0xffdf76, '900');
      q.anchor.set(0.5);
      q.x = w / 2;
      q.y = h * 0.38;
      const text = label('球探档案', 25, palette.white, '900');
      text.anchor.set(0.5);
      text.x = w / 2;
      text.y = h * 0.66;
      const tap = label('点击揭晓', 19, 0xfff0b3, '900');
      tap.anchor.set(0.5);
      tap.x = w / 2;
      tap.y = h * 0.8;
      c.addChild(q, text, tap);
    } else {
      const rarity = label(rarityName(player.rarity), 20, 0x201104, '900');
      rarity.anchor.set(0.5);
      rarity.x = w - 48;
      rarity.y = 28;
      const badge = new Graphics();
      badge.roundRect(w - 92, 12, 76, 34, 9);
      badge.fill({ color: meta.glow, alpha: 0.9 });
      const rating = label(String(player.rating), 38, palette.white, '900');
      rating.x = 18;
      rating.y = 18;
      const role = label(player.role, 18, palette.white, '900');
      role.x = 20;
      role.y = 62;
      const face = this.portrait(player, 126);
      face.x = (w - 126) / 2;
      face.y = 92;
      const skill = label(`#${player.skill}`, 19, 0xfff0b3, '900');
      skill.anchor.set(0.5);
      skill.x = w / 2;
      skill.y = 238;
      const name = label(player.name, 30, palette.white, '900');
      name.anchor.set(0.5);
      name.x = w / 2;
      name.y = 278;
      const choose = label('签下', 27, palette.white, '900');
      choose.anchor.set(0.5);
      choose.x = w / 2;
      choose.y = 326;
      c.addChild(badge, rarity, rating, role, face, name, skill, choose);
    }

    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', () => {
      if (!isOpen) {
        this.game.sound.play('reveal');
        this.revealed.add(player.id);
        this.resize();
        return;
      }
      this.game.sound.play('reward');
      this.game.addPlayerToCollection(player);
      this.game.pendingScoutChoices = [];
      this.revealed.clear();
      this.game.changeScene('formation');
    });
    return c;
  }

  private drawActions() {
    const dock = new Container();
    dock.x = 42;
    dock.y = this.game.height - 148;

    const primary = pillButton(360, 76, this.game.pendingScoutChoices.length ? '重新查看' : '开始抽卡', this.game.scoutTickets > 0 ? '消耗 1 张球探券' : '球探券不足', palette.gold);
    primary.x = 0;
    primary.y = 0;
    primary.alpha = this.game.pendingScoutChoices.length || this.game.scoutTickets > 0 ? 1 : 0.55;
    primary.on('pointertap', () => {
      if (this.game.pendingScoutChoices.length) {
        this.game.sound.play('tap');
        return;
      }
      if (!this.game.startScoutDraw()) {
        this.game.sound.play('danger');
        return;
      }
      this.drawStarted = true;
      this.game.sound.play('confirm');
      this.resize();
    });

    const home = pillButton(230, 76, '返回首页', '继续比赛', 0x1c67e8);
    home.x = this.game.width - 84 - 230;
    home.y = 0;
    home.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('home');
    });
    dock.addChild(primary, home);
    this.container.addChild(dock);
  }

  private portrait(player: PlayerCardData, size: number) {
    const c = new Container();
    const sprite = new Sprite(Texture.from(player.portrait));
    const scale = Math.max(size / (sprite.texture.width || 1024), size / (sprite.texture.height || 1024));
    sprite.scale.set(scale);
    sprite.x = (size - sprite.texture.width * scale) / 2;
    sprite.y = (size - sprite.texture.height * scale) / 2;
    const mask = new Graphics();
    mask.roundRect(0, 0, size, size, 18);
    mask.fill(0xffffff);
    sprite.mask = mask;
    const frame = new Graphics();
    frame.roundRect(0, 0, size, size, 18);
    frame.stroke({ color: rarityMeta[player.rarity].glow, alpha: 0.88, width: 3 });
    c.addChild(sprite, mask, frame);
    return c;
  }
}
