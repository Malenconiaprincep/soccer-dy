# soccer-dy

抖音小游戏 · **足球经理 MVP**（逻辑与策划稿），可与 **Cocos Creator 3.x** 工程结合使用。

## 仓库里有什么

| 路径 | 说明 |
|------|------|
| [docs/DESIGN-MVP.md](docs/DESIGN-MVP.md) | 界面流程、线框、配色、数值与版权说明（设计稿） |
| [docs/COCOS-CREATOR-2D-UI.md](docs/COCOS-CREATOR-2D-UI.md) | **Cocos Creator 2D + UI** 场景结构、控件与 `FootballMvpBridge` 绑定说明 |
| [cocos-football-mvp/](cocos-football-mvp/) | TypeScript 核心：存档、阵容、商店、抽卡、AI 赛、本地榜 |
| `cocos-football-mvp/tests/` | Vitest 单测（**勿**拷进 Creator `assets`） |
| `cocos-football-mvp/assets/scripts/football-mvp/FootballMvpSceneBootstrap.ts` | **推荐入口**：挂到场景根，代码里自动拼 Canvas / EventSystem + `QuickStart` |
| `cocos-football-mvp/assets/scripts/football-mvp/FootballMvpQuickStart.ts` | 试玩 UI（可由 Bootstrap 自动添加，也可手动挂到 Canvas） |
| `cocos-football-mvp/assets/scripts/football-mvp/FootballMvpBridge.ts` | 正式 UI 用：示例 `cc.Component`，把按钮事件接到 `FootballMvpGame` |

## 如何在 Cocos Creator 里跑

### 最快试玩（推荐）

1. 用 **Cocos Creator 3.8+** 新建 **2D** 项目（或打开现有 2D 工程）。
2. 将 `cocos-football-mvp/assets/scripts/football-mvp` **整夹复制**到工程的 `assets/scripts/`（勿拷 `cocos-football-mvp/tests/`）。
3. 打开默认场景，在 **层级管理器** 选中 **场景根**（最顶层节点；若不方便选中，可新建空节点 `FootballMvpBoot` 挂在根下）。
4. **添加组件 → `FootballMvpSceneBootstrap`**。  
   - 该脚本会在代码里 **查找或创建 Canvas + UICamera、补 EventSystem**，并自动挂上 **`FootballMvpQuickStart`**，无需再手动挂 QuickStart。
5. 保存场景，点 **预览**。

（若你仍想手动控制，也可只挂 **`FootballMvpQuickStart`** 到已有 Canvas，不必用 Bootstrap。）

### 正式做 UI 时

- 移除 **`FootballMvpSceneBootstrap`** 与 **`FootballMvpQuickStart`**，改用 **`FootballMvpBridge`** + 你自己的 Prefab / 设计稿（见 [docs/COCOS-CREATOR-2D-UI.md](docs/COCOS-CREATOR-2D-UI.md)）。

### 注意事项

- 若曾复制过旧版里的 `*.test.ts`，请从 Creator 工程的 `assets` 下**删掉**，否则会报找不到 `vitest`。
- 不要复制本仓库的 `types/cocos-shim.d.ts` 进 Creator；以引擎自带的 `cc` 类型为准。

## 本地开发与单测

```bash
cd cocos-football-mvp
npm install
npm test
```

单测源码在仓库 `cocos-football-mvp/tests/`，仅在 `npm test` 时使用；**勿**放入 Creator 的 `assets`。

存档默认走 `localStorage`；在抖音真机/模拟器上若存在全局 `tt`，则自动使用 `tt.getStorageSync` / `tt.setStorageSync`。

## 说明

- 球员均为**虚构姓名**与**虚构身价**，无头像，降低版权风险；后续若使用真实数据需单独授权。
- 排行榜当前为 **本机 + 虚拟 NPC**，上线抖音全球榜需开放数据域等能力，与当前 MVP 解耦。
- 正式界面布局与动效见 [docs/DESIGN-MVP.md](docs/DESIGN-MVP.md)。
