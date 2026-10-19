import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
import {ref, watch, effectScope, nextTick} from 'vue';

test('actual quality wins over plugin default, tracks switches and remains unknown when absent', async () => {
  const timers = [];
  const context = vm.createContext({ref,watch,onBeforeUnmount:()=>{},window:{setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout:()=>{}},resolvePluginPlaybackQualitiesWithRust:async()=>({defaultQuality:'lossless',qualities:[{id:'lossless',available:true},{id:'standard',available:true}]})});
  const source = readFileSync('src/composables/useOnlineQualityRefresh.ts','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
  const {code}=await transform(source,{loader:'ts'});vm.runInContext(code,context);
  const plugin=ref(null), playing=ref(null), scope=effectScope();
  const state=scope.run(()=>context.useOnlineQualityRefresh({activePluginTrack:plugin,activePlaybackTrack:playing}));
  plugin.value={providerId:'p',id:'1'};
  playing.value={sourceProviderId:'p',sourceId:'1',actualQuality:'standard'};
  await nextTick(); timers.at(-1)(); await new Promise(setImmediate);
  assert.equal(state.onlinePlaybackQuality.value,'standard');
  playing.value={...playing.value,actualQuality:'lossless'};await nextTick();
  assert.equal(state.onlinePlaybackQuality.value,'lossless');
  plugin.value={providerId:'p',id:'2'};await nextTick();
  assert.equal(state.onlinePlaybackQuality.value,'');
  playing.value={sourceProviderId:'p',sourceId:'2',actualQuality:null};await nextTick();
  timers.at(-1)();await new Promise(setImmediate);
  assert.equal(state.onlinePlaybackQuality.value,'');
  scope.stop();
});
