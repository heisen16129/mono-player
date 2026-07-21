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

## PlayerDock 功能拆分计划

### 目标

按播放栏真实 UI 功能边界拆分 `PlayerDock.vue`。入口组件继续保留播放状态、Rust 后端事件、播放控制和封面桥接；子组件只负责局部 UI 展示和事件转发。拆分时 CSS 跟随拆出的组件放入各自 `<style scoped>`，不新增全局播放栏 CSS。

### 边界

- 不修改 Rust 播放命令和事件监听语义。
- 不修改播放队列、播放状态、进度、封面读取和音量设置行为。
- 每次只拆一个低风险 UI 块，构建通过后回写本文档。
- 本轮优先拆定时关闭控件，因为状态已经由 `useSleepTimer` 承载，模板和样式相对独立。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 PlayerDock 拆分计划 | 已完成 | 文档已更新 | 明确本轮先拆低风险 UI 块，不改播放语义。 |
| 2. 拆分定时关闭控件 | 已完成 | `npm run build` 已通过 | 已抽 `SleepTimerControl`，承载定时关闭按钮、状态浮层、设置弹窗和 scoped CSS。 |
| 3. 拆分音质 / 歌词格式选择控件 | 已完成 | `npm run build` 已通过 | 已抽 `PlaybackOptionControls`，承载音质列表、歌词格式列表和 `.quality-*` scoped CSS。 |
| 4. 拆分音量 / 倍速控制 | 已完成 | `npm run build` 已通过 | 已抽 `VolumeControl`、`PlaybackSpeedControl`，只转发输入事件，不改音量和倍速语义。 |
| 5. 拆分播放队列弹层 | 已完成 | `npm run build` 已通过 | 已抽 `PlaybackQueuePopover`，保留 `useQueuePopover` 和队列事件编排在父组件。 |
| 6. 拆分当前歌曲信息区 | 已完成 | `npm run build` 已通过 | 已抽 `NowPlayingInfo`，只搬封面按钮、标题歌手、时间显示模板和 CSS，封面读取逻辑暂留父组件。 |
| 7. 拆分播放控制区 | 已完成 | `npm run build` 已通过 | 已抽 `TransportControls`，只转发收藏、上一首、播放暂停、下一首、播放模式事件。 |
| 8. 拆分右侧控制区 | 已完成 | `npm run build` 已通过 | 已抽 `PlaybackMetaControls`，承载下载、歌词格式、桌面歌词、定时关闭、倍速、音量、播放队列组合和 scoped CSS。 |
| 9. 评估进度条 / 平滑进度 / 封面缓存 | 已完成 | 本轮不拆 | 这些直接影响播放手感和封面闪烁，暂留 `PlayerDock.vue`，后续单独小步处理。 |
| 10. 构建验证与收尾扫描 | 已完成 | `npm run build` 已通过，父组件残留已扫描 | 已回写最终验证结果。 |

### 执行记录

- 2026-07-21：写入 PlayerDock 功能拆分计划，本轮先处理定时关闭控件。
- 2026-07-21：新增 `components/player-dock/SleepTimerControl.vue`，迁移定时关闭按钮、状态浮层、设置弹窗和对应 scoped CSS；`PlayerDock.vue` 保留 `useSleepTimer` 状态和事件编排。
- 2026-07-21：完成 `npm run build` 验证；普通构建因 Vite/esbuild `spawn EPERM` 被沙箱拦截，提权重跑后构建通过。
- 2026-07-21：新增 `components/player-dock/PlaybackOptionControls.vue`，迁移音质选择、歌词格式选择和 `.quality-*` scoped CSS；`PlayerDock.vue` 只保留标签派生值和事件转发，`npm run build` 通过。
- 2026-07-21：新增 `components/player-dock/PlaybackSpeedControl.vue` 和 `VolumeControl.vue`，迁移倍速弹层、音量弹层和对应 scoped CSS；`PlayerDock.vue` 保留倍速/音量状态更新和 Rust 后端调用，`npm run build` 通过。
- 2026-07-21：新增 `components/player-dock/PlaybackQueuePopover.vue`，迁移播放队列按钮、弹层、队列列表和 `.queue-*` scoped CSS；`PlayerDock.vue` 保留 `useQueuePopover` 状态、定位和播放队列事件编排，`npm run build` 通过。
- 2026-07-21：新增 `components/player-dock/NowPlayingInfo.vue`，迁移当前歌曲封面按钮、标题歌手、当前时间/总时长显示和对应 scoped CSS；封面读取、封面错误处理和总时长派生仍保留在 `PlayerDock.vue`，`npm run build` 通过。
- 2026-07-21：新增 `components/player-dock/TransportControls.vue`，迁移收藏、上一首、播放暂停、下一首、播放模式按钮和对应 scoped CSS；播放控制函数仍保留在 `PlayerDock.vue`，`npm run build` 通过。
- 2026-07-21：新增 `components/player-dock/PlaybackMetaControls.vue`，迁移右侧下载、歌词格式、桌面歌词、定时关闭、倍速、音量、播放队列组合和对应 scoped CSS；`PlayerDock.vue` 保留右侧控制区状态和事件接线，`npm run build` 通过。
- 2026-07-21：评估进度条、平滑进度和封面缓存：它们直接影响播放手感、Rust 状态同步和封面闪烁，本轮暂不拆，后续需要单独计划和手动播放验证。

### 本轮验证结果

- `npm run build` 已通过。
- `PlayerDock.vue` 从 2405 行降到 1006 行。
- 定时关闭模板和 CSS 已迁移到 `components/player-dock/SleepTimerControl.vue`。
- 音质 / 歌词格式选择模板和 `.quality-*` CSS 已迁移到 `components/player-dock/PlaybackOptionControls.vue`。
- 音量 / 倍速弹层模板和 CSS 已迁移到 `components/player-dock/VolumeControl.vue` 和 `PlaybackSpeedControl.vue`。
- 播放队列按钮、弹层、列表模板和 `.queue-*` CSS 已迁移到 `components/player-dock/PlaybackQueuePopover.vue`。
- 当前歌曲封面按钮、标题歌手、时间显示模板和相关 CSS 已迁移到 `components/player-dock/NowPlayingInfo.vue`。
- 播放控制按钮模板和相关 CSS 已迁移到 `components/player-dock/TransportControls.vue`。
- 右侧下载、歌词格式、桌面歌词、定时关闭、倍速、音量、播放队列组合和相关 CSS 已迁移到 `components/player-dock/PlaybackMetaControls.vue`。
- 已扫描 `PlayerDock.vue` 和 `components/player-dock/*.vue`，父组件只保留子组件接线、`useSleepTimer` / `useQueuePopover` 状态、播放控制函数、播放进度、封面读取桥接和必要事件编排，没有继续保留已拆 UI 块的模板和 scoped CSS。
- 本轮只拆分播放栏定时关闭 UI，没有修改 Rust 播放命令、播放队列、播放状态、进度、封面读取和音量设置行为。

## PlayerDock 后续瘦身计划

### 目标

继续降低 `PlayerDock.vue` 体积，但保持播放行为稳定。优先拆低风险 UI 组件；封面缓存、平滑进度、Rust 监听等运行时逻辑后续单独处理，避免把播放、封面和队列问题混在一次改动里。

### 边界

