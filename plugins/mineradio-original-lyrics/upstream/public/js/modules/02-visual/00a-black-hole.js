var blackHoleVisual = null;
var blackHolePull = 0;
var blackHoleFlowPhase = 0;

function createBlackHoleVisual(parentScene) {
  var target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, stencilBuffer: false
  });
  var rayUniforms = {
    uTime: { value: 0 },
    uInfall: { value: 0 },
    uFlowPhase: { value: 0 },
    uFootprint: { value: 0 },
    uEye: { value: new THREE.Vector3() },
    uCameraWorld: { value: new THREE.Matrix4() },
    uInverseProjection: { value: new THREE.Matrix4() },
    uWorldToDisk: { value: new THREE.Matrix3() }
  };
  var geometry = new THREE.PlaneGeometry(2, 2);
  var rayMaterial = new THREE.ShaderMaterial({
    uniforms: rayUniforms,
    vertexShader: blackHoleVertexShader, fragmentShader: blackHoleFragmentShader,
    depthTest: false, depthWrite: false, toneMapped: false
  });
  var rayScene = new THREE.Scene();
  var rayQuad = new THREE.Mesh(geometry, rayMaterial);
  rayQuad.frustumCulled = false;
  rayScene.add(rayQuad);
  var screenMaterial = new THREE.ShaderMaterial({
    uniforms: { uImage: { value: target.texture }, uTexel: { value: new THREE.Vector2(1, 1) } },
    vertexShader: blackHoleVertexShader,
    fragmentShader: blackHoleCompositeShader,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false
  });
  var screen = new THREE.Mesh(geometry, screenMaterial);
  screen.frustumCulled = false;
  screen.renderOrder = 9;
  parentScene.add(screen);
  var size = new THREE.Vector2();
  var diskRotation = new THREE.Matrix4();
  var tilt = new THREE.Matrix4().makeRotationZ(-0.12);
  return {
    target: target,
    update: function (webgl, viewCamera, rotation, time, infall, flowPhase) {
      webgl.getSize(size);
      // Bound ray tracing cost independently of HiDPI and the host particle budget.
      var scale = Math.min(1, 1152 / size.x, 768 / size.y);
      var width = Math.max(1, Math.round(size.x * scale));
      var height = Math.max(1, Math.round(size.y * scale));
      if (target.width !== width || target.height !== height) target.setSize(width, height);
      screenMaterial.uniforms.uTexel.value.set(1 / width, 1 / height);
      viewCamera.updateMatrixWorld(true);
      rayUniforms.uCameraWorld.value.copy(viewCamera.matrixWorld);
      rayUniforms.uInverseProjection.value.copy(viewCamera.projectionMatrixInverse);
      viewCamera.getWorldPosition(rayUniforms.uEye.value);
      rayUniforms.uFootprint.value = 2 * Math.tan(viewCamera.fov * Math.PI / 360) * rayUniforms.uEye.value.length() / height;
      diskRotation.makeRotationFromQuaternion(rotation).multiply(tilt).invert();
      rayUniforms.uWorldToDisk.value.setFromMatrix4(diskRotation);
      rayUniforms.uTime.value = time;
      rayUniforms.uInfall.value = infall || 0;
      rayUniforms.uFlowPhase.value = flowPhase || 0;
      var previousTarget = webgl.getRenderTarget();
      var previousAutoClear = webgl.autoClear;
      try {
        webgl.autoClear = true;
        webgl.setRenderTarget(target);
        webgl.render(rayScene, viewCamera);
      } finally {
        webgl.setRenderTarget(previousTarget);
        webgl.autoClear = previousAutoClear;
      }
    },
    dispose: function () {
      parentScene.remove(screen);
      target.dispose();
      geometry.dispose();
      rayMaterial.dispose();
      screenMaterial.dispose();
    }
  };
}

function updateBlackHoleVisual(dt) {
  var active = !!(fx && Number(fx.preset) === BLACK_HOLE_PRESET_INDEX);
  if (!active) {
    blackHolePull = 0;
    blackHoleFlowPhase = 0;
    if (blackHoleVisual) blackHoleVisual.dispose();
    blackHoleVisual = null;
    return;
  }
  var targetPull = playing ? 0 : 1;
  blackHolePull += (targetPull - blackHolePull) * (1 - Math.exp(-dt * (playing ? 3.4 : 1.8)));
  // Integrate the flow clock so toggling playback cannot jump the light trails.
  blackHoleFlowPhase += dt * blackHolePull;
  if (!blackHoleVisual) blackHoleVisual = createBlackHoleVisual(scene);
  blackHoleVisual.update(renderer, camera, particles.quaternion, uniforms.uTime.value, blackHolePull, blackHoleFlowPhase);
}
