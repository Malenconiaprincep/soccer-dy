import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { avatar, coverSprite, glassPanel, label, palette } from '../ui';

const HOME_BG = '/assets/home-bg.jpg';
const TOP_BUTTON = '/assets/ui/top-button.png';
const AVATAR_BG = '/assets/ui/avatar-bg.png';
const AVATAR_RING_FRAME = new Rectangle(291, 118, 503, 503);
const TOP_BAR_FRAME = { width: 1024, height: 289 };
const TOP_GEM_FRAME = new Rectangle(0, 0, TOP_BAR_FRAME.width, TOP_BAR_FRAME.height);
const TOP_ENERGY_FRAME = new Rectangle(TOP_BAR_FRAME.width, 0, TOP_BAR_FRAME.width, TOP_BAR_FRAME.height);
const WEB_AVATAR = '/assets/players/generated/saka.png';
const SIDE_BUTTONS = '/assets/ui/buttons.png';
const SIGN_MODAL_BG = '/assets/ui/qiandao.png';
const SIGN_GIFT_BG = '/assets/ui/sevenday/giftbg.png';
const SIGN_FLASH_ICON = '/assets/ui/sevenday/flash.png';
const SIGN_DIAMOND_ICON = '/assets/ui/sevenday/diamond.png';
const SIGN_TICKET_ICON = '/assets/ui/sevenday/ticket.png';
const SIGN_ACCEPT = '/assets/ui/sevenday/accpet.png';
const SIGN_ACCEPT_FRAME = new Rectangle(56, 218, 959, 218);
const SIGN_ACCEPT_END = '/assets/ui/sevenday/accpet-end.png';
const SIGN_ACCEPT_END_FRAME = new Rectangle(46, 221, 985, 233);
const SIGN_GIFT_CARD_FRAMES = [
  new Rectangle(62, 16, 290, 470),
  new Rectangle(394, 16, 290, 470),
  new Rectangle(726, 16, 290, 470)
] as const;
const SIGN_FLASH_FRAMES = [
  new Rectangle(79, 144, 232, 329),
  new Rectangle(433, 144, 231, 329),
  new Rectangle(771, 144, 231, 328)
] as const;
const SIGN_DIAMOND_FRAMES = [
  new Rectangle(97, 92, 224, 190),
  new Rectangle(423, 90, 229, 193),
  new Rectangle(759, 93, 221, 188)
] as const;
const SIGN_TICKET_FRAMES = [
  new Rectangle(78, 77, 268, 209),
  new Rectangle(418, 79, 266, 207),
  new Rectangle(750, 78, 264, 208)
] as const;
type SignReward = { energy?: number; gems?: number; scoutTickets?: number };
const SIGN_MODAL_RATIO = 1080 / 952;
const SIGN_CARD_SIZE_SCALE = 0.96;
const SIGN_CARD_TOP = 168;
const SIGN_ROW_GAP = 8;
const SIGN_BOTTOM_CARD_HEIGHT_SCALE = 0.9;
const SIDE_BUTTON_CELL = { width: 256, height: 512, cropY: 96, cropSize: 280 };
const SHORTCUT_BTN_W = 88;
const SHORTCUT_ICON = 84;

export class HomeScene extends BaseScene {
  private taskModal?: Container;
  private elapsedMs = 0;
  private startLightSweep?: Container;
  private startLightSweepWidth = 0;
  private floaters: { node: Container; baseY: number; amplitude: number; phase: number }[] = [];