- 不修改 Rust 播放命令、队列语义、上一首/下一首、播放模式同步逻辑。
- 不修改当前播放 Track 状态源。
- 不修改封面读取策略和平滑进度算法。
- CSS 跟随拆出的组件放入各自 `<style scoped>`。
- 每完成一步运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 PlayerDock 后续瘦身计划 | 已完成 | 文档已更新 | 明确先拆低风险 UI，不碰播放运行时语义。 |
| 2. 拆分进度条 UI | 已完成 | `npm run build` 已通过 | 已抽 `PlaybackProgressBar.vue`，只承载 range 模板和 `.dock-progress` scoped CSS，父组件保留 seek 和平滑进度逻辑。 |
| 3. 拆分播放错误提示 UI | 已完成 | `npm run build` 已通过 | 已抽 `PlaybackErrorToast.vue`，只承载错误提示模板、关闭按钮和过渡 CSS，父组件保留错误状态和定时清理。 |
| 4. 迁移剩余 player-dock 全局样式 | 不处理 | 用户要求保留 | `styles/player-dock.css` 继续保留跨状态规则，不迁移到组件。 |
| 5. 评估封面缓存 composable | 已完成 | 已扫描调用点；本步不改代码 | 封面闪烁风险较高，本轮只记录拆分建议，不和 UI 拆分混做。 |

### 执行记录

- 2026-07-21：写入 PlayerDock 后续瘦身计划，后续按步骤逐项执行并回写状态。
- 2026-07-21：新增 `components/player-dock/PlaybackProgressBar.vue`，迁移播放进度条 range 模板和 `.dock-progress` scoped CSS；`PlayerDock.vue` 保留 `progress` 计算、拖动预览、提交 seek、平滑进度和 Rust seek 调用；`npm run build` 通过。
- 2026-07-21：新增 `components/player-dock/PlaybackErrorToast.vue`，迁移播放错误提示模板、关闭按钮、过渡动画和对应 scoped CSS；`PlayerDock.vue` 保留错误状态、错误文案生成、定时清理和错误上报；`npm run build` 通过。
- 2026-07-21：按用户要求回滚 `styles/player-dock.css` 迁移，恢复 `styles.css` import 和 `styles/player-dock.css` 文件；该文件继续承载歌词页热区、歌词页打开时播放栏自动隐藏、封面背景透明等跨状态规则。
- 2026-07-21：完成封面缓存 composable 评估；`PlayerDock.vue` 的封面逻辑同时承担播放栏即时封面、歌词页原图缓存桥接、封面错误兜底和 object URL 生命周期，仍和 `LyricsView`、`TrackCoverThumb`、`FolderCover` 的缓存策略不同。本轮不抽 composable，后续如处理应单独开计划并重点验证切歌封面闪烁。

## PlayerDock 运行时逻辑拆分计划

### 目标

继续降低 `PlayerDock.vue` 体积，把已经稳定的播放运行时逻辑按职责抽成 composable。入口组件保留组件装配、事件接线和少量播放编排；进度、封面、Rust 生命周期等逻辑逐步迁出。

### 边界

- 不修改播放队列、上一首/下一首、播放模式、在线解析和 Rust 命令语义。
- 不修改 UI 视觉结构和已拆出的播放栏子组件。
- 每次只抽一个职责块，构建通过后回写本文档。
- 封面和 Rust 生命周期风险较高，放在进度逻辑之后处理。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 PlayerDock 运行时拆分计划 | 已完成 | 文档已更新 | 明确本轮先拆进度逻辑，不碰队列和封面。 |
| 2. 拆分进度 / 时间逻辑 | 已完成 | `npm run build` 已通过 | 已抽 `usePlayerDockProgress.ts`，收敛当前时间、总时长、进度百分比、平滑进度、拖动预览和提交 seek。 |
| 3. 评估封面逻辑 composable | 已完成 | 已扫描调用点；本步不改代码 | 建议只抽 `usePlayerDockCover`，不合并为通用封面缓存，避免封面闪烁回归。 |
| 4. 拆分 PlayerDock 封面逻辑 | 已完成 | `npm run build` 已通过 | 已抽 `usePlayerDockCover.ts`，只迁移播放栏封面、背景样式、错误兜底、原图缓存桥接和清理逻辑。 |
| 5. 评估 Rust 播放生命周期 composable | 已完成 | 已扫描调用点；本步不改代码 | 可以拆，但建议分两步：先抽 Rust 监听注册/清理，再评估播放状态处理器。 |
| 6. 拆分 Rust 播放监听注册 | 已完成 | `npm run build` 已通过 | 已抽 `useRustPlaybackListeners.ts`，只负责注册和清理 Rust 播放事件监听，事件处理仍留在 `PlayerDock.vue`。 |
| 7. 评估 Rust 播放状态处理器 | 已完成 | 已扫描调用点；本步不改代码 | 可以抽 `useRustPlaybackStateHandler.ts`，但状态源继续由 `PlayerDock.vue` 持有并传入。 |

### 执行记录

- 2026-07-21：写入 PlayerDock 运行时逻辑拆分计划，后续按步骤逐项执行并回写状态。
- 2026-07-21：新增 `composables/usePlayerDockProgress.ts`，迁移 `currentTime`、`runtimeDuration`、总时长标签、进度百分比、平滑进度、拖动预览、提交 seek 和外部 seek 请求处理；`PlayerDock.vue` 保留播放状态、错误提示、Rust 生命周期、封面和队列编排；`npm run build` 通过。
- 2026-07-21：完成封面逻辑评估；`PlayerDock.vue` 的封面逻辑适合单独抽为 `usePlayerDockCover`，但不适合和 `LyricsView`、`TrackCoverThumb`、`FolderCover` 合并为通用封面缓存。原因是播放栏需要即时封面和歌词页原图缓存桥接，歌词页有全图/缩略图引用计数，列表封面有懒加载、并发限制和 LRU 缓存，生命周期不同。后续如实施，只迁移 `PlayerDock` 内部的 `coverUrl`、`dockStyle`、`hasThemeBackground`、封面 watch、错误兜底和 unmount 清理。
- 2026-07-21：按评估结论补充 `usePlayerDockCover.ts` 实施步骤；本步只拆 `PlayerDock` 内部封面逻辑，不合并歌词页和列表封面缓存。
- 2026-07-21：新增 `composables/usePlayerDockCover.ts`，迁移 `coverUrl`、`dockStyle`、`hasThemeBackground`、封面 watch、封面读取、错误兜底、`playerCoverCache` 原图桥接和 unmount 清理；`PlayerDock.vue` 只保留封面展示接线；`npm run build` 通过。
- 2026-07-21：完成 Rust 播放生命周期评估；该逻辑可以继续拆，但不建议一次性抽成大 composable。推荐先抽 `useRustPlaybackListeners.ts`，只负责注册/清理 `state`、`queue`、`advanced`、`ended`、`output-device-fallback` 监听并把事件回调交给 `PlayerDock.vue`；第二步再评估是否抽 `useRustPlaybackStateHandler.ts`。当前风险点是 `sleepTimerStopAfterTrackPending`、`seamlessQueuedSource`、`rustPlaybackStateHoldUntil`、`runtimeDuration`、`spectrumLevels`、`isPlaying`、`rustBackendActive` 和进度同步互相耦合，直接整块迁移容易影响切歌、播完停止、淡出暂停和输出设备回退。
- 2026-07-21：按评估结论补充 `useRustPlaybackListeners.ts` 实施步骤；本步只迁移 Rust 播放事件监听注册和清理，不迁移事件处理逻辑。
- 2026-07-21：新增 `composables/useRustPlaybackListeners.ts`，迁移 `state`、`queue`、`advanced`、`ended`、`output-device-fallback` 监听注册和 unlisten 清理；`PlayerDock.vue` 继续保留 `handleRustPlaybackState`、无缝下一首、睡眠播完停止、输出设备回退和队列快照处理；`npm run build` 通过。
- 2026-07-21：完成 `useRustPlaybackStateHandler.ts` 评估；可以抽，但建议只抽事件处理函数，不迁移状态源。推荐由 `PlayerDock.vue` 继续创建并持有 `isPlaying`、`rustBackendActive`、`rustQueueSnapshot`、`spectrumLevels`、`seamlessQueuedSource`、`rustPlaybackStateHoldUntil`、`sleepTimerStopAfterTrackPending` 和进度 composable 返回值，然后传给 `useRustPlaybackStateHandler`。可迁出的函数包括 `handleRustPlaybackState`、`handleRustAdvanced`、`handleRustEnded`、`handleRustQueue`、`handleRustOutputDeviceFallback`、`isActiveRustPath`、`findQueueTrackBySource`。暂不建议迁移 `resumeAudio`、`togglePlayback`、`stopPlayback`，因为它们属于用户主动播放控制，不是 Rust 事件处理。
## player.ts store 拆分计划

