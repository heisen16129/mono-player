# Mineradio 3D 歌词插件

这是 Mono Player 的外置歌词渲染插件。插件保留 Mineradio 的 3D 粒子场景、舞台歌词、
镜头、封面深度、七个视觉预设和玻璃播放栏，通过一层很薄的适配代码接收 Mono 的
Track、标准化歌词、播放状态、队列和后端频谱。

## 构建

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\mineradio-lyrics\build.ps1
```

构建产物是同目录的 `renderer.mjs`。开发预览：

- `preview.html`：桌面窗口；
- `preview-compact.html`：680 x 520 紧凑窗口回归页。

## 安装

在 Mono Player 的插件中心选择本目录下的 `manifest.json`。修改或重新构建后，已安装
版本需要重新导入一次，让宿主刷新 manifest 版本和模块内容。

`3.0.1` 修复 Mineradio 队列封面：与 Apple Music 插件一致，将 Track 中的本地
`file:///` 封面转换为 `asset.localhost` 地址；Base64 和网络图片地址保持原样。

`3.1.0` 增加活动歌曲的 `activeTrack.artworkDataUrl`。宿主只在切歌或封面变化时读取
当前封面并发送一次 Base64 Data URL；Mineradio 保留该字段并优先交给 Canvas/WebGL，
普通播放进度更新不会重复发送图片数据。

## 目录职责

- `src/vendor/mineradio/`：Mineradio 视觉运行时、样式和点云资源；
- `src/bridge/`：Mono Track、歌词、配置和播放状态适配；
- `src/ui/`：插件自己的设置面板、队列和播放栏；
- `src/renderer.mjs`：插件生命周期装配，不承载视觉引擎实现。

## 限制

- 外置插件运行在 `sandbox="allow-scripts"` iframe，不能直接访问宿主音频元素、文件系统
  或播放器内部对象；所有数据和操作必须经过可序列化消息桥。
- Mono 当前提供 5 段后端频谱，原版浏览器音频分析使用 1024 个 FFT bin，因此细粒度
  节拍和频率响应不能完全等同于原版。
- 宿主限制单个外置模块不超过 2 MiB。骷髅点云使用 UInt16 量化并在运行时还原，视觉
  运行时与资源仍打包在一个模块内。
- 保留的是 Mineradio 播放视觉引擎，不包含登录、搜索、天气电台、3D 歌单架、摄像头
  手势和桌面歌词副窗口；这些能力由 Mono 宿主负责或不适用于沙盒插件。

## 许可

Mineradio 衍生部分按 GPL-3.0-only 分发。详见 `LICENSE`、`NOTICE.md` 和
`src/vendor/mineradio/README.md`。
