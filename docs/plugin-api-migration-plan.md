# 公共插件 API v1 改造计划与实施结果

更新：2026-10-21。目标：宿主和全部 24 个插件同步迁移，不兼容旧插件，迁移源码及产物统一放在 plugin/。代码迁移已落实；自动化和外部运行验收分别记录在 [验收记录](plugin-api-progress.md)，不能把构建通过称为真实设备通过。

## 实施阶段

| 阶段 | 改造结果 | 验证方式 |
| --- | --- | --- |
| P0 合同 | v1 请求/响应、69 个方法、权限、公开 Track ID、包和贡献声明；SDK 类型与注册表合同测试 | SDK/原生方法集合及 24 清单检查 |
| P1 公共核心 | 曲库、收藏、歌单、播放和队列、歌词、封面、音源搜索/导入、存储、配置、事件、任务 | 参数、权限、游标、事务和版本冲突测试 |
| P2 包管理 | ZIP 完整性/路径/版本/权限和 WASM metadata 校验；原子安装；更新保留配置；旧记录禁止运行 | 包损坏、越权、旧包、更新保留数据和 24 包校验 |
| P3 页面入口 | 通用隔离页面/桌面容器，侧栏/播放栏/命令来自贡献声明，公共拖动和关闭方法 | MessagePort、过期实例、页面销毁、入口合同测试 |
| P4 资源生命周期 | 事件/音频限频，队列版本编辑，分离任务归属，媒体临时 URL；停用撤权及取消任务 | 实际本机 HTTP、范围读取、撤权、会话/任务隔离回归 |
| P5 全部插件 | 18 个 WASM、6 个渲染器，小爱页面/服务、分离页面全部重建 | 24 ZIP 校验、18 WASM 实际执行、服务和 SDK 测试 |
| P6 宿主切换 | 商城/订阅/安装/主题/歌词/桌面/后台服务使用 v1，应用资源使用 plugin/dist；删除旧桥和专用入口 | 主程序构建、原生全量测试、源码引用检查 |

## 职责落点

- models/plugin_api.rs：协议错误与消息；plugins/api/：授权、会话、方法分发、包管理、受限资源。
- database/ 与 library_service.rs：查询、保存及事务；player/plugin_queue.rs：队列版本下的原子编辑。
- stem_separation/public_api.rs：输入与输出引用、归属、取消；不把长任务放进页面生命周期。
- packages/plugin-sdk/：类型、Promise 客户端、MessagePort、订阅与渲染生命周期。
- components/plugins/、composables/usePluginNavigation.ts：通用 UI 和入口；App.vue/lib.rs 保留装配注册。
- plugin/<name>/：独立源码、清单、页面/服务资源；plugin/<name>/<id>.monoplugin.zip：独立安装包；plugin/dist/：内置目录索引。

## 24 个插件的交付分组

| 分组 | 目录 | 改造边界 |
| --- | --- | --- |
| 音箱 | miot | 公共数据 API 与专属服务会话，独立设备队列，只申请播放栏 |
| 分离 | stem-separation | 包内页面、宿主管理任务及资源引用，只申请侧栏 |
| 歌词/桌面 | apple-music-lyrics、betterlyrics、fanlyrics、mineradio-original-lyrics、playback-card、desktop-lyrics-example | SDK mount/update/destroy、统一曲目/歌词/队列/音频输入、配置和播放操作 |
| 歌词供给 | aq-lyrics、ayun-lyrics | v1 WASM 清单与授权 |
| 音源 | gdstudio-music、huyao-kuwo、netease-music、shanhaiyun-kw-music、xiaogou-music、xiaoqiu-music、xiaowo-music、xiaoyun-music、yuanli-kw-music、yuanli-qq-music | v1 包和供给协议，宿主按当前安装记录调用 |
| 主题 | theme-dark、theme-forest-mint、theme-gray-white、theme-transparent | v1 包、变量校验、安装更新绑定与停用清理 |

shared 不独立发布；原 apple-music-lyrics-v2 目录只有构建缓存，不计作第 25 个插件。旧源码目录可保留作历史对照，当前构建/运行不使用它们。

## 数据与发布约束

旧插件不能启用，也不自动补造权限或新清单。旧安装记录可移除或被新版安装覆盖；用户配置、插件存储、歌单和已完成分离文件保留。新包更新时重新确认授权，失败保留原安装记录。

插件包构建和校验已纳入统一命令；不会自动发布到远端商城或修改用户正在运行的安装。内置 catalog.json 随应用打包，远端订阅仅接收 v1 包目录。

真实桌面交互、需要账号的音源、真实小爱设备和完整 Demucs 分离属于外部运行验收，结果按实际执行记录；这些项没有旧协议回退方案。SDK 当前是工作区本地包，没有发布 npm。开发热刷新或额外脚手架不属于此次运行时迁移交付。
