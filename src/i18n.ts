import type { AppLocale, Locale } from './types/music';

type MessageKey =
  | 'allSongs'
  | 'artist'
  | 'artists'
  | 'artistsList'
  | 'artistSongs'
  | 'author'
  | 'autoLanguage'
  | 'autoHideLyricsDock'
  | 'backup'
  | 'cancel'
  | 'canceling'
  | 'close'
  | 'closeAction'
  | 'collapseSidebar'
  | 'confirm'
  | 'darkTheme'
  | 'blueWhiteTheme'
  | 'emptyArtists'
  | 'emptyFavorites'
  | 'emptyFolders'
  | 'emptyQueue'
  | 'emptyRecentAdded'
  | 'emptyRecentPlayed'
  | 'emptySongs'
  | 'exitApp'
  | 'favorite'
  | 'favorites'
  | 'fontSize'
  | 'fontColor'
  | 'highQuality'
  | 'language'
  | 'lightTheme'
  | 'localFolder'
  | 'localFolders'
  | 'localLibrary'
  | 'localMusic'
  | 'locateCurrentTrack'
  | 'lowQuality'
  | 'lyrics'
  | 'lyricsLoading'
  | 'maxHistory'
  | 'mcp'
  | 'minimizeToTray'
  | 'musicLibrary'
  | 'network'
  | 'noLyrics'
  | 'nowPlayingQueue'
  | 'online'
  | 'openLyrics'
  | 'play'
  | 'playAll'
  | 'playback'
  | 'playbackQueue'
  | 'plugins'
  | 'preferences'
  | 'qualityFallback'
  | 'readyToPlay'
  | 'recentAdded'
  | 'recentPlayed'
  | 'restoreVolume'
  | 'scanDialogTitle'
  | 'scanEmpty'
  | 'scanFolder'
  | 'scanHint'
  | 'scanLocalMusic'
  | 'scanning'
  | 'searchPlaceholder'
  | 'settings'
  | 'shortcuts'
  | 'songListHiddenColumns'
  | 'standardQuality'
  | 'toggleFavorite'
  | 'themes'
  | 'localThemes'
  | 'searchThemes'
  | 'themeStyle'
  | 'themeStore'
  | 'unknownArtist'
  | 'unknownTrack'
  | 'useMainWindowPreview'
  | 'useNowPlayingCover'
  | 'useThemeColor'
  | 'volume'
  | 'mute';

