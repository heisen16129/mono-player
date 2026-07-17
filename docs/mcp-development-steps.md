# Mono Player MCP 功能开发步骤

## 目标

把 Mono Player 增加为可被外部 MCP Host 调用的本地 MCP Server。当前架构采用“协议入口 + 主进程桥接”：

- MCP server 只负责 MCP HTTP 协议解析和工具转发。
- Mono Player Tauri 主进程负责读取曲库和执行应用能力。
- MCP server 不直接打开 SQLite 数据库，也不需要数据库路径环境变量。

## 成功标准

1. 启动 Mono Player 主应用后，HTTP MCP 自动监听 `http://127.0.0.1:17331/mcp`。
2. 应用仍可通过 `mono-player.exe --mono-mcp-http-server` 单独启动 MCP HTTP server，用于调试或特殊部署。
3. MCP server 能响应 `initialize`、`tools/list`、`tools/call`、`resources/list` 和 `resources/read`。
4. Tauri 主进程启动后，会创建本地 MCP bridge，并写入桥接文件。
5. MCP 工具调用通过 bridge 调用正在运行的 Mono Player 主进程。
6. `cargo check` 和 `cargo test` 通过，并完成 MCP HTTP 手动验证。

## 架构说明

### MCP server 进程

HTTP 入口，当前默认使用：

```powershell
mono-player.exe
```

启动主应用后，HTTP MCP 会自动监听：

```powershell
http://127.0.0.1:17331/mcp
```

HTTP 独立调试入口：

```powershell
mono-player.exe --mono-mcp-http-server --port 17331
```

职责：
- 处理 MCP HTTP JSON-RPC：`POST /mcp`。
- 提供 HTTP 健康检查：`GET /health`。
- 返回工具清单。
- 把工具调用转发到主进程 bridge。
- 主进程未运行时返回清晰错误。

HTTP 边界：
- 默认监听 `127.0.0.1`。
- 可通过 `--host` 和 `--port` 指定监听地址。
- 当 `--host` 不是 `127.0.0.1` 或 `localhost` 时，必须传入 `--token`。
- token 可通过 `Authorization: Bearer <token>` 或 `x-mono-mcp-token: <token>` 提交。

不负责：
- 不直接读取 SQLite。
- 不启动 Tauri UI。
- 不直接执行播放、下载、扫描等应用逻辑。

### Tauri 主进程 MCP bridge

主进程启动后会监听 `127.0.0.1` 的随机本地端口，并把桥接信息写入应用数据目录：

```text
mcp-bridge.json
```

bridge 文件包含：
- `port`
- `token`
- `pid`
- `startedAtMs`

MCP server 读取该文件后，使用本地 HTTP 请求转发工具调用。bridge 使用 token 做最小本地鉴权，并且只监听 `127.0.0.1`。

## 阶段结果

### Step 1: 梳理接入边界

计划：
- 第一版只暴露只读曲库工具。
- MCP server 不直接接触数据库。
- 应用数据由正在运行的 Mono Player 主进程提供。

执行结果：
- 已确认曲库读取逻辑保留在主进程侧。
- MCP 进程只作为协议入口。

状态：已完成

### Step 2: 新增主进程 bridge

计划：
- 新增 `src-tauri/src/mcp_bridge.rs`。
- Tauri setup 阶段启动本地 bridge。
- bridge 复用 `AppState` 中的 SQLite 连接读取曲库。

执行结果：
- 已新增 `src-tauri/src/mcp_bridge.rs`。
- 已在 `src-tauri/src/lib.rs` 的 setup 中启动 bridge。
- bridge 支持：
  - `library.summary`
  - `library.listTracks`
  - `library.getTrack`

状态：已完成

### Step 3: 新增 MCP 协议入口

计划：
- 新增 `src-tauri/src/mcp.rs`。
- 在 worker 参数分发中增加 MCP server 启动入口。
- MCP `tools/call` 转发到 bridge。

执行结果：
- 已新增 `src-tauri/src/mcp.rs`。
- 当前保留 HTTP MCP 启动入口 `--mono-mcp-http-server`。
- 旧 stdio MCP 启动入口 `--mono-mcp-server` 已移除。
- 已移除旧版 `--db` 和 `MONO_MCP_DB_PATH` 数据库路径配置。
- 可选支持 `--bridge <path>` 指定 bridge 文件，主要用于测试或特殊部署；默认使用应用数据目录下的 `mcp-bridge.json`。

