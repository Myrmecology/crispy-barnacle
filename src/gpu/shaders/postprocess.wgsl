/* ============================================================
   CRISPY BARNACLE — postprocess.wgsl
   Pass 2 fragment shader.
   Takes the raw raymarch texture and applies:
   - Chromatic aberration
   - Scanline shimmer
   - Bloom approximation
   - Psychedelic color shift
   - Audio-reactive pulse
   - Film grain
   - Final vignette
   ============================================================ */

/* ── Uniforms ─────────────────────────────────────────────── */
struct PostUniforms {
  resolution : vec2<f32>,
  time       : f32,
  audioLevel : f32,
  warp       : f32,
  level      : f32,
  _pad       : vec2<f32>,  // explicit 16-byte alignment padding
};

@group(0) @binding(0) var<uniform> uni  : PostUniforms;
@group(0) @binding(1) var          samp : sampler;
@group(0) @binding(2) var          tex  : texture_2d<f32>;

/* ============================================================
   MATH HELPERS
   ============================================================ */

fn hash21(p : vec2<f32>) -> f32 {
  var p3 = fract(vec3(p.xyx) * 0.1031);
  p3    += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn rot2(a : f32) -> mat2x2<f32> {
  return mat2x2<f32>(cos(a), -sin(a), sin(a), cos(a));
}

/* ============================================================
   CHROMATIC ABERRATION
   Splits R G B channels along UV with audio-reactive strength
   ============================================================ */

fn chromaticAberration(uv : vec2<f32>, strength : f32) -> vec3<f32> {
  let dir    = uv - vec2(0.5);
  let offset = dir * strength;

  let r = textureSample(tex, samp, uv + offset       ).r;
  let g = textureSample(tex, samp, uv               ).g;
  let b = textureSample(tex, samp, uv - offset       ).b;

  return vec3(r, g, b);
}

/* ============================================================
   BLOOM — cheap 9-tap box blur on bright areas
   ============================================================ */

fn bloom(uv : vec2<f32>) -> vec3<f32> {
  let px     = 1.0 / uni.resolution;
  var accum  = vec3(0.0);
  let radius = 1.8;

  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      let offset = vec2(f32(x), f32(y)) * px * radius;
      let sample = textureSample(tex, samp, uv + offset).rgb;
      // Only bloom bright pixels
      let brightness = dot(sample, vec3(0.2126, 0.7152, 0.0722));
      accum += sample * clamp(brightness - 0.5, 0.0, 1.0);
    }
  }

  return accum / 9.0;
}

/* ============================================================
   FILM GRAIN
   ============================================================ */

fn filmGrain(uv : vec2<f32>, t : f32, strength : f32) -> f32 {
  let seed = uv + fract(t * 0.1);
  return (hash21(seed * 1000.0) - 0.5) * strength;
}

/* ============================================================
   SCANLINE SHIMMER
   Subtle horizontal bands that shift over time
   ============================================================ */

fn scanlines(uv : vec2<f32>, t : f32) -> f32 {
  let line  = sin(uv.y * uni.resolution.y * 1.5 + t * 2.0);
  return 1.0 - clamp(line * 0.03, 0.0, 0.04);
}

/* ============================================================
   PSYCHEDELIC HUE ROTATION
   Rotates the color wheel based on time + audio + level
   ============================================================ */

fn hueRotate(color : vec3<f32>, angle : f32) -> vec3<f32> {
  let k  = vec3(0.57735);
  let c  = cos(angle);
  let s  = sin(angle);
  return color * c
       + cross(k, color) * s
       + k * dot(k, color) * (1.0 - c);
}

/* ============================================================
   BARREL DISTORTION
   Subtle lens warp that breathes with the audio
   ============================================================ */

fn barrelDistort(uv : vec2<f32>, strength : f32) -> vec2<f32> {
  let centered = uv - vec2(0.5);
  let dist     = dot(centered, centered);
  return uv + centered * dist * strength;
}

/* ============================================================
   VERTEX SHADER — fullscreen quad
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
   FRAGMENT SHADER — full post-process stack
   ============================================================ */

@fragment
fn fs_main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {

  // Normalized UV [0, 1]
  var uv  = fragCoord.xy / uni.resolution;
  let t   = uni.time;
  let a   = uni.audioLevel;
  let w   = uni.warp;
  let lvl = uni.level;

  // ── Barrel distortion — breathes with audio ────────────
  let distortStrength = 0.08 + a * 0.12 + w * 0.05;
  uv = barrelDistort(uv, distortStrength);

  // Clamp UV — avoid sampling outside texture
  uv = clamp(uv, vec2(0.001), vec2(0.999));

  // ── Chromatic aberration ───────────────────────────────
  let caStrength = 0.004 + a * 0.012 + w * 0.006;
  var color      = chromaticAberration(uv, caStrength);

  // ── Bloom ──────────────────────────────────────────────
  let bloomColor  = bloom(uv);
  let bloomAmt    = 0.25 + a * 0.4;
  color          += bloomColor * bloomAmt;

  // ── Scanline shimmer ───────────────────────────────────
  color *= scanlines(uv, t);

  // ── Psychedelic hue rotation ───────────────────────────
  // Rotates slowly, accelerates with audio and level
  let hueAngle = t * 0.05
               + a * 1.2
               + lvl * 0.08
               + w * 0.6;
  color = hueRotate(color, hueAngle);

  // ── Audio pulse — whole screen brightness throb ────────
  let pulse  = 1.0 + a * 0.25 * sin(t * 12.0 + a * 8.0);
  color     *= pulse;

  // ── Film grain ─────────────────────────────────────────
  let grainStrength = 0.028 + a * 0.02;
  color += filmGrain(uv, t, grainStrength);

  // ── Vignette ───────────────────────────────────────────
  let centered  = uv - vec2(0.5);
  let vigStrength = 0.55 + lvl * 0.02;
  let vignette  = 1.0 - dot(centered, centered) * vigStrength * 2.2;
  color        *= clamp(vignette, 0.0, 1.0);

  // ── Level-based color temperature shift ───────────────
  // Low levels: cool blue tint. High levels: warm red push.
  let levelT    = clamp(lvl / 20.0, 0.0, 1.0);
  let coolWarm  = mix(
    vec3(0.85, 0.92, 1.0),   // cool blue tint
    vec3(1.0,  0.88, 0.75),  // warm red tint
    levelT
  );
  color *= coolWarm;

  // ── Final clamp ────────────────────────────────────────
  color = clamp(color, vec3(0.0), vec3(1.0));

  return vec4<f32>(color, 1.0);
}