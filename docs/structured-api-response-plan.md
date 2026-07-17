# 统一返回结构改造计划

## 目标

为项目增加统一返回结构：

```ts
type ApiResponse<T> = {
  code: 1 | 0;
  message: string;
  data: T | null;
};
```

约定：

- `code = 1`：成功
- `code = 0`：失败
- `message`：用户可见提示，成功时可为 `操作成功`，失败时为错误信息
- `data`：泛型业务数据，无数据时为 `null`

改造原则：先统一边界层，再逐步收口内部实现。Rust 内部函数第一阶段可以继续保留 `Result<T, String>`，在 Tauri command 或 service 边界转换成统一响应。

## 执行方式

每完成一个计划项，都回写本文档：

- 将该项状态从 `未开始` 改为 `已完成`
- 填写完成时间
- 补充实际改动文件
- 记录验证结果
- 如有偏离计划，写入备注

## 计划 1：定义统一返回模型

状态：已完成

目标：

在前端和后端分别定义统一响应结构，确保字段命名和语义一致。

后端建议结构：

```rust
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiResponse<T> {
    pub(crate) code: u8,
    pub(crate) message: String,
    pub(crate) data: Option<T>,
}
```

前端建议类型：

```ts
export type ApiResponse<T> = {
  code: 1 | 0;
  message: string;
  data: T | null;
};
```

验证：

- 字段固定为 `code`、`message`、`data`
- 成功固定使用 `code = 1`
- 失败固定使用 `code = 0`
- 无业务数据时 `data = null`

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：`src-tauri/src/api_response.rs`、`src/services/api.ts`、`src-tauri/src/lib.rs`
- 验证结果：已定义 Rust `ApiResponse<T>` 和前端 `ApiResponse<T>`，字段统一为 `code`、`message`、`data`
- 备注：无

## 计划 2：增加后端统一构造函数

状态：已完成

目标：

为 Rust 的 `ApiResponse<T>` 增加统一构造方法，避免各处手写响应结构。

建议方法：

```rust
impl<T> ApiResponse<T> {
    pub(crate) fn success(data: T) -> Self;
    pub(crate) fn success_message(message: impl Into<String>, data: T) -> Self;
    pub(crate) fn ok() -> ApiResponse<()>;
    pub(crate) fn error(message: impl Into<String>) -> Self;
}
```

验证：

- 成功响应由 helper 统一生成
- 失败响应由 helper 统一生成
- `Result<(), String>` 场景可以返回 `data = null`

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：`src-tauri/src/api_response.rs`
- 验证结果：已增加 `success`、`success_message`、`ok`、`error`、`from_result`、`from_empty_result` helper
- 备注：无

## 计划 3：先改 Tauri command 边界

状态：已完成

目标：

先从 Tauri command 的返回边界开始统一，不急着改所有内部函数。

推荐顺序：

1. 播放相关命令
2. 下载相关命令
3. 插件搜索和插件管理命令
4. 元数据修改命令
5. 扫描目录命令

转换方式：

```rust
match do_something() {
    Ok(data) => ApiResponse::success(data),
    Err(error) => ApiResponse::error(error),
}
```

对于原本返回 `Result<(), String>` 的命令：

```json
{
  "code": 1,
  "message": "操作成功",
  "data": null
}
```

验证：

- 前端通过 `invoke` 收到统一响应壳
- 成功不再返回裸数据
- 失败不再直接抛出裸字符串作为主要业务错误
- 原有内部 `Result<T, String>` 不做大规模重构

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：`src-tauri/src/player.rs`、`src-tauri/src/downloads.rs`、`src-tauri/src/plugins.rs`、`src-tauri/src/database.rs`、`src-tauri/src/scanner.rs`、`src-tauri/src/covers.rs`、`src-tauri/src/lyrics.rs`、`src-tauri/src/diagnostics.rs`、`src-tauri/src/themes.rs`、`src-tauri/src/store.rs`、`src-tauri/src/system_media.rs`、`src-tauri/src/tray.rs`、`src-tauri/src/shell.rs`、`src-tauri/src/mcp_bridge.rs`
- 验证结果：`cargo check` 通过
- 备注：带 `State` 引用的 async Tauri command 按框架要求返回 `Result<ApiResponse<T>, String>`，业务响应体仍是 `{ code, message, data }`

