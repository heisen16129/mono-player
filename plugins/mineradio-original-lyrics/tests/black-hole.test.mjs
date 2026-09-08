import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const publicRoot = new URL('../upstream/public/', import.meta.url);
function runtime() {
  const context = vm.createContext({ console });
  for (const path of ['vendor/three.r128.min.js', 'js/modules/02-visual/00a-black-hole-shader.js', 'js/modules/02-visual/00a-black-hole.js']) {
    vm.runInContext(readFileSync(new URL(path, publicRoot), 'utf8'), context);
  }
  const { THREE } = context;
  let target = null;
  context.renderer = {
    autoClear: false,
    getSize: (size) => size.set(1920, 1080),
    getRenderTarget: () => target,
    setRenderTarget: (next) => { target = next; },
    render: (scene) => { context.lastUniforms = scene.children[0].material.uniforms; },
  };
  Object.assign(context, {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(45, 16 / 9, .1, 100),
    particles: new THREE.Object3D(), fx: { preset: 0 }, playing: true,
    BLACK_HOLE_PRESET_INDEX: 9, uniforms: { uTime: { value: 0 } },
  });
  context.camera.position.set(0, .88, 8.8);
  context.camera.lookAt(0, 0, 0);
  return context;
}

test('allocates only for black hole and releases the target on preset exit', () => {
  const r = runtime();
  r.updateBlackHoleVisual(1 / 60);
  assert.equal(r.blackHoleVisual, null);
  r.fx.preset = 9;
  r.updateBlackHoleVisual(1 / 60);
  assert.equal(r.scene.children.length, 1);
  assert.equal(r.blackHoleVisual.target.width, 1152);
  assert.equal(r.blackHoleVisual.target.height, 648);
  let disposed = false;
  r.blackHoleVisual.target.addEventListener('dispose', () => { disposed = true; });
  r.fx.preset = 0;
  r.updateBlackHoleVisual(1 / 60);
  assert.equal(disposed, true);
  assert.equal(r.scene.children.length, 0);
  assert.equal(r.blackHoleVisual, null);
});

test('pause drives the light flow, resume fades it without rewinding its phase', () => {
  const r = runtime();
  r.fx.preset = 9;
  r.playing = false;
  for (let i = 0; i < 240; i++) r.updateBlackHoleVisual(1 / 60);
  assert.ok(r.blackHolePull > .999);
  assert.ok(r.blackHoleFlowPhase > 0);
  assert.equal(r.lastUniforms.uInfall.value, r.blackHolePull);
  assert.equal(r.lastUniforms.uFlowPhase.value, r.blackHoleFlowPhase);
  const pausePhase = r.blackHoleFlowPhase;
  r.playing = true;
  for (let i = 0; i < 180; i++) r.updateBlackHoleVisual(1 / 60);
  assert.ok(r.blackHolePull < .0001);
  assert.ok(r.blackHoleFlowPhase >= pausePhase);
  assert.ok(r.lastUniforms.uInfall.value < .0001);
  r.playing = false;
  r.updateBlackHoleVisual(1 / 60);
  assert.ok(r.blackHoleFlowPhase >= pausePhase);
  assert.ok(r.blackHolePull > .001 && r.blackHolePull < .05);
  r.fx.preset = 2;
  r.updateBlackHoleVisual(1 / 60);
  assert.equal(r.blackHolePull, 0);
  assert.equal(r.blackHoleFlowPhase, 0);
});

test('black hole no longer transforms or hides the lyric group', () => {
  const lyrics = readFileSync(new URL('js/modules/02-visual/14-stage-lyrics-rendering.js', publicRoot), 'utf8');
  assert.doesNotMatch(lyrics, /blackHole|lyricFall|lyricBlackHolePull/);
});

test('uses live camera/rotation matrices and preserves the host render target', () => {
  const r = runtime();
  const savedTarget = { host: true };
  r.renderer.setRenderTarget(savedTarget);
  r.fx.preset = 9;
  r.updateBlackHoleVisual(1 / 60);
  const before = r.lastUniforms.uWorldToDisk.value.clone();
  r.particles.rotation.y = .7;
  r.camera.position.set(5, 3, 6);
  r.camera.lookAt(0, 0, 0);
  r.updateBlackHoleVisual(1 / 60);
  assert.equal(r.lastUniforms.uWorldToDisk.value.equals(before), false);
  assert.equal(r.lastUniforms.uEye.value.x, 5);
  assert.equal(r.lastUniforms.uCameraWorld.value.equals(r.camera.matrixWorld), true);
  assert.equal(r.renderer.getRenderTarget(), savedTarget);
  assert.equal(r.renderer.autoClear, false);
  r.renderer.render = () => { throw new Error('render failure'); };
  assert.throws(() => r.updateBlackHoleVisual(1 / 60), /render failure/);
  assert.equal(r.renderer.getRenderTarget(), savedTarget);
  assert.equal(r.renderer.autoClear, false);
});

test('filters disk detail using the capped render resolution and camera distance', () => {
  const r = runtime();
  r.fx.preset = 9;
  r.updateBlackHoleVisual(1 / 60);
  const expected = 2 * Math.tan(r.camera.fov * Math.PI / 360) * r.camera.position.length() / 648;
  assert.ok(Math.abs(r.lastUniforms.uFootprint.value - expected) < 1e-8);
  r.camera.position.multiplyScalar(2);
  r.updateBlackHoleVisual(1 / 60);
  assert.ok(Math.abs(r.lastUniforms.uFootprint.value - expected * 2) < 1e-8);
  r.renderer.getSize = (size) => size.set(390, 720);
  r.updateBlackHoleVisual(1 / 60);
  assert.equal(r.blackHoleVisual.target.width, 390);
  assert.equal(r.blackHoleVisual.target.height, 720);
  assert.ok(Math.abs(r.lastUniforms.uFootprint.value - expected * 2 * 648 / 720) < 1e-8);
  assert.equal(r.scene.children[0].material.fragmentShader, r.blackHoleCompositeShader);
});