  protected build() {
    this.elapsedMs = 0;
    this.startLightSweep = undefined;
    this.floaters = [];
    this.container.addChild(coverSprite(HOME_BG, this.game.width, this.game.height));
    this.container.eventMode = 'passive';
    this.container.interactiveChildren = true;
    if (this.container.children[0]) this.container.children[0].eventMode = 'none';
    this.drawVignette();
    this.drawTopBar();
    this.drawHeroPlayer();
    this.drawSideShortcuts();
    this.drawCommandDeck();
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  update(deltaMs: number) {
    this.elapsedMs += deltaMs;
    if (this.startLightSweep && this.startLightSweepWidth > 0) {
      const cycle = 3200;
      const progress = (this.elapsedMs % cycle) / cycle;
      const active = progress > 0.12 && progress < 0.78;
      const travel = this.startLightSweepWidth * 1.12;
      const eased = active ? Math.sin(((progress - 0.12) / 0.66) * Math.PI) : 0;
      this.startLightSweep.x = -this.startLightSweepWidth * 0.08 + progress * travel;
      this.startLightSweep.alpha = eased * 0.58;
    }
    this.floaters.forEach((item) => {
      item.node.y = item.baseY + Math.sin(this.elapsedMs * 0.002 + item.phase) * item.amplitude;
    });
  }

  private getHomeTopInset() {
    return Math.max(18, this.game.safeAreaTop + (this.game.isMiniGame ? 6 : 18));
  }

  private drawTopBar() {
    const top = new Container();
    const layout = this.getTopBarLayout();
    const sidePad = 16;
    const zoneRight = this.game.isMiniGame ? layout.contentRight : this.game.width - sidePad;
    top.x = sidePad + Math.max(0, (zoneRight - sidePad - layout.totalWidth) / 2);
    top.y = this.getHomeTopInset();

    const sheet = Texture.from(TOP_BUTTON);
    const barY = (layout.avatarHeight - layout.barHeight) / 2;

    top.addChild(this.drawAvatarBlock(layout.avatarSize));

    const gems = this.topResourceBar(sheet, TOP_GEM_FRAME, this.formatGems(this.game.gems), layout.barWidth, layout.barHeight);
    gems.x = layout.avatarWidth + layout.gap;
    gems.y = barY;
    top.addChild(gems);

    const energy = this.topResourceBar(sheet, TOP_ENERGY_FRAME, `${this.game.energy}/120`, layout.barWidth, layout.barHeight);
    energy.x = layout.avatarWidth + layout.gap + layout.barWidth + layout.gap;
    energy.y = barY;
    top.addChild(energy);

    this.container.addChild(top);
  }

  private getTopBarLayout() {
    const sidePad = 16;
    const gap = 8;
    const contentRight = this.game.isMiniGame
      ? Math.min(this.game.safeContentRight, this.game.width - sidePad)
      : this.game.width - sidePad;
    const maxWidth = Math.max(280, contentRight - sidePad);
    let avatarSize = 96;
    if (this.game.isMiniGame && maxWidth < 500) avatarSize = 88;
    if (this.game.isMiniGame && maxWidth < 440) avatarSize = 80;
    const avatarLayout = this.getAvatarLayout(avatarSize);
    let barWidth = Math.max(120, (maxWidth - avatarLayout.width - gap * 2) / 2);
    const barHeight = barWidth / (TOP_BAR_FRAME.width / TOP_BAR_FRAME.height);
    let totalWidth = avatarLayout.width + gap + barWidth + gap + barWidth;
    if (totalWidth > maxWidth) {
      barWidth = Math.max(108, (maxWidth - avatarLayout.width - gap * 2) / 2);
      totalWidth = avatarLayout.width + gap + barWidth + gap + barWidth;
    }

    return {
      avatarSize,
      avatarWidth: avatarLayout.width,
      avatarHeight: avatarLayout.height,
      barWidth,
      barHeight,
      gap,
      totalWidth,
      contentRight
    };
  }

  private getAvatarLayout(size: number) {
    const scale = size / AVATAR_RING_FRAME.height;
    return {
      width: AVATAR_RING_FRAME.width * scale,
      height: size,
      scale
    };
  }

  private drawAvatarBlock(size: number) {
    const block = new Container();
    const layout = this.getAvatarLayout(size);
    const centerX = layout.width / 2;
    const centerY = layout.height / 2;

    const ring = new Sprite(
      new Texture({
        source: Texture.from(AVATAR_BG).source,
        frame: AVATAR_RING_FRAME
      })
    );
    ring.anchor.set(0.5);
    ring.width = layout.width;
    ring.height = layout.height;
    ring.x = centerX;
    ring.y = centerY;

    const photoWrap = new Container();
    photoWrap.x = centerX;
    photoWrap.y = centerY;
    this.drawTopAvatar(photoWrap, size * 0.64);

    block.addChild(photoWrap, ring);
    return block;
  }

  private topResourceBar(sheet: Texture, frame: Rectangle, valueText: string, barWidth: number, barHeight: number) {
    const c = new Container();
    const bg = new Sprite(new Texture({ source: sheet.source, frame }));
    bg.width = barWidth;
    bg.height = barHeight;

    const value = label(valueText, Math.round(barHeight * 0.36), palette.white, '900');
    value.anchor.set(0.5, 0.5);
    value.x = barWidth * 0.5;
    value.y = barHeight * 0.5;
    const maxTextWidth = barWidth * 0.36;
    if (value.width > maxTextWidth) value.scale.x = maxTextWidth / value.width;

    c.addChild(bg, value);
    c.eventMode = 'none';
    return c;
  }

  private drawTopAvatar(parent: Container, size: number) {
    const photoLayer = new Container();
    const mask = new Graphics();
    mask.circle(0, 0, size / 2);
    mask.fill(0xffffff);

    const mountPhoto = (node: Container | Sprite) => {
      if (node instanceof Sprite) {
        node.anchor.set(0.5);
      } else {
        node.x = -size / 2;
        node.y = -size / 2;
      }
      photoLayer.removeChildren();
      photoLayer.addChild(node, mask);
      photoLayer.mask = mask;
    };

    const fallback = this.game.platform.name === 'web' ? WEB_AVATAR : undefined;
    const url = this.game.user.avatarUrl ?? fallback;
    const drawFallback = () => mountPhoto(avatar(Math.round(size)));

    parent.addChild(photoLayer);
    if (!url) {
      drawFallback();
      return;
    }

    void Assets.load<Texture>(url)
      .then((texture) => {
        const sprite = Sprite.from(texture);
        const scale = Math.max((size * 1.08) / sprite.texture.width, (size * 1.08) / sprite.texture.height);
        sprite.scale.set(scale);
        mountPhoto(sprite);
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
    shade.eventMode = 'none';
    this.container.addChild(shade);
  }

  private drawCommandDeck() {
    const layout = this.getHomeStageLayout();
    const start = this.matchButton(layout.matchW, layout.matchH);
    start.x = (this.game.width - layout.matchW) / 2;
    start.y = layout.matchY;
    start.on('pointerup', () => {
      this.game.sound.play('confirm');
      this.game.clearLineup();
      this.game.changeScene('formation');
    });
    this.container.addChild(start);
  }

  private getHomeStageLayout() {
    const heroTexture = Texture.from('/assets/ui/hero.png');
    const matchTexture = Texture.from('/assets/ui/start.png');
    const matchW = Math.min(436, this.game.width - 220);
    const matchH = matchW * (matchTexture.height / matchTexture.width);
    const bottomPad = 30 + (this.game.isMiniGame ? Math.max(12, this.game.safeAreaBottom) : 0);
    const matchY = this.game.height - matchH - bottomPad;
    const heroAnchorY = matchY + matchH * 0.34;
    const heroTopMin = 192 + this.game.contentTopOffset * 0.04;
    const maxHeroHeight = Math.max(620, heroAnchorY - heroTopMin);
    const maxHeroWidth = this.game.width * 0.96;
    const heroScale = Math.min(maxHeroHeight / heroTexture.height, maxHeroWidth / heroTexture.width);

    return {
      matchW,
      matchH,
      matchY,
      heroScale,
      heroX: this.game.width / 2,
      heroY: heroAnchorY + 190
    };
  }

  private drawHeroPlayer() {
    const layout = this.getHomeStageLayout();
    const sprite = new Sprite(Texture.from('/assets/ui/hero.png'));
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(layout.heroScale);
    sprite.x = layout.heroX;
    sprite.y = layout.heroY;
    sprite.eventMode = 'none';
    this.container.addChild(sprite);
  }

  private drawSideShortcuts() {
    const sidePad = 14;
    const leftX = sidePad;
    const rightX = this.game.width - sidePad - SHORTCUT_BTN_W;
    const startY = this.getHomeTopInset() + 132;
    const itemGap = 14;
    const sign = this.sideShortcutButton(0, '七日签到');
    sign.x = leftX;
    sign.y = startY;
    sign.on('pointertap', () => {
      this.game.sound.play('tap');
      this.openSignModal();
    });
    this.floaters.push({ node: sign, baseY: sign.y, amplitude: 1.4, phase: 0 });
    const shop = this.sideShortcutButton(1, '商城');
    shop.x = leftX;
    shop.y = startY + this.sideShortcutBlockHeight() + itemGap;
    shop.on('pointertap', () => {
      this.game.sound.play('tap');
      this.openShopModal();
    });
    this.floaters.push({ node: shop, baseY: shop.y, amplitude: 1.4, phase: 1.6 });

    const follow = this.sideShortcutButton(2, '关注领奖');
    follow.x = rightX;
    follow.y = startY;
    follow.on('pointertap', () => this.openInfoModal('关注领奖', '关注抖音账号后领取奖励', '功能接入抖音关注能力后开放。'));
    this.floaters.push({ node: follow, baseY: follow.y, amplitude: 1.2, phase: 0.3 });
    const rank = this.sideShortcutButton(3, '排行榜');
    rank.x = rightX;
    rank.y = startY + this.sideShortcutBlockHeight() + itemGap;
    rank.on('pointertap', () => this.openInfoModal('排行榜', '赛季排行榜准备中', '后续会按胜场、胜率和战力展示好友排名。'));
    this.floaters.push({ node: rank, baseY: rank.y, amplitude: 1.2, phase: 1.2 });
    this.container.addChild(sign, shop, follow, rank);
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

  private matchButton(width: number, height: number) {
    const c = new Container();
    const texture = Texture.from('/assets/ui/start.png');
    const radius = height * 0.2;

    const shadow = new Graphics();
    shadow.roundRect(6, 10, width, height, radius);
    shadow.fill({ color: 0x0a1a10, alpha: 0.34 });
    shadow.eventMode = 'none';

    const clipMask = new Graphics();
    clipMask.roundRect(0, 0, width, height, radius);
    clipMask.fill(0xffffff);
    clipMask.eventMode = 'none';

    const sprite = new Sprite(texture);
    sprite.width = width;
    sprite.height = height;
    sprite.eventMode = 'none';

    const lightLayer = new Container();
    lightLayer.eventMode = 'none';
    lightLayer.addChild(this.createStartLightSweep(width, height));

    const btnSurface = new Container();
    btnSurface.eventMode = 'none';
    btnSurface.addChild(clipMask, sprite, lightLayer);
    btnSurface.mask = clipMask;

    c.addChild(shadow, btnSurface);
    this.startLightSweep = lightLayer.children[0] as Container;
    this.startLightSweepWidth = width;
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.interactiveChildren = false;
    c.hitArea = new Rectangle(0, 0, width, height);
    c.on('pointerdown', () => c.scale.set(0.985));
    c.on('pointerup', () => c.scale.set(1));
    c.on('pointerupoutside', () => c.scale.set(1));
    c.on('pointercancel', () => c.scale.set(1));
    return c;
  }

  private createStartLightSweep(width: number, height: number) {
    const sweep = new Container();
    sweep.y = height * 0.52;
    const beam = new Graphics();
    const bandH = height * 0.54;
    const layers = [
      { w: width * 0.18, a: 0.05 },
      { w: width * 0.11, a: 0.1 },
      { w: width * 0.05, a: 0.16 },
    ];
    layers.forEach(({ w, a }) => {
      beam.roundRect(-w / 2, -bandH / 2, w, bandH, Math.min(w * 0.35, bandH * 0.22));
      beam.fill({ color: 0xffffff, alpha: a });
    });
    sweep.addChild(beam);
    sweep.rotation = -0.14;
    return sweep;
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

  private sideShortcutBlockHeight() {
    const iconBottom = SIDE_BUTTON_CELL.cropSize * (SHORTCUT_ICON / SIDE_BUTTON_CELL.width);
    return iconBottom + 30;
  }

  private sideShortcutButton(index: number, caption: string) {
    const c = new Container();
    const base = Texture.from(SIDE_BUTTONS);
    const frame = new Rectangle(
      index * SIDE_BUTTON_CELL.width,
      SIDE_BUTTON_CELL.cropY,
      SIDE_BUTTON_CELL.width,
      SIDE_BUTTON_CELL.cropSize
    );
    const scale = SHORTCUT_ICON / SIDE_BUTTON_CELL.width;
    const icon = new Sprite(new Texture({ source: base.source, frame }));
    icon.anchor.set(0.5, 0);
    icon.scale.set(scale);
    icon.x = SHORTCUT_BTN_W / 2;
    icon.y = 0;
    c.addChild(icon);

    const iconBottom = SIDE_BUTTON_CELL.cropSize * scale;
    const title = label(caption, 18, palette.white, '900');
    title.anchor.set(0.5, 0);
    title.x = SHORTCUT_BTN_W / 2;
    title.y = iconBottom + 8;
    c.addChild(title);

    const blockHeight = this.sideShortcutBlockHeight();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.hitArea = new Rectangle(0, 0, SHORTCUT_BTN_W, blockHeight);
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

  private openSignModal() {
    this.closeTaskModal();
    const modal = this.createModalBase();
    const w = Math.min(636, this.game.width - 28);
    const h = Math.min(this.game.height - 76, w * SIGN_MODAL_RATIO);
    const panel = this.signModalPanel(w, h);
    const scale = Math.min(w / 636, h / 722);
    const cardScale = scale * SIGN_CARD_SIZE_SCALE;

    const rewards = [
      { day: 1, reward: { energy: 30 } },
      { day: 2, reward: { gems: 20 } },
      { day: 3, reward: { scoutTickets: 1 } },
      { day: 4, reward: { energy: 30 } },
      { day: 5, reward: { gems: 20 } },
      { day: 6, reward: { scoutTickets: 1 } },
      { day: 7, reward: { energy: 50 } }
    ];
    const todayKey = new Date().toISOString().slice(0, 10);
    const signDay = this.game.signInDayForDebug();
    const todayReward = rewards.find((item) => item.day === signDay) ?? rewards[0];
    const claimId = `signin-${todayKey}-day${signDay}`;
    const claimedToday = this.game.claimedTasks.has(claimId);

    rewards.forEach((item, index) => {
      const isToday = item.day === signDay;
      const isClaimed = item.day < signDay || (isToday && claimedToday);
      const card = this.signRewardCard(item.day, item.reward, isToday, isClaimed, cardScale);
      const layout = this.signCardLayout(index, scale, cardScale);
      card.x = layout.x;
      card.y = layout.y;
      panel.addChild(card);
    });

    const buttonWidth = 360 * scale;
    const acceptFrame = claimedToday ? SIGN_ACCEPT_END_FRAME : SIGN_ACCEPT_FRAME;
    const buttonHeight = buttonWidth * (acceptFrame.height / acceptFrame.width);
    const button = this.signAcceptButton(buttonWidth, !claimedToday);
    button.x = (w - buttonWidth) / 2;
    button.y = h - buttonHeight - 32 * scale;
    button.on('pointertap', () => {
      if (claimedToday) {
        this.game.sound.play('tap');
        return;
      }
      if (this.game.claimTask(claimId, todayReward.reward)) this.game.sound.play('reward');
      this.closeTaskModal();
      this.resize();
      this.openSignModal();
    });
    panel.addChild(button);
    this.addSignModalCloseHotspot(panel, w, h);

    modal.addChild(panel);
    this.taskModal = modal;
    this.container.addChild(modal);
  }

  private openShopModal() {
    this.closeTaskModal();
    const modal = this.createModalBase();
    const panel = this.shopPage();
    modal.addChild(panel);
    this.taskModal = modal;
    this.container.addChild(modal);
  }

  private openInfoModal(titleText: string, subText: string, bodyText: string) {
    this.closeTaskModal();
    const modal = this.createModalBase();
    const w = Math.min(600, this.game.width - 56);
    const h = 360;
    const panel = this.modalPanel(w, h);
    panel.addChild(this.modalTitle(titleText, subText, w));
    const body = label(bodyText, 24, 0xd7e6ff, '900');
    body.anchor.set(0.5);
    body.x = w / 2;
    body.y = 170;
    body.style.wordWrap = true;
    body.style.wordWrapWidth = w - 86;
    body.style.align = 'center';
    panel.addChild(body);
    this.addModalClose(panel, w, h);
    modal.addChild(panel);
    this.taskModal = modal;
    this.container.addChild(modal);
  }

  private createModalBase() {
    const modal = new Container();
    modal.eventMode = 'passive';
    const mask = new Graphics();
    mask.rect(0, 0, this.game.width, this.game.height);
    mask.fill({ color: 0x020613, alpha: 0.72 });
    mask.eventMode = 'static';
    mask.cursor = 'default';
    mask.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeTaskModal();
    });
    modal.addChild(mask);
    return modal;
  }

  private bindModalPanel(panel: Container, width: number, height: number) {
    panel.eventMode = 'static';
    panel.hitArea = new Rectangle(0, 0, width, height);
    return panel;
  }

  private modalPanel(width: number, height: number) {
    const panel = new Container();
    panel.x = (this.game.width - width) / 2;
    panel.y = Math.max(92, (this.game.height - height) / 2);
    panel.addChild(glassPanel(width, height, 0x061126, 0xffd632));
    return this.bindModalPanel(panel, width, height);
  }

  private signModalPanel(width: number, height: number) {
    const panel = new Container();
    panel.x = (this.game.width - width) / 2;
    panel.y = Math.max(28, (this.game.height - height) / 2);
    const fallback = new Graphics();
    fallback.roundRect(0, 0, width, height, 18);
    fallback.fill({ color: 0x061126, alpha: 0.92 });
    fallback.eventMode = 'none';
    const bg = new Sprite(Texture.from(SIGN_MODAL_BG));
    bg.width = width;
    bg.height = height;
    bg.eventMode = 'none';
    panel.addChild(fallback, bg);
    return this.bindModalPanel(panel, width, height);
  }

  private addSignModalCloseHotspot(panel: Container, width: number, height: number) {
    const closeHit = new Container();
    closeHit.x = width * 0.84;
    closeHit.y = height * 0.018;
    closeHit.hitArea = new Rectangle(0, 0, width * 0.14, height * 0.11);
    closeHit.eventMode = 'static';
    closeHit.cursor = 'pointer';
    closeHit.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeTaskModal();
    });
    panel.addChild(closeHit);
  }

  private modalTitle(titleText: string, subText: string, width: number) {
    const c = new Container();
    const title = label(titleText, 40, 0xfff3b0, '900');
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = 48;
    const sub = label(subText, 20, 0xcfe0ff, '900');
    sub.anchor.set(0.5);
    sub.x = width / 2;
    sub.y = 88;
    c.addChild(title, sub);
    return c;
  }

  private addModalClose(panel: Container, width: number, height: number, buttonWidth = 112, buttonHeight = 48) {
    const closeHit = new Container();
    closeHit.x = width - buttonWidth - 24;
    closeHit.y = height - buttonHeight - 20;
    closeHit.addChild(this.flatPanel(buttonWidth, buttonHeight, 0x182443, 0x68dfff));
    const closeText = label('关闭', Math.round(buttonHeight * 0.44), palette.white, '900');
    closeText.anchor.set(0.5);
    closeText.x = buttonWidth / 2;
    closeText.y = buttonHeight / 2;
    closeHit.addChild(closeText);
    closeHit.eventMode = 'static';
    closeHit.cursor = 'pointer';
    closeHit.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeTaskModal();
    });
    panel.addChild(closeHit);
  }

