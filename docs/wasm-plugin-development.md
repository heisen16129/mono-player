# Mono Player WASM 插件开发说明

这份文档说明 Mono Player 当前的 WASM 插件协议：插件文件怎么发布，Host 会在什么时机调用插件，每个 action 的入参和返回值是什么，以及 `version`、`author`、`capabilities`、`permissions` 这些字段应该放在哪里。

当前只支持 `runtime: "wasm"`。插件运行在 Rust 后端的 plugin worker 中，前端不直接调用 WASM，也不再推断插件能力、权限、作者或版本。

## 总体流程

1. 用户添加订阅地址或本地导入 `.wasm`。
2. Rust 读取 `.wasm`，调用插件 `metadata` action。
3. Rust 校验 metadata，生成插件目录项或已安装 manifest。
4. 搜索、播放、歌词、音质探测时，前端只把已安装插件列表传给 Rust。
5. Rust 根据插件能力和启用状态选择插件，再调用对应 action。
6. 插件需要网络时返回 `hostRequest`，由 Rust 代发请求，再用 `host_response` 把响应交回插件。

相关代码位置：

| 文件 | 职责 |
| --- | --- |
| `src/types/plugin.ts` | 前端插件类型定义 |
| `src/services/plugins.ts` | 插件订阅、安装、卸载、启停、缓存读写 |
| `src/services/pluginSearch.ts` | 搜索、歌词、播放源解析的前端入口 |
| `src-tauri/src/plugins.rs` | Rust 插件命令、metadata 校验、搜索/播放/歌词结果整理 |
| `src-tauri/src/workers/plugin.rs` | plugin worker、WASM ABI 调用、Host HTTP 权限边界 |

## 插件文件格式

插件产物必须是 `.wasm` 文件，并导出以下 ABI：

```rust
#[no_mangle]
pub extern "C" fn mono_alloc(len: usize) -> *mut u8;

#[no_mangle]
pub extern "C" fn mono_dealloc(ptr: *mut u8, len: usize);

#[no_mangle]
pub extern "C" fn mono_invoke(ptr: *const u8, len: usize) -> *mut u8;

#[no_mangle]
pub extern "C" fn mono_last_len() -> usize;
```

调用过程：

1. Host 调用 `mono_alloc(len)` 申请输入缓冲区。
2. Host 写入 UTF-8 JSON 请求。
3. Host 调用 `mono_invoke(ptr, len)`。
4. 插件返回 UTF-8 JSON 输出指针。
5. Host 调用 `mono_last_len()` 获取输出长度。
6. Host 读取输出 JSON。
7. Host 调用 `mono_dealloc(ptr, len)` 释放输入和输出缓冲区。

插件所有请求和响应都是 JSON。插件内部用 `request.action` 分发方法。除 `hostRequest` 中间响应外，插件最终业务响应必须使用 `ApiResponse` envelope。

## 统一返回格式

插件最终响应统一使用现有前后端 `ApiResponse` 结构：

```ts
type ApiResponse<T> = {
  code: 1 | 0;
  message: string;
  data: T | null;
};
```

成功时：

```json
{
  "code": 1,
  "message": "OK",
  "data": {
    "tracks": [],
    "isEnd": true
  }
}
```

失败时：

```json
{
  "code": 0,
  "message": "平台没有返回可播放地址",
  "data": null
}
```

强制规则：

- `metadata/search/qualities/play/lyrics/theme/host_response` 的最终业务结果都必须返回 `ApiResponse`。
- 成功业务字段放进 `data`，不要直接裸返回业务对象。
- 失败信息放进 `message`，不要再返回 `{ "error": "..." }`。
- `hostRequest` 是唯一例外，它是请求 Host 代发网络的中间响应，必须保持裸对象格式。

## 订阅格式

订阅地址可以直接是一个 `.wasm` URL，也可以返回 JSON。官网商城推荐使用冗余展示字段的 `catalog.json`，这样商城列表可以先展示插件信息，安装或更新时再下载 `entry` 指向的 `.wasm` 并读取 metadata 校验。

