// Prismatic glass fragment shader: domain-warped fbm field, chromatic dispersion,
// thin-film iridescence on gradient edges, pointer as a light source, film grain.

import type { ShaderPreset, Vec3 } from './appearance';

export const VERTEX_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const FRAGMENT_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_base;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_iri;
uniform float u_light;
uniform float u_grain;
uniform float u_scale;
uniform float u_sat;
uniform float u_vig;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float field(vec2 p, float t) {
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.05)), fbm(p + vec2(5.2, 1.3) - t * 0.04));
  return fbm(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.025);
}

void main() {
  vec2 uv = v_uv;
  float asp = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * u_scale;
  vec2 m = (u_mouse - 0.5) * vec2(asp, 1.0) * u_scale;
  float t = u_time;

  vec2 d = p - m;
  float dist = length(d);
  // glass lens bulge around the pointer
  p += d * 0.14 * exp(-dist * dist * 1.6);

  vec2 off = (d / (dist + 0.001)) * 0.018 * (0.6 + u_iri);
  float fr = field(p + off, t);
  float fg = field(p, t);
  float fb = field(p - off, t);

  vec3 col = mix(u_base, u_c1, smoothstep(0.22, 0.6, fg));
  col = mix(col, u_c2, smoothstep(0.45, 0.78, fr) * 0.85);
  col = mix(col, u_c3, smoothstep(0.5, 0.85, fb) * 0.7);

  // thin-film iridescence where the dispersed channels disagree
  float edge = clamp(abs(fr - fb) * 16.0, 0.0, 1.0);
  vec3 iri = 0.5 + 0.5 * cos(6.2831 * (fg * 2.2 + t * 0.015 + vec3(0.0, 0.33, 0.67)));
  col = mix(col, iri, edge * u_iri * 0.32);

  // fine prismatic contour lines
  float band = smoothstep(0.47, 0.5, abs(fract(fg * 7.0) - 0.5));
  col += band * u_iri * 0.018;

  // pointer light + specular hotspot
  float light = exp(-dist * dist * 2.4);
  col += light * u_light * 0.22 * mix(vec3(1.0), u_c2, 0.35);
  col += pow(max(0.0, 1.0 - dist * 1.4), 10.0) * u_light * 0.25;

  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(g), col, u_sat);

  vec2 vu = uv - 0.5;
  col *= 1.0 - dot(vu, vu) * 0.45 * u_vig;

  col += (hash(uv * u_res) - 0.5) * u_grain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* ---------- CSS fallback ---------- */

function rgb(v: Vec3) {
  return `rgb(${v.map((c) => Math.round(c * 255)).join(' ')})`;
}

/**
 * Static stand-in for the WebGL field: the same three anchor colors as a CSS gradient.
 * Used when the browser gives no usable WebGL context, so the hero never goes flat.
 */
export function shaderFallbackBackground(preset: ShaderPreset): string {
  return `radial-gradient(circle at 50% 38%, ${rgb(preset.c2)}, ${rgb(preset.c1)} 45%, ${rgb(preset.base)})`;
}
