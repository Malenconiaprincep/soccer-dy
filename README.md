# soccer-dy

抖音小游戏 · **足球经理 MVP**（逻辑与策划稿），可与 **Cocos Creator 3.x** 工程结合使用。

## 仓库里有什么

| 路径 | 说明 |
|------|------|
| [docs/DESIGN-MVP.md](docs/DESIGN-MVP.md) | 界面流程、线框、配色、数值与版权说明（设计稿） |
| [docs/COCOS-CREATOR-2D-UI.md](docs/COCOS-CREATOR-2D-UI.md) | **Cocos Creator 2D + UI** 场景结构、控件与 `FootballMvpBridge` 绑定说明 |
| [cocos-football-mvp/](cocos-football-mvp/) | TypeScript 核心：存档、阵容、商店、抽卡、AI 赛、本地榜 |
| `cocos-football-mvp/tests/` | Vitest 单测（**勿**拷进 Creator `assets`） |
| `cocos-football-mvp/assets/scripts/football-mvp/FootballMvpBridge.ts` | 示例 `cc.Component`，便于把按钮事件接到 `FootballMvpGame` |

## 如何在 Cocos Creator 里跑

1. 用 **Cocos Creator 3.8+** 新建「抖音小游戏」或空项目，启用 TypeScript。
2. 将 `cocos-football-mvp/assets/scripts/football-mvp` **整夹复制**到工程的 `assets/scripts/`（或任意 `assets` 子目录）。**不要**把仓库里的 `cocos-football-mvp/tests/` 放进 `assets`（单测只在 Node 下跑，且依赖 `vitest`）。
3. 若你曾复制过旧版里的 `*.test.ts`，请从 Creator 工程的 `assets` 下**删掉**这些文件，否则会报找不到 `vitest`。
4. 删除或忽略本仓库中的 `types/cocos-shim.d.ts`（仅用于在无引擎环境下做类型检查），改用 Creator 自带的 `cc` 类型。
5. 在场景中新建节点，添加组件 **FootballMvpBridge**，用按钮/自定义事件调用其公开方法（见脚本内注释）。
6. 按 [docs/DESIGN-MVP.md](docs/DESIGN-MVP.md) 搭建 UI（Label、Button、ScrollView 等）。

## 本地开发与单测

```bash
cd cocos-football-mvp
npm install
npm test
```

单测源码在仓库 `cocos-football-mvp/tests/`，仅在 `npm test` 时使用；**勿**放入 Creator 的 `assets`。

存档默认走 `localStorage`；在抖音真机/模拟器上若存在全局 `tt`，则自动使用 `tt.getStorageSync` / `tt.setStorageSync`。

- 球员均为**虚构姓名**与**虚构身价**，无头像，降低版权风险；后续若使用真实数据需单独授权。
- 排行榜当前为 **本机 + 虚拟 NPC**，上线抖音全球榜需开放数据域等能力，与当前 MVP 解耦。
