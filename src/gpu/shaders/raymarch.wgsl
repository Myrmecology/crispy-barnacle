/* ============================================================
   CRISPY BARNACLE — raymarch.wgsl
   Pass 1 fragment shader.
   Volumetric fractal raymarcher with audio reactivity,
   time dilation, and psychedelic color curvature.
   ============================================================ */

/* ── Uniforms ─────────────────────────────────────────────── */
struct Uniforms {
  time       : f32,
  audioLevel : f32,
  warp       : f32,
  level      : f32,
  resolution : vec2<f32>,
  _pad       : vec2<f32>,   // explicit padding for 16-byte alignment
};

@group(0) @binding(0) var<uniform> uni : Uniforms;

/* ============================================================
   MATH HELPERS
   ============================================================ */

fn rot2(a : f32) -> mat2x2<f32> {
  let s = sin(a);
  let c = cos(a);
  return mat2x2<f32>(c, -s, s, c);
}

fn hash31(p : vec3<f32>) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/* ============================================================
   FRACTAL SDF — Mandelbox variant
   Audio warps the fold scale.
   Level increases iteration depth.
   ============================================================ */

fn fractalMap(pos : vec3<f32>) -> f32 {
  let foldLimit = 1.0;
  let scale     = 2.2 + uni.audioLevel * 0.6;
  let iters     = 6 + i32(uni.level * 0.5);

  var z  = pos;
  var dr = 1.0;
  var r  = 0.0;

  for (var i = 0; i < 10; i++) {
    if (i >= iters) { break; }

    r = length(z);
    if (r > 2.0) { break; }

    // Box fold
    z = clamp(z, vec3(-foldLimit), vec3(foldLimit)) * 2.0 - z;

    // Sphere fold
    let r2 = dot(z, z);
    if (r2 < 0.25) {
      z  *= 4.0;
      dr *= 4.0;
    } else if (r2 < 1.0) {
      z  /= r2;
      dr /= r2;
    }

    // Scale and offset
    z  = z * scale + pos;
    dr = dr * abs(scale) + 1.0;

    // Audio-reactive hyperspace twist
    let twist = uni.audioLevel * 0.4 + uni.warp * 0.3;
    let xy    = rot2(twist * 0.5 + f32(i) * 0.15) * z.xy;
    z = vec3(xy, z.z);
  }

  return 0.5 * log(r) * r / dr;
}

/* ============================================================
   SCENE SDF — wraps fractal with extra geometry
   ============================================================ */

fn sceneSDF(p : vec3<f32>) -> f32 {
  let t    = uni.time * 0.12;
  var pos  = p;

  // Slow camera drift through the fractal
  pos.z   += t * 0.4;
  pos.x   += sin(t * 0.3) * 0.2;
  pos.y   += cos(t * 0.2) * 0.15;

  return fractalMap(pos);
}

/* ============================================================
   NORMAL ESTIMATION — for lighting
   ============================================================ */

fn estimateNormal(p : vec3<f32>) -> vec3<f32> {
  let e = vec2<f32>(0.001, 0.0);
  return normalize(vec3<f32>(
    sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
    sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
    sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx),
  ));
}

/* ============================================================
   COLOR — psychedelic time-dilation palette
   Shifts from cool blue → warm red as level increases
   Audio modulates saturation in real time
   ============================================================ */

fn palette(t : f32, level : f32, audio : f32) -> vec3<f32> {
  // Base color oscillation
  let a = vec3(0.5, 0.5, 0.5);
  let b = vec3(0.5, 0.5, 0.5);
  let c = vec3(1.0, 1.0, 1.0);

  // Level shifts hue from blue (0.0) toward red (1.0)
  let levelT  = clamp(level / 20.0, 0.0, 1.0);
  let d       = vec3(
    0.0   + levelT * 0.5,
    0.33  - levelT * 0.2,
    0.67  - levelT * 0.4
  );

  let baseColor = a + b * cos(6.2832 * (c * t + d));

  // Audio boosts saturation
  let sat = 1.0 + audio * 1.2;
  let lum = (baseColor.r + baseColor.g + baseColor.b) / 3.0;
  return mix(vec3(lum), baseColor, sat);
}

/* ============================================================
   VERTEX SHADER — fullscreen triangle pair
   ============================================================ */

@vertex
fn vs_main(@builtin(vertex_index) idx : u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0,  1.0),
    vec2(-1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2( 1.0,  1.0),
  );
  return vec4<f32>(positions[idx], 0.0, 1.0);
}

/* ============================================================
   FRAGMENT SHADER — main raymarcher
   ============================================================ */

@fragment
fn fs_main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {

  // Normalized UV — centered, aspect corrected
  let uv = (fragCoord.xy / uni.resolution - vec2(0.5)) * 2.0
           * vec2(uni.resolution.x / uni.resolution.y, 1.0);

  let t  = uni.time;

  // ── Ray setup ──────────────────────────────────────────
  let fov = 1.6 + uni.audioLevel * 0.3;
  let rd  = normalize(vec3(uv * fov, -1.0));
  var ro  = vec3(0.0, 0.0, 3.5 + sin(t * 0.1) * 0.5);

  // Slowly rotate camera
  let camAngle = t * 0.04 + uni.warp * 0.2;
  let rdXY     = rot2(camAngle) * rd.xy;
  let rayDir   = vec3(rdXY, rd.z);

  // ── Raymarch ───────────────────────────────────────────
  var dTotal   = 0.0;
  var hitDist  = 999.0;
  var steps    = 0;
  let MAX_DIST = 12.0;
  let MIN_DIST = 0.0008;

  for (var i = 0; i < 96; i++) {
    let p    = ro + rayDir * dTotal;
    let dist = sceneSDF(p);

    if (dist < MIN_DIST) {
      hitDist = dTotal;
      steps   = i;
      break;
    }

    if (dTotal > MAX_DIST) { break; }

    dTotal += dist * 0.55;
    steps   = i;
  }

  // ── Shading ────────────────────────────────────────────
  let hit     = hitDist < MAX_DIST;
  let hitPos  = ro + rayDir * hitDist;

  // Ambient occlusion approximation from step count
  let ao      = 1.0 - f32(steps) / 96.0;

  // Glow for near-miss rays (volumetric feel)
  let glow    = clamp(0.015 / (dTotal + 0.01), 0.0, 1.0);

  // Surface normal and basic diffuse
  var color   = vec3(0.0);

  if (hit) {
    let normal  = estimateNormal(hitPos);
    let light   = normalize(vec3(1.0, 2.0, 3.0));
    let diffuse = clamp(dot(normal, light), 0.0, 1.0);
    let palT    = dTotal * 0.4 + t * 0.08 + uni.audioLevel * 0.5;
    let surfCol = palette(palT, uni.level, uni.audioLevel);
    color       = surfCol * (diffuse * 0.7 + ao * 0.3);
  }

  // Add volumetric glow on top of surface or empty space
  let glowT   = dTotal * 0.3 + t * 0.1;
  let glowCol = palette(glowT, uni.level, uni.audioLevel);
  color      += glowCol * glow * (0.6 + uni.audioLevel * 0.8);

  // Vignette
  let vignette = 1.0 - dot(uv * 0.5, uv * 0.5);
  color       *= clamp(vignette, 0.0, 1.0);

  // Exposure / tone map
  color = vec3(1.0) - exp(-color * 1.8);

  // Gamma correct
  color = pow(clamp(color, vec3(0.0), vec3(1.0)), vec3(0.4545));

  return vec4<f32>(color, 1.0);
}