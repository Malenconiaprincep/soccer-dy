# soccer-dy2 · PixiJS 足球经理对战（Web / 微信小游戏 / 抖音小游戏）

手机**竖屏**优先的 **PixiJS v8** 工程骨架，含 **Web 开发调试** 与 **微信、抖音小游戏** 独立构建产物。

## 技术栈

- TypeScript、Vite 8、**pixi.js ^8.18**（主版本锁定在 8.x，升级前请在真机回归）
- 逻辑设计分辨率：**750×1624**（见 `src/platform/constants.ts`）
- 画布缩放默认 **`cover`**（铺满视口、避免「特别瘦」窗口里整屏显得过小）；若要整稿始终完整可见，可把 `DESIGN_SCALE_MODE` 改为 `'contain'`。

## 本地开发（Web）

```bash
pnpm install
pnpm dev
```

浏览器打开后使用 **开发者工具移动设备仿真 + 竖屏**，更接近小游戏表现；**最终以真机为准**。

## 构建产物

| 命令 | 输出目录 | 说明 |
|------|-----------|------|
| `pnpm run build:web` | `dist/` | 静态 H5，可部署任意静态托管 |
| `pnpm run build:wechat` | `build/wechat/` | `game.js` + `game.json`，用 **微信小游戏开发者工具** 打开该目录 |
| `pnpm run build:douyin` | `build/douyin/` | 同上，用 **抖音小游戏开发者工具** 打开 |

小游戏模板见 [`templates/game.wechat.json`](templates/game.wechat.json)、[`templates/game.douyin.json`](templates/game.douyin.json)；构建后会复制到对应 `build/*/game.json`。

## 入口与适配器约定

- Web：[`src/main-web.ts`](src/main-web.ts) → [`src/adapter/web.ts`](src/adapter/web.ts)（无垫片）→ [`src/bootstrap.ts`](src/bootstrap.ts)
- 微信：[`src/main-wechat.ts`](src/main-wechat.ts) 先执行 [`installWeChatAdapter`](src/adapter/wechat.ts)，再动态加载 bootstrap（便于日后在 Pixi 之前插入官方 adapter 脚本）
- 抖音：[`src/main-douyin.ts`](src/main-douyin.ts) 同理

当前 adapter 为**占位**；若运行时报缺少 DOM/BOM，请按各平台文档在 **`installWeChatAdapter` / `installDouyinAdapter` 内**引入官方或社区小游戏 adapter，并保证 **先于 `pixi.js` 执行**。

## 平台抽象

[`src/platform/`](src/platform/) 提供：

- `mountMainCanvas`：Web 挂到 `#app`；微信/抖音使用 `wx.createCanvas` / `tt.createCanvas`
- `getPixelRatio`： capped 至 **2**，减轻发热与显存压力
- `getSafeAreaInsets`：基于 `getSystemInfoSync().safeArea`
- `subscribeTouches`：将触摸转为画布上的 pointer 事件（实验性，真机需验证）

## 真机与构建注意事项

- **IIFE + Pixi 8**：构建时可能出现 `import.meta` 被置空的告警；若小游戏真机异常，可尝试将 `vite.config.ts` 中小游戏 `output.format` 改为 **`es`** 并按平台文档配置模块化入口。
- **WebGL / Text**：部分 Android 机型对 stencil、动态文字敏感；小游戏侧建议优先 **位图字 / 合图**，并做好低端机帧率测试。
- **微信**：网络与资源域名见 [微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)
- **抖音**：见 [字节小游戏开发指南](https://partner.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/dev-guide/bytedance-mini-game)

## 设计 Prompt

完整尺寸、Q 版风格 bible、逐资产可复制 prompt 见 [**docs/DESIGN_PROMPTS.md**](docs/DESIGN_PROMPTS.md)。

## Cursor Agent 出图技能（本机）

已安装到 **`~/.cursor/skills/`**：`generate2dsprite`、`generate2dmap`、`find-skills`（从本机 Codex/Claude 技能目录同步）。在 Cursor 里让 Agent「按 generate2dsprite / generate2dmap 技能出图」即可。若要从 [skills.sh](https://skills.sh/) 拉社区包，网络稳定时可试：`GIT_HTTP_VERSION=HTTP/1.1 npx skills add <org/repo@skill> -g -y`。

## 当前可玩切片

主菜单「开始对战」→ 简化球场（矢量绘制）→ 点击球场移动足球占位 →「返回」回菜单。资源位图接入后可替换为 `Assets.load`（建议在 platform 层封装远程/本地路径）。
