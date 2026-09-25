export function currentLines(lines, time) {
  const timed = lines.filter(line => Number.isFinite(line.time));
  if (!timed.length) return { current: lines[0]?.text || '', next: '' };
  let index = -1;
  for (let i = 0; i < timed.length; i++) if (timed[i].time <= time) index = i;
  if (index < 0) return { current: '', next: timed[0].text };
  const start = timed[index].time;
  const group = timed.filter(line => line.time === start).map(line => line.text);
  return { current: group.join(' · '), next: timed[index + 1]?.text || '' };
}

export function clock(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function cardLines(lines, time, count = 4) {
  const groups = [];
  for (const line of lines) {
    const previous = groups.at(-1);
    if (Number.isFinite(line.time) && previous?.time === line.time) previous.secondary.push(line.text);
    else groups.push({ time: line.time, text: line.text, secondary: [] });
  }
  let active = -1;
  groups.forEach((line, index) => { if (Number.isFinite(line.time) && line.time <= time) active = index; });
  const start = Math.max(0, Math.min(active, groups.length - count));
  return groups.slice(start, start + count).map((line, index) => ({
    text: line.text, secondary: line.secondary.join(' · '), active: start + index === active,
  }));
}
