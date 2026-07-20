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
| 2. 拆分 App 当前播放状态 | 已完成 | `npm run build` 已通过 | 已抽 `useActiveTrackState`，收敛 `selectedTrack`、`onlineActiveTrack`、`activeTrack`、当前播放来源判断。 |
| 3. 拆分 App 在线播放流程 | 已完成 | `npm run build` 已通过 | 已先抽出在线 Track key、队列 Track 组装、队列匹配和在线播放队列组装纯逻辑；保留原播放请求时序不变。 |
| 4. 拆分 App 下载状态 | 已完成 | `npm run build` 已通过 | 已抽 `useDownloadState`，收敛下载列表、下载 key、持久化和下载事件落库；`App.vue` 保留下载提示、入队请求和上下文菜单行为。 |
| 5. 拆分 App 歌词状态 | 已完成 | `npm run build` 已通过 | 已抽 `useLyricsState`，收敛歌词页状态、歌词 Track key、当前歌词格式派生和请求状态更新；歌词请求与回写流程保留在 `App.vue`。 |
| 6. 拆分 PlayerDock 内部职责 | 已完成 | `npm run build` 已通过 | 已先抽 `useSleepTimer`，收敛定时关闭输入、倒计时、暂停/恢复、到点执行和播完停止标记；播放进度、队列弹层和音量/音质交互未改。 |
| 7. 拆分 LyricsView 内部职责 | 已完成 | `npm run build` 已通过 | 已先抽 `useLyricsSearch`，收敛歌词搜索弹窗、插件来源、分页、去重和加载状态；应用歌词、滚动、高亮、下载和封面缓存未改。 |
| 8. 评估封面缓存服务化 | 已完成 | 已扫描封面缓存调用点；本步不改代码 | 当前 `PlayerDock`、`LyricsView`、`TrackCoverThumb`、`FolderCover` 的缓存生命周期差异较大，先保留局部缓存，避免引入封面闪烁回退风险。 |
| 9. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，职责拆分引用点已扫描 | 已确认新增 composable / 工具均被使用，回写最终结果。 |

### 执行记录

- 2026-07-20：写入下一轮职责拆分计划，后续按步骤执行并回写状态。
- 2026-07-21：新增 `useActiveTrackState`，迁移 `App.vue` 当前播放状态源和直接派生值；保留原播放流程不变，`npm run build` 通过。
- 2026-07-21：新增 `utils/onlineTrack.ts`，迁移在线 Track key、在线队列 Track 组装、候选插件 Track 匹配、在线队列构建纯逻辑；`App.vue` 保留播放流程编排，`npm run build` 通过。
- 2026-07-21：新增 `useDownloadState`，迁移下载列表、已下载/下载中 key、下载持久化、下载事件状态更新；`App.vue` 保留提示和下载入队动作，`npm run build` 通过。
- 2026-07-21：新增 `useLyricsState`，迁移歌词页状态、歌词 Track key、当前歌词格式派生和请求状态更新；本地/在线歌词请求与回写流程未改，`npm run build` 通过。
- 2026-07-21：新增 `useSleepTimer`，迁移 `PlayerDock` 定时关闭状态、倒计时、暂停/恢复、预设时长和播完停止标记；播放栏其他交互未改，`npm run build` 通过。
- 2026-07-21：新增 `useLyricsSearch`，迁移 `LyricsView` 搜索弹窗、插件来源、搜索分页、结果去重和搜索状态；应用歌词与歌词显示逻辑未改，`npm run build` 通过。
- 2026-07-21：完成封面缓存服务化评估；`PlayerDock` 负责当前播放封面和系统缓存桥接，`LyricsView` 负责歌词页全图/缩略图引用计数，`TrackCoverThumb` 与 `FolderCover` 负责列表级缩略图缓存，生命周期不同，本轮不合并为公共服务。
- 2026-07-21：完成最终构建验证与引用扫描；`npm run build` 通过，新增 `useActiveTrackState`、`useDownloadState`、`useLyricsState`、`useSleepTimer`、`useLyricsSearch`、`utils/onlineTrack.ts` 均已接入使用。

### 本轮验证结果

