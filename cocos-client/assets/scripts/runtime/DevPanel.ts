import { Color, EventTouch, Node, UITransform, view } from 'cc';
import {
  cycleDevTestUser,
  devDefaultScene,
  devPanelCollapsed,
  type DevSceneName,
  matchWaitMs,
  matchWithAiEnabled,
  nextDevScene,
  prevDevScene,
  readDevPanelPosition,
  setDevDefaultScene,
  setDevPanelCollapsed,
  setMatchWaitSeconds,
  setMatchWithAiEnabled,
  writeDevPanelPosition
} from './DevConfig';
import { button, colors, layer, panel, text } from './UiFactory';

const PANEL_W = 300;
const PANEL_H = 400;
const CHIP_W = 76;
const CHIP_H = 36;
const PAD = 14;

export interface DevPanelActions {
  currentScene(): DevSceneName;
  platformUserId(): string;
  nickname(): string;
  jumpScene(scene: DevSceneName): void;
  reloadSession(): void;
  applyTestUser(testUser: string): void;
}

export class DevPanel {
  private readonly root: Node;
  private collapsed = devPanelCollapsed();
  private selectedScene: DevSceneName = devDefaultScene();
  private matchAi = matchWithAiEnabled();
  private matchSeconds = Math.round(matchWaitMs() / 1000);
  private statusLabel?: { string: string };
  private dragStart?: { x: number; y: number; nodeX: number; nodeY: number };
  private positioned = false;

  constructor(parent: Node, private readonly actions: DevPanelActions) {
    this.root = layer('DevPanelRoot', parent, PANEL_W, PANEL_H);
    this.root.setSiblingIndex(9999);
    this.applyPosition();
    view.on('canvas-resize', this.onResize, this);
    this.render();
  }

  destroy(): void {
    view.off('canvas-resize', this.onResize, this);
    this.root.destroy();
  }

  refresh(): void {
    this.render();
  }

  private panelSize(): { w: number; h: number } {
    return this.collapsed ? { w: CHIP_W, h: CHIP_H } : { w: PANEL_W, h: PANEL_H };
  }

  private defaultPosition(): { x: number; y: number } {
    const visible = view.getVisibleSize();
    const { w, h } = this.panelSize();
    return {
      x: visible.width / 2 - PAD - w / 2,
      y: visible.height / 2 - PAD - h / 2
    };
  }

  private applyPosition(saved?: { x: number; y: number }): void {
    const pos = saved ?? readDevPanelPosition() ?? this.defaultPosition();
    const { w, h } = this.panelSize();
    this.root.getComponent(UITransform)?.setContentSize(w, h);
    this.root.setPosition(pos.x, pos.y);
    this.positioned = true;
  }

  private savePosition(): void {
    writeDevPanelPosition(this.root.position.x, this.root.position.y);
  }

  private onResize(): void {
    if (!readDevPanelPosition()) this.applyPosition();
  }

  private setCollapsed(next: boolean): void {
    if (this.collapsed === next) return;
    const before = this.panelSize();
    const pos = this.root.position;
    this.collapsed = next;
    setDevPanelCollapsed(next);
    const after = this.panelSize();
    // 保持右上角不动
    this.root.setPosition(
      pos.x + (before.w - after.w) / 2,
      pos.y + (before.h - after.h) / 2
    );
    this.savePosition();
    this.render();
  }

  private render(): void {
    this.root.removeAllChildren();
    const { w, h } = this.panelSize();
    this.root.getComponent(UITransform)?.setContentSize(w, h);
    if (!this.positioned) this.applyPosition();

    if (this.collapsed) {
      this.renderCollapsed(w, h);
      return;
    }
    this.renderExpanded(w, h);
  }

  private renderCollapsed(w: number, h: number): void {
    const chip = panel(this.root, 0, 0, w, h, new Color(3, 10, 28, 250), 8);
    this.bindDrag(chip);
    button(chip, 'DEV', 0, 0, w - 8, h - 8, () => this.setCollapsed(false), colors.primary);
  }

