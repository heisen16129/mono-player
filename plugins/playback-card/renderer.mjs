/*! Mono Playback Card for Mono — GPL-3.0-only. See LICENSE and NOTICE.md. */

// src/styles.css
var styles_default = `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:transparent}button,select{font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid #a48750;outline-offset:2px}\r
.surface{height:100%;padding:16px 8px 8px;display:flex;align-items:center;justify-content:safe center;flex-direction:column;gap:10px;overflow:auto;font-family:"Segoe UI","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}\r
.card{--ink:#252525;--muted:#888;--paper:#fff;position:relative;isolation:isolate;flex:none;width:344px;height:480px;zoom:0.8720930233;background:var(--paper);color:var(--ink);overflow:hidden;box-shadow:0 5px 20px #0002}\r
.card .drag{position:absolute;z-index:10;inset:0 0 auto;height:30px;display:flex;align-items:center;justify-content:space-between;padding:3px 9px;cursor:grab;color:var(--muted);font-size:8px;letter-spacing:1px;user-select:none}\r
.drag>span{opacity:0}.drag i{font-style:normal}.drag button{opacity:0}.card:hover .drag button,.card:focus-within .drag button{opacity:1}\r
.card button{border:0;background:transparent;color:inherit;width:28px;height:28px;display:grid;place-items:center;padding:6px;border-radius:6px}.card button:hover{background:color-mix(in srgb,var(--ink) 12%,transparent)}.card svg{width:100%;height:100%}\r
.meta{position:absolute;display:flex;gap:10px;align-items:center}.track{min-width:0}.track h1{font-weight:700;margin:0 0 5px;font-size:19px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.artist{margin:0;color:var(--muted);font-size:11px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}\r
.art{position:relative;flex:none;width:52px;height:52px;display:grid;place-items:center;background:#ddd;overflow:hidden}.art>span{font-size:25px;color:#999}.art img{position:absolute;width:100%;height:100%;object-fit:cover}.art img[hidden]{display:none}.art:has(img:not([hidden]))>span{visibility:hidden}\r
.lyrics{position:absolute;overflow:hidden;display:flex;flex-direction:column;gap:17px}.lyric-row{flex:none;min-width:0}.lyric-text,.lyric-secondary{margin:0;overflow-wrap:anywhere}.lyric-text{font-size:15px;line-height:1.65;font-weight:400;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.lyric-secondary{font-size:11px;color:var(--muted);line-height:1.6;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\r
.decoration{pointer-events:none}.style-mark,.seal,.barcode,.edition,.sleeve-disc,.ticket-details,.receipt-total,.spine-artist{display:none;position:absolute}\r
.card .progress{position:absolute;z-index:6;left:22px;right:22px;bottom:40px;height:2px;background:color-mix(in srgb,var(--ink) 15%,transparent);opacity:0}.progress span{display:block;height:100%;width:0;background:var(--ink)}\r
.card footer{position:absolute;z-index:5;inset:auto 15px 5px;height:32px;display:flex;align-items:center;justify-content:space-between;padding:0 7px;border-radius:6px;background:var(--paper);opacity:0}.card:hover footer,.card:focus-within footer,.card:hover .progress,.card:focus-within .progress{opacity:1}.controls{display:flex;gap:8px}.card time{font-size:9px;color:var(--muted);font-variant-numeric:tabular-nums}.edition{display:block;bottom:17px;left:26px;font:9px Georgia,serif;color:var(--muted)}\r
.style-toolbar{position:absolute;z-index:11;top:0;right:0;width:100%;display:flex;align-items:center;gap:12px;padding:5px 10px;border-radius:9px;background:#242727;color:#ddd;font-size:11px}.style-toolbar select{flex:1;min-width:0;border:0;border-radius:5px;background:#343838;color:#fff;padding:3px 5px;cursor:pointer;color-scheme:dark}.style-count{color:#9da39d;font-size:10px}\r
.desktop-launch{flex:none;border:1px solid #ffffff25;border-radius:10px;background:#252927;color:#eee;padding:11px 18px;font-size:12px}.desktop-launch:hover{background:#383e39}.surface.desktop{gap:8px;overflow:hidden}.desktop .desktop-launch{display:none}.desktop .card{box-shadow:none}\r
\r
.artist-credit{display:contents}\r
\r
.card .progress{cursor:pointer;touch-action:none;user-select:none}.card .progress::after{content:'';position:absolute;left:0;right:0;top:-9px;bottom:-9px}.card .progress:focus-visible{opacity:1;outline:2px solid currentColor;outline-offset:4px}\r
\r
.header-actions{display:flex;align-items:center;gap:2px}.style-toolbar[hidden]{display:none}\r
\r
.card-shell{position:relative;flex:none;width:300px;padding-top:40px}
.desktop .settings-toggle,.desktop .style-toolbar{display:none}
.desktop .card-shell{padding-top:0}
`;

