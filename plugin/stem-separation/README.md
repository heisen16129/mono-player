# 人声 / 伴奏分离

插件自行运行 Node 后台，负责 Python 环境准备、Demucs 模型、批量分离、进度、取消和输出缓存。前端使用公共 SDK 获取自身服务连接，然后直连后台；公共 SDK 不再提供分离业务方法。

## 安装与使用

导入本目录的 mono-wasm-stem-separation.monoplugin.zip，确认运行本地后台、网络和文件选择等权限。使用更新后的 Mono 主程序，从侧栏打开分离页面。首次点击一键准备，自动下载 uv、Python 3.12、PyTorch 及 Demucs；无需预装 Python。已有环境可在插件设置中指定 Python 路径。

运行本地后台意味着信任插件在当前用户权限下执行代码；Node 进程不是操作系统沙箱。宿主继续使用现有随主程序提供的 Node 运行时。

## 目录

- plugin.json：唯一插件清单。
- backend/：服务、环境准备、任务管理及 Python worker 源码和测试。
- ui/src/：Vue 页面及插件内部 API 客户端。
- ui/dist/：构建后的页面。
- dist/service.mjs：构建后的后台入口。不需要 WASM。

构建：node plugin/stem-separation/build.mjs。
测试：node --test plugin/stem-separation/backend/*.test.mjs。

## 数据与任务

数据位于 Mono 应用数据目录的 plugin-data/mono-wasm-stem-separation/：environment/ 保存运行环境和模型，output/ 保存人声和伴奏。旧宿主缓存不自动迁移或删除；新目录当前不计入旧版 Mono 缓存清理。

文件夹模式递归扫描，跳过符号链接和输出目录，逐首处理。取消只清理当前未完成结果，保留已完成输出。只有完整人声和伴奏生成后才发布缓存标记。关闭页面后任务继续；停用、更新、卸载或退出 Mono 时停止后台及子进程。

K 歌按钮通过宿主适配层请求本插件生成伴奏；宿主负责播放器切换与混音，分离引擎不在宿主中。每个插件实例只允许一个分离批次，手动分离与 K 歌共享该任务。
