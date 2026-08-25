import ClassicLyricsRenderer from '../components/lyrics/renderers/ClassicLyricsRenderer.vue';
import FocusLyricsRenderer from '../components/lyrics/renderers/FocusLyricsRenderer.vue';
import type { LyricsRendererPlugin } from '../types/lyricsRenderer';
import { DEFAULT_LYRICS_RENDERER_ID, getLyricsRenderer, registerLyricsRenderer } from './registry';

const classicLyricsRenderer: LyricsRendererPlugin = {
  id: DEFAULT_LYRICS_RENDERER_ID,
  name: '经典歌词',
  nameEn: 'Classic lyrics',
  description: '保留播放器当前的双栏歌词布局和同步滚动。',
  component: ClassicLyricsRenderer,
  ownsSurface: true,
};

const focusLyricsRenderer: LyricsRendererPlugin = {
  id: 'focus',
  name: '专注歌词',
  nameEn: 'Focus lyrics',
  description: '隐藏封面并将歌词区域居中放大。',
  component: FocusLyricsRenderer,
  ownsSurface: true,
  configSchema: {
    fields: [
      {
        key: 'maxWidth',
        label: '歌词区域宽度',
        labelEn: 'Lyrics width',
        type: 'number',
        defaultValue: 760,
        placeholder: '520-1200',
      },
    ],
  },
  defaultConfig: {
    maxWidth: 760,
  },
};

export function ensureBuiltinLyricsRenderers() {
  if (!getLyricsRenderer(DEFAULT_LYRICS_RENDERER_ID)) {
    registerLyricsRenderer(classicLyricsRenderer);
  }
  if (!getLyricsRenderer(focusLyricsRenderer.id)) {
    registerLyricsRenderer(focusLyricsRenderer);
  }
}