  private signCardLayout(index: number, panelScale: number, cardScale = panelScale) {
    const topStart = SIGN_CARD_TOP * panelScale;
    const rowGap = SIGN_ROW_GAP * panelScale;
    const topW = 132 * cardScale;
    const topGap = 14 * cardScale;
    const topH = topW * (SIGN_GIFT_CARD_FRAMES[0].height / SIGN_GIFT_CARD_FRAMES[0].width);
    const bottomW = 148 * cardScale;
    const bottomGap = 16 * cardScale;
    const bottomStart = topStart + topH + rowGap;

    const panelWidth = 636 * panelScale;

    if (index < 4) {
      const topRowWidth = topW * 4 + topGap * 3;
      return {
        x: Math.round((panelWidth - topRowWidth) / 2 + index * (topW + topGap)),
        y: Math.round(topStart)
      };
    }
    const rowWidth = bottomW * 3 + bottomGap * 2;
    return {
      x: Math.round((panelWidth - rowWidth) / 2 + (index - 4) * (bottomW + bottomGap)),
      y: Math.round(bottomStart)
    };
  }

  private signRewardCard(day: number, reward: SignReward, today: boolean, claimed: boolean, scale = 1) {
    const w = (day >= 5 ? 148 : 132) * scale;
    const aspect = SIGN_GIFT_CARD_FRAMES[0].height / SIGN_GIFT_CARD_FRAMES[0].width;
    const h = w * aspect * (day >= 5 ? SIGN_BOTTOM_CARD_HEIGHT_SCALE : 1);
    const stateIndex = claimed ? 2 : today ? 0 : 1;
    return this.signGiftCard(day, reward, stateIndex, w, h);
  }

