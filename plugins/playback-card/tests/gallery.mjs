import { cardStyles } from '../src/cardStyles.mjs';
const source = await fetch('../renderer.mjs').then(response => response.text());
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><linearGradient id="s" x2=".3" y2="1"><stop stop-color="#101b38"/><stop offset=".6" stop-color="#4d819b"/><stop offset="1" stop-color="#a3d5d1"/></linearGradient><linearGradient id="m" x2="0" y2="1"><stop stop-color="#f0d5ab"/><stop offset="1" stop-color="#527885"/></linearGradient></defs><path fill="url(#s)" d="M0 0h640v640H0z"/><circle cx="458" cy="193" r="64" fill="#e5dfc4"/><path fill="#253e50" d="M0 385 151 274 329 404 484 325 640 411V640H0Z"/><path fill="url(#m)" d="M0 462Q180 373 345 489T640 460V640H0Z"/><path fill="#193b50" d="M0 535Q190 448 379 562T640 545V640H0Z"/><text x="44" y="80" font-family="sans-serif" font-size="23" fill="#f3f4e8" letter-spacing="6">AFTER THE RAIN</text><text x="47" y="110" font-family="sans-serif" font-size="10" fill="#ffffff99" letter-spacing="4">MONO / PREVIEW SESSIONS</text></svg>`;
const cover = `data:image/svg+xml;base64,${btoa(svg)}`;

const texts = ['沿着河岸走过的时间', '都在月光里慢慢浮现', '把没说完的话留给明天', '让每一颗星照亮长夜'];
const translations = ['The time we spent walking by the river', 'Returns quietly in the moonlight', 'Leave the unspoken words for tomorrow', 'Let every star light up the night'];
const lines = texts.flatMap((text, i) => [{ time: i * 6, text }, { time: i * 6, text: translations[i] }]);
for (const style of cardStyles) {
  const section = document.createElement('section');
  const title = document.createElement('h2'); title.textContent = style.name;
  const frame = document.createElement('iframe'); frame.title = style.name; frame.sandbox = 'allow-scripts';
  frame.srcdoc = `<body><script type="module">const source=${JSON.stringify(source).replace(/</g,'\u003c')}; const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const renderer=(await import(url)).default;renderer.mount(document.body,{post(){}});renderer.update({type:'track',trackKey:'sample',activeTrack:${JSON.stringify({ title: '雨后，慢慢走', artist: ['Mono Sessions'], artworkDataUrl: cover, duration: 240 })}});renderer.update({type:'lyrics',trackKey:'sample',lines:${JSON.stringify(style.id === 'ancient' ? [{time:0,text:'雨后的长街（A Long Walk After The Rain）— Mono Sessions'}, ...lines.slice(2)] : lines)}});renderer.update({type:'config',config:{desktop:true,cardStyle:'${style.id}'}});renderer.update({type:'playback',playback:{currentTime:1,isPlaying:false}});<\/script>`;
  section.append(title, frame); document.querySelector('main').append(section);
}