### 目标

降低 `src/stores/player.ts` 的体积和职责密度，但保持 `usePlayerStore()` 对外返回结构不变，先不拆多个 Pinia store，不改播放行为、不改曲库扫描语义、不改主题效果。

### 边界

- 不修改页面调用 `usePlayerStore()` 的方式。
- 不修改 `currentTrack`、`queue`、`playbackMode`、`settings` 等状态源。
- 不迁移播放控制逻辑到其他 store。
- 每完成一步运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 player.ts store 拆分计划 | 已完成 | 文档已更新 | 明确先做低风险纯逻辑拆分，对外 API 不变。 |
| 2. 抽离常量和 normalize 纯函数 | 已完成 | `npm run build` 已通过 | 新建 `src/stores/player/constants.ts`、`normalizers.ts`，迁移 storage key、默认设置、范围常量、持久化数据 normalize、路径去重工具。 |
| 3. 抽离收藏和歌单纯操作辅助函数 | 已完成 | `npm run build` 已通过 | 保持 `favoriteTrackIds`、`settings.playlists` 仍由 `player.ts` 持有，只把 snapshot 和数组更新逻辑拆成 helper。 |
| 4. 评估主题逻辑拆分 | 已完成 | 只评估，不改代码 | 可拆，但不建议马上动。主题逻辑涉及 DOM 变量、系统主题监听、启动背景缓存和设置持久化副作用，应该单独开计划处理。 |
| 5. 评估播放会话逻辑拆分 | 已完成 | 只评估，不改代码 | 可拆，但暂不建议本轮迁移。`persistPlaybackSession` / `restorePlaybackSession` 直接影响重启恢复和队列状态，应在播放恢复专项里处理。 |

### 执行记录

- 2026-07-21：写入 `player.ts` store 拆分计划。本轮先执行第 2 步，只抽常量和 normalize 纯函数。
- 2026-07-21：完成第 2 步。新增 `src/stores/player/constants.ts` 和 `src/stores/player/normalizers.ts`，`player.ts` 从 1096 行降到 843 行；`npm run build` 已通过。
- 2026-07-21：完成第 3 步。新增 `src/stores/player/favorites.ts` 和 `src/stores/player/playlists.ts`，迁移收藏快照、收藏列表解析、收藏切换、歌单增删改和歌单歌曲增删的数组计算逻辑；`player.ts` 降到 767 行；`npm run build` 已通过。
- 2026-07-21：完成第 4 步评估。主题逻辑可以抽成 `usePlayerThemeEffects` 或 `stores/player/theme.ts`，但它同时操作 `settings`、`customThemes`、`cachedSystemThemeState`、DOM CSS 变量、窗口 focus/visibility 监听和启动背景缓存。本轮不继续拆，避免把主题副作用和设置持久化一起改乱。
- 2026-07-21：完成第 5 步评估。播放会话逻辑可以抽 helper，但 `persistPlaybackSession` / `restorePlaybackSession` 与 `currentTrack`、`queue`、`playbackMode`、`usePlaybackSession.ts` 和重启恢复强耦合。本轮不迁移，避免影响之前反复调过的恢复播放行为。

### 本轮验证结果

- `npm run build` 已通过。
- `player.ts` 从 1096 行降到 767 行。
- 新增 `src/stores/player/constants.ts`、`src/stores/player/normalizers.ts`、`src/stores/player/favorites.ts`、`src/stores/player/playlists.ts`。
- 本轮只拆常量、normalize 纯函数、收藏/歌单数组计算 helper；没有修改 `usePlayerStore()` 对外返回结构，没有修改播放控制、重启恢复、主题应用和曲库扫描语义。

## player.ts 主题和播放会话拆分执行计划

### 目标

继续降低 `src/stores/player.ts` 的职责密度，把已经确认可以迁移的主题副作用和播放会话计算逻辑拆到 `src/stores/player/` 子模块中。保持 `usePlayerStore()` 对外返回结构不变，不修改页面调用方式。

### 边界

- 不修改主题字段、主题变量值、自定义主题安装/删除/启用语义。
- 不修改播放会话持久化 key 和恢复结果结构。
- 不修改 `currentTrack`、`queue`、`playbackMode` 的状态归属。
- 每完成一步运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入主题和播放会话拆分执行计划 | 已完成 | 文档已更新 | 明确本轮只迁移主题副作用和播放会话计算，不改外部 API。 |
| 2. 抽离主题副作用控制器 | 已完成 | `npm run build` 已通过 | 新建 `src/stores/player/theme.ts`，迁移 DOM 主题变量、系统主题监听、启动背景缓存和系统主题刷新逻辑。 |
| 3. 抽离播放会话计算 helper | 已完成 | `npm run build` 已通过 | 新建 `src/stores/player/playbackSession.ts`，迁移保存快照和恢复快照的队列计算逻辑，状态写入仍留在 `player.ts`。 |
| 4. 收尾扫描 | 已完成 | `git diff --stat` / 行数扫描 | 已确认主题实现迁移到 `theme.ts`，播放会话计算迁移到 `playbackSession.ts`，`player.ts` 保留状态写入入口。 |

### 执行记录

- 2026-07-21：写入主题和播放会话拆分执行计划。
- 2026-07-21：完成第 2 步。新增 `src/stores/player/theme.ts`，迁移主题变量应用、自定义主题增删、系统主题缓存、系统主题刷新、启动背景缓存和主题切换逻辑；`player.ts` 只保留控制器接线；`npm run build` 已通过。
- 2026-07-21：完成第 3 步。新增 `src/stores/player/playbackSession.ts`，迁移播放会话保存快照和恢复快照的队列计算；`player.ts` 保留 `persistPlaybackSession` / `restorePlaybackSession` 对外入口和状态赋值；`npm run build` 已通过。
- 2026-07-21：完成第 4 步收尾扫描。`player.ts` 当前 490 行；主题实现已迁移到 `theme.ts`，播放会话计算已迁移到 `playbackSession.ts`。扫描确认 `player.ts` 中只保留播放会话对外入口，未继续保留主题变量实现函数。

