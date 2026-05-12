/**
 * 场景自动装配：挂在 **场景根节点**（或 **Canvas**）上即可。
 * 运行时会查找/创建 Canvas + UICamera、补 EventSystem，并挂上 `FootballMvpQuickStart`。
 * 这样不必在编辑器里手动摆 Canvas、再挂 QuickStart。
 */
import {
  _decorator,
  Camera,
  Canvas,
  Color,
  Component,
  director,
  EventSystem,
  Layers,
  Node,
  Scene,
  UITransform,
  view,
  warn,
} from 'cc';
import { FootballMvpQuickStart } from './FootballMvpQuickStart';

const { ccclass } = _decorator;

@ccclass('FootballMvpSceneBootstrap')
export class FootballMvpSceneBootstrap extends Component {
  onLoad(): void {
    const scene = director.getScene();
    if (!scene) {
      warn('[FootballMvp] 无活动场景');
      return;
    }
    const canvas = this.resolveCanvas(scene);
    if (!canvas) {
      warn('[FootballMvp] 未能创建或解析 Canvas');
      return;
    }
    this.ensureEventSystem(scene);
    if (!canvas.getComponent(FootballMvpQuickStart)) {
      canvas.addComponent(FootballMvpQuickStart);
    }
  }

  private resolveCanvas(scene: Scene): Node | null {
    if (this.node.getComponent(Canvas)) {
      this.ensureCanvasUITransform(this.node);
      return this.node;
    }
    const named = scene.getChildByName('Canvas');
    if (named?.getComponent(Canvas)) {
      this.ensureCanvasUITransform(named);
      return named;
    }
    for (const ch of scene.children) {
      if (ch.getComponent(Canvas)) {
        this.ensureCanvasUITransform(ch);
        return ch;
      }
    }
    return this.createCanvasBranch(scene);
  }

  private ensureCanvasUITransform(canvas: Node): void {
    const vs = view.getVisibleSize();
    let tr = canvas.getComponent(UITransform);
    if (!tr) tr = canvas.addComponent(UITransform);
    tr.setContentSize(vs.width, vs.height);
  }

  private createCanvasBranch(scene: Scene): Node | null {
    const vs = view.getVisibleSize();
    const canvasNode = new Node('Canvas');
    canvasNode.layer = Layers.Enum.UI_2D;
    canvasNode.parent = scene;

    const ui = canvasNode.addComponent(UITransform);
    ui.setContentSize(vs.width, vs.height);

    const camNode = new Node('UICamera');
    camNode.layer = Layers.Enum.UI_2D;
    camNode.parent = canvasNode;
    camNode.setPosition(0, 0, 1000);

    const cam = camNode.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.orthoHeight = Math.max(vs.height * 0.5, 320);
    cam.near = 0.1;
    cam.far = 2000;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = new Color(11, 29, 42, 255);
    cam.visibility = Layers.Enum.UI_2D;
    cam.priority = 10;

    const cv = canvasNode.addComponent(Canvas);
    cv.cameraComponent = cam;

    return canvasNode;
  }

  private ensureEventSystem(scene: Scene): void {
    if (scene.getChildByName('EventSystem')) return;
    const es = new Node('EventSystem');
    es.parent = scene;
    es.addComponent(EventSystem);
  }
}