// src/seek.mjs
function createSeek(bar, post, signal) {
  let duration = 0, dragging = false, value = 0;
  function show(time) {
    value = Math.max(0, Math.min(duration, time));
    bar.firstElementChild.style.width = `${duration ? value / duration * 100 : 0}%`;
    bar.setAttribute("aria-valuenow", String(value));
  }
  function locate(event) {
    const rect = bar.getBoundingClientRect();
    show((event.clientX - rect.left) / rect.width * duration);
  }
  bar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !duration) return;
    event.preventDefault();
    dragging = true;
    bar.setPointerCapture(event.pointerId);
    locate(event);
  }, { signal });
  bar.addEventListener("pointermove", (event) => {
    if (dragging) locate(event);
  }, { signal });
  bar.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    locate(event);
    dragging = false;
    bar.releasePointerCapture(event.pointerId);
    post("seekTime", { time: value });
  }, { signal });
  bar.addEventListener("lostpointercapture", () => {
    dragging = false;
  }, { signal });
  bar.addEventListener("pointercancel", () => {
    dragging = false;
  }, { signal });
  bar.addEventListener("keydown", (event) => {
    if (!duration || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    show(event.key === "Home" ? 0 : event.key === "End" ? duration : value + (event.key === "ArrowLeft" ? -5 : 5));
    post("seekTime", { time: value });
  }, { signal });
  return { update(time, length) {
    duration = Math.max(0, Number(length) || 0);
    bar.setAttribute("aria-valuemax", String(duration));
    bar.setAttribute("aria-disabled", String(!duration));
    if (!dragging) show(time);
  } };
}

// src/titleScroll.mjs
function createTitleScroll(viewport, text2) {
  let animation, signature = "";
  return {
    update(style) {
      const distance = style === "ancient" ? Math.max(0, text2.offsetHeight - viewport.clientHeight) : 0;
      const next = JSON.stringify([style, text2.textContent, distance]);
      if (signature === next) return;
      signature = next;
      animation?.cancel();
      animation = null;
      if (!distance) return;
      animation = text2.animate([
        { transform: "translateY(0)", offset: 0 },
        { transform: "translateY(0)", offset: 0.15 },
        { transform: `translateY(-${distance}px)`, offset: 0.85 },
        { transform: `translateY(-${distance}px)`, offset: 1 }
      ], { duration: Math.max(6e3, distance * 65), iterations: Infinity, direction: "alternate", easing: "linear" });
    },
    destroy() {
      animation?.cancel();
    }
  };
}

