# 扇形歌词 · Mono 插件

独立的扇形歌词插件，包含统一圆心的歌词排布、左侧弧形大封面、逐字高亮、播放控制和歌词搜索。窄屏使用紧凑圆形封面。

1.1.0 精简设置为字号、扇形角度、行间距、远处歌词模糊、远处歌词缩放、显示封面。保留歌词同步校准；移除辉光、上浮、对齐和背景选择，并停用对应旧配置。背景固定使用封面流动。

在 Mono 插件中心导入本目录的 `manifest.json`，然后在歌词渲染插件中选择「扇形歌词」。请将 `manifest.json` 与 `renderer.mjs` 保存在同一目录。

插件 ID 为 `fanlyrics`，可与 BetterLyrics 同时安装，设置各自保存。BetterLyrics 原有的扇形设置不会自动迁移。

构建：`node plugins/fanlyrics/build.mjs`。开发时复用 BetterLyrics 的渲染源码，生成的 `renderer.mjs` 完全打包，安装和运行不依赖 BetterLyrics 插件。

预览：`/plugins/fanlyrics/preview.html`。源码基于 BetterLyrics 的浏览器适配，遵循 GPL-3.0-only；见 LICENSE 和 NOTICE.md。
