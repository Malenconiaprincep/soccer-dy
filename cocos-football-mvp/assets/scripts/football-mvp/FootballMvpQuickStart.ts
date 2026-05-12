/**
 * 一键试玩：把本组件挂到 **Canvas** 节点上，保存场景后点「预览」即可出现简易按钮与文字（无需再拖别的 UI）。
 * 正式产品可改用 Prefab + 设计稿，本组件仅作开发验证。
 */
import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Layers,
  Node,
  UITransform,
  view,
} from 'cc';
import { ECONOMY, FootballMvpGame } from './FootballMvpGame';
import type { MatchDifficulty } from './Types';

const { ccclass } = _decorator;

@ccclass('FootballMvpQuickStart')
export class FootballMvpQuickStart extends Component {
  private readonly game = new FootballMvpGame();
  private coinsLabel!: Label;
  private logLabel!: Label;

  onLoad(): void {
    this.node.layer = Layers.Enum.UI_2D;
    const root = this.node;
    let rootTr = root.getComponent(UITransform);
    if (!rootTr) rootTr = root.addComponent(UITransform);
    const vs = view.getVisibleSize();
    rootTr.setContentSize(vs.width, vs.height);

    const panel = new Node('FootballMvpPanel');
    panel.layer = Layers.Enum.UI_2D;
    panel.parent = root;
    const pt = panel.addComponent(UITransform);
    const pw = Math.min(560, vs.width - 32);
    const ph = vs.height - 32;
    pt.setContentSize(pw, ph);
    panel.setPosition(0, 0, 0);

    let y = ph * 0.42;
    this.coinsLabel = this.mkLabel(panel, 'Coins', pw, 44, 20, y, '', false);
    y -= 52;
    this.mkLabel(panel, 'Title', pw, 40, 24, y, '足球经理 MVP（试玩）', false);
    y -= 52;
    this.logLabel = this.mkLabel(panel, 'Log', pw, 260, 16, y - 130, '', true);

    let by = -ph * 0.28;
    this.mkBtn(panel, '比赛·简单', -140, by, 130, 44, () => this.doPlay('easy'));
    this.mkBtn(panel, '比赛·普通', 0, by, 130, 44, () => this.doPlay('normal'));
    this.mkBtn(panel, '比赛·困难', 140, by, 130, 44, () => this.doPlay('hard'));
    by -= 58;
    this.mkBtn(panel, `抽卡 (${ECONOMY.GACHA_COST})`, -140, by, 130, 44, () => this.doGacha());
    this.mkBtn(panel, `刷新商店 (${ECONOMY.SHOP_REFRESH_COST})`, 70, by, 200, 44, () => this.doRefreshShop());
    by -= 58;
    this.mkBtn(panel, '买挂牌第1个', -140, by, 160, 44, () => this.doBuyFirst());
    this.mkBtn(panel, '切阵型 433', 70, by, 160, 44, () => {
      this.game.setFormation('433');
      this.pushLog('阵型已切到 4-3-3，首发已清空，请点「自动填阵」');
      this.refreshHud();
    });
    by -= 58;
    this.mkBtn(panel, '自动填阵（贪心）', 0, by, 220, 44, () => this.doAutoLineup());
    by -= 54;
    this.mkBtn(panel, '清空日志', 0, by, 140, 40, () => {
      this.logLabel.string = '';
    });

    this.refreshHud();
    this.pushLog('已就绪：可先「自动填阵」再踢比赛。');
  }

  private mkLabel(
    parent: Node,
    name: string,
    w: number,
    h: number,
    fontSize: number,
    centerY: number,
    text: string,
    wrap: boolean,
  ): Label {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    n.parent = parent;
    const tr = n.addComponent(UITransform);
    tr.setContentSize(w, h);
    n.setPosition(0, centerY, 0);
    const lab = n.addComponent(Label);
    lab.string = text;
    lab.fontSize = fontSize;
    lab.lineHeight = Math.round(fontSize * 1.25);
    lab.color = Color.WHITE;
    if (wrap) {
      lab.overflow = Label.Overflow.RESIZE_HEIGHT;
      lab.enableWrapText = true;
    } else {
      lab.overflow = Label.Overflow.CLAMP;
      lab.enableWrapText = false;
    }
    return lab;
  }