## 计划 4：前端增加统一调用封装

状态：已完成

目标：

新增前端 `invokeApi<T>()`，统一消费 `{ code, message, data }`，让组件层继续使用简单的 `try/catch`。

建议实现：

```ts
export async function invokeApi<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const response = await invoke<ApiResponse<T>>(command, args);
  if (response.code !== 1) {
    throw new Error(response.message || '操作失败');
  }
  return response.data as T;
}
```

验证：

- `code !== 1` 时统一抛出 `Error`
- 成功时只把 `data` 返回给业务 service
- 组件层现有错误展示逻辑可以继续读取 `error.message`

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：`src/services/api.ts`
- 验证结果：`npm run build` 通过
- 备注：`invokeApi<T>()` 暂时保留旧裸返回兼容，便于渐进迁移

## 计划 5：分批替换前端 service

状态：已完成

目标：

将 `src/services/*` 中直接使用 `invoke` 的地方逐步替换为 `invokeApi`。

推荐顺序：

1. `src/services/playerBackend.ts`
2. `src/services/downloads.ts`
3. `src/services/pluginSearch.ts`
4. `src/services/plugins.ts`
5. `src/services/music.ts`
6. 其他零散 service

示例：

```ts
export function downloadLyricsFile(request: DownloadLyricsRequest) {
  return invokeApi<DownloadLyricsResult>('download_lyrics_file', { request });
}
```

验证：

- service 对组件仍然返回原业务数据
- 组件不需要直接判断 `code`
- 失败时仍然进入现有 `catch` 分支

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：`src/services/playerBackend.ts`、`src/services/downloads.ts`、`src/services/pluginSearch.ts`、`src/services/plugins.ts`、`src/services/music.ts`、`src/services/persistentStore.ts`、`src/services/systemMedia.ts`、`src/components/TrayMenu.vue`
- 验证结果：`npm run build` 通过
- 备注：`exit_app` 会直接退出应用，`src/services/music.ts` 中保留原始 `invoke`

## 计划 6：统一无返回值命令

状态：已完成

目标：

统一处理原本返回 `Result<(), String>` 的命令，确保它们成功时返回 `data = null`。

典型命令：

- 删除下载文件
- 打开所在文件夹
- 暂停、停止、跳转播放
- 清理缓存
- 保存设置

验证：

- 成功响应为 `{ code: 1, message: '操作成功', data: null }`
- 前端 `invokeApi<void>` 或 `invokeApi<null>` 的使用保持一致
- 不出现某些命令返回裸 `null`，某些命令返回统一响应的混用状态

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：`src-tauri/src/api_response.rs`、`src-tauri/src/player.rs`、`src-tauri/src/downloads.rs`、`src-tauri/src/database.rs`、`src-tauri/src/covers.rs`、`src-tauri/src/store.rs`、`src-tauri/src/system_media.rs`、`src-tauri/src/tray.rs`、`src-tauri/src/shell.rs`
- 验证结果：`cargo check`、`npm run build` 均通过
- 备注：无返回值命令统一通过 `ApiResponse::ok()` 或 `ApiResponse::from_empty_result(...)` 返回 `data = null`

## 计划 7：评估 worker 协议是否跟进

状态：已完成

目标：

评估内部 worker 协议是否也需要从当前结构：

```rust
WorkerMessage::Response {
    ok,
    payload,
    error,
}
```

迁移为统一的：

```json
{
  "code": 1,
  "message": "操作成功",
  "data": {}
}
```

建议：

第一阶段先不改 worker 协议，只在 Tauri command 边界转换。worker 是内部进程通信，改动面更大，适合等外部边界稳定后单独处理。

验证：

- 主应用边界已经统一
- worker 内部协议没有影响用户可见返回
- 如果决定跟进，单独拆一个小计划改 worker

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：无
- 验证结果：`cargo test` 中 worker 相关测试通过
- 备注：worker 是内部进程通信，暂不迁移；后续如要统一，建议单独拆迁移计划

## 计划 8：测试和回归

状态：已完成

目标：

完成统一返回结构后，验证成功、失败、异步事件和 UI 展示路径都正常。

重点场景：

