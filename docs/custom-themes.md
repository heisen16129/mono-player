# 自定义主题管理

主题沿用 mono-player.store.json 的 mono-player-custom-themes 键，无需迁移。Rust 校验主题 ID、名称、样式变量类型与名称、背景透明度；查询过滤无效旧记录并按 ID 去重。

- theme_list：返回 themes 和 activeTheme，修复当前主题不存在的情况。
- theme_upsert(theme, activate)：同 ID 替换，新增或更新的主题排在最前，可选择立即使用。
- theme_select(id)：确认主题存在后切换，也支持内置 blueWhite。
- theme_remove(id)：删除主题；若正在使用则切回 blueWhite。

增删、切换和查询修复在同一存储锁内完成，主题列表、当前主题和启动主题标识在同一次 JSON 保存中更新。普通 settings_set / store_set 设置保存保留后端当前主题，避免旧设置快照覆盖新选择。

前端使用返回快照更新列表及选中状态，仅负责预览、CSS 变量和背景资源的显示。主题请求与设置保存按顺序提交；失败时不提前修改列表或主题。主题插件安装/卸载等待主题操作完成。

主题插件关联由后端 plugins::theme_links 管理，保存于 themes.plugins（主题 ID → 插件 ID）。save_installed_plugins 在写入安装记录前读取并校验主题，更新主题和关联；更新导致主题 ID 改变时删除旧主题并保留当前选中状态。其他插件占用同一主题 ID 时拒绝覆盖。

uninstall_plugin 统一删除插件包、安装记录、配置、目录缓存和关联主题；theme_remove 只卸载关联记录指向的已安装主题插件。旧安装在首次查询/删除时读取 theme action 补齐关联；无法读取的插件不猜测关联，日志记录原因。前端只刷新列表和显示结果。