  private signGiftCard(day: number, reward: SignReward, stateIndex: number, width: number, height: number) {
    const c = new Container();
    const cardW = Math.round(width);
    const cardH = Math.round(height);
    const base = Texture.from(SIGN_GIFT_BG);
    const frame = SIGN_GIFT_CARD_FRAMES[stateIndex] ?? SIGN_GIFT_CARD_FRAMES[1];
    const sprite = new Sprite(new Texture({
      source: base.source,
      frame
    }));
    const bgScale = cardW / frame.width;
    sprite.scale.set(bgScale);
    sprite.x = 0;
    sprite.y = Math.round((cardH - frame.height * bgScale) / 2);
    sprite.roundPixels = true;
    c.addChild(sprite);

    const contentOffsetY = cardH * 0.03;
    const tone = stateIndex === 0 ? 0xfff3a3 : stateIndex === 1 ? 0x57b9ff : 0xd7dbe5;
    const dayText = label(`第${day}天`, Math.round(cardW * 0.15), tone, '900');
    dayText.anchor.set(0.5);
    dayText.x = cardW / 2;
    dayText.y = cardH * 0.10 + contentOffsetY;
    dayText.roundPixels = true;
    c.addChild(dayText);

    const icon = this.signRewardIcon(reward, cardW * 0.44, stateIndex);
    icon.x = cardW / 2;
    icon.y = cardH * 0.37 + contentOffsetY;
    icon.alpha = stateIndex === 2 ? 0.62 : 1;
    c.addChild(icon);

    const rewardText = label(this.signRewardText(reward), Math.round(cardW * 0.12), stateIndex === 2 ? 0xd5d8df : palette.white, '900');
    rewardText.anchor.set(0.5);
    rewardText.x = cardW / 2;
    rewardText.y = cardH * (day >= 5 ? 0.54 : 0.63) + contentOffsetY;
    rewardText.roundPixels = true;
    c.addChild(rewardText);
    return c;
  }

