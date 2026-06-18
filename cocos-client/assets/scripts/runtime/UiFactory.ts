import { Color, Graphics, Label, Node, UITransform, Vec3 } from 'cc';

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

export const colors = {
  background: new Color(5, 12, 34, 255),
  panel: new Color(17, 35, 72, 245),
  panelSoft: new Color(24, 52, 92, 220),
  primary: new Color(31, 126, 255, 255),
  success: new Color(37, 201, 139, 255),
  danger: new Color(242, 72, 96, 255),
  gold: new Color(255, 215, 92, 255),
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
  graphics.fillColor = color;
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  parent.addChild(node);
  return node;
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
  text(node, value, 0, 0, 28, colors.white, width - 32);
  node.on(Node.EventType.TOUCH_START, () => node.setScale(0.97, 0.97, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
  node.on(Node.EventType.TOUCH_END, () => {
    node.setScale(1, 1, 1);
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
