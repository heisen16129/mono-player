import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';
const source = readFileSync(new URL('../src/services/desktopLyricsOptions.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader:'ts' });
for (const [current, selected, expected] of [
  ['desktop-lyrics', 'card:ancient', 'card'],
  ['plugin-desktop-playback-card', 'floating', 'floating'],
  [null, 'card:sticky', null],
]) {
  test(`select ${selected} while ${current || 'closed'}`, async () => {
    const opened = [], closed = [], styles = [], saved = [];
    const context = vm.createContext({
      DESKTOP_LYRICS_LABEL:'desktop-lyrics', DESKTOP_CARD_LABEL:'desktop-playback-card',
      WebviewWindow:{ getByLabel:async label => label === current ? { isVisible:async()=>true, close:async()=>closed.push(label) } : null },
      saveDesktopCardStyle:async style=>styles.push(style),
      savePluginConfig:async (id, config)=>saved.push({id, config}),
      openDesktopLyricsWindow:async()=>opened.push('floating'),
      listPluginPackages:async()=>[{id:'playback-card',enabled:true,entry:{renderer:'ui/renderer.mjs'}}],
      openPluginDesktop:async()=>opened.push('card'),
    });
    vm.runInContext(code, context);
    await vm.runInContext(`selectDesktopLyricsStyle('${selected}')`, context);
    assert.deepEqual(opened, expected ? [expected] : []);
    assert.deepEqual(closed, expected ? [current] : []);
    assert.deepEqual(styles, selected.startsWith('card:') ? [selected.slice(5)] : []);
    assert.equal(saved[0].config.rendererId, selected.startsWith('card:') ? 'playback-card' : selected);
  });
}

for (const rendererId of ['playback-card', 'floating', undefined]) {
  test(`open saved desktop style ${rendererId || 'default'}`, async () => {
    const opened = [];
    const context = vm.createContext({
      DESKTOP_LYRICS_LABEL:'desktop-lyrics', DESKTOP_CARD_LABEL:'desktop-playback-card',
      WebviewWindow:{getByLabel:async()=>null},
      getPluginConfig:async id=>{assert.equal(id,'desktop-lyrics.host');return {rendererId};},
      openDesktopLyricsWindow:async()=>opened.push('floating'),
      listPluginPackages:async()=>[{id:'playback-card',enabled:true,entry:{renderer:'ui/renderer.mjs'}}],
      openPluginDesktop:async plugin=>opened.push(plugin.id),
    });
    vm.runInContext(code, context);
    await vm.runInContext('openSelectedDesktopLyrics()', context);
    assert.deepEqual(opened, [rendererId === 'playback-card' ? 'playback-card' : 'floating']);
  });
}

test('playback bar opens the selected style and broadcasts current lyrics', async () => {
  const syncSource = readFileSync(new URL('../src/composables/useDesktopLyricsSync.ts', import.meta.url), 'utf8');
  const compiled = await transform(syncSource.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), {loader:'ts'});
  const calls = [];
  const context = vm.createContext({
    watch:()=>{},
    openSelectedDesktopLyrics:async()=>calls.push('selected'),
    toggleDesktopLyricsWindow:async()=>calls.push('toggle'),
    broadcastDesktopLyricsState:async state=>{assert.equal(state.currentTime,42);calls.push('state');},
  });
  vm.runInContext(compiled.code, context);
  await vm.runInContext(`(async()=>{
    const sync=useDesktopLyricsSync({activeTrack:{value:null},playbackLyricVariant:{value:null},playbackTime:{value:42},isAudioPlaying:{value:false},settings:{value:{useThemeLyricColor:false,lyricFontColor:'#fff'}}});
    await sync.openDesktopLyrics();
    await sync.toggleDesktopLyrics();
  })()`, context);
  assert.deepEqual(calls,['selected','state','toggle','state']);
});
