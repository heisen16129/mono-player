// Camera rays travel through a 3D disk; the quad is only the final image surface.
var blackHoleVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}`;

var blackHoleFragmentShader = `
precision highp float;
uniform mat4 uCameraWorld, uInverseProjection;
uniform mat3 uWorldToDisk;
uniform vec3 uEye;
uniform float uTime, uInfall, uFlowPhase, uFootprint;
varying vec2 vUv;
const float HORIZON = 0.52;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float turbulence(vec2 p) {
  return noise(p) * 0.57 + noise(p * 2.03 + 7.1) * 0.28
    + noise(p * 4.07 - 3.7) * 0.15;
}
vec3 gravity(vec3 p, float angularMomentum2) {
  float r2 = max(dot(p, p), 0.08);
  return -1.5 * HORIZON * angularMomentum2 * p / (r2 * r2 * sqrt(r2));
}

vec3 distantDust(vec3 direction) {
  vec3 d = normalize(direction);
  float cloud = turbulence(d.xy * 5.0 + d.z * vec2(2.4, -3.1));
  float wisps = turbulence(d.yz * 24.0 + d.x * 3.0);
  float band = exp(-pow(dot(d, normalize(vec3(0.38, 0.76, 0.28))) / 0.34, 2.0));
  vec3 dust = vec3(0.030, 0.041, 0.050) * band * pow(cloud, 2.8) * pow(wisps * 1.6, 2.0);
  // Direction-space stars rotate with the view and bend with escaping rays.
  vec3 cell = floor(d * 200.0), local = fract(d * 200.0);
  float seed = hash(cell.xy + cell.z * vec2(13.7, 7.3));
  vec3 center = 0.25 + 0.5 * vec3(hash(cell.xy + cell.z), hash(cell.yz - cell.x), hash(cell.zx + cell.y));
  float star = (1.0 - smoothstep(0.035, 0.12, length(local - center))) * step(0.90, seed);
  return dust + vec3(0.70, 0.82, 1.0) * star * (0.08 + seed * 0.25);
}

// Integrate emission/absorption in the thin disk, including a plane crossing
// between steps so grazing rays do not skip it at lower render resolutions.
void sampleDisk(vec3 a, vec3 b, inout vec3 light, inout float transmission) {
  float dy = b.y - a.y;
  float along = abs(dy) > 0.00001 ? clamp(-a.y / dy, 0.0, 1.0) : 0.5;
  vec3 p = mix(a, b, along);
  float radius = length(p.xz);
  if (radius < HORIZON || radius > 6.0) return;
  if (radius < 1.52 && uInfall < 0.001) return;
  float thickness = 0.013 + radius * 0.0035;
  if (abs(p.y) > thickness * 3.5) return;
  float angle = atan(p.z, p.x);
  float phase = angle - uTime * 0.34 / pow(radius, 1.5);
  vec2 flow = vec2(cos(phase), sin(phase));
  float cloud = turbulence(flow * 7.0 + radius * 0.8);
  float clumps = turbulence(flow * 16.0 + vec2(radius * 4.0, -radius * 3.0));
  float radial = radius + uFlowPhase * 0.12;
  float warp = sin(phase * 6.0 + radius * 2.3) * 0.045 + (cloud - 0.5) * 0.24;
  float bands = noise(vec2((radial + warp) * 25.0, flow.x * 3.0 + flow.y * 2.0));
  float grazing = max(abs(normalize(b - a).y), 0.06);
  float bandDetail = exp(-pow(uFootprint * 8.0 / grazing, 2.0));
  bands = mix(0.5, bands, bandDetail);
  float fine = sin((radial + warp) * 165.0 + cloud * 2.0);
  fine *= exp(-pow(uFootprint * 165.0 * 0.55 / grazing, 2.0));
  float filament = smoothstep(0.18, 0.82, bands) * (0.30 + clumps * 1.2) + fine * 0.08;
  float envelope = smoothstep(1.52, 1.85, radius) * (1.0 - smoothstep(3.0, 6.0, radius));
  float diskDensity = (0.6 + clumps * 2.4) * envelope;
  // Constant packet phase moves to smaller radii as the clock advances.
  // Logarithmic streamlines curve into the horizon in the same 3D disk space.
  float logRadius = log(radius / HORIZON);
  float winding = angle + logRadius * 2.4;
  float stream = pow(0.5 + 0.5 * cos(winding * 5.0), 22.0);
  float packet = fract(logRadius * 0.9 + uFlowPhase * 0.65);
  float pulse = exp(-pow((packet - 0.52) / 0.19, 2.0));
  float streamDensity = uInfall * stream * (0.06 + pulse * 1.8);
  streamDensity *= smoothstep(HORIZON, HORIZON + 0.12, radius) * (1.0 - smoothstep(4.1, 6.0, radius));
  float density = diskDensity + streamDensity;
  float height = exp(-0.5 * pow(p.y / thickness, 2.0));
  // Integrate the whole segment through the vertical density profile to avoid
  // step-shaped stripes when a grazing ray straddles two integration steps.
  float column = height * length(b - a) / thickness;
  if (abs(dy) > 0.00001) {
    float cdfA = 1.0 / (1.0 + exp(clamp(-1.7 * a.y / thickness, -30.0, 30.0)));
    float cdfB = 1.0 / (1.0 + exp(clamp(-1.7 * b.y / thickness, -30.0, 30.0)));
    column = 2.5066 * abs(cdfB - cdfA) * length(b - a) / abs(dy);
  }
  float opacity = 1.0 - exp(-density * column * 0.32);
  float heat = exp(-pow((radius - 2.10) / 0.72, 2.0));
  float embers = exp(-pow((radius - 3.1) / 1.3, 2.0));
  vec3 dust = vec3(0.30, 0.105, 0.045);
  vec3 cream = vec3(1.0, 0.84, 0.72);
  vec3 color = mix(dust, cream, clamp(heat * 1.3, 0.0, 1.0));
  color *= (0.08 + heat * 3.4 + embers * 0.9) * (0.12 + filament * 1.8);
  float darkLanes = mix(0.16, 1.0, smoothstep(0.38, 0.68, clumps));
  color *= mix(1.0, darkLanes, smoothstep(2.3, 3.5, radius));
  color = mix(color, vec3(2.8, 1.7, 0.85), streamDensity / max(density, 0.0001));
  // The cooler underside is visible through the lower lensed image.
  color *= dy > 0.0 ? 0.42 : 1.0;
  vec3 velocity = normalize(vec3(-p.z, 0.0, p.x));
  float doppler = clamp(1.0 + dot(velocity, normalize(a - b)) * 0.48, 0.50, 1.5);
  light += transmission * opacity * color * doppler;
  transmission *= 1.0 - opacity;
}

