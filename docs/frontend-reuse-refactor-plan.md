# 前端页面复用优化计划

## 目标

继续收敛页面里的重复 UI 结构，优先处理低风险、重复明显、职责清晰的组件，不改播放业务逻辑。

## 当前状态

| 步骤 | 状态 | 说明 |
| --- | --- | --- |
| 1. 抽取 BaseDialog | 已完成 | 已新增 `BaseDialog.vue`，并迁移扫描、歌单、添加到歌单、元数据、歌词搜索弹窗。 |
| 2. 抽取 SearchInput | 已完成 | 已新增 `SearchInput.vue`，并迁移本地曲库、艺术家、在线搜索、发现音乐、歌词搜索输入框。 |
| 3. 抽取 BaseContextMenu | 已完成 | 已新增 `BaseContextMenu.vue`，并迁移歌曲、下载项、歌单右键菜单。 |
| 4. 抽取 EmptyState / LoadingState | 已完成 | 已新增 `EmptyState.vue`、`LoadingState.vue`，并迁移一批列表空状态和搜索加载状态。 |
| 5. 迁移 PlayerDock 定时关闭弹窗 | 已完成 | 已将 `sleep-timer-dialog` 外壳迁到 `BaseDialog`，保留定时关闭业务逻辑。 |
| 6. 抽取 SegmentTabs | 已完成 | 已新增 `SegmentTabs.vue`，并迁移下载状态、插件来源、歌词来源 tabs。 |
| 7. 迁移剩余空状态 / 加载状态 | 已完成 | 已迁移 `LibraryPanel` 空文件夹、`LyricsView` 歌词空状态；`PluginManagerView` 添加订阅加载层保留自定义 overlay。 |
| 8. 构建验证 | 已完成 | 已运行 `npm run build`，构建通过；重复结构扫描未发现旧 Dialog/Search/Menu/Tab 外壳残留。 |

## 处理步骤

### 1. PlayerDock 定时关闭弹窗

- [x] 使用 `BaseDialog` 替换 `sleep-timer-dialog-backdrop` / `sleep-timer-dialog` 外壳。
- [x] 保留现有定时关闭选项、按钮、事件处理逻辑。
- [x] 删除迁移后不用的弹窗遮罩、面板、标题栏重复样式。
- [x] 回写本文档状态。

### 2. SegmentTabs

- [x] 新增 `SegmentTabs.vue`，只负责 tabs 容器、按钮、active/disabled 样式和点击事件。
- [x] 优先迁移 `DownloadManagerView` 的下载状态 tabs。
- [x] 再迁移 `PluginSearchView` 的插件来源 tabs。
- [x] 最后迁移 `LyricsView` 的歌词来源 tabs，保留歌词搜索逻辑。
- [x] 回写本文档状态。

### 3. 剩余空状态 / 加载状态

- [x] 用 `EmptyState` 迁移 `LibraryPanel` 空文件夹提示。
- [x] 用 `EmptyState` 迁移 `LyricsView` 的歌词空状态，保留搜索歌词按钮 action slot。
- [x] 评估 `PluginManagerView` 添加订阅 loading overlay：它是带遮罩和安装动画条的专用覆盖层，暂不迁到普通 `LoadingState`。
- [x] 回写本文档状态。

### 4. 验证

- [x] 运行 `npm run build`。
- [x] 扫描是否还有已迁移类型的重复结构残留。
- [x] 将验证结果写回本文档。

## 验证结果

- `npm run build` 已通过。
- 已扫描旧弹窗、搜索框、右键菜单、tabs 外壳关键 class，未发现旧重复结构残留。
- `PluginManagerView` 的添加订阅加载层保留自定义结构，因为它包含遮罩和安装动画条，不适合并入普通 `LoadingState`。
- 修复歌词搜索弹窗层级问题：`LyricsView` 内的歌词搜索 `BaseDialog` 已通过 `Teleport to="body"` 挂到 body，避免被歌词页布局和 `overflow` 影响。
- 修复歌词搜索弹窗高度问题：`BaseDialog` 已支持 `gridTemplateRows`、`maxHeight`、`overflow` 参数，歌词搜索弹窗不再被搜索结果列表撑开。
- 优化弹窗遮罩：`BaseDialog` 默认保留透明全屏 overlay 作为交互层，但不显示遮罩和模糊；仍支持 `overlayBackground`、`overlayBackdropFilter` 参数按需覆盖。

## 本轮继续复用计划

### 目标

