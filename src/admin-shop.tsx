import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin-shop.css';
import {
  defaultShopConfig,
  normalizeShopConfig,
  type ShopCommonItemConfig,
  type ShopConfig,
  type ShopDailyOfferConfig,
  type ShopIconType,
  type ShopReward
} from './shopConfig';

type Status = { text: string; tone: 'idle' | 'ok' | 'error' };

const emptyReward: ShopReward = {};

function ShopAdminApp() {
  const [config, setConfig] = useState<ShopConfig>(defaultShopConfig);
  const [status, setStatus] = useState<Status>({ text: '正在读取商城配置...', tone: 'idle' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const response = await fetch('/api/shop-config');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = normalizeShopConfig(await response.json());
      setConfig(next);
      setStatus({ text: '已读取接口配置', tone: 'ok' });
    } catch (error) {
      console.warn('[shop-admin] load failed', error);
      setConfig(defaultShopConfig);
      setStatus({ text: '接口暂不可用，当前展示默认配置', tone: 'error' });
    }
  }

  async function saveConfig() {
    setSaving(true);
    setStatus({ text: '正在保存...', tone: 'idle' });
    try {
      const next = normalizeShopConfig(config);
      const response = await fetch('/api/shop-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setConfig(normalizeShopConfig(await response.json()));
      setStatus({ text: '保存成功，重新打开游戏商城即可看到配置', tone: 'ok' });
    } catch (error) {
      console.warn('[shop-admin] save failed', error);
      setStatus({ text: '保存失败，请确认 Node/Vercel 接口可用', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function updateDaily(patch: Partial<ShopDailyOfferConfig>) {
    setConfig((current) => ({
      ...current,
      dailyOffer: normalizeShopConfig({ ...current, dailyOffer: { ...current.dailyOffer, ...patch } }).dailyOffer
    }));
  }

  function updateDailyReward(patch: Partial<ShopReward>) {
    updateDaily({ reward: cleanReward({ ...config.dailyOffer.reward, ...patch }) });
  }

  function updateCommon(index: number, patch: Partial<ShopCommonItemConfig>) {
    setConfig((current) => {
      const commonItems = current.commonItems.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return normalizeShopConfig({ commonItems: [{ ...item, ...patch }] }).commonItems[0];
      });
      return { ...current, commonItems };
    });
  }

  function updateCommonReward(index: number, patch: Partial<ShopReward>) {
    const item = config.commonItems[index];
    updateCommon(index, { reward: cleanReward({ ...item.reward, ...patch }) });
  }

  function addCommonItem() {
    setConfig((current) => ({
      ...current,
      commonItems: [
        ...current.commonItems,
        {
          id: `item${current.commonItems.length + 1}`,
          title: '新道具',
          sub: '道具说明',
          cost: 10,
          limit: '今日限购 1/1',
          icon: 'ticket',
          reward: { scoutTickets: 1 }
        }
      ]
    }));
  }

  function removeCommonItem(index: number) {
    setConfig((current) => ({
      ...current,
      commonItems: current.commonItems.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  const normalized = useMemo(() => normalizeShopConfig(config), [config]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1 className="admin-title">商城后台配置</h1>
          <p className="admin-subtitle">配置每日特惠和常用道具，保存后由游戏商城接口读取。</p>
        </div>
        <div className="admin-actions">
          <button className="ghost-btn" onClick={() => void loadConfig()} type="button">重新读取</button>
          <button className="ghost-btn" onClick={() => setConfig(defaultShopConfig)} type="button">恢复默认</button>
          <button className="primary-btn" disabled={saving} onClick={() => void saveConfig()} type="button">
            {saving ? '保存中' : '保存配置'}
          </button>
        </div>
      </header>

      <div className="status-line" style={{ color: status.tone === 'error' ? '#ff8b9a' : status.tone === 'ok' ? '#76f0b4' : '#ffdf72' }}>
        {status.text}
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">每日特惠</h2>
        </div>
        <div className="form-grid">
          <TextField labelText="商品 ID" value={config.dailyOffer.id} onChange={(value) => updateDaily({ id: value })} />
          <TextField labelText="标题" value={config.dailyOffer.title} onChange={(value) => updateDaily({ title: value })} />
          <TextField labelText="数量文案" value={config.dailyOffer.countText} onChange={(value) => updateDaily({ countText: value })} />
          <NumberField labelText="现价钻石" value={config.dailyOffer.cost} onChange={(value) => updateDaily({ cost: value })} />
          <TextField className="wide" labelText="说明" value={config.dailyOffer.sub} onChange={(value) => updateDaily({ sub: value })} />
          <TextField labelText="原价文案" value={config.dailyOffer.oldPriceText} onChange={(value) => updateDaily({ oldPriceText: value })} />
          <TextField labelText="折扣数字" value={config.dailyOffer.badgeText} onChange={(value) => updateDaily({ badgeText: value })} />
          <TextField labelText="倒计时" value={config.dailyOffer.countdownText} onChange={(value) => updateDaily({ countdownText: value })} />
          <RewardFields reward={config.dailyOffer.reward} onChange={updateDailyReward} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">常用道具</h2>
          <button className="ghost-btn" onClick={addCommonItem} type="button">新增道具</button>
        </div>
        {config.commonItems.map((item, index) => (
          <CommonItemEditor
            item={item}
            index={index}
            key={`${item.id}-${index}`}
            onChange={(patch) => updateCommon(index, patch)}
            onRewardChange={(patch) => updateCommonReward(index, patch)}
            onRemove={() => removeCommonItem(index)}
          />
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">配置预览</h2>
        </div>
        <div className="preview">
          <div className="preview-card">
            <p className="preview-title">{normalized.dailyOffer.title} {normalized.dailyOffer.countText}</p>
            <p className="preview-sub">{normalized.dailyOffer.sub}</p>
            <div className="preview-price">钻石 {normalized.dailyOffer.cost}</div>
            <p className="preview-sub">{normalized.dailyOffer.oldPriceText} / {normalized.dailyOffer.countdownText}</p>
          </div>
          <div>
            {normalized.commonItems.map((item, index) => (
              <div className="preview-row" key={`${item.id}-preview-${index}`}>
                <p className="preview-title">{item.title}</p>
                <p className="preview-sub">{item.sub}</p>
                <div className="preview-price">{item.priceText ?? `钻石 ${item.cost ?? 0}`}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function CommonItemEditor(props: {
  item: ShopCommonItemConfig;
  index: number;
  onChange: (patch: Partial<ShopCommonItemConfig>) => void;
  onRewardChange: (patch: Partial<ShopReward>) => void;
  onRemove: () => void;
}) {
  const { item, index, onChange, onRewardChange, onRemove } = props;
  return (
    <div className="item-card">
      <div className="item-toolbar">
        <span className="item-name">道具 {index + 1}: {item.title}</span>
        <button className="danger-btn" onClick={onRemove} type="button">删除</button>
      </div>
      <div className="form-grid">
        <TextField labelText="商品 ID" value={item.id} onChange={(value) => onChange({ id: value })} />
        <TextField labelText="标题" value={item.title} onChange={(value) => onChange({ title: value })} />
        <IconField value={item.icon} onChange={(value) => onChange({ icon: value })} />
        <TextField labelText="限购文案" value={item.limit} onChange={(value) => onChange({ limit: value })} />
        <TextField className="wide" labelText="说明" value={item.sub} onChange={(value) => onChange({ sub: value })} />
        <NumberField labelText="钻石价格" value={item.cost ?? 0} onChange={(value) => onChange({ cost: value, priceText: undefined })} />
        <TextField labelText="现金价格文案" value={item.priceText ?? ''} onChange={(value) => onChange({ priceText: value || undefined })} />
        <RewardFields reward={item.reward} onChange={onRewardChange} />
      </div>
    </div>
  );
}

function RewardFields(props: { reward: ShopReward; onChange: (patch: Partial<ShopReward>) => void }) {
  const reward = props.reward ?? emptyReward;
  return (
    <div className="reward-grid">
      <p className="reward-label">发放奖励</p>
      <NumberField labelText="金币" value={reward.coins ?? 0} onChange={(value) => props.onChange({ coins: value })} />
      <NumberField labelText="球探券" value={reward.scoutTickets ?? 0} onChange={(value) => props.onChange({ scoutTickets: value })} />
      <NumberField labelText="钻石" value={reward.gems ?? 0} onChange={(value) => props.onChange({ gems: value })} />
      <NumberField labelText="体力" value={reward.energy ?? 0} onChange={(value) => props.onChange({ energy: value })} />
    </div>
  );
}

function TextField(props: { labelText: string; value: string; className?: string; onChange: (value: string) => void }) {
  return (
    <div className={`field ${props.className ?? ''}`}>
      <label>{props.labelText}</label>
      <input value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </div>
  );
}

function NumberField(props: { labelText: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="field">
      <label>{props.labelText}</label>
      <input
        min="0"
        type="number"
        value={Number.isFinite(props.value) ? props.value : 0}
        onChange={(event) => props.onChange(Math.max(0, Math.round(Number(event.target.value) || 0)))}
      />
    </div>
  );
}

function IconField(props: { value: ShopIconType; onChange: (value: ShopIconType) => void }) {
  return (
    <div className="field">
      <label>图标</label>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value as ShopIconType)}>
        <option value="energy">体力闪电</option>
        <option value="ticket">球探券</option>
        <option value="gems">钻石</option>
      </select>
    </div>
  );
}

function cleanReward(reward: ShopReward): ShopReward {
  return {
    coins: cleanNumber(reward.coins),
    scoutTickets: cleanNumber(reward.scoutTickets),
    gems: cleanNumber(reward.gems),
    energy: cleanNumber(reward.energy)
  };
}

function cleanNumber(value: number | undefined) {
  if (!value) return undefined;
  return Math.max(0, Math.round(value));
}

createRoot(document.getElementById('shop-admin-root')!).render(
  <React.StrictMode>
    <ShopAdminApp />
  </React.StrictMode>
);
