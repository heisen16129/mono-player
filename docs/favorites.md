# 收藏存储

收藏保存在应用数据目录的 `music-player.sqlite`，不再读取或写入 JSON 中的 `mono-player-favorites`。没有旧收藏迁移；升级后的收藏列表从新表开始。

`favorites` 表包含独立主键、唯一身份键、本地曲库外键、音源与来源歌曲 ID、歌曲 JSON 快照以及收藏时间。列表按收藏时间倒序，同一秒内按主键倒序排列。

- 本地歌曲按规范化路径去重；移除曲库目录时，在同一事务中删除目录内歌曲的收藏（包括子目录及已失去曲库关联的快照），随后刷新前端收藏。其他目录和在线歌曲的收藏不受影响。
- 在线歌曲按音源提供方和来源歌曲 ID 去重；缺少来源标识时使用完整 URL。临时播放 URL 的刷新不影响具备完整来源标识的收藏。
- `list_favorites` 查询收藏；`add_favorite` 幂等添加；`remove_favorite` 按收藏记录 ID 幂等删除，不删除曲库歌曲。
- 前端等待写入成功后更新状态，写入失败通过现有错误提示展示。连续点击顺序执行，右键“添加收藏”不会切换成取消收藏。
- 小爱音箱的收藏查询和批量编辑使用同一张表；批量修改在事务中完成。

验证：`node --test scripts/favorites.test.mjs`，以及 `cargo test --manifest-path src-tauri/Cargo.toml favorites --lib`。