  private signRewardText(reward: SignReward) {
    if (reward.energy) return `体力值 +${reward.energy}`;
    if (reward.gems) return `钻石 +${reward.gems}`;
    if (reward.scoutTickets) return `抽卡券 +${reward.scoutTickets}`;
    return '';
  }

  private signRewardIcon(reward: SignReward, size: number, stateIndex: number) {
    if (reward.energy) return this.signEnergyIcon(size, stateIndex);
    if (reward.gems) return this.signGemIcon(size, stateIndex);
    return this.signTicketIcon(size, stateIndex);
  }

  private signEnergyIcon(size: number, stateIndex: number) {
    const base = Texture.from(SIGN_FLASH_ICON);
    const frame = SIGN_FLASH_FRAMES[stateIndex] ?? SIGN_FLASH_FRAMES[1];
    const sprite = new Sprite(new Texture({
      source: base.source,
      frame
    }));
    const scale = size / Math.max(frame.width, frame.height);
    sprite.width = frame.width * scale;
    sprite.height = frame.height * scale;
    sprite.anchor.set(0.5);
    return sprite;
  }

  private signGemIcon(size: number, stateIndex: number) {
    const base = Texture.from(SIGN_DIAMOND_ICON);
    const frame = SIGN_DIAMOND_FRAMES[stateIndex] ?? SIGN_DIAMOND_FRAMES[1];
    const sprite = new Sprite(new Texture({
      source: base.source,
      frame
    }));
    const scale = size / Math.max(frame.width, frame.height);
    sprite.width = frame.width * scale;
    sprite.height = frame.height * scale;
    sprite.anchor.set(0.5);
    return sprite;
  }