官网商城仓库建议让每个插件包自带 `dist`：

```text
mono-plugin-store/
  catalog.json
  yuanli-qq-music/
    dist/
      yuanli-qq.wasm
      icon.png
      screenshots/
        1.png
        2.png
```

推荐 JSON：

```json
{
  "schemaVersion": 1,
  "plugins": [
    {
      "id": "mono-native-wasm-yuanli-qq",
      "name": "元力QQ",
      "version": "1.0.0",
      "kind": "music",
      "runtime": "wasm",
      "author": "Mono",
      "description": "搜索并播放 QQ 音乐，支持多音质和多格式歌词。",
      "updatedAt": "2026-07-23",
      "capabilities": ["search", "play", "lyrics"],
      "highlights": ["支持多音质播放", "返回多格式歌词", "可用于在线歌曲下载"],
      "screenshots": [
        "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/yuanli-qq-music/dist/screenshots/1.png"
      ],
      "permissions": ["network"],
      "entry": "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/yuanli-qq-music/dist/yuanli-qq.wasm"
    }
  ]
}
```

也支持数组：

```json
[
  { "entry": "https://example.com/plugins/example.wasm" }
]
```

订阅项字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `entry` | 是 | `.wasm` 地址。推荐使用可直接下载二进制的 raw URL。 |
| `id/name/version/kind/runtime/author/description/updatedAt/capabilities/permissions` | 是 | 商城展示和筛选字段，应与 wasm metadata 保持一致。 |
| `icon` | 否 | 插件图标 URL。缺失时前端使用默认类型图标。 |
| `highlights` | 否 | 功能亮点数组。 |
| `screenshots` | 否 | 效果图 URL 数组，Host 最多保留 5 张。 |

注意：`catalog.json` 用于商城展示和入口索引。安装或更新时，Rust 会下载 `entry` 指向的 `.wasm` 并读取 `metadata`，以插件本体返回的字段作为 installed manifest 的最终来源。

## Metadata

`metadata` 是插件最重要的 action。插件管理页展示、安装 manifest、能力判断、权限边界都依赖它。

Host 调用时机：

| 时机 | 是否调用 |
| --- | --- |
| 添加 `.wasm` 订阅 | 调用 |
| 点击“更新订阅” | 调用每个订阅项的 `.wasm` |
| 从本地文件安装 | 调用 |
| 安装 catalog 插件 | 再次调用，确保 manifest 来自插件本体 |
| 进入插件页面 | 不调用，只读本地已安装列表和 catalog 缓存 |

入参：

```json
{
  "action": "metadata"
}
```

返回值：

