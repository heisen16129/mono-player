# Mono Player 自定义主题说明

Mono Player 支持导入本地主题包，也支持在主题市场中下载内置主题包。主题包本质上是一个文件夹，里面包含主题描述文件、主题变量文件，以及可选的主题预览图。

当前版本支持“文件夹导入”，暂不支持 zip 压缩包导入。

## 主题包结构

一个完整主题包推荐这样组织：

```text
my-theme/
├─ theme.json
├─ variables.css
├─ preview.svg
└─ background.svg
```

最小主题包只需要：

```text
my-theme/
├─ theme.json
└─ variables.css
```

项目里有两个示例主题：

```text
examples/themes/soft-mint/
examples/themes/soft-pink/
```

## theme.json

`theme.json` 用来描述主题的基本信息。

```json
{
  "id": "soft-mint",
  "name": "柔和薄荷",
  "author": "Mono Player",
  "version": "1.0.0",
  "type": "theme",
  "entry": "variables.css",
  "preview": "preview.svg",
  "background": "background.svg",
  "backgroundOpacity": 0.22
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 主题唯一 ID，只能使用英文小写、数字、`-`、`_`，例如 `soft-mint` |
| `name` | 是 | 主题显示名称 |
| `author` | 否 | 作者名称，不填会显示 `Unknown` |
| `version` | 否 | 主题版本，当前用于展示和记录 |
| `type` | 否 | 建议写 `theme` |
| `entry` | 否 | CSS 变量文件路径，不填默认读取 `variables.css` |
| `preview` | 否 | 主题卡片封面图路径，例如 `preview.svg` |
| `background` | 否 | 应用背景图路径，例如 `background.svg` |
| `backgroundOpacity` | 否 | 背景图片透明度，取值 `0` 到 `1`，例如 `0.22` |

导入后，应用内部会把主题 ID 转成 `custom:<id>`。例如 `soft-mint` 会变成 `custom:soft-mint`。

## 预览图

主题卡片会优先显示真正的封面图。如果没有提供封面图，应用会使用 CSS 生成一个兜底预览。

支持的预览图文件：

- `preview.svg`
- `preview.png`
- `preview.jpg`
- `preview.jpeg`
- `preview.webp`

推荐在 `theme.json` 中显式声明：

```json
{
  "preview": "preview.svg"
}
```

如果没有声明 `preview`，应用会自动查找主题文件夹下的 `preview.svg`、`preview.png`、`preview.jpg`、`preview.jpeg`、`preview.webp`。

限制：

- `preview` 必须是主题包内部的相对路径。
- 不能写网络地址。
- 不能写跳出主题包的路径，例如 `../cover.png`。
- 预览图只用于主题卡片，不会作为应用背景图自动生效。

## 背景图

应用背景图通过 `theme.json` 的 `background` 字段声明：

```json
{
  "background": "background.svg"
}
```

支持的背景图文件：

- `svg`
- `png`
- `jpg`
- `jpeg`
- `webp`

背景图和预览图一样，必须放在主题包内部，并使用相对路径。应用导入主题时会校验图片是否存在，校验通过后再转成 Tauri 可显示的本地资源地址。

背景图默认铺在应用窗口底层，主题作者可以继续用颜色变量控制面板透明度，例如把 `--smw-bg-workspace`、`--smw-bg-sidebar`、`--smw-player-bg` 写成 `rgba(...)`，让背景图透出来。

背景图显示方式可以用下面这些变量控制：

```css
:root {
  --smw-theme-bg-opacity: 0.22;
  --smw-theme-bg-size: cover;
  --smw-theme-bg-position: center;
  --smw-theme-bg-repeat: no-repeat;
}
```

也可以在 `theme.json` 中直接写 `backgroundOpacity`：

```json
{
  "background": "background.svg",
  "backgroundOpacity": 0.22
}
```

`backgroundOpacity` 的范围是 `0` 到 `1`。数值越小背景图越淡，数值越大背景图越明显。如果 `theme.json` 和 `variables.css` 同时设置背景图透明度，应用会优先使用 `theme.json` 里的 `backgroundOpacity`。

## variables.css

`variables.css` 用来定义主题颜色。当前版本只允许覆盖白名单里的 CSS 变量，不允许写组件选择器。

推荐写法：

```css
:root {
  --smw-bg-canvas: #eef6f0;
  --smw-bg-page: #f5faf6;
  --smw-bg-sidebar: #edf5ef;
  --smw-bg-panel: #f8fbf8;
  --smw-library-bg: #f6faf6;
  --smw-library-border: #cad9cf;
  --smw-bg-workspace: #f7fbf7;
  --smw-bg-input: #ffffff;
  --smw-bg-selected: #dcebe0;
  --smw-bg-hover: #e8f2eb;
  --smw-border: #cad9cf;
  --smw-border-soft: #dce7df;
  --smw-border-strong: #627765;
  --smw-window-border: #bdcec2;
  --smw-player-bg: rgba(247, 251, 247, 0.96);
  --smw-shell-bg: #eef6f0;
  --smw-text-primary: #102018;
  --smw-text-body: #22352b;
  --smw-text-secondary: #63766b;
  --smw-text-muted: #8fa197;
  --smw-icon-muted: #617469;
  --smw-button-primary: #647a67;
  --smw-scrollbar-thumb: rgba(100, 122, 103, 0.24);
  --smw-scrollbar-thumb-hover: rgba(100, 122, 103, 0.42);
  --smw-accent-blue: #647a67;
  --smw-lyrics-bg: #f7fbf7;
  --smw-lyrics-glow-left: rgba(100, 122, 103, 0.08);
  --smw-lyrics-glow-right: rgba(100, 122, 103, 0.14);
  --smw-lyrics-current: #647a67;
  --smw-volume-bg: #fbfdfb;
  --smw-volume-track: #dce7df;
  --smw-volume-fill: #647a67;
  --smw-volume-thumb: #647a67;
  --smw-volume-text: #63766b;
  --smw-progress-track: #dce7df;
  --smw-progress-fill: #647a67;
  --smw-progress-thumb: #647a67;
  --smw-progress-thumb-border: #f7fbf7;
  --smw-progress-thumb-ring: rgba(100, 122, 103, 0.24);
  --smw-theme-bg-opacity: 0.2;
  --smw-theme-bg-size: cover;
  --smw-theme-bg-position: center;
  --smw-theme-bg-repeat: no-repeat;
}
```

## 可用变量

当前主题包只允许覆盖下面这些变量。其他变量会被忽略。

### 背景

| 变量 | 作用 |
| --- | --- |
| `--smw-bg-canvas` | 应用最外层背景 |
| `--smw-bg-page` | 页面背景 |
| `--smw-bg-sidebar` | 左侧主菜单背景 |
| `--smw-bg-panel` | 面板背景 |
| `--smw-library-bg` | 第二栏背景，例如音乐库列表栏 |
| `--smw-library-border` | 第二栏右侧分隔线 |
| `--smw-bg-workspace` | 主内容区背景 |
| `--smw-bg-input` | 输入框背景 |
| `--smw-bg-selected` | 选中项背景 |
| `--smw-bg-hover` | 悬停项背景 |
| `--smw-player-bg` | 底部播放栏背景 |
| `--smw-shell-bg` | 应用外壳背景 |

### 边框

| 变量 | 作用 |
| --- | --- |
| `--smw-border` | 常规边框 |
| `--smw-border-soft` | 弱边框 |
| `--smw-border-strong` | 强边框、当前焦点边框 |
| `--smw-window-border` | 窗口边框 |

### 文字和图标

| 变量 | 作用 |
| --- | --- |
| `--smw-text-primary` | 主要文字 |
| `--smw-text-body` | 正文文字 |
| `--smw-text-secondary` | 次级文字 |
| `--smw-text-muted` | 弱文字 |
| `--smw-icon-muted` | 弱图标 |

### 控件和强调色

| 变量 | 作用 |
| --- | --- |
| `--smw-button-primary` | 主按钮、播放按钮、主题选中标记等主要强调色 |
| `--smw-accent-blue` | 播放进度、部分强调控件 |
| `--smw-scrollbar-thumb` | 滚动条颜色 |
| `--smw-scrollbar-thumb-hover` | 滚动条悬停颜色 |

### 歌词页面

| 变量 | 作用 |
| --- | --- |
| `--smw-lyrics-bg` | 歌词页面背景底色 |
| `--smw-lyrics-glow-left` | 歌词页面左侧光晕颜色 |
| `--smw-lyrics-glow-right` | 歌词页面右侧光晕颜色 |
| `--smw-lyrics-current` | 当前正在播放歌词颜色 |

### 音量弹窗

| 变量 | 作用 |
| --- | --- |
| `--smw-volume-bg` | 音量弹窗背景 |
| `--smw-volume-track` | 音量轨道背景 |
| `--smw-volume-fill` | 音量已填充轨道颜色 |
| `--smw-volume-thumb` | 音量滑块圆点颜色 |
| `--smw-volume-text` | 音量百分比文字颜色 |

### 播放进度条

| 变量 | 作用 |
| --- | --- |
| `--smw-progress-track` | 播放进度条未播放部分 |
| `--smw-progress-fill` | 播放进度条已播放部分 |
| `--smw-progress-thumb` | 播放进度条圆点 |
| `--smw-progress-thumb-border` | 播放进度条圆点边框 |
| `--smw-progress-thumb-ring` | 播放进度条圆点外圈阴影 |

### 默认封面

| 变量 | 作用 |
| --- | --- |
| `--smw-cover-base` | 默认封面浅色底色 |
| `--smw-cover-base-deep` | 默认封面深色底色 |
| `--smw-cover-line` | 默认封面纹理线条 |
| `--smw-cover-dot` | 默认封面亮点 |
| `--smw-cover-dot-soft` | 默认封面弱亮点 |
| `--smw-cover-object` | 默认封面装饰主体 |
| `--smw-cover-object-border` | 默认封面装饰边框 |
| `--smw-cover-divider` | 默认封面四宫格分隔线 |

### 用户头像

| 变量 | 作用 |
| --- | --- |
| `--smw-avatar-bg` | 左下角头像浅色底色 |
| `--smw-avatar-bg-deep` | 左下角头像深色底色 |
| `--smw-avatar-fg` | 头像人物图标颜色 |
| `--smw-avatar-border` | 头像内边框 |
| `--smw-avatar-status-border` | 在线状态圆点外圈颜色 |

### 背景图

| 变量 | 作用 |
| --- | --- |
| `--smw-theme-bg-opacity` | 背景图透明度，建议 `0.12` 到 `0.32` |
| `--smw-theme-bg-size` | 背景图尺寸，例如 `cover`、`contain` |
| `--smw-theme-bg-position` | 背景图位置，例如 `center`、`top right` |
| `--smw-theme-bg-repeat` | 背景图重复方式，例如 `no-repeat`、`repeat` |

## 导入步骤

1. 打开 Mono Player。
2. 进入主题页面。
3. 点击“本地主题”里的加号卡片。
4. 选择主题包文件夹或主题包里的 `theme.json`。
5. 导入成功后，主题卡片会出现在本地主题列表中，并自动应用。

推荐直接选择主题文件夹，例如：

```text
D:\work\rust\mono\examples\themes\soft-mint
```

也可以选择主题包里的 `theme.json`：

```text
D:\work\rust\mono\examples\themes\soft-mint\theme.json
```

如果一个上级文件夹里只有一个主题包，也可以选择上级文件夹：

```text
D:\work\rust\mono\examples\themes
```

如果上级文件夹里包含多个主题包，应用会要求你选择其中一个具体主题文件夹。

## 主题市场

主题页面分为“本地主题”和“主题市场”。

- 本地主题：显示系统主题、应用内置主题、导入的自定义主题。
- 主题市场：显示可下载的主题包。

主题市场里的卡片有两个操作：

- `仅下载`：把主题加入本地主题列表，但不立刻切换。
- `下载并使用`：把主题加入本地主题列表，并立即应用。

下载后的主题会出现在本地主题里。导入或下载的自定义主题可以在本地主题卡片上卸载。

## 安全限制

当前版本有这些限制：

- 不支持主题包执行 JavaScript。
- 不支持 `@import`。
- 不支持 `url(...)` 作为变量值。
- 不支持任意 CSS 选择器。
- 单个变量值长度不能超过 160 个字符。
- 只有白名单变量会生效，其他变量会被忽略。
- `preview` 只能引用主题包内部的图片文件。
- `background` 只能引用主题包内部的图片文件。

这些限制是为了避免主题包破坏应用布局或引入不安全内容。

## 设计建议

建议主题保持 Mono Player 当前的桌面应用气质：

- 使用低饱和颜色。
- 左侧菜单、第二栏、主内容区、播放栏颜色要衔接。
- 选中态不要太亮，避免抢正文内容。
- 主按钮、当前歌词、进度条、音量滑块最好使用同一色系。
- 深色主题不要使用高饱和霓虹色。
- 文字和背景要保留足够对比度。
- 预览图应展示主题整体气质，不要放和主题无关的图案。

一个比较稳的搭配方式：

```text
背景：非常浅的冷灰 / 绿灰 / 蓝灰
面板：比背景略浅或略深
选中态：比背景深一档
按钮：低饱和深色
文字：接近黑色，但不一定用纯黑
```

## 常见问题

### 导入后没有出现主题

检查主题文件夹里是否存在：

```text
theme.json
variables.css
```

还要确认 `theme.json` 是合法 JSON。

如果你选择的是上级文件夹，确保里面只有一个主题包；如果包含多个主题包，请选择具体主题文件夹。

### 提示没有可用主题变量

说明 `variables.css` 里没有写白名单变量，或者变量写法不符合格式。

正确：

```css
:root {
  --smw-bg-workspace: #f7fbf7;
}
```

错误：

```css
.workspace {
  background: #f7fbf7;
}
```

### 主题卡片没有显示我的封面图

检查 `theme.json` 里的 `preview` 是否指向主题包内部的图片文件。

正确：

```json
{
  "preview": "preview.svg"
}
```

错误：

```json
{
  "preview": "../preview.svg"
}
```

如果没有写 `preview`，应用会自动查找主题包根目录下的 `preview.svg`、`preview.png`、`preview.jpg`、`preview.jpeg`、`preview.webp`。

### 背景图为什么没有生效

检查 `theme.json` 里的 `background` 是否指向主题包内部的图片文件。

正确：

```json
{
  "background": "background.svg"
}
```

错误：

```json
{
  "background": "../background.svg"
}
```

如果背景图太淡，可以调高 `--smw-theme-bg-opacity`。如果背景图被面板盖住，可以把相关背景变量改成半透明的 `rgba(...)`，例如 `--smw-bg-workspace` 或 `--smw-player-bg`。

### 可以导入 zip 吗

当前版本还不支持。后续可以增加 zip 解压、校验和安装流程。

## 完整示例

`theme.json`：

```json
{
  "id": "soft-mint",
  "name": "柔和薄荷",
  "author": "Mono Player",
  "version": "1.0.0",
  "type": "theme",
  "entry": "variables.css",
  "preview": "preview.svg",
  "background": "background.svg"
}
```

`variables.css`：

```css
:root {
  --smw-bg-canvas: #eef6f0;
  --smw-bg-sidebar: #edf5ef;
  --smw-bg-panel: #f8fbf8;
  --smw-library-bg: #f6faf6;
  --smw-bg-workspace: #f7fbf7;
  --smw-bg-selected: #dcebe0;
  --smw-border: #cad9cf;
  --smw-text-primary: #102018;
  --smw-text-secondary: #63766b;
  --smw-button-primary: #647a67;
  --smw-accent-blue: #647a67;
  --smw-lyrics-bg: #f7fbf7;
  --smw-lyrics-current: #647a67;
  --smw-volume-bg: #fbfdfb;
  --smw-volume-track: #dce7df;
  --smw-volume-fill: #647a67;
  --smw-volume-thumb: #647a67;
  --smw-progress-track: #dce7df;
  --smw-progress-fill: #647a67;
  --smw-progress-thumb: #647a67;
  --smw-theme-bg-opacity: 0.2;
  --smw-theme-bg-size: cover;
  --smw-theme-bg-position: center;
  --smw-theme-bg-repeat: no-repeat;
}
```
