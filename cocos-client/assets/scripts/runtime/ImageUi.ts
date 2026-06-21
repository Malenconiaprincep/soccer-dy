import { isValid, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { GameAudio } from './GameAudio';

interface ImageOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
  anchorX?: number;
  anchorY?: number;
  siblingIndex?: number;
  onClick?: () => void;
  trim?: boolean;
}

interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function addImage(parent: Node, path: string, options: ImageOptions): Promise<Node | undefined> {
  try {
    const frame = await loadSpriteFrame(path);
    if (!isValid(parent)) return undefined;
    return createImage(parent, path, frame, options);
  } catch (error) {
    console.warn(`[assets] failed to load ${path}`, error);
    return undefined;
  }
}

export async function addFrameImage(parent: Node, path: string, frameRect: FrameRect, options: ImageOptions): Promise<Node | undefined> {
  try {
    const source = await loadSpriteFrame(path);
    if (!isValid(parent)) return undefined;
    const frame = source.clone();
    frame.rect = new Rect(frameRect.x, frameRect.y, frameRect.width, frameRect.height);
    frame.originalSize = new Size(frameRect.width, frameRect.height);
    return createImage(parent, path, frame, options);
  } catch (error) {
    console.warn(`[assets] failed to crop ${path}`, error);
    return undefined;
  }
}

export async function addCoverImage(parent: Node, path: string, width: number, height: number): Promise<Node | undefined> {
  const frame = await loadSpriteFrame(path).catch((error) => {
    console.warn(`[assets] failed to load ${path}`, error);
    return undefined;
  });
  if (!frame || !isValid(parent)) return undefined;
  const source = frame.originalSize;
  const scale = Math.max(width / source.width, height / source.height);
  return createImage(parent, path, frame, {
    width: source.width * scale,
    height: source.height * scale,
    siblingIndex: 0
  });
}

function createImage(parent: Node, path: string, frame: SpriteFrame, options: ImageOptions): Node {
  const node = new Node(`Image:${path}`);
  node.setPosition(options.x ?? 0, options.y ?? 0);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(options.anchorX ?? 0.5, options.anchorY ?? 0.5);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = frame;
  sprite.trim = options.trim ?? false;
  // Assigning a SpriteFrame can restore its native dimensions. Apply the
  // requested layout size last so every image keeps the intended proportions.
  transform.setContentSize(options.width, options.height);
  parent.addChild(node);
  if (options.siblingIndex != null) node.setSiblingIndex(options.siblingIndex);
  if (options.onClick) {
    node.on(Node.EventType.TOUCH_START, () => node.setScale(0.97, 0.97, 1));
    node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
    node.on(Node.EventType.TOUCH_END, () => {
      node.setScale(1, 1, 1);
      GameAudio.play('tap');
      options.onClick?.();
    });
  }
  return node;
}

function loadSpriteFrame(path: string): Promise<SpriteFrame> {
  return new Promise((resolve, reject) => {
    resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
      if (error || !frame) reject(error ?? new Error(`Missing sprite frame: ${path}`));
      else resolve(frame);
    });
  });
}
