# Soccer Game Cocos Client

这是原 PixiJS 客户端向 Cocos Creator 3.8.8 迁移后的新工程。旧客户端暂时保留，用于功能和视觉回归对照；Node/CloudBase 服务端与 React 商店后台继续复用。

## 打开工程

1. 在仓库根目录运行 `npm run cocos:prepare`，同步资源并生成/修复主场景。
2. 运行 `npm run cocos:open`，或在 Cocos Dashboard 中导入完整的 `cocos-client` 目录。
3. 在 Creator 的资源管理器中展开 `assets/scenes`，双击 `main.scene` 并预览。

切换编辑器左上角的 `3D/2D` 按钮只会改变视图，不会切换场景。如果层级中只有 `Main Light` 和 `Main Camera`，当前打开的是 Creator 默认 3D 场景，不是游戏场景。

设计分辨率为 `720 x 1280`，运行时强制竖屏并使用 `FIXED_WIDTH`：背景按真实屏幕高度铺满，交互内容保持比例缩放到系统安全区，兼容 16:9、19.5:9、20:9 以及刘海/底部手势区域。

## 运行配置

Web 预览默认连接：

- HTTP: `http://localhost:8787`
- WebSocket: `ws://localhost:8788/battle`

可以在 Cocos 加载前注入配置：

```js
globalThis.SOCCER_GAME_CONFIG = {
  gameServerUrl: 'https://game-api.example.com',
  battleSocketUrl: 'wss://game-socket.example.com/battle',
  matchmakingBotAfterMs: 5000
};
```

## 当前迁移范围

- Cocos 原生 Loading、Home、Matchmaking、Matchup、Battle、Result 状态闭环
- 原球员、阵型和存档数据结构
- HTTP 匹配、战果上报与本地 AI 降级
- 可供后续实时对战场景接入的 WebSocket 客户端
- 首批背景、UI 图集和音频资源同步流程

## 后续场景

- Formation：编辑器 Prefab 化球员卡、阵型槽位、拖放换人
- BlindBox：卡包动画与球员入库
- Home：签到、任务、商店和平台入口
- Battle：服务端脚本流、实时房间事件、完整事件卡动画
- Platform：抖音登录、分享、侧边栏和桌面快捷方式

新代码不得直接引用 PixiJS。纯业务代码放在 `assets/scripts/domain`，平台和网络代码放在 `assets/scripts/services`，Cocos 组件放在 `assets/scripts/runtime`。
