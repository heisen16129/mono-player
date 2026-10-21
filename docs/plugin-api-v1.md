# Mono 公共插件规范 v1

状态：公共 API v1 已落地，24 个随项目插件已完成源码迁移。更新：2026-10-21。验证范围见 [验收记录](plugin-api-progress.md)。

本文是当前宿主与插件共同遵循的规则。配套执行计划见 [改造计划](plugin-api-migration-plan.md)。WASM 开发、播放栏与侧栏指南均遵循本规范。

## 1. 决策与范围

- 所有新插件使用公共协议 v1；不兼容旧插件，不保留旧调用协议转接层。
- 宿主和随项目发布的插件同步升级；第三方旧插件必须重发符合规范的版本。
- 协议不兼容不等于删除用户数据：保留安装记录、用户配置、歌单及分离结果；不自动执行旧插件。
- 保留 Rust、WASM 和现有 WebView 技术，不因 API 统一引入新的 JavaScript 虚拟机或渲染引擎。
- 前端只承担展示、交互、通信适配；Rust 负责插件身份、权限、业务服务及持久化。
- 能力查询在 v1 内用于处理平台和展示位置差异，不用于回退到旧协议。

## 2. 四个概念必须分开

| 概念 | 含义 |
| --- | --- |
| capabilities | 插件向宿主提供的能力，例如音源搜索、歌词渲染、分离处理 |
| permissions | 插件申请使用的宿主能力，例如曲库读取、播放控制 |
| contributions | 插件主动申请的侧栏、播放栏、页面和命令入口 |
| host features | 当前宿主版本、平台和展示位置实际提供的接口 |

有 capability 不自动生成菜单、图标，也不自动授权读取或控制宿主。

## 3. 清单与安装包

统一发布包使用 `.monoplugin.zip`，内部使用 `plugin.json`、可选 WASM 入口与 `ui/` 静态资源。现有单文件 `.wasm` 和旧模块 JSON 不作为新版安装格式。宿主负责解包、资源托管和 SDK 建立，不要求插件自行启动 HTTP 服务来展示普通页面。

```text
plugin.json
dist/plugin.wasm    # 有后台能力的插件才包含
ui/index.html          # 有页面的插件才包含
ui/renderer.mjs        # 有渲染能力的插件才包含
ui/assets/             # 插件自己的静态资源
```

清单示例（小爱音箱只申请播放栏入口）：

```json
{
  "schemaVersion": 1,
  "apiVersion": 1,
  "minHostVersion": "0.1.0",
  "id": "mono-wasm-miot",
  "name": "小爱音箱",
  "version": "2.0.0",
  "kind": "integration",
  "entry": { "wasm": "dist/plugin.wasm" },
  "capabilities": ["speaker-control"],
  "permissions": ["library.read", "playlists.read", "sources.search", "storage", "network", "speaker-service"],
  "contributions": {
    "pages": [{ "id": "speaker", "entry": "ui/index.html", "title": "小爱音箱" }],
    "playbackBar": [{ "id": "open-speaker", "icon": "speaker", "title": "小爱音箱", "pageId": "speaker" }]
  }
}
```

示例版本值仅演示格式；发布前以真实宿主和插件版本填写。

- 包内 `plugin.json` 是安装身份、权限和入口的权威来源；商城目录仅用于发现和展示。WASM metadata 如重复声明身份，必须与清单一致，否则安装失败。
- 同一个插件 ID 更新，不能因显示名称或页面路径改变而丢失用户数据。
- `schemaVersion`、`apiVersion`、`minHostVersion` 在安装和加载时都校验。缺失 v1 声明的旧包拒绝执行，不静默补齐。
- 更新保留配置，按新 schema 验证；新增权限必须重新授权，不静默扩大权限。
- 包路径必须为规范化相对路径，禁止绝对路径、目录穿越和符号链接逃逸；定义解压总大小和文件数量上限。
- builder 生成文件完整性清单，宿主校验后原子切换安装目录。哈希校验不代表发布者身份可信。
- 不提供宿主数据访问能力的外部网站不作为 v1 特权插件页面；v1 插件 UI 使用包内资源，外部内容自行在隔离子页面中展示。

## 4. 公共调用与响应

SDK 名称为 `mono`，例如 `mono.library.listTracks(params)`。iframe、桌面窗口、受管后台服务使用同一方法名、参数模型和错误码；通信方式不影响业务语义。