继续扫描并统一剩余重复的前端 Vue / JS / CSS 结构，只处理公共 UI 和工具逻辑，不碰播放业务流程。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入本轮计划 | 已完成 | 文档已更新 | 明确本轮处理范围和顺序。 |
| 2. 抽取滚动状态 composable | 已完成 | 待最终构建验证，重复计时器扫描已清理 | 收敛多个页面里的 `is-scrolling` 计时器逻辑。 |
| 3. 迁移 Settings / Theme tabs | 已完成 | 待最终构建验证，旧页面 tab 外壳扫描已清理 | 复用现有 `SegmentTabs`。 |
| 4. 抽取 SpinnerIcon | 已完成 | 待最终构建验证，零散 `Loader2` 扫描已收敛 | 收敛零散 `Loader2` + `spinning` 用法。 |
| 5. 抽取 DefaultCover | 已完成 | 待最终构建验证，默认封面占位已迁移 | 收敛默认音乐封面占位。 |
| 6. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，重复点已重新扫描 | 回写最终结果。 |

### 本轮执行记录

- 2026-07-20：写入本轮复用优化计划。
- 2026-07-20：新增 `useScrollingState`，迁移 `WorkspaceView`、`ArtistsView`、`PluginSearchView`、`PrimarySidebar`、`LyricsView` 的滚动显隐计时器逻辑。
- 2026-07-20：迁移 `SettingsView`、`ThemeView` 到 `SegmentTabs`，删除页面内重复 tab 按钮样式。
- 2026-07-20：新增 `SpinnerIcon`，迁移 `LoadingState`、`PluginSearchView`、`TrackTable`、`PlayerDock` 的行内加载图标；`PluginManagerView` 的刷新图标旋转保留为刷新按钮私有反馈。
- 2026-07-20：新增 `DefaultCover`，迁移 `TrackCoverThumb`、`FolderCover`、`PlayerDock`、`LyricsView` 的默认封面占位；歌词搜索结果里的非封面小图标保留原实现。
- 2026-07-20：完成收尾扫描和 `npm run build` 验证，构建通过。

### 本轮验证结果

- `npm run build` 已通过。
- `ScrollTimer`、`lyricsScrollHideTimer` 已无残留。
- 零散 `Loader2` 已收敛到 `SpinnerIcon`，只有 `SpinnerIcon` 内部直接使用 `Loader2`。
- 默认封面占位已收敛到 `DefaultCover`；歌词搜索结果里的小音乐图标不是封面占位，保留原实现。
- `SettingsView`、`ThemeView` 不再保留自己的 tab 按钮样式，统一由 `SegmentTabs` 承载。

## 本轮剩余统一计划

### 目标

继续统一剩余的前端公共逻辑，优先处理低风险的 key/hash 工具，再处理封面读取/缓存重复逻辑；页面 Header/Shell 只在确认收益大于布局风险时处理。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入本轮计划 | 已完成 | 文档已更新 | 明确本轮处理范围和顺序。 |
| 2. 抽取 Track key/hash 工具函数 | 已完成 | 待最终构建验证，相关 key 扫描已收敛 | 统一在线歌曲 key、下载 key、稳定 hash、歌词/封面 identity key。 |
| 3. 抽取封面读取/缓存公共逻辑 | 已完成 | 待最终构建验证，封面读取工具扫描已收敛 | 优先收敛 `artworkDisplaySrc`、失败 URL、blob URL、读取封面兜底逻辑。 |
| 4. 评估 PageHeader/PageShell | 已完成 | 待最终构建验证，低风险页面 Header 已迁移 | 页面 Header 布局差异较大，先评估再决定是否抽。 |
| 5. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，重复点已重新扫描 | 回写最终结果。 |

### 本轮执行记录

- 2026-07-20：写入本轮剩余统一计划。
- 2026-07-20：新增 `utils/trackKey.ts`，迁移 `PluginSearchView`、`DownloadManagerView`、`TrackTable`、`LyricsView` 的 key/hash 生成逻辑，未改变现有 key 语义。
- 2026-07-20：扩展 `utils/artwork.ts`，统一 artwork 可用性判断、blob URL 创建/释放、临时 URL 判断；迁移 `TrackCoverThumb`、`FolderCover`、`PlayerDock`、`LyricsView`，保留各组件原有缓存生命周期。
- 2026-07-20：新增 `PageHeader`，迁移 `SettingsView`、`ThemeView`、`PluginManagerView` 的低风险页面标题区；`WorkspaceView`、`ArtistsView`、`PluginSearchView`、`LyricsView` 的 header 承载搜索、面板或歌词布局语义，暂不硬抽。
- 2026-07-20：完成收尾扫描和 `npm run build` 验证；首次构建发现 `revokeTemporaryObjectUrl` 类型收窄问题，已修复后重新构建通过。

### 本轮验证结果