```json
{
  "code": 1,
  "message": "OK",
  "data": {
    "id": "mono-plugin-example",
    "name": "示例音乐",
    "version": "1.0.0",
    "kind": "music",
    "author": "Mono",
    "description": "示例 WASM 音源插件",
    "icon": "https://example.com/plugin-icon.png",
    "updatedAt": "2026-07-23",
    "capabilities": ["search", "play", "lyrics"],
    "highlights": ["支持在线搜索", "支持在线播放"],
    "screenshots": ["https://example.com/plugin-preview.png"],
    "permissions": ["network"]
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 插件唯一 ID。更新、卸载、启停都按这个 ID 匹配。不要随版本变化。 |
| `name` | 是 | 插件显示名称。 |
| `version` | 是 | 插件版本号，字符串。用于 UI 展示和判断 catalog 版本是否不同。 |
| `kind` | 是 | 插件类型，支持 `music`、`lyrics`、`metadata`、`playlist`、`theme`、`integration`、`tool`。 |
| `author` | 是 | 作者。 |
| `description` | 是 | 插件说明。 |
| `icon` | 否 | 插件图标 URL。缺失时前端使用默认类型图标。 |
| `updatedAt` | 是 | 插件更新时间，建议使用 `YYYY-MM-DD`。 |
| `capabilities` | 是 | 能力列表，不能为空。支持的能力见下方能力表。 |
| `highlights` | 否 | 功能亮点数组，用于插件商城详情展示。 |
| `screenshots` | 否 | 效果图 URL 数组，Host 最多保留 5 张。 |
| `permissions` | 否 | 权限列表。可以为空数组。需要 Host 代发网络请求时必须声明 `network`。 |

`tags` 不由插件返回。Host 会根据 `capabilities` 生成中文功能标签，例如 `search` -> `搜索歌曲`、`play` -> `在线播放`、`lyrics` -> `歌词获取`。

Rust 不会替插件补默认能力或默认 `network` 权限。缺少必填字段、`kind` 不合法、`capabilities` 为空、权限名不受支持，都会导致安装或 catalog 更新失败。

当前支持的能力：

| 能力 | 含义 | Host 何时使用 |
| --- | --- | --- |
| `search` | 支持搜索歌曲或歌词候选 | 在线搜索、歌词搜索 |
| `play` | 支持把搜索结果解析成可播放音频 | 点击在线歌曲播放、下载在线歌曲 |
| `lyrics` | 支持返回歌词 metadata | 歌词面板、播放时补歌词、下载歌词 |
| `theme` | 支持返回主题变量 | 安装或更新主题插件后写入本地主题 |
| `metadata` | 预留：补全曲目元数据 | 元数据插件 |
| `cover` | 预留：补全封面 | 元数据插件 |
| `album` | 预留：补全专辑信息 | 元数据插件 |
| `playlist-import` | 预留：导入歌单 | 歌单插件 |
| `playlist-export` | 预留：导出歌单 | 歌单插件 |
| `scrobble` | 预留：同步播放记录 | 集成插件 |
| `history-sync` | 预留：同步历史 | 集成插件 |
| `batch-rename` | 预留：批量重命名 | 工具插件 |
| `lyric-convert` | 预留：转换歌词 | 工具插件 |
| `lyric-translate` | 预留：翻译歌词 | 工具插件 |

当前支持的权限：

| 权限 | 含义 |
| --- | --- |
| `network` | 允许插件通过 `hostRequest` 请求 HTTP(S) 网络。 |
| `credential-read` | 预留：读取 Host 凭证。 |
| `cache-read` | 预留：读取 Host 缓存。 |
| `cache-write` | 预留：写入 Host 缓存。 |
| `download-write` | 预留：写入下载文件。 |

## Action 一览

| action | 插件需要的能力 | 调用时机 | 作用 |
| --- | --- | --- | --- |
| `metadata` | 无 | 添加订阅、更新订阅、安装、本地导入 | 返回 `ApiResponse<PluginMetadata>`。 |
| `search` | `search` | 在线搜索或歌词搜索 | 返回分页搜索结果。 |
| `qualities` | `play` | 播放前、音质菜单刷新前 | 返回可用音质列表和默认音质。 |
| `play` | `play` | 点击播放、切换音质、下载前解析播放源 | 返回音频 URL 和可选歌词/封面。 |
| `lyrics` | `lyrics` | 歌词搜索应用、播放时补歌词、下载歌词 | 返回歌词文本或歌词 URL。 |
| `theme` | `theme` | 安装或更新主题插件后 | 返回主题变量、预览图和可选背景图。 |
| `host_response` | 取决于原 action | 插件返回 `hostRequest` 后 | 插件解析 Host HTTP 响应并返回最终 ApiResponse。 |

Host 会强制拆 `ApiResponse`：`code !== 1` 会被当成插件调用失败，`code === 1` 时继续解析 `data`。

## theme

调用时机：安装或更新 `kind: "theme"` 且包含 `theme` 能力的 WASM 插件后。Host 会调用插件的 `theme` action，把返回值写入现有本地主题列表；安装时不会自动切换到该主题。

入参：

```json
{
  "action": "theme"
}
```

返回值 `data`：

```json
{
  "id": "custom:market-gray-white",
  "name": "灰白主题",
  "author": "Mono Player",
  "variables": {
    "--smw-bg-canvas": "#f4f5f7",
    "--smw-bg-workspace": "#f8f9fb",
    "--smw-bg-sidebar": "#ffffff"
  },
  "preview": "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/gray-white/dist/screenshots/1.png",
  "background": null,
  "backgroundOpacity": null
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 否 | 本地主题 ID。可以写 `custom:xxx`，也可以只写 `xxx`，Host 会补成 `custom:xxx`。缺省时使用插件 ID。 |
| `name` | 否 | 主题显示名，缺省时使用插件名。 |
| `author` | 否 | 主题作者，缺省时使用插件作者。 |
| `variables` | 是 | CSS 变量字典，不能为空。变量名应使用现有 `--smw-*` 主题变量。 |
| `preview` | 否 | 预览图 URL，可使用 catalog 中 dist 目录下的 raw 图片地址。 |
| `background` | 否 | 应用背景图 URL。 |
| `backgroundOpacity` | 否 | 背景图透明度，范围建议为 `0` 到 `1`。 |

主题插件的 `metadata` 推荐这样写：

```json
{
  "id": "mono-wasm-theme-gray-white",
  "name": "灰白主题",
  "version": "1.0.0",
  "kind": "theme",
  "author": "Mono Player",
  "description": "简洁的浅色灰白主题。",
  "updatedAt": "2026-07-23",
  "capabilities": ["theme"],
  "highlights": ["浅色界面", "低对比边框"],
  "screenshots": ["https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/gray-white/dist/screenshots/1.png"],
  "permissions": []
}
```

对应官网商城 `catalog.json` 里的条目可以写成：

```json
{
  "id": "mono-wasm-theme-gray-white",
  "name": "灰白主题",
  "version": "1.0.0",
  "kind": "theme",
  "runtime": "wasm",
  "author": "Mono Player",
  "description": "简洁的浅色灰白主题，适合日常本地音乐管理。",
  "updatedAt": "2026-07-23",
  "capabilities": ["theme"],
  "highlights": ["浅色界面", "低对比边框", "适合长时间使用"],
  "permissions": [],
  "icon": "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/gray-white/dist/icon.svg",
  "screenshots": [
    "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/gray-white/dist/screenshots/1.svg"
  ],
  "entry": "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/gray-white/dist/theme-gray-white.wasm"
}
```

## search

调用时机：用户在发现音乐或歌词面板输入关键词搜索。Host 会先筛选已启用且包含 `search` 能力的插件。

入参：

```json
{
  "action": "search",
  "keyword": "周杰伦",
  "page": 1,
  "pageSize": 30
}
```

参数说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 搜索关键词，Host 已经 trim，空关键词不会调用插件。 |
| `page` | number | 页码，从 1 开始。 |
| `pageSize` | number | 每页数量，Host 会限制在 1 到 100。 |

返回值：

```json
{
  "code": 1,
  "message": "OK",
  "data": {
    "tracks": [
      {
        "id": "123",
        "title": "晴天",
        "artist": "周杰伦",
        "album": "叶惠美",
        "duration": 269,
        "artwork": "https://example.com/cover.jpg",
        "year": 2003,
        "genre": "Pop",
        "trackNumber": 1,
        "raw": {
          "id": "123",
          "songmid": "xxx"
        }
      }
    ],
    "isEnd": false
  }
}
```

返回字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `tracks` | 否 | 数组。缺失时按空数组处理。 |
| `isEnd` | 否 | 是否没有下一页。缺失时如果 tracks 为空则视为结束。 |

单曲字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 建议 | 歌曲 ID。缺失时 Host 会用插件 ID 和标题生成临时 ID。 |
| `title` 或 `name` | 建议 | 歌名。缺失时显示 `Unknown Track`。 |
| `artist`、`singer` 或 `author` | 建议 | 歌手。也支持 `artists: [{ "name": "..." }]`。 |
| `album` 或 `albumName` | 否 | 专辑名。 |
| `duration` | 否 | 秒。也兼容毫秒、大于 1000 的数字会按毫秒转秒。 |
| `artwork`、`cover` 或 `picUrl` | 否 | 封面 URL。 |
| `year` | 否 | 年份。 |
| `genre` | 否 | 风格。 |
| `trackNumber` | 否 | 曲序。 |
| `raw` | 强烈建议 | 原始平台数据。播放、歌词和下载时 Host 会优先把 `raw` 传回插件。 |

## qualities

调用时机：播放前、在线歌曲成为当前播放项后、用户打开或刷新音质选项时。Host 会先筛选已启用且包含 `play` 能力的插件。

入参：

```json
{
  "action": "qualities",
  "track": {
    "id": "123",
    "title": "晴天",
    "raw": {}
  }
}
```

返回值：

```json
{
  "code": 1,
  "message": "OK",
  "data": {
    "qualities": [
      { "id": "128k", "name": "标准", "available": true },
      { "id": "320k", "name": "高品", "available": true },
      { "id": "flac", "name": "无损", "available": false, "reason": "需要会员" }
    ],
    "defaultQuality": "320k"
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `qualities` | 是 | 非空数组。每项必须有 `id`。 |
| `defaultQuality` | 否 | 默认音质 ID。必须存在于 `qualities` 且 `available: true` 才会被采用。 |
| `qualities[].id` | 是 | 播放时会作为 `quality` 传给 `play`。 |
| `qualities[].name` | 否 | UI 显示名。缺失时显示 `id`。 |
| `qualities[].available` | 否 | 是否可用。缺失时默认为 `true`。 |
| `qualities[].reason` | 否 | 不可用原因。 |

如果插件没有返回有效音质，Host 会认为该插件无法解析播放音质。

## play

调用时机：用户点击在线歌曲播放、切换音质、下载在线歌曲前解析真实音频地址。Host 会先调用 `qualities` 得到尝试顺序，然后逐个调用 `play`，直到拿到合法 `url`。

入参：

```json
{
  "action": "play",
  "track": {
    "id": "123",
    "title": "晴天",
    "artist": "周杰伦",
    "album": "叶惠美",
    "duration": 269,
    "artwork": "https://example.com/cover.jpg"
  },
  "quality": "320k",
  "includeMetadata": true
}
```

参数说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `track` | object | 搜索结果的 `raw`，如果没有 `raw` 就是整个搜索 track。 |
| `quality` | string | 来自 `qualities[].id`。 |
| `includeMetadata` | boolean | Host 是否希望这次顺便拿歌词等 metadata。插件可以忽略。 |

返回值：

```json
{
  "code": 1,
  "message": "OK",
  "data": {
    "url": "https://example.com/audio.mp3",
    "artwork": "https://example.com/cover.jpg",
    "quality": "320k",
    "lyrics": {
      "defaultFormat": "lrc",
      "lyrics": [
        { "format": "lrc", "content": "[00:00.00]歌词" }
      ]
    }
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `url` | 是 | 可播放或可下载的 HTTP(S) 音频地址。 |
| `path` | 否 | 兼容字段。Host 当前以 `url` 为准，并把 `path` 归一为 `url`。 |
| `artwork` | 否 | 封面 URL。 |
| `quality` | 否 | 实际返回音质。缺失时 Host 使用本次请求的 `quality`。 |
| `lyrics` | 否 | 嵌入歌词 metadata。缺失且 `includeMetadata` 为 true 时，Host 会再调用 `lyrics`。 |

Host 最终会从 `track` 补齐 `title/artist/album/duration/sourceId/sourceRaw` 等播放源字段，插件不需要重复返回这些字段，但返回也不会有坏处。

## lyrics

调用时机：歌词面板应用插件歌词、播放时补歌词、下载歌词。Host 会先筛选已启用且包含 `lyrics` 能力的插件。

入参：

```json
{
  "action": "lyrics",
  "track": {
    "id": "123",
    "title": "晴天",
    "raw": {}
  }
}
```

参数说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `track` | object | 搜索结果的 `raw`，如果没有 `raw` 就是整个搜索 track。 |
| `format` | deprecated | 不再传入。插件一次返回所有可用歌词格式，前端切换格式时不再重新请求插件。 |

返回值：

```json
{
  "code": 1,
  "message": "OK",
  "data": {
    "providerId": "qqmusic",
    "providerName": "QQ音乐",
    "trackId": "003abc",
    "defaultFormat": "lrc",
    "lyrics": [
      { "format": "lrc", "content": "[00:00.00]歌词" },
      { "format": "yrc", "content": "[0,1200](0,300)歌词" }
    ]
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `providerId` | 否 | 歌词来源插件或平台 ID。 |
| `providerName` | 否 | 歌词来源名称。 |
| `trackId` | 否 | 平台歌词对应的歌曲 ID。 |
| `defaultFormat` | 否 | 默认歌词格式。若为空或对应内容不可用，Host 使用 `lyrics[0]`。 |
| `lyrics` | 是 | 歌词变体数组，至少包含一个 `{ format, content }`。 |
| `lyrics[].format` | 是 | 歌词格式。当前支持 `lrc`、`trans`、`yrc`、`qrc`、`krc`、`a2`。 |
| `lyrics[].content` | 是 | 原始歌词内容。 |
| `lyrics[].sourceUrl` | 否 | 歌词来源 URL。 |
| `lyrics[].quality` | 否 | 歌词质量标记，例如 `original`、`converted`、`fallback`。 |

`rawLyrics`、`lyricsUrl`、`formats`、顶层 `format` 已移除，不再兼容。插件应一次返回所有可用 `lyrics[]`；切换歌词格式时前端只切换本地 metadata，并把选中的 `content + format` 交给后端解析。

## hostRequest 和 host_response

WASM 插件不要直接访问系统网络。需要网络时，插件返回 `hostRequest`，由 Host 检查权限后代发 HTTP 请求。

插件返回：

```json
{
  "hostRequest": {
    "method": "GET",
    "url": "https://example.com/api/search?q=test",
    "headers": {
      "User-Agent": "Mozilla/5.0"
    },
    "data": null
  }
}
```

Host 再次调用插件：

```json
{
  "action": "host_response",
  "request": {
    "action": "search",
    "keyword": "周杰伦",
    "page": 1,
    "pageSize": 30
  },
  "hostRequest": {
    "method": "GET",
    "url": "https://example.com/api/search?q=test",
    "headers": {
      "User-Agent": "Mozilla/5.0"
    },
    "data": null
  },
  "response": {
    "status": 200,
    "headers": {
      "content-type": "application/json"
    },
    "body": "{}"
  }
}
```

插件收到 `host_response` 后，应根据原始 `request.action` 解析 `response.body`，并返回最终的 `ApiResponse`。如果还需要继续请求网络，可以再次返回裸 `hostRequest`。

Host HTTP 规则：

| 规则 | 说明 |
| --- | --- |
| 必须声明 `network` 权限 | metadata 的 `permissions` 里没有 `network` 时，Host 拒绝请求。 |
| URL 必须是 HTTP(S) | 不允许非 HTTP(S) 协议。 |
| 请求次数有限制 | 单次插件调用最多 16 次 host request，避免循环。 |
| Header 会被校验 | 危险 header 会被拒绝。 |
| GET/HEAD 不能带 body | 有 body 会被拒绝。 |

## Rust 插件最小模板

`Cargo.toml`：

```toml
[package]
name = "mono_plugin_example"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
serde_json = "1"
```

`src/lib.rs`：

```rust
use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-plugin-example";
const PROVIDER_NAME: &str = "示例音乐";

thread_local! {
    static LAST_LEN: Cell<usize> = const { Cell::new(0) };
}

#[no_mangle]
pub extern "C" fn mono_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub extern "C" fn mono_dealloc(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        unsafe {
            let _ = Vec::from_raw_parts(ptr, len, len);
        }
    }
}

#[no_mangle]
pub extern "C" fn mono_last_len() -> usize {
    LAST_LEN.with(Cell::get)
}

#[no_mangle]
pub extern "C" fn mono_invoke(ptr: *const u8, len: usize) -> *mut u8 {
    let input = unsafe { std::slice::from_raw_parts(ptr, len) };
    let request: Value = serde_json::from_slice(input).unwrap_or_else(|_| json!({}));
    let response = wrap_plugin_response(handle_request(request));
    let bytes = response.to_string().into_bytes();
    let output_len = bytes.len();
    let output_ptr = mono_alloc(output_len);

    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), output_ptr, output_len);
    }

    LAST_LEN.with(|value| value.set(output_len));
    output_ptr
}

