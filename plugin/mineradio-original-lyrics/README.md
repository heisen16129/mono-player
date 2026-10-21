# Mineradio 原版歌词

插件保留Mineradio 2.1.0 的原版 DOM、CSS、Three.js 视觉引擎、360° 镜头交互、
底部播放栏、播放队列和视觉控制台；Mono 桥接层只负责提供歌曲、歌词、
Base64 封面、队列、原始 PCM 和播放命令。

Wallpaper Engine 音域回响使用的原版子引擎已内嵌到单文件模块中，不依赖
插件沙箱外的相对资源路径。

Mono 播放器按 2048 个单声道采样向插件发送原始 PCM 帧。插件内部使用 Hann 窗和
2048 点 FFT 生成原版分析器需要的 1024 个频率点，并分别保留原版主分析器 `0.58`
和节拍分析器 `0.10` 的平滑参数。宿主已有的 5 段频谱不参与 Mineradio 原版视觉。

桥接层还会同步原版子引擎依赖的当前歌曲、队列、播放时钟和封面状态。专辑封面、
星河、唱片、星球和滚筒会使用原版 3D 粒子；`虚空`按原版定义是无粒子的自定义背景预设。

## Wallpaper Engine 原版链路

原版不会把 Wallpaper Engine 项目转换成普通图片，也不会用 Three.js 重做壁纸。
它通过 `wallpaper64.exe -playInWindow` 启动真实场景，并使用三层结构合成歌词页：

1. 原生 DWM 辅助窗口位于透明歌词窗口后方，持续显示 Wallpaper Engine 场景。
2. Mineradio 的 Three.js 歌词、粒子和交互层位于中间。
3. 播放栏位于最上层；原版使用 Windows Graphics Capture 获取实时视频流，只把
   播放栏区域复制到 `#wallpaper-engine-glass-sampler`，供原版玻璃滤镜采样。

Mono 采用同样的窗口层级和首帧门控：先建立捕获并记录黑色辅助窗口的基准帧，
再启用 DWM 场景，确认像素已经变化后才显示歌词页。Wallpaper Engine 场景启用时，
宿主菜单、内容区和宿主播放栏会隐藏，只保留插件自己的歌词画布和播放栏。

由于 Tauri WebView 不能直接接收原版 Electron preload 提供的 `MediaStream`，Mono
当前由 Rust 的 Windows Graphics Capture 后端持续输出播放栏裁剪帧。完整背景仍是
Wallpaper Engine 的原生 DWM 画面，不经过图片转码；裁剪帧只服务于播放栏玻璃效果。

Mono 只连接已经运行的 Wallpaper Engine，不会主动启动主进程。这样选择歌词页壁纸
只会创建独立的 `-playInWindow` 会话，不会因启动引擎而恢复或修改桌面 1 的壁纸。

## 构建

在仓库根目录安装依赖后运行：

```powershell
./plugins/mineradio-original-lyrics/build.ps1
```

构建脚本读取 `upstream/public/js/index-loader.js` 中的官方模块顺序，生成
单文件 `renderer.mjs`，以适配 Mono 外置歌词插件的单入口加载方式。

插件更新后需要在 Mono 中重新导入本目录的 `mineradio-original-lyrics.monoplugin.zip`，已安装目录中的
旧版 `renderer.mjs` 不会自动替换。当前插件版本为 `1.0.7`。

## 上游

- Mineradio 版本：2.1.0
- 上游提交：`89c0d230c3f1f792e5d9639781ebbf724c4efbfe`
- 许可证：GPL-3.0-only
- 项目：https://github.com/XxHuberrr/Mineradio