### 本轮验证结果

- `npm run build` 已通过。
- `player.ts` 从本轮开始前的 767 行降到 490 行。
- 新增 `src/stores/player/theme.ts` 和 `src/stores/player/playbackSession.ts`。
- `usePlayerStore()` 对外返回结构保持不变。
- `currentTrack`、`queue`、`playbackMode` 状态归属保持在 `player.ts`，没有迁移到其他 store。

## 全局 CSS 迁回组件计划

### 目标

继续减少 `src/styles.css` 引入的全局样式体积，把只服务单个组件的 CSS 放回对应 `.vue` 的 `<style scoped>`。保留真正跨组件、跨页面、主题变量和响应式布局类全局样式。

### 边界

- `theme-tokens.css` 先不迁移，继续作为主题变量和主题态覆盖入口。
- `base.css` 只迁单组件私有样式，reset、滚动条、focus、基础按钮继续全局。
- `app-layout.css` 继续承载应用整体 grid、页面布局和跨组件主题背景样式。
- `player-dock.css` 暂时保留，因为它依赖 `mono-window.lyrics-open` 和 `player-dock` 组合状态。
- 每完成一步运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入全局 CSS 迁回组件计划 | 已完成 | 文档已更新 | 明确先迁低风险、单组件 CSS。 |
| 2. 迁移托盘菜单组件样式 | 已完成 | `npm run build` 已通过 | 将 `.tray-menu-*` 样式移入 `TrayMenu.vue` 的 `<style scoped>`，全局只保留 `body.tray-menu-page` 页面级规则。 |
| 3. 评估并拆分 `library.css` | 已完成 | `npm run build` 已通过 | 已按组件归属迁移 `SearchInput`、`LibraryPanel`、`LibraryContentLayout` 相关样式，并删除空的 `library.css` 引入。 |
| 4. 评估 `responsive.css` 可迁移部分 | 已完成 | 只评估，不改代码 | 当前多数规则依赖整体窗口、App grid、歌词页和播放栏组合状态，暂时保留全局；后续如需迁移应按页面专项处理。 |
| 5. 收尾扫描 | 已完成 | `git diff --stat` / 样式引用扫描 | 已确认 `library.css` import 移除、空 CSS 文件删除，`tray-menu.css` 仅保留页面级规则。 |

### 执行记录

- 2026-07-21：写入全局 CSS 迁回组件计划。本轮先执行第 2 步，迁移托盘菜单组件私有样式。
- 2026-07-21：完成第 2 步。`TrayMenu.vue` 已新增 scoped style 承载 `.tray-menu-*` 样式，`styles/tray-menu.css` 只保留 `body.tray-menu-page` / `#app` 页面级规则；`npm run build` 已通过。
- 2026-07-21：完成第 3 步。`SearchInput.vue` 承载 `.search-field` / `.top-search`，`LibraryPanel.vue` 承载曲库侧栏列表、快捷入口、本地文件夹和空文件夹提示样式，`LibraryContentLayout.vue` 承载 `.library-panel` 基础布局和 `library-panel-slide` transition；删除空的 `styles/library.css` 并移除 `styles.css` import；`npm run build` 已通过。
- 2026-07-21：完成第 4 步评估。`responsive.css` 中 `:root` 宽度变量、`.mono-window`、`.app-grid`、页面 grid、`.lyrics-*`、`.player-dock` 和 `.playback-meta` 均是跨组件响应式组合规则；本轮不迁移，避免影响移动宽度布局。后续如需继续拆，应按 `PrimarySidebar`、`LyricsView`、`PlayerDock`、设置页等专项逐步迁移。
- 2026-07-21：完成第 5 步收尾扫描。`src/styles.css` 不再引入 `library.css`，`styles/tray-menu.css` 降为 10 行，仅保留 `body.tray-menu-page` / `#app` 页面级规则；当前全局样式剩余 `theme-tokens.css`、`base.css`、`app-layout.css`、`player-dock.css`、`tray-menu.css`、`responsive.css`。

### 本轮验证结果

- `npm run build` 已通过。
- `styles/library.css` 已删除，样式迁回 `SearchInput.vue`、`LibraryPanel.vue`、`LibraryContentLayout.vue`。
- `styles/tray-menu.css` 从 108 行降到 10 行，托盘菜单私有样式迁回 `TrayMenu.vue`。
- `responsive.css` 本轮只评估不迁移，保留整体窗口和跨组件响应式规则。

## PrimarySidebar 组件拆分计划

### 目标

降低 `src/components/PrimarySidebar.vue` 体积，把侧边栏按真实 UI 区块拆成品牌栏、主导航/歌单栏、底部账号操作栏。父组件继续作为事件装配入口，不改变 `App.vue` 调用 `PrimarySidebar` 的 props 和 emits。

### 边界

- 不修改侧边栏对外 props / emits。
- 不修改导航点击、歌单右键菜单、折叠展开语义。
- 不修改主题变量和全局布局规则。
- 子组件私有 CSS 放到各自 `<style scoped>`。
- 每完成一步运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 PrimarySidebar 拆分计划 | 已完成 | 文档已更新 | 明确只拆 UI 区块，不改父组件对外 API。 |
| 2. 拆分品牌栏 | 已完成 | `npm run build` 已通过 | 新建 `sidebar/SidebarBrand.vue`，迁移 Logo、标题、折叠按钮和品牌区 CSS。 |
| 3. 拆分主导航和歌单导航 | 已完成 | `npm run build` 已通过 | 新建 `sidebar/SidebarNav.vue`，迁移主导航、歌单列表、滚动状态和导航 CSS。 |
| 4. 拆分底部账号操作区 | 已完成 | `npm run build` 已通过 | 新建 `sidebar/SidebarAccount.vue`，迁移账号信息、设置/主题按钮和账号区 CSS。 |
| 5. 收尾扫描 | 已完成 | 行数扫描 / `git diff --stat` | 已确认父组件只保留装配，无遗留已拆模板和样式。 |

### 执行记录

- 2026-07-21：写入 PrimarySidebar 组件拆分计划。
- 2026-07-21：完成第 2 步。新增 `components/sidebar/SidebarBrand.vue`，迁移品牌 Logo、标题、折叠按钮和品牌区 scoped CSS；`PrimarySidebar.vue` 保留外层装配；`npm run build` 已通过。
- 2026-07-21：完成第 3 步。新增 `components/sidebar/SidebarNav.vue`，迁移主导航、歌单导航、创建歌单按钮、歌单滚动状态和导航区 scoped CSS；`PrimarySidebar.vue` 只负责转发导航事件；`npm run build` 已通过。
- 2026-07-21：完成第 4 步。新增 `components/sidebar/SidebarAccount.vue`，迁移账号头像、在线状态、设置/主题按钮和账号区 scoped CSS；`PrimarySidebar.vue` 继续只负责接线；`npm run build` 已通过。
- 2026-07-21：完成第 5 步收尾扫描。`PrimarySidebar.vue` 当前 89 行；新增 `SidebarBrand.vue`、`SidebarNav.vue`、`SidebarAccount.vue`。扫描确认父组件中没有继续保留品牌、导航、歌单列表、账号区模板和样式实现。