- 成功命令返回 `code = 1`
- 失败命令返回 `code = 0`
- 失败时 `message` 能直接展示给用户
- 无业务数据时 `data = null`
- 下载队列失败提示正常
- 插件搜索失败提示正常
- 播放失败提示正常
- 元数据保存失败提示正常
- 扫描目录失败提示正常

建议命令：

```powershell
npm run build
cd src-tauri
cargo test
```

验证：

- 前端构建通过
- Rust 测试通过
- 手动触发关键失败场景，UI 能展示 `message`

完成记录：

- 完成时间：2026-07-17
- 实际改动文件：无代码改动，仅验证
- 验证结果：`cargo check` 通过；`cargo test` 25 个测试全部通过；`npm run build` 通过
- 备注：首次 `npm run build` 在沙箱中因 `esbuild` 子进程 `spawn EPERM` 失败，提升权限重跑后通过；尚未做手动 UI 点击回归

## 当前状态

- 总体状态：统一返回结构第一阶段已完成
- 下一步：手动打开应用验证播放、下载、插件搜索、扫描目录、元数据编辑等关键交互的错误提示展示
## 执行记录（2026-07-17）

总体状态：统一返回结构第一阶段已完成。

计划 1：已完成。

- 完成内容：定义 Rust `ApiResponse<T>` 和前端 `ApiResponse<T>`。
- 改动文件：`src-tauri/src/api_response.rs`、`src-tauri/src/lib.rs`、`src/services/api.ts`。
- 验证结果：字段统一为 `code`、`message`、`data`。

计划 2：已完成。

- 完成内容：增加后端统一构造函数。
- 改动文件：`src-tauri/src/api_response.rs`。
- 验证结果：已增加 `success`、`success_message`、`ok`、`error`、`from_result`、`from_empty_result`。

计划 3：已完成。

- 完成内容：前端实际调用到的 Tauri command 已统一返回 `ApiResponse<T>` 或 `Result<ApiResponse<T>, String>`。
- 改动文件：`src-tauri/src/player.rs`、`src-tauri/src/downloads.rs`、`src-tauri/src/plugins.rs`、`src-tauri/src/database.rs`、`src-tauri/src/scanner.rs`、`src-tauri/src/covers.rs`、`src-tauri/src/lyrics.rs`、`src-tauri/src/diagnostics.rs`、`src-tauri/src/themes.rs`、`src-tauri/src/store.rs`、`src-tauri/src/system_media.rs`、`src-tauri/src/tray.rs`、`src-tauri/src/shell.rs`、`src-tauri/src/mcp_bridge.rs`。
- 验证结果：`cargo check` 通过。
- 备注：带 `State` 引用的 async Tauri command 按框架要求返回 `Result<ApiResponse<T>, String>`，业务响应体仍是 `{ code, message, data }`。

计划 4：已完成。

- 完成内容：新增 `invokeApi<T>()`，统一解包 `{ code, message, data }`。
- 改动文件：`src/services/api.ts`。
- 验证结果：失败时统一抛出 `Error(message)`，成功时返回 `data`。
- 备注：暂时保留旧裸返回兼容，便于渐进迁移。

计划 5：已完成。

- 完成内容：前端 service 调用层已切换到 `invokeApi`。
- 改动文件：`src/services/playerBackend.ts`、`src/services/downloads.ts`、`src/services/pluginSearch.ts`、`src/services/plugins.ts`、`src/services/music.ts`、`src/services/persistentStore.ts`、`src/services/systemMedia.ts`、`src/components/TrayMenu.vue`。
- 验证结果：`npm run build` 通过。
- 备注：`exit_app` 会直接退出应用，`src/services/music.ts` 中保留原始 `invoke`。

计划 6：已完成。

- 完成内容：无返回值命令统一通过 `ApiResponse::ok()` 或 `ApiResponse::from_empty_result(...)` 返回 `data = null`。
- 改动文件：`src-tauri/src/api_response.rs`、`src-tauri/src/player.rs`、`src-tauri/src/downloads.rs`、`src-tauri/src/database.rs`、`src-tauri/src/covers.rs`、`src-tauri/src/store.rs`、`src-tauri/src/system_media.rs`、`src-tauri/src/tray.rs`、`src-tauri/src/shell.rs`。
- 验证结果：`cargo check`、`npm run build` 均通过。

