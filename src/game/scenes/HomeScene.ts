import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { avatar, coverSprite, glassPanel, label, palette } from '../ui';

const HOME_BG = '/assets/home-bg.jpg';
const TOP_BUTTON = '/assets/ui/top-button.png';
const TOP_SECTION = 724;
const WEB_AVATAR = '/assets/players/generated/saka.png';

export class HomeScene extends BaseScene {
  private taskModal?: Container;
  private elapsedMs = 0;
  private startGlow?: Graphics;
  private startShine?: Graphics;
  private startShineWidth = 0;
  private floaters: { node: Container; baseY: number; amplitude: number; phase: number }[] = [];

  protected build() {
    this.elapsedMs = 0;
    this.startGlow = undefined;
    this.startShine = undefined;
    this.floaters = [];
    this.container.addChild(coverSprite(HOME_BG, this.game.width, this.game.height));
    this.drawVignette();
    this.drawTopBar();
    this.drawSideShortcuts();
    this.drawHeroPlayer();
    this.drawCommandDeck();
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  update(deltaMs: number) {
    this.elapsedMs += deltaMs;
    const pulse = (Math.sin(this.elapsedMs * 0.0042) + 1) / 2;
    if (this.startGlow) this.startGlow.alpha = 0.18 + pulse * 0.24;
    if (this.startShine && this.startShineWidth > 0) {
      const progress = (this.elapsedMs % 2200) / 2200;
      this.startShine.x = -this.startShineWidth * 0.24 + progress * this.startShineWidth * 1.22;
      this.startShine.alpha = progress > 0.12 && progress < 0.72 ? 0.16 : 0;
    }
    this.floaters.forEach((item) => {
      item.node.y = item.baseY + Math.sin(this.elapsedMs * 0.002 + item.phase) * item.amplitude;
    });
  }

  private drawTopBar() {
    const top = new Container();
    const sidePad = 16;
    const gap = 6;
    const avatarSize = 108;
    const barHeight = 96;
    const barWidth = (this.game.width - sidePad * 2 - avatarSize - gap * 2) / 2;
    const totalWidth = avatarSize + gap + barWidth + gap + barWidth;
    top.x = (this.game.width - totalWidth) / 2;
    top.y = 18 + this.game.contentTopOffset * 0.05;

    const sheet = Texture.from(TOP_BUTTON);
    const barY = (avatarSize - barHeight) / 2;

    const avatarRing = this.topSheetSprite(sheet, 0, avatarSize, avatarSize);
    const avatarSlot = new Container();
    avatarSlot.x = avatarSize / 2;
    avatarSlot.y = avatarSize / 2;
    this.drawTopAvatar(avatarSlot, avatarSize * 0.74);
    top.addChild(avatarSlot, avatarRing);

    const gems = this.topResourceBar(sheet, 1, this.formatGems(this.game.gems), barWidth, barHeight);
    gems.x = avatarSize + gap;
    gems.y = barY;
    top.addChild(gems);

    const energy = this.topResourceBar(sheet, 2, `${this.game.energy}/120`, barWidth, barHeight);
    energy.x = avatarSize + gap + barWidth + gap;
    energy.y = barY;
    top.addChild(energy);

    this.container.addChild(top);
  }

  private topSheetFrame(index: number) {
    return new Rectangle(index * TOP_SECTION, 0, TOP_SECTION, TOP_SECTION);
  }

  private topSheetSprite(sheet: Texture, index: number, width: number, height: number) {
    const sprite = new Sprite(new Texture({ source: sheet.source, frame: this.topSheetFrame(index) }));
    sprite.width = width;
    sprite.height = height;
    return sprite;
  }

  private topResourceBar(sheet: Texture, index: number, valueText: string, barWidth: number, barHeight: number) {
    const c = new Container();
    const bg = this.topSheetSprite(sheet, index, barWidth, barHeight);
    const value = label(valueText, Math.round(barHeight * 0.34), palette.white, '900');
    value.anchor.set(0.5, 0.5);
    value.x = barWidth * 0.46;
    value.y = barHeight * 0.5;
    const maxTextWidth = barWidth * 0.34;
    if (value.width > maxTextWidth) value.scale.x = maxTextWidth / value.width;
    c.addChild(bg, value);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private drawTopAvatar(parent: Container, size: number) {
    const mask = new Graphics();
    mask.circle(0, 0, size / 2);
    mask.fill(0xffffff);
    parent.addChild(mask);
    parent.mask = mask;

    const fallback = this.game.platform.name === 'web' ? WEB_AVATAR : undefined;
    const url = this.game.user.avatarUrl ?? fallback;
    const drawFallback = () => {
      const placeholder = avatar(Math.round(size));
      placeholder.x = -size / 2;
      placeholder.y = -size / 2;
      parent.addChild(placeholder);
    };

    if (!url) {
      drawFallback();
      return;
    }

    void Assets.load<Texture>(url)
      .then((texture) => {
        const sprite = Sprite.from(texture);
        sprite.anchor.set(0.5);
        const scale = Math.max(size / sprite.texture.width, size / sprite.texture.height);
        sprite.scale.set(scale);
        parent.addChild(sprite);
      })
      .catch(drawFallback);
  }

  private formatGems(value: number) {
    if (value >= 10000) return this.resourceAmount(value);
    return value.toLocaleString('en-US');
  }

  private drawVignette() {
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x020613, alpha: 0.03 });
    shade.rect(0, 0, this.game.width, 172 + this.game.contentTopOffset * 0.2);
    shade.fill({ color: 0x020613, alpha: 0.14 });
    shade.rect(0, this.game.height - 290, this.game.width, 290);
    shade.fill({ color: 0x020613, alpha: 0.18 });
    this.container.addChild(shade);
  }