fn handle_request(request: Value) -> Value {
    match request.get("action").and_then(Value::as_str) {
        Some("metadata") => metadata_response(),
        Some("search") => search_response(&request),
        Some("qualities") => qualities_response(),
        Some("play") => play_response(&request),
        Some("lyrics") => lyrics_response(&request),
        Some("host_response") => host_response(&request),
        action => json!({ "error": format!("unsupported action: {:?}", action) }),
    }
}

fn wrap_plugin_response(response: Value) -> Value {
    if response.get("hostRequest").is_some() {
        return response;
    }
    if let Some(error) = response
        .get("error")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return json!({ "code": 0, "message": error, "data": null });
    }
    json!({ "code": 1, "message": "OK", "data": response })
}

fn metadata_response() -> Value {
    json!({
        "id": PROVIDER_ID,
        "name": PROVIDER_NAME,
        "version": "1.0.0",
        "kind": "music",
        "author": "Your Name",
        "description": "Example Mono Player WASM plugin",
        "capabilities": ["search", "play", "lyrics"],
        "permissions": ["network"]
    })
}

fn search_response(request: &Value) -> Value {
    let keyword = request.get("keyword").and_then(Value::as_str).unwrap_or("");
    json!({
        "tracks": [{
            "id": "demo-1",
            "title": format!("{} 示例歌曲", keyword),
            "artist": "示例歌手",
            "album": "示例专辑",
            "duration": 240,
            "artwork": null,
            "raw": { "id": "demo-1" }
        }],
        "isEnd": true
    })
}