- `npm run build` 已通过。
- 已扫描新增职责拆分入口，确认 composable / 工具文件均被引用。
- 本轮只拆分前端职责边界，没有改 Rust 后端、播放返回结构、队列数据结构和歌词解析语义。

### 后续统一处理记录

- 2026-07-21：新增 `useOnlineSearch`，迁移 `App.vue` 在线搜索状态、插件来源、搜索分页、加载更多、搜索错误状态；播放、下载、队列逻辑未改，`npm run build` 通过。
- 2026-07-21：新增 `useQueuePopover`，迁移 `PlayerDock` 播放队列弹层开关、外部点击关闭、当前歌曲定位和队列项点击转发；后端播放队列命令未改，`npm run build` 通过。
- 2026-07-21：新增 `useLyricsDownload`，迁移 `LyricsView` 歌词下载、封面下载、下载标题、下载目录和关联歌词来源展示；歌词解析和应用歌词逻辑未改，`npm run build` 通过。

## App 小状态拆分计划

### 目标

继续收敛 `App.vue` 里低风险、局部状态明显的小职责。只拆状态和计时器/持久化逻辑，不改播放流程、歌词解析、封面缓存、Rust 队列和后端命令。

### 边界

- 不处理 `PlayerDock` 播放进度。
- 不处理 `LyricsView` 歌词滚动和高亮。
- 不处理封面缓存服务化。
- 每一步完成后运行 `npm run build` 并回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 App 小状态拆分计划 | 已完成 | 文档已更新 | 明确本轮只处理低风险 App 局部状态。 |
| 2. 拆分歌词 dock 自动隐藏 | 已完成 | `npm run build` 已通过 | 已抽 `useLyricsDockAutoHide`，收敛 hover、readyToHide、10 秒隐藏计时器。 |
| 3. 拆分在线音质刷新状态 | 已完成 | `npm run build` 已通过 | 已抽 `useOnlineQualityRefresh`，收敛音质选项、当前音质、延迟刷新和请求过期判断。 |
| 4. 拆分搜索历史状态 | 已完成 | `npm run build` 已通过 | 已抽 `useSearchHistory`，收敛读取、保存、数量限制和排除关键词。 |
| 5. 拆分曲库面板宽度拖拽 | 已完成 | `npm run build` 已通过 | 已抽 `useLibraryPanelResize`，收敛宽度持久化、clamp、pointermove/pointerup。 |
| 6. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，引用点已扫描 | 已回写最终验证结果。 |

### 执行记录

- 2026-07-21：写入 App 小状态拆分计划，后续按步骤执行并回写状态。
- 2026-07-21：新增 `useLyricsDockAutoHide`，迁移歌词 dock 自动隐藏 hover 状态、10 秒隐藏计时器和相关 watch；`npm run build` 通过。
- 2026-07-21：新增 `useOnlineQualityRefresh`，迁移在线音质选项、当前音质、延迟刷新和请求过期判断；`npm run build` 通过。
- 2026-07-21：新增 `useSearchHistory`，迁移搜索历史读取、保存、数量限制和排除关键词；`npm run build` 通过。
- 2026-07-21：新增 `useLibraryPanelResize`，迁移曲库面板宽度持久化、宽度 clamp、拖拽事件和退出清理；`npm run build` 通过。

### 本轮验证结果

- `npm run build` 已通过。
- `App.vue` 内旧的在线音质刷新计时器、搜索历史持久化函数、曲库面板拖拽函数已无残留。
- `useLyricsDockAutoHide`、`useOnlineQualityRefresh`、`useSearchHistory`、`useLibraryPanelResize` 均已从 `App.vue` 接入使用。
- 本轮只拆分前端小状态职责，没有修改播放流程、歌词解析、封面缓存、Rust 队列和后端命令。

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

## SettingsView 功能拆分计划

### 目标

按设置页 tab 的真实功能边界拆分 `SettingsView.vue`，让入口文件只保留 tab 编排、公共状态和外部服务调用。每个设置面板独立承载自己的模板结构，暂不改变任何设置项语义和持久化行为。

### 边界

