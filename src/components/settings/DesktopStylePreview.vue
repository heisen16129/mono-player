<script setup lang="ts">
import { computed } from 'vue';
import source from '../../../plugin/playback-card/ui/renderer.mjs?raw';
const props = defineProps<{ styleId: string }>();
const documentSource = computed(() => {
  const code = JSON.stringify(source).replace(/</g, '\\u003c');
  const style = JSON.stringify(props.styleId).replace(/</g, '\\u003c');
  return `<body><script type="module">
const url=URL.createObjectURL(new Blob([${code}],{type:'text/javascript'}));
const renderer=(await import(url)).default;URL.revokeObjectURL(url);
renderer.mount(document.body,{});
const artwork='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#294950"/><circle cx="285" cy="110" r="48" fill="#e9cf92"/><path d="M0 280L120 140 270 340 400 210V400H0" fill="#698c88"/><path d="M0 340L175 245 320 340 400 290V400H0" fill="#a8b9a5"/></svg>');
renderer.update({type:'track',trackKey:'preview',activeTrack:{title:'晴天',artist:['Mono'],duration:240,artworkDataUrl:artwork}});
renderer.update({type:'lyrics',trackKey:'preview',lines:[{time:0,text:'让音乐陪在身边'},{time:5,text:'把故事写进旋律'},{time:10,text:'每一刻都值得珍藏'},{time:15,text:'听见生活的回响'}]});
renderer.update({type:'config',config:{desktop:true,cardStyle:${style}}});
const css=document.createElement('style');css.textContent='.style-toolbar,.settings-toggle,.desktop-launch,.drag,footer,.progress{display:none!important}.card-shell{padding-top:0}.surface{padding:16px 8px 8px;justify-content:flex-start;overflow:hidden}';document.head.append(css);
<\/script>`;
});
</script>
<template>
  <div class="preview" aria-hidden="true">
    <div v-if="styleId === 'floating'" class="floating"><span>让音乐陪在身边</span><small>把故事写进旋律</small></div>
    <div v-else-if="styleId === 'plugin'" class="custom">♫<small>自定义</small></div>
    <iframe v-else :srcdoc="documentSource" sandbox="allow-scripts" loading="lazy" tabindex="-1" title="样式缩略图" />
  </div>
</template>
<style scoped>
.preview{height:134px;width:100%;position:relative;overflow:hidden;pointer-events:none;background:var(--smw-bg-hover);border-radius:5px}
iframe{position:absolute;left:50%;top:3px;margin-left:-44.24px;width:316px;height:460px;border:0;transform:scale(.28);transform-origin:top left}
.floating,.custom{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#263941;color:#f8d269;font-size:11px;font-weight:700}
small{font-size:9px;color:#c2d1d4;font-weight:400}.custom{font-size:28px}
</style>