// src/themes.css
var themes_default = '/* BetterLyrics templates: keep each composition rather than recoloring a shared player. */\r\n.card[data-style=minimal]{border:3px solid #111;box-shadow:none}\r\n.card[data-style=minimal] .lyrics{inset:22px 19px 122px;gap:22px}.card[data-style=minimal] .lyric-text{font-size:19px;line-height:1.55;font-weight:750}\r\n.card[data-style=minimal] .meta{inset:auto 19px 33px;height:67px;padding-top:15px;border-top:2px solid #111}.card[data-style=minimal] h1{font-size:16px}.card[data-style=minimal] .art{width:43px;height:43px}.card[data-style=minimal] .edition{left:auto;right:20px;bottom:16px;font-family:inherit;font-weight:700}\r\n/* Large cover, serif article typography and short editorial rule. */\r\n.card[data-style=magazine]{font-family:Georgia,"SimSun",serif}\r\n.card[data-style=magazine] .meta{display:contents}.card[data-style=magazine] .art{position:absolute;inset:0 0 auto;width:100%;height:190px}.card[data-style=magazine] .track{position:absolute;inset:207px 23px auto}.card[data-style=magazine] h1{font-size:23px}.card[data-style=magazine] .artist{font-style:italic}.card[data-style=magazine] .track::after{content:"";display:block;width:24px;border-top:3px solid #111;margin-top:11px}\r\n.card[data-style=magazine] .lyrics{inset:305px 23px 42px;gap:14px}.card[data-style=magazine] .lyric-text{font-size:12px;line-height:1.5}.card[data-style=magazine] .lyric-secondary{font-size:9px}.card[data-style=magazine] .edition{left:23px;bottom:16px}\r\n/* Admission ticket: inset cream stock, cover thumbnail, tear line and dated stub. */\r\n.card[data-style=ticket]{--paper:#fff8f0;--ink:#4b4540;--muted:#a09a94;background:transparent;box-shadow:none;border-radius:8px}\r\n.card[data-style=ticket]::before{content:"";position:absolute;inset:0;background:#fff8f0;border:1px solid #e6dfd8;border-radius:10px;z-index:-1}\r\n.card[data-style=ticket] .meta{inset:34px 32px auto;align-items:center}.card[data-style=ticket] .art{width:61px;height:61px;border-radius:3px}.card[data-style=ticket] h1{font:700 15px/1.3 Georgia,"SimSun",serif;margin-top:12px}.card[data-style=ticket] .artist{font-family:monospace;font-size:10px}\r\n.card[data-style=ticket] .style-mark{display:block;top:36px;left:103px;color:#ec5147;font:700 8px monospace}\r\n.card[data-style=ticket] .lyrics{inset:123px 34px 123px;gap:19px}.card[data-style=ticket] .lyric-text{font-family:Georgia,"SimSun",serif;font-size:15px}.card[data-style=ticket] .lyric-secondary{font-size:10px}\r\n.card[data-style=ticket] .ticket-details{display:block;inset:auto 34px 29px;height:66px;font:10px/1.4 monospace;color:#999}.ticket-details small{font-size:7px;color:#bbb}.card[data-style=ticket] .decoration::after{content:"";position:absolute;top:363px;left:16px;right:16px;border-top:1px dashed #d1c9bf}\r\n.card[data-style=ticket] .barcode{display:block;right:35px;bottom:36px;width:47px;height:14px;background:repeating-linear-gradient(90deg,#888 0 1px,transparent 1px 3px,#888 3px 5px,transparent 5px 7px)}.card[data-style=ticket] .edition{display:none}\r\n/* A plain handwritten note; no album thumbnail or ruled notebook lines. */\r\n.card[data-style=sticky]{--paper:#fff5a3;--ink:#2c3440;--muted:#777764;background:transparent;box-shadow:none;border-radius:8px;overflow:visible;font-family:KaiTi,STKaiti,cursive}\r\n.card[data-style=sticky]::before{content:"";position:absolute;inset:0;background:#fff5a3;border:1px solid #e8dfa0;border-radius:1px 1px 19px 1px;z-index:-1}\r\n.card[data-style=sticky]::after{content:"";position:absolute;top:-12px;left:132px;width:80px;height:23px;background:#dededebf;transform:rotate(-2deg)}\r\n.card[data-style=sticky] .art{display:none}.card[data-style=sticky] .meta{inset:75px 25px auto}.card[data-style=sticky] h1{font-size:23px;font-weight:700}.card[data-style=sticky] .artist{font-family:inherit;font-size:14px;margin-top:13px}.card[data-style=sticky] .lyrics{inset:173px 25px 90px;gap:22px}.card[data-style=sticky] .lyric-text{font-size:18px;line-height:1.5}.card[data-style=sticky] .edition{left:auto;right:25px;bottom:60px;font:italic 9px KaiTi,serif}\r\n/* Bordered vertical book leaf with four lyric columns and author on the right. */\r\n.card[data-style=ancient]{--paper:#efe8d8;--ink:#3a342b;--muted:#82796a;font-family:"SimSun","Songti SC",serif}\r\n.card[data-style=ancient]::before{content:"";position:absolute;inset:16px;border:4px double #625648;pointer-events:none}\r\n.card[data-style=ancient] .art{display:none}.card[data-style=ancient] .meta{inset:22px 22px 22px auto;width:76px;display:block;border-left:1px solid #b6a68c70}.card[data-style=ancient] .track{position:relative;height:100%}.card[data-style=ancient] h1{position:absolute;top:20px;left:39px;writing-mode:vertical-rl;text-orientation:upright;font-family:inherit;font-size:24px;line-height:1.2;letter-spacing:5px;bottom:0;height:auto;max-height:none;display:block;white-space:nowrap;overflow:hidden;margin:0}.card[data-style=ancient] .artist-credit{position:absolute;bottom:25px;left:10px;display:flex;flex-direction:column;align-items:flex-start;gap:9px}.card[data-style=ancient] .artist-credit::before{content:"\u64B0";background:#9c2b20;color:#efe8d8;font:10px "SimSun",serif;padding:4px}.card[data-style=ancient] .artist{position:static;writing-mode:vertical-rl;text-orientation:upright;font-family:inherit;font-size:13px;line-height:1.5;letter-spacing:3px;max-height:none;white-space:nowrap;overflow:visible;overflow-wrap:normal;flex-shrink:0}\r\n.card[data-style=ancient] .lyrics{inset:22px 98px 22px 57px;display:flex;flex-direction:row-reverse;gap:0}.card[data-style=ancient] .lyric-row{flex:1;min-width:0;border-left:1px solid #b6a68c70;writing-mode:vertical-rl;text-orientation:upright;padding:19px 10px}.card[data-style=ancient] .lyric-text{display:block;font-size:16px;line-height:1.6;letter-spacing:4px;max-height:100%;overflow:hidden}.card[data-style=ancient] .lyric-secondary{display:none}\r\n.card[data-style=ancient] .style-mark{display:block;inset:22px auto 22px 22px;width:35px;writing-mode:vertical-rl;text-orientation:upright;border-right:1px solid #817561;padding:19px 11px;font-size:9px;letter-spacing:3px}.card[data-style=ancient] .seal{display:none}.card[data-style=ancient] .edition{left:34px;bottom:35px;writing-mode:vertical-rl;font:10px "SimSun",serif;color:#796b59;letter-spacing:5px}\r\n/* Album sleeve in front of a half exposed record. */\r\n.card[data-style=vinyl]{--paper:#12132e;--ink:#e0e0ec;--muted:#87879f}\r\n.card[data-style=vinyl] .meta{display:contents}.card[data-style=vinyl] .art{position:absolute;top:36px;left:46px;width:161px;height:161px;z-index:2;box-shadow:4px 2px 9px #0004}.card[data-style=vinyl] .sleeve-disc{display:block;left:125px;top:40px;width:156px;height:156px;border-radius:50%;background:repeating-radial-gradient(circle,#080809 0 3px,#151519 4px,#080809 5px)}.card[data-style=vinyl] .sleeve-disc::after{content:"";position:absolute;inset:52px;border-radius:50%;background:var(--cover) center/cover;border:2px solid #121212}\r\n.card[data-style=vinyl] .track{position:absolute;left:39px;right:33px;bottom:34px}.card[data-style=vinyl] h1{font-size:11px;margin:0}.card[data-style=vinyl] .artist{font-size:9px}.card[data-style=vinyl] .lyrics{inset:232px 30px 98px;text-align:center;gap:17px}.card[data-style=vinyl] .lyric-text{font-size:14px}.card[data-style=vinyl] .edition{left:auto;right:30px;bottom:44px;font:8px sans-serif}.card[data-style=vinyl] .progress{bottom:74px;left:29px;right:29px;opacity:1}\r\n/* CD jewel case: narrow cover strip and obi, with lyrics in the right panel. */\r\n.card[data-style=cd]{--paper:#fff;--ink:#222;--muted:#999;background:transparent;box-shadow:none;border-radius:8px}\r\n.card[data-style=cd]::before{content:"";position:absolute;inset:0;background:#fff;border:1px solid #d1d1d6;border-radius:3px;z-index:-1}.card[data-style=cd] .meta{display:contents}.card[data-style=cd] .art{position:absolute;left:1px;top:1px;bottom:1px;width:121px;height:auto;background:#e5e5e5}.card[data-style=cd] .art img{opacity:.55}.card[data-style=cd] .art::after{content:"\u9650\u5B9A\u76E4";position:absolute;inset:0 auto 0 0;width:27px;padding:11px 0;background:#c00;color:white;font:8px monospace;text-align:center}.card[data-style=cd] .spine-artist{display:block;left:9px;top:125px;bottom:80px;writing-mode:vertical-rl;transform:rotate(180deg);width:14px;font:700 12px sans-serif;color:#fff;overflow:hidden;white-space:nowrap;z-index:3}\r\n.card[data-style=cd] .track{position:absolute;top:42px;left:141px;right:30px;padding-bottom:12px;border-bottom:1px solid #eee}.card[data-style=cd] h1{font-size:18px}.card[data-style=cd] .artist{font-size:10px}.card[data-style=cd] .lyrics{inset:129px 29px 68px 141px;gap:20px}.card[data-style=cd] .lyric-text{font-size:12px;line-height:1.55}.card[data-style=cd] .lyric-secondary{font-size:9px}.card[data-style=cd] .edition{left:140px;bottom:36px;font:7px sans-serif}.card[data-style=cd] footer{left:128px;right:17px}.card[data-style=cd] .elapsed,.card[data-style=cd] .duration{display:none}\r\n/* Photograph with a white border and centered captions. */\r\n.card[data-style=polaroid]{--paper:#fff;--ink:#333;--muted:#aaa}\r\n.card[data-style=polaroid] .meta{display:contents}.card[data-style=polaroid] .art{position:absolute;inset:16px 16px auto;width:312px;height:267px}.card[data-style=polaroid] .track{position:absolute;left:22px;right:22px;bottom:19px}.card[data-style=polaroid] h1{font:11px KaiTi,serif;color:#999;display:inline}.card[data-style=polaroid] .artist{font:9px KaiTi,serif;display:inline;margin-left:8px}.card[data-style=polaroid] .lyrics{inset:298px 23px 62px;text-align:center;gap:20px}.card[data-style=polaroid] .lyric-text{font-size:14px;font-weight:600}.card[data-style=polaroid] .lyric-secondary{font-family:KaiTi,serif;font-style:italic}.card[data-style=polaroid] .edition{display:none}\r\n/* Receipt typography, tiny cover, item information, total and barcode. */\r\n.card[data-style=receipt]{--paper:#fffdf8;--ink:#333;--muted:#aaa;font-family:"Courier New",monospace}\r\n.card[data-style=receipt] .meta{display:contents}.card[data-style=receipt] .art{position:absolute;top:24px;left:150px;width:44px;height:44px}.card[data-style=receipt] .style-mark{display:block;top:85px;left:20px;right:20px;text-align:center;font-size:13px;font-weight:700;letter-spacing:1px}.card[data-style=receipt] .edition{top:106px;bottom:auto;left:20px;right:20px;text-align:center;font:8px monospace;letter-spacing:2px}\r\n.card[data-style=receipt] .ticket-details{display:block;top:128px;left:24px;right:24px;height:28px;border-top:1px dashed #aaa;border-bottom:1px dashed #aaa;padding-top:6px;font:7px monospace;text-align:center;overflow:hidden}.card[data-style=receipt] .ticket-details br,.card[data-style=receipt] .ticket-location{display:none}.card[data-style=receipt] .ticket-details small{margin-right:8px}.card[data-style=receipt] .track{position:absolute;left:26px;right:26px;top:186px}.card[data-style=receipt] h1{font-size:16px}.card[data-style=receipt] .artist{font-size:9px}.card[data-style=receipt] .lyrics{inset:241px 26px 116px;gap:13px}.card[data-style=receipt] .lyric-text{font-size:11px;line-height:1.5}.card[data-style=receipt] .lyric-secondary{font-size:8px}\r\n.card[data-style=receipt] .receipt-total{display:block;bottom:87px;left:26px;right:26px;border-top:2px dotted #bbb;padding-top:14px;text-align:right;font-size:11px;font-weight:700}.card[data-style=receipt] .barcode{display:block;bottom:36px;left:64px;width:216px;height:24px;background:repeating-linear-gradient(90deg,#333 0 1px,transparent 1px 4px,#333 4px 6px,transparent 6px 9px)}\r\n/* Original Swiss treatment: heavy black frame, pale number and pastel lyric panel. */\r\n.card[data-style=swiss]{--paper:#f0f0f0;--ink:#080808;--muted:#666;border:3px solid #111;box-shadow:none}\r\n.card[data-style=swiss]::before{content:"";position:absolute;inset:99px 3px 62px;background:linear-gradient(#f4e3e0,#d2d2d2);border-top:3px solid #111;z-index:-1}.card[data-style=swiss]::after{content:"";position:absolute;inset:auto 3px 3px;height:60px;background:#080808;z-index:-1}\r\n.card[data-style=swiss] .meta{display:contents}.card[data-style=swiss] .track{position:absolute;top:17px;left:18px;right:55px}.card[data-style=swiss] h1{font-size:26px;line-height:1.1;font-weight:900}.card[data-style=swiss] .artist{font-size:14px;color:#111;font-weight:700}.card[data-style=swiss] .style-mark{display:block;right:10px;top:5px;color:#e2e2e2;font-size:63px;line-height:1;font-weight:800;z-index:-1}\r\n.card[data-style=swiss] .lyrics{inset:124px 18px 76px;gap:23px}.card[data-style=swiss] .lyric-text{font-size:18px;line-height:1.45;font-weight:800}.card[data-style=swiss] .art{position:absolute;left:18px;bottom:19px;width:30px;height:30px;border-radius:50%}.card[data-style=swiss] .edition{left:60px;bottom:27px;color:#fff;font:700 10px sans-serif}.card[data-style=swiss] footer{--paper:#080808;--ink:#fff;color:white}\r\n/* Film frame retains a wide image and yellow subtitles. */\r\n.card[data-style=cinematic]{--paper:#000;--ink:#ffcb4c;--muted:#eee}\r\n.card[data-style=cinematic]::before{content:"";position:absolute;inset:43px 0 82px;background:linear-gradient(0deg,#000c,transparent 70%),var(--cover) center/cover;z-index:-1}.card[data-style=cinematic] .art{display:none}.card[data-style=cinematic] .meta{inset:auto 22px 28px;text-align:center;justify-content:center}.card[data-style=cinematic] h1{font-size:13px;color:#fff}.card[data-style=cinematic] .artist{font-size:9px}.card[data-style=cinematic] .lyrics{inset:auto 22px 111px;height:124px;justify-content:end;text-align:center;gap:16px;text-shadow:1px 1px 2px #000}.card[data-style=cinematic] .lyric-text{font-size:18px;font-weight:700}.card[data-style=cinematic] .edition{display:none}\r\n/* Ink wash: quiet paper, circular faded cover and a red seal. */\r\n.card[data-style=ink]{--paper:#f5f4f0;--ink:#333;--muted:#888;font-family:KaiTi,STKaiti,serif}\r\n.card[data-style=ink]::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 0 30%,#57625e20,transparent 60%);z-index:-1}.card[data-style=ink] .meta{inset:36px 35px auto;flex-direction:column;text-align:center;gap:14px}.card[data-style=ink] .art{width:108px;height:108px;border-radius:50%;filter:grayscale(1);mask-image:radial-gradient(circle,#000 40%,transparent 72%)}.card[data-style=ink] h1{font-size:23px;letter-spacing:3px}.card[data-style=ink] .lyrics{inset:234px 35px 65px;text-align:center;gap:18px}.card[data-style=ink] .lyric-text{font-size:18px}.card[data-style=ink] .seal{display:block;right:34px;top:43px;background:#a01c1c;color:#f5f4f0;padding:7px 5px;font-size:14px}.card[data-style=ink] .edition{left:0;right:0;bottom:23px;text-align:center;font:10px KaiTi,serif;letter-spacing:3px}\r\n.card[data-style=guofeng]{--paper:#f1f0eb;--ink:#292a28;--muted:#72716b;font-family:KaiTi,STKaiti,"\u6977\u4F53",serif;box-shadow:none}\r\n.card[data-style=guofeng]::before{content:"";position:absolute;inset:20px auto 20px 38px;border-left:1px solid #88877720;pointer-events:none}\r\n.card[data-style=guofeng] .meta{display:contents}.card[data-style=guofeng] .art{position:absolute;inset:0;width:100%;height:100%;border-radius:0;background:transparent;opacity:.09;filter:grayscale(.65);z-index:-1;pointer-events:none}.card[data-style=guofeng] .art>span{display:none}.card[data-style=guofeng] .art img{object-fit:cover}\r\n.card[data-style=guofeng] .track{position:absolute;inset:27px 30px auto 74px}.card[data-style=guofeng] h1{font-family:inherit;font-size:24px;letter-spacing:4px;line-height:1.45}.card[data-style=guofeng] .artist{font-family:inherit;font-size:11px;letter-spacing:2px;color:var(--muted)}\r\n.card[data-style=guofeng] .lyrics{inset:111px 30px 65px 74px;text-align:left;gap:20px}.card[data-style=guofeng] .lyric-text{font-family:inherit;font-size:15px;font-weight:600;line-height:1.8;letter-spacing:1px}.card[data-style=guofeng] .lyric-secondary{font-family:inherit;font-size:11px;line-height:1.6}\r\n.card[data-style=guofeng] .seal{display:block;left:27px;right:auto;top:52px;width:22px;padding:9px 5px;background:#a22625;color:#f5f1e8;writing-mode:vertical-rl;text-orientation:upright;font:10px KaiTi,STKaiti,serif;letter-spacing:3px}.card[data-style=guofeng] .edition{left:auto;right:26px;bottom:26px;text-align:right;font:8px KaiTi,STKaiti,serif;letter-spacing:2px}.card[data-style=guofeng] .edition::after{content:"";display:inline-block;width:3px;height:3px;margin-left:5px;background:#a22625;vertical-align:middle}\r\n\r\n\r\n/* Keep hover controls on the paper after removing the outer mat. */\r\n.card[data-style=sticky] .drag{inset:0 0 auto}.card[data-style=sticky] footer{left:1px;right:1px;bottom:5px}.card[data-style=sticky] .progress{left:11px;right:11px;bottom:40px}\r\n.card[data-style=ticket] .drag{inset:0 0 auto}.card[data-style=ticket] footer{left:1px;right:1px;bottom:5px}.card[data-style=ticket] .progress{bottom:40px;left:25px;right:25px}\r\n.card[data-style=cd] .drag{inset:0 0 auto}\r\n\r\n/* Loose-leaf journal: warm paper, punched margin, red rule and handwritten lines. */\r\n.card[data-style=journal]{--paper:#f3ebd8;--ink:#52606a;--muted:#90988f;border:1px solid #e5d9bf;border-radius:3px;font-family:KaiTi,STKaiti,cursive}\r\n.card[data-style=journal]::before{content:"";position:absolute;inset:0 auto 0 40px;border-left:2px solid #ddada566;pointer-events:none}\r\n.card[data-style=journal]::after{content:"";position:absolute;left:7px;top:48px;bottom:42px;width:27px;background:radial-gradient(circle at 13px 18px,#f5f5f5 0 6px,#dcd5c6 6px 7px,transparent 7.5px);background-size:27px 40px;pointer-events:none}\r\n.card[data-style=journal] .art{display:none}.card[data-style=journal] .meta{inset:37px 26px auto 60px}.card[data-style=journal] h1{font-family:inherit;font-size:22px;line-height:1.35;letter-spacing:1px}.card[data-style=journal] .artist{font:12px/1.5 KaiTi,STKaiti,serif;margin-top:12px}\r\n.card[data-style=journal] .lyrics{inset:130px 26px 61px 60px;gap:0}.card[data-style=journal] .lyric-row{padding:8px 0 6px;border-bottom:1px solid #ddd2b855;min-height:35px}.card[data-style=journal] .lyric-text{font:14px/1.6 KaiTi,STKaiti,serif;letter-spacing:.6px}.card[data-style=journal] .lyric-secondary{font:10px/1.5 KaiTi,STKaiti,serif}\r\n.card[data-style=journal] .edition{left:auto;right:26px;bottom:34px;font:italic 8px KaiTi,serif}.card[data-style=journal] .progress{left:53px;right:15px}.card[data-style=journal] footer{left:46px;right:8px}\r\n\r\n.card[data-style=ancient] .title-text{display:block;white-space:nowrap;writing-mode:vertical-rl;text-orientation:upright;width:29px;height:max-content}\r\n\r\n\r\n\r\n.card[data-style=ancient] .lyric-text{height:100%;white-space:nowrap;overflow-wrap:normal}.card[data-style=ancient] .vertical-lyric-text{display:block;height:max-content;white-space:nowrap}\r\n';

