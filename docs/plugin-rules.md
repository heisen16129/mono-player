# Mono Player 插件规则

这份文档记录插件系统的职责边界和实现规则。完整 ABI、action 入参/返回值、示例代码见 [wasm-plugin-development.md](wasm-plugin-development.md)。

## 当前插件模型

当前只支持 WASM 插件：

```ts
type PluginRuntime = 'wasm';
type PluginKind = 'music' | 'lyrics';
type PluginCapability = 'search' | 'play' | 'lyrics';
```

插件类型：

| 类型 | 说明 |
| --- | --- |
| `music` | 音源插件。通常支持 `search` 和 `play`，也可以支持 `lyrics`。 |
| `lyrics` | 歌词插件。通常支持 `search` 和 `lyrics`，不要求支持 `play`。 |

插件能力：

| 能力 | 说明 |
| --- | --- |
| `search` | 可以搜索歌曲或歌词候选。 |
| `play` | 可以把搜索结果解析成真实音频地址。 |
| `lyrics` | 可以返回歌词文本或歌词地址。 |

不要把 `cover`、`album`、`artist`、`playlist`、`download` 当成插件能力。封面、专辑、歌手、下载所需信息是 `search/play/lyrics` 返回结构中的字段，不是独立能力。

## 字段来源

插件自己的 `metadata` 是安装和运行时的权威来源。官网商城的 `catalog.json` 可以冗余一份展示字段，让商城列表不必先下载每个 `.wasm` 就能展示名称、版本、作者、简介、图标和效果图。

安装或更新插件时，Host 仍会下载 `entry` 指向的 `.wasm` 并调用 `metadata`，用插件本体返回的信息生成 installed manifest。

官网商城仓库建议使用每个插件包自带 `dist` 的结构：

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
  aq-lyrics/
    dist/
      aq-lyrics.wasm
      icon.png
      screenshots/
        1.png
```

`catalog.json` 示例：

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
    },
    {
      "id": "mono-wasm-aq-lyrics",
      "name": "阿Q歌词",
      "version": "1.0.0",
      "kind": "lyrics",
      "runtime": "wasm",
      "author": "Mono",
      "description": "搜索并返回阿Q歌词 metadata，支持多格式歌词切换。",
      "updatedAt": "2026-07-23",
      "capabilities": ["search", "lyrics"],
      "highlights": ["支持歌词搜索", "返回歌词 metadata", "支持多格式歌词"],
      "permissions": ["network"],
      "entry": "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/aq-lyrics/dist/aq-lyrics.wasm"
    }
  ]
}
```

catalog 展示字段和 wasm metadata 应保持一致；如果不一致，安装时以 `.wasm` 的 `metadata` 为准。

Rust 安装或读取插件本体时会调用：

```json
{ "action": "metadata" }
```

插件最终业务响应必须使用现有 `ApiResponse` envelope：

```ts
type ApiResponse<T> = {
  code: 1 | 0;
  message: string;
  data: T | null;
};
```

成功响应的业务字段放在 `data` 中；失败响应使用 `code: 0` 和 `message`，不再返回裸 `{ "error": "..." }`。

