import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const source=readFileSync('src/services/desktopPlaybackCard.ts','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
const {code}=await transform(source,{loader:'ts'});
test('card style writes are serialized and preserve other canonical plugin settings',async()=>{
  let saved={cardStyle:'minimal',other:'keep'}; const writes=[];
  const context=vm.createContext({getPluginConfig:async id=>{assert.equal(id,'playback-card');return saved;},
    savePluginConfig:async(id,value)=>{assert.equal(id,'playback-card');saved=value;writes.push({...value});}});
  vm.runInContext(code,context);
  await Promise.all([context.saveDesktopCardStyle('ancient'),context.saveDesktopCardStyle('sticky')]);
  assert.equal(saved.cardStyle,'sticky'); assert.equal(saved.other,'keep');
  assert.deepEqual(writes.map(value=>value.cardStyle),['ancient','sticky']);
});
