# 侧栏插件菜单插槽

插件通过 `plugin.json` 的 contributions.pages 注册包内页面，再通过 contributions.sidebar 申请菜单。

```json
{
  "pages": [{"id":"separate","title":"人声／伴奏分离","entry":"ui/index.html"}],
  "sidebar": [{"id":"open-separate","title":"人声／伴奏分离","icon":"audio-lines","pageId":"separate"}]
}
```

上面是 contributions 对象。菜单与播放栏独立，均不根据 capability 自动生成。人声分离只申请此菜单，小爱音箱不申请侧栏。

页面使用包内静态资源、公共 SDK 和宿主的隔离容器。不能填写远程 page.url 或旧 action。安装时验证引用；关闭页面清理会话/订阅；停用或卸载后页面关闭且旧请求被拒绝。拖动调用 mono.window.startDragging，按钮区域不触发拖动。

完整字段和权限见 [公共规范](plugin-api-v1.md)，最小页面见 [SDK](../packages/plugin-sdk/README.md)。

页面声明可以设置 presentation: "dialog"，在主窗口上覆盖弹窗打开；presentation: "page" 则在主内容区打开。未填写时，侧栏入口默认主内容页，播放栏入口默认弹窗；管理页直接打开时按该页面申请的入口判断，均未申请则使用主内容页。页面显式声明优先于入口默认值，与是否有 Node/WASM 后端无关。弹窗使用相同的隔离页面和公共 API，关闭弹窗不停止后台服务。小爱页面声明为 dialog，播放栏与管理页入口都打开同一个弹窗。
