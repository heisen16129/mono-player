// Layout adaptations of BetterLyrics' LyricsCard*Style.xaml templates.
export const cardStyles = [
  { id: 'minimal', name: '极简', mark: 'NOW PLAYING' },
  { id: 'cinematic', name: '电影', mark: 'NOW SHOWING' },
  { id: 'magazine', name: '杂志', mark: 'LYRICS' },
  { id: 'ticket', name: '票根', mark: 'ADMIT ONE' },
  { id: 'journal', name: '手账', mark: '时光印记' },
  { id: 'sticky', name: '便签', mark: 'a note to myself' },
  { id: 'ink', name: '水墨', mark: '曲拨心弦 · 词落云笺', edition: '曲拨心弦　词落云笺' },
  { id: 'guofeng', name: '国风', mark: '曲拨心弦 · 词落云笺', edition: '曲拨心弦　词落云笺' },
  { id: 'ancient', name: '古籍', mark: '曲拨心弦　词落云笺', edition: '卷一' },
  { id: 'vinyl', name: '黑胶', mark: 'SIDE A · 33⅓ RPM' },
  { id: 'cd', name: 'CD', mark: 'COMPACT DISC · DIGITAL AUDIO' },
  { id: 'polaroid', name: '拍立得', mark: 'a moment in music' },
  { id: 'receipt', name: '收据', mark: 'OFFICIAL RECEIPT', edition: 'MONO MUSIC STORE' },
  { id: 'swiss', name: '瑞士排版', mark: '01', edition: 'NOW PLAYING' },
];
export function cardStyle(value) { return cardStyles.find(style => style.id === value) || cardStyles[0]; }

// Playback snapshots can carry an older config while a save is in flight.
export function createStyleSelection() {
  let selected = 'minimal', pending = null;
  return {
    choose(value) { selected = cardStyle(value).id; pending = selected; return selected; },
    receive(value) {
      const incoming = cardStyle(value).id;
      if (incoming === pending) pending = null;
      if (pending === null) selected = incoming;
      return selected;
    },
  };
}
