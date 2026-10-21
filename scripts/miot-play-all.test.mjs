import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync('plugin/miot/ui/frontend/src/store.ts','utf8');
const body = source.slice(source.indexOf('export async function playAllSpeakers'), source.indexOf('export async function playerCommand'));
const {code} = await transform(body.replace('export ',''),{loader:'ts'});
for (const fail of [false,true]) test(`all speakers deduplicates groups, skips offline; failure=${fail}`,async()=>{
 const calls=[], notices=[];
 const state={playerBusy:false,selectedPlaylistId:'1',songs:[{id:3}],player:{current_song:{id:3}},devices:[{account_id:'a',devices:[{id:'1',presence:'online'},{id:'2',presence:'online'},{id:'3',presence:'offline'},{id:'4',presence:'online'}]}],groups:[{id:'g',members:[{account_id:'a',device_id:'1'},{account_id:'a',device_id:'2'}]}]};
 const context=vm.createContext({state,deviceId:d=>d.id,deviceName:d=>d.id,loadGroups:async()=>{},post:async(path,b)=>{calls.push(b);if(fail&&b.device_id==='4')throw Error('offline');},requestStatusRefresh(){},refreshPlayerStatus:async()=>{},messageOf:String,notify:(...args)=>notices.push(args)});
 vm.runInContext(code,context);
 assert.equal(await vm.runInContext('playAllSpeakers()',context),!fail);
 assert.deepEqual(calls.map(c=>c.device_id),['1','4']);
 assert.ok(calls.every(c=>c.song_id===3&&c.playlist_id===1));
 assert.equal(state.playerBusy,false);
 assert.equal(notices[0][1],fail?'error':'success');
});

test('pause all needs no playlist and never toggles devices back to playing', async()=>{
 const paths=[];
 const state={playerBusy:false,selectedPlaylistId:'',songs:[],player:{},groups:[],devices:[{account_id:'a',devices:[{id:'1',presence:'online'}]}]};
 const context=vm.createContext({state,deviceId:d=>d.id,deviceName:d=>d.id,loadGroups:async()=>{},post:async(path,b)=>{paths.push(path);assert.equal(b.song_id,undefined);},requestStatusRefresh(){},refreshPlayerStatus:async()=>{},messageOf:String,notify(){}});
 vm.runInContext(code,context);
 assert.equal(await vm.runInContext("playAllSpeakers('pause')",context),true);
 assert.deepEqual(paths,['/player/pause']);
 assert.equal(state.playerBusy,false);
});
