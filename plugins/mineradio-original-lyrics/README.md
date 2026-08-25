# Mineradio 原版歌词

这是一个与 `mineradio-lyrics` 并存的独立歌词渲染插件。插件保留
Mineradio 2.1.0 的原版 DOM、CSS、Three.js 视觉引擎、360° 镜头交互、
底部播放栏、播放队列和视觉控制台；Mono 桥接层只负责提供歌曲、歌词、
Base64 封面、队列、频谱和播放命令。

Wallpaper Engine 音域回响使用的原版子引擎已内嵌到单文件模块中，不依赖
插件沙箱外的相对资源路径。

插件桥接层会将 Mono 的 5 段频谱扩展为原版分析器使用的 1024 点频谱缓冲区，
并同步原版子引擎依赖的当前歌曲、队列、播放时钟和封面状态。专辑封面、星河、
唱片、星球和滚筒会使用原版 3D 粒子；`虚空`按原版定义是无粒子的自定义背景预设。

## 构建

在仓库根目录安装依赖后运行：

```powershell
./plugins/mineradio-original-lyrics/build.ps1
```

构建脚本读取 `upstream/public/js/index-loader.js` 中的官方模块顺序，生成
单文件 `renderer.mjs`，以适配 Mono 外置歌词插件的单入口加载方式。

插件更新后需要在 Mono 中重新导入本目录的 `manifest.json`，已安装目录中的
旧版 `renderer.mjs` 不会自动替换。当前插件版本为 `1.0.4`。

## 上游

- Mineradio 版本：2.1.0
- 上游提交：`89c0d230c3f1f792e5d9639781ebbf724c4efbfe`
- 许可证：GPL-3.0-only
- 项目：https://github.com/XxHuberrr/Mineradio