const messages: Record<AppLocale, Record<MessageKey, string>> = {
  'zh-CN': {
    allSongs: '全部歌曲',
    artist: '艺术家',
    artists: '艺术家',
    artistsList: '艺术家列表',
    artistSongs: '艺术家歌曲列表',
    author: '作者',
    autoLanguage: '自动识别系统语言',
    autoHideLyricsDock: '歌词页播放后自动隐藏播放栏',
    backup: '备份与恢复',
    cancel: '取消',
    canceling: '取消中...',
    close: '关闭',
    closeAction: '单击退出按钮时',
    collapseSidebar: '收起侧边栏',
    confirm: '确认',
    darkTheme: '深色主题',
    blueWhiteTheme: '蓝白主题',
    emptyArtists: '还没有艺术家',
    emptyFavorites: '还没有收藏歌曲',
    emptyFolders: '尚未添加本地文件夹',
    emptyQueue: '当前播放队列为空',
    emptyRecentAdded: '还没有最近添加歌曲',
    emptyRecentPlayed: '还没有最近播放歌曲',
    emptySongs: '暂无歌曲',
    exitApp: '退出应用',
    favorite: '喜欢',
    favorites: '收藏',
    fontSize: '设置字号',
    fontColor: '字体颜色',
    highQuality: '高音质',
    language: '语言',
    lightTheme: '灰白主题',
    localFolder: '本地文件夹',
    localFolders: '本地文件夹',
    localLibrary: '本地音乐库',
    localMusic: '本地音乐',
    locateCurrentTrack: '定位当前音乐',
    lowQuality: '低音质',
    lyrics: '歌词',
    lyricsLoading: '正在加载歌词...',
    maxHistory: '搜索历史记录最多保存条数',
    mcp: 'MCP',
    minimizeToTray: '最小化到托盘',
    musicLibrary: '音乐库',
    network: '网络',
    noLyrics: '暂无歌词',
    nowPlayingQueue: '当前播放队列',
    online: '在线',
    openLyrics: '打开歌词页面',
    play: '播放',
    playAll: '播放全部',
    playback: '播放',
    playbackQueue: '播放队列',
    plugins: '插件',
    preferences: '偏好设置',
    qualityFallback: '播放音质缺失时',
    readyToPlay: '准备播放本地音乐',
    recentAdded: '最近添加',
    recentPlayed: '最近播放',
    restoreVolume: '恢复音量',
    scanDialogTitle: '扫描本地音乐',
    scanEmpty: '还没有添加扫描文件夹',
    scanFolder: '扫描文件夹',
    scanHint: '将自动扫描勾选的文件夹（文件增删实时同步）',
    scanLocalMusic: '扫描本地音乐',
    scanning: '扫描中...',
    searchPlaceholder: '搜索歌曲 / 歌手',
    settings: '设置',
    shortcuts: '快捷键',
    songListHiddenColumns: '歌曲列表隐藏列',
    standardQuality: '标准音质',
    toggleFavorite: '切换收藏',
    themes: '主题',
    localThemes: '本地主题',
    searchThemes: '在这里输入搜索内容',
    themeStyle: '主题样式',
    themeStore: '主题市场',
    unknownArtist: '未知艺术家',
    unknownTrack: '未选择歌曲',
    useMainWindowPreview: '主窗口界面',
    useNowPlayingCover: '当前播放歌曲的封面',
    useThemeColor: '使用主题色',
    volume: '音量',
    mute: '静音',
  },
  'en-US': {
    allSongs: 'All Songs',
    artist: 'Artist',
    artists: 'Artists',
    artistsList: 'Artists',
    artistSongs: 'Artist songs',
    author: 'Author',
    autoLanguage: 'Use system language',
    autoHideLyricsDock: 'Auto-hide player bar on lyrics page',
    backup: 'Backup & Restore',
    cancel: 'Cancel',
    canceling: 'Canceling...',
    close: 'Close',
    closeAction: 'When clicking close',
    collapseSidebar: 'Collapse sidebar',
    confirm: 'Confirm',
    darkTheme: 'Dark theme',
    blueWhiteTheme: 'Blue White theme',
    emptyArtists: 'No artists yet',
    emptyFavorites: 'No favorite songs yet',
    emptyFolders: 'No local folders yet',
    emptyQueue: 'The playback queue is empty',
    emptyRecentAdded: 'No recently added songs yet',
    emptyRecentPlayed: 'No recently played songs yet',
    emptySongs: 'No songs',
    exitApp: 'Exit app',
    favorite: 'Like',
    favorites: 'Favorites',
    fontSize: 'Font size',
    fontColor: 'Font color',
    highQuality: 'High quality',
    language: 'Language',
    lightTheme: 'Gray White theme',
    localFolder: 'Local folder',
    localFolders: 'Local folders',
    localLibrary: 'Local Library',
    localMusic: 'Local Music',
    locateCurrentTrack: 'Locate current track',
    lowQuality: 'Low quality',
    lyrics: 'Lyrics',
    lyricsLoading: 'Loading lyrics...',
    maxHistory: 'Max search history items',
    mcp: 'MCP',
    minimizeToTray: 'Minimize to tray',
    musicLibrary: 'Library',
    network: 'Network',
    noLyrics: 'No lyrics',
    nowPlayingQueue: 'Current playback queue',
    online: 'Online',
    openLyrics: 'Open lyrics',
    play: 'Play',
    playAll: 'Play All',
    playback: 'Playback',
    playbackQueue: 'Queue',
    plugins: 'Plugins',
    preferences: 'Preferences',
    qualityFallback: 'When quality is unavailable',
    readyToPlay: 'Ready to play local music',
    recentAdded: 'Recently Added',
    recentPlayed: 'Recently Played',
    restoreVolume: 'Restore volume',
    scanDialogTitle: 'Scan Local Music',
    scanEmpty: 'No scan folders yet',
    scanFolder: 'Scan Folder',
    scanHint: 'Selected folders will be scanned automatically and kept in sync.',
    scanLocalMusic: 'Scan local music',
    scanning: 'Scanning...',
    searchPlaceholder: 'Search songs / artists',
    settings: 'Settings',
    shortcuts: 'Shortcuts',
    songListHiddenColumns: 'Hidden song list columns',
    standardQuality: 'Standard quality',
    toggleFavorite: 'Toggle favorite',
    themes: 'Themes',
    localThemes: 'Local Themes',
    searchThemes: 'Search themes',
    themeStyle: 'Theme Style',
    themeStore: 'Theme Store',
    unknownArtist: 'Unknown Artist',
    unknownTrack: 'No song selected',
    useMainWindowPreview: 'Main window view',
    useNowPlayingCover: 'Current song cover',
    useThemeColor: 'Use theme color',
    volume: 'Volume',
    mute: 'Mute',
  },
};

export function resolveLocale(locale: Locale): AppLocale {
  if (locale !== 'system') return locale;

  const language = navigator.language || navigator.languages?.[0] || '';
  return language.toLocaleLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function t(locale: Locale, key: MessageKey) {
  const resolvedLocale = resolveLocale(locale);
  return messages[resolvedLocale]?.[key] ?? messages['zh-CN'][key] ?? key;
}

export function songCount(locale: Locale, count: number) {
  return resolveLocale(locale) === 'en-US' ? `${count} songs` : `${count} 首`;
}

export function songCountLong(locale: Locale, count: number) {
  return resolveLocale(locale) === 'en-US' ? `${count} songs` : `${count} 首歌曲`;
}

export function durationText(locale: Locale, hours: number, minutes: number) {
  if (resolveLocale(locale) === 'en-US') {
    return hours > 0 ? `${hours} hr ${minutes} min` : `${Math.max(1, minutes)} min`;
  }

  return hours > 0 ? `${hours} 小时 ${minutes} 分` : `${Math.max(1, minutes)} 分`;
}
