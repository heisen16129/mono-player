# Mono Player

Mono Player 是一个基于 Tauri 2、Vue 3、TypeScript 和 Rust 的本地音乐播放器桌面应用。项目重点放在本地曲库管理、Rust 原生音频后端、歌词体验、WASM 插件扩展和多进程 worker 隔离。

## 技术栈

- 桌面框架：Tauri 2
- 前端：Vue 3 + TypeScript + Pinia + Vite
- 后端：Rust
- 数据存储：SQLite / rusqlite
- 音频播放：Rust audio worker + rodio
- 元数据读取：lofty
- 插件运行：WASM / wasmtime，配合受控 Host HTTP 请求
- 系统集成：托盘、系统媒体控制、主题色、桌面歌词窗口

## 当前功能

- 扫描本地音乐目录，并识别 `mp3`、`flac`、`wav`、`ogg`、`m4a`、`aac`、`opus`、`aiff` 等音频文件。
- 读取歌曲标题、艺人、专辑、时长、封面等元数据，并保存到 SQLite 曲库。
- 提供曲库、文件夹、收藏、最近添加、最近播放、歌手、歌单等视图。
- 使用 Rust 音频后端播放本地文件和在线 URL，支持队列、上一首/下一首、暂停、停止、seek、音量、倍速、输出设备选择和缓存目录管理。
- 支持本地歌词、在线歌词和插件歌词，歌词解析在 Rust 后端统一处理。
- 支持普通 LRC、逐字 LRC、A2 扩展 LRC、明文 QRC、明文 KRC 等歌词格式。
- 提供歌词页、逐字高亮、歌词搜索、歌词同步、封面下载、歌词下载和桌面歌词窗口。
- 支持 WASM 音源/歌词插件，插件能力包括 `search`、`play`、`lyrics`，网络请求通过 Host 侧权限边界转发。
- 提供下载管理，支持在线歌曲下载、歌词下载、封面下载、打开下载文件所在目录和删除下载文件。
- 支持浅色、深色、系统主题、壁纸主题色、自定义主题包导入和主题预览。
- 支持系统托盘、右键托盘菜单、系统媒体控制和播放状态同步。
- 自动启动本地 MCP HTTP 端点，默认地址为 `http://127.0.0.1:17331/mcp`。

## 音频与歌词支持

本地曲库扫描当前按文件扩展名识别音频文件，支持：

```text
mp3, flac, wav, ogg, m4a, aac, opus, aiff
```

扫描时会递归读取所选目录，跟随符号链接，并用 `lofty` 读取标题、艺人、专辑和时长。读取失败时会回退到文件名：如果文件名形如 `标题 - 艺人`，会拆成标题和艺人；否则文件名主干会作为标题。

歌词来源的整体优先级如下：

1. 已关联的歌词文本：如果曲目对象里已经有非空 `rawLyrics`，直接解析这段文本。
2. 在线歌词 URL：如果存在 `http://` 或 `https://` 的歌词地址，后端请求 URL，提取可读文本后解析。
3. 本地同目录歌词：如果前两者都没有，后端在歌曲文件所在目录查找歌词文件。
4. 没有可用来源时返回空歌词列表。

本地歌词文件支持这些扩展名：

```text
yrc, qrc, krc, lrc, txt
```

本地歌词匹配优先级分为“文件名优先级”和“格式优先级”。先按文件名找，文件名命中后，再按格式排序选择默认歌词。

文件名优先级：

1. `标题 - 艺人.*`：当歌曲标题和艺人都存在时，优先匹配这个文件名。非法文件名字符会被替换成 `_`。
2. `标题.*`：如果没有命中 `标题 - 艺人.*`，再匹配歌曲标题。
3. `音频文件名.*`：最后回退到音频文件本身的文件名主干。
4. 模糊匹配：如果以上精确文件名都没有命中，会扫描同目录下所有支持扩展名的歌词文件，把文件名中的非字母数字字符去掉并转小写后比较。只要候选名包含目标名，或目标名包含候选名，就认为可匹配。

格式优先级：

```text
yrc > qrc > krc > lrc > txt
```

例如同目录同时存在 `晴天.yrc`、`晴天.lrc` 和 `晴天.txt` 时，默认会选择 `晴天.yrc`，并把可切换格式记录为 `yrc/lrc/txt`。如果用户或插件传入了首选格式，并且该格式存在，则会优先使用传入格式。

歌词解析支持：

- 普通 LRC：`[00:19.53]歌词内容`
- 多时间标签 LRC：`[00:19.53][00:21.00]歌词内容`
- 逐字 LRC：`[00:19.53]他[00:20.02]留[00:20.31]给`
- A2 扩展 LRC：`[00:19.53]<00:19.53>他<00:20.02>留`
- YRC：`[1000,2000](1000,300,0)你(1300,300,0)好`
- QRC：`[1000,2000]你(0,300,0)好(300,300,0)`
- KRC：`[1000,2000]<0,300,0>你<300,300,0>好`
- 纯文本：无时间轴的歌词会作为普通文本行展示