状态：已完成

### Step 4: 实现最小 MCP 协议

计划：
- 支持 `initialize`。
- 支持 `tools/list`。
- 支持 `tools/call`。
- 对 notification 不返回响应。
- 对未知方法返回 JSON-RPC error。

执行结果：
- 已支持 `initialize`。
- 已支持 `tools/list`。
- 已支持 `tools/call`。
- 已支持 notification：没有 `id` 的请求不会返回响应。
- 未知方法会返回 JSON-RPC `-32601` error。

状态：已完成

### Step 5: 暴露只读曲库工具

第一版工具：
- `mono_library_summary`：通过主进程返回曲目数量。
- `mono_list_tracks`：通过主进程按关键词和数量限制返回曲目列表。
- `mono_get_track`：通过主进程按曲目 ID 返回单曲信息。
- `mono_list_artists`：列出曲库歌手并统计曲目数量。
- `mono_list_albums`：列出曲库专辑并统计曲目数量。
- `mono_list_playlists`：列出用户歌单。
- `mono_get_playlist`：按歌单 ID 返回歌单曲目。

执行结果：
- 已实现 `mono_library_summary`。
- 已实现 `mono_list_tracks`。
- 已实现 `mono_get_track`。
- 已实现 `mono_list_artists`。
- 已实现 `mono_list_albums`。
- 已实现 `mono_list_playlists`。
- 已实现 `mono_get_playlist`。
- `mono_list_tracks` 支持：
  - `query`：匹配标题、艺术家、专辑、路径。
  - `limit`：默认 50，最大 200。

状态：已完成

### Step 6: 暴露播放状态和播放控制工具

新增工具：
- `mono_player_state`：查看当前播放状态、进度、音量、倍速和缓冲状态。
- `mono_queue_snapshot`：查看当前播放队列、当前索引和播放模式。
- `mono_play_track`：按曲库 track id 播放。
- `mono_pause`：暂停播放。
- `mono_resume`：继续播放当前曲目。
- `mono_stop`：停止播放。
- `mono_next`：下一首。
- `mono_previous`：上一首。
- `mono_seek`：跳转到指定秒数。
- `mono_set_volume`：设置音量，范围 0 到 1。

执行结果：
- 播放状态和队列读取通过主进程 `PlayerState` / audio worker 完成。
- 播放控制通过主进程 bridge 转发到现有 player/audio worker 逻辑。
- `mono_play_track` 只接受曲库内 track id，不接受任意路径，避免外部 MCP 直接播放未知文件路径。

状态：已完成

### Step 7: 暴露在线音乐相关工具

新增工具：
- `mono_search_online_music`：通过插件搜索在线音乐。
- `mono_resolve_playback_url`：把在线音乐结果解析成真实播放地址。
- `mono_play_online_music`：播放在线音乐 URL。
- `mono_get_lyrics`：获取歌词。
- `mono_get_cover`：获取封面。
- `mono_download_track`：下载在线歌曲到本地。

执行结果：
- 已新增全部 6 个 MCP tool 名称和 schema。
- `mono_play_online_music` 已支持直接播放 HTTP/HTTPS URL。
- `mono_get_lyrics` 已支持：
  - 直接传入 `rawLyrics` / `lyrics`。
  - 按本地曲库 `id` 或本地 `path` 读取本地歌词文件。
- `mono_get_cover` 已支持：
  - 直接传入 `artwork` URL。
  - 按本地曲库 `id` 或本地 `path` 读取本地封面。
- `mono_download_track` 已支持下载已解析的 HTTP/HTTPS URL，并默认进入下载队列。
- `mono_search_online_music` 已改为通过 Rust 主进程内的 `PluginWorkerState` 调用已安装并启用的插件。
- `mono_resolve_playback_url` 已支持两种输入：
  - 直接传入已解析好的 `url` 并规范化返回。
  - 传入在线搜索结果 `track` / `source`，按 `providerId` 调用对应插件解析真实播放地址。
- `mono_play_online_music` 在未传入直链时，会先通过插件解析在线歌曲，再交给播放器播放 URL。

架构调整结果：
- MCP 不依赖前端插件运行时。
- MCP bridge 从 Tauri Store 的 `plugins.installed` 读取插件清单。
- 插件执行统一复用 Rust 侧 `plugin_invoke` 背后的 `PluginWorkerState::invoke_plugin`，保持“MCP 只作为协议入口”的架构。

