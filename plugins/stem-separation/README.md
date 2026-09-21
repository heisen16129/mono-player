# 人声 / 伴奏分离

Mono 工具插件，使用 Demucs 4.0.1 的 `htdemucs_6s` 在本机分离音频，导出 `vocals.wav`（人声）和 `accompaniment.wav`（其他五轨相加）。只下载依赖和模型，不上传音频。Python / PyTorch 环境和模型权重另外占用磁盘空间。

## Windows 使用

1. 使用包含音源分离 Host 接口的 Mono 构建，在「插件管理 → 订阅 → 本地导入」选择本目录的 `dist/stem-separation.wasm`。
2. 在已安装插件列表点击「分离」。已有环境会自动识别；首次使用点击「一键准备」，等待完成。
3. 点击「选择音乐」或「选择音乐文件夹」，再开始分离。输出自动使用设置中的缓存目录，无需另选文件夹。

无需单独安装 Python、uv 或 FFmpeg，也无需运行命令或填写路径。Mono 在应用数据目录内管理独立环境，自动下载依赖与模型，默认使用 CPU。准备过程支持取消及重试。此前用脚本创建的 `%LOCALAPPDATA%\MonoDemucs` 环境会自动复用。

每次任务新建 `mono-stems-<UUID>` 子目录，不覆盖源文件或以前的结果。支持进度、取消、错误提示及打开输出文件位置。一次只处理一个任务；关掉弹窗后任务继续，重新打开恢复状态。退出 Mono 会终止处理。任务状态仅保留到应用退出，已完成音频不会删除。

文件夹模式递归处理子目录中的音乐，跳过本次输出缓存目录，逐首分离。单首失败后继续，界面列出失败原因；取消会停止当前和后续任务，保留已完成结果。输出在 `<缓存目录>/mono-cache/karaoke`，与播放栏 K歌共用缓存；已有完整结果直接复用。

## 播放栏 K歌

K歌生成的音频保存在「设置 → 缓存目录」下的 `mono-cache/karaoke` 中，跟随缓存目录设置，并计入缓存统计和清理。

启用插件后，播放栏显示「原声 / K歌」菜单。选择 K歌会检查环境并生成当前歌曲的伴奏，完成后保留播放位置和暂停状态切换。首次生成需要等待，之后复用伴奏缓存。选择原声可取消等待或切回原曲，切换歌曲后默认恢复原声。在线歌曲需已缓存完整，也可先下载后使用。伴奏生成和手动分离共用一个任务，不能同时运行。

第一次运行会下载模型，之后复用 Mono 缓存目录下的 `demucs` 模型缓存。选择 CPU 可在无独立显卡的机器运行，但可能较慢。指定 GPU 不可用时会提示切换设备，不会悄悄改变配置。分离是模型估计，可能存在串音和音质损失。

## 自定义环境（可选）

需要 NVIDIA 加速时，可以安装 uv 后在本目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Compute cu124`，需要兼容显卡及驱动。脚本默认创建 `%LOCALAPPDATA%\MonoDemucs` 环境。其他位置的已有环境可在插件配置中填写 Python 绝对路径，并选择设备；一般用户无需修改这些设置。

自动准备也提供 macOS（Intel / Apple Silicon）及 Linux x64 支持，但当前仅在 Windows 实机验证。手动创建环境的示例：

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

将 `.venv/bin/python` 的绝对路径填入 Mono 插件配置。Apple Silicon 可以选择自动或 MPS。当前变更在 Windows 上验证，其他平台仍需实机验证。

## 构建插件

```sh
cargo build --release --target wasm32-unknown-unknown
```

将 `target/wasm32-unknown-unknown/release/mono_plugin_stem_separation.wasm` 复制到 `dist/stem-separation.wasm`。本插件依赖新增 Host 能力，旧版 Mono 不支持。

## 实现边界

- WASM 声明 `kind: tool`、`stem-separation` 能力及 `audio-process/network` 权限，通过 `separate` action 返回受限的模型方案。
- Mono 从已保存的安装清单校验启用状态和权限，自动检测环境并保存 Python 路径。
- 自动准备使用固定版本 uv，从官方发布地址下载并核对 SHA-256；Python、依赖及模型保存在应用自己的目录内。音频解码器随环境安装，不修改系统 PATH。
- Rust 只执行 Host 内置 Python 脚本，不执行插件提供的命令或脚本。模型、引擎和设备均通过白名单校验。
- 处理进程通过 JSON 报告阶段与进度；退出成功且两份音频有效时才将任务标记为完成。
- 失败或取消只清理本任务的两份输出，不递归删除用户目录。

模型及推理来自 [Meta Demucs](https://github.com/facebookresearch/demucs)（MIT）。插件不包含 StemDeck 源码或模型权重。

## 验证

```powershell
node --test scripts/stem-separation-plugin.test.mjs
cargo test --offline --manifest-path src-tauri/Cargo.toml --lib
$env:MONO_STEM_TEST_PYTHON = '你的分离环境\Scripts\python.exe'
cargo test --offline --manifest-path src-tauri/Cargo.toml real_demucs_exports_cancels_and_restarts --lib -- --ignored --nocapture
```

以上命令从 Mono 仓库根目录运行。最后一项使用合成 WAV 和真实模型验证中文路径、并发拒绝、取消清理、重启及双轨导出；首次运行需联网下载模型。可设置 `MONO_STEM_TEST_CACHE` 指定测试模型缓存位置。