- 不修改 player store 的设置字段和 setter。
- 不改变 MCP、缓存、输出设备等服务调用行为。
- 不迁移到新的状态管理方案。
- 每完成一个步骤运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 SettingsView 拆分计划 | 已完成 | 文档已更新 | 明确按 tab 功能拆，不做业务语义改动。 |
| 2. 拆分通用设置面板 | 已完成 | `npm run build` 已通过 | 已抽 `GeneralSettingsPanel`，承载关闭行为、搜索历史、列表列、右键菜单、语言、下载目录。 |
| 3. 拆分播放设置面板 | 已完成 | `npm run build` 已通过 | 已抽 `PlaybackSettingsPanel`，承载播放过渡、缓存、输出设备、定时关闭、失败策略。 |
| 4. 拆分歌词 / MCP / 插件设置面板 | 已完成 | `npm run build` 已通过 | 已抽 `LyricsSettingsPanel`、`McpSettingsPanel`、`PluginSettingsPanel`。 |
| 5. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，引用点已扫描 | 已回写最终验证结果。 |

### 执行记录

- 2026-07-21：写入 SettingsView 功能拆分计划，后续按步骤执行并回写状态。
- 2026-07-21：新增 `GeneralSettingsPanel`，迁移通用设置 tab 模板和下载目录选择逻辑；`npm run build` 通过。
- 2026-07-21：新增 `PlaybackSettingsPanel`，迁移播放过渡、缓存管理、输出设备、定时关闭和播放失败策略；`npm run build` 通过。
- 2026-07-21：新增 `LyricsSettingsPanel`、`McpSettingsPanel`、`PluginSettingsPanel`，迁移歌词、MCP、插件设置 tab；`npm run build` 通过。
- 2026-07-21：将设置页样式按组件归属迁回各 settings 面板的 scoped style，`SettingsView.vue` 只保留页面壳和兜底 tab 样式；`npm run build` 通过。

### 本轮验证结果

- `npm run build` 已通过。
- `SettingsView.vue` 从 973 行降到 71 行，入口只保留 tab 编排、标题区域、页面壳样式和兜底 tab 样式。
- 已新增 `components/settings/GeneralSettingsPanel.vue`、`PlaybackSettingsPanel.vue`、`LyricsSettingsPanel.vue`、`McpSettingsPanel.vue`、`PluginSettingsPanel.vue`。
- 设置页样式已按组件归属放回各 settings 面板的 scoped style，没有保留单独的全局设置页 CSS。
- 已扫描父组件，通用设置、播放设置、歌词设置、MCP 设置、插件设置相关函数和常量没有继续残留在 `SettingsView.vue`。
- 本轮只拆分设置页前端组件，没有修改 player store、Rust 后端、播放流程、MCP 服务行为和设置字段语义。

## PluginManagerView 功能拆分计划

### 目标

按插件管理页的真实 UI 功能边界拆分 `PluginManagerView.vue`，让入口组件继续负责插件数据加载、安装卸载、拖拽排序和批量动作，子组件只负责展示和事件转发。暂不改变插件服务调用、插件排序、订阅保存和安装卸载语义。

### 边界

- 不修改 `services/plugins.ts`。
- 不修改插件数据结构、订阅结构和安装卸载流程。
- 不改拖拽排序逻辑，只迁移表格模板事件。
- 每完成一个步骤运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 PluginManagerView 拆分计划 | 已完成 | 文档已更新 | 明确只拆 UI 功能块，不改插件业务语义。 |
| 2. 拆分顶部操作和订阅输入区 | 已完成 | `npm run build` 已通过 | 已抽 `PluginManagerActions`、`PluginSubscriptionForm`。 |
| 3. 拆分批量操作区和插件表格 | 已完成 | `npm run build` 已通过 | 已抽 `PluginBulkActions`、`PluginTable`，保留父组件状态和事件处理。 |
| 4. 拆分加载覆盖层并收敛样式 | 已完成 | `npm run build` 已通过 | 已抽 `PluginLoadingOverlay`，并将插件管理页样式按组件迁回 scoped style。 |
| 5. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，引用点已扫描 | 已回写最终验证结果。 |

### 执行记录

