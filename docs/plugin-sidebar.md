# 插件侧栏菜单申请

插件在 metadata 中主动声明 `sidebar`，安装并启用后，主侧栏会生成菜单。没有声明的插件不会自动获得菜单。该声明与 `playbackBar` 相互独立。

## 插件自己的网页

```json
{
  "sidebar": {
    "title": "我的插件",
    "icon": "plug",
    "page": { "url": "https://example.com/plugin/index.html" }
  }
}
```

- `title` 可省略，默认使用插件名称。
- `icon` 支持 `plug`、`speaker`、`audio-lines`。
- `page.url` 使用 HTTPS 地址，页面必须允许 iframe 嵌入。此版本不提供本地 HTML 包安装。
- 页面在右侧内容区的隔离 iframe 中展示，允许脚本、表单、弹出窗口，不授予宿主 Tauri API 或同源权限。需要账号或跨域 API 的页面应自行适配该隔离环境。
- 页面不替换宿主侧栏或播放栏。点击其他主菜单即可离开；再次进入会重新加载页面。

## 已接入宿主的服务页面

人声／伴奏分离申请原生功能页面：

```json
{
  "sidebar": {
    "title": "人声／伴奏分离",
    "icon": "audio-lines",
    "page": { "action": "stem-separation" }
  }
}
```

`stem-separation` 需要插件同时声明该 capability；宿主在内容区呈现分离页面，与原弹窗复用任务和环境管理组件。
小爱音箱不再申请侧栏菜单，仅保留播放栏入口。Host 仍支持 `speaker-control` 页面适配器，但不会自动生成菜单。
其他服务 action 需要在 `src/services/pluginPages.ts` 接入，不执行插件声明的任意宿主命令。

菜单声明通过 metadata → catalog → 安装清单 → 持久化完整保留。旧插件包需要更新或重新安装才能读取新声明。
安装、更新、启停、卸载触发 `mono:plugins-changed` 后刷新菜单；当前页面所属插件停用或卸载时退出到插件管理，关闭全局插件开关时回到音乐池。
