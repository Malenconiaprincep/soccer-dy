import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';

export const palette = {
  navy: 0x080d29,
  panel: 0x101b3e,
  gold: 0xffb21a,
  orange: 0xff7d12,
  blue: 0x1c67e8,
  purple: 0x7a31d8,
  green: 0x46b12b,
  white: 0xffffff,
  muted: 0x9fb4d8
};

export function label(text: string, size = 24, color = palette.white, weight: '400' | '700' | '900' = '700') {
  return new Text({
    text,
    style: new TextStyle({
      fill: color,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: size,
      fontWeight: weight,
      align: 'center',
      dropShadow: {
        color: 0x000000,
        blur: 2,
        distance: 2,
        alpha: 0.55
      }
    })
  });
}

export function roundedBox(width: number, height: number, fill: number, stroke = 0xffffff, alpha = 1) {
  const g = new Graphics();
  g.roundRect(0, 0, width, height, Math.min(24, height / 3));
  g.fill({ color: fill, alpha });
  g.stroke({ color: stroke, alpha: 0.36, width: 3 });
  return g;
}

export function coverSprite(src: string, width: number, height: number) {
  const sprite = new Sprite(Texture.from(src));
  const scale = Math.max(width / sprite.texture.width, height / sprite.texture.height);
  sprite.scale.set(scale);
  sprite.x = (width - sprite.texture.width * scale) / 2;
  sprite.y = (height - sprite.texture.height * scale) / 2;
  return sprite;
}

export function glassPanel(width: number, height: number, fill = 0x101a3a, stroke = 0x5f81c8) {
  const c = new Container();
  const shadow = new Graphics();
  shadow.roundRect(4, 8, width, height, 18);
  shadow.fill({ color: 0x000000, alpha: 0.35 });
  const outer = new Graphics();
  outer.roundRect(0, 0, width, height, 18);
  outer.fill({ color: fill, alpha: 0.86 });
  outer.stroke({ color: stroke, alpha: 0.9, width: 3 });
  const inner = new Graphics();
  inner.roundRect(6, 6, width - 12, height - 12, 14);
  inner.stroke({ color: 0xffffff, alpha: 0.18, width: 2 });
  c.addChild(shadow, outer, inner);
  return c;
}

export function pillButton(width: number, height: number, title: string, subtitle: string, fill = palette.gold) {
  const c = new Container();
  const glow = new Graphics();
  glow.roundRect(-12, -12, width + 24, height + 24, height / 2.6);
  glow.fill({ color: fill, alpha: 0.32 });
  const bg = new Graphics();
  bg.roundRect(0, 0, width, height, height / 3);
  bg.fill(fill);
  bg.stroke({ color: 0xfff6b6, alpha: 0.95, width: 4 });
  const depth = new Graphics();
  depth.roundRect(8, height * 0.52, width - 16, height * 0.36, height / 4);
  depth.fill({ color: fill === palette.gold ? palette.orange : 0x000000, alpha: fill === palette.gold ? 0.55 : 0.22 });
  const shine = new Graphics();
  shine.roundRect(12, 10, width - 24, height * 0.32, height / 4);
  shine.fill({ color: 0xffffff, alpha: 0.3 });
  const rim = new Graphics();
  rim.roundRect(4, 4, width - 8, height - 8, height / 3.4);
  rim.stroke({ color: 0x7d3b00, alpha: 0.36, width: 2 });
  const ball = label('⚽', Math.round(height * 0.45));
  ball.x = width * 0.12;
  ball.y = height * 0.2;
  const t = label(title, Math.round(height * 0.28), 0xfff8d2, '900');
  t.x = width * 0.34;
  t.y = height * 0.2;
  const s = label(subtitle, Math.round(height * 0.15), 0xfff2bd, '700');
  s.x = width * 0.4;
  s.y = height * 0.58;
  c.addChild(glow, bg, depth, shine, rim, ball, t);
  if (subtitle) c.addChild(s);
  c.eventMode = 'static';
  c.cursor = 'pointer';
  return c;
}

export function resourcePill(icon: string, value: string, color: number) {
  const c = new Container();
  c.addChild(glassPanel(172, 48, 0x070b18, 0x455a88));
  const shine = new Graphics();
  shine.roundRect(8, 6, 120, 12, 6);
  shine.fill({ color: 0xffffff, alpha: 0.08 });
  c.addChild(shine);
  const dot = new Graphics();
  dot.circle(25, 24, 18);
  dot.fill(color);
  dot.stroke({ color: 0xffeaa7, alpha: 0.75, width: 2 });
  const i = label(icon, 23);
  i.anchor.set(0.5);
  i.x = 25;
  i.y = 24;
  const v = label(value, 24, palette.white, '700');
  v.x = 54;
  v.y = 10;
  const plus = label('+', 26, 0xffe78a, '900');
  plus.x = 140;
  plus.y = 8;
  c.addChild(dot, i, v, plus);
  return c;
}

export function glossyIconButton(icon: string, text: string, width = 84, height = 84, fill = 0x162b63) {
  const c = new Container();
  c.addChild(glassPanel(width, height, fill, 0x648bff));
  const shine = new Graphics();
  shine.roundRect(8, 8, width - 16, height * 0.32, 12);
  shine.fill({ color: 0xffffff, alpha: 0.13 });
  const i = label(icon, 28);
  i.anchor.set(0.5);
  i.x = width / 2;
  i.y = height * 0.34;
  const t = label(text, 18, palette.white, '900');
  t.anchor.set(0.5);
  t.x = width / 2;
  t.y = height * 0.72;
  c.addChild(shine, i, t);
  c.eventMode = 'static';
  c.cursor = 'pointer';
  return c;
}

export function avatar(size: number, shirtColor = 0x2f8cff) {
  const c = new Container();
  const head = new Graphics();
  head.circle(size / 2, size * 0.34, size * 0.22);
  head.fill(0xffc48a);
  const hair = new Graphics();
  hair.circle(size / 2, size * 0.25, size * 0.2);
  hair.fill(0x6b3317);
  const body = new Graphics();
  body.roundRect(size * 0.24, size * 0.52, size * 0.52, size * 0.34, 9);
  body.fill(shirtColor);
  const eye = new Graphics();
  eye.circle(size * 0.43, size * 0.34, 2.5);
  eye.circle(size * 0.57, size * 0.34, 2.5);
  eye.fill(0x26130d);
  c.addChild(body, hair, head, eye);
  return c;
}
