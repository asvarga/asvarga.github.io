// Draws a forest with WebGL2. Every piece is one instance; the GPU works out
// how much of it has grown by now, so playing growth back costs the CPU
// nothing. Effects come from a distance field made by jump flooding:
//
//   1. Seed: draw the lines at half resolution into a float texture, each
//      covered pixel storing its own position and its line's color key.
//   2. Flood: log2(size) passes, each pixel looking 2^k pixels away in eight
//      directions and keeping the nearest seed it hears of. Now every pixel
//      knows its nearest line, how far it is, and its color.
//   3. Composite: from that, a glow (Neon), cells tinted by their walls with
//      the medial axis between them as leading (Stained glass), rings of
//      equal distance (Contours), or only the medial axis (Skeleton).
//   4. Then the lines themselves, anti-aliased capsules, with hot tips where
//      they're growing, and sparks where a branch is cut.

const PALETTES = {
  // Cosine palettes: a + b cos(2π(c x + d)).
  aurora: [
    [0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
    [1.0, 1.0, 1.0],
    [0.0, 0.1, 0.2],
  ],
  ember: [
    [0.65, 0.45, 0.3],
    [0.35, 0.35, 0.3],
    [0.5, 0.5, 0.5],
    [0.5, 0.6, 0.7],
  ],
  ocean: [
    [0.3, 0.55, 0.6],
    [0.3, 0.4, 0.35],
    [0.7, 0.8, 0.9],
    [0.6, 0.6, 0.7],
  ],
  candy: [
    [0.8, 0.5, 0.6],
    [0.3, 0.4, 0.3],
    [1.0, 1.0, 1.0],
    [0.0, 0.33, 0.67],
  ],
  moss: [
    [0.45, 0.6, 0.35],
    [0.4, 0.35, 0.3],
    [0.6, 0.6, 0.6],
    [0.1, 0.25, 0.4],
  ],
};
export const PALETTE_NAMES = Object.keys(PALETTES);

export const EFFECTS = ["none", "neon", "glass", "contours", "skeleton"];
const MODES = { depth: 0, time: 1, seed: 2, ink: 3 };

const SEED_COLORS = {
  night: ["#f6c85f", "#6fd3c7", "#ff8a7a", "#9fa8ff", "#b5e37a", "#f59ad8", "#7ec4ff", "#ffb26b"],
  day: ["#b8860b", "#16857a", "#c8432f", "#4a55c9", "#5b8c1e", "#b0388f", "#1f6fb3", "#c26a12"],
};
export const PAPERS = {
  night: { bg: "#16292c", bg2: "#0b1517", ink: "#f4f1e4", seed: "#f6c85f" },
  day: { bg: "#f6f1e3", bg2: "#e7dfca", ink: "#1d2a2c", seed: "#a8323a" },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const COLOR = /* glsl */ `
uniform int uMode;
uniform int uDay;
uniform vec3 uPal[4];
uniform vec3 uSeeds[8];
uniform vec3 uInk;
vec3 colorOf(float key) {
  if (uMode == 2) return uSeeds[int(mod(key, 8.0))];
  if (uMode == 3) return uInk;
  vec3 c = uPal[0] + uPal[1] * cos(6.2831853 * (uPal[2] * (0.06 + 0.78 * key) + uPal[3]));
  c = clamp(c, 0.0, 1.0);
  // Day paper wants darker ink.
  return uDay == 1 ? c * 0.72 : c;
}
`;

const LINE_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aSeg;
layout(location = 1) in vec4 aInfo;
uniform vec2 uCenter;
uniform float uZoom;
uniform vec2 uView;
uniform float uNow;
uniform float uHalf;
uniform float uTips;
uniform float uDeepest;
uniform float uLast;
uniform int uMode;
out vec2 vPos;
out vec2 vA;
out vec2 vB;
out float vKey;
out float vGrow;
const vec2 CORNERS[6] = vec2[6](vec2(0, -1), vec2(1, -1), vec2(1, 1), vec2(0, -1), vec2(1, 1), vec2(0, 1));
vec2 toPx(vec2 w) { return (w - uCenter) * uZoom + 0.5 * uView; }
void main() {
  vec2 p1 = aSeg.xy;
  vec2 p2 = aSeg.zw;
  float L = length(p2 - p1);
  float shown = min((uNow - aInfo.x) * aInfo.y, L);
  if (shown <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 dir = L > 0.0 ? (p2 - p1) / L : vec2(1.0, 0.0);
  vec2 a = toPx(p1);
  vec2 b = toPx(p1 + dir * max(shown, 0.0));
  vec2 d = b - a;
  float dl = length(d);
  vec2 t = dl > 1e-4 ? d / dl : dir;
  vec2 n = vec2(-t.y, t.x);
  vGrow = shown < L * 0.999 - 1e-4 ? uTips : 0.0; // float32: the end is the end
  float r = uHalf + 1.5 + vGrow * (uHalf * 4.0 + 5.0);
  vec2 c = CORNERS[gl_VertexID % 6];
  vec2 pos = mix(a - t * r, b + t * r, c.x) + n * r * c.y;
  vPos = pos;
  vA = a;
  vB = b;
  float seed = floor(aInfo.w);
  vKey = uMode == 0 ? aInfo.z / max(uDeepest, 1.0) : uMode == 1 ? aInfo.x / max(uLast, 1e-6) : seed;
  gl_Position = vec4(pos / uView * 2.0 - 1.0, 0.0, 1.0);
}
`;

const SEG_DIST = /* glsl */ `
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
`;

const LINE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vPos;
in vec2 vA;
in vec2 vB;
in float vKey;
in float vGrow;
uniform float uHalf;
out vec4 o;
${COLOR}
${SEG_DIST}
void main() {
  float d = segDist(vPos, vA, vB);
  float alpha = clamp(uHalf + 0.5 - d, 0.0, 1.0);
  vec3 c = colorOf(vKey);
  if (vGrow > 0.0) {
    float r = length(vPos - vB) / (uHalf * 2.5 + 2.0);
    float tip = vGrow * exp(-r * r);
    vec3 hot = uDay == 1 ? c * 0.4 : mix(c, vec3(1.0, 0.98, 0.92), 0.75);
    c = mix(c, hot, tip);
    alpha = max(alpha, tip * 0.95);
  }
  if (alpha <= 0.003) discard;
  o = vec4(c * alpha, alpha);
}
`;

const SEED_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vPos;
in vec2 vA;
in vec2 vB;
in float vKey;
in float vGrow;
uniform float uHalf;
out vec4 o;
${SEG_DIST}
void main() {
  if (segDist(vPos, vA, vB) > uHalf + 0.5) discard;
  o = vec4(gl_FragCoord.xy, vKey, 1.0);
}
`;

const FULL_VS = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FLOOD_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uSrc;
uniform int uStep;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(uSrc, 0);
  vec4 best = texelFetch(uSrc, p, 0);
  float bd = best.w > 0.0 ? distance(best.xy, gl_FragCoord.xy) : 1e9;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      ivec2 q = p + ivec2(i, j) * uStep;
      if (q.x < 0 || q.y < 0 || q.x >= size.x || q.y >= size.y) continue;
      vec4 s = texelFetch(uSrc, q, 0);
      if (s.w <= 0.0) continue;
      float d = distance(s.xy, gl_FragCoord.xy);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
  }
  o = best;
}
`;

const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uField;
uniform float uScale;
uniform int uEffect;
uniform vec2 uView;
uniform vec3 uBg;
uniform vec3 uBg2;
uniform float uDpr;
uniform float uGlow;
out vec4 o;
${COLOR}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec4 field(ivec2 p) { return texelFetch(uField, clamp(p, ivec2(0), textureSize(uField, 0) - 1), 0); }
// How far apart the walls nearest this pixel and its neighbours are: large
// on the medial axis, where the nearest wall jumps from one to another.
float ridge(ivec2 p, vec4 s) {
  float m = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 o2 = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(0, 1) : k == 2 ? ivec2(1, 1) : ivec2(1, -1);
    vec4 n = field(p + o2);
    if (n.w > 0.0) m = max(m, distance(n.xy, s.xy));
  }
  return m;
}
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uView;
  vec3 col = mix(uBg2, uBg, smoothstep(-0.2, 1.1, uv.y));
  float vig = smoothstep(1.15, 0.25, length((uv - 0.5) * vec2(uView.x / uView.y, 1.0)) * 0.9);
  col *= uDay == 1 ? mix(0.93, 1.0, vig) : mix(0.62, 1.0, vig);
  col += (hash(fc) - 0.5) * (uDay == 1 ? 0.018 : 0.012);
  if (uEffect > 0) {
    ivec2 p = ivec2(fc * uScale);
    vec4 s = field(p);
    if (s.w > 0.0) {
      float d = distance(s.xy / uScale, fc) / uDpr; // css pixels to the nearest line
      vec3 c = colorOf(s.z);
      float g = uGlow;
      if (uEffect == 1) {
        float glow = 0.38 * exp(-d / 4.0) + 0.22 * exp(-d / 18.0) + 0.09 * exp(-d / 70.0);
        col = uDay == 1 ? mix(col, c, min(1.0, glow * 0.55 * g)) : col + c * glow * g;
      } else if (uEffect == 2) {
        float r = ridge(p, s) / uScale / uDpr;
        // Only inside the trees: out in the open the axis is just long rays.
        float lead = smoothstep(2.0, 6.0, r) * smoothstep(0.0, 3.0, d) * smoothstep(40.0, 12.0, d);
        // Panes tinted by their nearest wall, brightest along it, a little
        // darker than the lines so those still read; the medial axis leads.
        float fill = 0.16 + 0.34 * exp(-d / 12.0);
        vec3 tint = uDay == 1 ? mix(c, vec3(1.0), 0.35) : c * 0.6;
        vec3 glass = mix(col, tint, min(1.0, fill * g));
        col = mix(glass, uDay == 1 ? c * 0.45 : mix(c, vec3(1.0), 0.5), lead * 0.6);
      } else if (uEffect == 3) {
        float spacing = 7.0;
        float f = abs(fract(d / spacing + 0.5) - 0.5) * spacing;
        float ring = 1.0 - smoothstep(0.35, 1.25, f);
        float fade = exp(-d / 110.0) * smoothstep(0.0, 3.0, d);
        col = mix(col, c, ring * fade * 0.75 * g);
        col = uDay == 1 ? mix(col, c, 0.25 * exp(-d / 6.0)) : col + c * 0.25 * exp(-d / 6.0);
      } else if (uEffect == 4) {
        float r = ridge(p, s) / uScale / uDpr;
        float axis = smoothstep(2.0, 7.0, r) * (0.25 + 0.75 * exp(-d / 60.0));
        float glow = exp(-d / 30.0);
        col = uDay == 1 ? mix(col, c, axis * 0.8) : col + c * axis * (0.5 + 0.5 * glow) * g;
        col = uDay == 1 ? mix(col, c, 0.15 * exp(-d / 5.0)) : col + c * 0.12 * exp(-d / 5.0);
      }
    }
  }
  o = vec4(col, 1.0);
}
`;

const SPARK_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aSeg;
layout(location = 1) in vec4 aInfo;
uniform vec2 uCenter;
uniform float uZoom;
uniform vec2 uView;
uniform float uNow;
uniform float uDpr;
uniform float uLife;
out vec2 vLocal;
out float vAge;
const vec2 CORNERS[6] = vec2[6](vec2(-1, -1), vec2(1, -1), vec2(1, 1), vec2(-1, -1), vec2(1, 1), vec2(-1, 1));
void main() {
  float L = length(aSeg.zw - aSeg.xy);
  float cut = fract(aInfo.w);
  float at = aInfo.x + L / aInfo.y;
  float age = (uNow - at) / uLife;
  if (cut < 0.25 || age < 0.0 || age > 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 c = CORNERS[gl_VertexID % 6];
  float size = (4.0 + 16.0 * (1.0 - age)) * uDpr;
  vec2 pos = (aSeg.zw - uCenter) * uZoom + 0.5 * uView + c * size;
  vLocal = c;
  vAge = age;
  gl_Position = vec4(pos / uView * 2.0 - 1.0, 0.0, 1.0);
}
`;

const SPARK_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vLocal;
in float vAge;
uniform vec3 uSpark;
out vec4 o;
void main() {
  float r2 = dot(vLocal, vLocal);
  float star = exp(-r2 * 9.0) + 0.5 * exp(-abs(vLocal.x * vLocal.y) * 120.0 - r2 * 2.0);
  float a = star * (1.0 - vAge) * (1.0 - vAge);
  if (a < 0.004) discard;
  o = vec4(uSpark * a, a);
}
`;

function compile(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(prog, i);
    const name = info.name.replace(/\[0\]$/, "");
    uniforms[name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u: uniforms };
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: true, alpha: false });
    if (!gl) throw new Error("This needs WebGL2, which this browser doesn't offer.");
    this.gl = gl;
    this.canvas = canvas;
    this.flood = !!gl.getExtension("EXT_color_buffer_float");
    this.lines = compile(gl, LINE_VS, LINE_FS);
    this.sparks = compile(gl, SPARK_VS, SPARK_FS);
    this.composite = compile(gl, FULL_VS, COMPOSITE_FS);
    if (this.flood) {
      this.seed = compile(gl, LINE_VS, SEED_FS);
      this.step = compile(gl, FULL_VS, FLOOD_FS);
    }
    this.buffer = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    this.empty = gl.createVertexArray();
    this.n = 0;
    this.ox = 0;
    this.oy = 0;
    this.targets = null;
  }

  /** Take a forest's packed pieces (worker.js). */
  setData({ data, n, ox, oy }) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    this.n = n;
    this.ox = ox;
    this.oy = oy;
  }

  /** Two float textures for flooding, at `scale` of the canvas. */
  ensureTargets(w, h) {
    const gl = this.gl;
    if (this.targets && this.targets.w === w && this.targets.h === h) return this.targets;
    if (this.targets) for (const t of this.targets.tex) gl.deleteTexture(t);
    const tex = [];
    const fbo = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        this.flood = false;
      }
      tex.push(t);
      fbo.push(f);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.targets = { w, h, tex, fbo };
    return this.targets;
  }

  colorUniforms(p, s) {
    const gl = this.gl;
    const pal = PALETTES[s.palette] ?? PALETTES.aurora;
    gl.uniform1i(p.u.uMode, MODES[s.color] ?? 0);
    gl.uniform1i(p.u.uDay, s.paper === "day" ? 1 : 0);
    if (p.u.uPal) gl.uniform3fv(p.u.uPal, pal.flat());
    if (p.u.uSeeds) gl.uniform3fv(p.u.uSeeds, SEED_COLORS[s.paper].flatMap(hex));
    if (p.u.uInk) gl.uniform3fv(p.u.uInk, hex(PAPERS[s.paper].ink));
  }

  viewUniforms(p, cam, W, H, zoomScale = 1) {
    const gl = this.gl;
    gl.uniform2f(p.u.uCenter, cam.x - this.ox, cam.y - this.oy);
    gl.uniform1f(p.u.uZoom, cam.zoom * zoomScale);
    gl.uniform2f(p.u.uView, W, H);
  }

  /**
   * Draw. `cam` is { x, y, zoom } (zoom in CSS pixels per unit); `s` has now,
   * deepest, last, color, palette, paper, effect, glow, width, tips, sparks.
   */
  render(cam, s) {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = s.dpr;
    const z = { ...cam, zoom: cam.zoom * dpr };
    const effect = this.flood ? Math.max(0, EFFECTS.indexOf(s.effect)) : 0;
    const paper = PAPERS[s.paper];
    const half = Math.max(0.5, (s.width * dpr) / 2);

    let scale = 0.5;
    let t = null;
    if (effect > 0 && this.n > 0) {
      const fw = Math.max(1, Math.ceil(W * scale));
      const fh = Math.max(1, Math.ceil(H * scale));
      scale = fw / W;
      t = this.ensureTargets(fw, fh);
      // Seed.
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo[0]);
      gl.viewport(0, 0, fw, fh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      const p = this.seed;
      gl.useProgram(p.prog);
      this.viewUniforms(p, z, fw, fh, scale);
      gl.uniform1f(p.u.uNow, s.now);
      gl.uniform1f(p.u.uHalf, Math.max(0.5, half * scale));
      gl.uniform1f(p.u.uTips, 0);
      gl.uniform1f(p.u.uDeepest, s.deepest);
      gl.uniform1f(p.u.uLast, s.last);
      gl.uniform1i(p.u.uMode, MODES[s.color] ?? 0);
      gl.bindVertexArray(this.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.n);
      // Flood.
      const q = this.step;
      gl.useProgram(q.prog);
      gl.bindVertexArray(this.empty);
      let src = 0;
      let k = 1;
      while (k * 2 < Math.max(fw, fh)) k *= 2;
      const steps = [];
      for (; k >= 1; k >>= 1) steps.push(k);
      steps.push(1); // one more at 1 mends JFA's rare misses
      for (const step of steps) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo[1 - src]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t.tex[src]);
        gl.uniform1i(q.u.uSrc, 0);
        gl.uniform1i(q.u.uStep, step);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        src = 1 - src;
      }
      t.result = src;
    }

    // Composite onto the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    const c = this.composite;
    gl.useProgram(c.prog);
    gl.bindVertexArray(this.empty);
    this.colorUniforms(c, s);
    gl.uniform1i(c.u.uEffect, t ? effect : 0);
    gl.uniform2f(c.u.uView, W, H);
    gl.uniform3fv(c.u.uBg, hex(paper.bg));
    gl.uniform3fv(c.u.uBg2, hex(paper.bg2));
    gl.uniform1f(c.u.uDpr, dpr);
    gl.uniform1f(c.u.uGlow, s.glow);
    gl.uniform1f(c.u.uScale, scale);
    if (t) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t.tex[t.result]);
      gl.uniform1i(c.u.uField, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.n === 0) return;

    // Lines.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const l = this.lines;
    gl.useProgram(l.prog);
    gl.bindVertexArray(this.vao);
    this.viewUniforms(l, z, W, H);
    this.colorUniforms(l, s);
    gl.uniform1f(l.u.uNow, s.now);
    gl.uniform1f(l.u.uHalf, half);
    gl.uniform1f(l.u.uTips, s.tips ? 1 : 0);
    gl.uniform1f(l.u.uDeepest, s.deepest);
    gl.uniform1f(l.u.uLast, s.last);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.n);

    // Sparks where branches are cut.
    if (s.sparks) {
      const k = this.sparks;
      gl.useProgram(k.prog);
      gl.blendFunc(gl.ONE, s.paper === "day" ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
      this.viewUniforms(k, z, W, H);
      gl.uniform1f(k.u.uNow, s.now);
      gl.uniform1f(k.u.uDpr, dpr);
      gl.uniform1f(k.u.uLife, s.sparkLife ?? 0.8);
      gl.uniform3fv(k.u.uSpark, s.paper === "day" ? [0.75, 0.22, 0.12] : [1.0, 0.85, 0.55]);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.n);
    }
    gl.disable(gl.BLEND);
  }
}