状态：已完成

## 外部客户端配置示例

先启动 Mono Player 主应用。主应用会自动启动 HTTP MCP，然后配置 MCP Host：

```json
{
  "mcpServers": {
    "mono-player-http": {
      "type": "http",
      "url": "http://127.0.0.1:17331/mcp"
    }
  }
}
```

当前 Trae 等 HTTP MCP 客户端使用上面的配置即可，不需要再配置或启动 stdio MCP server。

HTTP MCP server 正常由主应用自动启动。特殊情况下也可单独启动：

```powershell
mono-player.exe --mono-mcp-http-server --port 17331
```

如果需要显式 bridge 文件路径：

```powershell
mono-player.exe --mono-mcp-http-server --port 17331 --bridge "C:\Users\<你的用户名>\AppData\Roaming\com.local.mono-player\mcp-bridge.json"
```

HTTP endpoint：
- `GET http://127.0.0.1:17331/health`
- `POST http://127.0.0.1:17331/mcp`

HTTP 请求示例：

```powershell
$body = @{
  jsonrpc = "2.0"
  id = 1
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Depth 20 -Compress

Invoke-RestMethod `
  -Uri "http://127.0.0.1:17331/mcp" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

如果监听非本机地址，必须加 token：

```powershell
mono-player.exe --mono-mcp-http-server --host 0.0.0.0 --port 17331 --token "<你的 token>"
```

## 验证记录

已执行：

```powershell
cd D:\work\rust\mono\src-tauri
cargo fmt
cargo check
cargo test mcp
cargo test
cargo build
```

MCP HTTP 基础验证：

```powershell
$exe = Join-Path (Get-Location) 'target\debug\mono-player.exe'
$proc = Start-Process -FilePath $exe -PassThru -WindowStyle Hidden
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:17331/health" -Method Get
  $body = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
    params = @{
      protocolVersion = "2024-11-05"
      clientInfo = @{ name = "manual-http"; version = "0" }
    }
  } | ConvertTo-Json -Depth 20 -Compress
  Invoke-RestMethod -Uri "http://127.0.0.1:17331/mcp" -Method Post -ContentType "application/json" -Body $body
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
```

验证结果：
- `GET /health` 返回 `ok: true`、`server: mono-player` 和 `transport: http`。
- `initialize` 返回 `protocolVersion`、`capabilities.tools` 和 `serverInfo`。
- `tools/list` 可通过 `POST /mcp` 返回 `mono_library_summary`、`mono_list_tracks`、`mono_get_track`。
- 主进程未运行时 HTTP MCP 不会自动可用，客户端会连接失败或健康检查失败。

`tools/call` 验证需要 Mono Player 主进程正在运行，因为工具调用现在通过主进程 bridge 执行。

已完成一次主进程 bridge 端到端验证：

```powershell
$exe = Join-Path (Get-Location) 'target\debug\mono-player.exe'
$bridge = Join-Path $env:APPDATA 'com.local.mono-player\mcp-bridge.json'
$proc = $null
try {
  $proc = Start-Process -FilePath $exe -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline -and -not (Test-Path $bridge)) { Start-Sleep -Milliseconds 250 }
  if (-not (Test-Path $bridge)) { throw "bridge file was not created: $bridge" }
  $body = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
      name = "mono_library_summary"
      arguments = @{}
    }
  } | ConvertTo-Json -Depth 20 -Compress
  Invoke-RestMethod -Uri "http://127.0.0.1:17331/mcp" -Method Post -ContentType "application/json" -Body $body
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
```

验证结果：
- Tauri 主进程成功创建 `mcp-bridge.json`。
- MCP server 通过 bridge 调用 `mono_library_summary` 成功。
- 返回结果来自主进程当前曲库状态。

