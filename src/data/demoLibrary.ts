import type { PlaylistSummary, Track } from '../types/music';

// Empty libraries still need realistic rows so the interface can be reviewed without local files.
export const demoTracks: Track[] = [
  { id: -1, path: '', title: '夜间电台', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 222 },
  { id: -2, path: '', title: '城市雨声', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 250 },
  { id: -3, path: '', title: '霓虹与灯塔', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 238 },
  { id: -4, path: '', title: '失眠博物馆', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 201 },
  { id: -5, path: '', title: '慢速告别', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 273 },
  { id: -6, path: '', title: '无人便利店', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 187 },
  { id: -7, path: '', title: '窗台上的风', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 259 },
  { id: -8, path: '', title: '凌晨两点的海', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 316 },
  { id: -9, path: '', title: '旧胶片放映机', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 216 },
  { id: -10, path: '', title: '再见，明天见', artist: 'Luna Chen', album: '夜晚与咖啡', duration: 176 },
];

export const demoPlaylists: PlaylistSummary[] = [
  { title: '夜晚与咖啡', count: 28, selected: true, tone: 'night' },
  { title: '城市漫游计划', count: 42, selected: false, tone: 'city' },
  { title: '极简轻音乐', count: 36, selected: false, tone: 'mist' },
  { title: '独立摇滚精选', count: 68, selected: false, tone: 'stage' },
  { title: '工作专注 BGM', count: 100, selected: false, tone: 'desk' },
  { title: '周末放松时光', count: 31, selected: false, tone: 'road' },
];