- 2026-07-21：写入 PluginManagerView 功能拆分计划，后续按步骤执行并回写状态。
- 2026-07-21：新增 `PluginManagerActions`、`PluginSubscriptionForm`，迁移顶部操作按钮和订阅输入区；`npm run build` 通过。
- 2026-07-21：新增 `PluginBulkActions`、`PluginTable` 和插件行类型文件，迁移批量操作条、插件表格、空状态和行内操作；`npm run build` 通过。
- 2026-07-21：新增 `PluginLoadingOverlay`，迁移添加订阅加载层；插件管理页样式已按组件迁回 scoped style，删除全局 `styles/plugin-manager.css` 引用；`npm run build` 通过。

### 本轮验证结果

- `npm run build` 已通过。
- `PluginManagerView.vue` 从 901 行降到 367 行，入口继续保留插件数据加载、安装卸载、拖拽排序和批量动作。
- 已新增 `components/plugin-manager/PluginManagerActions.vue`、`PluginSubscriptionForm.vue`、`PluginBulkActions.vue`、`PluginTable.vue`、`PluginLoadingOverlay.vue`、`types.ts`。
- 插件管理页样式已按组件归属放回 `PluginManagerView.vue` 和 `components/plugin-manager/*.vue` 的 scoped style，没有保留独立全局 `plugin-manager.css`。
- 已扫描父组件，顶部按钮图标、订阅输入、批量操作、插件表格、空状态和加载覆盖层模板没有继续残留在 `PluginManagerView.vue`。
- 本轮只拆分插件管理页前端组件和样式位置，没有修改插件服务、插件数据结构、订阅保存、安装卸载和拖拽排序语义。

## ThemeView 功能拆分计划

### 目标

按主题页功能边界拆分 `ThemeView.vue`，让入口组件保留主题数据、系统主题监听、导入/安装/选择事件编排；子组件负责本地主题列表、主题市场列表和各自 scoped CSS。拆分时不改变主题变量、主题安装、主题删除和系统主题预览语义。

### 边界

- 不修改 player store 的主题字段和 setter。
- 不修改内置主题变量和市场主题变量。
- 不改变自定义主题导入、删除、安装、使用逻辑。
- CSS 跟随拆出来的组件，避免新增全局主题页 CSS。
- 每完成一个步骤运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 ThemeView 拆分计划 | 已完成 | 文档已更新 | 明确只拆主题页 UI 功能块和 scoped CSS。 |
| 2. 拆分本地主题列表 | 已完成 | `npm run build` 已通过 | 已抽 `LocalThemeGrid`，承载导入卡、内置主题卡、自定义主题卡和本地主题 CSS。 |
| 3. 拆分主题市场列表 | 已完成 | `npm run build` 已通过 | 已抽 `MarketThemeGrid`，承载市场主题卡、下载/使用按钮和市场主题 CSS。 |
| 4. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，引用点已扫描 | 已回写最终验证结果。 |

### 执行记录

- 2026-07-21：写入 ThemeView 功能拆分计划，后续按步骤执行并回写状态。
- 2026-07-21：新增 `components/theme/types.ts`，将主题卡片类型从父组件移出。
- 2026-07-21：新增 `LocalThemeGrid`，迁移导入主题卡、内置主题卡、自定义主题卡和本地主题 scoped CSS；`npm run build` 通过。
- 2026-07-21：新增 `MarketThemeGrid`，迁移主题市场卡、下载/使用按钮和市场主题 scoped CSS；`npm run build` 通过。
- 2026-07-21：`ThemeView.vue` 接入两个主题列表子组件，父组件只保留主题数据、系统主题监听、导入/安装/选择事件编排和页面壳样式；`npm run build` 通过。

### 本轮验证结果

- `npm run build` 已通过。
- `ThemeView.vue` 从 808 行降到 364 行。
- 主题卡片列表模板已迁移到 `components/theme/LocalThemeGrid.vue` 和 `components/theme/MarketThemeGrid.vue`。
- 主题卡片相关 CSS 已跟随各自组件放入 scoped style，没有新增全局主题页 CSS。
- 已扫描 `ThemeView.vue` 和 `components/theme`，父组件没有继续保留 `theme-card`、`theme-card-preview`、`theme-card-actions`、`theme-card-delete` 等卡片模板和样式。
- 本轮只拆分主题页前端组件和样式位置，没有修改 player store、主题变量、自定义主题导入/删除/安装/使用逻辑和系统主题预览语义。