### 本轮验证结果

- `npm run build` 已通过。
- `PrimarySidebar.vue` 从 598 行降到 89 行。
- 新增 `src/components/sidebar/SidebarBrand.vue`、`src/components/sidebar/SidebarNav.vue`、`src/components/sidebar/SidebarAccount.vue`。
- `PrimarySidebar` 对外 props / emits 保持不变，`App.vue` 调用方式未修改。

## LyricsView 组件拆分计划

### 目标

降低 `src/components/LyricsView.vue` 体积，先拆低风险 UI 区块，把搜索歌词弹窗、字号/下载菜单、封面展示这类独立视图移到 `src/components/lyrics/` 下。`LyricsView.vue` 继续保留当前播放 Track、歌词解析、高亮、滚动、封面加载和关联歌词等核心状态源，避免再次引入歌词页抖动、切换歌词类型失效或当前播放状态混乱。

### 边界

- 不修改歌词解析、逐字高亮、滚动定位、播放进度同步逻辑。
- 不修改 `activeTrack` / `displayTrack` / `currentLyrics` 等当前播放状态来源。
- 不修改搜索歌词、关联歌词、取消关联歌词的业务语义。
- 子组件第一轮只承载模板和私有 CSS，父组件继续持有状态和处理函数。
- 每完成一步运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入 LyricsView 拆分计划 | 已完成 | 文档已更新 | 明确本轮只做低风险 UI 拆分，不碰歌词核心逻辑。 |
| 2. 拆分搜索歌词弹窗 | 已完成 | `npm run build` 已通过 | 新建 `components/lyrics/LyricsSearchDialog.vue`，迁移弹窗模板和搜索弹窗 scoped CSS，状态和事件仍由父组件传入。 |
| 3. 拆分字号/下载菜单 UI | 已完成 | `npm run build` 已通过 | 新建 `components/lyrics/LyricsActionMenu.vue`，迁移右下角菜单模板和 CSS，菜单开关、字号调整、下载/取消关联处理仍在父组件。 |
| 4. 拆分歌词页封面展示 UI | 已完成 | `npm run build` 已通过 | 新建 `LyricsCoverPanel.vue`，只迁移封面 DOM 和 CSS，封面读取、缓存、asset URL 转换仍在父组件。 |
| 5. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有遗留已拆 CSS 和无用 import；本轮不继续拆 composable。 |

### 执行记录

- 2026-07-21：写入 LyricsView 组件拆分计划。本轮先执行第 2 步，拆搜索歌词弹窗；暂不触碰歌词滚动、高亮、封面加载和当前播放状态源。
- 2026-07-21：完成第 2 步。新增 `components/lyrics/LyricsSearchDialog.vue`，迁移搜索歌词弹窗模板、搜索结果列表和对应 scoped CSS；`LyricsView.vue` 继续持有 `useLyricsSearch` 状态、搜索提交、滚动加载和应用歌词逻辑；`npm run build` 已通过。
- 2026-07-21：完成第 3 步。新增 `components/lyrics/LyricsActionMenu.vue`，迁移歌词页右下角字号、下载封面、下载歌词、搜索歌词、同步歌词和取消关联菜单模板及 scoped CSS；`LyricsView.vue` 继续持有菜单开关、定位、字号调整和下载/关联处理逻辑；`npm run build` 已通过。
- 2026-07-21：完成第 4 步。新增 `components/lyrics/LyricsCoverPanel.vue`，迁移歌词页封面展示 DOM、默认封面和封面展示 scoped CSS；`LyricsView.vue` 继续持有 `displayCoverUrl`、封面读取、封面缓存和错误兜底逻辑；`npm run build` 已通过。
- 2026-07-21：完成第 5 步收尾扫描。`LyricsView.vue` 当前 1251 行；新增 `LyricsSearchDialog.vue`、`LyricsActionMenu.vue`、`LyricsCoverPanel.vue`。扫描确认父组件中没有继续保留搜索弹窗、菜单、封面展示的 CSS 和组件 import；`.lyrics-font-menu` 仅保留在点击外部关闭判断中。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从约 1372 行降到 1251 行。
- 新增 `src/components/lyrics/LyricsSearchDialog.vue`、`src/components/lyrics/LyricsActionMenu.vue`、`src/components/lyrics/LyricsCoverPanel.vue`。
- 本轮只拆 UI 模板和 scoped CSS；歌词解析、高亮、滚动、封面读取、歌词搜索状态和关联歌词逻辑仍由 `LyricsView.vue` 持有。

## LyricsView 歌词面板拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 体积，把歌词列表渲染、空状态、加载提示、滚动条和同步按钮这块面板 UI 拆到 `src/components/lyrics/LyricsPanel.vue`。父组件继续持有歌词行数据、当前行计算、逐字进度、滚动控制和 seek 逻辑，避免改变歌词高亮、滚动定位和播放同步行为。

### 边界

- 不修改 `activeLyricIndex`、`activeLyricWordIndex`、`lyricWordProgress`、`scrollToActiveLyric`、`syncScrollThumb` 等核心逻辑。
- 不修改歌词加载、搜索歌词、关联歌词和取消关联歌词语义。
- `LyricsPanel.vue` 只接收 props 和转发事件，不创建新的歌词状态源。
- 组件私有 CSS 放到 `LyricsPanel.vue` 的 `<style scoped>`。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入歌词面板拆分计划 | 已完成 | 文档已更新 | 明确本轮只拆面板 UI，不迁移歌词高亮和滚动算法。 |
| 2. 拆分 `LyricsPanel.vue` | 已完成 | `npm run build` 已通过 | 迁移歌词列表模板、空状态、加载提示、滚动条、同步按钮和对应 scoped CSS。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有遗留已拆面板 CSS 和无用 import。 |

### 执行记录

- 2026-07-21：写入 LyricsView 歌词面板拆分计划。本轮只拆歌词面板 UI，父组件继续持有歌词高亮、滚动和 seek 逻辑。
- 2026-07-21：完成第 2 步。新增 `components/lyrics/LyricsPanel.vue`，迁移歌词列表渲染、空状态、加载提示、滚动条、同步按钮和对应 scoped CSS；`LyricsView.vue` 继续持有 `activeLyricIndex`、`lyricWordProgress`、滚动定位、浏览恢复、seek 和同步偏移逻辑；`npm run build` 已通过。
- 2026-07-21：完成第 3 步收尾扫描。`LyricsView.vue` 当前 1004 行；新增 `LyricsPanel.vue` 当前 304 行。扫描确认父组件中没有继续保留歌词面板 CSS 和 `EmptyState` import；`.lyrics-panel .current` 仅保留在滚动定位查询中，`lyricWordProgress` 仅作为子组件 prop 传入。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 1251 行降到 1004 行。
- 新增 `src/components/lyrics/LyricsPanel.vue`。
- 本轮只拆歌词面板 UI 和 scoped CSS；歌词高亮、滚动定位、seek、同步偏移和当前播放状态源仍由 `LyricsView.vue` 持有。

