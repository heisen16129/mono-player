# Mono Player

一个基于 Tauri + Vue 3 + TypeScript + Rust 的本地音乐播放器桌面应用雏形。

## 技术栈

- UI 层：Vue 3 + TypeScript
- 状态管理：Pinia
- 构建工具：Vite
- 桌面壳：Tauri 2
- 本地能力：Rust
- 数据存储：SQLite
- 音频播放：HTMLAudioElement
- 元数据读取：lofty

## 功能概览

- 选择本地音乐目录
- 扫描 `mp3`、`flac`、`wav`、`ogg`、`m4a`、`aac`、`opus`、`aiff` 文件
- 读取标题、艺人、专辑、时长等音乐元数据
- 将曲库信息保存到 SQLite
- 曲库列表展示和关键词搜索
- 播放队列展示
- 使用浏览器原生 `audio` 控件播放本地音频
- 深色/浅色主题切换
- 歌词页、桌面歌词、逐字/逐词歌词高亮

## 音频与歌词支持

### 支持的本地音频文件

本地曲库扫描会识别以下音频扩展名：

```text
mp3, flac, wav, ogg, m4a, aac, opus, aiff
```

扫描到的音频会读取标题、艺人、专辑、时长等元数据，并保存到 SQLite 曲库中。

### 支持的歌词文件

本地歌词会在歌曲同目录下查找，支持以下歌词扩展名：

```text
lrc, txt, qrc, krc
```

歌词文件名会优先按歌曲标题和艺人匹配，也会回退到音频文件名匹配。

### 歌词处理流程

歌词解析统一由 Rust 后端完成。前端只把歌词来源交给后端，并展示后端返回的结构化歌词。

统一入口是 `resolve_lyrics_source`：

- 本地歌曲路径：后端根据歌曲路径查找同目录歌词文件。
- 在线歌词 URL：后端请求 URL，提取歌词文本。
- 在线歌词文本：通过 `parse_raw_lyrics` 走同一套 Rust 解析规则。

所有来源最终都会进入同一个解析流程：

```text
读取歌词内容
  -> 清洗文本 / HTML
  -> 解析时间标签
  -> 返回 LyricLine[]
```

### 支持的歌词格式

当前支持：

- 普通 LRC：`[00:19.53]歌词内容`
- 逐字 LRC：`[00:19.53]他[00:20.02]留[00:20.31]给`
- A2 扩展 LRC：`[00:19.53]<00:19.53>他<00:20.02>留`
- 明文 QRC：`[19000,4000]他(0,490)留(490,290)`
- 明文 KRC：`[19000,4000]<0,490,0>他<490,290,0>留`

说明：QRC/KRC 目前支持已经解密或明文化后的内容；原始加密歌词文件需要先解密或转换。

## 项目结构

```text
mono-player/
  src/                    Vue 前端
    App.vue               主界面
    main.ts               前端入口
    styles.css            全局样式
    services/             Tauri/Rust 调用封装
    stores/               Pinia 状态管理
    types/                TypeScript 类型
  src-tauri/              Rust / Tauri 后端
    src/
      lib.rs              Tauri 命令、SQLite、扫描和元数据逻辑
      main.rs             桌面应用入口
    capabilities/         Tauri 权限配置
    icons/                应用图标
    Cargo.toml            Rust 依赖配置
    tauri.conf.json       Tauri 配置
  package.json            前端依赖和脚本
  vite.config.ts          Vite 配置
  rust-toolchain.toml     Rust 工具链配置
```

## 开发运行

安装依赖：

```bash
npm install
```

启动前端预览：

```bash
npm run dev
```

启动完整 Tauri 桌面应用：

```bash
npm run tauri:dev
```

普通浏览器预览只能查看 UI。扫描本地目录、读取 SQLite、播放本地文件路径等能力需要在 Tauri 桌面窗口中运行。

## 构建检查

前端构建：

```bash
npm run build
```

Rust 后端检查：

```bash
cd src-tauri
cargo check
```

桌面应用打包：

```bash
npm run tauri:build
```

## 前后端分工

Vue 3 负责界面、曲库列表、播放队列、搜索、设置、歌词展示和主题切换。

TypeScript 负责前端状态管理、播放队列、交互逻辑、服务封装和类型约束。

Rust 负责本地文件扫描、音乐元数据读取、SQLite 数据库操作，以及后续可扩展的系统托盘、原生菜单和后端音频能力。

Tauri 负责连接 Vue 前端和 Rust 本地能力，并打包为 macOS、Windows、Linux 桌面应用。

## 后续扩展方向

- 增加 `.lrc` 歌词解析和同步滚动
- 增加专辑封面读取与缓存
- 增加播放模式：顺序、单曲循环、随机播放
- 增加播放进度、音量、倍速等自定义控件
- 增加系统托盘、全局快捷键、原生菜单
- 增加最近播放、收藏、歌单管理
- 增加 Rust 音频后端，例如 rodio 或 symphonia
- 将设置从 localStorage 迁移到 Tauri Store

## 环境说明

当前项目使用 `rust-toolchain.toml` 固定到 stable Rust 工具链。

当前 Node 环境为 `20.9.0` 时，项目使用兼容该版本的 Vite 5。升级 Node 到 `20.19+` 后，可以考虑升级到更新的 Vite 版本。