新增工具抽样验证：
- `tools/list` 已能返回新增曲库、歌单、播放状态和播放控制工具。
- `mono_list_artists` 可通过 bridge 返回歌手统计。
- `mono_list_albums` 可通过 bridge 返回专辑统计。
- `mono_list_playlists` 可通过 bridge 从 Tauri Store 返回歌单列表。
- `mono_player_state` 可通过 bridge 返回 audio worker 播放状态。
- `mono_queue_snapshot` 可通过 bridge 返回当前队列状态。
- 播放控制工具已完成编译和协议映射验证；自动验证阶段未主动播放音乐，避免产生声音或改变用户当前播放体验。
- 在线工具抽样验证：
  - `mono_resolve_playback_url` 可直接返回传入的 HTTP/HTTPS URL。
  - `mono_get_lyrics` 可直接返回传入的 `rawLyrics`。
  - `mono_get_cover` 可直接返回传入的 `artwork` URL。
  - `mono_search_online_music` 已通过 bridge 调用 Rust 插件 worker，使用已启用插件 `mono-native-wasm-xiaoyun` 搜索成功返回在线歌曲。
  - `mono_resolve_playback_url` 已使用搜索结果中的 `track.raw` 调用同一插件解析成功，返回真实 HTTP 播放地址和歌词。
  - `mono_play_online_music` 已支持“传入在线 track 后先解析再播放”的路径；自动验证阶段未主动播放，避免产生声音。
  - `mono_download_track` 已完成编译与协议映射验证；自动验证阶段未主动下载，避免网络下载和文件写入副作用。

### Step 8: 完成后续建议

本步骤处理原“后续建议”中的剩余能力：

执行结果：
- `mono_play_track` 已在 Step 6 完成：只接受曲库内 track id，由主进程转发到 audio worker。
- `mono_scan_folder` 已新增：
  - 必须传入明确的本地目录 `path`。
  - 目录不存在或不是文件夹时返回错误。
  - 扫描执行复用主进程已有 scan worker。
  - 扫描结果写入曲库，并清理该目录下已不存在的旧曲目。
  - 返回 `scannedTrackCount` 和 `libraryTrackCount`。
- `mono_download_track` 已在 Step 7 完成：
  - 必须传入 HTTP/HTTPS URL 和标题。
  - 写入目录来自 `downloadDir` 或 Mono Player 设置中的下载目录。
  - 默认进入下载队列，返回 `taskId`。
- 已新增 MCP resources：
  - `mono://library/summary`
  - `mono://library/tracks`
  - `mono://playlists`
  - `mono://player/state`
  - `mono://player/queue`

验证结果：
- `tools/list` 已返回 `mono_scan_folder`。
- `resources/list` 已返回 5 个只读资源。
- `resources/read` 读取 `mono://library/summary` 成功返回当前曲库数量。
- 使用临时空目录调用 `mono_scan_folder` 成功，返回 `scannedTrackCount: 0` 和当前 `libraryTrackCount`。

状态：已完成

### Step 9: 修复 MCP 在线播放显示错歌

问题：
- 外部 MCP 客户端调用 `mono_play_online_music` 后，音频 worker 会播放传入 URL。
- 但旧实现只更新了后端 `current_source`，没有把在线歌曲的标题、歌手、专辑等 metadata 写入播放队列。
- 前端播放器底栏依赖 `player://queue` 事件里的队列曲目更新当前显示，因此会继续显示旧的本地队列歌曲，看起来像“播放器播放的音乐不对”。

执行结果：
- 新增 MCP 在线播放专用 metadata 结构。
- `mono_play_online_music` 现在会把在线歌曲构造成单独队列曲目：
  - 使用负数 ID，避免和本地曲库 ID 冲突。
  - 写入 URL、标题、歌手、专辑、时长、封面、歌词和 provider 信息。
  - 将后端队列重置为当前在线歌曲，并广播 `player://queue`。
- 这样前端底栏、队列快照和实际音频 URL 会保持一致。

验证结果：
- 使用本机临时 HTTP 静音音频模拟在线歌曲调用 `mono_play_online_music`。
- `mono_queue_snapshot` 返回：
  - `currentIndex: 0`
  - `currentSource` 为本次在线 URL
  - `tracks` 只有本次在线歌曲
- 旧本地队列不会再残留为当前显示歌曲。

状态：已完成

### Step 10: 修复前端底部播放栏不接收 MCP 队列更新

问题：
- Step 9 已让后端在 MCP 播放在线音乐时广播 `player://queue`。
- 但前端主界面只在主动点击播放、上一首、下一首等路径里调用 `handleRustQueueSnapshot`。
- MCP 是外部进程触发播放，前端没有主动调用这些函数；如果没有监听 `player://queue`，底部播放栏仍会显示旧歌曲。

执行结果：
- 在 `App.vue` 中新增 Rust 队列事件监听：
  - 启动时调用 `listenRustBackendQueue`。
  - 收到 `player://queue` 后复用 `handleRustQueueSnapshot`。
  - 组件卸载时取消监听。
