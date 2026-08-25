const MAIN_SLIDERS = [
  ['intensity', '律动强度', 0.2, 1.6, 0.01],
  ['depth', '立体感', 0.2, 1.8, 0.01],
  ['coverResolution', '封面清晰度', 0.75, 1.55, 0.01],
  ['cinemaShake', '镜头晃动', 0, 1.8, 0.01],
  ['lyricGlowStrength', '歌词溢光', 0, 0.85, 0.01],
];

const LYRIC_SLIDERS = [
  ['lyricScale', '歌词大小', 0.35, 1.65, 0.01],
  ['lyricOffsetX', '水平位置', -2, 2, 0.01],
  ['lyricOffsetY', '垂直位置', -1.2, 1.35, 0.01],
  ['lyricOffsetZ', '景深位置', -1.6, 1.6, 0.01],
  ['lyricTiltX', '上下角度', -42, 42, 1],
  ['lyricTiltY', '左右角度', -42, 42, 1],
  ['lyricLetterSpacing', '字间距', -0.04, 0.18, 0.005],
  ['lyricLineHeight', '行距', 0.86, 1.35, 0.01],
  ['lyricWeight', '字重', 500, 900, 50],
];

const ADVANCED_SLIDERS = [
  ['point', '粒子尺寸', 0.5, 2.2, 0.01],
  ['speed', '流速', 0.2, 2.5, 0.01],
  ['twist', '扭曲', 0, 0.6, 0.01],
  ['color', '色彩张力', 0.5, 2, 0.01],
  ['bloomStrength', '粒子溢光', 0, 1.6, 0.01],
  ['scatter', '离散感', 0, 0.5, 0.01],
  ['bgFade', '背景压缩', 0, 1.2, 0.01],
  ['backgroundOpacity', '背景透明度', 0, 1, 0.01],
  ['controlGlassChromaticOffset', '玻璃色差', 0, 140, 1],
];

const TOGGLES = [
  ['floatLayer', '浮空粒子层'], ['cinema', '电影镜头'], ['particleLyrics', '舞台歌词'],
  ['lyricGlow', '歌词溢光'], ['lyricGlowBeat', '鼓点溢光'],
  ['lyricGlowParticles', '歌词光粒'], ['lyricCameraLock', '歌词镜头绑定'],
  ['bloom', '粒子溢光'], ['edge', '轮廓高亮'], ['aiDepth', '封面深度'],
];

const FONTS = [
  ['sans', '默认'], ['hei', '黑体'], ['song', '宋体'], ['bold-song', '粗宋'],
  ['stone-song', '石印宋'], ['kai-song', '楷宋'], ['serif-en', 'Serif'],
  ['gothic', 'Gothic'], ['editorial', 'Editorial'], ['humanist', 'Humanist'],
  ['mono', '等宽'], ['display', '标题'],
];

function heading(text) {
  const node = document.createElement('div');
  node.className = 'fx-section-label';
  node.textContent = text;
  return node;
}