`metadata` 必须返回：

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
    "description": "示例插件",
    "icon": "https://example.com/plugin-icon.png",
    "updatedAt": "2026-07-23",
    "capabilities": ["search", "play", "lyrics"],
    "highlights": ["支持在线搜索", "支持在线播放"],
    "screenshots": ["https://example.com/plugin-preview.png"],
    "permissions": ["network"]
  }
}
```

字段规则：

| 字段 | 规则 |
| --- | --- |
| `id` | 必填，稳定唯一，升级版本不要改。 |
| `name` | 必填，用于 UI 展示。 |
| `version` | 必填，字符串，用于 UI 展示和更新判断。 |
| `kind` | 必填，只能是 `music` 或 `lyrics`。 |
| `author` | 必填，作者信息。 |
| `description` | 必填，插件说明。 |
| `icon` | 可选，插件图标 URL。缺失时前端使用默认类型图标。 |
| `updatedAt` | 必填，插件更新时间，建议使用 `YYYY-MM-DD`。 |
| `capabilities` | 必填，不能为空，只能包含 `search/play/lyrics`。 |
| `highlights` | 可选，功能亮点数组，用于插件商城详情展示。 |
| `screenshots` | 可选，效果图 URL 数组，Host 最多保留 5 张。 |
| `permissions` | 可选，缺失时为空权限，不会默认补 `network`。 |

`tags` 不由插件返回。Host 会根据 `capabilities` 生成中文功能标签，例如 `search` -> `搜索歌曲`、`play` -> `在线播放`、`lyrics` -> `歌词获取`。

Rust 不做业务推断：

- 不根据文件名推断插件名称。
- 不根据能力推断 `kind`。
- 不默认补 `search/play/lyrics`。
- 不默认补 `network`。
- 不用订阅 catalog 覆盖插件 metadata。

## 职责边界

### 插件负责

- 把平台原始数据转换成 Mono 插件协议。
- 返回稳定的 `metadata`。
- 实现自己声明的能力。
- 搜索结果保留 `raw`，供播放和歌词阶段继续使用。
- 需要网络时返回 `hostRequest`，不要直接访问系统网络。
- 最终业务响应统一返回 `ApiResponse`，中间网络请求才返回裸 `hostRequest`。

### Rust Host 负责

- 读取和实例化 `.wasm`。
- 调用 `metadata/search/qualities/play/lyrics/host_response`。
- 校验 metadata 的必填字段、能力、权限。
- 根据已安装插件的 enabled/capabilities 选择是否允许调用。
- 执行 Host HTTP 请求并校验权限。
- 对搜索、播放、歌词返回值做结构整理，给前端稳定 DTO。

### 前端负责

- 展示已安装插件、catalog 缓存、订阅列表。
- 触发添加订阅、更新订阅、本地导入、安装、卸载、启停。
- 搜索和播放时调用 Rust 命令。
- 不直接调用 WASM。
- 不归一化插件搜索结果。
- 不推断插件 metadata、能力、权限、类型。

## 调用时机

| 时机 | 调用 |
| --- | --- |
| 进入插件页面 | 只读本地已安装列表和 catalog 缓存，不更新订阅。 |
| 添加订阅 | 保存订阅后，读取订阅的 `catalog.json`，归一化展示字段并刷新 catalog 缓存。 |
| 点击“更新订阅” | 遍历订阅，读取每个 `catalog.json`，不为展示列表预下载 `.wasm`。 |
| 本地文件安装 | 读取本地 `.wasm`，调用 `metadata`，生成 installed manifest。 |
| 安装 catalog 插件 | 下载 `entry` 指向的 `.wasm` 并调用 `metadata`，以插件本体为准生成 manifest。 |
| 在线搜索 | 调用已启用且有 `search` 能力的插件 `search`。 |
| 播放在线歌曲 | 先调用 `qualities`，再按音质调用 `play`。 |
| 歌词获取 | 调用有 `lyrics` 能力的插件 `lyrics`。 |
| 插件请求网络 | 插件返回 `hostRequest`，Host 执行后回调 `host_response`。 |

## 标准 action

| action | 入参摘要 | 返回摘要 |
| --- | --- | --- |
| `metadata` | `{ "action": "metadata" }` | `ApiResponse<PluginMetadata>`。 |
| `search` | `keyword/page/pageSize` | `ApiResponse<{ tracks, isEnd }>`。 |
| `qualities` | `track` | `ApiResponse<{ qualities, defaultQuality }>`。 |
| `play` | `track/quality/includeMetadata` | `ApiResponse<{ url, artwork?, quality?, lyrics? }>`。 |
| `lyrics` | `track` | `ApiResponse<{ providerId?, providerName?, trackId?, defaultFormat?, lyrics: Array<{ format, content, sourceUrl?, quality? }> }>`。 |
| `host_response` | 原请求、Host 请求、HTTP 响应 | 最终 `ApiResponse`，或继续返回裸 `hostRequest`。 |

详细字段见 [wasm-plugin-development.md](wasm-plugin-development.md)。

## 网络权限

插件不能直接访问系统网络。网络请求必须走 `hostRequest`：

```json
{
  "hostRequest": {
    "method": "GET",
    "url": "https://example.com/api",
    "headers": {},
    "data": null
  }
}
```

Host 规则：

- 插件 metadata 必须声明 `permissions: ["network"]`。
- URL 必须是 HTTP(S)。
- 危险 header 会被拒绝。
- GET/HEAD 不能带 body。
- 单次插件调用最多允许 16 次 Host 请求。

## 不要做的事

- 不要新增 JS 插件回退入口。
- 不要让前端直接调用 WASM。
- 不要让前端归一化搜索、播放、歌词结果。
- 不要在前端推断插件 `kind/capabilities/permissions/version/author`。
- 不要让 Rust 用文件名、URL、能力列表去猜 metadata。
- 不要在插件里写死用户 Cookie、token 或隐私数据。
- 不要让 catalog 字段覆盖插件自己的 metadata。
- 不要返回裸业务对象作为最终响应，例如 `{ "tracks": [] }`。
- 不要返回裸错误对象作为最终响应，例如 `{ "error": "..." }`。

## 验收规则

插件可用至少需要满足：

- `metadata` 校验通过。
- 插件管理页能展示名称、版本、作者、能力和状态。
- `search` 能返回可展示结果。
- 有 `play` 能力时，`qualities` 返回非空音质列表，`play` 返回可播放 `url`。
- 有 `lyrics` 能力时，`lyrics` 返回 `defaultFormat` 和非空 `lyrics[]`。
- 需要网络时，metadata 声明 `network`，所有请求都通过 `hostRequest`。