- 这样 MCP 播放、下一首、上一首或后端队列变化都会同步到底部播放栏。

验证结果：
- `npm run build` 通过，包含 `vue-tsc --noEmit` 类型检查和 Vite 构建。
- `cargo check` 通过。

状态：已完成

### Step 11: 新增 MCP HTTP 入口

目标：
- 新增 HTTP MCP server，继续保持“MCP 只作为协议入口，主进程 bridge 执行真实能力”的架构。

执行结果：
- 新增启动参数：
  - `--mono-mcp-http-server`
- 新增 HTTP 参数：
  - `--host`：默认 `127.0.0.1`。
  - `--port`：默认 `17331`。
  - `--token`：可选 token；监听非本机地址时必填。
  - `--bridge`：可选 bridge 文件路径。
- 新增 HTTP endpoint：
  - `GET /health`：健康检查。
  - `POST /mcp`：接收单条 MCP JSON-RPC 请求。
- HTTP MCP 支持以下协议方法：
  - `initialize`
  - `tools/list`
  - `tools/call`
  - `resources/list`
  - `resources/read`
- token 支持两种提交方式：
  - `Authorization: Bearer <token>`
  - `x-mono-mcp-token: <token>`

验证结果：
- 启动 Mono Player 主进程后，启动：
  - `mono-player.exe --mono-mcp-http-server --port 17332 --bridge <mcp-bridge.json>`
- `GET /health` 返回：
  - `ok: true`
  - `server: mono-player`
  - `transport: http`
- `POST /mcp` 调用 `initialize` 成功返回 serverInfo 与 capabilities。
- `POST /mcp` 调用 `tools/list` 成功返回工具列表。
- `POST /mcp` 调用 `resources/read` 读取 `mono://library/summary` 成功返回当前曲库数量。
- `cargo check`、`cargo test`、`cargo build` 均通过。

状态：已完成

### Step 12: 主应用自动启动 HTTP MCP

目标：
- 用户启动 Mono Player 主程序后，HTTP MCP 自动可用。
- Trae 等 HTTP MCP 客户端只需要配置 `http://127.0.0.1:17331/mcp`，不需要再手动启动 `--mono-mcp-http-server`。

执行结果：
- 在 Tauri `setup` 阶段启动内部 bridge 后，自动启动 HTTP MCP server：
  - host：`127.0.0.1`
  - port：`17331`
  - token：无，本机访问
- 自动启动复用 Step 11 的同一套 HTTP MCP 处理逻辑。
- 如果端口已被占用，主应用不会启动失败，只会跳过自动启动并打印错误。
- 独立启动方式仍然保留：
  - `mono-player.exe --mono-mcp-http-server --port 17331`

验证结果：
- 清理旧的 debug 进程后，只启动主应用：
  - `mono-player.exe`
- 未手动启动 `--mono-mcp-http-server`。
- `GET http://127.0.0.1:17331/health` 成功返回：
  - `ok: true`
  - `server: mono-player`
  - `transport: http`
- `cargo fmt`、`cargo check`、`cargo test`、`cargo build` 均通过。

状态：已完成

### Step 13: 对外配置不再需要 stdio MCP server

目标：
- Trae 等支持 HTTP MCP 的客户端只配置 HTTP endpoint。
- 用户不再需要、也不能再启动或配置 `mono-player.exe --mono-mcp-server`。

执行结果：
- 文档中的默认 MCP 配置已改为：
  - `type: "http"`
  - `url: "http://127.0.0.1:17331/mcp"`
- 成功标准已改为以 HTTP MCP 自动启动和 HTTP 手动验证为主。
- stdio MCP server 入口已从代码中移除：
  - 移除 `--mono-mcp-server` worker 分发。
  - 移除 stdin/stdout MCP server 启动函数。
  - 保留内部 JSON-RPC 处理函数供 HTTP MCP 复用。
- 旧参数 `--mono-mcp-server` 现在会明确报错退出，不会误启动主应用。

验证结果：
- `mono-player.exe --mono-mcp-server` 返回退出码 `1`。
- 错误信息提示改用自动启动的 HTTP MCP endpoint：`http://127.0.0.1:17331/mcp`。
- `cargo fmt`、`cargo check`、`cargo test`、`cargo build` 均通过。

状态：已完成