计划 7：已完成。

- 完成内容：已评估 worker 协议，暂不迁移。
- 改动文件：无。
- 验证结果：worker 仍保留 `{ ok, payload, error }`，Tauri command 边界已转换为统一响应；`cargo test` 中 worker 相关测试通过。
- 备注：worker 是内部进程通信，后续如要统一，建议单独拆迁移计划。

计划 8：已完成。

- 完成内容：完成编译、类型和自动化测试回归。
- 验证命令：`cargo check`、`cargo test`、`npm run build`。
- 验证结果：`cargo test` 25 个测试全部通过，`npm run build` 通过。
- 备注：首次 `npm run build` 在沙箱中因 `esbuild` 子进程 `spawn EPERM` 失败，提升权限重跑后通过。尚未做手动 UI 点击回归。

下一步建议：手动打开应用验证播放、下载、插件搜索、扫描目录、元数据编辑等关键交互的错误提示展示。

## 统一异常处理补充计划

背景：统一返回结构已经确定为 `{ code, message, data }`，并且 `code = 1` 表示成功，`code = 0` 表示失败。异常统一也应该围绕这个结构建立：Rust 在 Tauri command 边界捕捉可预期业务错误，返回 `ApiResponse::error(...)`；前端只消费统一响应，不直接面对 Rust 内部错误形态。

核心结论：
- Rust 没有传统异常流，主要通过 `Result<T, E>` 表达失败。
- Rust 侧需要定义统一基础业务错误类型，例如 `AppError`，后续新增错误通过 enum variant、`From` 转换或 trait 实现收敛到这个基础错误类型。
- 可预期业务失败必须在 Rust command 边界统一处理成 `ApiResponse<T>`，失败时返回 `ApiResponse::error(...)`。
- 不应该让普通业务失败直接变成 Tauri `Err(String)` 暴露给前端。
- 前端收到的业务失败应该始终是 `{ code: 0, message, data: null }`，不直接消费 Rust 内部错误类型。
- `panic`、`unwrap`、`expect` 不应该作为业务失败路径；能改成 `Result` 的地方要改成 `Result`。
- 前端 `invokeApi<T>()` 只负责统一解包和抛出标准前端错误，不负责猜测每个接口的失败格式。

目标链路：

```text
Rust 内部函数
  -> Result<T, AppError>

Tauri command 边界
  -> ApiResponse<T>
  -> 成功：{ code: 1, message: "操作成功", data }
  -> 失败：{ code: 0, message: app_error.message(), data: null }
  -> 不把可预期业务失败直接作为 Tauri Err(String) 抛给前端

前端 invokeApi<T>()
  -> code = 1：返回 data
  -> code = 0：抛出 Error(message)

UI 层
  -> 需要全局提示：右上角 toast
  -> 需要局部展示：写入局部 error 状态
```

### 异常计划 1：定义 Rust 统一基础错误类型

状态：已完成

目标：
定义 Rust 侧统一基础业务错误类型，例如 `AppError`。后续新增的业务错误不直接散落成 `String`，而是先转成统一错误类型，最后由 Tauri command 边界统一转换为 `ApiResponse::error(...)`。

说明：
先不固定具体错误分类，避免过早设计。第一阶段只要求有一个基础错误类型能承载用户可见错误信息，并能被 command 边界统一转成 `ApiResponse::error(...)`。后续确实需要区分数据库、插件、参数校验等错误时，再按实际场景扩展。

执行步骤：
1. 新增统一错误模块，例如 `src-tauri/src/app_error.rs`。
2. 定义 `AppError` 和 `AppResult<T> = Result<T, AppError>`。
3. 先实现最小必要转换，例如 `From<String>` 和 `From<&str>`；其他错误来源后续按实际需要再加。
4. 在 `ApiResponse` 增加从 `AppResult<T>` 转响应的 helper，或让现有 `from_result` 支持统一错误类型。
5. 保持对现有 `Result<T, String>` 的兼容，避免一次性大改内部所有函数。

验证：
- 新增错误类型可以被 command 边界统一转成 `ApiResponse::error(...)`。
- 现有 `Result<T, String>` 调用不被破坏。
- `cargo check` 通过。