请求结构：

```ts
type Request = {
  apiVersion: 1;
  requestId: string;
  method: string;
  params: unknown;
};
type Response =
  | { requestId: string; ok: true; data: unknown }
  | { requestId: string; ok: false; error: { code: string; message: string } };
```

- 插件身份不从请求的 pluginId 推断；由宿主创建的实例、连接或会话绑定。
- 消息须校验发送窗口/MessagePort、会话有效性和方法参数；可信 origin 不能代替实例校验。
- SDK 普通调用默认 15 秒超时；任务提交立即返回任务 ID，长任务使用查询与事件，不悬挂一个无限期请求。
- 原生文件选择允许用户交互，默认等待上限为 5 分钟；关闭插件实例会取消 SDK 等待，不会自动重试选择或提交。
- 写操作超时不代表未执行；SDK 不自动重试写操作。队列编辑使用 revision 防止覆盖其他操作。
- 错误码至少包含 INVALID_ARGUMENT、PERMISSION_DENIED、NOT_FOUND、CONFLICT、UNSUPPORTED、PLUGIN_DISABLED、TIMEOUT、CANCELLED、UNAVAILABLE、INTERNAL。
- 对外错误不得包含访问令牌、凭据或无关本机路径。

## 5. 公共方法目录

以下接口均已实现；完整 69 个方法及权限由 [接口索引](plugin-api-methods.md) 列出，并通过 SDK/原生注册表合同测试核对。业务方法必须复用已有业务服务，而不是复制 MCP 或小爱音箱的一份实现。

| 模块 | 方法 | 权限 |
| --- | --- | --- |
| host | getInfo | 无，返回当前实例的受限环境信息 |
| library | listTracks、getTrack、listArtists、listAlbums | library.read |
| playlists | list、get、listTracks | playlists.read |
| playlists | create、update、delete、addTracks、removeTracks、reorderTracks | playlists.write |
| queue | get | player.read |
| queue | play、replace、append、insert、remove、reorder、clear | player.control |
| player | getState | player.read |
| player | playTrack、play、pause、stop、next、previous、seek、setVolume、setMuted、setRate、setMode | player.control |
| favorites | contains、list | favorites.read |
| favorites | set | favorites.write |
| lyrics | parse | 解析调用方提供的文本，不读取文件；无需额外权限 |
| lyrics | get、openSearch | lyrics.read |
| lyrics | setOffset | lyrics.write |
| artwork | get、refresh | artwork.read |
| sources | list、search | sources.search |
| sources | importTracks | sources.import |
| media | prepare | media.read |
| config | get、set | 仅当前插件配置，不接受其他插件 ID |
| storage | get、set、delete、keys | storage，且仅当前插件命名空间 |
| events | subscribe、unsubscribe、poll（SDK 内部） | 与所订阅资源相同的读取权限 |
| audio | subscribeFrames、unsubscribeFrames | audio.read |
| ui | notify、openPage、close、openSettings | 当前插件页面及设置，不接受任意宿主命令 |
| service | getConnection | service.run，获取当前插件后台连接 |
| files | choose、reveal | files.choose / files.reveal |
| window | startDragging | 当前实例对应的窗口权限与展示位置限制 |

分离任务由分离插件自己的 Node 服务实现。公共 SDK 仅提供 service.getConnection、files.choose 和 files.reveal 等通用能力。service.run 授权允许执行本地代码，不是进程级安全沙箱。

`media.prepare(trackId)` 返回 `{ url, expiresAt }`：地址仅监听本机回环，30 分钟有效，支持 GET、HEAD 与单段 Range。插件不应持久保存或直接把这个本机地址发送给其他设备；小爱服务通过自身媒体入口转发给音箱。读取要求消费插件仍具有 `media.read`，在线音源仍已启用、包修订一致且具有 `network` 授权；持续传输期间约每秒复核。过期后重新调用 prepare，不能转回旧接口或原始文件路径。

## 6. 数据约定