## LyricsView 顶部栏拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 模板和样式体积，把歌词页顶部关闭按钮、全屏按钮、歌曲标题、歌手和专辑信息拆到 `src/components/lyrics/LyricsHeaderBar.vue`。父组件继续持有窗口全屏状态、关闭逻辑、当前 Track 和国际化文本来源。

### 边界

- 不修改 `closeLyricsView`、`toggleLyricsFullscreen`、`updateFullscreenState` 等窗口行为。
- 不修改当前播放 Track 状态源，只把展示文本作为 props 传入。
- 不修改歌词面板、封面、右键菜单、搜索歌词和滚动逻辑。
- 顶部栏私有 CSS 放到 `LyricsHeaderBar.vue` 的 `<style scoped>`。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入顶部栏拆分计划 | 已完成 | 文档已更新 | 明确本轮只拆顶部 UI，不迁移窗口行为。 |
| 2. 拆分 `LyricsHeaderBar.vue` | 已完成 | `npm run build` 已通过 | 迁移关闭按钮、全屏按钮、标题区模板和对应 scoped CSS。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有遗留顶部栏 CSS 和无用 icon import。 |

### 执行记录

- 2026-07-21：写入 LyricsView 顶部栏拆分计划。本轮只拆顶部展示 UI，父组件继续持有关闭、全屏和当前 Track 状态。
- 2026-07-21：完成第 2 步。新增 `components/lyrics/LyricsHeaderBar.vue`，迁移关闭按钮、全屏按钮、歌曲标题、歌手/专辑展示和对应 scoped CSS；`LyricsView.vue` 继续持有 `closeLyricsView`、`toggleLyricsFullscreen`、`isFullscreen` 和当前 Track 文案来源；`npm run build` 已通过。
- 2026-07-21：完成第 3 步收尾扫描。`LyricsView.vue` 当前 948 行；新增 `LyricsHeaderBar.vue` 当前 90 行。扫描确认父组件中没有继续保留 `ChevronDown`、`Maximize2`、`Minimize2` import，也没有遗留 `.lyrics-close`、`.lyrics-fullscreen`、`.lyrics-heading` CSS。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 1004 行降到 948 行。
- 新增 `src/components/lyrics/LyricsHeaderBar.vue`。
- 本轮只拆顶部栏 UI 和 scoped CSS；关闭、全屏、当前 Track 和国际化文案来源仍由 `LyricsView.vue` 持有。

## LyricsView 右键菜单逻辑拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 的状态和函数数量，把歌词页右键菜单的打开/关闭、菜单坐标、字号调整和同步歌词入口拆到 `src/composables/useLyricsActionMenu.ts`。父组件继续负责下载封面/歌词、搜索歌词、取消关联歌词和 Teleport 挂载结构。

### 边界

- 不修改 `LyricsActionMenu.vue` 的模板和 Teleport 位置，避免再次影响右键菜单显示。
- 不修改下载封面、下载歌词、搜索歌词、取消关联歌词逻辑。
- 不修改歌词高亮、滚动、封面读取和当前播放状态源。
- composable 只接收必要依赖：字号 getter/setter、关闭搜索前置逻辑、滚动到当前歌词回调。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入右键菜单逻辑拆分计划 | 已完成 | 文档已更新 | 明确本轮只拆菜单状态和局部控制函数。 |
| 2. 拆分 `useLyricsActionMenu.ts` | 已完成 | `npm run build` 已通过 | 迁移 `isFontMenuOpen`、菜单坐标、字号调整、同步歌词入口和外部点击关闭判断。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有保留已迁移菜单状态和函数。 |

### 执行记录

- 2026-07-21：写入 LyricsView 右键菜单逻辑拆分计划。本轮只拆右键菜单状态和局部控制函数，不调整菜单 Teleport 结构。
- 2026-07-21：完成第 2 步。新增 `composables/useLyricsActionMenu.ts`，迁移右键菜单开关、坐标计算、外部点击关闭、字号增减、同步歌词入口和歌词同步偏移逻辑；`LyricsView.vue` 继续持有 `LyricsActionMenu` Teleport、下载封面/歌词、搜索歌词和取消关联歌词逻辑；`npm run build` 已通过。
- 2026-07-21：完成第 3 步收尾扫描。`LyricsView.vue` 当前 919 行；新增 `useLyricsActionMenu.ts` 当前 72 行。扫描确认父组件中没有继续保留 `MIN_LYRIC_FONT_SIZE`、`MAX_LYRIC_FONT_SIZE`、菜单坐标 ref 和已迁移的菜单控制函数。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 948 行降到 919 行。
- 新增 `src/composables/useLyricsActionMenu.ts`。
- 本轮只拆右键菜单状态和局部控制逻辑；菜单 Teleport、下载、搜索、取消关联、歌词高亮和滚动逻辑保持原归属。

## LyricsView 全屏窗口逻辑拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 的窗口控制逻辑，把歌词页全屏状态、进入/退出全屏、关闭歌词页时恢复窗口状态拆到 `src/composables/useLyricsFullscreen.ts`。父组件继续负责渲染顶部栏并在关闭后发出 `close` 事件。

### 边界

- 不修改顶部栏 UI 和按钮事件语义。
- 不修改歌词播放、歌词滚动、封面读取、右键菜单和搜索歌词逻辑。
- 不修改 Tauri 窗口 API 调用顺序，只迁移已有逻辑。
- composable 内部负责 unmount 时退出全屏和恢复最大化状态。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入全屏窗口逻辑拆分计划 | 已完成 | 文档已更新 | 明确本轮只迁移已有窗口控制逻辑。 |
| 2. 拆分 `useLyricsFullscreen.ts` | 已完成 | `npm run build` 已通过 | 迁移 `isFullscreen`、`updateFullscreenState`、`toggleLyricsFullscreen` 和关闭前退出全屏逻辑。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有保留已迁移窗口状态和 Tauri 窗口 import。 |

### 执行记录

- 2026-07-21：写入 LyricsView 全屏窗口逻辑拆分计划。本轮只迁移窗口控制逻辑，不调整顶部栏 UI。
- 2026-07-21：完成第 2 步。新增 `composables/useLyricsFullscreen.ts`，迁移全屏状态、Tauri 窗口全屏切换、最大化恢复、关闭前退出全屏和 unmount 清理逻辑；`LyricsView.vue` 继续负责顶部栏渲染和关闭后 emit `close`；`npm run build` 已通过。
- 2026-07-21：完成第 3 步收尾扫描。`LyricsView.vue` 当前 878 行；新增 `useLyricsFullscreen.ts` 当前 61 行。扫描确认父组件中没有继续保留 `getCurrentWindow` import、`restoreMaximizedAfterFullscreen`、`setFullscreen`、`maximize`、`unmaximize` 和已迁移的全屏控制函数。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 919 行降到 878 行。
- 新增 `src/composables/useLyricsFullscreen.ts`。
- 本轮只拆全屏窗口控制逻辑；顶部栏 UI、关闭事件、歌词播放、歌词滚动、封面和右键菜单逻辑保持原归属。

## LyricsView 封面逻辑拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 的方法数量，把歌词页封面状态、封面缓存、封面读取、封面错误兜底和封面背景样式计算拆到 `src/composables/useLyricsCover.ts`。父组件继续负责歌词加载 watch、搜索歌词应用、取消关联歌词和当前 Track 状态来源。

### 边界