  private signTicketIcon(size: number, stateIndex: number) {
    const base = Texture.from(SIGN_TICKET_ICON);
    const frame = SIGN_TICKET_FRAMES[stateIndex] ?? SIGN_TICKET_FRAMES[1];
    const sprite = new Sprite(new Texture({
      source: base.source,
      frame
    }));
    const scale = (size * 1.15) / Math.max(frame.width, frame.height);
    sprite.width = frame.width * scale;
    sprite.height = frame.height * scale;
    sprite.anchor.set(0.5);
    return sprite;
  }

  private shopPage() {
    const c = new Container();
    c.eventMode = 'static';
    c.hitArea = new Rectangle(0, 0, this.game.width, this.game.height);

    const bg = new Graphics();
    bg.rect(0, 0, this.game.width, this.game.height);
    bg.fill({ color: 0x020a1d, alpha: 0.96 });
    c.addChild(bg);

    const bgImage = coverSprite(HOME_BG, this.game.width, this.game.height);
    bgImage.alpha = 0.42;
    bgImage.eventMode = 'none';
    c.addChild(bgImage);

    const blueWash = new Graphics();
    blueWash.rect(0, 0, this.game.width, this.game.height);
    blueWash.fill({ color: 0x001747, alpha: 0.46 });
    c.addChild(blueWash);

    const scale = Math.min(this.game.width / 720, this.game.height / 1180, 1);
    const contentW = Math.min(660 * scale, this.game.width - 40 * scale);
    const left = (this.game.width - contentW) / 2;
    let y = Math.max(22 * scale, this.game.safeAreaTop + 18 * scale);

    c.addChild(this.shopHeader(left, y, contentW, scale));
    y += 136 * scale;

    const feature = this.shopFeatureCard(contentW, 260 * scale, scale);
    feature.x = left;
    feature.y = y;
    c.addChild(feature);
    y += 296 * scale;

    const section = this.shopSectionTitle('常用道具', scale);
    section.x = left;
    section.y = y;
    c.addChild(section);
    y += 58 * scale;

    const rows = [
      { id: 'energy', title: '体力补给', sub: '恢复 30 点体力', cost: 20, limit: '今日限购 5/5', icon: 'energy' as const, reward: { energy: 30 } },
      { id: 'ticket1', title: '球探券 ×1', sub: '用于招募随机球员', cost: 30, limit: '今日限购 10/10', icon: 'ticket' as const, reward: { scoutTickets: 1 } },
      { id: 'gems100', title: '钻石 ×100', sub: '游戏通用货币', priceText: '¥6', limit: '今日限购 1/1', icon: 'gems' as const, reward: { gems: 100 } }
    ];

    rows.forEach((item) => {
      const row = this.shopItemRow(item, contentW, 150 * scale, scale);
      row.x = left;
      row.y = y;
      c.addChild(row);
      y += 170 * scale;
    });

    const footer = label('ⓘ 适度娱乐，理性消费', Math.round(22 * scale), 0x8ea6c9, '900');
    footer.anchor.set(0.5);
    footer.x = this.game.width / 2;
    footer.y = Math.min(this.game.height - 30 * scale, y + 8 * scale);
    c.addChild(footer);

    return c;
  }

