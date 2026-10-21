# 播放栏插件插槽

插件在 `plugin.json` 的 contributions 中主动申请入口；宿主按安装、启用状态生成按钮，没有声明不占位置。

```json
{
  "pages": [{"id":"speaker","title":"小爱音箱","entry":"ui/index.html"}],
  "playbackBar": [{"id":"open-speaker","title":"小爱音箱","icon":"speaker","pageId":"speaker"}]
}
```

上面是 contributions 对象。pageId 必须引用同包页面；也可用 commandId 引用 contributions.commands 中的命令，但不能同时填写。命令由同包 WASM 的 command action 处理，不能填任意宿主函数名。

图标名称使用 speaker、audio-lines、plug。按钮显示 title 和无障碍标签。点击页面入口进入通用隔离容器，通过公共 SDK 与宿主交互；不再注册 MiotLauncher 或 StemSeparationLauncher。

小爱只申请播放栏，人声分离不申请播放栏。安装、更新、启停、卸载立即刷新；关闭全局插件功能后隐藏。完整规则见 [公共规范](plugin-api-v1.md)。

页面可以在 contributions.pages 中声明打开方式：

```json
{"id":"speaker","title":"小爱音箱","entry":"ui/dist/index.html","presentation":"dialog"}
```

presentation 为 page 时接入主窗口内容区，为 dialog 时显示覆盖弹窗。没有填写时，侧栏入口默认 page，播放栏入口默认 dialog。插件明确声明的打开方式优先，与后端是否使用 WASM 或 Node 无关。小爱声明 dialog，人声分离声明 page。
