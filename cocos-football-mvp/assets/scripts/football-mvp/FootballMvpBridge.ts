/**
 * Cocos Creator 3.x 桥接示例：将本组件挂到任意节点，在编辑器中绑定按钮事件；
 * 或从其它 UI 脚本 import { FootballMvpGame } 直接调用。
 *
 * 注意：需在 Creator 工程中启用 TypeScript；本文件依赖引擎模块 `cc`。
 */
import { _decorator, Component } from 'cc';
import { ECONOMY, FootballMvpGame } from './FootballMvpGame';
import type { FormationId, MatchDifficulty } from './Types';

const { ccclass, property } = _decorator;

@ccclass('FootballMvpBridge')
export class FootballMvpBridge extends Component {
  private game = new FootballMvpGame();

  /** 供 UI 打印或绑定 Label */
  dumpSnapshotJson(): string {
    return JSON.stringify(this.game.snapshot(), null, 2);
  }

  onRename(name: string): void {
    this.game.setManagerName(name);
  }

  onFormation(fid: string): void {
    this.game.setFormation(fid as FormationId);
  }

  onSlot(slot: number, instanceId: string | null): void {
    this.game.assignSlot(slot, instanceId);
  }

  onRefreshShop(): string {
    const r = this.game.refreshShop();
    return r.ok ? 'ok' : r.error ?? 'fail';
  }

  onBuy(offerId: string): string {
    const r = this.game.buyOffer(offerId);
    return r.ok ? `signed:${r.player?.name}` : r.error ?? 'fail';
  }

  onGacha(): string {
    const r = this.game.pullGacha();
    return r.ok ? r.log ?? 'ok' : r.error ?? 'fail';
  }

  onPlay(diff: string): string {
    const r = this.game.playMatch(diff as MatchDifficulty);
    if (!r.ok) return r.error ?? 'fail';
    const m = r.result!;
    return `${m.homeGoals}-${m.awayGoals} ${m.outcome} 金币${m.coinsDelta > 0 ? '+' : ''}${m.coinsDelta}`;
  }

  economy(): typeof ECONOMY {
    return ECONOMY;
  }
}
