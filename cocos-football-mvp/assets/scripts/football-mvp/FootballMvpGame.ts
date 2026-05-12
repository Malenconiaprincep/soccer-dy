import { generateShopOffers, instantiate, rollGachaPlayer } from './PlayerFactory';
import { FORMATIONS } from './playerPool';
import { SaveRepository, defaultSave, type PersistedV1 } from './SaveRepository';
import { simulateMatch } from './MatchEngine';
import type { FormationId, GameSnapshot, LeaderboardRow, MatchDifficulty, MatchResult, ShopOffer } from './Types';

const GACHA_COST = 500;
const SHOP_REFRESH_COST = 200;

const NPC_NAMES = ['云端·战术师', '算法·联队', '街头·传控派', '数据·冷启动', '弹幕·快反系'];

export class FootballMvpGame {
  private data: PersistedV1;
  constructor(private readonly repo = new SaveRepository()) {
    this.data = repo.load();
    if (this.data.squad.length === 0) {
      this.bootstrapStarterSquad();
    }
    if (this.data.shopOffers.length === 0) {
      this.data.shopOffers = generateShopOffers(6, Math.random);
      this.persist();
    }
    this.tryAutoLineup();
  }

  /** 阵容全空且人手足够时，按位置优先 + 总评贪心填满 11 人 */
  private tryAutoLineup(): void {
    if (this.data.lineup.some((x) => x != null)) return;
    if (this.data.squad.length < 11) return;
    const slots = FORMATIONS[this.data.formationId].slots;
    const used = new Set<string>();
    for (let i = 0; i < 11; i++) {
      const need = slots[i]!;
      const candidates = this.data.squad
        .filter((p) => !used.has(p.instanceId))
        .sort((a, b) => {
          const fa = a.group === need ? 1 : 0;
          const fb = b.group === need ? 1 : 0;
          if (fa !== fb) return fb - fa;
          return b.ovr - a.ovr;
        });
      const pick = candidates[0];
      if (pick) {
        this.data.lineup[i] = pick.instanceId;
        used.add(pick.instanceId);
      }
    }
    this.persist();
  }

  private persist(): void {
    this.repo.save(this.data);
  }

  private bootstrapStarterSquad(): void {
    const starterIds = [
      't_gk_03',
      't_df_06',
      't_df_07',
      't_df_08',
      't_mf_06',
      't_mf_04',
      't_mf_09',
      't_mf_05',
      't_fw_06',
      't_fw_05',
      't_fw_04',
    ];
    for (const id of starterIds) {
      const p = instantiate(id);
      if (p) this.data.squad.push(p);
    }
    this.persist();
  }

  snapshot(): GameSnapshot {
    return {
      managerName: this.data.managerName,
      coins: this.data.coins,
      points: this.data.points,
      wins: this.data.wins,
      draws: this.data.draws,
      losses: this.data.losses,
      formationId: this.data.formationId,
      lineup: [...this.data.lineup],
      squad: [...this.data.squad],
      shopOffers: [...this.data.shopOffers],
      lastGachaLog: [...this.data.lastGachaLog],
    };
  }

  setManagerName(name: string): void {
    const n = name.trim().slice(0, 12) || '新晋经理';
    this.data.managerName = n;
    this.persist();
  }

  setFormation(fid: FormationId): void {
    this.data.formationId = fid;
    this.data.lineup = Array(11).fill(null) as (string | null)[];
    this.persist();
  }

  /** slot 0-10, playerInstanceId or null to clear */
  assignSlot(slot: number, playerInstanceId: string | null): { ok: boolean; error?: string } {
    if (slot < 0 || slot > 10) return { ok: false, error: 'slot' };
    const slots = FORMATIONS[this.data.formationId].slots;
    if (!slots[slot]) return { ok: false, error: 'formation' };
    if (playerInstanceId) {
      const exists = this.data.squad.some((p) => p.instanceId === playerInstanceId);
      if (!exists) return { ok: false, error: 'not_owned' };
      for (let i = 0; i < 11; i++) {
        if (this.data.lineup[i] === playerInstanceId) this.data.lineup[i] = null;
      }
    }
    this.data.lineup[slot] = playerInstanceId;
    this.persist();
    return { ok: true };
  }

  refreshShop(): { ok: boolean; error?: string } {
    if (this.data.coins < SHOP_REFRESH_COST) return { ok: false, error: 'coins' };
    this.data.coins -= SHOP_REFRESH_COST;
    this.data.shopOffers = generateShopOffers(6, Math.random);
    this.persist();
    return { ok: true };
  }

  buyOffer(offerId: string): { ok: boolean; error?: string; player?: import('./Types').PlayerInstance } {
    const offer = this.data.shopOffers.find((o) => o.offerId === offerId);
    if (!offer) return { ok: false, error: 'offer' };
    if (this.data.coins < offer.listPrice) return { ok: false, error: 'coins' };
    const pl = instantiate(offer.templateId);
    if (!pl) return { ok: false, error: 'template' };
    this.data.coins -= offer.listPrice;
    this.data.squad.push(pl);
    this.data.shopOffers = this.data.shopOffers.filter((o) => o.offerId !== offerId);
    this.persist();
    return { ok: true, player: pl };
  }

  pullGacha(): { ok: boolean; error?: string; player?: import('./Types').PlayerInstance; log?: string } {
    if (this.data.coins < GACHA_COST) return { ok: false, error: 'coins' };
    this.data.coins -= GACHA_COST;
    const pl = rollGachaPlayer(Math.random);
    this.data.squad.push(pl);
    const log = `${pl.name} [${pl.rarity}] 总评${pl.ovr}`;
    this.data.lastGachaLog = [log, ...this.data.lastGachaLog].slice(0, 8);
    this.persist();
    return { ok: true, player: pl, log };
  }

  playMatch(difficulty: MatchDifficulty): { ok: boolean; error?: string; result?: MatchResult } {
    const filled = this.data.lineup.filter(Boolean).length;
    if (filled < 11) return { ok: false, error: 'lineup_incomplete' };
    const res = simulateMatch({
      formationId: this.data.formationId,
      lineup: this.data.lineup,
      squad: this.data.squad,
      difficulty,
      seed: Date.now() % 2147483647,
    });
    this.data.coins += res.coinsDelta;
    this.data.points += res.pointsDelta;
    if (res.outcome === 'win') this.data.wins += 1;
    else if (res.outcome === 'draw') this.data.draws += 1;
    else this.data.losses += 1;
    this.persist();
    return { ok: true, result: res };
  }

  leaderboard(): LeaderboardRow[] {
    const rows: { name: string; points: number; wins: number; self: boolean }[] = [];
    rows.push({
      name: this.data.managerName,
      points: this.data.points,
      wins: this.data.wins,
      self: true,
    });
    let idx = 0;
    for (const n of NPC_NAMES) {
      const base = 180 + ((idx * 37) % 120);
      rows.push({
        name: n,
        points: base + (idx % 5) * 9,
        wins: 12 + (idx * 3) % 40,
        self: false,
      });
      idx += 1;
    }
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins);
    return rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      points: r.points,
      wins: r.wins,
      isSelf: r.self,
    }));
  }

  resetProgress(): void {
    this.data = defaultSave();
    this.bootstrapStarterSquad();
    this.data.shopOffers = generateShopOffers(6, Math.random);
    this.persist();
  }
}

export const ECONOMY = { GACHA_COST, SHOP_REFRESH_COST } as const;
