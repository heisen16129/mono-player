# 公共 API v1 插件

24 个插件的迁移源码、清单和发布产物均在本目录。宿主仅运行 v1 包，没有旧协议兼容层。

## 源码和安装包使用同一目录结构

```text
my-plugin/
├── plugin.json                # 名称、版本、权限和运行入口
├── backend/                   # 后端源码和编译配置（按需）
│   ├── Cargo.toml
│   ├── Cargo.lock
│   └── src/
├── ui/                        # 页面或渲染器源码（按需）
│   ├── src/
│   └── dist/                  # Vue 页面的编译产物
├── assets/                    # 图片、字体等资源（按需）
├── dist/
│   └── plugin.wasm            # 编译好的 WASM（按需）
└── <插件ID>.monoplugin.zip     # 此插件安装包，不含版本号
```

例如阿云歌词的后端源码在 `ayun-lyrics/backend/src/`，编译结果在 `ayun-lyrics/dist/plugin.wasm`；清单入口为 `dist/plugin.wasm`。渲染器的模块在 `ui/renderer.mjs`，小爱与分离页面入口在 `ui/dist/index.html`。小爱服务编译结果为 `dist/service.mjs`，其后端 TypeScript 和适配代码放在 backend/，页面源码放在 ui/。

ZIP 保留 backend/、ui/、assets/ 中的源码和运行资源，以及清单声明的 dist/ 入口，保持相对路径一致；额外生成 integrity.json。不会包含 node_modules、target、版本控制目录、临时缓存或安装包自身。无需有界面的插件提供空 ui/，也无需纯页面插件提供空 backend/。

插件根目录可以保留构建入口、开发依赖配置和说明文档；源码按职责放进 backend/ 或 ui/。源码依赖的公共 SDK 和共享模块仍由本仓库提供。

`plugin/dist/catalog.json` 和 `plugin/dist/packages.json` 是整个插件集合的索引；每个安装包放在各自的插件根目录。

运行 `npm run plugins:v1:build` 构建全部插件并执行原生包校验、WASM metadata 实际执行校验。运行 `npm run plugins:v1:test` 检查 SDK、隔离传输和生命周期。依赖项目工具链、WASM target、Python 与小爱前端依赖；应用首次分发运行时需 `npm run miot:bundle` 准备 Node/FFmpeg。

[规范](../docs/plugin-api-v1.md) · [方法索引](../docs/plugin-api-methods.md) · [实施结果](../docs/plugin-api-migration-plan.md) · [验收记录](../docs/plugin-api-progress.md)

真实设备、外部账号和桌面交互的 runtimeVerified 与代码迁移是独立状态，不能用单元测试替代。shared 不是独立插件；旧 apple-music-lyrics-v2 构建缓存不计入 24 个插件。
