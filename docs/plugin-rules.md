# Mono 插件规则

当前唯一协议为公共 API v1，不兼容旧插件。权威规范：[公共插件规范](plugin-api-v1.md)，全部方法：[接口索引](plugin-api-methods.md)，验证结果：[验收记录](plugin-api-progress.md)。

- `plugin/<目录>/plugin.json` 是包身份、权限、能力与入口的唯一来源；WASM metadata 必须与其一致。
- 发布 `.monoplugin.zip`，不安装单文件 WASM、远程脚本或旧模块清单。
- capabilities 表示向宿主提供的能力；permissions 表示向宿主申请的权限；contributions 表示主动申请的页面、菜单、播放栏与命令。
- 安装和更新先检查包、再确认授权、最后原子切换。停用后不能继续调用公共接口，旧安装记录只允许移除或被新版包替换。
- 插件使用 `@mono/plugin-sdk`，不得使用 Tauri、读取宿主存储或复用 MCP 通用令牌。小爱受管服务使用自己的短期会话调用相同原生入口。
- 卸载清除授权和入口，保留用户配置、插件数据及分离结果；更新不静默扩大权限。
- 入口只来自插件声明。小爱只有播放栏入口，人声分离只有侧栏入口。宿主不按 capability 自动创建菜单。
- 所有 24 个插件源码和构建产物位于 `plugin/`。`npm run plugins:v1:build` 构建并校验全部包，`npm run plugins:v1:test` 核对公共合同与生命周期。

页面开发与最小示例见 [SDK](../packages/plugin-sdk/README.md)，后端 ABI 见 [WASM 指南](wasm-plugin-development.md)。