- 公开 Track ID 为不透明字符串；适配现有数据库 ID，不把数据库整体重编号。
- 外部音源结果使用 providerId + sourceId 标识，不冒充已入库 Track ID。解析来源与导入曲库是不同操作。
- 小爱音箱数字 ID 在插件内部保留映射；不得成为公共 API ID。
- 曲库、歌单、播放队列、设备队列分别建模。`mono.player` 和 `mono.queue` 仅指 Mono 本机播放器。
- 同一授权范围、同一查询参数和数据修订版本，不同插件应获得一致结果；音箱私有远程集合不得被无条件混入公共曲库。
- Track 基础字段：id、title、artists（字符串数组）、album、duration（秒或 null）、artworkRef、source；默认不暴露文件系统路径及原始音源密钥。
- 歌曲列表统一接受 query、limit、cursor、sort；默认 limit=50，上限 200。排序加入 ID 作为稳定次序。返回 items、nextCursor、revision，total 为可选项。
- 队列条目使用独立 entryId，允许同一歌曲多次出现。删除、重排操作针对 entryId；修改须携带 expectedRevision。
- 音量与人声增益使用 0..1；时间和时长使用秒；当前 0..100 的 UI 控件在展示层换算。
- 播放模式公开枚举固定为 order、loop、single、shuffle、once；适配现有后端模式并测试每种含义。
- 封面与媒体返回受控资源引用/限时地址；不返回宿主通用访问令牌。

## 7. 权限、隔离与能力协商

- 权限检查在宿主每次调用和事件投递时执行，不能只在按钮显示时检查。
- 用户确认的授权独立保存；清单中的申请不等于已经获准。
- config 和 storage 只访问当前插件；配置变化通知只携带插件 ID，不广播配置内容。小爱账号凭据由其受管服务维护，不向其他插件提供。
- network、文件、后台进程、音频采样、曲库写入分别授权。通用存储不等于任意文件访问。
- 普通 iframe 不开放 Tauri API，不共享 MCP 令牌，不通过可伪造 URL 参数确定身份。
- host.getInfo 返回 apiVersion、hostVersion、platform、surface、methods、grantedPermissions。没有权限的方法与平台不支持的方法均不得被误报为可用。
- 停用/卸载使实例会话失效，拒绝未开始的请求，停止事件推送，销毁相关页面。正在执行的不可中断写操作完成后不得继续激活旧会话。

## 8. 页面与入口

`contributions.pages` 注册页面；`sidebar` 和 `playbackBar` 条目通过 pageId 打开页面，或通过 commandId 调用该插件显式导出的命令，两者必须二选一。入口 ID 在插件内唯一；引用目标必须存在。

- 插件不申请就不显示；无入口不占布局空间。不要按 capability 或插件 ID 自动生成。
- 页面和命令都受启用状态、授权及实例生命周期约束；命令名不是任意 Tauri/Rust 函数名。
- 入口 icon 使用标准名称 speaker、audio-lines、plug；其他合法名称显示通用 plug 图标。宿主固定尺寸并显示 title/无障碍标签。
- 当前产品约定：人声／伴奏分离只申请侧栏；小爱音箱只申请播放栏；歌词渲染插件不自动增加主侧栏。
- 插件自行携带样式；通过 host.getInfo().environment 获取主题和语言，不依赖宿主 DOM 或读取宿主 CSS 文件。
- host.getInfo 返回 surface，environment 包含 theme、locale、windowControlsInset、hasPlayerBar、windowSize。订阅 environment 可检测环境变化；窗口尺寸不是插件内容区尺寸，内容区用自身 ResizeObserver。
- 宿主 UI 组件/SDK 负责拖动区域、交互控件排除和窗口按钮避让，不再为具体插件写 60px/120px 补丁或专用 query 参数。
- 普通页、歌词页、桌面窗口是不同 surface；例如 close 只关闭当前插件页面/窗口，不能退出 Mono。

## 9. 生命周期、事件与任务

- 服务生命周期：初始化 → 就绪 → 停用/更新时停止接收新请求 → 资源清理 → 结束。初始化失败显示错误状态，不假装正常运行。
- 页面生命周期：mount → update/events → dispose。离开页面清理页面订阅；不默认终止受管后台任务。
- 停用插件时取消其可取消任务并停止服务；不可中断阶段进入 stopping 状态，界面明确显示，不能提前报告已停止。已完成文件不删除。
- 卸载默认保留用户数据；删除插件数据必须是独立、明确的用户操作。升级保留数据，禁止两个版本同时领取同一任务。
- `mono.events.subscribe(topics, callback, onError?)` 订阅 player、queue、library、playlists、favorites、config、environment。每条事件包含 subscriptionId、sequence、topic、revision、data；首轮返回当前快照，以后仅返回变化的快照。列表快照包含首屏和整体 revision，按查询接口翻页。
- SDK 通过 events.poll 进行有界拉取，业务事件每 500ms 一次，音频帧每 50ms 一次；宿主也限制读取频率（业务至多 4Hz、音频至多 20Hz）。不会积压旧音频帧或重叠轮询。
- SDK dispose 自动取消订阅；宿主关闭最后一个同插件 surface 会话或撤销授权时清理订阅。失联订阅 120 秒失效，每个插件最多 32 个订阅。
- 不要求每个帧事件经过数据库或全局串行锁；有状态写操作按业务资源协调。

