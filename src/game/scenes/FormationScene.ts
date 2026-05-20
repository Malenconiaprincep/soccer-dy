import { Container, FederatedPointerEvent, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { formations, players } from '../data';
import type { FormationData, LineupSlot, PlayerCardData, Position, Rarity } from '../types';
import { coverSprite, glassPanel, label, palette } from '../ui';

export class FormationScene extends BaseScene {
  private field?: Container;
  private modal?: Container;
  private modalSlotId?: string;
  private modalCandidates: PlayerCardData[] = [];
  private revealed = new Set<string>();
  private modalTime = 0;
  private revealPulse = 0;
  private revealTargetId?: string;
  private formationPage = 0;
  private formationSwipe?: {
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    triggered: boolean;
  };
  private ignoreNextFormationTap = false;
  private warehousePage = 0;
  private warehouseFilter?: Position;
  private warehouseScrollY = 0;
  private warehouseDrag?: {
    pointerId: number;
    startY: number;
    startScrollY: number;
  };
  private formationCenterIndex = -1;
  private formationCarousel?: Container;
  private formationSlide?: {
    direction: number;
    started: number;
    distance: number;
  };

  protected build() {
    this.container.addChild(this.formationBackground());
    this.drawHeader();
    this.drawDebugAutofill();
    this.drawFormationCards();
    this.drawField();
    this.drawBench();
  }

  resize() {
    this.container.removeChildren();
    this.build();
  }

  update(deltaMs: number) {
    this.modalTime += deltaMs;
    this.animateFormationSlide();
    if (this.revealPulse > 0) {
      this.revealPulse = Math.max(0, this.revealPulse - deltaMs);
    }
    if (this.modal) this.animateModalCards();
  }

  private formationBackground() {
    const bg = new Container();
    bg.addChild(coverSprite('/assets/home-stadium-bg.png', this.game.width, this.game.height));
    const shade = new Graphics();
    shade.rect(0, 0, this.game.width, this.game.height);
    shade.fill({ color: 0x02081b, alpha: 0.16 });
    shade.rect(0, 0, this.game.width, 330 + this.game.contentTopOffset * 0.35);
    shade.fill({ color: 0x02081b, alpha: 0.08 });
    shade.rect(0, this.game.height * 0.72, this.game.width, this.game.height * 0.28);
    shade.fill({ color: 0x02081b, alpha: 0.04 });
    const lift = new Graphics();
    lift.rect(0, this.game.height * 0.38, this.game.width, this.game.height * 0.62);
    lift.fill({ color: 0x1b63ff, alpha: 0.05 });
    bg.addChild(shade);
    bg.addChild(lift);
    return bg;
  }

  private drawHeader() {
    const shift = this.game.contentTopOffset * 0.26;
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
    this.container.addChild(back);

    const title = label('选择阵容', 44, 0xf2fff7, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = 64 + shift;

    this.container.addChild(title);
  }

  private drawDebugAutofill() {
    const shift = this.game.contentTopOffset * 0.26;
    const w = 132;
    const h = 46;
    const btn = new Container();
    btn.x = this.game.width - w - 28;
    btn.y = 36 + shift;
    btn.addChild(glassPanel(w, h, 0x101b3e, 0x68dfff));

    const title = label('推荐', 16, 0x9fffc6, '900');
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = 15;
    const subtitle = label('最强阵容', 18, palette.white, '900');
    subtitle.anchor.set(0.5);
    subtitle.x = w / 2;
    subtitle.y = 31;
    btn.addChild(title, subtitle);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      this.game.sound.play('select');
      this.autoFillLineup();
      this.resize();
    });
    this.container.addChild(btn);
  }

  private drawFormationCards() {
    const shift = this.game.contentTopOffset * 0.66;
    const selectedIndex = formations.findIndex((item) => item.id === this.game.selectedFormation.id);
    if (this.formationCenterIndex < 0) this.formationCenterIndex = Math.max(0, selectedIndex);
    this.formationCenterIndex = Math.max(0, Math.min(formations.length - 1, this.formationCenterIndex));

    const carousel = new Container();
    carousel.hitArea = new Rectangle(0, 92 + shift, this.game.width, 220);
    carousel.eventMode = 'static';
    this.bindFormationSwipe(carousel);
    this.formationCarousel = carousel;

    const sideW = Math.min(174, (this.game.width - 126) / 3.35);
    const sideH = 152;
    const centerW = Math.min(216, sideW * 1.24);
    const centerH = 190;
    const gap = 18;
    const totalW = sideW * 2 + centerW + gap * 2;
    const startX = (this.game.width - totalW) / 2;
    const positions = [
      { index: this.formationCenterIndex - 1, x: startX, y: 116 + shift, w: sideW, h: sideH, center: false },
      { index: this.formationCenterIndex, x: startX + sideW + gap, y: 94 + shift, w: centerW, h: centerH, center: true },
      { index: this.formationCenterIndex + 1, x: startX + sideW + gap + centerW + gap, y: 116 + shift, w: sideW, h: sideH, center: false }
    ];
    positions.forEach((slot) => {
      if (slot.index < 0 || slot.index >= formations.length) return;
      const formation = formations[slot.index];
      const isCenter = slot.center;
      const cardW = isCenter ? centerW : sideW;
      const cardH = isCenter ? centerH : sideH;
      const card = this.formationCard(formation, cardW, cardH, isCenter, slot.index);
      card.x = slot.x;
      card.y = slot.y;
      carousel.addChild(card);
    });
    this.animateFormationSlide();
    this.container.addChild(carousel);
    this.drawFormationPager(shift);
  }

  private drawFormationPager(shift: number) {
    const left = this.pagerButton('‹', 42, 192 + shift, this.formationCenterIndex > 0);
    left.on('pointertap', () => {
      this.centerFormation(this.formationCenterIndex - 1);
    });
    const right = this.pagerButton('›', this.game.width - 42, 192 + shift, this.formationCenterIndex < formations.length - 1);
    right.on('pointertap', () => {
      this.centerFormation(this.formationCenterIndex + 1);
    });
    this.container.addChild(left, right);

  }

  private pagerButton(text: string, x: number, y: number, enabled: boolean) {
    const c = new Container();
    const bg = new Graphics();
    bg.circle(0, 0, 28);
    bg.fill({ color: 0x07120d, alpha: enabled ? 0.76 : 0.32 });
    bg.stroke({ color: enabled ? 0x54ffe4 : 0xffffff, alpha: enabled ? 0.72 : 0.18, width: 2 });
    const icon = label(text, 42, enabled ? palette.white : 0x7b8798, '900');
    icon.anchor.set(0.5);
    icon.y = -2;
    c.x = x;
    c.y = y;
    c.alpha = enabled ? 1 : 0.55;
    c.eventMode = 'static';
    c.cursor = enabled ? 'pointer' : 'default';
    c.addChild(bg, icon);
    return c;
  }

  private bindFormationSwipe(target: Container) {
    target.on('pointerdown', (event: FederatedPointerEvent) => {
      this.formationSwipe = {
        pointerId: event.pointerId,
        startX: event.global.x,
        startY: event.global.y,
        startTime: performance.now(),
        triggered: false
      };
    });

    target.on('pointermove', (event: FederatedPointerEvent) => {
      const swipe = this.formationSwipe;
      if (!swipe || swipe.pointerId !== event.pointerId || swipe.triggered) return;
      const dx = event.global.x - swipe.startX;
      const dy = event.global.y - swipe.startY;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      this.triggerFormationSwipe(dx < 0 ? 1 : -1);
    });

    const finish = (event: FederatedPointerEvent) => {
      const swipe = this.formationSwipe;
      if (!swipe || swipe.pointerId !== event.pointerId) return;
      const dx = event.global.x - swipe.startX;
      const dy = event.global.y - swipe.startY;
      const elapsed = performance.now() - swipe.startTime;
      if (!swipe.triggered && elapsed < 650 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        this.triggerFormationSwipe(dx < 0 ? 1 : -1);
      }
      this.formationSwipe = undefined;
    };

    target.on('pointerup', finish);
    target.on('pointerupoutside', finish);
    target.on('pointercancel', finish);
  }

  private triggerFormationSwipe(direction: number) {
    if (!this.formationSwipe) return;
    this.formationSwipe.triggered = true;
    this.ignoreNextFormationTap = true;
    if (this.centerFormation(this.formationCenterIndex + direction)) {
      globalThis.setTimeout(() => {
        this.ignoreNextFormationTap = false;
      }, 160);
    } else {
      this.ignoreNextFormationTap = false;
    }
  }

  private centerFormation(index: number) {
    const nextIndex = Math.max(0, Math.min(formations.length - 1, index));
    if (nextIndex === this.formationCenterIndex) return false;
    const formation = formations[nextIndex];
    if (formation.locked) return false;
    this.game.sound.play('tap');
    const direction = nextIndex > this.formationCenterIndex ? 1 : -1;
    this.formationCenterIndex = nextIndex;
    this.game.setFormation(formation);
    this.formationSwipe = undefined;
    this.formationSlide = {
      direction,
      started: performance.now(),
      distance: Math.min(216, this.game.width * 0.32)
    };
    this.resize();
    return true;
  }

  private animateFormationSlide() {
    if (!this.formationCarousel || !this.formationSlide) return;
    const elapsed = performance.now() - this.formationSlide.started;
    const t = Math.min(1, elapsed / 240);
    const eased = 1 - Math.pow(1 - t, 3);
    this.formationCarousel.x = (1 - eased) * this.formationSlide.distance * this.formationSlide.direction;
    if (t >= 1) {
      this.formationCarousel.x = 0;
      this.formationSlide = undefined;
    }
  }

  private formationCard(formation: FormationData, w: number, h: number, featured = false, formationIndex = 0) {
    const c = new Container();
    const selected = formation.id === this.game.selectedFormation.id;
    c.addChild(glassPanel(w, h, formation.locked ? 0x271244 : selected ? 0x132417 : 0x07120d, selected ? 0xffd632 : formation.locked ? 0xa560ff : 0x40d990));
    if (selected) {
      const glow = new Graphics();
      glow.roundRect(-7, -7, w + 14, h + 14, 18);
      glow.stroke({ color: 0xffcc2e, alpha: 0.8, width: 4 });
      c.addChild(glow);
    }
    this.drawMiniPitch(c, formation, w, h);
    formation.slots.forEach((slot) => {
      const p = new Graphics();
      const px = 30 + slot.x * (w - 60);
      const py = 24 + slot.y * (h * 0.44);
      p.circle(px, py, featured ? 5 : 4);
      p.fill(slot.position === 'FW' ? 0xffd544 : 0xf4fff6);
      c.addChild(p);
    });
    const name = label(formation.name, featured ? 31 : 26, palette.white, '900');
    name.anchor.set(0.5);
    name.x = w / 2;
    name.y = h * 0.64;
    const style = label(formation.locked ? '看广告解锁' : formation.style, featured ? 22 : 18, formation.locked ? 0xcbd0dc : featured ? 0xffd632 : 0x9fffc6, '900');
    style.anchor.set(0.5);
    style.x = w / 2;
    style.y = h * 0.82;
    c.addChild(name, style);
    c.eventMode = 'static';
    c.cursor = formation.locked ? 'not-allowed' : 'pointer';
    c.on('pointertap', () => {
      if (this.ignoreNextFormationTap) {
        this.ignoreNextFormationTap = false;
        return;
      }
      if (!formation.locked) {
        this.centerFormation(formationIndex);
      }
    });
    return c;
  }

  private drawMiniPitch(target: Container, formation: FormationData, w: number, h: number) {
    const mini = new Graphics();
    const topY = 18;
    const left = 28;
    const right = w - 28;
    const bottomLeft = 18;
    const bottomRight = w - 18;
    const bottomY = Math.min(h * 0.52, h - 58);
    mini.moveTo(left, topY);
    mini.lineTo(right, topY);
    mini.lineTo(bottomRight, bottomY);
    mini.lineTo(bottomLeft, bottomY);
    mini.closePath();
    mini.fill({ color: formation.locked ? 0x3c2764 : 0x19371d, alpha: 0.95 });
    mini.stroke({ color: 0xcffff0, alpha: 0.38, width: 2 });
    for (let i = 1; i < 7; i += 1) {
      const y = topY + (bottomY - topY) * (i / 7);
      mini.moveTo(left - 2 + i, y);
      mini.lineTo(right + 2 - i, y);
      mini.stroke({ color: 0xffffff, alpha: 0.12, width: 1 });
    }
    mini.moveTo(bottomLeft + 10, bottomY - 18);
    mini.lineTo(bottomRight - 10, bottomY - 18);
    mini.stroke({ color: 0xffffff, alpha: 0.18, width: 1 });
    mini.circle(w / 2, topY + (bottomY - topY) * 0.52, 18);
    mini.stroke({ color: 0xffffff, alpha: 0.18, width: 1 });
    target.addChild(mini);
  }

  private drawField() {
    const shift = this.game.contentTopOffset;
    const fieldW = Math.min(this.game.width + 42, 780);
    const fieldH = Math.min(this.game.height - 450, 820);
    const x = (this.game.width - fieldW) / 2;
    const y = 232 + shift;
    this.field = new Container();
    this.field.x = x;
    this.field.y = y;
    const pitch = new Sprite(Texture.from('/assets/ui/football-backgrond.png'));
    pitch.width = fieldW;
    pitch.height = fieldH;
    this.field.addChild(pitch);
    this.game.lineup.forEach((slot) => this.field?.addChild(this.slotNode(slot, fieldW, fieldH)));
    this.container.addChild(this.field);
  }

  private drawBench() {
    const shift = this.game.contentTopOffset;
    const panelW = Math.min(this.game.width - 38, 700);
    const panelH = Math.min(286, panelW * 0.57);
    const x = (this.game.width - panelW) / 2;
    const y = 232 + shift + Math.min(this.game.height - 450, 820) - 44;
    const panel = new Container();
    panel.x = x;
    panel.y = y;

    const texture = Texture.from('/assets/ui/replace_player.png');
    const bg = new Sprite(new Texture({ source: texture.source, frame: new Rectangle(37, 47, 1006, 449) }));
    bg.width = panelW;
    bg.height = panelH;
    panel.addChild(bg);

    const title = label('替补球员', 28, palette.white, '900');
    title.x = 34;
    title.y = 24;
    panel.addChild(title);

    const swapBtn = new Container();
    swapBtn.x = panelW - 184;
    swapBtn.y = 22;
    swapBtn.addChild(glassPanel(142, 40, 0x10245c, 0x20b8ff));
    const swap = label('↔ 全部替补', 19, 0xdffbff, '900');
    swap.anchor.set(0.5);
    swap.x = 71;
    swap.y = 20;
    swapBtn.addChild(swap);
    swapBtn.eventMode = 'static';
    swapBtn.cursor = 'pointer';
    swapBtn.hitArea = new Rectangle(0, 0, 142, 40);
    swapBtn.on('pointertap', () => {
      this.game.sound.play('tap');
      this.warehousePage = 0;
      this.openCardWarehouse();
    });
    panel.addChild(swapBtn);

    const usedIds = new Set(this.game.lineup.flatMap((slot) => (slot.player ? [slot.player.id] : [])));
    const bench = this.game.ownedPlayers().filter((player) => !usedIds.has(player.id)).slice(0, 5);
    const benchIds = new Set(bench.map((player) => player.id));
    if (bench.length < 5) {
      bench.push(...players.filter((player) => !usedIds.has(player.id) && !benchIds.has(player.id)).slice(0, 5 - bench.length));
    }
    const itemGap = (panelW - 184) / 4;
    bench.forEach((player, index) => {
      const item = this.benchPlayer(player);
      item.x = 92 + itemGap * index;
      item.y = panelH * 0.78;
      panel.addChild(item);
    });

    this.container.addChild(panel);
  }

  private benchPlayer(player: PlayerCardData) {
    const c = new Container();
    const scale = 0.88;
    const card = new Container();
    card.scale.set(scale);
    card.addChild(this.cardFrame(player.rarity, 116, 132));
    const face = this.portrait(player, 74);
    face.x = -37;
    face.y = -37;
    const rating = label(String(player.rating), 20, palette.white, '900');
    rating.anchor.set(0.5);
    rating.x = -28;
    rating.y = -28;
    const pos = this.cardMetaLabel(player.position, 17);
    pos.anchor.set(0.5);
    pos.x = -28;
    pos.y = -8;
    card.addChild(face, rating, pos);
    card.x = 0;
    card.y = -62;

    const nameBg = new Graphics();
    nameBg.roundRect(-54, 16, 108, 34, 8);
    nameBg.fill({ color: 0x071e41, alpha: 0.92 });
    nameBg.stroke({ color: 0x56a8ff, alpha: 0.46, width: 2 });
    const name = label(player.name, 19, palette.white, '900');
    name.anchor.set(0.5);
    name.y = 33;
    c.addChild(card, nameBg, name);
    return c;
  }

  private slotNode(slot: LineupSlot, fieldW: number, fieldH: number) {
    const c = new Container();
    const visual = this.visualSlotPosition(slot);
    c.x = 66 + visual.x * (fieldW - 132);
    c.y = 60 + visual.y * (fieldH - 150);
    c.scale.set(0.96);
    const role = this.roleForSlot(slot);
    const bg = slot.player ? this.cardFrame(slot.player.rarity, 116, 132) : this.emptyCardFrame();
    const text = label(slot.player ? slot.player.name : role, slot.player ? 20 : 20, slot.player ? palette.white : 0x6ce8ff, '900');
    text.anchor.set(0.5);
    text.y = 74;
    const nameBg = new Graphics();
    nameBg.roundRect(-48, 57, 96, 32, 8);
    nameBg.fill({ color: 0x071e41, alpha: 0.9 });
    nameBg.stroke({ color: 0x56a8ff, alpha: 0.42, width: 2 });
    const tag = new Graphics();
    tag.roundRect(-34, 50, 68, 28, 5);
    tag.fill({ color: 0x06283c, alpha: 0.95 });
    tag.stroke({ color: 0x00b7ff, alpha: 0.55, width: 2 });
    const tagText = label(role, 18, 0x68dfff, '900');
    tagText.anchor.set(0.5);
    tagText.y = 64;
    if (slot.player) {
      const rating = label(String(slot.player.rating), 20, palette.white, '900');
      rating.anchor.set(0.5);
      rating.x = -28;
      rating.y = -28;
      const position = this.cardMetaLabel(role, 15);
      position.anchor.set(0.5);
      position.x = -28;
      position.y = -8;
      const face = this.portrait(slot.player, 74);
      face.x = -37;
      face.y = -37;
      c.addChild(bg, face, rating, nameBg, text, position);
    } else {
      const mark = label('+', 44, 0xffe27a, '900');
      mark.anchor.set(0.5);
      mark.alpha = 0.95;
      c.addChild(bg, mark, tag, tagText);
    }
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', () => {
      this.game.sound.play('tap');
      this.warehousePage = 0;
      this.openCardWarehouse(slot);
    });
    return c;
  }

  private visualSlotPosition(slot: LineupSlot) {
    const layouts: Record<string, Record<string, { x: number; y: number }>> = {
      '4231': {
        gk: { x: 0.5, y: 0.93 },
        df1: { x: 0.14, y: 0.68 },
        df2: { x: 0.36, y: 0.66 },
        df3: { x: 0.64, y: 0.66 },
        df4: { x: 0.86, y: 0.68 },
        mf1: { x: 0.34, y: 0.48 },
        mf2: { x: 0.66, y: 0.48 },
        mf3: { x: 0.18, y: 0.32 },
        mf4: { x: 0.5, y: 0.32 },
        mf5: { x: 0.82, y: 0.32 },
        fw: { x: 0.5, y: 0.04 }
      },
      '433': {
        gk: { x: 0.5, y: 0.93 },
        df1: { x: 0.14, y: 0.68 },
        df2: { x: 0.36, y: 0.66 },
        df3: { x: 0.64, y: 0.66 },
        df4: { x: 0.86, y: 0.68 },
        mf1: { x: 0.28, y: 0.47 },
        mf2: { x: 0.5, y: 0.42 },
        mf3: { x: 0.72, y: 0.47 },
        fw1: { x: 0.18, y: 0.13 },
        fw2: { x: 0.5, y: 0.06 },
        fw3: { x: 0.82, y: 0.13 }
      },
      '532': {
        gk: { x: 0.5, y: 0.93 },
        df1: { x: 0.1, y: 0.69 },
        df2: { x: 0.3, y: 0.66 },
        df3: { x: 0.5, y: 0.64 },
        df4: { x: 0.7, y: 0.66 },
        df5: { x: 0.9, y: 0.69 },
        mf1: { x: 0.27, y: 0.44 },
        mf2: { x: 0.5, y: 0.39 },
        mf3: { x: 0.73, y: 0.44 },
        fw1: { x: 0.36, y: 0.12 },
        fw2: { x: 0.64, y: 0.12 }
      },
      '442': {
        gk: { x: 0.5, y: 0.93 },
        df1: { x: 0.14, y: 0.68 },
        df2: { x: 0.36, y: 0.66 },
        df3: { x: 0.64, y: 0.66 },
        df4: { x: 0.86, y: 0.68 },
        mf1: { x: 0.16, y: 0.4 },
        mf2: { x: 0.38, y: 0.39 },
        mf3: { x: 0.62, y: 0.39 },
        mf4: { x: 0.84, y: 0.4 },
        fw1: { x: 0.36, y: 0.12 },
        fw2: { x: 0.64, y: 0.12 }
      },
      '352': {
        gk: { x: 0.5, y: 0.93 },
        df1: { x: 0.25, y: 0.67 },
        df2: { x: 0.5, y: 0.65 },
        df3: { x: 0.75, y: 0.67 },
        mf1: { x: 0.12, y: 0.48 },
        mf2: { x: 0.32, y: 0.45 },
        mf3: { x: 0.5, y: 0.38 },
        mf4: { x: 0.68, y: 0.45 },
        mf5: { x: 0.88, y: 0.48 },
        fw1: { x: 0.36, y: 0.12 },
        fw2: { x: 0.64, y: 0.12 }
      },
      '343': {
        gk: { x: 0.5, y: 0.93 },
        df1: { x: 0.25, y: 0.69 },
        df2: { x: 0.5, y: 0.68 },
        df3: { x: 0.75, y: 0.69 },
        mf1: { x: 0.16, y: 0.43 },
        mf2: { x: 0.38, y: 0.41 },
        mf3: { x: 0.62, y: 0.41 },
        mf4: { x: 0.84, y: 0.43 },
        fw1: { x: 0.18, y: 0.13 },
        fw2: { x: 0.5, y: 0.06 },
        fw3: { x: 0.82, y: 0.13 }
      }
    };
    return layouts[this.game.selectedFormation.id]?.[slot.id] ?? { x: slot.x, y: slot.y };
  }

  private openCardWarehouse(targetSlot?: LineupSlot) {
    this.closeModal();
    const modal = new Container();
    modal.eventMode = 'static';
    const lineupIds = new Set(this.game.lineup.flatMap((slot) => (slot.player ? [slot.player.id] : [])));
    const activePosition = targetSlot?.position ?? this.warehouseFilter;
    const owned = this.game
      .ownedPlayers()
      .filter((player) => {
        if (targetSlot) {
          return player.position === targetSlot.position && (player.id === targetSlot.player?.id || !lineupIds.has(player.id));
        }
        return !lineupIds.has(player.id) && (!activePosition || player.position === activePosition);
      })
      .sort((a, b) => b.rating - a.rating);

    const mask = new Graphics();
    mask.rect(0, 0, this.game.width, this.game.height);
    mask.fill({ color: 0x020613, alpha: 0.86 });
    mask.eventMode = 'static';
    modal.addChild(mask);

    const panelW = this.game.width;
    const panelH = this.game.height;
    const panelX = 0;
    const panelY = 0;
    const panel = new Container();
    panel.x = panelX;
    panel.y = panelY;

    const bg = coverSprite('/assets/home-stadium-bg.png', panelW, panelH);
    const shade = new Graphics();
    shade.rect(0, 0, panelW, panelH);
    shade.fill({ color: 0x020613, alpha: 0.72 });
    shade.rect(0, 0, panelW, 172);
    shade.fill({ color: 0x020613, alpha: 0.42 });
    panel.addChild(bg, shade);

    const headerCenterY = 58;
    const close = label('‹', 64, palette.white, '900');
    close.anchor.set(0.5);
    close.x = 44;
    close.y = headerCenterY;
    close.eventMode = 'static';
    close.cursor = 'pointer';
    close.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeModal();
    });
    const divider = new Graphics();
    divider.roundRect(88, headerCenterY - 24, 2, 48, 1);
    divider.fill({ color: 0x1b5b9d, alpha: 0.62 });
    const title = label(targetSlot ? `选择${this.roleForSlot(targetSlot)}` : '卡牌仓库', 40, palette.white, '900');
    title.anchor.set(0, 0.5);
    title.x = 108;
    title.y = headerCenterY;
    const count = label(`${owned.length}/120`, 22, 0x4fffa3, '900');
    count.anchor.set(0, 0.5);
    count.x = Math.min(title.x + title.width + 18, panelW - 108);
    count.y = headerCenterY + 2;
    const plusButton = new Container();
    plusButton.x = Math.min(count.x + count.width + 22, panelW - 42);
    plusButton.y = headerCenterY + 1;
    const plusBg = new Graphics();
    plusBg.circle(0, 0, 18);
    plusBg.fill({ color: 0x0d2b5d, alpha: 0.96 });
    plusBg.stroke({ color: 0x2f83d6, alpha: 0.72, width: 2 });
    const plus = label('+', 30, 0xb8d8ff, '900');
    plus.anchor.set(0.5);
    plus.y = -2;
    plusButton.addChild(plusBg, plus);
    panel.addChild(close, divider, title, count, plusButton);

    const tabs = [
      { text: '全部', position: undefined },
      { text: '前锋', position: 'FW' as Position },
      { text: '中场', position: 'MF' as Position },
      { text: '后卫', position: 'DF' as Position },
      { text: '门将', position: 'GK' as Position }
    ];
    const activeTab = tabs.findIndex((tab) => tab.position === activePosition);
    const tabY = 108;
    const tabW = panelW / tabs.length;
    tabs.forEach((item, index) => {
      const tabButton = new Container();
      tabButton.x = index * tabW + 8;
      tabButton.y = tabY;
      tabButton.hitArea = new Rectangle(0, 0, tabW - 16, 46);
      tabButton.eventMode = targetSlot ? 'none' : 'static';
      tabButton.cursor = targetSlot ? 'default' : 'pointer';
      const tab = new Graphics();
      tab.roundRect(0, 0, tabW - 16, 46, 10);
      tab.fill({ color: index === activeTab ? 0x10234b : 0x061936, alpha: index === activeTab ? 0.96 : 0.74 });
      tab.stroke({ color: 0x134b8a, alpha: 0.5, width: 1 });
      const tabText = label(item.text, 21, index === activeTab ? 0xffd632 : 0xbfd7ff, '900');
      tabText.anchor.set(0.5);
      tabText.x = tabW / 2 - 8;
      tabText.y = 24;
      tabButton.addChild(tab, tabText);
      if (!targetSlot) {
        tabButton.on('pointertap', () => {
          this.game.sound.play('tap');
          this.warehouseFilter = item.position;
          this.warehouseScrollY = 0;
          this.openCardWarehouse();
        });
      }
      panel.addChild(tabButton);
      if (index === activeTab) {
        const line = new Graphics();
        line.roundRect(index * tabW + 28, tabY + 44, tabW - 56, 3, 2);
        line.fill({ color: 0xffd632, alpha: 0.96 });
        panel.addChild(line);
      }
    });

    const columns = 4;
    const frameX = 12;
    const startY = 174;
    const frameY = startY - 12;
    const frameW = panelW - 24;
    const frameH = panelH - frameY - 18;
    const insetX = 22;
    const insetTop = 42;
    const insetBottom = 34;
    const viewportX = frameX + insetX;
    const viewportY = frameY + insetTop;
    const viewportW = frameW - insetX * 2 - 10;
    const viewportH = frameH - insetTop - insetBottom;
    const columnGap = 12;
    const cardW = (viewportW - columnGap * (columns - 1)) / columns;
    const cardH = cardW * 1.22;
    const gapY = 18;
    const rows = Math.ceil(owned.length / columns);
    const contentH = Math.max(viewportH, rows * (cardH + gapY) - gapY);
    const maxScroll = Math.max(0, contentH - viewportH);
    this.warehouseScrollY = Math.max(0, Math.min(this.warehouseScrollY, maxScroll));

    const playersBg = new Sprite(Texture.from('/assets/ui/players-bg.png'));
    playersBg.x = frameX;
    playersBg.y = frameY;
    playersBg.width = frameW;
    playersBg.height = frameH;
    panel.addChild(playersBg);

    const viewport = new Container();
    viewport.x = viewportX;
    viewport.y = viewportY;
    viewport.hitArea = new Rectangle(0, 0, viewportW, viewportH);
    viewport.eventMode = 'static';

    const viewportMask = new Graphics();
    viewportMask.roundRect(viewportX, viewportY, viewportW, viewportH, 12);
    viewportMask.fill(0xffffff);
    viewport.mask = viewportMask;
    panel.addChild(viewportMask);

    const cardLayer = new Container();
    cardLayer.y = -this.warehouseScrollY;
    owned.forEach((player, index) => {
      const card = this.warehouseCard(player, cardW, cardH);
      card.x = (index % columns) * (cardW + columnGap);
      card.y = Math.floor(index / columns) * (cardH + gapY);
      if (targetSlot) {
        card.eventMode = 'static';
        card.cursor = 'pointer';
        card.hitArea = new Rectangle(0, 0, cardW, cardH);
        card.on('pointertap', () => {
          this.game.sound.play('select');
          this.game.fillSlot(targetSlot.id, player);
          this.closeModal();
          this.resize();
        });
      }
      cardLayer.addChild(card);
    });
    viewport.addChild(cardLayer);
    panel.addChild(viewport);

    if (maxScroll > 0) {
      const track = new Graphics();
      track.roundRect(frameX + frameW - 24, viewportY + 6, 6, viewportH - 12, 3);
      track.fill({ color: 0x9ed3ff, alpha: 0.18 });
      const thumbH = Math.max(58, (viewportH / contentH) * (viewportH - 12));
      const thumbY = viewportY + 6 + (this.warehouseScrollY / maxScroll) * (viewportH - 12 - thumbH);
      const thumb = new Graphics();
      thumb.roundRect(frameX + frameW - 25, thumbY, 8, thumbH, 4);
      thumb.fill({ color: 0x56d7ff, alpha: 0.82 });
      panel.addChild(track, thumb);

      const applyScroll = (next: number) => {
        this.warehouseScrollY = Math.max(0, Math.min(next, maxScroll));
        cardLayer.y = -this.warehouseScrollY;
        const y = viewportY + 6 + (this.warehouseScrollY / maxScroll) * (viewportH - 12 - thumbH);
        thumb.clear();
        thumb.roundRect(frameX + frameW - 25, y, 8, thumbH, 4);
        thumb.fill({ color: 0x56d7ff, alpha: 0.82 });
      };

      viewport.on('wheel', (event) => {
        const deltaY = (event as unknown as { deltaY?: number }).deltaY ?? 0;
        applyScroll(this.warehouseScrollY + deltaY * 0.8);
      });
      viewport.on('pointerdown', (event: FederatedPointerEvent) => {
        this.warehouseDrag = { pointerId: event.pointerId, startY: event.global.y, startScrollY: this.warehouseScrollY };
      });
      viewport.on('pointermove', (event: FederatedPointerEvent) => {
        if (!this.warehouseDrag || this.warehouseDrag.pointerId !== event.pointerId) return;
        applyScroll(this.warehouseDrag.startScrollY - (event.global.y - this.warehouseDrag.startY) * 1.3);
      });
      const endDrag = (event: FederatedPointerEvent) => {
        if (this.warehouseDrag?.pointerId === event.pointerId) this.warehouseDrag = undefined;
      };
      viewport.on('pointerup', endDrag);
      viewport.on('pointerupoutside', endDrag);
      viewport.on('pointercancel', endDrag);
    }

    modal.addChild(panel);
    this.modal = modal;
    this.container.addChild(modal);
  }

  private warehouseCard(player: PlayerCardData, w: number, h: number) {
    const theme = this.rarityTheme(player.rarity);
    const c = new Container();

    const innerX = 0;
    const innerY = 0;
    const innerW = w;
    const innerH = h;
    const contentOffsetX = innerW * 0.04;

    const bg = this.cardBgSprite(player.rarity);
    bg.x = innerX;
    bg.y = innerY;
    bg.width = innerW;
    bg.height = innerH;
    c.addChild(bg);

    const faceSize = innerW * 0.54;
    const face = this.portrait(player, faceSize);
    face.x = innerX + (innerW - faceSize) / 2 + contentOffsetX;
    face.y = innerY + innerH * 0.3;
    c.addChild(face);

    const rating = label(String(player.rating), Math.round(innerW * 0.23), palette.white, '900');
    rating.x = innerX + innerW * 0.12 + contentOffsetX;
    rating.y = innerY + innerH * 0.07;
    const pos = this.cardMetaLabel(player.position, Math.round(innerW * 0.14));
    pos.x = innerX + innerW * 0.13 + contentOffsetX;
    pos.y = innerY + innerH * 0.23;
    c.addChild(rating, pos);

    const nameText = this.compactPlayerName(player.name);
    const name = this.fitLabel(nameText, Math.round(innerW * 0.14), innerW * 0.66, palette.white, '900', 0.86);
    name.anchor.set(0.5);
    name.x = w / 2 + contentOffsetX;
    name.y = innerY + innerH * (player.rarity === 'gold' ? 0.86 : 0.82);
    c.addChild(name);
    return c;
  }

  private compactPlayerName(name: string) {
    const compact = name.replace(/[·\s]/g, '');
    return compact.length > 4 ? `${compact.slice(0, 3)}…` : compact;
  }

  private fitLabel(text: string, size: number, maxWidth: number, color = palette.white, weight: '400' | '700' | '900' = '700', minScale = 0.7) {
    const t = label(text, size, color, weight);
    if (t.width > maxWidth) {
      const scale = Math.max(minScale, maxWidth / t.width);
      t.scale.set(scale);
    }
    return t;
  }

  private pageButton(text: string) {
    const btn = new Container();
    btn.addChild(glassPanel(46, 44, 0x10245c, 0x20b8ff));
    const t = label(text, 34, palette.white, '900');
    t.anchor.set(0.5);
    t.x = 23;
    t.y = 20;
    btn.addChild(t);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new Rectangle(0, 0, 46, 44);
    return btn;
  }

  private rarityTheme(rarity: Rarity) {
    if (rarity === 'bronze') return { name: '普通', fill: 0x5c6573, stroke: 0xf4f8ff, text: 0xffffff, innerAlpha: 0.72, glowAlpha: 0.1 };
    if (rarity === 'silver') return { name: '稀有', fill: 0x0b4c8d, stroke: 0x31a8ff, text: 0x99dcff, innerAlpha: 0.58, glowAlpha: 0.16 };
    if (rarity === 'purple') return { name: '史诗', fill: 0x4b188a, stroke: 0xa65cff, text: 0xe1c2ff, innerAlpha: 0.6, glowAlpha: 0.18 };
    if (rarity === 'legend') return { name: '神话', fill: 0x7f1218, stroke: 0xff3b3b, text: 0xffd0d0, innerAlpha: 0.64, glowAlpha: 0.2 };
    return { name: '传奇', fill: 0x806018, stroke: 0xffd238, text: 0xffec9a, innerAlpha: 0.62, glowAlpha: 0.18 };
  }

  private emptyCardFrame() {
    const c = new Container();
    const shadow = new Graphics();
    this.drawHexPath(shadow, 0, 8, 58);
    shadow.fill({ color: 0x000000, alpha: 0.42 });
    const outer = new Graphics();
    this.drawHexPath(outer, 0, 0, 60);
    outer.fill({ color: 0x02090b, alpha: 0.96 });
    outer.stroke({ color: 0xffffff, alpha: 0.72, width: 4 });
    const inner = new Graphics();
    this.drawHexPath(inner, 0, 0, 52);
    inner.fill({ color: 0x0b2024, alpha: 0.72 });
    inner.stroke({ color: 0x7fffee, alpha: 0.75, width: 3 });
    const shine = new Graphics();
    shine.moveTo(-36, -26);
    shine.lineTo(10, -46);
    shine.lineTo(42, -10);
    shine.lineTo(-18, 14);
    shine.closePath();
    shine.fill({ color: 0x7ffff7, alpha: 0.08 });
    c.addChild(shadow, outer, inner, shine);
    return c;
  }

  private cardFrame(rarity: Rarity, width: number, height: number) {
    const c = new Container();
    const shadow = new Graphics();
    shadow.roundRect(-width / 2 + 7, -height / 2 + 12, width - 14, height - 18, 16);
    shadow.fill({ color: 0x000000, alpha: 0.38 });
    const bg = this.cardBgSprite(rarity);
    bg.anchor.set(0.5);
    bg.width = width;
    bg.height = height;
    c.addChild(shadow, bg);
    return c;
  }

  private cardBgSprite(rarity: Rarity) {
    const map: Record<Rarity, Rectangle> = {
      bronze: new Rectangle(64, 0, 280, 340),
      silver: new Rectangle(392, 0, 288, 340),
      purple: new Rectangle(720, 0, 288, 340),
      gold: new Rectangle(64, 354, 286, 310),
      legend: new Rectangle(396, 354, 296, 310),
      orange: new Rectangle(716, 346, 304, 330)
    };
    const texture = Texture.from('/assets/ui/cardbg.png');
    return new Sprite(
      new Texture({
        source: texture.source,
        frame: map[rarity]
      })
    );
  }

  private drawHexPath(g: Graphics, x: number, y: number, r: number) {
    const points: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 6 + (Math.PI * 2 * i) / 6;
      points.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    g.poly(points);
  }

  private cardMetaLabel(text: string, size: number) {
    return new Text({
      text,
      style: new TextStyle({
        fill: palette.white,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: size,
        fontWeight: '900',
        align: 'center',
        stroke: { color: 0x001126, width: 4 },
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
          alpha: 0.85
        }
      })
    });
  }

  private roleForSlot(slot: LineupSlot) {
    if (slot.position === 'GK') return 'GK';
    if (this.game.selectedFormation.id === '433') {
      const roles: Record<string, string> = {
        fw1: 'LW',
        fw2: 'ST',
        fw3: 'RW',
        mf1: 'CM',
        mf2: 'CAM',
        mf3: 'CM',
        df1: 'LB',
        df2: 'CB',
        df3: 'CB',
        df4: 'RB'
      };
      return roles[slot.id] ?? this.positionName(slot.position);
    }
    if (this.game.selectedFormation.id === '4231') {
      const roles: Record<string, string> = {
        fw: 'ST',
        mf1: 'CDM',
        mf2: 'CDM',
        mf3: 'LM',
        mf4: 'CAM',
        mf5: 'RM',
        df1: 'LB',
        df2: 'CB',
        df3: 'CB',
        df4: 'RB'
      };
      return roles[slot.id] ?? this.positionName(slot.position);
    }
    if (this.game.selectedFormation.id === '532') {
      const roles: Record<string, string> = {
        fw1: 'ST',
        fw2: 'ST',
        mf1: 'CM',
        mf2: 'CAM',
        mf3: 'CM',
        df1: 'LWB',
        df2: 'CB',
        df3: 'CB',
        df4: 'CB',
        df5: 'RWB'
      };
      return roles[slot.id] ?? this.positionName(slot.position);
    }
    if (this.game.selectedFormation.id === '442') {
      const roles: Record<string, string> = {
        fw1: 'ST',
        fw2: 'ST',
        mf1: 'LM',
        mf2: 'CM',
        mf3: 'CM',
        mf4: 'RM',
        df1: 'LB',
        df2: 'CB',
        df3: 'CB',
        df4: 'RB'
      };
      return roles[slot.id] ?? this.positionName(slot.position);
    }
    if (this.game.selectedFormation.id === '352') {
      const roles: Record<string, string> = {
        fw1: 'ST',
        fw2: 'ST',
        mf1: 'LM',
        mf2: 'CM',
        mf3: 'CAM',
        mf4: 'CM',
        mf5: 'RM',
        df1: 'CB',
        df2: 'CB',
        df3: 'CB'
      };
      return roles[slot.id] ?? this.positionName(slot.position);
    }
    if (this.game.selectedFormation.id === '343') {
      const roles: Record<string, string> = {
        fw1: 'LW',
        fw2: 'ST',
        fw3: 'RW',
        mf1: 'LM',
        mf2: 'CM',
        mf3: 'CM',
        mf4: 'RM',
        df1: 'CB',
        df2: 'CB',
        df3: 'CB'
      };
      return roles[slot.id] ?? this.positionName(slot.position);
    }
    return this.positionName(slot.position);
  }

  private openBlindBox(slot: LineupSlot) {
    this.modalSlotId = slot.id;
    this.revealed.clear();
    this.revealPulse = 0;
    this.revealTargetId = undefined;
    const selectedIds = this.game.lineup.flatMap((item) => (item.player ? [item.player.id] : []));
    this.modalCandidates = this.game
      .ownedPlayers(slot.position)
      .filter((player) => player.id === slot.player?.id || !selectedIds.includes(player.id))
      .slice(0, 3);
    this.modalCandidates.forEach((player) => this.revealed.add(player.id));
    this.drawBlindBoxModal(slot.position);
  }

  private drawBlindBoxModal(position: Position) {
    this.closeModal();
    const shift = this.game.contentTopOffset * 0.7;
    const modal = new Container();
    modal.eventMode = 'static';

    const mask = new Graphics();
    mask.rect(0, 0, this.game.width, this.game.height);
    mask.fill({ color: 0x020613, alpha: 0.72 });
    mask.eventMode = 'static';
    modal.addChild(mask);

    const title = label(`选择${this.positionName(position)}`, 46, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = 166 + shift;
    const hint = label('从已拥有球员中选择首发，重复球员会自动移出原位置', 22, 0xcfe0ff, '700');
    hint.anchor.set(0.5);
    hint.x = this.game.width / 2;
    hint.y = 218 + shift;
    modal.addChild(title, hint);

    const aura = new Graphics();
    aura.ellipse(this.game.width / 2, 534 + shift, 330, 196);
    aura.fill({ color: 0xffc43b, alpha: 0.08 + this.revealPulse / 9000 });
    modal.addChild(aura);

    const cardW = 210;
    const cardH = 342;
    const gap = 10;
    const startX = (this.game.width - cardW * 3 - gap * 2) / 2;
    this.modalCandidates.forEach((player, index) => {
      const card = this.blindCard(player, cardW, cardH, index);
      card.x = startX + index * (cardW + gap);
      card.y = 340 + shift;
      modal.addChild(card);
    });

    this.modal = modal;
    this.container.addChild(modal);
    this.animateModalCards();
  }

  private blindCard(player: PlayerCardData, w: number, h: number, index: number) {
    const c = new Container();
    c.name = `blind-card-${index}`;
    const isOpen = this.revealed.has(player.id);
    const allRevealed = this.modalCandidates.every((candidate) => this.revealed.has(candidate.id));
    const fill = isOpen ? player.color : 0x17234f;
    const border = isOpen ? 0xffef9a : 0x5d74bd;
    const pulseRatio = this.revealTargetId === player.id ? this.revealPulse / 850 : 0;
    const glow = new Graphics();
    glow.roundRect(-12 - pulseRatio * 14, -12 - pulseRatio * 14, w + 24 + pulseRatio * 28, h + 24 + pulseRatio * 28, 26);
    glow.fill({ color: isOpen ? fill : 0xffdf76, alpha: isOpen ? 0.32 : 0.16 + pulseRatio * 0.34 });
    c.addChild(glow, glassPanel(w, h, fill, border));

    const pattern = new Graphics();
    for (let i = 0; i < 8; i += 1) {
      pattern.moveTo(14, 34 + i * 30);
      pattern.lineTo(w - 14, 14 + i * 30);
      pattern.stroke({ color: 0xffffff, alpha: isOpen ? 0.08 : 0.04, width: 1 });
    }
    c.addChild(pattern);

    if (!isOpen) {
      const seal = new Graphics();
      seal.circle(w / 2, h * 0.38, 52 + pulseRatio * 16);
      seal.fill({ color: 0xffdf76, alpha: 0.08 + pulseRatio * 0.18 });
      const sparkle = new Graphics();
      const twinkle = (Math.sin(this.modalTime / 180 + index) + 1) / 2;
      for (let i = 0; i < 8; i += 1) {
        const sx = 24 + ((i * 37) % Math.floor(w - 48));
        const sy = 28 + ((i * 53) % Math.floor(h - 56));
        sparkle.star(sx, sy, 4, 5 + twinkle * 4, 1.5);
        sparkle.fill({ color: i % 2 ? 0xfff1a6 : 0xffffff, alpha: 0.16 + twinkle * 0.22 });
      }
      const q = label('?', 98, 0xffdf76, '900');
      q.anchor.set(0.5);
      q.x = w / 2;
      q.y = h * 0.43;
      const text = label('球员盲盒', 25, palette.white, '900');
      text.anchor.set(0.5);
      text.x = w / 2;
      text.y = h * 0.68;
      const tap = label('点击开启', 18, 0xfff0b3, '900');
      tap.anchor.set(0.5);
      tap.x = w / 2;
      tap.y = h * 0.82;
      c.addChild(seal, sparkle, q, text, tap);
    } else {
      const rating = label(String(player.rating), 38, palette.white, '900');
      rating.x = 18;
      rating.y = 18;
      const role = label(this.positionName(player.position), 18, palette.white, '900');
      role.x = 20;
      role.y = 58;
      const badge = new Graphics();
      badge.roundRect(w - 48, 16, 30, 54, 10);
      badge.fill({ color: 0xffffff, alpha: 0.14 });
      badge.stroke({ color: 0xffffff, alpha: 0.3, width: 1 });
      const face = this.portrait(player, 122);
      face.x = (w - 122) / 2;
      face.y = 76;
      const name = label(player.name, 31, palette.white, '900');
      name.anchor.set(0.5);
      name.x = w / 2;
      name.y = 210;
      const skill = label(`#${player.skill}`, 19, 0xfff0b3, '700');
      skill.anchor.set(0.5);
      skill.x = w / 2;
      skill.y = 252;
      const choose = label(allRevealed ? '选择' : '待全部开启', allRevealed ? 26 : 19, allRevealed ? palette.white : 0xfff0b3, '900');
      choose.anchor.set(0.5);
      choose.x = w / 2;
      choose.y = 292;
      c.addChild(badge, rating, role, face, name, skill, choose);
      if (this.revealTargetId === player.id && this.revealPulse > 0) {
        this.drawRevealParticles(c, w, h, pulseRatio);
      }
    }

    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', () => {
      if (this.modalSlotId) {
        this.game.sound.play('select');
        this.game.fillSlot(this.modalSlotId, player);
      }
      this.closeModal();
      this.resize();
    });
    return c;
  }

  private closeModal() {
    if (!this.modal) return;
    this.container.removeChild(this.modal);
    this.modal.destroy({ children: true });
    this.modal = undefined;
  }

  private animateModalCards() {
    if (!this.modal) return;
    const shift = this.game.contentTopOffset * 0.7;
    this.modalCandidates.forEach((_player, index) => {
      const child = this.modal?.getChildByName(`blind-card-${index}`) as Container | undefined;
      if (!child) return;
      const offset = Math.sin(this.modalTime / 420 + index * 0.8) * 5;
      const scale = 1 + Math.sin(this.modalTime / 520 + index) * 0.012;
      child.y = 340 + shift + offset;
      child.scale.set(scale);
    });
  }

  private drawRevealParticles(target: Container, w: number, h: number, ratio: number) {
    const particles = new Graphics();
    const alpha = Math.min(0.75, ratio);
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18;
      const radius = 46 + ratio * 120 + (i % 3) * 10;
      const x = w / 2 + Math.cos(angle) * radius;
      const y = h / 2 + Math.sin(angle) * radius;
      particles.star(x, y, 4, 8, 2);
      particles.fill({ color: i % 2 ? 0xfff1a6 : 0xffffff, alpha });
    }
    target.addChild(particles);
  }

  private drawStartMatch() {
    const filled = this.game.lineup.filter((slot) => slot.player).length;
    const ready = filled >= this.game.lineup.length;
    const y = this.game.height - 136;

    const buttonW = Math.min(344, this.game.width - 118);
    const btn = new Container();
    btn.x = (this.game.width - buttonW) / 2;
    btn.y = y;
    const playTexture = Texture.from('/assets/ui/play.png');
    const bg = new Sprite(new Texture({ source: playTexture.source, frame: new Rectangle(96, 184, 890, 294) }));
    bg.width = buttonW;
    bg.height = buttonW * (294 / 890);
    btn.addChild(bg);
    btn.hitArea = new Rectangle(0, 0, bg.width, bg.height);
    btn.eventMode = 'static';
    btn.cursor = ready ? 'pointer' : 'default';

    const power = label(`${this.game.lineupPower()} 战力`, 20, 0x233064, '900');
    power.anchor.set(0.5);
    power.x = buttonW / 2 + 18;
    power.y = bg.height * 0.77;
    btn.addChild(power);
    btn.alpha = ready ? 1 : 0.72;
    btn.on('pointertap', () => {
      if (!ready) {
        this.game.sound.play('tap');
        return;
      }
      this.game.sound.play('confirm');
      this.game.prepareOpponent();
      this.game.changeScene('matchup');
    });
    this.container.addChild(btn);

  }

  private footerCircleButton(index: 0 | 1) {
    const texture = Texture.from('/assets/ui/draft-button.png');
    const frame = index === 0 ? new Rectangle(54, 54, 462, 462) : new Rectangle(564, 54, 462, 462);
    const sprite = new Sprite(new Texture({ source: texture.source, frame }));
    sprite.width = 102;
    sprite.height = 102;
    const btn = new Container();
    btn.addChild(sprite);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    return btn;
  }

  private autoFillLineup() {
    const usedIds = new Set<string>();
    this.game.lineup = this.game.lineup.map((slot) => {
      const player = this.game
        .ownedPlayers(slot.position)
        .filter((item) => !usedIds.has(item.id))
        .sort((a, b) => b.rating - a.rating)[0];
      if (player) usedIds.add(player.id);
      return { ...slot, player };
    });
  }

  private positionName(position: Position) {
    if (position === 'GK') return 'GK';
    if (position === 'DF') return 'DF';
    if (position === 'MF') return 'MF';
    return 'FW';
  }

  private portrait(player: PlayerCardData, size: number) {
    const c = new Container();
    const sprite = new Sprite(Texture.from(player.portrait));
    const textureWidth = sprite.texture.width || 1024;
    const textureHeight = sprite.texture.height || 1024;
    const scale = Math.max(size / textureWidth, size / textureHeight);
    sprite.scale.set(scale);
    sprite.x = (size - textureWidth * scale) / 2;
    sprite.y = (size - textureHeight * scale) / 2;

    const mask = new Graphics();
    mask.roundRect(0, 0, size, size, size * 0.18);
    mask.fill(0xffffff);
    sprite.mask = mask;

    const frame = new Graphics();
    frame.roundRect(0, 0, size, size, size * 0.18);
    frame.stroke({ color: player.color, alpha: 0.85, width: 3 });

    c.addChild(sprite, mask, frame);
    return c;
  }

}
