# 文件拆分说明

## 拆分目标

本次拆分的目标不是为了让文件数量变多，而是把代码放回真实项目里更自然的职责边界：

- 入口文件只负责装配，不承载具体业务实现。
- 后端按数据库、扫描、歌词、封面、主题、托盘、系统打开等业务域拆分。
- 前端根组件保留页面编排职责，把弹窗、菜单、组合式逻辑、服务封装、工具函数拆出去。
- 组件私有样式放回对应 `.vue` 文件的 `<style scoped>`，全局样式只保留主题 token、基础样式、跨组件布局和响应式规则。

## 当前拆分结构

后端结构：

```text
src-tauri/src/
  lib.rs        # Tauri 装配层：setup、tray 初始化、invoke_handler
  state.rs      # AppState
  models.rs     # Track、LyricLine、CoverImage、主题导入 DTO
  database.rs   # SQLite 初始化、曲目读写、缺失曲目清理
  scanner.rs    # 音乐目录扫描、扫描 worker、音频元数据读取
  lyrics.rs     # 歌词文件查找和 LRC 解析
  covers.rs     # 内嵌封面和本地封面读取
  themes.rs     # 主题包导入、桌面壁纸取色、主题变量校验
  tray.rs       # 托盘窗口、托盘动作、主窗口隐藏/显示
  shell.rs      # 在系统文件管理器中打开歌曲位置
```

前端结构：

```text
src/
  App.vue                         # 应用编排层，连接 store、composables 和页面组件
  components/
    AddToPlaylistDialog.vue       # 添加到歌单弹窗，含私有样式
    ArtistsView.vue               # 艺术家视图，含私有样式
    CollectionHero.vue            # 曲库/收藏/最近播放等集合页共用头部，含私有样式
    FolderCover.vue               # 文件夹/专辑封面，含私有样式
    LyricsView.vue                # 歌词页，含私有样式
    PlayerDock.vue                # 底部播放器，含播放器主体私有样式
    PlaylistContextMenu.vue       # 歌单右键菜单，含私有样式
    PlaylistDialog.vue            # 创建/重命名歌单弹窗，含私有样式
    PrimarySidebar.vue            # 主侧边栏，含私有样式
    ScanDialog.vue                # 扫描目录弹窗，含私有样式
    SettingsView.vue              # 设置页，含私有样式
    ThemeView.vue                 # 主题页，含私有样式
    TrackContextMenu.vue          # 歌曲右键菜单，含私有样式
    TrackTable.vue                # 曲库/艺术家等页面共用歌曲列表，含私有样式
    WorkspaceView.vue             # 曲库工作区，含私有样式
  composables/
    useLibraryNavigation.ts       # 曲库/收藏/文件夹/艺术家/设置/主题导航状态
    usePlaybackSession.ts         # 播放进度保存、恢复、卸载前持久化
    usePlaylistActions.ts         # 歌单弹窗、右键菜单、添加/移除/重命名/删除歌单
    useScanFolders.ts             # 扫描目录弹窗、目录选择、批量扫描
    useSidebarCollapse.ts         # 侧边栏宽度自适应折叠
    useTrayIntegration.ts         # 窗口关闭策略、托盘菜单事件、托盘标题同步
  services/music.ts               # Tauri 音乐/主题/托盘命令封装
  utils/path.ts                   # 路径规范化、文件夹标题
  utils/windowDrag.ts             # 自定义窗口拖拽命中判断
  styles.css                      # 样式入口，只保留 @import 顺序
  styles/
    theme-tokens.css              # CSS 变量、内置主题 token、主题专属覆盖
    base.css                      # html/body/button/input/通用按钮等基础样式
    app-layout.css                # 主窗口、网格布局、页面切换、跨组件背景
    library.css                   # 曲库和工作区共享搜索栏/空状态/列表基础规则
    player-dock.css               # 播放器与 App 父级联动的全局规则
    tray-menu.css                 # 托盘菜单页面
    responsive.css                # 跨页面响应式规则
```

