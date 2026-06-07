import { Container, FederatedPointerEvent, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { BaseScene, PAGE_BG } from './BaseScene';
import { formations } from '../data';
import type { FormationData, LineupSlot, PlayerCardData, Position, Rarity } from '../types';
import { playerDisplayName, shortenPlayerName } from '../playerNames';
import { coverSprite, glassPanel, headerTitleSprite, imageBackButton, label, palette } from '../ui';

const runtimeEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env ?? {};

type CardSource = { type: 'lineup'; slotId: string } | { type: 'bench'; index: number };

const BACK_BUTTON = '/assets/ui/back.png';
const BACK_BUTTON_FRAME = new Rectangle(155, 148, 713, 711);

export class FormationScene extends BaseScene {
  private static readonly BLIND_BOX_PICK_COUNT = 3;
  private static readonly BLIND_CARD_BACK = '/assets/ui/card-guess1.png';
  private static readonly BLIND_CARD_BACK_FRAME = new Rectangle(185, 298, 350, 488);
  private static readonly READY_BUTTON = '/assets/ui/button-ready.png';
  private static readonly READY_BUTTON_FRAME = new Rectangle(63, 203, 995, 275);
  private static readonly MATCH_READY_BG = '/assets/ui/gamereadybg.png';
  private static readonly CONFIRM_READY_BUTTON = '/assets/ui/readybutton.png';
  private static readonly CONFIRM_ADJUST_BUTTON_FRAME = new Rectangle(31, 132, 489, 182);
  private static readonly CONFIRM_READY_BUTTON_FRAME = new Rectangle(557, 132, 489, 180);
  private static readonly PLAYER_SCORE_ICON = '/assets/ui/playerscore.png';
  private static readonly PLAYER_SCORE_ICON_FRAME = new Rectangle(416, 172, 246, 288);
  private static readonly BLIND_FACE_SCALE = 0.86;
  private static readonly BLIND_BACK_BOOST = 1.14;
  private static readonly BLIND_REVEAL_DURATION = 600;
  private static readonly BLIND_BOX_LIFT = 50;
  private static readonly LINEUP_DRAG_DELAY = 320;
  private static readonly SLOT_HEX_OUTER_R = 60;
  private static readonly SLOT_HEX_INNER_R = 52;
  private static readonly BENCH_HEX_SCALE = 0.78;
  private static readonly CARD_BG_FRAMES: Record<Rarity, Rectangle> = {
    bronze: new Rectangle(77, -10, 249, 357),
    silver: new Rectangle(413, -10, 251, 357),
    purple: new Rectangle(747, -10, 250, 357),
    gold: new Rectangle(76, 350, 253, 327),
    legend: new Rectangle(399, 348, 276, 331),
    orange: new Rectangle(721, 347, 304, 337)
  };
  private field?: Container;
  private modal?: Container;
  private modalSlotId?: string;
  private modalBenchIndex?: number;
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
  private selectedSlotId?: string;
  private selectedBenchIndex?: number;
  private cardDrag?: {
    pointerId: number;
    source: CardSource;
    player: PlayerCardData;
    globalX: number;
    globalY: number;
    elapsed: number;
    dragging: boolean;
  };
  private dragPreview?: Container;
  private suppressNextSlotTap = false;

  protected build() {
    this.container.addChild(this.formationBackground());
    this.drawHeader();
    if (runtimeEnv.DEV) this.drawDebugAutofill();
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
    if (this.cardDrag && !this.cardDrag.dragging) {
      this.cardDrag.elapsed += deltaMs;
      if (this.cardDrag.elapsed >= FormationScene.LINEUP_DRAG_DELAY) {
        this.cardDrag.dragging = true;
        this.selectSource(this.cardDrag.source);
        this.showDragPreview(this.cardDrag.player, this.cardDrag.globalX, this.cardDrag.globalY);
      }
    }
    if (this.revealPulse > 0) {
      this.revealPulse = Math.max(0, this.revealPulse - deltaMs);
      if (this.revealPulse === 0 && this.revealTargetId) {
        this.revealed.add(this.revealTargetId);
        this.revealTargetId = undefined;
        this.refreshBlindBoxCards();
      }
    }
    if (this.modal) this.animateModalCards();
  }

  private formationBackground() {
    const bg = new Container();
    bg.addChild(coverSprite(PAGE_BG, this.game.width, this.game.height));
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
    const back = new Container();
    const backSize = 66;
    const backBase = Texture.from(BACK_BUTTON);
    const backSprite = new Sprite(new Texture({
      source: backBase.source,
      frame: BACK_BUTTON_FRAME
    }));
    backSprite.width = backSize;
    backSprite.height = backSize;
    back.addChild(backSprite);
    back.x = 22;
    back.y = 28 + shift;
    back.hitArea = new Rectangle(0, 0, backSize, backSize);
    back.eventMode = 'static';
    back.cursor = 'pointer';
    back.on('pointertap', () => {
      this.game.sound.play('tap');
      this.game.changeScene('home');
    });
    this.container.addChild(back);

    const title = headerTitleSprite('squad', Math.min(216, this.game.width * 0.42));
    title.x = 110;
    title.y = 32 + shift;

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
    const { x, y, fieldW, fieldH } = this.fieldLayout();
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

  private fieldLayout() {
    const shift = this.game.contentTopOffset;
    const fieldW = Math.min(this.game.width + 42, 780);
    const fieldH = Math.min(this.game.height - 450, 820);
    const x = (this.game.width - fieldW) / 2;
    const y = 232 + shift;
    return { x, y, fieldW, fieldH };
  }

  private drawBench() {
    const { x, y, panelW, panelH, itemGap } = this.benchLayout();
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
    title.y = 30;
    panel.addChild(title, this.startMatchButton(panelW));

    for (let index = 0; index < 5; index += 1) {
      const player = this.game.substitutes[index];
      const item = player ? this.benchPlayer(player, index) : this.emptyBenchSlot(index);
      item.x = 92 + itemGap * index;
      item.y = panelH * 0.8;
      panel.addChild(item);
    }

    this.container.addChild(panel);
  }

  private benchLayout() {
    const shift = this.game.contentTopOffset;
    const panelW = Math.min(this.game.width - 38, 700);
    const panelH = Math.min(286, panelW * 0.57);
    const x = (this.game.width - panelW) / 2;
    const y = 232 + shift + Math.min(this.game.height - 450, 820) - 44;
    const itemGap = (panelW - 184) / 4;
    return { x, y, panelW, panelH, itemGap };
  }

  private emptyBenchSlot(index: number) {
    const c = new Container();
    const frame = this.emptyCardFrame();
    frame.scale.set(FormationScene.BENCH_HEX_SCALE);
    frame.y = -72;
    const nameBg = new Graphics();
    nameBg.roundRect(-54, -4, 108, 34, 8);
    nameBg.fill({ color: 0x071e41, alpha: 0.58 });
    nameBg.stroke({ color: 0x56a8ff, alpha: 0.3, width: 2 });
    const plus = label('+', 30, 0x6ce8ff, '900');
    plus.anchor.set(0.5);
    plus.y = -72;
    const text = label('空位', 18, 0x89b8dc, '900');
    text.anchor.set(0.5);
    text.y = 13;
    c.addChild(frame, plus, nameBg, text);
    if (this.selectedBenchIndex === index) c.addChild(this.slotSelectionRing(0.72));
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', () => {
      this.game.sound.play('tap');
      this.handleBenchTap(index);
    });
    return c;
  }

  private benchPlayer(player: PlayerCardData, index: number) {
    const c = new Container();
    const scale = FormationScene.BENCH_HEX_SCALE;
    const innerR = FormationScene.SLOT_HEX_INNER_R * scale;
    const faceSize = innerR * 2;
    const frame = this.emptyCardFrame();
    frame.scale.set(scale);
    frame.y = -62;
    const face = this.portrait(player, faceSize, false);
    face.x = -faceSize / 2;
    face.y = -62 - faceSize / 2;
    const rating = label(String(player.rating), Math.round(28 * scale), palette.white, '900');
    rating.anchor.set(0, 0);
    rating.x = face.x - 5;
    rating.y = face.y - 20;
    const pos = this.cardMetaLabel(this.positionName(player.position), Math.round(23 * scale));
    pos.anchor.set(0, 0);
    pos.x = face.x - 5;
    pos.y = face.y + Math.round(5 * scale);

    const nameBg = new Graphics();
    nameBg.roundRect(-58, -4, 116, 34, 8);
    nameBg.fill({ color: 0x071e41, alpha: 0.92 });
    nameBg.stroke({ color: 0x56a8ff, alpha: 0.46, width: 2 });
    const name = this.fitLabel(playerDisplayName(player), 17, 108, palette.white, '900', 0.72);
    name.anchor.set(0.5);
    name.y = 13;
    c.addChild(frame, face, rating, pos, nameBg, name);
    if (this.selectedBenchIndex === index) c.addChild(this.slotSelectionRing(0.82));
    c.eventMode = 'static';
    c.cursor = 'pointer';
    this.bindDragHandlers(c, { type: 'bench', index }, player);
    c.on('pointertap', () => {
      if (this.suppressNextSlotTap) {
        this.suppressNextSlotTap = false;
        return;
      }
      this.game.sound.play('tap');
      this.handleBenchTap(index);
    });
    return c;
  }

  private slotNode(slot: LineupSlot, fieldW: number, fieldH: number) {
    const c = new Container();
    const visual = this.visualSlotPosition(slot);
    c.x = 66 + visual.x * (fieldW - 132);
    c.y = 60 + visual.y * (fieldH - 150);
    c.scale.set(0.96);
    const role = this.roleForSlot(slot);
    const nameBg = new Graphics();
    nameBg.roundRect(-42, 58, 84, 26, 7);
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
      const innerR = FormationScene.SLOT_HEX_INNER_R;
      const faceSize = innerR * 2;
      const frame = this.emptyCardFrame();
      const face = this.portrait(slot.player, faceSize, false);
      face.x = -faceSize / 2;
      face.y = -faceSize / 2;
      const rating = label(String(slot.player.rating), 22, palette.white, '900');
      rating.anchor.set(0, 0);
      rating.x = face.x + 4;
      rating.y = face.y + 6;
      const position = this.cardMetaLabel(role, 16);
      position.anchor.set(0, 0);
      position.x = face.x + 4;
      position.y = face.y + 26;
      const text = this.fitLabel(playerDisplayName(slot.player), 15, 78, palette.white, '900', 0.72);
      text.anchor.set(0.5);
      text.y = 71;
      c.addChild(frame, face, rating, nameBg, text, position);
      this.bindDragHandlers(c, { type: 'lineup', slotId: slot.id }, slot.player);
    } else {
      const mark = label('+', 44, 0xffe27a, '900');
      mark.anchor.set(0.5);
      mark.alpha = 0.95;
      c.addChild(this.emptyCardFrame(), mark, tag, tagText);
    }
    if (this.selectedSlotId === slot.id) c.addChild(this.slotSelectionRing());
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', () => {
      if (this.suppressNextSlotTap) {
        this.suppressNextSlotTap = false;
        return;
      }
      this.game.sound.play('tap');
      this.handleLineupSlotTap(slot);
    });
    return c;
  }

  private handleLineupSlotTap(slot: LineupSlot) {
    const selected = this.selectedSource();
    if (selected) {
      if (this.sameSource(selected, { type: 'lineup', slotId: slot.id })) {
        this.clearSelection();
        this.resize();
        return;
      }
      const swapped = this.applySwap(selected, { type: 'lineup', slot });
      this.clearSelection();
      if (!swapped && slot.player) this.selectSource({ type: 'lineup', slotId: slot.id });
      this.resize();
      return;
    }
    if (slot.player) {
      this.selectSource({ type: 'lineup', slotId: slot.id });
      this.resize();
      return;
    }
    this.openBlindBox(slot);
  }

  private handleBenchTap(index: number) {
    const player = this.game.substitutes[index];
    const selected = this.selectedSource();
    if (selected) {
      if (this.sameSource(selected, { type: 'bench', index })) {
        this.clearSelection();
        this.resize();
        return;
      }
      const swapped = this.applySwap(selected, { type: 'bench', index });
      this.clearSelection();
      if (!swapped && player) this.selectSource({ type: 'bench', index });
      this.resize();
      return;
    }
    if (player) {
      this.selectSource({ type: 'bench', index });
      this.resize();
      return;
    }
    this.openBenchBlindBox(index);
  }

  private slotSelectionRing(scale = 1) {
    const ring = new Graphics();
    ring.roundRect(-52 * scale, -52 * scale, 104 * scale, 144 * scale, 10);
    ring.stroke({ color: 0xffe56a, alpha: 0.98, width: 4 });
    ring.roundRect(-58 * scale, -58 * scale, 116 * scale, 156 * scale, 14);
    ring.stroke({ color: 0x47fff0, alpha: 0.45, width: 2 });
    return ring;
  }

  private bindDragHandlers(target: Container, source: CardSource, player: PlayerCardData) {
    target.on('pointerdown', (event: FederatedPointerEvent) => {
      this.cardDrag = {
        pointerId: event.pointerId,
        source,
        player,
        globalX: event.global.x,
        globalY: event.global.y,
        elapsed: 0,
        dragging: false
      };
    });
    const move = (event: FederatedPointerEvent) => {
      const drag = this.cardDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.globalX = event.global.x;
      drag.globalY = event.global.y;
      if (drag.dragging) this.moveDragPreview(drag.globalX, drag.globalY);
    };
    target.on('pointermove', move);
    target.on('globalpointermove', move);
    const finish = (event: FederatedPointerEvent) => {
      const drag = this.cardDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      this.cardDrag = undefined;
      this.removeDragPreview();
      if (!drag.dragging) return;
      this.suppressNextSlotTap = true;
      const targetSource = this.sourceAtGlobal(event.global.x, event.global.y);
      this.clearSelection();
      if (targetSource && this.applySwap(drag.source, targetSource)) {
        this.game.sound.play('select');
      } else {
        this.game.sound.play('tap');
      }
      this.resize();
    };
    target.on('pointerup', finish);
    target.on('pointerupoutside', finish);
    target.on('pointercancel', finish);
  }

  private selectedSource(): CardSource | undefined {
    if (this.selectedSlotId) return { type: 'lineup', slotId: this.selectedSlotId };
    if (this.selectedBenchIndex !== undefined) return { type: 'bench', index: this.selectedBenchIndex };
    return undefined;
  }

  private selectSource(source: CardSource) {
    this.selectedSlotId = source.type === 'lineup' ? source.slotId : undefined;
    this.selectedBenchIndex = source.type === 'bench' ? source.index : undefined;
  }

  private clearSelection() {
    this.selectedSlotId = undefined;
    this.selectedBenchIndex = undefined;
  }

  private sameSource(a: CardSource, b: CardSource) {
    if (a.type !== b.type) return false;
    if (a.type === 'lineup' && b.type === 'lineup') return a.slotId === b.slotId;
    if (a.type === 'bench' && b.type === 'bench') return a.index === b.index;
    return false;
  }

  private applySwap(from: CardSource, to: CardSource | { type: 'lineup'; slot: LineupSlot }) {
    if (from.type === 'lineup' && to.type === 'lineup') {
      const toSlotId = 'slot' in to ? to.slot.id : to.slotId;
      return this.game.swapLineupSlots(from.slotId, toSlotId);
    }
    if (from.type === 'lineup' && to.type === 'bench') {
      return this.game.swapLineupWithSubstitute(from.slotId, to.index);
    }
    if (from.type === 'bench' && to.type === 'lineup') {
      const toSlotId = 'slot' in to ? to.slot.id : to.slotId;
      return this.game.swapLineupWithSubstitute(toSlotId, from.index);
    }
    if (from.type === 'bench' && to.type === 'bench') {
      return this.game.swapSubstitutes(from.index, to.index);
    }
    return false;
  }

  private showDragPreview(player: PlayerCardData, globalX: number, globalY: number) {
    this.removeDragPreview();
    const preview = new Container();
    preview.scale.set(1.08);
    preview.alpha = 0.92;
    const innerR = FormationScene.SLOT_HEX_INNER_R;
    const faceSize = innerR * 2;
    const frame = this.emptyCardFrame();
    const face = this.portrait(player, faceSize, false);
    face.x = -faceSize / 2;
    face.y = -faceSize / 2;
    const rating = label(String(player.rating), 22, palette.white, '900');
    rating.anchor.set(0, 0);
    rating.x = face.x + 4;
    rating.y = face.y + 6;
    const pos = this.cardMetaLabel(this.positionName(player.position), 16);
    pos.anchor.set(0, 0);
    pos.x = face.x + 4;
    pos.y = face.y + 26;
    const lift = new Graphics();
    this.drawHexPath(lift, 0, 0, FormationScene.SLOT_HEX_OUTER_R + 4);
    lift.stroke({ color: 0xffe56a, alpha: 0.9, width: 4 });
    preview.addChild(frame, face, rating, pos, lift);
    this.dragPreview = preview;
    this.container.addChild(preview);
    this.moveDragPreview(globalX, globalY);
  }

  private moveDragPreview(globalX: number, globalY: number) {
    if (!this.dragPreview) return;
    const local = this.container.toLocal({ x: globalX, y: globalY });
    this.dragPreview.x = local.x;
    this.dragPreview.y = local.y - 12;
  }

  private removeDragPreview() {
    this.dragPreview?.parent?.removeChild(this.dragPreview);
    this.dragPreview?.destroy({ children: true });
    this.dragPreview = undefined;
  }

  private sourceAtGlobal(globalX: number, globalY: number): CardSource | undefined {
    const lineupSlot = this.slotAtGlobal(globalX, globalY);
    if (lineupSlot) return { type: 'lineup', slotId: lineupSlot.id };
    const benchIndex = this.benchIndexAtGlobal(globalX, globalY);
    return benchIndex === undefined ? undefined : { type: 'bench', index: benchIndex };
  }

  private slotAtGlobal(globalX: number, globalY: number) {
    if (!this.field) return undefined;
    const local = this.field.toLocal({ x: globalX, y: globalY });
    const { fieldW, fieldH } = this.fieldLayout();
    return this.game.lineup.find((slot) => {
      const visual = this.visualSlotPosition(slot);
      const x = 66 + visual.x * (fieldW - 132);
      const y = 60 + visual.y * (fieldH - 150);
      return Math.abs(local.x - x) <= 64 && local.y >= y - 64 && local.y <= y + 96;
    });
  }

  private benchIndexAtGlobal(globalX: number, globalY: number) {
    const { x, y, panelH, itemGap } = this.benchLayout();
    const localX = globalX - x;
    const localY = globalY - y;
    const itemY = panelH * 0.78;
    for (let index = 0; index < 5; index += 1) {
      const itemX = 92 + itemGap * index;
      if (Math.abs(localX - itemX) <= 58 && localY >= itemY - 104 && localY <= itemY + 38) return index;
    }
    return undefined;
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
    const activePosition =
      targetSlot?.position === 'GK' ? 'GK' : targetSlot && this.warehouseFilter === 'GK' ? undefined : this.warehouseFilter;
    const owned = this.game
      .ownedPlayers()
      .filter((player) => {
        if (targetSlot) {
          const availableForSlot = player.id === targetSlot.player?.id || !lineupIds.has(player.id);
          return (
            availableForSlot &&
            this.canShowPlayerForSlot(player, targetSlot.position) &&
            (!activePosition || player.position === activePosition)
          );
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

    const bg = coverSprite(PAGE_BG, panelW, panelH);
    const shade = new Graphics();
    shade.rect(0, 0, panelW, panelH);
    shade.fill({ color: 0x020613, alpha: 0.72 });
    shade.rect(0, 0, panelW, 172);
    shade.fill({ color: 0x020613, alpha: 0.42 });
    panel.addChild(bg, shade);

    const headerCenterY = 58;
    const close = imageBackButton(66);
    close.x = 12;
    close.y = headerCenterY - 33;
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

    const tabs =
      targetSlot?.position === 'GK'
        ? [{ text: '门将', position: 'GK' as Position }]
        : [
            { text: '全部', position: undefined },
            { text: '前锋', position: 'FW' as Position },
            { text: '中场', position: 'MF' as Position },
            { text: '后卫', position: 'DF' as Position },
            ...(targetSlot ? [] : [{ text: '门将', position: 'GK' as Position }])
          ];
    const activeTab = Math.max(0, tabs.findIndex((tab) => tab.position === activePosition));
    const tabY = 108;
    const tabW = panelW / tabs.length;
    tabs.forEach((item, index) => {
      const tabButton = new Container();
      tabButton.x = index * tabW + 8;
      tabButton.y = tabY;
      tabButton.hitArea = new Rectangle(0, 0, tabW - 16, 46);
      tabButton.eventMode = 'static';
      tabButton.cursor = 'pointer';
      const tab = new Graphics();
      tab.roundRect(0, 0, tabW - 16, 46, 10);
      tab.fill({ color: index === activeTab ? 0x10234b : 0x061936, alpha: index === activeTab ? 0.96 : 0.74 });
      tab.stroke({ color: 0x134b8a, alpha: 0.5, width: 1 });
      const tabText = label(item.text, 21, index === activeTab ? 0xffd632 : 0xbfd7ff, '900');
      tabText.anchor.set(0.5);
      tabText.x = tabW / 2 - 8;
      tabText.y = 24;
      tabButton.addChild(tab, tabText);
      tabButton.on('pointertap', () => {
        this.game.sound.play('tap');
        this.warehouseFilter = item.position;
        this.warehouseScrollY = 0;
        this.openCardWarehouse(targetSlot);
      });
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

    const fit = this.fitCardBgBounds(player.rarity, innerW, innerH);
    const bg = this.cardBgSprite(player.rarity);
    bg.x = fit.offsetX;
    bg.y = fit.offsetY;
    bg.width = fit.drawW;
    bg.height = fit.drawH;
    c.addChild(bg);

    const bx = fit.offsetX;
    const by = fit.offsetY;
    const bw = fit.drawW;
    const bh = fit.drawH;
    const faceSize = bw * 0.54;
    const face = this.portrait(player, faceSize);
    face.x = bx + (bw - faceSize) / 2 + contentOffsetX;
    face.y = by + bh * 0.3;
    c.addChild(face);

    const rating = label(String(player.rating), Math.round(bw * 0.23), palette.white, '900');
    rating.x = bx + bw * 0.12 + contentOffsetX;
    rating.y = by + bh * 0.07;
    const pos = this.cardMetaLabel(this.positionName(player.position), Math.round(bw * 0.12));
    pos.x = bx + bw * 0.13 + contentOffsetX;
    pos.y = by + bh * 0.23;
    c.addChild(rating, pos);

    const nameText = this.compactPlayerName(playerDisplayName(player));
    const layout = this.cardFaceLayout(player.rarity);
    const name = this.fitLabel(nameText, Math.round(bw * 0.12), bw * 0.66, palette.white, '900', 0.82);
    name.anchor.set(0.5);
    name.x = bx + bw / 2 + contentOffsetX;
    name.y = by + bh * layout.nameY;
    c.addChild(name);
    return c;
  }

  private compactPlayerName(name: string) {
    return shortenPlayerName(name);
  }

  private fitLabel(text: string, size: number, maxWidth: number, color = palette.white, weight: '400' | '700' | '900' = '700', minScale = 0.7) {
    const t = label(text, size, color, weight);
    if (t.width > maxWidth) {
      const scale = Math.max(minScale, maxWidth / t.width);
      t.scale.set(scale);
    }
    return t;
  }

  private fitSkillLabel(text: string, size: number, maxWidth: number, minScale = 0.72) {
    const t = new Text({
      text,
      style: new TextStyle({
        fill: 0xfff0b3,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: size,
        fontWeight: '700',
        align: 'center',
        stroke: { color: 0x2a1400, width: 3 },
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
          alpha: 0.78
        }
      })
    });
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
    const outerR = FormationScene.SLOT_HEX_OUTER_R;
    const innerR = FormationScene.SLOT_HEX_INNER_R;
    const shadow = new Graphics();
    this.drawHexPath(shadow, 0, 8, outerR - 2);
    shadow.fill({ color: 0x000000, alpha: 0.42 });
    const outer = new Graphics();
    this.drawHexPath(outer, 0, 0, outerR);
    outer.fill({ color: 0x02090b, alpha: 0.96 });
    outer.stroke({ color: 0xffffff, alpha: 0.72, width: 4 });
    const inner = new Graphics();
    this.drawHexPath(inner, 0, 0, innerR);
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
    const fit = this.fitCardBgBounds(rarity, width, height);
    const bg = this.cardBgSprite(rarity);
    bg.anchor.set(0.5);
    bg.width = fit.drawW;
    bg.height = fit.drawH;
    c.addChild(shadow, bg);
    return c;
  }

  private cardFaceLayout(rarity: Rarity) {
    if (rarity === 'orange') {
      return { portraitY: 0.27, roleY: 0.16, skillY: 0.68, nameY: 0.86 };
    }
    if (rarity === 'gold' || rarity === 'legend') {
      return { portraitY: 0.28, roleY: 0.17, skillY: 0.68, nameY: 0.875 };
    }
    return { portraitY: 0.28, roleY: 0.17, skillY: 0.68, nameY: 0.825 };
  }

  private cardBgAspect(rarity: Rarity) {
    const frame = FormationScene.CARD_BG_FRAMES[rarity];
    return frame.width / frame.height;
  }

  private fitCardBgBounds(rarity: Rarity, boxW: number, boxH: number) {
    const aspect = this.cardBgAspect(rarity);
    const boxAspect = boxW / boxH;
    let drawW = boxW;
    let drawH = boxH;
    if (aspect > boxAspect) drawH = boxW / aspect;
    else if (aspect < boxAspect) drawW = boxH * aspect;
    return {
      drawW,
      drawH,
      offsetX: (boxW - drawW) / 2,
      offsetY: (boxH - drawH) / 2
    };
  }

  private cardBgSprite(rarity: Rarity) {
    const texture = Texture.from('/assets/ui/cardbg.png');
    return new Sprite(
      new Texture({
        source: texture.source,
        frame: FormationScene.CARD_BG_FRAMES[rarity]
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
    return this.positionName(slot.position);
  }

  private openBlindBox(slot: LineupSlot) {
    if (slot.player) return;
    this.modalSlotId = slot.id;
    this.modalBenchIndex = undefined;
    this.revealed.clear();
    this.revealPulse = 0;
    this.revealTargetId = undefined;
    const selectedIds = this.usedPlayerIds({ slotId: slot.id });
    this.modalCandidates = this.shufflePlayers(
      this.game
        .ownedPlayers()
        .filter(
          (player) =>
            this.canShowPlayerForSlot(player, slot.position) &&
            (player.id === slot.player?.id || !selectedIds.includes(player.id))
        )
    ).slice(0, FormationScene.BLIND_BOX_PICK_COUNT);
    this.drawBlindBoxModal(this.positionName(slot.position), '点击卡片全部开启后，再选择球员');
  }

  private canShowPlayerForSlot(player: PlayerCardData, slotPosition: Position) {
    return slotPosition === 'GK' ? player.position === 'GK' : player.position !== 'GK';
  }

  private openBenchBlindBox(index: number) {
    this.modalSlotId = undefined;
    this.modalBenchIndex = index;
    this.revealed.clear();
    this.revealPulse = 0;
    this.revealTargetId = undefined;
    const currentPlayer = this.game.substitutes[index];
    const selectedIds = this.usedPlayerIds({ benchIndex: index });
    this.modalCandidates = this.shufflePlayers(
      this.game.ownedPlayers().filter((player) => player.id === currentPlayer?.id || !selectedIds.includes(player.id))
    ).slice(0, FormationScene.BLIND_BOX_PICK_COUNT);
    this.drawBlindBoxModal(`替补${index + 1}`, '点击卡片全部开启后，再选择球员');
  }

  private usedPlayerIds(ignore: { slotId?: string; benchIndex?: number } = {}) {
    const lineupIds = this.game.lineup.flatMap((slot) =>
      slot.id !== ignore.slotId && slot.player ? [slot.player.id] : []
    );
    const benchIds = this.game.substitutes.flatMap((player, index) =>
      index !== ignore.benchIndex && player ? [player.id] : []
    );
    return [...lineupIds, ...benchIds];
  }

  private getBlindCardAspect() {
    const frame = FormationScene.BLIND_CARD_BACK_FRAME;
    return frame.height / frame.width;
  }

  private getBlindBoxLayout() {
    const shift = this.game.contentTopOffset * 0.7;
    const count = FormationScene.BLIND_BOX_PICK_COUNT;
    const sidePad = 18;
    const gap = 8;
    const availableW = this.game.width - sidePad * 2 - gap * (count - 1);
    const cardW = Math.floor((availableW / count) * FormationScene.BLIND_FACE_SCALE * FormationScene.BLIND_BACK_BOOST);
    const cardH = Math.round(cardW * this.getBlindCardAspect());
    const faceW = Math.round(cardW / FormationScene.BLIND_BACK_BOOST);
    const faceH = Math.round(faceW * this.getBlindCardAspect());
    const rowW = cardW * count + gap * (count - 1);
    const rowX = (this.game.width - rowW) / 2;
    const lift = FormationScene.BLIND_BOX_LIFT;
    const titleY = 166 + shift - lift;
    const hintY = 218 + shift - lift;
    const contentTop = hintY + 52;
    const contentBottom = this.game.height - Math.max(88, this.game.height * 0.1);
    const contentCenterY = contentTop + Math.max(cardH, contentBottom - contentTop) / 2;
    const rowY = Math.max(contentTop, contentCenterY - cardH / 2);
    return { cardW, cardH, faceW, faceH, rowX, rowY, gap, rowW, count, titleY, hintY };
  }

  private getBlindCardRow() {
    return this.modal?.getChildByName('blind-cards-row') as Container | undefined;
  }

  private layoutBlindCard(card: Container, index: number, layout: ReturnType<FormationScene['getBlindBoxLayout']>, yOffset = 0) {
    card.x = index * (layout.cardW + layout.gap);
    card.y = yOffset;
  }

  private syncBlindCardRow(cardsRow: Container, layout: ReturnType<FormationScene['getBlindBoxLayout']>, yOffset = 0) {
    cardsRow.x = layout.rowX;
    cardsRow.y = layout.rowY + yOffset;
  }

  private mountBlindBoxCards(modal: Container, layout: ReturnType<FormationScene['getBlindBoxLayout']>) {
    const existingRow = modal.getChildByName('blind-cards-row');
    if (existingRow) {
      existingRow.destroy({ children: true });
      modal.removeChild(existingRow);
    }

    const cardsRow = new Container();
    cardsRow.name = 'blind-cards-row';
    cardsRow.eventMode = 'passive';
    modal.addChild(cardsRow);
    this.syncBlindCardRow(cardsRow, layout);

    this.modalCandidates.forEach((player, index) => {
      const card = this.blindCard(player, layout.cardW, layout.cardH, layout.faceW, layout.faceH, index);
      this.layoutBlindCard(card, index, layout);
      cardsRow.addChild(card);
    });
  }

  private drawBlindBoxModal(titleText: string, hintText: string) {
    this.closeModal();
    const layout = this.getBlindBoxLayout();
    const modal = new Container();
    modal.eventMode = 'passive';

    const mask = new Graphics();
    mask.rect(0, 0, this.game.width, this.game.height);
    mask.fill({ color: 0x020613, alpha: 0.72 });
    mask.eventMode = 'none';
    modal.addChild(mask);

    const title = label(`${titleText} 3选1`, 46, palette.white, '900');
    title.anchor.set(0.5);
    title.x = this.game.width / 2;
    title.y = layout.titleY;
    title.eventMode = 'none';
    const hint = label(hintText, 22, 0xcfe0ff, '700');
    hint.anchor.set(0.5);
    hint.x = this.game.width / 2;
    hint.y = layout.hintY;
    hint.eventMode = 'none';
    modal.addChild(title, hint);

    this.mountBlindBoxCards(modal, layout);

    this.modal = modal;
    this.container.addChild(modal);
    this.animateModalCards();
  }

  private allBlindCardsRevealed() {
    return this.modalCandidates.length > 0 && this.modalCandidates.every((player) => this.revealed.has(player.id));
  }

  private blindCard(player: PlayerCardData, backW: number, backH: number, faceW: number, faceH: number, index: number) {
    const c = new Container();
    c.name = `blind-card-${index}`;
    c.eventMode = 'static';
    c.hitArea = new Rectangle(0, 0, backW, backH);
    c.interactiveChildren = false;
    const isOpen = this.revealed.has(player.id);
    const canSelect = this.allBlindCardsRevealed();
    c.cursor = !isOpen || canSelect ? 'pointer' : 'default';
    const flipping = this.revealTargetId === player.id && this.revealPulse > 0;
    const pulseRatio = flipping ? 1 - this.revealPulse / FormationScene.BLIND_REVEAL_DURATION : 0;

    const backFace = this.createBlindCardBack(backW, backH);
    const frontFace = this.createBlindCardFront(player, faceW, faceH);
    frontFace.x = (backW - faceW) / 2;
    frontFace.y = (backH - faceH) / 2;
    backFace.visible = !isOpen;
    frontFace.visible = isOpen;
    backFace.alpha = isOpen ? 0 : 1;
    frontFace.alpha = isOpen ? 1 : 0;
    c.addChild(backFace, frontFace);

    if (flipping) {
      this.drawRevealParticles(c, backW, backH, pulseRatio);
    }

    c.on('pointertap', () => {
      if (!this.revealed.has(player.id)) {
        if (this.revealPulse > 0) return;
        this.triggerReveal(player, index);
        return;
      }
      if (!this.allBlindCardsRevealed()) return;
      if (this.modalSlotId) {
        this.game.sound.play('select');
        this.game.fillSlot(this.modalSlotId, player);
      } else if (this.modalBenchIndex !== undefined) {
        this.game.sound.play('select');
        this.game.fillSubstitute(this.modalBenchIndex, player);
      }
      this.closeModal();
      this.resize();
    });
    return c;
  }

  private createBlindCardBack(w: number, h: number) {
    const face = new Container();
    const bg = this.blindCardBackSprite();
    bg.width = w;
    bg.height = h;
    face.addChild(bg);
    return face;
  }

  private blindCardBackSprite() {
    const texture = Texture.from(FormationScene.BLIND_CARD_BACK);
    return new Sprite(
      new Texture({
        source: texture.source,
        frame: FormationScene.BLIND_CARD_BACK_FRAME
      })
    );
  }

  private createBlindCardFront(player: PlayerCardData, w: number, h: number) {
    const face = new Container();
    const layout = this.cardFaceLayout(player.rarity);
    const fit = this.fitCardBgBounds(player.rarity, w, h);
    const bg = this.cardBgSprite(player.rarity);
    bg.x = fit.offsetX;
    bg.y = fit.offsetY;
    bg.width = fit.drawW;
    bg.height = fit.drawH;
    face.addChild(bg);

    const bx = fit.offsetX;
    const by = fit.offsetY;
    const bw = fit.drawW;
    const bh = fit.drawH;

    const rating = label(String(player.rating), Math.round(bw * 0.19), palette.white, '900');
    rating.x = bx + bw * 0.09;
    rating.y = by + bh * 0.05;
    const role = label(this.positionName(player.position), Math.round(bw * 0.1), palette.white, '900');
    role.x = bx + bw * 0.1;
    role.y = by + bh * layout.roleY;
    const faceSize = bw * 0.58;
    const portrait = this.portrait(player, faceSize);
    portrait.x = bx + (bw - faceSize) / 2;
    portrait.y = by + bh * layout.portraitY;
    const skill = this.fitSkillLabel(`#${player.skill}`, Math.round(bw * 0.1), bw * 0.86);
    skill.anchor.set(0.5);
    skill.x = bx + bw / 2;
    skill.y = by + bh * layout.skillY;
    const name = this.fitLabel(playerDisplayName(player), Math.round(bw * 0.13), bw * 0.84, palette.white, '900', 0.72);
    name.anchor.set(0.5);
    name.x = bx + bw / 2;
    name.y = by + bh * layout.nameY;
    face.addChild(rating, role, portrait, name, skill);
    return face;
  }

  private triggerReveal(player: PlayerCardData, _index: number) {
    if (this.revealed.has(player.id) || this.revealTargetId === player.id) return;
    this.revealTargetId = player.id;
    this.revealPulse = FormationScene.BLIND_REVEAL_DURATION;
    this.game.sound.play('reveal');
  }

  private refreshBlindBoxCards() {
    const modal = this.modal;
    if (!modal) return;
    const layout = this.getBlindBoxLayout();
    const cardsRow = this.getBlindCardRow();
    if (!cardsRow) {
      this.mountBlindBoxCards(modal, layout);
      return;
    }
    this.syncBlindCardRow(cardsRow, layout);
    this.modalCandidates.forEach((candidate, index) => {
      const existing = cardsRow.getChildByName(`blind-card-${index}`);
      if (existing) {
        cardsRow.removeChild(existing);
        existing.destroy({ children: true });
      }
      const card = this.blindCard(candidate, layout.cardW, layout.cardH, layout.faceW, layout.faceH, index);
      this.layoutBlindCard(card, index, layout);
      cardsRow.addChild(card);
    });
  }

  private closeModal() {
    if (!this.modal) return;
    this.container.removeChild(this.modal);
    this.modal.destroy({ children: true });
    this.modal = undefined;
    this.revealTargetId = undefined;
    this.revealPulse = 0;
  }

  private animateModalCards() {
    if (!this.modal) return;
    const layout = this.getBlindBoxLayout();
    const cardsRow = this.getBlindCardRow();
    if (!cardsRow) return;
    const rowOffset = Math.sin(this.modalTime / 520) * 2;
    this.syncBlindCardRow(cardsRow, layout, rowOffset);
    this.modalCandidates.forEach((player, index) => {
      const child = cardsRow.getChildByName(`blind-card-${index}`) as Container | undefined;
      if (!child) return;
      const offset = Math.sin(this.modalTime / 420 + index * 0.8) * 3;
      this.layoutBlindCard(child, index, layout, offset);

      const backFace = child.getChildAt(0);
      const frontFace = child.getChildAt(1);
      const flipping = this.revealTargetId === player.id && this.revealPulse > 0;
      const isOpen = this.revealed.has(player.id);
      const canSelect = this.allBlindCardsRevealed();
      child.cursor = !isOpen || canSelect ? 'pointer' : 'default';
      if (flipping) {
        const progress = 1 - this.revealPulse / FormationScene.BLIND_REVEAL_DURATION;
        backFace.visible = true;
        frontFace.visible = true;
        backFace.alpha = 1 - progress;
        frontFace.alpha = progress;
      } else {
        backFace.visible = !isOpen;
        frontFace.visible = isOpen;
        backFace.alpha = isOpen ? 0 : 1;
        frontFace.alpha = isOpen ? 1 : 0;
      }
    });
  }

  private shufflePlayers(pool: PlayerCardData[]) {
    return [...pool].sort(() => Math.random() - 0.5);
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

  private startMatchButton(panelW: number) {
    const filled = this.game.lineup.filter((slot) => slot.player).length;
    const ready = filled >= this.game.lineup.length;

    const buttonW = ready ? Math.min(236, panelW * 0.36) : Math.min(214, panelW * 0.34);
    const buttonH = ready ? Math.round(buttonW * (FormationScene.READY_BUTTON_FRAME.height / FormationScene.READY_BUTTON_FRAME.width)) : 54;
    const btn = new Container();
    btn.x = panelW - buttonW - 30;
    btn.y = 24;
    if (ready) {
      const texture = Texture.from(FormationScene.READY_BUTTON);
      const bg = new Sprite(new Texture({ source: texture.source, frame: FormationScene.READY_BUTTON_FRAME }));
      bg.width = buttonW;
      bg.height = buttonH;
      btn.addChild(bg);
    } else {
      const bg = new Graphics();
      bg.roundRect(0, 0, buttonW, buttonH, 14);
      bg.fill({ color: 0x10234b, alpha: 0.78 });
      bg.stroke({ color: 0x56a8ff, alpha: 0.52, width: 3 });
      btn.addChild(bg);
    }
    btn.hitArea = new Rectangle(0, 0, buttonW, buttonH);
    btn.eventMode = 'static';
    btn.cursor = ready ? 'pointer' : 'default';

    if (!ready) {
      const title = label(`还差${this.game.lineup.length - filled}人`, 22, 0xbfd7ff, '900');
      title.anchor.set(0.5);
      title.x = buttonW / 2;
      title.y = 18;
      const subtitle = label('补满首发', 15, 0x6ce8ff, '900');
      subtitle.anchor.set(0.5);
      subtitle.x = buttonW / 2;
      subtitle.y = 38;
      btn.addChild(title, subtitle);
    }
    btn.alpha = ready ? 1 : 0.72;
    btn.on('pointertap', () => {
      if (!ready) {
        this.game.sound.play('tap');
        return;
      }
      this.game.sound.play('confirm');
      this.openMatchConfirmModal();
    });
    return btn;
  }

  private openMatchConfirmModal() {
    this.closeModal();
    const modal = new Container();
    modal.eventMode = 'static';

    const mask = new Graphics();
    mask.rect(0, 0, this.game.width, this.game.height);
    mask.fill({ color: 0x020613, alpha: 0.82 });
    mask.eventMode = 'static';
    mask.on('pointertap', () => this.closeModal());
    modal.addChild(mask);

    const bgRatio = 917 / 1080;
    const maxPanelW = Math.min(this.game.width - 8, 820);
    const maxPanelH = Math.min(this.game.height - 8, 780);
    const panelH = Math.min(maxPanelH, maxPanelW / bgRatio);
    const panelW = Math.round(panelH * bgRatio);
    const panelX = (this.game.width - panelW) / 2;
    const panelY = Math.max(20, (this.game.height - panelH) / 2);
    const panel = new Container();
    panel.x = panelX;
    panel.y = panelY;
    const bg = new Sprite(Texture.from(FormationScene.MATCH_READY_BG));
    bg.width = panelW;
    bg.height = panelH;
    panel.addChild(bg);
    modal.addChild(panel);

    const closeHotspot = new Container();
    closeHotspot.x = panelW * 0.82;
    closeHotspot.y = panelH * 0.02;
    closeHotspot.hitArea = new Rectangle(0, 0, panelW * 0.16, panelH * 0.12);
    closeHotspot.eventMode = 'static';
    closeHotspot.cursor = 'pointer';
    closeHotspot.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeModal();
    });
    panel.addChild(closeHotspot);

    const title = label('赛前确认', 44, palette.white, '900');
    title.anchor.set(0.5);
    title.x = panelW / 2;
    title.y = panelH * 0.11;
    const formation = label(`${this.game.selectedFormation.name}  ${this.game.selectedFormation.style}`, 32, 0xffe56a, '900');
    formation.anchor.set(0.5);
    formation.x = panelW / 2;
    formation.y = title.y + 56;
    panel.addChild(title, formation);

    const coreY = panelH * 0.255;
    const coreTitle = label('核心球员', 34, 0x9ff5ff, '900');
    coreTitle.anchor.set(0.5);
    coreTitle.x = panelW / 2;
    coreTitle.y = coreY;
    const leftMark = this.confirmTitleMark();
    leftMark.x = panelW / 2 - 170;
    leftMark.y = coreY - 12;
    const rightMark = this.confirmTitleMark();
    rightMark.scale.x = -1;
    rightMark.x = panelW / 2 + 170;
    rightMark.y = coreY - 12;
    panel.addChild(leftMark, rightMark, coreTitle);

    const cores = this.game.lineup
      .flatMap((slot) => (slot.player ? [slot.player] : []))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
    const cardGap = panelW * 0.3;
    cores.forEach((player, index) => {
      const card = this.confirmCoreCard(player);
      card.x = panelW / 2 + (index - 1) * cardGap;
      card.y = panelH * 0.425;
      panel.addChild(card);
    });

    const powerPanelY = panelH * 0.63;
    const powerPanel = new Graphics();
    powerPanel.roundRect(panelW * 0.12, powerPanelY, panelW * 0.76, 92, 18);
    powerPanel.fill({ color: 0x061a38, alpha: 0.78 });
    powerPanel.stroke({ color: 0x1f71ff, alpha: 0.48, width: 2 });
    const scoreTexture = Texture.from(FormationScene.PLAYER_SCORE_ICON);
    const badge = new Sprite(new Texture({ source: scoreTexture.source, frame: FormationScene.PLAYER_SCORE_ICON_FRAME }));
    badge.anchor.set(0.5);
    badge.width = 58;
    badge.height = 68;
    badge.x = panelW * 0.29;
    badge.y = powerPanelY + 48;
    const power = label(`当前战力 ${this.game.lineupPower()}`, 32, palette.white, '900');
    power.anchor.set(0, 0.5);
    power.x = panelW * 0.37;
    power.y = powerPanelY + 38;
    const powerValue = power.text.split(' ').pop() ?? '';
    power.text = '当前战力 ';
    const value = label(powerValue, 42, 0xffe56a, '900');
    value.anchor.set(0, 0.5);
    value.x = power.x + power.width + 4;
    value.y = power.y;
    const status = label('阵容已保存，状态良好', 23, 0x9fb4d8, '900');
    status.anchor.set(0, 0.5);
    status.x = panelW * 0.37;
    status.y = powerPanelY + 68;
    panel.addChild(powerPanel, badge, power, value, status);

    const buttonY = panelH - 162;
    const cancel = this.confirmImageButton(FormationScene.CONFIRM_ADJUST_BUTTON_FRAME, panelW * 0.12, buttonY + 12, panelW * 0.34);
    cancel.on('pointertap', () => {
      this.game.sound.play('tap');
      this.closeModal();
    });
    const go = this.confirmImageButton(FormationScene.CONFIRM_READY_BUTTON_FRAME, panelW * 0.54, buttonY + 12, panelW * 0.34);
    go.on('pointertap', () => {
      this.game.sound.play('confirm');
      this.closeModal();
      this.game.changeScene('matchmaking');
    });
    panel.addChild(cancel, go);

    this.modal = modal;
    this.container.addChild(modal);
  }

  private confirmCoreCard(player: PlayerCardData) {
    const c = new Container();
    c.addChild(this.cardFrame(player.rarity, 136, 154));
    const face = this.portrait(player, 90);
    face.x = -45;
    face.y = -42;
    const rating = label(String(player.rating), 28, palette.white, '900');
    rating.anchor.set(0.5);
    rating.x = -40;
    rating.y = -58;
    const pos = this.cardMetaLabel(this.positionName(player.position), 22);
    pos.anchor.set(0.5);
    pos.x = -38;
    pos.y = -31;
    const nameBg = new Graphics();
    nameBg.roundRect(-66, 70, 132, 42, 9);
    nameBg.fill({ color: 0x071e41, alpha: 0.92 });
    nameBg.stroke({ color: 0x56a8ff, alpha: 0.46, width: 2 });
    const name = this.fitLabel(playerDisplayName(player), 25, 120, palette.white, '900', 0.72);
    name.anchor.set(0.5);
    name.y = 91;
    c.addChild(face, rating, pos, nameBg, name);
    return c;
  }

  private confirmTitleMark() {
    const c = new Container();
    const g = new Graphics();
    g.poly([0, 8, 78, 8, 94, 0, 78, -8, 0, -8]);
    g.fill({ color: 0x0b65ff, alpha: 0.72 });
    g.rect(18, -8, 14, 16);
    g.fill({ color: 0x66eaff, alpha: 0.85 });
    c.addChild(g);
    return c;
  }

  private confirmImageButton(frame: Rectangle, x: number, y: number, width: number) {
    const btn = new Container();
    const texture = Texture.from(FormationScene.CONFIRM_READY_BUTTON);
    const sprite = new Sprite(new Texture({ source: texture.source, frame }));
    const height = Math.round(width * (frame.height / frame.width));
    sprite.width = width;
    sprite.height = height;
    btn.x = x;
    btn.y = y;
    btn.addChild(sprite);
    btn.hitArea = new Rectangle(0, 0, width, height);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    return btn;
  }

  private confirmActionButton(text: string, x: number, y: number, fill: number, stroke: number, textColor: number, width = 176, height = 54) {
    const btn = new Container();
    btn.x = x;
    btn.y = y;
    const w = width;
    const h = height;
    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 18);
    bg.fill({ color: fill, alpha: 0.96 });
    bg.stroke({ color: stroke, alpha: 0.9, width: 4 });
    const shine = new Graphics();
    shine.roundRect(10, 8, w - 20, h * 0.35, 14);
    shine.fill({ color: 0xffffff, alpha: fill === 0xffd640 ? 0.24 : 0.08 });
    const title = label(text, Math.round(h * 0.38), textColor, '900');
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = h / 2;
    btn.addChild(bg, shine, title);
    btn.hitArea = new Rectangle(0, 0, w, h);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    return btn;
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
        .ownedPlayers()
        .filter((item) => !usedIds.has(item.id) && this.canShowPlayerForSlot(item, slot.position))
        .sort((a, b) => b.rating - a.rating)[0];
      if (player) usedIds.add(player.id);
      return { ...slot, player };
    });

    const benchPool = this.game
      .ownedPlayers()
      .filter((player) => !usedIds.has(player.id))
      .sort((a, b) => b.rating - a.rating);
    this.game.substitutes = Array.from({ length: 5 }, (_, index) => benchPool[index]);
  }

  private positionName(position: Position) {
    if (position === 'GK') return '门将';
    if (position === 'DF') return '后卫';
    if (position === 'MF') return '中场';
    return '前锋';
  }

  private portrait(player: PlayerCardData, size: number, showFrame = true) {
    const c = new Container();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;
    const hexH = r * Math.sqrt(3);
    const sprite = new Sprite(Texture.from(player.portrait));
    const textureWidth = sprite.texture.width || 1024;
    const textureHeight = sprite.texture.height || 1024;
    const scale = Math.max(size / textureWidth, hexH / textureHeight);
    sprite.scale.set(scale);
    sprite.x = (size - textureWidth * scale) / 2;
    sprite.y = cy - hexH / 2 + (hexH - textureHeight * scale) / 2;

    const mask = new Graphics();
    this.drawHexPath(mask, cx, cy, r);
    mask.fill(0xffffff);
    sprite.mask = mask;

    c.addChild(sprite, mask);
    if (showFrame) {
      const frame = new Graphics();
      this.drawHexPath(frame, cx, cy, r);
      frame.stroke({ color: player.color, alpha: 0.85, width: 3 });
      c.addChild(frame);
    }
    return c;
  }

}