- 不修改封面读取顺序：仍然优先使用 `activeTrack.artwork`，再使用播放器原图缓存，再使用歌词页缓存/缩略图/原图。
- 不修改歌词加载 watch 的触发条件和歌词解析流程，只把封面操作替换成 composable 方法。
- 不修改 `LyricsCoverPanel.vue` 的展示逻辑和 `LyricsView.vue` 的整体布局。
- 保留现有 object URL 回收、引用计数、请求版本防旧请求写回逻辑。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入封面逻辑拆分计划 | 已完成 | 文档已更新 | 明确本轮只迁移封面状态和缓存方法。 |
| 2. 拆分 `useLyricsCover.ts` | 已完成 | `npm run build` 已通过 | 迁移封面缓存、读取、展示 URL、背景 URL、错误兜底和清理逻辑。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有保留已迁移封面缓存工具和无用 import。 |

### 执行记录

- 2026-07-22：写入 LyricsView 封面逻辑拆分计划。本轮只迁移封面状态和缓存方法，不调整歌词加载 watch 的触发条件。
- 2026-07-22：完成第 2 步。新增 `composables/useLyricsCover.ts`，迁移歌词页封面状态、展示 URL、背景 URL、播放器原图缓存兜底、歌词页封面缓存、缩略图/原图读取、object URL 回收、封面错误兜底和清理逻辑；`LyricsView.vue` 继续保留歌词加载 watch、搜索歌词应用和取消关联歌词流程，只调用 composable 方法更新封面；`npm run build` 已通过。
- 2026-07-22：完成第 3 步收尾扫描。`LyricsView.vue` 当前 652 行；新增 `useLyricsCover.ts` 当前 299 行。扫描确认父组件中没有继续保留 `readCover`、`readCoverThumbnail`、`coverImageObjectUrl`、`usableArtworkDisplaySrc`、`getPlayerOriginalCoverCache`、`playerCoverCacheKey` 和封面缓存工具函数；父组件只保留 `displayCoverUrl`、`backgroundCoverUrl`、`handleCoverError` 等 composable 返回值接线。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 878 行降到 652 行。
- 新增 `src/composables/useLyricsCover.ts`。
- 本轮只拆封面状态、缓存和读取逻辑；歌词加载 watch 的触发条件、歌词解析、搜索歌词应用和布局展示保持原归属。

## LyricsView 歌词滚动逻辑拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 的方法数量，把歌词面板滚动定位、手动浏览、滚动条显示、恢复实时歌词和点击歌词 seek 的局部逻辑拆到 `src/composables/useLyricsScroll.ts`。父组件继续持有歌词行、当前高亮行、歌词同步偏移和外部 seek 事件。

### 边界

- 不修改 `activeLyricIndex`、逐字高亮、播放时间平滑和歌词解析逻辑。
- 不修改 `LyricsPanel.vue` 的模板和事件名。
- 不修改点击歌词 seek 的时间计算，只把 emit 包装为回调传入 composable。
- 保留当前滚动行为：加载后自动滚动、高亮变化时滚动、滚轮浏览后 900ms 恢复。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入歌词滚动逻辑拆分计划 | 已完成 | 文档已更新 | 明确本轮只迁移滚动、浏览恢复和 seek 包装逻辑。 |
| 2. 拆分 `useLyricsScroll.ts` | 已完成 | `npm run build` 已通过 | 迁移 `lyricsPanel`、`isBrowsingLyrics`、`scrollThumbTop`、滚动定位、浏览恢复、滚动条和 seek 包装。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有保留已迁移滚动方法和无用 import。 |

### 执行记录

- 2026-07-22：写入 LyricsView 歌词滚动逻辑拆分计划。本轮只迁移滚动、浏览恢复和 seek 包装逻辑，不调整歌词高亮算法。
- 2026-07-22：完成第 2 步。新增 `composables/useLyricsScroll.ts`，迁移歌词面板 ref、手动浏览状态、滚动条位置、滚动到当前歌词、滚轮浏览、900ms 恢复实时歌词、滚动条同步、点击歌词 seek 和高亮变化 watch；`LyricsView.vue` 继续持有歌词行、当前高亮行、歌词同步偏移和外部 `seek` emit；`npm run build` 已通过。
- 2026-07-22：完成第 3 步收尾扫描。`LyricsView.vue` 当前 578 行；新增 `useLyricsScroll.ts` 当前 129 行。扫描确认父组件中没有继续保留 `syncLyricsToCurrentTime`、`scrollToActiveLyric`、`beginLyricBrowse`、`handleLyricsWheel`、`restoreRealtimeLyrics`、`syncScrollThumb`、`seekToLyric` 等滚动方法，也没有保留 `nextTick` / `useScrollingState` import。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 652 行降到 578 行。
- 新增 `src/composables/useLyricsScroll.ts`。
- 本轮只拆滚动、浏览恢复和 seek 包装逻辑；歌词解析、逐字高亮、搜索歌词应用和封面逻辑保持原归属。

## LyricsView 歌词高亮逻辑拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 的方法数量，把歌词当前行计算、逐字高亮进度、播放时间平滑和动画帧循环拆到 `src/composables/useLyricsHighlight.ts`。父组件继续负责加载歌词行、歌词解析、搜索歌词应用和把高亮结果传给 `LyricsPanel.vue`。

### 边界

- 不修改当前行计算规则：仍按 `syncedLyricTime` 找最后一个小于等于当前时间的歌词行。
- 不修改逐字高亮规则和 `0.45s` 默认边界兜底。
- 不修改播放时间平滑节奏和 `requestAnimationFrame` 循环方式。
- 不修改歌词加载 watch、滚动逻辑、封面逻辑和搜索歌词逻辑。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入歌词高亮逻辑拆分计划 | 已完成 | 文档已更新 | 明确本轮只迁移高亮计算和动画帧循环。 |
| 2. 拆分 `useLyricsHighlight.ts` | 已完成 | `npm run build` 已通过 | 迁移 `smoothCurrentTime`、`activeLyricIndex`、逐字进度、播放时间 watch 和动画帧清理。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有保留已迁移高亮方法和动画帧变量。 |

### 执行记录

- 2026-07-22：写入 LyricsView 歌词高亮逻辑拆分计划。本轮只迁移高亮计算和动画帧循环，不调整高亮算法。
- 2026-07-22：完成第 2 步。新增 `composables/useLyricsHighlight.ts`，迁移平滑播放时间、当前高亮行计算、逐字高亮进度、逐字边界计算、播放时间 watch、`requestAnimationFrame` 循环和 unmount 清理；`LyricsView.vue` 继续负责加载歌词行并把 `activeLyricIndex` / `lyricWordProgress` 传给 `LyricsPanel.vue`；`npm run build` 已通过。
- 2026-07-22：完成第 3 步收尾扫描。`LyricsView.vue` 当前 500 行；新增 `useLyricsHighlight.ts` 当前 111 行。扫描确认父组件中没有继续保留 `activeLyricWordIndex`、`nextLyricBoundary`、`lyricWordProgress`、`tickLyricAnimation`、`smoothCurrentTime`、`syncedLyricTime`、动画帧变量和播放时间 watch。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 578 行降到 500 行。
- 新增 `src/composables/useLyricsHighlight.ts`。
- 本轮只拆高亮计算和动画帧循环；歌词加载、搜索歌词应用、封面逻辑、滚动逻辑和布局展示保持原归属。

