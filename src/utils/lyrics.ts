import type { LyricLine } from '../types/music';

const timeTagPattern = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function parseRawLyrics(rawLyrics?: string | null): LyricLine[] {
  if (!rawLyrics?.trim()) return [];

  const lines: LyricLine[] = [];
  for (const rawLine of rawLyrics.split(/\r?\n/)) {
    const text = rawLine.replace(timeTagPattern, '').trim();
    const matches = [...rawLine.matchAll(timeTagPattern)];

    if (matches.length === 0) {
      if (text) lines.push({ time: null, text });
      continue;
    }

    if (!text) continue;

    const timedWords = parseTimedWords(rawLine, matches);
    if (timedWords.length > 1) {
      lines.push({
        time: timedWords[0].time,
        text: timedWords.map((word) => word.text).join('').trim(),
        words: timedWords,
      });
      continue;
    }

    for (const match of matches) {
      lines.push({
        time: parseLyricTime(match),
        text,
      });
    }
  }

  return lines.sort((left, right) => {
    if (left.time === null && right.time === null) return 0;
    if (left.time === null) return 1;
    if (right.time === null) return -1;
    return left.time - right.time;
  });
}

function parseTimedWords(rawLine: string, matches: RegExpMatchArray[]) {
  return matches
    .map((match, index) => {
      const matchStart = match.index ?? 0;
      const matchEnd = matchStart + match[0].length;
      const nextMatchStart = matches[index + 1]?.index ?? rawLine.length;
      const leadingText = index === 0 ? rawLine.slice(0, matchStart) : '';
      const text = rawLine.slice(matchEnd, nextMatchStart) || leadingText;
      return {
        time: parseLyricTime(match),
        text,
      };
    })
    .filter((word) => word.text.trim().length > 0);
}

function parseLyricTime(match: RegExpMatchArray) {
  return parseTimeParts(match[1], match[2], match[3]);
}

function parseTimeParts(minutesValue: string, secondsValue: string, fractionValue?: string) {
  const minutes = Number(minutesValue);
  const seconds = Number(secondsValue);
  const fraction = fractionValue ?? '0';
  const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3));
  return minutes * 60 + seconds + milliseconds / 1000;
}
