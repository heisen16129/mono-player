import { monitorPlayback } from './monitor.mjs';
const frame = document.querySelector('iframe'), status = document.querySelector('#status');
const stability = document.createElement('output'); stability.id = 'stability';
document.querySelector('nav').append(stability);
const source = await fetch(new URL('./renderer.mjs', document.baseURI)).then(response => response.text());
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><linearGradient id="s" x2=".3" y2="1"><stop stop-color="#101b38"/><stop offset=".6" stop-color="#4d819b"/><stop offset="1" stop-color="#a3d5d1"/></linearGradient><linearGradient id="m" x2="0" y2="1"><stop stop-color="#f0d5ab"/><stop offset="1" stop-color="#527885"/></linearGradient></defs><path fill="url(#s)" d="M0 0h640v640H0z"/><circle cx="458" cy="193" r="64" fill="#e5dfc4"/><path fill="#253e50" d="M0 385 151 274 329 404 484 325 640 411V640H0Z"/><path fill="url(#m)" d="M0 462Q180 373 345 489T640 460V640H0Z"/><path fill="#193b50" d="M0 535Q190 448 379 562T640 545V640H0Z"/><text x="44" y="80" font-family="sans-serif" font-size="23" fill="#f3f4e8" letter-spacing="6">AFTER THE RAIN</text><text x="47" y="110" font-family="sans-serif" font-size="10" fill="#ffffff99" letter-spacing="4">MONO / PREVIEW SESSIONS</text></svg>`;
const cover = `data:image/svg+xml;base64,${btoa(svg)}`;
let key = 'preview-1', number = 1, time = 17, playing = false, volume = 72, favorite = false, config = {}, offset = 0;
let mode = 'normal', mounted = true, lastTick = performance.now();
const texts = ['雨停在城市的另一边','晚风把云吹得很远','沿着河岸走过的时间','都在月光里慢慢浮现','把没说完的话留给明天','让每一颗星照亮长夜','如果你也望着同一片天','就让这首歌陪在你身边','在晨光到来以前','我们听见彼此的心愿'];
const lines = texts.map((text,index) => ({ time: index*6, text, words: [...text].map((text,i,chars) => ({ time: index*6+i*4.6/chars.length, duration: i===chars.length-1?1.4:4.6/chars.length, text })) }));
const track = () => ({ id: number, path: key, title: number % 2 ? '雨后，慢慢走' : '月光来信', artist: ['Mono Sessions'], album: 'After the Rain · 预览专辑', duration: 60, artworkDataUrl: cover });
const send = data => { if(mounted) frame.contentWindow.postMessage(data, '*'); };
const sendPlayback = () => send({ type:'playback', playback:{currentTime:time,isPlaying:playing,volume,isFavorite:favorite,playbackRate:1} });
function sendLyrics() { send({type:'lyrics',trackKey:key,lines:mode==='empty'?[]:mode==='plain'?texts.map(text=>({time:null,text})):mode==='line'?lines.map(({time,text})=>({time,text})):lines}); }
function seed() {
  send({type:'track',trackKey:key,activeTrack:track()}); sendLyrics();
  send({type:'queue',queueTracks:[track(),{id:99,path:'next',title:'夜色的回声',artist:['Mono Sessions']}]});
  send({type:'config',config});
  send({type:'lyrics-ui',lyricsUi:{lyricTimeOffset:offset,isLoading:false,emptyMessage:'这首歌还没有歌词\n可以通过底部搜索添加'}});
  sendPlayback(); status.textContent = '已挂载 · 协议 v2';
}
frame.srcdoc = `<html><head><style>html,body{margin:0;width:100%;height:100%}</style></head><body><script type="module">
const source=${JSON.stringify(source).replace(/</g,'\\u003c')};
const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
const renderer=(await import(url)).default;
const api={post:(action,payload)=>parent.postMessage({type:'action',action,payload},'*')};
renderer.mount(document.body,api);
(${monitorPlayback.toString()})();
window.addEventListener('message',event=>{if(event.source!==parent)return;try{if(event.data.type==='destroy'){renderer.destroy();parent.postMessage({type:'destroyed',count:document.body.childElementCount},'*')}else if(event.data.type==='mount'){renderer.mount(document.body,api);parent.postMessage({type:'ready'},'*')}else renderer.update(event.data)}catch(error){parent.postMessage({type:'error',message:String(error)},'*')}});
window.addEventListener('error',e=>parent.postMessage({type:'error',message:e.message},'*'));
window.addEventListener('unhandledrejection',e=>parent.postMessage({type:'error',message:String(e.reason)},'*'));
parent.postMessage({type:'ready'},'*');
<\/script></body></html>`;
window.addEventListener('message', event => {
  if(event.source!==frame.contentWindow) return;
  const {type,action,payload} = event.data;
  if(type==='ready') seed();
  if(type==='stability') stability.textContent = `采样 ${event.data.frames} 帧 · 退行 ${event.data.backwards} · 滚动反向 ${event.data.reversals} · 列表重建 ${event.data.rebuilds}`;
  if(type==='error') { status.textContent=`错误：${event.data.message}`; console.error(event.data.message); }
  if(type==='destroyed') status.textContent=`已卸载 · 根节点子元素 ${event.data.count}`;
  if(type!=='action') return;
  status.textContent=`动作：${action}`;
  if(action==='togglePlayback') playing=!playing;
  if(action==='seekTime') time=payload.time;
  if(action==='seek') time=Math.max(0,lines[payload.lineIndex].time-offset);
  if(action==='setVolume') volume=payload.value;
  if(action==='toggleMute') volume=volume?0:72;
  if(action==='toggleFavorite') favorite=!favorite;
  if(action==='updateConfig') setTimeout(()=>{config=payload.config;send({type:'config',config});},400);
  if(['playNext','playPrevious','playQueueTrack'].includes(action)) switchTrack();
  if(action==='shiftTiming') {offset+=payload.deltaSeconds;send({type:'lyrics-ui',lyricsUi:{lyricTimeOffset:offset}});}
  sendPlayback();
});
function switchTrack(){number++;key=`preview-${number}`;time=0;send({type:'track',trackKey:key,activeTrack:{...track(),artworkDataUrl:undefined}});send({type:'lyrics',trackKey:'stale',lines:[{time:0,text:'这条旧歌词不应该显示'}]});setTimeout(()=>{send({type:'track',trackKey:key,activeTrack:track()});sendLyrics();sendPlayback();},350);}
for(const name of ['normal','line','plain','empty']) document.querySelector(`#${name}`).onclick=()=>{mode=name;sendLyrics();};
document.querySelector('#switch').onclick=switchTrack;
document.querySelector('#lifecycle').onclick=()=>{frame.contentWindow.postMessage({type:mounted?'destroy':'mount'},'*');mounted=!mounted;};
// Match the host's deep context watcher: unchanged lyric snapshots may be sent
// again whenever playback changes. A renderer must preserve its DOM and scroll.
setInterval(()=>{const now=performance.now();if(playing)time=Math.min(60,time+(now-lastTick)/1000);lastTick=now;sendPlayback();sendLyrics();send({type:'config',config});},200);
