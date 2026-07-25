# 在线音频可复用缓存实施文档

## 目标

在线播放在线歌曲时继续边缓存边播放；当同一插件、同一歌曲、同一音质已经完整缓存过时，后续播放直接读取本地缓存文件，减少重复请求并支持二次播放更快开始。

## V1 范围

- [x] 使用 `providerId + trackId + quality` 生成稳定缓存 key。
- [x] 缓存完整音频到 `mono-cache/online-audio-cache/tracks/`。
- [x] 写入对应 metadata 到 `mono-cache/online-audio-cache/metadata/`。
- [x] 插件解析 URL 前命中完整 metadata + 文件时，直接走本地文件。
- [x] URL 解析成功后命中完整 metadata + 文件时，直接走本地文件。
- [x] 未命中时仍按现有逻辑请求 URL，边播边写入稳定缓存文件。
- [x] 程序启动不再清理在线音频缓存。
- [x] 每日自动清理、切换缓存目录时清理在线音频缓存。
- [x] 运行 `cargo check` 验证后端编译。

## 暂不做

- 不做搜索结果封面或音频预下载。
- 不做断点续传，未完整缓存的文件仍视为不可复用。
- 不做跨插件、跨音质复用。
- 不做缓存 UI 管理页改造。

## 数据结构

缓存 key 输入：

```text
providerId: 插件 id，例如 mono-native-wasm-yuanli-qq
trackId: 插件歌曲 id，例如 003abc
quality: 实际播放音质，例如 128k / 320k / lossless
```

目录结构：

```text
mono-cache/online-audio-cache/
  tracks/
    <cacheKey>.audio
  metadata/
    <cacheKey>.json
```

metadata 示例：

```json
{
  "version": 1,
  "cacheKey": "...",
  "providerId": "mono-native-wasm-yuanli-qq",
  "trackId": "003abc",
  "quality": "128k",
  "url": "https://...",
  "contentLength": 1234567,
  "completed": true,
  "createdAt": 1785024000,
  "lastAccessedAt": 1785024000
}
```

## 执行记录

- [x] 已确认旧逻辑在 `PlayerState::new` 和 `player_set_cache_dir` 中清理 `online-audio-cache`。
- [x] 已确认旧逻辑在 `StreamingHttpReader::open` 中使用 URL + timestamp 生成临时缓存名，无法二次命中。
- [x] 已实现稳定缓存 key 和 metadata。
- [x] 已实现完整缓存命中读取。
- [x] 已实现完成下载后写 metadata。
- [x] 已运行 `cargo check`，后端编译通过。
- [x] 已优化前端播放恢复、缓存命中、歌词空状态和音质能力复用相关逻辑。

## 当前实现说明

- 插件在线歌曲会把 `providerId + trackId + quality` 作为缓存身份传给 audio worker。
- 播放插件在线歌曲前会先查完整缓存；命中时不请求插件 URL，直接播放 `tracks/<cacheKey>.audio`。
- audio worker 如果发现 metadata 标记为完整，并且对应音频文件存在且大小有效，也会直接读取 `tracks/<cacheKey>.audio`。
- 首次播放或未命中时，仍请求插件返回的 URL，边播边写到稳定缓存文件，下载完整后写入 metadata。
- 音频流播放/下载失败时，会删除本次未完整写入的 `tracks/<cacheKey>.audio` 和对应 metadata，避免下次残留半截缓存。
- 走缓存播放时，后端当前播放源使用真实缓存文件路径；前端通过队列 `currentIndex` 找回对应插件歌曲，避免播放按钮、进度条和动画停在加载态。
- 启动时不清理在线音频缓存，避免每次打开程序都删掉可复用缓存。
- 每日自动清理、切换缓存目录时仍会清理在线音频缓存。
- 设置页手动清理缓存仍然会清理 `mono-cache` 下的缓存文件。