// src/cardStyles.mjs
var cardStyles = [
  { id: "minimal", name: "\u6781\u7B80", mark: "NOW PLAYING" },
  { id: "cinematic", name: "\u7535\u5F71", mark: "NOW SHOWING" },
  { id: "magazine", name: "\u6742\u5FD7", mark: "LYRICS" },
  { id: "ticket", name: "\u7968\u6839", mark: "ADMIT ONE" },
  { id: "journal", name: "\u624B\u8D26", mark: "\u65F6\u5149\u5370\u8BB0" },
  { id: "sticky", name: "\u4FBF\u7B7E", mark: "a note to myself" },
  { id: "ink", name: "\u6C34\u58A8", mark: "\u66F2\u62E8\u5FC3\u5F26 \xB7 \u8BCD\u843D\u4E91\u7B3A", edition: "\u66F2\u62E8\u5FC3\u5F26\u3000\u8BCD\u843D\u4E91\u7B3A" },
  { id: "guofeng", name: "\u56FD\u98CE", mark: "\u66F2\u62E8\u5FC3\u5F26 \xB7 \u8BCD\u843D\u4E91\u7B3A", edition: "\u66F2\u62E8\u5FC3\u5F26\u3000\u8BCD\u843D\u4E91\u7B3A" },
  { id: "ancient", name: "\u53E4\u7C4D", mark: "\u66F2\u62E8\u5FC3\u5F26\u3000\u8BCD\u843D\u4E91\u7B3A", edition: "\u5377\u4E00" },
  { id: "vinyl", name: "\u9ED1\u80F6", mark: "SIDE A \xB7 33\u2153 RPM" },
  { id: "cd", name: "CD", mark: "COMPACT DISC \xB7 DIGITAL AUDIO" },
  { id: "polaroid", name: "\u62CD\u7ACB\u5F97", mark: "a moment in music" },
  { id: "receipt", name: "\u6536\u636E", mark: "OFFICIAL RECEIPT", edition: "MONO MUSIC STORE" },
  { id: "swiss", name: "\u745E\u58EB\u6392\u7248", mark: "01", edition: "NOW PLAYING" }
];
function cardStyle(value) {
  return cardStyles.find((style) => style.id === value) || cardStyles[0];
}
function createStyleSelection() {
  let selected = "minimal", pending = null;
  return {
    choose(value) {
      selected = cardStyle(value).id;
      pending = selected;
      return selected;
    },
    receive(value) {
      const incoming = cardStyle(value).id;
      if (incoming === pending) pending = null;
      if (pending === null) selected = incoming;
      return selected;
    }
  };
}