void main() {
  vec4 view = uInverseProjection * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 direction = normalize(mat3(uCameraWorld) * (view.xyz / view.w));
  vec3 p = uWorldToDisk * uEye;
  vec3 velocity = uWorldToDisk * direction;
  float approach = dot(p, velocity);
  float intersection = approach * approach - dot(p, p) + 144.0;
  if (intersection < 0.0) {
    vec3 sky = distantDust(velocity);
    gl_FragColor = vec4(sqrt(sky / (1.0 + sky)), 1.0);
    return;
  }
  p += velocity * max(0.0, -approach - sqrt(intersection));
  vec3 angularMomentum = cross(p, velocity);
  float h2 = dot(angularMomentum, angularMomentum);
  vec3 light = vec3(0.0);
  float transmission = 1.0;
  bool captured = false;
  // A Schwarzschild-inspired central field, integrated in world space.
  // This is a real-time visual approximation, not a scientific GR solver.
  for (int i = 0; i < 128; i++) {
    float radius = length(p);
    if (radius < HORIZON) { captured = true; break; }
    if (transmission < 0.015) break;
    if (radius > 18.0 && dot(p, velocity) > 0.0) break;
    float stepSize = clamp(radius * 0.10, 0.025, 0.50);
    vec3 acceleration = gravity(p, h2);
    vec3 next = p + velocity * stepSize + acceleration * (0.5 * stepSize * stepSize);
    velocity += (acceleration + gravity(next, h2)) * (0.5 * stepSize);
    sampleDisk(p, next, light, transmission);
    p = next;
  }
  if (!captured) light += transmission * distantDust(velocity);
  // Perceptual encoding preserves dark dust gradients in an RGBA8 target.
  gl_FragColor = vec4(sqrt(light / (1.0 + light)), captured ? 0.0 : 1.0);
}`;

var blackHoleCompositeShader = `
uniform sampler2D uImage;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 radiance(vec2 uv) {
  vec3 encoded = texture2D(uImage, uv).rgb;
  encoded *= encoded;
  return encoded / max(vec3(0.004), 1.0 - encoded);
}
vec3 glow(vec2 stepSize) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float angle = float(i) * 0.78539816;
    vec3 sampleColor = radiance(vUv + vec2(cos(angle), sin(angle)) * stepSize);
    sum += max(sampleColor - 0.85, 0.0);
  }
  return sum * 0.125;
}
void main() {
  vec3 direct = radiance(vUv) * 0.5;
  direct += radiance(vUv + vec2(uTexel.x, 0)) * 0.125;
  direct += radiance(vUv - vec2(uTexel.x, 0)) * 0.125;
  direct += radiance(vUv + vec2(0, uTexel.y)) * 0.125;
  direct += radiance(vUv - vec2(0, uTexel.y)) * 0.125;
  vec3 bloom = glow(uTexel * 4.0) * 0.09 + glow(uTexel * 13.0) * 0.055;
  float shadow = texture2D(uImage, vUv).a;
  bloom *= max(shadow, smoothstep(0.01, 0.3, max(direct.r, max(direct.g, direct.b))));
  vec3 color = pow(1.0 - exp(-(direct + bloom) * 0.58), vec3(1.0 / 2.2));
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float lightAlpha = smoothstep(0.006, 0.11, luminance);
  float horizonAlpha = 1.0 - smoothstep(0.0, 0.08, shadow);
  gl_FragColor = vec4(color, max(lightAlpha, horizonAlpha));
}`;