## 10. 扩展与技术边界

- 统一公共 API 不等于把所有插件转换为同一种运行时。保留 WASM 的搜索/播放源等供给协议，更新为 v1 包和清单。
- WASM action 是宿主调用插件；mono.* 是插件调用宿主，两者方向必须在文档和类型中区分。
- 有确切需求时增加 WASM host-call 传输；不为了“统一”先搭建没有使用方的运行时。
- 音箱 Node 服务仍是受管扩展，使用插件专属会话访问公共接口，不再持有宿主 MCP 通用令牌。
- 第一版不开放任意插件间 RPC。K 歌与分离的协作通过宿主注册的任务/提供者接口完成，避免绕过权限。

## 11. 不兼容旧插件的处理

- 新宿主拒绝旧协议安装包；既有旧安装记录标为 incompatible，显示原因及更新/卸载入口，不执行旧 WASM、脚本或服务。
- 不提供旧 api.post、旧 miot.* 通信及旧 metadata 字段的运行时转接。
- 可迁移用户数据但不补造新协议声明或静默增加权限。新插件安装成功且权限明确后才能运行。
- 项目内所有实际发布的插件必须同步改造；不发布“新宿主配旧插件”的组合。
- 保留历史安装目录用于显式整体版本回退，不在新版进程中恢复执行旧插件。

## 12. 发布门槛

协议/类型一致性、权限隔离、旧包拒绝、停用撤权、队列并发、页面销毁、任务生命周期、资源路径校验必须有自动化测试。
真实桌面验证覆盖主题/缩放/侧栏收起、标题拖动、按钮点击、歌词切换、分离后台运行、音箱播放。
所有随发行版交付的插件应通过同一 SDK/包校验；新宿主运行时不得残留旧协议分支。

参考：借鉴 [Songloft 插件开发指南](https://songloft.hanxi.cc/js-plugin-development-guide.html) 的 SDK、宿主环境、页面资源及生命周期设计；本文具体协议为 Mono 的公共 API，不是 Songloft API 兼容承诺。

## 13. 实现说明

- 页面资源通过 plugin-page 协议托管，iframe 只有 allow-scripts；不会授予 allow-same-origin 或 Tauri。服务会话和页面会话共用原生 dispatcher。
- Mineradio 内含动态着色器/运行时代码，因此包页面 CSP 允许 unsafe-eval；这不授予宿主权限。network 权限控制 connect-src，宿主 API 始终逐请求授权。
- 队列 entryId 是快照修订和条目位置构成的不透明值。任何编辑后重新读取返回的队列，不自行拼接 entryId；整队列重排必须完整且无重复 entryId。清空队列不等于 player.stop。
- 公共播放模式 order 为顺序不回绕，loop 为队列循环，single 为单曲循环，shuffle 为随机顺序，once 为当前曲结束后停止。内部播放器旧枚举不属于插件协议。
- 搜索结果只可由见过该结果的调用插件导入；搜索缓存闲置 10 分钟失效，最多保留 2000 首。曲库中的 imported_tracks 与本地扫描曲目共用公共 Track ID 规则。
- 原子安装更新会核对包修订、完整性及 WASM metadata；配置不符合新 schema 时拒绝更新并保留旧记录。卸载撤销授权但保留用户配置、插件存储和已完成输出。


lyrics.parse({content, format?}) 复用宿主歌词解析器，返回 LyricLine[]，time 和逐字 time/duration 单位均为秒；无时间行 time 为 null，words/duration 为可选字段。支持 lrc/yrc/qrc/krc/a2/txt/trans，不指定 format 时沿用宿主自动识别。content 上限 1 MiB，不接受路径或 URL，不读取文件或自动请求网络。格式为已解码文本，不解密压缩的 KRC/QRC 文件。