歌词内容解析前会做基础清洗：提取 HTML 中 `id="lyrics"` 的内容、去除 HTML 标签、解码常见 HTML 实体、合并独立时间行和下一行文本。QRC/KRC/YRC 当前按明文格式解析；加密原始歌词需要先解密或转换成明文。

## 架构概览

项目已经从单进程播放器演进为多 worker 架构。Tauri 主进程负责窗口、命令注册、状态装配和系统集成；耗时或边界更敏感的任务放在独立 worker 进程中执行。

```text
src-tauri/src/workers/
  audio.rs      音频播放、URL 流式缓存、输出设备和播放状态
  download.rs   下载任务和下载进度事件
  plugin.rs     插件目录、WASM 字节读取、插件 HTTP 请求
  scanner.rs    本地曲库扫描
  mcp_api.rs    MCP HTTP API worker
  protocol.rs   worker NDJSON 请求/响应协议
  manager.rs    worker 进程管理
```

前端通过 `src/services/` 调用 Tauri 命令；播放器状态主要在 `src/stores/player.ts`，页面导航状态在 `src/composables/useLibraryNavigation.ts`。

## 项目结构

```text
mono-player/
  src/                         Vue 前端
    components/                页面、面板、弹窗、菜单和复用组件
    composables/               高耦合 UI/业务状态拆分
    services/                  Tauri/Rust 命令调用封装
    stores/                    Pinia 状态
    styles/                    全局主题、布局和响应式样式
    types/                     TypeScript 类型
    utils/                     纯工具函数
    App.vue                    应用装配和主界面协调
    main.ts                    前端入口
  src-tauri/                   Rust / Tauri 后端
    src/                       Tauri 命令、数据库、播放、插件、worker 等模块
    capabilities/              Tauri 权限配置
    icons/                     应用图标
    Cargo.toml                 Rust 依赖配置
    tauri.conf.json            Tauri 配置
  plugins/                     内置 WASM 插件源码和 dist 产物
  examples/themes/             示例主题包
  docs/                        架构、插件、主题、MCP 等开发文档
  scripts/worker-e2e.mjs       worker 主链路 E2E 验证脚本
  package.json                 前端依赖和脚本
  vite.config.ts               Vite 配置
  rust-toolchain.toml          Rust 工具链配置
```

## 开发环境

建议环境：

- Node.js 20+
- Rust stable
- Tauri 2 所需的系统依赖
- 如需编译 WASM 插件，安装目标：`rustup target add wasm32-unknown-unknown`

安装依赖：

```bash
npm install
```

启动完整桌面应用：

```bash
npm run tauri:dev
```

只启动前端预览：

```bash
npm run dev
```

普通浏览器预览只能查看部分 UI。扫描本地目录、SQLite、原生播放、托盘、桌面歌词、下载和插件 worker 等能力需要在 Tauri 桌面窗口中运行。

## 构建与检查

前端类型检查和构建：

```bash
npm run build
```

Rust 后端检查：

```bash
cd src-tauri
cargo check
```

worker 主链路 E2E 验证：

```bash
npm run worker:e2e
```

打包桌面应用：

```bash
npm run tauri:build
```

## WASM 插件

`plugins/` 下包含多个 WASM 插件工程。插件运行时固定为 `wasm`，当前类型分为音乐插件和歌词插件。插件不直接访问系统网络，需要网络时返回 `hostRequest`，由 Host 在权限校验后代发请求。

更多协议和 ABI 说明见 [docs/wasm-plugin-development.md](docs/wasm-plugin-development.md) 和 [docs/plugin-rules.md](docs/plugin-rules.md)。

## 相关文档

- [docs/multiprocess-architecture.md](docs/multiprocess-architecture.md)：多进程 worker 架构说明
- [docs/multiprocess-system-steps.md](docs/multiprocess-system-steps.md)：多进程改造记录和验证记录
- [docs/mcp-development-steps.md](docs/mcp-development-steps.md)：MCP HTTP API 开发记录
- [docs/custom-theme.md](docs/custom-theme.md)：自定义主题包说明
- [docs/file-splitting-guide.md](docs/file-splitting-guide.md)：文件拆分和模块职责说明

## 当前状态

项目仍处于开发阶段，但核心链路已经包括本地曲库、Rust 音频播放、歌词、主题、下载、插件和 worker 隔离。后续更适合继续补强真实平台插件稳定性、跨平台打包验证、音频格式兼容性、插件权限细化和 UI 细节体验。