完成记录：
- 完成时间：2026-07-17
- 实际改动文件：`src-tauri/src/app_error.rs`、`src-tauri/src/api_response.rs`、`src-tauri/src/lib.rs`、`src-tauri/src/store.rs`
- 验证结果：`cargo check` 通过
- 备注：Rust 没有类继承，已按最小实现新增 `AppError` 和 `AppResult<T>`；后续新增异常通过统一错误类型和 `From` 转换接入，具体错误分类暂不提前固定。`store_get` 已作为第一处 `AppResult` 接入点，现有 `Result<T, String>` 路径保持兼容。

### 异常计划 2：统一 Rust command 错误边界

状态：已完成

目标：
检查所有 `#[tauri::command]`，确保可预期业务失败都被捕捉并返回 `ApiResponse::error(...)`，而不是直接把业务错误作为 Tauri `Err(String)` 抛给前端。

执行步骤：
1. 扫描所有 `#[tauri::command]` 的返回类型。
2. 区分 `ApiResponse<T>`、`Result<ApiResponse<T>, String>`、无返回值命令。
3. 对普通同步 command，优先返回 `ApiResponse<T>`。
4. 对 Tauri 框架要求必须返回 `Result<ApiResponse<T>, String>` 的 async/State 场景，确保业务失败在 `Ok(ApiResponse::error(...))` 内表达。
5. 保留 `exit_app` 这类直接退出应用、没有响应意义的特殊命令。

验证：
- 业务失败能返回 `{ code: 0, message, data: null }`。
- 前端能通过 `invokeApi` 读取到后端 `message`。
- 不引入新的 Tauri 序列化错误。

完成记录：
- 完成时间：2026-07-17
- 实际改动文件：无代码改动，仅审计
- 验证结果：已扫描所有 `#[tauri::command]` 返回类型；除 `exit_app` 直接退出应用外，其余 command 均返回 `ApiResponse<T>` 或框架需要的 `Result<ApiResponse<T>, String>`；`cargo check` 通过
- 备注：带 `State` 引用的 async Tauri command 仍保留 `Result<ApiResponse<T>, String>`，业务失败通过 `Ok(ApiResponse::error(...))` 或 `ApiResponse::from_result(...)` 表达。

### 异常计划 3：清理 Rust 中可能导致 panic 的业务路径

状态：已完成

目标：
检查 command 调用链中和业务输入、文件、数据库、插件、网络相关的 `unwrap()`、`expect()`、`panic!()`，能改成 `Result` 的地方改成 `Result`，再由 command 边界转成 `ApiResponse::error(...)`。

执行步骤：
1. 扫描 Rust 代码中的 `unwrap(`、`expect(`、`panic!`。
2. 判断是否位于用户操作可触发的业务路径。
3. 对可触发路径改为 `map_err(...)`、`ok_or_else(...)` 或显式 `match`。
4. 保留测试代码和真正不可恢复初始化场景中的合理 `expect`。

验证：
- 用户输入导致的失败不会 panic。
- 文件不存在、数据库失败、插件返回异常等情况能转成统一失败响应。
- `cargo check` 通过。

完成记录：
- 完成时间：2026-07-17
- 实际改动文件：无代码改动，仅审计
- 验证结果：已扫描 `unwrap(`、`expect(`、`panic!`；命中点主要位于 `#[cfg(test)]` 测试代码，另有 `lib.rs` 应用启动入口 `expect("error while running tauri application")`；未发现用户操作业务路径需要本轮改动；`cargo test` 25 个测试通过
- 备注：后续新增用户可触发业务路径时，应避免新增 `unwrap/expect/panic`，优先返回 `Result` 并在 command 边界转成 `ApiResponse::error(...)`。

### 异常计划 4：复用现有前端错误展示入口

状态：已完成

目标：
复用现有右上角 toast 入口 `showOnlineToast(...)`，把错误文案格式化和调用方式收敛起来，避免每个页面重复写错误解析逻辑。