  private shopHeader(x: number, y: number, width: number, scale: number) {
    const c = new Container();
    const back = new Container();
    const backBg = new Graphics();
    const backSize = 70 * scale;
    backBg.poly([12 * scale, 0, backSize - 12 * scale, 0, backSize, 12 * scale, backSize, backSize - 12 * scale, backSize - 12 * scale, backSize, 12 * scale, backSize, 0, backSize - 12 * scale, 0, 12 * scale]);
    backBg.fill({ color: 0x08245c, alpha: 0.9 });
    backBg.stroke({ color: 0x29b7ff, alpha: 0.95, width: 2 * scale });
    const arrow = label('←', Math.round(46 * scale), palette.white, '900');
    arrow.anchor.set(0.5);
    arrow.x = backSize / 2;
    arrow.y = backSize / 2 - 2 * scale;
    back.addChild(backBg, arrow);
    back.eventMode = 'static';
    back.cursor = 'pointer';
    back.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeTaskModal();
    });
    c.addChild(back);

    const title = label('商城', Math.round(62 * scale), palette.white, '900');
    title.x = 104 * scale;
    title.y = 2 * scale;
    title.style.dropShadow = { color: 0x1a6dff, blur: 6 * scale, distance: 3 * scale, alpha: 0.9, angle: Math.PI / 2 };
    const store = label('STORE', Math.round(24 * scale), 0x6ca7ff, '900');
    store.x = 304 * scale;
    store.y = 44 * scale;
    c.addChild(title, store);

    const resource = this.shopResourcePill(200 * scale, 58 * scale, scale);
    resource.x = Math.max(0, width - 210 * scale);
    resource.y = 8 * scale;
    c.addChild(resource);

    c.x = x;
    c.y = y;
    return c;
  }

  private shopResourcePill(width: number, height: number, scale: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, height / 2);
    bg.fill({ color: 0x06152f, alpha: 0.92 });
    bg.stroke({ color: 0x2c73ff, alpha: 0.9, width: 2 * scale });
    c.addChild(bg);
    const gem = this.signGemIcon(44 * scale, 1);
    gem.x = 38 * scale;
    gem.y = height / 2;
    const count = label(String(this.game.gems), Math.round(26 * scale), palette.white, '900');
    count.anchor.set(0.5);
    count.x = width * 0.58;
    count.y = height / 2;
    const plus = label('+', Math.round(38 * scale), palette.white, '900');
    plus.anchor.set(0.5);
    plus.x = width - 28 * scale;
    plus.y = height / 2 - 1 * scale;
    c.addChild(gem, count, plus);
    return c;
  }

  private shopFeatureCard(width: number, height: number, scale: number) {
    const item = { id: 'ticket5', title: '球探券 ×5', sub: '用于招募随机球员', cost: 120, reward: { scoutTickets: 5 } };
    const c = new Container();
    const bg = new Graphics();
    bg.poly([16 * scale, 0, width - 16 * scale, 0, width, 18 * scale, width, height - 18 * scale, width - 16 * scale, height, 16 * scale, height, 0, height - 18 * scale, 0, 18 * scale]);
    bg.fill({ color: 0x160d09, alpha: 0.86 });
    bg.stroke({ color: 0xffc627, alpha: 0.95, width: 2.5 * scale });
    c.addChild(bg);

    const title = label('每日特惠', Math.round(46 * scale), 0xfff6cf, '900');
    title.x = 54 * scale;
    title.y = 44 * scale;
    const name = label(item.title, Math.round(34 * scale), palette.white, '900');
    name.x = 64 * scale;
    name.y = 110 * scale;
    const sub = label(item.sub, Math.round(22 * scale), 0xf5f0e4, '900');
    sub.x = 64 * scale;
    sub.y = 154 * scale;
    c.addChild(title, name, sub);

    const ticket = this.signTicketIcon(180 * scale, 1);
    ticket.x = width * 0.68;
    ticket.y = height * 0.42;
    ticket.rotation = -0.04;
    c.addChild(ticket);

    const badge = new Graphics();
    badge.circle(width - 72 * scale, 60 * scale, 38 * scale);
    badge.fill({ color: 0xffd632, alpha: 0.96 });
    badge.stroke({ color: 0xfff5aa, alpha: 0.95, width: 2 * scale });
    const badgeText = label('8折', Math.round(30 * scale), 0x2a1600, '900');
    badgeText.anchor.set(0.5);
    badgeText.x = width - 72 * scale;
    badgeText.y = 60 * scale;
    c.addChild(badge, badgeText);

    const cost = this.shopCostPlate(item.cost, '原价 150', 220 * scale, 54 * scale, scale);
    cost.x = 54 * scale;
    cost.y = height - 82 * scale;
    c.addChild(cost);

    const buy = this.shopBuyButton(172 * scale, 58 * scale, '立即购买', scale);
    buy.x = width - 224 * scale;
    buy.y = height - 84 * scale;
    buy.on('pointertap', () => void this.handleShopPurchase(item));
    c.addChild(buy);

    const timer = label('◷ 刷新倒计时：23:59:59', Math.round(18 * scale), 0xffd66a, '900');
    timer.x = 64 * scale;
    timer.y = height - 34 * scale;
    c.addChild(timer);
    return c;
  }

  private shopSectionTitle(text: string, scale: number) {
    const c = new Container();
    const bars = new Graphics();
    bars.rect(0, 12 * scale, 42 * scale, 8 * scale);
    bars.rect(52 * scale, 12 * scale, 18 * scale, 8 * scale);
    bars.rect(244 * scale, 12 * scale, 18 * scale, 8 * scale);
    bars.rect(272 * scale, 12 * scale, 42 * scale, 8 * scale);
    bars.fill({ color: 0x268dff, alpha: 0.78 });
    const title = label(text, Math.round(30 * scale), palette.white, '900');
    title.x = 84 * scale;
    title.y = -2 * scale;
    c.addChild(bars, title);
    return c;
  }

  private shopItemRow(item: {
    id: string;
    title: string;
    sub: string;
    cost?: number;
    priceText?: string;
    limit: string;
    icon: 'energy' | 'ticket' | 'gems';
    reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number };
  }, width: number, height: number, scale: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.poly([14 * scale, 0, width - 14 * scale, 0, width, 18 * scale, width, height - 18 * scale, width - 14 * scale, height, 14 * scale, height, 0, height - 18 * scale, 0, 18 * scale]);
    bg.fill({ color: 0x06172d, alpha: 0.88 });
    bg.stroke({ color: 0x17c5ff, alpha: 0.96, width: 2.5 * scale });
    c.addChild(bg);

    const icon = item.icon === 'energy' ? this.signEnergyIcon(100 * scale, 1) : item.icon === 'ticket' ? this.signTicketIcon(112 * scale, 1) : this.shopGemStack(118 * scale);
    icon.x = 116 * scale;
    icon.y = height / 2 + 2 * scale;
    c.addChild(icon);

    const title = label(item.title, Math.round(30 * scale), palette.white, '900');
    title.x = 230 * scale;
    title.y = 28 * scale;
    const sub = label(item.sub, Math.round(21 * scale), 0xb8dcff, '900');
    sub.x = 230 * scale;
    sub.y = 72 * scale;
    c.addChild(title, sub);

    const price = item.priceText ? label(item.priceText, Math.round(30 * scale), palette.white, '900') : this.shopDiamondPrice(item.cost ?? 0, scale);
    price.x = 230 * scale;
    price.y = 108 * scale;
    c.addChild(price);

    const buy = this.shopBuyButton(150 * scale, 56 * scale, '购买', scale);
    buy.x = width - 196 * scale;
    buy.y = 34 * scale;
    buy.on('pointertap', () => {
      if (item.priceText) {
        this.game.sound.play('tap');
        this.closeTaskModal();
        this.resize();
        this.openInfoModal('暂未开放', item.title, '付费购买接入后开放。');
        return;
      }
      void this.handleShopPurchase({ id: item.id, title: item.title, cost: item.cost ?? 0, reward: item.reward });
    });
    const limit = label(item.limit, Math.round(18 * scale), 0x9ec9ff, '900');
    limit.anchor.set(0.5);
    limit.x = buy.x + 75 * scale;
    limit.y = 110 * scale;
    c.addChild(buy, limit);
    return c;
  }

  private shopCostPlate(cost: number, oldText: string, width: number, height: number, scale: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.poly([18 * scale, 0, width, 0, width - 18 * scale, height, 0, height]);
    bg.fill({ color: 0x071326, alpha: 0.72 });
    bg.stroke({ color: 0x5c7ea8, alpha: 0.28, width: 1 * scale });
    c.addChild(bg);
    c.addChild(this.shopDiamondPrice(cost, scale));
    const old = label(oldText, Math.round(20 * scale), 0xb0a7a0, '900');
    old.x = 126 * scale;
    old.y = 14 * scale;
    const slash = new Graphics();
    slash.moveTo(126 * scale, 32 * scale);
    slash.lineTo(208 * scale, 22 * scale);
    slash.stroke({ color: 0xe84035, alpha: 0.85, width: 2 * scale });
    c.addChild(old, slash);
    return c;
  }

  private shopDiamondPrice(cost: number, scale: number) {
    const c = new Container();
    const gem = this.signGemIcon(34 * scale, 1);
    gem.x = 20 * scale;
    gem.y = 26 * scale;
    const text = label(String(cost), Math.round(30 * scale), 0xffd632, '900');
    text.x = 52 * scale;
    text.y = 8 * scale;
    c.addChild(gem, text);
    return c;
  }

  private shopBuyButton(width: number, height: number, text: string, scale: number) {
    const c = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 10 * scale);
    bg.fill({ color: 0xf4b322, alpha: 1 });
    bg.stroke({ color: 0xfff2a8, alpha: 0.95, width: 2 * scale });
    const shine = new Graphics();
    shine.roundRect(8 * scale, 6 * scale, width - 16 * scale, 15 * scale, 8 * scale);
    shine.fill({ color: 0xffffff, alpha: 0.22 });
    const labelText = label(text, Math.round(26 * scale), 0x3a2100, '900');
    labelText.anchor.set(0.5);
    labelText.x = width / 2;
    labelText.y = height / 2;
    c.addChild(bg, shine, labelText);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private shopGemStack(size: number) {
    const c = new Container();
    const backLeft = this.signGemIcon(size * 0.72, 1);
    backLeft.x = -size * 0.24;
    backLeft.y = size * 0.12;
    const backRight = this.signGemIcon(size * 0.72, 1);
    backRight.x = size * 0.24;
    backRight.y = size * 0.12;
    const front = this.signGemIcon(size * 0.82, 1);
    front.x = 0;
    front.y = -size * 0.08;
    c.addChild(backLeft, backRight, front);
    return c;
  }

  private async handleShopPurchase(item: { id: string; title: string; cost: number; reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number } }) {
    this.game.sound.play('tap');
    const result = await this.game.purchaseShopItem(item);
    if (!result.ok) {
      this.closeTaskModal();
      this.resize();
      this.openInfoModal('购买失败', '未能完成本次购买', result.message ?? '请稍后再试。');
      return;
    }
    this.game.sound.play('reward');
    this.closeTaskModal();
    this.resize();
    this.openInfoModal('购买成功', item.title, '道具已发放到当前账号。');
  }

  private shopGoodsRow(item: { id: string; title: string; sub: string; cost: number; reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number } }, width: number) {
    const c = new Container();
    c.addChild(this.flatPanel(width, 88, 0x071826, 0x68dfff));
    const title = label(item.title, 25, palette.white, '900');
    title.x = 22;
    title.y = 14;
    const sub = label(item.sub, 18, 0xcfe0ff, '900');
    sub.x = 22;
    sub.y = 48;
    const cost = label(`${item.cost} 钻`, 22, 0xfff3b0, '900');
    cost.anchor.set(1, 0);
    cost.x = width - 146;
    cost.y = 18;
    const buy = this.modalButton('购买', true, 104, 44);
    buy.x = width - 122;
    buy.y = 22;
    buy.on('pointertap', async () => {
      this.game.sound.play('tap');
      const result = await this.game.purchaseShopItem(item);
      if (!result.ok) {
        this.closeTaskModal();
        this.resize();
        this.openInfoModal('购买失败', '未能完成本次购买', result.message ?? '请稍后再试。');
        return;
      }
      this.game.sound.play('reward');
      this.closeTaskModal();
      this.resize();
      this.openInfoModal('购买成功', item.title, '道具已发放到当前账号。');
    });
    c.addChild(title, sub, cost, buy);
    return c;
  }

  private signAcceptButton(width: number, enabled: boolean) {
    const c = new Container();
    const frame = enabled ? SIGN_ACCEPT_FRAME : SIGN_ACCEPT_END_FRAME;
    const path = enabled ? SIGN_ACCEPT : SIGN_ACCEPT_END;
    const height = width * (frame.height / frame.width);
    const base = Assets.get<Texture>(path);
    const sprite = new Sprite(new Texture({
      source: base.source,
      frame
    }));
    sprite.width = width;
    sprite.height = height;
    c.addChild(sprite);
    c.hitArea = new Rectangle(0, 0, width, height);
    c.eventMode = 'static';
    c.cursor = enabled ? 'pointer' : 'default';
    return c;
  }

  private modalButton(text: string, enabled: boolean, width = 240, height = 56) {
    const c = new Container();
    c.addChild(this.flatPanel(width, height, enabled ? palette.gold : 0x25304a, enabled ? 0xfff6b6 : 0x6d7898));
    const title = label(text, 22, enabled ? 0xfff8d2 : 0xcfe0ff, '900');
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = height / 2;
    c.addChild(title);
    c.eventMode = 'static';
    c.cursor = enabled ? 'pointer' : 'default';
    return c;
  }

  private openTaskModal() {
    this.closeTaskModal();
    const modal = this.createModalBase();

    const w = Math.min(640, this.game.width - 48);
    const h = 548;
    const panel = this.modalPanel(w, h);

    panel.addChild(this.modalTitle('每日任务', '完成比赛、赢球和抽卡，领取球队成长资源', w));

    this.taskItems().forEach((task, index) => {
      const row = this.taskRow(task, w - 48);
      row.x = 24;
      row.y = 126 + index * 116;
      panel.addChild(row);
    });

    this.addModalClose(panel, w, h);

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
