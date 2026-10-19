# 插件快捷入口

播放栏预留 `PlaybackPluginSlot` 插件图标插槽。只有在 metadata 中主动声明 `playbackBar` 的插件才申请播放栏图标；安装并启用后显示。没有声明时，即使具备独立窗口，也不显示。
安装、启用、停用、卸载后通过 `mono:plugins-changed` 自动刷新；关闭全局插件开关时隐藏入口。
不具备独立界面的音源、歌词等插件不会自动生成按钮。

## 插件申请

小爱音箱在自己的 metadata 中声明：

```json
"playbackBar": { "action": "speaker-control", "icon": "speaker" }
```

`action` 必须是插件自身声明且 Host 已支持打开的能力。`icon` 当前支持 `speaker`、`audio-lines`。缺失申请、未知 action、未知图标均不显示入口。声明会随 metadata、商城信息、安装清单和持久化完整保留。

人声／伴奏分离不声明 `playbackBar`，因此只保留插件中心的「分离」入口。旧版小爱音箱需要更新或重新安装包含该声明的插件包，Host 不按插件 ID 自动补申请。

## Host 窗口注册规则

入口在 `src/components/plugins/pluginLaunchers.ts` 注册，插件中心和播放栏共用：

| capability | 窗口 | 默认图标 |
| --- | --- | --- |
| `speaker-control` | 小爱音箱控制台 | Speaker |
| `stem-separation` | 人声／伴奏分离 | AudioLines |

新增 Host 支持的插件界面时：

1. 插件 metadata 声明对应 capability（新能力需同时接入类型、后端权限和运行时处理）。
2. 在对应功能目录实现 Launcher，接收 `pluginId`、`disabled`，通过默认插槽暴露 `open: () => void`。
3. Launcher 的默认插槽回退为插件中心使用的文字按钮；弹窗由 Launcher 管理并 Teleport 到 body。
4. 在统一注册表添加 capability、图标和 Launcher 组件。插件中心可显示操作入口；是否加入播放栏仍由插件自己的 `playbackBar` 声明决定。

播放栏使用插件申请的图标，悬停提示插件名称，点击直接打开对应窗口。
没有符合条件的插件时不占用位置；停用或卸载插件则移除入口及其窗口。
新 capability 仍需 Host 注册，不支持仅在 manifest 写入任意 URL 或命令就执行。