  private renderExpanded(w: number, h: number): void {
    const shell = panel(this.root, 0, 0, w, h, new Color(3, 10, 28, 245), 10);
    this.bindDrag(shell);

    const top = h / 2 - 22;
    const header = panel(shell, 0, top, w - 12, 40, new Color(8, 24, 52, 240), 8);
    text(header, 'DEV 调试', -72, 0, 18, colors.white, 120);
    button(header, '收起', 88, 0, 64, 30, () => this.setCollapsed(true), colors.panelSoft);

    let y = top - 48;
    this.statusLabel = text(shell, this.buildStatus(), 0, y, 13, colors.cyan, w - 24);
    y -= 36;

    y = this.renderSceneRow(shell, y);
    y = this.renderRow(shell, y, '测试账号', this.actions.platformUserId(), () => {
      this.actions.applyTestUser(cycleDevTestUser(this.actions.platformUserId()));
      this.render();
    }, '切换');
    y = this.renderToggleRow(shell, y, '匹配电脑', this.matchAi, (value) => {
      this.matchAi = value;
      setMatchWithAiEnabled(value);
    });
    y = this.renderStepperRow(shell, y, '匹配秒数', `${this.matchSeconds}s`, () => {
      this.matchSeconds = Math.max(3, this.matchSeconds - 1);
      setMatchWaitSeconds(this.matchSeconds);
      this.render();
    }, () => {
      this.matchSeconds = Math.min(120, this.matchSeconds + 1);
      setMatchWaitSeconds(this.matchSeconds);
      this.render();
    });
    y -= 6;
    button(shell, '重新同步', -70, y, 120, 36, () => {
      void this.actions.reloadSession();
      this.render();
    }, colors.primary);
    button(shell, '保存默认', 70, y, 110, 36, () => {
      setDevDefaultScene(this.selectedScene);
      setMatchWithAiEnabled(this.matchAi);
      setMatchWaitSeconds(this.matchSeconds);
      if (this.statusLabel) this.statusLabel.string = '已保存';
    }, colors.panelSoft);
  }

  private bindDrag(node: Node): void {
    node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      const target = event.target as Node | null;
      if (target?.name?.startsWith('Button:')) return;
      this.beginDrag(event);
    });
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.moveDrag(event));
    node.on(Node.EventType.TOUCH_END, () => this.endDrag());
    node.on(Node.EventType.TOUCH_CANCEL, () => this.endDrag());
  }

  private beginDrag(event: EventTouch): void {
    const location = event.getUILocation();
    this.dragStart = { x: location.x, y: location.y, nodeX: this.root.position.x, nodeY: this.root.position.y };
  }

  private moveDrag(event: EventTouch): void {
    if (!this.dragStart) return;
    const location = event.getUILocation();
    this.root.setPosition(
      this.dragStart.nodeX + location.x - this.dragStart.x,
      this.dragStart.nodeY + location.y - this.dragStart.y
    );
  }

  private endDrag(): void {
    if (this.dragStart) this.savePosition();
    this.dragStart = undefined;
  }

  private buildStatus(): string {
    return `${this.actions.nickname()} · ${this.actions.platformUserId()}`;
  }

  private renderSceneRow(parent: Node, y: number): number {
    text(parent, '场景', -108, y, 15, colors.muted, 50);
    text(parent, this.selectedScene, 0, y, 16, colors.white, 90);
    button(parent, '<', -48, y, 30, 30, () => {
      this.selectedScene = prevDevScene(this.selectedScene);
      this.render();
    }, colors.panelSoft);
    button(parent, '>', 48, y, 30, 30, () => {
      this.selectedScene = nextDevScene(this.selectedScene);
      this.render();
    }, colors.panelSoft);
    button(parent, '跳转', 100, y, 64, 30, () => this.actions.jumpScene(this.selectedScene), colors.primary);
    return y - 40;
  }

  private renderRow(parent: Node, y: number, labelValue: string, value: string, onTap: () => void, action: string): number {
    text(parent, labelValue, -108, y, 15, colors.muted, 64);
    text(parent, value, -10, y, 15, colors.white, 100);
    button(parent, action, 100, y, 64, 30, onTap, colors.panelSoft);
    return y - 40;
  }

  private renderToggleRow(parent: Node, y: number, labelValue: string, enabled: boolean, onChange: (value: boolean) => void): number {
    text(parent, labelValue, -108, y, 15, colors.muted, 90);
    button(parent, enabled ? '开' : '关', 100, y, 64, 30, () => {
      onChange(!enabled);
      this.render();
    }, enabled ? colors.success : colors.panelSoft);
    return y - 40;
  }

  private renderStepperRow(
    parent: Node,
    y: number,
    labelValue: string,
    value: string,
    onPrev: () => void,
    onNext: () => void
  ): number {
    text(parent, labelValue, -108, y, 15, colors.muted, 72);
    button(parent, '-', 24, y, 30, 30, onPrev, colors.panelSoft);
    text(parent, value, 72, y, 16, colors.white, 56);
    button(parent, '+', 118, y, 30, 30, onNext, colors.panelSoft);
    return y - 40;
  }
}
