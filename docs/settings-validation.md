# 设置校验

Rust settings::normalize 统一处理播放器设置。store_get 读取 mono-player-settings 时补齐默认值并规范化；settings_set 校验后保存并返回实际保存值；通用 store_set 写入相同键时也执行校验。

规则包括布尔值和枚举、颜色、目录字符串及列表、快捷键默认值，以及以下范围：

- 定时关闭：1–999 分钟，整数。
- 歌词字号：14–34，整数。
- 音频缓存：64–51200 MB，整数。
- 搜索历史：1–25 条，整数。
- 歌词背景：透明度 0–1、模糊 0–60、位置 0–100、缩放 1–2.8。

无效值使用默认值，合法自定义主题及其他扩展字段保留；已废弃的 playlists、recentPlayedTrackIds 字段移除。原 JSON 存储位置不变。

前端按顺序提交保存，使用后端响应更新设置；保存期间的新编辑和预览不会被旧响应覆盖。保存错误反馈到播放器错误状态。歌词背景即时预览仍在前端处理，正式保存由后端校验。

回归检查：cargo test --manifest-path src-tauri/Cargo.toml settings --lib；node --test scripts/settings-backend.test.mjs；npm run build。

缓存目录与容量上限由后端在启动时应用。settings_set（以及通用 store_set 写入设置键）比较规范化后的缓存配置，仅在目录或上限变化时切换音频 worker 缓存目录并按上限清理。切换失败返回错误，不保存新设置。前端不再监听设置触发维护，仅监听 cache://changed 刷新占用统计；手动清理缓存仍调用后端。