- `npm run build` 已通过。
- 旧的组件内 `hashPluginTrackId`、`hashDownloadItemId`、`getDownloadTrackKey`、`trackIdentityKey` 已收敛到 `utils/trackKey.ts`。
- 组件内直接创建/释放封面 blob URL 的逻辑已收敛到 `utils/artwork.ts`；封面缓存生命周期仍保留在原组件内。
- `SettingsView`、`ThemeView`、`PluginManagerView` 已统一使用 `PageHeader`；其余 header 因承载搜索、面板或歌词布局语义，暂不合并。

## 下一轮职责拆分计划

### 目标

普通 UI 复用已经基本完成，下一轮开始处理前端剩余的业务职责集中问题。重点是让 `App.vue`、`PlayerDock.vue`、`LyricsView.vue` 从“大而全”变成多个职责清晰的 composable / 小组件，降低播放、歌词、队列、下载互相影响的概率。

### 边界

- 不改变现有播放流程和返回数据结构。
- 不顺手重写 Rust 后端逻辑。
- 不做兼容旧格式的额外分支。
- 每一步只迁移一类职责，完成后构建验证并回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入职责拆分计划 | 已完成 | 文档已更新 | 明确下一轮只处理职责拆分，不改业务语义。 |
| 2. 拆分 App 当前播放状态 | 未开始 | 构建通过；本地、在线、恢复播放的 `activeTrack` 表现不变 | 抽 `useActiveTrackState`，收敛 `selectedTrack`、`onlineActiveTrack`、`activeTrack`、当前播放来源判断。 |
| 3. 拆分 App 在线播放流程 | 未开始 | 构建通过；在线搜索播放、队列播放、切音质、下载优先本地逻辑不变 | 抽 `useOnlinePlayback`，收敛在线播放解析、在线队列 Track 组装、在线错误处理。 |
| 4. 拆分 App 下载状态 | 未开始 | 构建通过；下载按钮、下载列表、下载事件更新不变 | 抽 `useDownloadState`，收敛下载列表、下载 key、下载事件、入队逻辑。 |
| 5. 拆分 App 歌词状态 | 未开始 | 构建通过；本地/在线歌词加载、关联歌词、歌词格式切换不变 | 抽 `useLyricsState`，收敛歌词状态、后台歌词请求、歌词回写。 |
| 6. 拆分 PlayerDock 内部职责 | 未开始 | 构建通过；播放栏、队列弹层、定时关闭、音量/倍速/音质交互不变 | 优先抽 `useSmoothProgress`、`useSleepTimer`、`useQueuePopover`，封面逻辑单独评估。 |
| 7. 拆分 LyricsView 内部职责 | 未开始 | 构建通过；歌词滚动、高亮、搜索、下载、全屏不变 | 优先抽 `useLyricsScroll`、`useLyricsSearch`、`useLyricsDownload`，歌词封面缓存单独评估。 |
| 8. 评估封面缓存服务化 | 未开始 | 构建通过；列表封面、播放栏封面、歌词页背景无回退闪烁 | 在上面拆分稳定后，再评估是否抽 `useCoverCache` / `coverCacheService`。 |
| 9. 构建验证与收尾扫描 | 未开始 | `npm run build` 通过，职责重复点重新扫描 | 回写最终结果。 |

### 执行记录

- 2026-07-20：写入下一轮职责拆分计划，后续按步骤执行并回写状态。

## 按钮样式统一计划

### 目标

先处理分散在多个组件里的 `primary-button`、`secondary-button`、`confirm-button`、`secondary-button compact` 样式。优先采用全局 class 收敛 CSS，不改按钮模板、不改点击事件、不改业务逻辑。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 扫描按钮重复样式 | 已完成 | 已扫描 `primary-button`、`secondary-button`、`confirm-button`、`compact` | 确认 `icon-button` 已在 `base.css`，本轮重点收敛普通按钮。 |
| 2. 抽取全局按钮样式 | 已完成 | 待最终构建验证 | 在 `styles/base.css` 增加 `primary-button`、`secondary-button`、`confirm-button`、`secondary-button.compact` 公共样式，并支持 CSS 变量微调尺寸。 |
| 3. 删除组件内重复按钮 CSS | 已完成 | 待最终构建验证，重复样式扫描收敛 | 迁移 `PluginManagerView`、`PluginSearchView`、`ScanDialog`、`PlaylistDialog`、`TrackMetadataDialog`、`WorkspaceView`；`SettingsView` 仅保留 compact 的页面级 hover/focus 强调。 |
| 4. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，重复点已重新扫描 | 回写最终结果。 |

### 执行记录

- 2026-07-21：写入按钮样式统一计划；新增全局按钮样式并删除低风险组件内重复定义。

### 验证结果

- `npm run build` 已通过。
- `primary-button`、`secondary-button`、`confirm-button` 普通样式已收敛到 `styles/base.css`。
- `theme-tokens.css` 保留主题色覆盖；`SettingsView` 只保留 `secondary-button.compact` 的页面级 hover/focus 强调。