## 本轮完成的后续拆分

1. `App.vue` 继续拆组合式逻辑。
   - `useLibraryNavigation` 接管页面导航和视图状态。
   - `usePlaylistActions` 接管歌单弹窗、右键菜单和歌单操作。
   - `usePlaybackSession` 接管播放会话保存和恢复。
   - `useTrayIntegration` 接管托盘事件、关闭策略和托盘标题同步。
   - `useScanFolders` 接管扫描目录弹窗和目录选择。
   - `useSidebarCollapse` 接管侧边栏自适应折叠。

2. `src/stores/player.ts` 补齐 store action。
   - 新增 `renamePlaylist`。
   - 新增 `deletePlaylist`。
   - 增强 `createPlaylist(name, trackIds)`，支持创建歌单时直接带入歌曲。
   - 新增 `recordRecentlyPlayed`，让最近播放持久化回到 store 内部。

3. 样式继续迁回组件。
   - `PrimarySidebar.vue` 接管主侧边栏样式。
   - `LyricsView.vue` 接管歌词页样式。
   - `PlayerDock.vue` 接管播放器主体、音量、队列样式。
   - `SettingsView.vue` 接管设置页样式。
   - `ThemeView.vue` 接管主题页样式。
   - `WorkspaceView.vue` 接管曲库工作区和曲目表样式。
   - `CollectionHero.vue` 接管曲库、收藏、最近添加、最近播放等集合页共用头部模板和样式。
   - `TrackTable.vue` 接管曲库、收藏、最近添加、最近播放、艺术家详情共用歌曲列表模板和样式。
   - `ArtistsView.vue` 接管艺术家列表和艺术家详情布局样式。
   - `FolderCover.vue` 接管封面样式。
   - 弹窗和右键菜单组件已经各自接管 `<style scoped>`。

4. 全局 CSS 保留必要边界。
   - `theme-tokens.css` 必须全局存在，因为主题变量和主题覆盖依赖 `:root[data-theme]`。
   - `app-layout.css` 保留主窗口 grid、歌词/曲库切换、跨组件背景和父级状态选择器。
   - `library.css` 保留曲库与工作区共享的搜索栏、空状态、列表基础规则。
   - `player-dock.css` 只保留播放器与 `App.vue` 父级状态联动的规则，例如歌词页自动隐藏热区。
   - `responsive.css` 保留跨页面响应式规则，避免每个组件重复维护同一断点。

## 拆分原则

- 能明确归属某个组件的模板和样式，放到对应 `.vue` 文件。
- 会被多个页面或父级状态共同影响的规则，保留在全局样式文件。
- 业务状态按 composable 拆，不按“函数数量”机械拆。
- store 内部能持久化的数据，优先通过 store action 修改，避免页面层直接写 localStorage。
- 每次迁移后立即跑 `npm run build` 或 `cargo check`，用工具确认拆分没有破坏类型和构建。

## 拆分说法

以后遇到“大多数代码都生成在一个文件里”的情况，可以这样要求：

```text
请不要把实现都堆在入口文件里。先识别项目已有结构，再按真实职责拆分：
1. 入口文件只保留应用装配、路由/命令注册、全局 provider。
2. 业务模型放 models/types。
3. 外部系统调用放 services 或 platform。
4. 数据读写放 database/repository/store。
5. 纯工具函数放 utils。
6. UI 组件按页面、面板、弹窗、菜单、复用控件拆到 components。
7. 组件私有样式放回对应 .vue 的 <style scoped>。
8. 跨组件主题、布局、响应式规则保留全局 CSS。
9. 高耦合状态按 composable 拆，并保留清晰输入输出。
10. 拆完必须跑类型检查、构建或测试。
```

## 验证方式

本轮拆分完成后已验证：

```text
npm run build
cargo check
```