## LyricsView 当前歌曲歌词加载逻辑拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 的方法数量，把当前播放 Track 变化后的歌词加载 watch、歌词解析、加载状态、封面预加载串联逻辑拆到 `src/composables/useLyricsTrackLoader.ts`。父组件继续持有歌词行 ref、封面 composable、滚动 composable 和当前 Track 状态来源。

### 边界

- 不修改 watch 触发条件：仍监听 Track identity、path、title、artist、artwork、lyrics、format 和 coverVersion。
- 不修改歌词解析策略：Tauri 环境继续走 `resolveLyricsSource`，非 Tauri 继续走 `parseRawLyrics`。
- 不修改封面预加载顺序和旧请求防写回逻辑。
- 不修改搜索歌词应用、取消关联歌词和右键菜单逻辑。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入当前歌曲歌词加载逻辑拆分计划 | 已完成 | 文档已更新 | 明确本轮只迁移当前 Track 加载 watch 和解析流程。 |
| 2. 拆分 `useLyricsTrackLoader.ts` | 已完成 | `npm run build` 已通过 | 迁移歌词加载 watch、请求 id、歌词解析、加载状态和封面预加载串联。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有保留已迁移加载 watch 和解析 helper。 |

### 执行记录

- 2026-07-22：写入 LyricsView 当前歌曲歌词加载逻辑拆分计划。本轮只迁移当前 Track 加载 watch 和解析流程，不调整触发条件。
- 2026-07-22：完成第 2 步。新增 `composables/useLyricsTrackLoader.ts`，迁移当前 Track 变化 watch、请求 id、防旧请求写回、歌词解析、加载状态、同步歌词状态重置、封面预加载串联和 `normalizeLyricLines`；`LyricsView.vue` 继续持有歌词行 ref、封面 composable、滚动 composable 和搜索歌词应用流程；`npm run build` 已通过。
- 2026-07-22：完成第 3 步收尾扫描。`LyricsView.vue` 当前 460 行；新增 `useLyricsTrackLoader.ts` 当前 104 行。扫描确认父组件中没有继续保留 `lyricsLoadRequestId`、当前歌曲加载 `watch`、加载流程里的 `loadLyricsCoverThumbnail` / `loadLyricsCover` 调用和 `normalizeLyricLines` 本地实现。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 500 行降到 460 行。
- 新增 `src/composables/useLyricsTrackLoader.ts`。
- 本轮只拆当前歌曲歌词加载 watch 和解析流程；搜索歌词应用、取消关联歌词、封面 composable、滚动 composable 和布局展示保持原归属。

## LyricsView 歌词关联逻辑拆分计划

### 目标

继续降低 `src/components/LyricsView.vue` 的方法数量，把搜索歌词结果应用、搜索状态错误处理、关联歌词写回事件和取消关联歌词逻辑拆到 `src/composables/useLyricsAssociation.ts`。父组件继续负责提供当前 Track、歌词搜索状态、封面更新方法、滚动方法和 emit 接线。

### 边界

- 不修改搜索歌词弹窗 UI 和 `useLyricsSearch` 的分页/搜索状态。
- 不修改插件歌词元数据读取方式，继续使用 `getPluginLyricsMetadata`。
- 不修改歌词解析策略：Tauri 环境继续走 `resolveLyricsSource`，非 Tauri 继续走 `parseRawLyrics`。
- 不修改 `lyricsFound` / `lyricsCleared` 事件参数结构。
- 完成后运行 `npm run build`，通过后回写本文档。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入歌词关联逻辑拆分计划 | 已完成 | 文档已更新 | 明确本轮只迁移搜索结果应用和取消关联逻辑。 |
| 2. 拆分 `useLyricsAssociation.ts` | 已完成 | `npm run build` 已通过 | 迁移搜索默认 query、`applyPluginLyrics`、`clearAssociatedLyrics` 和解析 helper。 |
| 3. 收尾扫描 | 已完成 | 行数扫描 / 引用扫描 | 已确认 `LyricsView.vue` 没有保留已迁移歌词关联方法和无用 import。 |

### 执行记录

- 2026-07-22：写入 LyricsView 歌词关联逻辑拆分计划。本轮只迁移搜索结果应用和取消关联逻辑，不调整事件结构。
- 2026-07-22：完成第 2 步。新增 `composables/useLyricsAssociation.ts`，迁移搜索默认 query、插件歌词元数据读取、歌词结果应用、搜索错误状态、关联歌词写回事件、取消关联歌词和解析 helper；`LyricsView.vue` 继续持有搜索弹窗状态、歌词行 ref、封面 composable 和 emit 接线；`npm run build` 已通过。
- 2026-07-22：完成第 3 步收尾扫描。`LyricsView.vue` 当前 410 行；新增 `useLyricsAssociation.ts` 当前 101 行。扫描确认父组件中没有继续保留 `defaultLyricSearchQuery`、`applyPluginLyrics`、`clearAssociatedLyrics`、`getPluginLyricsMetadata`、`artworkDisplaySrc`、`getErrorMessage`、`parseRawLyrics`、`resolveLyricsSource` 和 `PluginSearchTrack` import。

### 本轮验证结果

- `npm run build` 已通过。
- `LyricsView.vue` 从 460 行降到 410 行。
- 新增 `src/composables/useLyricsAssociation.ts`。
- 本轮只拆搜索歌词结果应用和取消关联逻辑；搜索弹窗状态、当前 Track、封面 composable、滚动 composable 和布局展示保持原归属。
## LyricsView 全屏入口迁移计划

### 目标

把歌词页右上角的全屏按钮迁移到歌词页右键菜单中，避免顶部按钮继续占用页面视觉空间。全屏状态和 Tauri 全屏逻辑仍然复用 `useLyricsFullscreen.ts`，本轮只调整入口位置。

### 边界

- 不修改全屏实现逻辑，只迁移 UI 入口。
- 不修改歌词滚动、歌词高亮、歌词加载和封面逻辑。
- 不新增额外弹窗或快捷键。

### 执行步骤

| 步骤 | 状态 | 验证方式 | 说明 |
| --- | --- | --- | --- |
| 1. 写入全屏入口迁移计划 | 已完成 | 文档已更新 | 明确本轮只把全屏入口从顶部按钮移到右键菜单。 |
| 2. 移除顶部全屏按钮 | 已完成 | 代码扫描 | `LyricsHeaderBar.vue` 已移除全屏按钮、全屏图标 import 和相关样式。 |
| 3. 右键菜单接入全屏操作 | 已完成 | 代码扫描 | `LyricsActionMenu.vue` 新增 `全屏显示` / `退出全屏` 菜单项，并通过 `toggleFullscreen` 事件回传。 |
| 4. 父组件接线 | 已完成 | 代码扫描 | `LyricsView.vue` 传入 `isFullscreen`，右键菜单点击后调用 `toggleLyricsFullscreen()` 并关闭菜单。 |
| 5. 构建验证 | 已完成 | `npm run build` 已通过 | 最新代码构建通过。 |

### 执行记录

- 2026-07-22：完成歌词页全屏入口迁移。顶部右侧不再显示全屏按钮；歌词页右键菜单里新增 `全屏显示` / `退出全屏`，继续复用原来的 `useLyricsFullscreen.ts`。