  private mkBtn(parent: Node, caption: string, x: number, y: number, bw: number, bh: number, fn: () => void): void {
    const n = new Node(`Btn_${caption}`);
    n.layer = Layers.Enum.UI_2D;
    n.parent = parent;
    const tr = n.addComponent(UITransform);
    tr.setContentSize(bw, bh);
    n.setPosition(x, y, 0);
    const g = n.addComponent(Graphics);
    g.fillColor = new Color(30, 110, 140, 255);
    const hx = bw * 0.5;
    const hy = bh * 0.5;
    g.rect(-hx, -hy, bw, bh);
    g.fill();
    n.on(Node.EventType.TOUCH_END, fn, this);

    const ln = new Node('Caption');
    ln.layer = Layers.Enum.UI_2D;
    ln.parent = n;
    const lt = ln.addComponent(UITransform);
    lt.setContentSize(bw, bh);
    const lab = ln.addComponent(Label);
    lab.string = caption;
    lab.fontSize = caption.length > 10 ? 15 : 18;
    lab.lineHeight = 20;
    lab.color = Color.WHITE;
    lab.horizontalAlign = Label.HorizontalAlign.CENTER;
    lab.verticalAlign = Label.VerticalAlign.CENTER;
    lab.overflow = Label.Overflow.CLAMP;
  }

  private refreshHud(): void {
    const s = this.game.snapshot();
    this.coinsLabel.string = `经理：${s.managerName}  |  金币 ${s.coins}  |  积分 ${s.points}  |  战绩 ${s.wins}/${s.draws}/${s.losses}  |  阵型 ${s.formationId}  |  球员 ${s.squad.length} 人`;
  }

  private pushLog(line: string): void {
    const prev = this.logLabel.string.trim();
    this.logLabel.string = prev ? `${line}\n${prev}` : line;
    const lines = this.logLabel.string.split('\n');
    if (lines.length > 14) this.logLabel.string = lines.slice(0, 14).join('\n');
  }

  private doPlay(diff: MatchDifficulty): void {
    const r = this.game.playMatch(diff);
    if (!r.ok) {
      this.pushLog(`比赛失败：${r.error}`);
      return;
    }
    const m = r.result!;
    this.pushLog(
      `[${diff}] ${m.homeGoals}-${m.awayGoals} ${m.outcome}  金币${m.coinsDelta >= 0 ? '+' : ''}${m.coinsDelta}  积分+${m.pointsDelta}`,
    );
    this.refreshHud();
  }

  private doGacha(): void {
    const r = this.game.pullGacha();
    if (!r.ok) {
      this.pushLog(`抽卡：${r.error}`);
      return;
    }
    this.pushLog(`抽卡：${r.log}`);
    this.refreshHud();
  }

  private doRefreshShop(): void {
    const r = this.game.refreshShop();
    if (!r.ok) {
      this.pushLog(`刷新商店：${r.error}`);
      return;
    }
    this.pushLog('商店已刷新');
    this.refreshHud();
  }

  private doBuyFirst(): void {
    const offers = this.game.snapshot().shopOffers;
    if (!offers.length) {
      this.pushLog('没有挂牌，先刷新商店');
      return;
    }
    const r = this.game.buyOffer(offers[0].offerId);
    if (!r.ok) {
      this.pushLog(`购买：${r.error}`);
      return;
    }
    this.pushLog(`签下 ${r.player?.name}`);
    this.refreshHud();
  }

  private doAutoLineup(): void {
    const r = this.game.refillLineupGreedy();
    if (!r.ok) {
      this.pushLog(`填阵：${r.error}`);
      return;
    }
    this.pushLog('已自动填好 11 人首发');
    this.refreshHud();
  }
}
