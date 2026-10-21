# @mono/plugin-sdk v1

本工作区的 TypeScript SDK。通过构建工具把 `packages/plugin-sdk` 作为本地包解析并打入插件页面，不在运行时从远端加载 SDK。包尚未发布到 npm。

## 最小页面

在 plugin.json 中声明 apiVersion/schemaVersion=1、包内页面 entry 和 library.read/player.control 权限。页面脚本在 iframe load 之前安装连接监听（普通 module 入口即可）：

```ts
import { connectToHost } from '@mono/plugin-sdk/connect';

const mono = await connectToHost();
window.addEventListener('pagehide', () => mono.dispose(), {once:true});
const info = await mono.host.getInfo();
const page = await mono.library.listTracks({limit:50});
// 由用户点击具体歌曲时调用：await mono.player.playTrack(page.items[0].id)
const subscription = await mono.events.subscribe(['player'], event => {
  console.log(event.topic, event.revision, event.data);
}, error => console.error(error));
// 不再需要时：await mono.events.unsubscribe(subscription)
```

示例订阅 player 还需 player.read 权限。缺少权限返回 PERMISSION_DENIED；不要回退到 Tauri 或旧桥。host.getInfo 只报告当前实例可用方法。

## 数据和生命周期

- 方法签名和结果类型：client.ts、features.ts、protocol.ts、separation.ts、subscriptions.ts。
- 底层 createMono 接受 Transport，MessagePort 和受管服务 HTTP 调用同一 Rust dispatcher。插件不传 pluginId，也不接收宿主会话令牌。
- 普通方法 15 秒超时，文件选择 5 分钟；写入不自动重试。捕获 PluginApiError.code 判断权限、冲突、取消和超时。
- queue 编辑传 expectedRevision，使用返回队列的新 entryId；收到 CONFLICT 后先重读，不覆盖别人的修改。
- events.subscribe 返回 subscriptionId，SDK 不重叠轮询；audio.subscribeFrames 独立采样。dispose 清理计时器、订阅、请求和连接。
- 渲染插件导出 mount(root,mono)、update(message)、可选 updateAudioFrame(frame)、destroy()，使用 @mono/plugin-sdk/renderer 的 mountRenderer 装配。不要自行接旧 api.post。
- ui.openPage 只能打开自己声明的页面；renderer 为本插件渲染入口，surface:'desktop' 打开桌面实例。ui.close 只关闭当前页面/窗口。

完整 79 方法和权限见 [接口索引](../../docs/plugin-api-methods.md)。运行 `npm run plugins:v1:test` 和 `npx tsc -p packages/plugin-sdk/tsconfig.json` 验证。