  private drawCommandDeck() {
    const featureY = this.game.height - 268;
    const matchW = Math.min(408, this.game.width - 270);
    const matchY = featureY - matchW * (410 / 832) - 28;
    const start = this.matchButton(matchW);
    start.x = (this.game.width - matchW) / 2;
    start.y = matchY;
    start.on('pointertap', () => {
      this.game.sound.play('confirm');
      this.game.prepareOpponent();
      this.game.changeScene('matchup');
    });
    this.container.addChild(start);

    const cardW = (this.game.width - 56) / 2;
    const scout = this.featureCard(cardW, 'scout');
    scout.x = 20;
    scout.y = featureY;
    this.floaters.push({ node: scout, baseY: scout.y, amplitude: 2.2, phase: 0.4 });
    scout.on('pointertap', () => {
      this.game.sound.play('confirm');
      this.game.changeScene('blindBox');
    });
    const squad = this.featureCard(cardW, 'squad');
    squad.x = 36 + cardW;
    squad.y = featureY;
    this.floaters.push({ node: squad, baseY: squad.y, amplitude: 2.2, phase: 1.1 });
    squad.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('formation');
    });
    this.container.addChild(scout, squad);
  }

  private drawHeroPlayer() {
    const sprite = new Sprite(Texture.from('/assets/ui/hero.png'));
    sprite.anchor.set(0.5, 1);
    const maxHeight = Math.max(340, this.game.height - 650);
    const maxWidth = Math.min(360, this.game.width * 0.48);
    const scale = Math.min(maxHeight / sprite.texture.height, maxWidth / sprite.texture.width);
    sprite.scale.set(scale);
    sprite.x = this.game.width / 2;
    sprite.y = this.game.height - 398;
    this.container.addChild(sprite);
  }

  private drawSideShortcuts() {
    const leftX = 22;
    const rightX = this.game.width - 88;
    const startY = 152 + this.game.contentTopOffset * 0.16;
    const gap = 100;
    const sign = this.spriteMenuButton('sign');
    sign.x = leftX;
    sign.y = startY;
    this.floaters.push({ node: sign, baseY: sign.y, amplitude: 1.4, phase: 0 });
    const task = this.spriteMenuButton('task', this.taskItems().filter((item) => item.done && !item.claimed).length);
    task.x = leftX;
    task.y = startY + gap;
    this.floaters.push({ node: task, baseY: task.y, amplitude: 1.4, phase: 0.8 });
    task.on('pointertap', () => {
      this.game.sound.play('tap');
      this.openTaskModal();
    });
    const shop = this.spriteMenuButton('shop');
    shop.x = leftX;
    shop.y = startY + gap * 2;
    this.floaters.push({ node: shop, baseY: shop.y, amplitude: 1.4, phase: 1.6 });

    const follow = this.rightSpriteMenuButton('gift', '关注领奖');
    follow.x = rightX;
    follow.y = startY;
    this.floaters.push({ node: follow, baseY: follow.y, amplitude: 1.2, phase: 0.3 });
    const rank = this.spriteMenuButton('rank');
    rank.x = rightX;
    rank.y = startY + gap;
    this.floaters.push({ node: rank, baseY: rank.y, amplitude: 1.2, phase: 1.2 });
    this.container.addChild(sign, task, shop, follow, rank);
  }

  private infoCard(titleText: string, valueText: string, subText: string, x: number, y: number, accent: number) {
    const c = new Container();
    c.x = x;
    c.y = y;
    c.addChild(this.flatPanel(252, 88, 0x061126, accent));
    const title = label(titleText, 18, 0xcfe0ff, '900');
    title.x = 18;
    title.y = 14;
    const value = label(valueText, 30, palette.white, '900');
    value.x = 18;
    value.y = 38;
    const sub = label(subText, 15, 0xfff0b3, '700');
    sub.x = 112;
    sub.y = 52;
    c.addChild(title, value, sub);
    return c;
  }

  private lineupPowerLabel() {
    const selected = this.game.lineup.filter((slot) => slot.player);
    if (!selected.length) return '待组建';
    return String(this.game.lineupPower());
  }

  private flatPanel(width: number, height: number, fill: number, stroke: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 14);
    bg.fill({ color: fill, alpha: 0.9 });
    bg.stroke({ color: stroke, alpha: 0.92, width: 3 });
    const shine = new Graphics();
    shine.roundRect(8, 8, width - 16, Math.min(18, height * 0.28), 8);
    shine.fill({ color: 0xffffff, alpha: 0.08 });
    c.addChild(bg, shine);
    return c;
  }

  private modeCard(width: number, height: number, titleText: string, valueText: string, subText: string, accent: number, iconText: string) {
    const c = new Container();
    c.addChild(this.flatPanel(width, height, 0x071126, accent));
    const iconBg = new Graphics();
    iconBg.circle(36, height / 2, 24);
    iconBg.fill({ color: accent, alpha: 0.82 });
    iconBg.stroke({ color: 0xffffff, alpha: 0.62, width: 2 });
    const icon = label(iconText, 24);
    icon.anchor.set(0.5);
    icon.x = 36;
    icon.y = height / 2;
    const title = label(titleText, 24, palette.white, '900');
    title.x = 74;
    title.y = 15;
    const value = label(valueText, 17, 0xfff0b3, '900');
    value.x = 74;
    value.y = 48;
    const sub = label(subText, 15, 0xcfe0ff, '700');
    sub.x = width - 106;
    sub.y = 52;
    c.addChild(iconBg, icon, title, value, sub);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private actionRow(width: number, height: number, titleText: string, valueText: string, subText: string, accent: number, iconText: string) {
    const c = new Container();
    c.addChild(this.flatPanel(width, height, 0x071126, accent));
    const iconBg = new Graphics();
    iconBg.circle(38, height / 2, 24);
    iconBg.fill({ color: accent, alpha: 0.88 });
    iconBg.stroke({ color: 0xffffff, alpha: 0.62, width: 2 });
    const icon = label(iconText, 24);
    icon.anchor.set(0.5);
    icon.x = 38;
    icon.y = height / 2;
    const title = label(titleText, 27, palette.white, '900');
    title.x = 78;
    title.y = 12;
    const value = label(valueText, 18, 0xfff0b3, '900');
    value.x = 78;
    value.y = 44;
    const sub = label(subText, 17, 0xcfe0ff, '900');
    sub.anchor.set(1, 0);
    sub.x = width - 30;
    sub.y = 36;
    const arrow = label('›', 34, 0xfff0b3, '900');
    arrow.anchor.set(0.5);
    arrow.x = width - 22;
    arrow.y = height / 2 - 1;
    c.addChild(iconBg, icon, title, value, sub, arrow);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private matchButton(width: number) {
    const c = new Container();
    const height = width * (410 / 832);
    const glow = new Graphics();
    glow.roundRect(-8, -8, width + 16, height + 16, 28);
    glow.fill({ color: 0xffd25a, alpha: 1 });
    glow.alpha = 0.28;
    const sprite = new Sprite(Texture.from('/assets/ui/start.png'));
    sprite.width = width;
    sprite.height = height;
    const shine = new Graphics();
    shine.roundRect(0, 14, width * 0.22, 16, 8);
    shine.fill({ color: 0xffffff, alpha: 1 });
    shine.rotation = -0.18;
    shine.alpha = 0;
    c.addChild(glow, sprite, shine);
    this.startGlow = glow;
    this.startShine = shine;
    this.startShineWidth = width;
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointerdown', () => c.scale.set(0.985));
    c.on('pointerup', () => c.scale.set(1));
    c.on('pointerupoutside', () => c.scale.set(1));
    return c;
  }

  private sidePlayButton(iconText: string, text: string, accent: number) {
    const c = new Container();
    c.addChild(this.flatPanel(116, 118, 0x10245c, accent));
    const icon = label(iconText, 42);
    icon.anchor.set(0.5);
    icon.x = 58;
    icon.y = 42;
    const title = label(text, 22, palette.white, '900');
    title.anchor.set(0.5);
    title.x = 58;
    title.y = 86;
    c.addChild(icon, title);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private featureCard(width: number, kind: 'scout' | 'squad') {
    const c = new Container();
    const frames = {
      scout: new Rectangle(24, 85, 494, 243),
      squad: new Rectangle(548, 86, 496, 243)
    };
    const base = Texture.from('/assets/ui/bottom-menu.png');
    const frame = frames[kind];
    const sprite = new Sprite(new Texture({ source: base.source, frame }));
    sprite.width = width;
    sprite.height = width * (frame.height / frame.width);
    c.addChild(sprite);
    if (kind === 'scout') {
      const sub = label('2次球探机会', 20, 0xd9e7ff, '900');
      sub.x = width * 0.09;
      sub.y = width * 0.24;
      c.addChild(sub);
    } else {
      const formation = label('4-3-3', 20, 0xdfffea, '900');
      formation.x = width * 0.09;
      formation.y = width * 0.23;
      const powerBg = new Graphics();
      powerBg.roundRect(width * 0.08, width * 0.34, width * 0.34, width * 0.13, 12);
      powerBg.fill({ color: 0x061a12, alpha: 0.78 });
      powerBg.stroke({ color: 0x4edc72, alpha: 0.48, width: 2 });
      const power = label('792 战力', 19, palette.white, '900');
      power.x = width * 0.12;
      power.y = width * 0.36;
      c.addChild(formation, powerBg, power);
    }
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private drawGiftPack() {
    const c = new Container();
    c.x = this.game.width - 232;
    c.y = this.game.height - 620;
    const glow = new Graphics();
    glow.roundRect(-8, -8, 194, 122, 24);
    glow.fill({ color: 0xffd632, alpha: 0.22 });
    const bg = new Graphics();
    bg.roundRect(0, 22, 178, 92, 22);
    bg.fill({ color: 0x4d1d83, alpha: 0.86 });
    bg.stroke({ color: 0xffd632, alpha: 0.8, width: 3 });
    const gift = label('🎁', 62);
    gift.anchor.set(0.5);
    gift.x = 88;
    gift.y = 38;
    const title = label('新手礼包', 32, 0xfff0ff, '900');
    title.anchor.set(0.5);
    title.x = 88;
    title.y = 78;
    const sub = label('限时领取', 19, 0xfff0b3, '900');
    sub.anchor.set(0.5);
    sub.x = 88;
    sub.y = 103;
    c.addChild(glow, bg, gift, title, sub);
    this.container.addChild(c);
  }

  private drawBottomNav() {
    const navH = 104;
    const y = this.game.height - navH;
    const bg = new Graphics();
    bg.rect(0, y, this.game.width, navH);
    bg.fill({ color: 0x071126, alpha: 0.94 });
    bg.stroke({ color: 0x4d7dff, alpha: 0.28, width: 2 });
    this.container.addChild(bg);
    const items = [
      { icon: '⌂', text: '首页', active: true },
      { icon: '盾', text: '比赛', active: false },
      { icon: '⚽', text: '球队', active: false },
      { icon: '★', text: '成就', active: false },
      { icon: '人', text: '我的', active: false }
    ];
    const gap = this.game.width / items.length;
    items.forEach((item, index) => {
      const x = gap * index + gap / 2;
      const color = item.active ? 0xffd632 : 0xb8c8ff;
      const icon = label(item.icon, item.active ? 36 : 28, color, '900');
      icon.anchor.set(0.5);
      icon.x = x;
      icon.y = y + 34;
      const text = label(item.text, 20, color, '900');
      text.anchor.set(0.5);
      text.x = x;
      text.y = y + 74;
      this.container.addChild(icon, text);
    });
  }

  private smallRewardButton() {
    const c = new Container();
    c.addChild(this.flatPanel(118, 50, 0x982f35, 0xffd36b));
    const title = label('关注领奖', 16, palette.white, '900');
    title.anchor.set(0.5);
    title.x = 68;
    title.y = 16;
    const sub = label('+100', 14, 0xfff0b3, '900');
    sub.anchor.set(0.5);
    sub.x = 68;
    sub.y = 34;
    const icon = label('🎁', 22);
    icon.anchor.set(0.5);
    icon.x = 24;
    icon.y = 25;
    c.addChild(icon, title, sub);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private resourceAmount(value: number) {
    if (value >= 10000) {
      const amount = Math.min(999.9, value / 10000);
      return `${amount.toFixed(1).replace(/\.0$/, '')}万`;
    }
    return String(value);
  }

  private followRewardCapsule() {
    const c = new Container();
    const shadow = new Graphics();
    shadow.roundRect(5, 7, 150, 58, 18);
    shadow.fill({ color: 0x000000, alpha: 0.38 });
    const body = new Graphics();
    body.roundRect(0, 0, 158, 62, 18);
    body.fill({ color: 0xaa1c16, alpha: 0.96 });
    body.stroke({ color: 0xffd86a, alpha: 1, width: 4 });
    const shine = new Graphics();
    shine.roundRect(8, 7, 142, 18, 9);
    shine.fill({ color: 0xffffff, alpha: 0.12 });
    const gift = label('🎁', 30);
    gift.anchor.set(0.5);
    gift.x = 33;
    gift.y = 31;
    const title = label('关注领奖', 25, 0xfff0b3, '900');
    title.x = 62;
    title.y = 9;
    const sub = label('+100', 17, 0xffffff, '900');
    sub.x = 82;
    sub.y = 38;
    const plusBg = new Graphics();
    plusBg.circle(137, 31, 20);
    plusBg.fill({ color: 0xf04a18, alpha: 1 });
    plusBg.stroke({ color: 0xffcf63, alpha: 1, width: 3 });
    const plus = label('+', 32, 0xfff0b3, '900');
    plus.anchor.set(0.5);
    plus.x = 137;
    plus.y = 30;
    c.addChild(shadow, body, shine, gift, title, sub, plusBg, plus);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private sideButton(iconText: string, text: string, badge: number, accent: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, 74, 92, 18);
    bg.fill({ color: 0x071126, alpha: 0.86 });
    bg.stroke({ color: accent, alpha: 0.88, width: 3 });
    const shine = new Graphics();
    shine.roundRect(8, 8, 58, 22, 10);
    shine.fill({ color: 0xffffff, alpha: 0.08 });
    const orb = new Graphics();
    orb.circle(37, 32, 22);
    orb.fill({ color: accent, alpha: 0.84 });
    orb.stroke({ color: 0xffffff, alpha: 0.58, width: 2 });
    const icon = label(iconText, 24, iconText === '✓' ? 0x061126 : palette.white, '900');
    icon.anchor.set(0.5);
    icon.x = 37;
    icon.y = 32;
    const title = label(text, 18, palette.white, '900');
    title.anchor.set(0.5);
    title.x = 37;
    title.y = 68;
    c.addChild(bg, shine, orb, icon, title);
    if (badge > 0) {
      const badgeBg = new Graphics();
      badgeBg.circle(60, 12, 13);
      badgeBg.fill({ color: 0xff3b3b, alpha: 0.96 });
      badgeBg.stroke({ color: 0xffffff, alpha: 0.8, width: 2 });
      const badgeText = label(String(badge), 15, palette.white, '900');
      badgeText.anchor.set(0.5);
      badgeText.x = 60;
      badgeText.y = 12;
      c.addChild(badgeBg, badgeText);
    }
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private leftMenuButton(iconText: string, text: string, accent: number, badge = 0) {
    const c = new Container();
    const glow = new Graphics();
    glow.circle(38, 36, 39);
    glow.fill({ color: accent, alpha: 0.13 });
    const orbShadow = new Graphics();
    orbShadow.circle(40, 39, 36);
    orbShadow.fill({ color: 0x000000, alpha: 0.36 });
    const orb = new Graphics();
    orb.circle(38, 36, 35);
    orb.fill({ color: 0x071947, alpha: 0.97 });
    orb.stroke({ color: 0x6d91ff, alpha: 0.9, width: 3 });
    const orbInner = new Graphics();
    orbInner.circle(38, 36, 29);
    orbInner.fill({ color: 0x0c1d5d, alpha: 0.9 });
    orbInner.stroke({ color: 0xffffff, alpha: 0.14, width: 2 });
    const shine = new Graphics();
    shine.arc(28, 24, 24, Math.PI * 1.08, Math.PI * 1.52);
    shine.stroke({ color: 0xffffff, alpha: 0.55, width: 3 });
    const icon = label(iconText, 34);
    icon.anchor.set(0.5);
    icon.x = 38;
    icon.y = 36;

    const plateShadow = new Graphics();
    plateShadow.roundRect(4, 70, 86, 44, 13);
    plateShadow.fill({ color: 0x000000, alpha: 0.42 });
    const plate = new Graphics();
    plate.roundRect(0, 66, 92, 46, 13);
    plate.fill({ color: 0x061752, alpha: 0.98 });
    plate.stroke({ color: 0x6d91ff, alpha: 0.92, width: 3 });
    const notch = new Graphics();
    notch.moveTo(38, 66);
    notch.lineTo(46, 56);
    notch.lineTo(54, 66);
    notch.closePath();
    notch.fill({ color: 0x061752, alpha: 0.98 });
    notch.stroke({ color: 0x6d91ff, alpha: 0.92, width: 2 });
    const title = label(text, text.length > 3 ? 17 : 24, palette.white, '900');
    title.anchor.set(0.5);
    title.x = 46;
    title.y = 89;

    c.addChild(glow, orbShadow, orb, orbInner, shine, icon, plateShadow, plate, notch, title);
    if (badge > 0) {
      const badgeBg = new Graphics();
      badgeBg.circle(70, 10, 13);
      badgeBg.fill({ color: 0xff3333, alpha: 0.98 });
      badgeBg.stroke({ color: 0xffffff, alpha: 0.86, width: 2 });
      const badgeText = label(String(badge), 15, palette.white, '900');
      badgeText.anchor.set(0.5);
      badgeText.x = 70;
      badgeText.y = 10;
      c.addChild(badgeBg, badgeText);
    }
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private spriteMenuButton(kind: 'sign' | 'task' | 'shop' | 'rank', badge = 0) {
    const frames = {
      sign: new Rectangle(14, 24, 125, 149),
      task: new Rectangle(206, 24, 130, 150),
      shop: new Rectangle(393, 23, 118, 152),
      rank: new Rectangle(577, 22, 123, 154)
    };
    const base = Texture.from('/assets/ui/buttons.png');
    const texture = new Texture({ source: base.source, frame: frames[kind] });
    const c = new Container();
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0);
    sprite.x = 41;
    sprite.y = 0;
    sprite.width = 82;
    sprite.height = 82 * (frames[kind].height / frames[kind].width);
    c.addChild(sprite);
    if (badge > 0) {
      const badgeBg = new Graphics();
      badgeBg.circle(88, 10, 12);
      badgeBg.fill({ color: 0xff3333, alpha: 0.98 });
      badgeBg.stroke({ color: 0xffffff, alpha: 0.86, width: 2 });
      const badgeText = label(String(badge), 15, palette.white, '900');
      badgeText.anchor.set(0.5);
      badgeText.x = 88;
      badgeText.y = 10;
      c.addChild(badgeBg, badgeText);
    }
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private rightSpriteMenuButton(kind: 'gift', text: string) {
    const iconFrames = {
      gift: new Rectangle(21, 24, 113, 113)
    };
    const c = new Container();
    const base = Texture.from('/assets/ui/buttons.png');
    const iconFrame = iconFrames[kind];
    const icon = new Sprite(new Texture({ source: base.source, frame: iconFrame }));
    icon.anchor.set(0.5, 0);
    icon.x = 41;
    icon.y = 0;
    icon.width = 72;
    icon.height = 72;

    const plateShadow = new Graphics();
    plateShadow.roundRect(4, 62, 76, 38, 12);
    plateShadow.fill({ color: 0x000000, alpha: 0.42 });
    const plate = new Graphics();
    plate.roundRect(0, 58, 82, 40, 12);
    plate.fill({ color: 0x061752, alpha: 0.98 });
    plate.stroke({ color: 0x6d91ff, alpha: 0.92, width: 3 });
    const title = label(text, 15, palette.white, '900');
    title.anchor.set(0.5);
    title.x = 41;
    title.y = 78;
    c.addChild(icon, plateShadow, plate, title);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private taskButton(width: number, height: number) {
    const c = new Container();
    const claimable = this.taskItems().filter((task) => task.done && !task.claimed).length;
    c.addChild(this.flatPanel(width, height, 0x081a2d, claimable ? 0xffd632 : 0x68dfff));
    const iconBg = new Graphics();
    iconBg.circle(28, height / 2, 17);
    iconBg.fill({ color: claimable ? 0xffd632 : 0x68dfff, alpha: 0.95 });
    const icon = label('✓', 20, 0x061126, '900');
    icon.anchor.set(0.5);
    icon.x = 28;
    icon.y = height / 2;
    const title = label('每日任务', 22, palette.white, '900');
    title.x = 56;
    title.y = 13;
    const sub = label(claimable ? `${claimable} 个奖励可领取` : this.taskText(), 17, claimable ? 0xfff0b3 : 0xcfe0ff, '900');
    sub.x = 166;
    sub.y = 17;
    const arrow = label('›', 34, 0xfff0b3, '900');
    arrow.anchor.set(0.5);
    arrow.x = width - 28;
    arrow.y = height / 2 - 1;
    c.addChild(iconBg, icon, title, sub, arrow);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private openTaskModal() {
    this.closeTaskModal();
    const modal = new Container();
    modal.eventMode = 'static';

    const mask = new Graphics();
    mask.rect(0, 0, this.game.width, this.game.height);
    mask.fill({ color: 0x020613, alpha: 0.72 });
    mask.eventMode = 'static';
    mask.on('pointertap', () => this.closeTaskModal());
    modal.addChild(mask);

    const w = Math.min(640, this.game.width - 48);
    const h = 548;
    const x = (this.game.width - w) / 2;
    const y = Math.max(118, (this.game.height - h) / 2);
    const panel = new Container();
    panel.x = x;
    panel.y = y;
    panel.addChild(glassPanel(w, h, 0x061126, 0xffd632));

    const title = label('每日任务', 40, 0xfff3b0, '900');
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = 48;
    const sub = label('完成比赛、赢球和抽卡，领取球队成长资源', 20, 0xcfe0ff, '900');
    sub.anchor.set(0.5);
    sub.x = w / 2;
    sub.y = 88;
    panel.addChild(title, sub);

    this.taskItems().forEach((task, index) => {
      const row = this.taskRow(task, w - 48);
      row.x = 24;
      row.y = 126 + index * 116;
      panel.addChild(row);
    });

    const closeHit = new Container();
    closeHit.x = w - 136;
    closeHit.y = h - 68;
    closeHit.addChild(this.flatPanel(112, 48, 0x182443, 0x68dfff));
    const closeText = label('关闭', 21, palette.white, '900');
    closeText.anchor.set(0.5);
    closeText.x = 56;
    closeText.y = 24;
    closeHit.addChild(closeText);
    closeHit.eventMode = 'static';
    closeHit.cursor = 'pointer';
    closeHit.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeTaskModal();
    });
    panel.addChild(closeHit);

    modal.addChild(panel);
    this.taskModal = modal;
    this.container.addChild(modal);
  }

  private closeTaskModal() {
    if (!this.taskModal) return;
    this.container.removeChild(this.taskModal);
    this.taskModal.destroy({ children: true });
    this.taskModal = undefined;
  }

  private taskRow(task: ReturnType<HomeScene['taskItems']>[number], width: number) {
    const c = new Container();
    const accent = task.claimed ? 0x40d990 : task.done ? 0xffd632 : 0x5d80c8;
    c.addChild(this.flatPanel(width, 96, task.done ? 0x102217 : 0x071126, accent));
    const status = new Graphics();
    status.circle(34, 48, 22);
    status.fill({ color: accent, alpha: task.done ? 0.95 : 0.5 });
    status.stroke({ color: 0xffffff, alpha: 0.5, width: 2 });
    const mark = label(task.claimed ? '✓' : task.done ? '!' : String(task.current), task.done ? 24 : 18, task.done ? 0x061126 : palette.white, '900');
    mark.anchor.set(0.5);
    mark.x = 34;
    mark.y = 48;
    const title = label(task.title, 24, palette.white, '900');
    title.x = 72;
    title.y = 18;
    const progress = label(`${task.current}/${task.target} · ${task.rewardText}`, 18, 0xfff0b3, '900');
    progress.x = 72;
    progress.y = 54;
    const btn = this.claimButton(task);
    btn.x = width - 144;
    btn.y = 22;
    c.addChild(status, mark, title, progress, btn);
    return c;
  }

  private claimButton(task: ReturnType<HomeScene['taskItems']>[number]) {
    const c = new Container();
    const enabled = task.done && !task.claimed;
    c.addChild(this.flatPanel(122, 52, enabled ? palette.gold : task.claimed ? 0x16391f : 0x25304a, enabled ? 0xfff6b6 : 0x6d7898));
    const text = label(task.claimed ? '已领取' : enabled ? '领取' : '未完成', enabled ? 22 : 19, enabled ? 0xfff8d2 : 0xcfe0ff, '900');
    text.anchor.set(0.5);
    text.x = 61;
    text.y = 26;
    c.addChild(text);
    c.eventMode = 'static';
    c.cursor = enabled ? 'pointer' : 'default';
    c.on('pointertap', () => {
      if (!enabled) {
        this.game.sound.play('tap');
        return;
      }
      this.claimTask(task.id);
    });
    return c;
  }

  private compact(value: number) {
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
    return String(value);
  }

  private taskText() {
    if (this.game.matchesPlayed < 1) return '今日任务：完成 1 场比赛';
    if (this.game.wins < 1) return '今日任务：赢下 1 场比赛';
    if (this.game.ownedPlayers().length <= 11) return '今日任务：完成 1 次抽卡';
    return '今日任务：保持训练，明天再战';
  }

  private taskRewardText() {
    if (!this.game.claimedTasks.has('play1') && this.game.matchesPlayed >= 1) return '可领取 +1券';
    if (!this.game.claimedTasks.has('win1') && this.game.wins >= 1) return '可领取 +800';
    if (!this.game.claimedTasks.has('scout1') && this.game.ownedPlayers().length > 11) return '可领取 +1券';
    return '+球探券';
  }

  private taskItems() {
    return [
      {
        id: 'play1',
        title: '完成 1 场比赛',
        current: Math.min(1, this.game.matchesPlayed),
        target: 1,
        rewardText: '+1 球探券',
        reward: { scoutTickets: 1 },
        done: this.game.matchesPlayed >= 1,
        claimed: this.game.claimedTasks.has('play1')
      },
      {
        id: 'win1',
        title: '赢下 1 场比赛',
        current: Math.min(1, this.game.wins),
        target: 1,
        rewardText: '+800 金币',
        reward: { coins: 800 },
        done: this.game.wins >= 1,
        claimed: this.game.claimedTasks.has('win1')
      },
      {
        id: 'scout1',
        title: '完成 1 次抽卡',
        current: Math.min(1, Math.max(0, this.game.ownedPlayers().length - 11)),
        target: 1,
        rewardText: '+1 球探券',
        reward: { scoutTickets: 1 },
        done: this.game.ownedPlayers().length > 11,
        claimed: this.game.claimedTasks.has('scout1')
      }
    ];
  }

  private claimTask(taskId: string) {
    const task = this.taskItems().find((item) => item.id === taskId);
    if (!task || !task.done || task.claimed) {
      this.game.sound.play('tap');
      return;
    }
    if (this.game.claimTask(task.id, task.reward)) this.game.sound.play('reward');
    this.closeTaskModal();
    this.resize();
    this.openTaskModal();
  }
}
