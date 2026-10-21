# 自定义桌面歌词插件

在 Mono「插件」中导入此目录的 desktop-lyrics-example.monoplugin.zip，然后在「设置 → 歌词 → 桌面歌词」选择「简约桌面歌词示例」，点击「显示桌面歌词」。页面歌词选择不受影响。

复制整个目录并修改 plugin.json 中的 id、name 和 ui/renderer.mjs 即可制作自己的样式。模块入口必须位于插件目录内并由 plugin.json 声明，使用单文件 ES module（依赖和 CSS 请预先打包）。

plugin.json 声明 entry.renderer、kind: desktop-lyrics、capabilities: [desktop-lyrics]。可通过 configSchema 声明配置项，在插件设置中编辑；重新打开桌面窗口后应用。

模块默认导出 mount(root, api)、update(message)、destroy()。宿主提供 track（activeTrack、trackKey）、lyrics（lines、trackKey）、playback（currentTime、isPlaying）、config 消息。歌词时间单位为秒，逐字时间在 lines[].words 中。窗口透明、置顶，初始大小 316×483，位于桌面右下角。

api.post 支持 close、dragWindow、togglePlayback、playPrevious、playNext、seekTime（{time: 秒}）、updateConfig（{config: 配置对象}）。配置按插件 ID 独立保存，desktop 标记由宿主固定为 true。模块在隔离 iframe 内运行，不直接访问 Tauri 或本地文件。

内置悬浮歌词和 13 款卡片随应用提供，无需安装插件。内置卡片继续使用原有保存配置，已有卡片样式不会丢失。