// src/page.mjs
var icons = {
  previous: '<path d="M6 5v14M18 5 8 12l10 7Z"/>',
  next: '<path d="M18 5v14M6 5l10 7-10 7Z"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>'
};
var icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[name]}</svg>`;
function createPage(root2, css) {
  root2.innerHTML = `<style>${css}</style><main class="surface"><div class="card-shell"><div id="card-settings" class="style-toolbar" role="region" aria-label="\u5361\u7247\u8BBE\u7F6E" hidden><label for="card-style">\u5361\u7247\u6837\u5F0F</label><select id="card-style" aria-label="\u5361\u7247\u6837\u5F0F">${cardStyles.map((style) => `<option value="${style.id}">${style.name}</option>`).join("")}</select><span class="style-count">${cardStyles.length} \u6B3E</span></div><section class="card" aria-label="\u64AD\u653E\u5361\u7247">
    <header class="drag"><span>MONO <i>NOW PLAYING</i></span><div class="header-actions"><button class="settings-toggle" aria-label="\u5361\u7247\u8BBE\u7F6E" aria-expanded="false" aria-controls="card-settings">${icon("settings")}</button><button data-action="close" aria-label="\u5173\u95ED\u5361\u7247">${icon("close")}</button></div></header>
    <div class="decoration" aria-hidden="true"><span class="style-mark">NOW PLAYING</span><span class="seal">\u64B0</span><span class="barcode"></span><span class="edition">Mono \xB7 ISSUE 01</span><span class="sleeve-disc"></span><span class="spine-artist"></span><div class="ticket-details"><small>DATE</small><br><span class="card-date"></span><div class="ticket-location"><small>LOCATION</small><br>Mono</div></div><span class="receipt-total">TOTAL: PRICELESS</span></div>
    <div class="meta"><div class="art"><span aria-hidden="true">\u266B</span><img alt="\u4E13\u8F91\u5C01\u9762" hidden></div><div class="track"><h1><span class="title-text">\u7B49\u5F85\u64AD\u653E</span></h1><div class="artist-credit"><p class="artist">\u9009\u62E9\u4E00\u9996\u559C\u6B22\u7684\u6B4C</p></div></div></div>
    <div class="lyrics" aria-live="off"></div>
    <div class="progress" role="slider" tabindex="0" aria-label="\u64AD\u653E\u8FDB\u5EA6" aria-valuemin="0" aria-valuemax="100"><span></span></div>
    <footer><time class="elapsed">0:00</time><div class="controls"><button data-action="playPrevious" aria-label="\u4E0A\u4E00\u9996">${icon("previous")}</button><button class="play" data-action="togglePlayback" aria-label="\u64AD\u653E">${icon("play")}</button><button data-action="playNext" aria-label="\u4E0B\u4E00\u9996">${icon("next")}</button></div><time class="duration">0:00</time></footer>

  </section></div><button class="desktop-launch" data-action="openDesktopCard">\u653E\u5230\u684C\u9762\u53F3\u4E0B\u89D2 \u2197</button></main>`;
  return (selector) => root2.querySelector(selector);
}

// src/lyrics.mjs
function clock(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
function cardLines(lines2, time, count = 4) {
  const groups = [];
  for (const line of lines2) {
    const previous = groups.at(-1);
    if (Number.isFinite(line.time) && previous?.time === line.time) previous.secondary.push(line.text);
    else groups.push({ time: line.time, text: line.text, secondary: [] });
  }
  let active = -1;
  groups.forEach((line, index) => {
    if (Number.isFinite(line.time) && line.time <= time) active = index;
  });
  const start = Math.max(0, Math.min(active, groups.length - count));
  return groups.slice(start, start + count).map((line, index) => ({
    text: line.text,
    secondary: line.secondary.join(" \xB7 "),
    active: start + index === active
  }));
}

// src/lyricPanel.mjs
function createLyricPanel(container) {
  let signature = "";
  return (lines2, time, style, fallback) => {
    let count = style === "journal" ? 7 : ["cinematic", "polaroid", "vinyl", "receipt"].includes(style) ? 2 : style === "cd" ? 3 : 4;
    let rows = cardLines(lines2, time, count);
    if (!rows.length) rows.push({ text: fallback, secondary: "", active: false });
    const next = JSON.stringify([style, rows]);
    if (signature === next) return;
    signature = next;
    function render() {
      container.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
      container.replaceChildren(...rows.map((row) => {
        const item = document.createElement("div");
        item.className = "lyric-row";
        item.dataset.active = String(row.active);
        const main = document.createElement("p");
        main.className = "lyric-text";
        if (style === "ancient") {
          const text2 = document.createElement("span");
          text2.className = "vertical-lyric-text";
          text2.textContent = row.text;
          main.append(text2);
        } else main.textContent = row.text;
        main.title = row.text;
        item.append(main);
        if (row.secondary) {
          const secondary = document.createElement("p");
          secondary.className = "lyric-secondary";
          secondary.textContent = row.secondary;
          secondary.title = row.secondary;
          item.append(secondary);
        }
        return item;
      }));
    }
    render();
    while (rows.length > 1 && (container.scrollHeight > container.clientHeight + 1 || container.scrollWidth > container.clientWidth + 1)) {
      count -= 1;
      rows = cardLines(lines2, time, count);
      render();
    }
    if (style === "ancient") container.querySelectorAll(".lyric-text").forEach((main) => createTitleScroll(main, main.firstElementChild).update(style));
  };
}

// src/renderer.mjs
var root;
var get;
var api;
var controller;
var track = null;
var key = "";
var lines = [];
var playback = {};
var offset = 0;
var previousPlaying;
var config = {};
var selection = createStyleSelection();
var paintLyrics;
var titleScroll;
var seek;
function applyStyle(id) {
  const style = cardStyle(id);
  get(".card").dataset.style = style.id;
  get("#card-style").value = style.id;
  text(".style-mark", style.mark);
  text(".edition", style.edition || "Mono \xB7 ISSUE 01");
  if (paintLyrics) paint();
}
function text(selector, value) {
  const node = get(selector);
  if (node.textContent !== value) node.textContent = value;
}
function paint() {
  const time = Number(playback.currentTime) || 0;
  text(".title-text", track?.title || "\u7B49\u5F85\u64AD\u653E");
  titleScroll?.update(get(".card").dataset.style);
  text(".artist", Array.isArray(track?.artist) ? track.artist.join(" / ") : track?.artist || "Mono Player");
  paintLyrics(lines, time + offset, get(".card").dataset.style, track ? "\u7EAF\u97F3\u4E50\uFF0C\u6216\u6682\u65E0\u540C\u6B65\u6B4C\u8BCD" : "\u8BA9\u97F3\u4E50\u966A\u5728\u8EAB\u8FB9");
  text(".spine-artist", get(".artist").textContent);
  const source = track?.artworkDataUrl || track?.artwork || "";
  const image = get("img");
  if (image.getAttribute("src") !== source) {
    image.hidden = !source;
    if (source) image.src = source;
    else image.removeAttribute("src");
    get(".card").style.setProperty("--cover", source ? `url(${JSON.stringify(source)})` : "none");
  }
  const playing = !!playback.isPlaying;
  if (previousPlaying !== playing) {
    get(".play").innerHTML = icon(playing ? "pause" : "play");
    get(".play").setAttribute("aria-label", playing ? "\u6682\u505C" : "\u64AD\u653E");
    previousPlaying = playing;
  }
  text(".elapsed", clock(time));
  text(".duration", clock(track?.duration));
  seek?.update(time, track?.duration);
}
var renderer_default = {
  mount(element, bridge) {
    this.destroy();
    root = element;
    api = bridge;
    get = createPage(root, styles_default + themes_default);
    controller = new AbortController();
    seek = createSeek(get(".progress"), (...args) => api.post(...args), controller.signal);
    titleScroll = createTitleScroll(get("h1"), get(".title-text"));
    paintLyrics = createLyricPanel(get(".lyrics"));
    text(".card-date", (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE").replaceAll("-", "."));
    const options = { signal: controller.signal };
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (button) api.post(button.dataset.action, button.dataset.action === "openDesktopCard" ? { config } : void 0);
    }, options);
    const settingsButton = get(".settings-toggle");
    const settingsPanel = get("#card-settings");
    function setSettingsOpen(open) {
      settingsPanel.hidden = !open;
      settingsButton.setAttribute("aria-expanded", String(open));
    }
    settingsButton.addEventListener("click", () => {
      setSettingsOpen(settingsPanel.hidden);
      if (!settingsPanel.hidden) get("#card-style").focus();
    }, options);
    root.ownerDocument.addEventListener("pointerdown", (event) => {
      if (!settingsPanel.contains(event.target) && !settingsButton.contains(event.target)) setSettingsOpen(false);
    }, options);
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !settingsPanel.hidden) {
        setSettingsOpen(false);
        settingsButton.focus();
        event.stopPropagation();
      }
    }, options);
    get("#card-style").addEventListener("change", (event) => {
      config = { ...config, cardStyle: selection.choose(event.target.value) };
      applyStyle(config.cardStyle);
      api.post("updateConfig", { config });
    }, options);
    get(".drag").addEventListener("pointerdown", (event) => {
      if (event.button === 0 && !event.target.closest("button") && get(".surface").classList.contains("desktop")) api.post("dragWindow");
    }, options);
    get("img").addEventListener("error", () => {
      get("img").hidden = true;
    }, options);
    applyStyle("minimal");
    paint();
  },
  update(message) {
    if (!get) return;
    if (message.type === "track") {
      if (key !== message.trackKey) {
        lines = [];
        playback = {};
      }
      key = message.trackKey;
      track = message.activeTrack;
    } else if (message.type === "lyrics" && message.trackKey === key) lines = message.lines || [];
    else if (message.type === "playback") playback = message.playback || {};
    else if (message.type === "lyrics-ui") offset = Number(message.lyricsUi?.lyricTimeOffset) || 0;
    else if (message.type === "config") {
      config = { ...message.config, cardStyle: selection.receive(message.config?.cardStyle) };
      get(".surface").classList.toggle("desktop", config.desktop === true);
      applyStyle(config.cardStyle);
    }
    paint();
  },
  destroy() {
    titleScroll?.destroy();
    titleScroll = null;
    seek = null;
    controller?.abort();
    if (root) root.replaceChildren();
    root = get = api = controller = null;
    paintLyrics = null;
    track = null;
    key = "";
    lines = [];
    playback = {};
    offset = 0;
    previousPlaying = void 0;
    config = {};
    selection = createStyleSelection();
  }
};
export {
  renderer_default as default
};
