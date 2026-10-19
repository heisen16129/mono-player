import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transform } from 'esbuild';
const source=readFileSync('src/services/desktopLyricsAppearance.ts','utf8');
const {code}=await transform(source.replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''),{loader:'ts'});
test('appearance defaults and bounds keep desktop lyrics visible',()=>{
 const ctx=vm.createContext({});vm.runInContext(code,ctx);
 assert.equal(vm.runInContext('normalizeDesktopAppearance({}).scale',ctx),1);
 assert.equal(vm.runInContext('normalizeDesktopAppearance({opacity:0}).opacity',ctx),.2);
 assert.equal(vm.runInContext('normalizeDesktopAppearance({scale:10}).scale',ctx),1.5);
 assert.equal(vm.runInContext('normalizeDesktopAppearance({scale:NaN}).scale',ctx),1);
});
test('appearance saves in order and broadcasts saved settings',async()=>{
 const saved=[],events=[];
 const ctx=vm.createContext({savePluginConfig:async(id,v)=>saved.push(v),emit:async(name,v)=>events.push(v)});vm.runInContext(code,ctx);
 await vm.runInContext('Promise.all([saveDesktopAppearance({scale:.8,opacity:.5,locked:true}),saveDesktopAppearance({scale:1.2,opacity:1,locked:false})])',ctx);
 assert.equal(saved.length,2);assert.equal(events[1].scale,1.2);assert.equal(events[1].locked,false);
});
