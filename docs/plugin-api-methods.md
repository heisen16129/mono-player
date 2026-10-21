# 公共插件 API 方法索引

2026-10-22。69 个原生方法均有 SDK 封装，events.poll 由订阅器内部调用。以原生注册表和 SDK 合同测试为准。

| 方法 | 权限 |
| --- | --- |
| `host.getInfo` | 当前插件会话 |
| `events.subscribe` | 当前插件会话 |
| `events.unsubscribe` | 当前插件会话 |
| `events.poll` | 当前插件会话 |
| `audio.subscribeFrames` | audio.read |
| `audio.unsubscribeFrames` | audio.read |
| `library.listArtists` | library.read |
| `library.listAlbums` | library.read |
| `library.listTracks` | library.read |
| `library.getTrack` | library.read |
| `library.removeTrack` | library.write |
| `lyrics.openSearch` | lyrics.read |
| `lyrics.setOffset` | lyrics.write |
| `ui.close` | 当前插件会话 |
| `ui.notify` | 当前插件会话 |
| `ui.openPage` | 当前插件会话 |
| `ui.openSettings` | 当前插件会话 |
| `config.get` | 当前插件会话 |
| `config.set` | 当前插件会话 |
| `storage.get` | storage |
| `storage.set` | storage |
| `storage.delete` | storage |
| `storage.keys` | storage |
| `favorites.list` | favorites.read |
| `favorites.contains` | favorites.read |
| `favorites.set` | favorites.write |
| `playlists.create` | playlists.write |
| `playlists.update` | playlists.write |
| `playlists.delete` | playlists.write |
| `playlists.reorderTracks` | playlists.write |
| `playlists.list` | playlists.read |
| `playlists.get` | playlists.read |
| `playlists.listTracks` | playlists.read |
| `playlists.addTracks` | playlists.write |
| `playlists.removeTracks` | playlists.write |
| `lyrics.parse` | 当前插件会话；仅解析传入文本，无需读取歌词权限 |
| `lyrics.get` | lyrics.read |
| `sources.list` | sources.search |
| `sources.search` | sources.search |
| `sources.importTracks` | sources.import |
| `history.recordPlayed` | history.write |
| `queue.replace` | player.control |
| `queue.append` | player.control |
| `queue.insert` | player.control |
| `queue.remove` | player.control |
| `queue.reorder` | player.control |
| `queue.clear` | player.control |
| `queue.get` | player.read |
| `queue.play` | player.control |
| `service.getConnection` | service.run |
| `files.choose` | files.choose |
| `files.reveal` | files.reveal |
| `speaker.getConnection` | speaker-service |
| `window.startDragging` | 当前插件会话 |
| `artwork.get` | artwork.read |
| `artwork.refresh` | artwork.read |
| `media.prepare` | media.read |
| `player.getState` | player.read |
| `player.playTrack` | player.control |
| `player.play` | player.control |
| `player.pause` | player.control |
| `player.stop` | player.control |
| `player.next` | player.control |
| `player.previous` | player.control |
| `player.seek` | player.control |
| `player.setVolume` | player.control |
| `player.setMuted` | player.control |
| `player.setRate` | player.control |
| `player.setMode` | player.control |

事件订阅逐项检查资源读取权限。service.getConnection、files.choose 和 files.reveal 仅供页面调用。
files.choose 向获得授权的插件披露用户选择的真实路径；files.reveal 仅允许打开该插件数据目录中的资源。
service.run 允许运行独立本地 Node 进程，不构成操作系统沙箱；授权意味着信任插件在当前用户权限下执行本地代码。
分离环境准备、任务执行及取消属于分离插件的内部服务协议，不属于公共 API。speaker.getConnection 暂保留为现有小爱专用入口。
