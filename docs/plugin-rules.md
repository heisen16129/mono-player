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

插件自己的 `metadata` 是权威来源。订阅 catalog 只负责告诉 Host 到哪里读取 `.wasm`。

```json
{
  "plugins": [
    { "url": "https://example.com/plugin.wasm" }
  ]
}
```

Rust 会读取 `.wasm` 并调用：

```json
{ "action": "metadata" }
```

插件必须返回：

```json
{
  "id": "mono-plugin-example",
  "name": "示例音乐",
  "version": "1.0.0",
  "kind": "music",
  "author": "Mono",
  "description": "示例插件",
  "capabilities": ["search", "play", "lyrics"],
  "permissions": ["network"]
}
```

字段规则：

| 字段 | 规则 |
| --- | --- |
| `id` | 必填，稳定唯一，升级版本不要改。 |
| `name` | 必填，用于 UI 展示。 |
| `version` | 必填，字符串，用于 UI 展示和更新判断。 |
| `kind` | 必填，只能是 `music` 或 `lyrics`。 |
| `author` | 可选，作者信息。 |
| `description` | 可选，插件说明。 |
| `capabilities` | 必填，不能为空，只能包含 `search/play/lyrics`。 |
| `permissions` | 可选，缺失时为空权限，不会默认补 `network`。 |

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
| 添加订阅 | 保存订阅后，读取订阅中的 `.wasm`，调用 `metadata`。 |
| 点击“更新订阅” | 遍历订阅，读取每个 `.wasm`，调用 `metadata`，刷新 catalog 缓存。 |
| 本地文件安装 | 读取本地 `.wasm`，调用 `metadata`，生成 installed manifest。 |
| 安装 catalog 插件 | 再次读取 `.wasm` 并调用 `metadata`，以插件本体为准生成 manifest。 |
| 在线搜索 | 调用已启用且有 `search` 能力的插件 `search`。 |
| 播放在线歌曲 | 先调用 `qualities`，再按音质调用 `play`。 |
| 歌词获取 | 调用有 `lyrics` 能力的插件 `lyrics`。 |
| 插件请求网络 | 插件返回 `hostRequest`，Host 执行后回调 `host_response`。 |

## 标准 action

| action | 入参摘要 | 返回摘要 |
| --- | --- | --- |
| `metadata` | `{ "action": "metadata" }` | 插件声明字段。 |
| `search` | `keyword/page/pageSize` | `{ tracks, isEnd }`。 |
| `qualities` | `track` | `{ qualities, defaultQuality }`。 |
| `play` | `track/quality/includeMetadata` | `{ url, artwork?, quality?, lyrics? }`。 |
| `lyrics` | `track/format` | `{ rawLyrics?, lyricsUrl?, formats?, defaultFormat?, format? }`。 |
| `host_response` | 原请求、Host 请求、HTTP 响应 | 最终业务响应。 |

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

## 验收规则

插件可用至少需要满足：

- `metadata` 校验通过。
- 插件管理页能展示名称、版本、作者、能力和状态。
- `search` 能返回可展示结果。
- 有 `play` 能力时，`qualities` 返回非空音质列表，`play` 返回可播放 `url`。
- 有 `lyrics` 能力时，`lyrics` 返回 `rawLyrics` 或 `lyricsUrl`。
- 需要网络时，metadata 声明 `network`，所有请求都通过 `hostRequest`。