fn qualities_response() -> Value {
    json!({
        "qualities": [
            { "id": "standard", "name": "标准", "available": true }
        ],
        "defaultQuality": "standard"
    })
}

fn play_response(request: &Value) -> Value {
    let quality = request.get("quality").and_then(Value::as_str).unwrap_or("standard");
    json!({
        "url": "https://example.com/demo.mp3",
        "quality": quality,
        "lyrics": {
            "defaultFormat": "lrc",
            "lyrics": [
                { "format": "lrc", "content": "[00:00.00]示例歌词" }
            ]
        }
    })
}

fn lyrics_response(_request: &Value) -> Value {
    json!({
        "defaultFormat": "lrc",
        "lyrics": [
            { "format": "lrc", "content": "[00:00.00]示例歌词" }
        ]
    })
}

fn host_response(_request: &Value) -> Value {
    json!({ "error": "this example does not use hostRequest" })
}
```

编译：

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
```

产物：

```text
target/wasm32-unknown-unknown/release/mono_plugin_example.wasm
```

## 开发建议

1. 先实现 `metadata`，再实现 `search`。
2. 搜索结果务必保留 `raw`，播放和歌词阶段会把它传回插件。
3. 实现 `play` 前先实现 `qualities`，确保每个 `quality` 都能被 `play` 识别。
4. 网络插件必须在 metadata 里声明 `permissions: ["network"]`。
5. 不要把 Cookie、token 或用户私密信息写死在插件里。
6. `id` 要稳定，版本升级不要改 `id`。
7. 字段缺失时不要依赖 Host 推断。Host 当前只做校验、去重和结果整理。

## 验收清单

一个插件算可用，至少需要满足：

- 本地导入或订阅安装时，`metadata` 校验通过。
- 插件管理页能显示名称、版本、作者、能力和启用状态。
- `search` 能返回可展示的歌曲或歌词候选。
- 音乐插件的 `qualities` 能返回非空音质列表。
- 音乐插件的 `play` 能返回可播放的 `url`。
- 歌词插件或音乐插件的 `lyrics` 能返回 `defaultFormat` 和非空 `lyrics[]`。
- 需要网络时，所有请求都通过 `hostRequest`，并且 metadata 声明了 `network` 权限。
