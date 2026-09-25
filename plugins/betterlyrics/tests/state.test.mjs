import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, applyMessage, playbackTime, lyricTime, activeLine, wordProgress, configWithDefaults } from '../src/state.mjs';

test('identical cloned lyrics snapshots do not request a list rebuild', () => {
  const state = createState();
  applyMessage(state, {type:'track',trackKey:'a',activeTrack:{id:1}},0);
  const lines = [{time:0,text:'first',words:[{time:0,duration:2,text:'first'}]}];
  assert.equal(applyMessage(state,{type:'lyrics',trackKey:'a',lines},0),'lyrics');
  assert.equal(applyMessage(state,{type:'lyrics',trackKey:'a',lines:structuredClone(lines)},200),'lyrics-status');
  assert.equal(state.lines,lines);
  const changed=structuredClone(lines); changed[0].words[0].duration=3;
  assert.equal(applyMessage(state,{type:'lyrics',trackKey:'a',lines:changed},400),'lyrics');
  applyMessage(state,{type:'track',trackKey:'b',activeTrack:{id:2}},500);
  assert.equal(applyMessage(state,{type:'lyrics',trackKey:'b',lines:changed},600),'lyrics');
});

test('slightly delayed playback samples do not switch back to the previous lyric', () => {
  const state = createState();
  const lines = [{time:0}, {time:6}];
  applyMessage(state, {type:'playback',playback:{currentTime:5.9,isPlaying:true}}, 0);
  const before = playbackTime(state, 150);
  assert.equal(activeLine(lines, before), 1);
  applyMessage(state, {type:'playback',playback:{currentTime:5.98,isPlaying:true}}, 150);
  assert.ok(playbackTime(state,150) >= before);
  assert.equal(activeLine(lines,playbackTime(state,150)), 1);
  let previous = before;
  for(let now=160;now<=650;now+=10) {
    const current = playbackTime(state, now);
    assert.ok(current >= previous); previous = current;
  }
  assert.equal(playbackTime(state,650), 6.48);
  applyMessage(state, {type:'playback',playback:{currentTime:2,isPlaying:true}}, 700);
  assert.equal(playbackTime(state,700),2);
});

test('repeated transport jitter stays monotonic at half, normal and double speed', () => {
  for (const rate of [.5, 1, 2]) {
    const state = createState();
    applyMessage(state, {type:'playback',playback:{currentTime:10,isPlaying:true,playbackRate:rate}}, 0);
    let previous = 10;
    for (let now=10;now<=10000;now+=10) {
      if (now % 200 === 0) {
        const lag = now % 400 === 0 ? .07 : .02;
        applyMessage(state, {type:'playback',playback:{currentTime:10+(now/1000-lag)*rate,isPlaying:true}}, now);
      }
      const current = playbackTime(state,now);
      assert.ok(current >= previous, `${rate}x at ${now}ms`);
      previous = current;
    }
    applyMessage(state, {type:'playback',playback:{currentTime:12,isPlaying:false}}, 10010);
    assert.equal(playbackTime(state,11000),12);
  }
});

test('track changes discard old lyrics, artwork and playback; stale lyrics are ignored', () => {
  const state = createState();
  applyMessage(state, { type: 'track', trackKey: 'a', activeTrack: { id: 1, artworkDataUrl: 'data:a' } }, 0);
  applyMessage(state, { type: 'lyrics', trackKey: 'a', lines: [{ time: 0, text: 'first' }] }, 0);
  applyMessage(state, { type: 'playback', playback: { currentTime: 20, isPlaying: true } }, 0);
  assert.equal(applyMessage(state, { type: 'track', trackKey: 'b', activeTrack: { id: 2 } }, 100), 'track-change');
  assert.deepEqual(state.lines, []);
  assert.equal(state.track.artworkDataUrl, undefined);
  assert.equal(playbackTime(state, 100), 0);
  assert.equal(applyMessage(state, { type: 'lyrics', trackKey: 'a', lines: [{ time: 0, text: 'stale' }] }, 100), false);
  assert.deepEqual(state.lines, []);
});

test('same-track metadata retains late artwork unless the artwork identity changes', () => {
  const state = createState();
  const send = track => applyMessage(state, { type: 'track', trackKey: 'a', activeTrack: track }, 0);
  send({ id: 1, coverVersion: 1, artworkDataUrl: 'data:a' });
  send({ id: 1, coverVersion: 1, title: 'updated' });
  assert.equal(state.track.artworkDataUrl, 'data:a');
  send({ id: 1, coverVersion: 2 });
  assert.equal(state.track.artworkDataUrl, undefined);
  send(null);
  assert.equal(state.track, null);
  assert.deepEqual(state.lines, []);
});

test('clock interpolates rate, freezes on pause and reanchors on seeking', () => {
  const state = createState();
  applyMessage(state, { type: 'playback', playback: { currentTime: 10, isPlaying: true, playbackRate: 2 } }, 1000);
  assert.equal(playbackTime(state, 1250), 10.5);
  applyMessage(state, { type: 'playback', playback: { isPlaying: false } }, 1250);
  assert.equal(playbackTime(state, 9000), 10.5);
  applyMessage(state, { type: 'playback', playback: { currentTime: 3, isPlaying: true } }, 9000);
  assert.equal(playbackTime(state, 9250), 3.5);
  applyMessage(state, { type: 'lyrics-ui', lyricsUi: { lyricTimeOffset: -.5 } }, 9250);
  assert.equal(lyricTime(state, 9250), 3);
  state.track = { duration: 4 };
  assert.equal(playbackTime(state, 12000), 4);
});

test('word timing uses seconds, infers missing durations, handles gaps and zero duration', () => {
  const words = [{ time: 2, duration: 1, text: 'a' }, { time: 4, text: 'b' }, { time: 6, duration: 0, text: 'c' }];
  assert.deepEqual(wordProgress(words, 0, 2.5), { progress: .5, duration: 1 });
  assert.equal(wordProgress(words, 0, 3.5).progress, 1);
  assert.deepEqual(wordProgress(words, 1, 5), { progress: .5, duration: 2 });
  assert.equal(wordProgress(words, 2, 5).progress, 0);
  assert.equal(wordProgress(words, 2, 6).progress, 1);
  assert.deepEqual(wordProgress([{ time: 3, text: 'last' }], 0, 5, 7), { progress: .5, duration: 4 });
});

test('untimed and pre-roll lyrics do not become falsely active; equal timestamps share focus', () => {
  const lines = [{ time: 2 }, { time: 4 }, { time: 4 }, { time: null }];
  assert.equal(activeLine(lines, 1), -1);
  assert.equal(activeLine(lines, 4), 2);
  assert.equal(activeLine([{ time: null }], 9), -1);
  assert.equal(activeLine([], 0), -1);
  assert.equal(configWithDefaults({ fontSize: 900 }).fontSize, 72);
});
