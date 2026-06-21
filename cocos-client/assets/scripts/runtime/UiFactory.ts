import { Color, Graphics, Label, Node, UITransform, Vec3 } from 'cc';
import { GameAudio } from './GameAudio';

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

export const colors = {
  background: new Color(5, 12, 34, 255),
  panel: new Color(8, 27, 61, 245),
  panelSoft: new Color(16, 48, 91, 228),
  primary: new Color(35, 137, 255, 255),
  success: new Color(37, 201, 139, 255),
  danger: new Color(242, 72, 96, 255),
  gold: new Color(255, 215, 92, 255),
  cyan: new Color(74, 222, 255, 255),
  border: new Color(74, 154, 255, 150),
  white: new Color(245, 249, 255, 255),
  muted: new Color(151, 171, 205, 255)
};

export function layer(name: string, parent: Node, width = DESIGN_WIDTH, height = DESIGN_HEIGHT): Node {
  const node = new Node(name);
  node.addComponent(UITransform).setContentSize(width, height);
  parent.addChild(node);
  return node;
}

export function panel(parent: Node, x: number, y: number, width: number, height: number, color = colors.panel, radius = 24): Node {
  const node = new Node('Panel');
  node.setPosition(x, y);
  node.addComponent(UITransform).setContentSize(width, height);
  const graphics = node.addComponent(Graphics);
  if (width >= 90 && height >= 40) {
    graphics.fillColor = new Color(0, 5, 18, 92);
    graphics.roundRect(-width / 2, -height / 2 - 5, width, height, radius);
    graphics.fill();
  }
  graphics.fillColor = color;
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  if (width >= 90 && height >= 40) {
    graphics.strokeColor = new Color(104, 178, 255, 100);
    graphics.lineWidth = 1.5;
    graphics.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, Math.max(2, radius - 1));
    graphics.stroke();
    graphics.strokeColor = new Color(197, 236, 255, 72);
    graphics.lineWidth = 1;
    graphics.moveTo(-width / 2 + radius, height / 2 - 3);
    graphics.lineTo(width / 2 - radius, height / 2 - 3);
    graphics.stroke();
  }
  parent.addChild(node);
  return node;
}

export function sectionTitle(
  parent: Node,
  value: string,
  x: number,
  y: number,
  width = 280,
  accent = colors.gold,
  fontSize = 22
): Node {
  const title = layer(`SectionTitle:${value}`, parent, width, 52);
  title.setPosition(x, y);
  const graphics = title.addComponent(Graphics);
  const lineStart = Math.max(54, Math.min(82, width * 0.28));
  graphics.strokeColor = new Color(accent.r, accent.g, accent.b, 145);
  graphics.lineWidth = 2;
  graphics.moveTo(-width / 2, 0);
  graphics.lineTo(-lineStart, 0);
  graphics.moveTo(lineStart, 0);
  graphics.lineTo(width / 2, 0);
  graphics.stroke();
  graphics.fillColor = accent;
  graphics.moveTo(-lineStart + 12, 8);
  graphics.lineTo(-lineStart + 24, 0);
  graphics.lineTo(-lineStart + 12, -8);
  graphics.lineTo(-lineStart, 0);
  graphics.close();
  graphics.fill();
  graphics.moveTo(lineStart - 12, 8);
  graphics.lineTo(lineStart, 0);
  graphics.lineTo(lineStart - 12, -8);
  graphics.lineTo(lineStart - 24, 0);
  graphics.close();
  graphics.fill();
  text(title, value, 0, 0, fontSize, accent, Math.max(120, lineStart * 2 - 38));
  return title;
}

export function text(
  parent: Node,
  value: string,
  x: number,
  y: number,
  fontSize = 28,
  color = colors.white,
  width = 640
): Label {
  const node = new Node('Label');
  node.setPosition(new Vec3(x, y));
  node.addComponent(UITransform).setContentSize(width, Math.max(fontSize * 2.2, 60));
  const label = node.addComponent(Label);
  label.string = value;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.35);
  label.color = color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  parent.addChild(node);
  return label;
}

export function button(
  parent: Node,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  onClick: () => void,
  color = colors.primary
): Node {
  const node = panel(parent, x, y, width, height, color, height / 2);
  node.name = `Button:${value}`;
  const shine = node.getComponent(Graphics)!;
  shine.strokeColor = new Color(255, 255, 255, 92);
  shine.lineWidth = 2;
  shine.moveTo(-width * 0.3, height * 0.23);
  shine.lineTo(width * 0.3, height * 0.23);
  shine.stroke();
  text(node, value, 0, 1, Math.min(28, height * 0.38), colors.white, width - 32);
  node.on(Node.EventType.TOUCH_START, () => node.setScale(0.97, 0.97, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
  node.on(Node.EventType.TOUCH_END, () => {
    node.setScale(1, 1, 1);
    GameAudio.play('tap');
    onClick();
  });
  return node;
}

export function divider(parent: Node, x: number, y: number, width: number, color = new Color(67, 94, 137, 180)): void {
  const graphics = parent.getComponent(Graphics) ?? parent.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.rect(x - width / 2, y - 1, width, 2);
  graphics.fill();
}

export function formatNumber(value: number): string {
  return value >= 10000 ? `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万` : String(value);
}