function slider(engine, fx, [key, label, min, max, step], beginEdit, endEdit) {
  const row = document.createElement('div');
  row.className = 'fx-slider';
  const value = Number(fx[key] ?? min);
  row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output>${step >= 1 ? Math.round(value) : value.toFixed(step < 0.01 ? 3 : 2)}</output>`;
  const input = row.querySelector('input');
  input.addEventListener('pointerdown', (event) => event.stopPropagation());
  input.addEventListener('input', () => {
    beginEdit();
    const next = Number(input.value);
    row.querySelector('output').textContent = step >= 1 ? String(Math.round(next)) : next.toFixed(step < 0.01 ? 3 : 2);
    engine.setFxValue(key, next);
  });
  input.addEventListener('change', endEdit);
  return row;
}

function colorRow(label, value, onChange, actions = []) {
  const row = document.createElement('div');
  row.className = 'lyric-color-row';
  const picker = document.createElement('input');
  picker.className = 'lyric-color-picker';
  picker.type = 'color';
  picker.value = /^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#ffffff';
  picker.title = label;
  picker.addEventListener('input', () => onChange(picker.value));
  const copy = document.createElement('div');
  copy.className = 'fx-color-row-label';
  copy.innerHTML = `${label}<small>${picker.value.toUpperCase()}</small>`;
  row.append(picker, copy);
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `fx-mini-btn ghost${action.active ? ' active' : ''}`;
    button.textContent = action.label;
    button.addEventListener('click', action.run);
    row.append(button);
  }
  return row;
}

function segmented(items, selected, onSelect) {
  const row = document.createElement('div');
  row.className = 'fx-seg';
  for (const [value, label] of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = selected === value ? 'active' : '';
    button.textContent = label;
    button.addEventListener('click', () => onSelect(value));
    row.append(button);
  }
  return row;
}

export function createFxPanel(getEngine, close) {
  const panel = document.createElement('aside');
  panel.id = 'fx-panel';
  let sliderDragging = false;
  let renderPending = false;

  function beginSliderDrag() {
    sliderDragging = true;
  }

  function finishSliderDrag() {
    if (!sliderDragging) return;
    sliderDragging = false;
    if (!renderPending) return;
    renderPending = false;
    requestAnimationFrame(() => render());
  }

  panel.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'range') beginSliderDrag();
  }, true);
  panel.addEventListener('pointerup', finishSliderDrag, true);
  panel.addEventListener('pointercancel', finishSliderDrag, true);

  function render() {
    if (sliderDragging) {
      renderPending = true;
      return;
    }
    const engine = getEngine();
    if (!engine) return;
    const state = engine.getState();
    const fx = state.fx;
    panel.replaceChildren();
    panel.innerHTML = '<div class="fx-head"><div><div class="fx-title">视觉控制台</div><div class="fx-sub">MINERADIO VISUALS</div></div><button type="button" class="fx-close" aria-label="关闭">×</button></div>';
    panel.querySelector('.fx-close').addEventListener('click', close);

    panel.append(heading('视觉预设'));
    const presets = document.createElement('div');
    presets.className = 'preset-grid';
    presets.id = 'preset-grid';
    for (const presetIndex of state.presetDisplayOrder) {
      const meta = state.presetMeta[presetIndex];
      if (!meta) continue;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `preset-card${fx.preset === presetIndex ? ' active' : ''}`;
      card.dataset.preset = String(presetIndex);
      card.innerHTML = `<span class="pc-icon">${state.presetIcons[presetIndex] || ''}</span><span class="pc-name">${meta.name}</span><span class="pc-desc">${meta.descHtml || meta.desc || ''}</span>`;
      card.addEventListener('click', () => engine.setPreset(presetIndex));
      presets.append(card);
    }
    panel.append(presets, heading('主控'));
    for (const spec of MAIN_SLIDERS) panel.append(slider(engine, fx, spec, beginSliderDrag, finishSliderDrag));

    panel.append(heading('歌词颜色'));
    const swatches = document.createElement('div');
    swatches.className = 'lyric-color-grid';
    const auto = document.createElement('button');
    auto.type = 'button';
    auto.className = `lyric-swatch auto${fx.lyricColorMode === 'auto' ? ' active' : ''}`;
    auto.textContent = 'AUTO';
    auto.addEventListener('click', () => engine.setLyricColorAuto());
    swatches.append(auto);
    state.lyricColorPresets.forEach((preset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `lyric-swatch${fx.lyricColorMode !== 'auto' && String(fx.lyricColor).toLowerCase() === preset.color.toLowerCase() ? ' active' : ''}`;
      button.style.setProperty('--swatch', preset.color);
      button.title = preset.name;
      button.addEventListener('click', () => engine.setLyricColorPreset(index));
      swatches.append(button);
    });
    panel.append(swatches);
    panel.append(
      colorRow('歌词颜色', fx.lyricColor, (color) => engine.setLyricColorCustom(color), [{ label: '封面', active: fx.lyricColorMode === 'auto', run: () => engine.setLyricColorAuto() }]),
      colorRow('高亮颜色', fx.lyricHighlightColor, (color) => engine.setLyricHighlightCustom(color), [{ label: '跟随', active: fx.lyricHighlightMode === 'auto', run: () => engine.setLyricHighlightAuto() }]),
      colorRow('溢光颜色', fx.lyricGlowColor, (color) => engine.setLyricGlowCustom(color), [{ label: '链接', active: fx.lyricGlowLinked, run: () => engine.setLyricGlowLinked(!fx.lyricGlowLinked) }]),
    );

    panel.append(heading('歌词字体'));
    const fonts = document.createElement('div');
    fonts.className = 'fx-font-grid expanded';
    for (const [key, label] of FONTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = fx.lyricFont === key ? 'active' : '';
      button.textContent = label;
      button.addEventListener('click', () => engine.setLyricFont(key));
      fonts.append(button);
    }
    panel.append(fonts, heading('歌词布局'));
    for (const spec of LYRIC_SLIDERS) panel.append(slider(engine, fx, spec, beginSliderDrag, finishSliderDrag));

    panel.append(heading('颜色与背景'));
    panel.append(
      colorRow('界面高亮', fx.uiAccentColor, (color) => engine.setUiAccentColor(color), [{ label: '默认', run: () => engine.resetUiAccentColor() }]),
      colorRow('视觉主色', fx.visualTintColor, (color) => engine.setVisualTintCustom(color), [{ label: '封面', active: fx.visualTintMode === 'auto', run: () => engine.setVisualTintAuto() }]),
      colorRow('背景颜色', fx.backgroundColor, (color) => engine.setCustomBackgroundColor(color), [{ label: '封面', active: fx.backgroundColorMode !== 'custom', run: () => engine.setCustomBackgroundCoverMode() }]),
    );

    panel.append(heading('叠加效果'));
    const toggles = document.createElement('div');
    toggles.className = 'fx-toggle-grid';
    for (const [key, label] of TOGGLES) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `fx-toggle${fx[key] ? ' on' : ''}`;
      toggle.innerHTML = `<span>${label}</span><span class="dot"></span>`;
      toggle.addEventListener('click', () => engine.toggleFx(key));
      toggles.append(toggle);
    }
    panel.append(toggles, heading('性能与高级参数'));
    panel.append(segmented([['auto', '自动'], ['keep', '保持'], ['release', '释放']], fx.performanceBackground, (value) => engine.setPerformanceBackgroundMode(value)));
    panel.append(segmented([['eco', '低'], ['balanced', '中'], ['high', '高'], ['ultra', '超高']], fx.performanceQuality, (value) => engine.setPerformanceQualityMode(value)));
    for (const spec of ADVANCED_SLIDERS) panel.append(slider(engine, fx, spec, beginSliderDrag, finishSliderDrag));
    const note = document.createElement('p');
    note.className = 'mono-fx-note';
    note.textContent = '外置插件使用 Mono 后端的 5 段频谱驱动原版视觉引擎；预设、歌词、镜头和粒子参数会保存到插件配置。';
    const actions = document.createElement('div');
    actions.className = 'mono-settings-actions';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'fx-mini-btn';
    reset.textContent = '恢复默认';
    reset.addEventListener('click', () => engine.resetFx());
    actions.append(reset);
    panel.append(note, actions);
  }

  return {
    element: panel,
    render,
    setVisible(visible) {
      panel.classList.toggle('show', Boolean(visible));
      if (visible) render();
    },
  };
}
