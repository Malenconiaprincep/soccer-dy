# Cocos Creator 2D + UI 接入指南

本文说明如何把本仓库的 **足球经理 MVP 逻辑**接到 **Cocos Creator 的 2D UI** 上（`Canvas` + `UITransform` + 控件），与 `docs/DESIGN-MVP.md` 中的界面稿对应。

---

## 1. 新建工程

1. 打开 **Cocos Creator 3.x**（建议 3.8+）。
2. 新建项目时选择 **2D** 模板（或空项目后在 **项目设置 → 功能裁剪** 中按 2D 需要启用模块）。
3. 构建发布目标勾选 **字节跳动小游戏**（抖音），按官方文档配置 AppId 等（本指南不写运营侧配置）。

---

## 2. 放入脚本

将 `cocos-football-mvp/assets/scripts/football-mvp/` 整个目录复制到工程的 `assets/scripts/`（路径可自定，但需在 `assets` 下以便参与编译）。**Vitest 单测**位于仓库的 `cocos-football-mvp/tests/`，**勿复制进 `assets`**，否则编辑器会尝试编译 `vitest` 并报错。若你本机工程里已有误拷的 `*.test.ts`，直接删除即可。

复制进 Creator 后：

- 删除本仓库随带的 `types/cocos-shim.d.ts`（若一并复制了），避免与引擎自带的 `cc` 类型冲突；以 Creator 工程类型为准。
- 等待编辑器编译通过；若有路径别名需求，在 `tsconfig.json` 中配置（可选）。

---

## 3. 2D 场景根结构（推荐）

单场景 + 多页用节点 `active` 切换，适合 MVP：

```
Canvas (根，UITransform 全屏，对齐设计分辨率)
├── Camera（2D Camera，Clear Flags 按默认）
├── SafeArea（空节点，挂 Widget：四边对齐父级，用于刘海屏）
│   ├── Page_Hub        // 主页
│   ├── Page_Lineup     // 阵容
│   ├── Page_Shop       // 商店
│   ├── Page_Gacha      // 抽卡
│   ├── Page_Leaderboard// 排行
│   └── Layer_MatchResult // 赛果弹窗，默认隐藏
└── DontDestroy（可选，持久化 FootballMvpGame 时再用）
```

**设计分辨率**：与 `DESIGN-MVP.md` 一致，建议宽 **720** 或 **750**，高 **1280** 或 **1334**；`Canvas` 的 **适配模式** 用 `Fit Width` 或 `Show All` 视美术而定，抖音端务必在真机上看安全区。

---

## 4. 挂载逻辑：FootballMvpBridge

1. 在 `Canvas` 或 `SafeArea` 下新建空节点 `GameRoot`。
2. 添加组件 **`FootballMvpBridge`**（脚本 `FootballMvpBridge.ts`）。
3. 所有按钮、输入框的点击事件可：
   - **方式 A**：在自定义 UI 脚本里 `getComponent(FootballMvpBridge)` 调用其方法（推荐，便于刷新 Label）。
   - **方式 B**：用编辑器事件直接绑到 `FootballMvpBridge` 的公开方法（Creator 对带参方法支持有限，复杂参数仍建议方式 A）。

`FootballMvpBridge` 当前暴露的入口包括：`onRename`、`onFormation`、`onSlot`、`onRefreshShop`、`onBuy`、`onGacha`、`onPlay`、`dumpSnapshotJson`、`economy()`。比赛难度可把三个按钮分别传 `'easy' | 'normal' | 'hard'` 给 `onPlay`。

---

## 5. 各页建议控件（2D UI）

| 页面 | 主要节点与组件 |
|------|------------------|
| 主页 Hub | `Label`（昵称、金币、积分）；三个 `Button`（难度）；底部 `Layout` + 四个 `Button` 切页 |
| 阵容 | `ToggleContainer` 或四个 `Toggle` 选阵型；11 个 `Button` 作槽位（子节点 `Label` 显示位置缩写）；`ScrollView` 列出仓库球员 |
| 商店 | `ScrollView` + `Layout`，子项为卡片：`Label` + `Button`（购买），刷新单独 `Button` |
| 抽卡 | 中央 `Sprite` 卡背 + `Button` 单抽；下方 `Label` 或列表显示日志 |
| 排行 | `ScrollView` + 每行 `Layout`：名次、昵称、积分、胜场；本行用颜色区分（见设计稿 Token） |

全部为 **2D** 的 `cc.Node` + **UI** 组件，无需 3D 模型。

---

## 6. 阵容交互（MVP 实现要点）

- 阵型：`FootballMvpGame.setFormation('442' | '433' | '352')`（通过 Bridge 的 `onFormation`）。
- 槽位：`assignSlot(slotIndex, instanceId | null)`，`slotIndex` 为 **0–10**，与 `playerPool` 里 `FORMATIONS[fid].slots` 顺序一致。
- 仓库列表：从 `snapshot().squad` 取 `instanceId`、`name`、`group`、`ovr`、`valueMillionEur` 显示；点击球员再点击空槽，调用两次逻辑或做一个「选中球员再点槽」的状态机。

首次进入若已有存档且阵容曾清空，逻辑层会在人手足够时自动填阵；UI 仍应在切到阵容页时 `dumpSnapshotJson` 或读 `snapshot` 刷新（若你扩展 Bridge 暴露 `game.snapshot()` 更直观）。

---

## 7. 商店与抽卡

- 商店报价：`snapshot().shopOffers`，展示 `listPrice`，购买传 `offerId` 给 `onBuy`。
- 刷新：`onRefreshShop()`，失败时根据返回字符串提示金币不足（可与 `economy().SHOP_REFRESH_COST` 对比展示）。
- 抽卡：单抽前展示 `economy().GACHA_COST`；调用 `onGacha()` 后刷新金币与 squad。

---

## 8. 抖音安全区

在 `SafeArea` 根节点使用 **Widget**：Top / Bottom 勾选 **Target** 为父级，必要时在启动时用 `sys.getSafeAreaRect()`（以当前 Creator 文档为准）微调顶部栏高度，避免刘海遮挡金币与昵称。

---

## 9. 可选 UI 脚本骨架（自行创建在 assets 内）

在 Creator 中新建 `HubController.ts`（示例名），继承 `Component`：

- `onLoad`：`this.bridge = this.node.getComponent(FootballMvpBridge)` 或 `find`。
- 每次界面显示：`JSON.parse(this.bridge.dumpSnapshotJson())` 更新各 `Label`。
- 按钮：`this.bridge.onPlay('normal')` 后解析返回字符串或扩展 Bridge 返回结构化赛果。

这样 **表现层全是 2D UI**，逻辑层保持无 UI 依赖，便于测试与后续接抖音 API。

---

## 10. 与「3D」的关系

本 MVP **不需要** 3D 球场或模型；若日后要「伪 3D」或 Spine 动画，可在同场景中增加独立节点层，不影响现有数据层。