执行步骤：
1. 保留现有 `App.vue` 中的 `showOnlineToast(...)` 和 `online-toast` UI，不新增重复 toast 组件。
2. 梳理当前直接调用 `showOnlineToast(...)` 的地方，统一错误文案格式。
3. 如有必要，抽出轻量 helper，例如 `getErrorMessage(error)` 或 `notifyError(error, contextMessage)`，但不强制新增全局异常类型。
4. 明确默认策略：普通操作失败弹右上角；表单/搜索/下载列表等有局部错误区域的场景优先局部展示。
5. 避免取消扫描、没有下一首等可预期状态弹出严重错误提示。

验证：
- 现有右上角 toast 仍由 `showOnlineToast(...)` 驱动。
- 普通业务失败会显示右上角错误提示。
- 局部错误场景不会重复弹窗。
- 错误文案保留业务上下文，例如“封面更新失败：xxx”。

完成记录：
- 完成时间：2026-07-17
- 实际改动文件：`src/utils/error.ts`、`src/App.vue`、`src/components/LyricsView.vue`、`src/components/SettingsView.vue`、`src/components/PlayerDock.vue`、`src/stores/player.ts`、`src/composables/useScanFolders.ts`、`src/composables/usePlaylistActions.ts`、`src/components/ThemeView.vue`、`src/components/PluginManagerView.vue`
- 验证结果：已复用 `src/App.vue` 的 `showOnlineToast(...)` 和现有 `online-toast` UI；新增 `getErrorMessage(error, fallback)` 统一错误文本提取；`npm run build` 通过
- 备注：现有入口位于 `src/App.vue` 的 `showOnlineToast(...)`；本步骤没有新建 toast 入口。

### 异常计划 5：迁移现有 catch 分支

状态：已完成

目标：
逐步把现有 `catch` 中重复的错误解析、toast 调用、局部 error 赋值改成统一 helper，保持行为不变，只收敛写法。

建议顺序：
1. `src/App.vue` 中已经调用右上角 toast 的场景。
2. `src/stores/player.ts` 中播放器和曲库相关错误。
3. `src/composables/*` 中扫描、播放列表等逻辑。
4. `src/components/*` 中歌词、封面、插件、设置等局部错误。

验证：
- 不再大量重复 `error instanceof Error ? error.message : String(error)`。
- 原来能局部显示错误的地方仍然显示。
- 原来能弹右上角提示的地方仍然弹。

完成记录：
- 完成时间：2026-07-17
- 实际改动文件：`src/utils/error.ts`、`src/App.vue`、`src/components/LyricsView.vue`、`src/components/SettingsView.vue`、`src/components/PlayerDock.vue`、`src/stores/player.ts`、`src/composables/useScanFolders.ts`、`src/composables/usePlaylistActions.ts`、`src/components/ThemeView.vue`、`src/components/PluginManagerView.vue`
- 验证结果：已将分散的 `error instanceof Error ? error.message : String(...)` 迁移到 `getErrorMessage(...)`；复扫后旧写法仅存在于 `src/utils/error.ts` 工具内部；`npm run build` 通过
- 备注：保留局部错误状态和现有 toast 行为，仅收敛错误文本提取方式。

### 异常计划 6：验证和回归

状态：已完成

目标：
验证统一异常处理不会破坏现有功能，并覆盖成功、业务失败、框架失败和可预期取消状态。

验证场景：
- 扫描不存在的音乐目录。
- 元数据保存失败。
- 封面更新失败。
- 歌词下载失败。
- 插件搜索失败。
- 取消扫描不显示严重错误 toast。
- `exit_app` 仍可正常退出。

建议命令：

```powershell
npm run build
cd src-tauri
cargo check
cargo test
```

完成记录：
- 完成时间：2026-07-17
- 实际改动文件：无额外代码改动，仅验证
- 验证结果：`cargo check` 通过；`cargo test` 25 个测试全部通过；`npm run build` 通过；前端旧错误提取写法复扫无业务调用残留
- 备注：尚未做手动 UI 点击回归；当前完成自动化构建和测试验证。

## 统一异常处理当前状态

- 总体状态：统一异常处理计划已完成自动化验证。
- 下一步：手动打开应用验证扫描失败、元数据保存失败、封面/歌词下载失败、插件搜索失败、取消扫描、`exit_app` 等关键 UI 场景。
- 回写规则：每完成一个异常计划项，就把状态、完成时间、实际改动文件、验证结果写回本文档。
