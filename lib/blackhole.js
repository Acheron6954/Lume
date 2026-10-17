// Karadelik açılış animasyonu (WebGL).
// Her piksel için ışın izleme: ışık Schwarzschild kütleçekimiyle bükülür. Böylece
// diskin deliğin üstünden/altından kıvrılan görüntüsü, foton halkası, Doppler parlaması
// ve merceklenen yıldızlar gerçek fizikten çıkar, elle çizilmez.
// Aşamalar: (1) yıldızlar + dönen disk, (2) karadelik kayarak uzaklaşır,
// onun açtığı daire büyüyüp arkadaki siteyi ortaya çıkarır.
// Framework'e bağımlı değil: sadece bir <canvas> ve geri çağrılar alır.
// WebGL yoksa ya da shader derlenmezse eski 2D sürüme (blackhole-2d.js) düşer.

import { startBlackHole as start2D, ORBIT_MS as ORBIT, SLIDE_MS as SLIDE } from "./blackhole-2d.js";

export const ORBIT_MS = ORBIT;
export const SLIDE_MS = SLIDE;

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const CAM_D = 28; // kamera uzaklığı (olay ufku yarıçapı biriminde)
const CRIT = 2.598; // gölge yarıçapı = 3*sqrt(3)/2 olay ufku yarıçapı

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uCenter;   // deliğin merkezi (render px, y yukarı)
uniform float uRk;       // gölge yarıçapı (render px)
uniform float uTime;     // sn
uniform float uDiskT;    // diskin kendi saati (kayarken hızlanır)
uniform float uMaster;   // genel görünürlük (söner)
uniform float uStarA;    // yıldız görünürlüğü
uniform float uStarS;    // yıldız ızgarası yoğunluğu
uniform vec3  uN;        // disk düzleminin normali
uniform vec3  uE2;       // disk düzleminde ikinci eksen
uniform vec3  uTrail[8]; // kayarken arkada kalan ışık izi (x, y, ağırlık)

#define CAMD ${CAM_D.toFixed(1)}
#define CRIT ${CRIT.toFixed(3)}
#define BMAX 13.5
#define RIN 2.7
#define ROUT 9.5
#define OMEGA 4.5

float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash31(vec3 p){
  p = fract(p * .1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise3(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash31(i), hash31(i + vec3(1.0,0.0,0.0)), f.x);
  float b = mix(hash31(i + vec3(0.0,1.0,0.0)), hash31(i + vec3(1.0,1.0,0.0)), f.x);
  float c = mix(hash31(i + vec3(0.0,0.0,1.0)), hash31(i + vec3(1.0,0.0,1.0)), f.x);
  float d = mix(hash31(i + vec3(0.0,1.0,1.0)), hash31(i + vec3(1.0,1.0,1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
float fbm3(vec3 p){
  float a = .5;
  float s = 0.;
  for (int i = 0; i < 4; i++){
    s += a * vnoise3(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= .5;
  }
  return s;
}

// Diskin içinden dışına: bej-pembe, magenta, mürdüm, mavi, lacivert.
vec3 ramp(float t){
  t = clamp(t, 0., 1.) * 4.;
  vec3 c0 = vec3(.973, .729, .910);
  vec3 c1 = vec3(.839, .376, .784);
  vec3 c2 = vec3(.635, .239, .612);
  vec3 c3 = vec3(.306, .388, .910);
  vec3 c4 = vec3(.157, .220, .667);
  if (t < 1.) return mix(c0, c1, t);
  if (t < 2.) return mix(c1, c2, t - 1.);
  if (t < 3.) return mix(c2, c3, t - 2.);
  return mix(c3, c4, t - 3.);
}

vec3 starLayer(vec2 ll, float S, float thr, float sz, float seed){
  vec2 g = ll * S;
  vec2 id = floor(g);
  vec2 f = fract(g);
  vec3 hh = vec3(hash21(id + seed), hash21(id * 1.7 + seed + 3.1), hash21(id * 2.3 + seed + 9.4));
  if (hh.x < thr) return vec3(0.);
  vec2 sp = .25 + .5 * hh.yz;
  vec2 d = f - sp;
  float core = exp(-dot(d, d) / (sz * sz));
  float br = pow(hash21(id + seed + 21.), 3.) * 1.5 + .18;
  float tw = .72 + .28 * sin(uTime * (.8 + hh.y * 2.2) + hh.z * 40.);
  vec3 tint = mix(vec3(1., .93, .86), mix(vec3(1., .62, .9), vec3(.6, .72, 1.), hh.z), step(.6, hh.y));
  return tint * core * br * tw;
}

vec3 background(vec3 d){
  float lat = asin(clamp(d.y, -1., 1.));
  float lon = atan(d.x, -d.z);
  vec2 ll = vec2(lon * cos(lat), lat);
  vec3 s = starLayer(ll, uStarS, .86, .13, 0.) * 1.15
         + starLayer(ll, uStarS * 2.15, .90, .15, 17.) * .6;
  // uzak bulutsu: lensin içinden geçtiği için halkanın etrafında kıvrılır
  vec3 q = d * 3.2;
  float n = vnoise3(q) * .6 + vnoise3(q * 2.1 + 7.) * .4;
  float m = vnoise3(q * 1.7 + vec3(3., 1., 9.));
  float c = smoothstep(.38, .88, n) * .55 + smoothstep(.5, .92, m) * .3;
  vec3 neb = mix(vec3(.30, .10, .42), vec3(.10, .17, .55), smoothstep(.3, .75, m)) * c * .17;
  return s * uStarA + neb * (.35 + .65 * uStarA);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 pc = (frag - uCenter) / uRk;
  float sd = length(pc);

  // Diski ekranda hafif eğik tut (eski tasarımdaki gibi).
  vec2 q = vec2(0.98007 * pc.x + 0.19867 * pc.y, -0.19867 * pc.x + 0.98007 * pc.y);
  vec2 b2 = q * CRIT;
  float bl = length(b2);

  vec3 vel = normalize(vec3(b2, -CAMD));
  vec3 col = vec3(0.);
  float T = 1.;
  bool cap = false;

  if (bl > BMAX){
    // Uzak ışınlar: zayıf alan sapması yeter.
    float al = 2. / bl + 2.945 / (bl * bl);
    vel = normalize(vel + vec3(-b2 / bl * al, 0.));
  } else {
    vec3 pos = vec3(0., 0., CAMD);
    vec3 L = cross(pos, vel);
    float h2 = dot(L, L);
    float hPrev = dot(pos, uN);
    int nc = 0;
    for (int i = 0; i < 150; i++){
      float r2 = dot(pos, pos);
      float r = sqrt(r2);
      if (r < 1.0){ cap = true; break; }
      if (r > 26. && dot(pos, vel) > 0.) break;
      if (T < 0.015) break;
      float dt = clamp(.04 + .085 * (r - 1.), .04, 1.4);

      // Foton halkası: deliğin etrafında dolanan ışık
      float gr = (r - 1.5) / .17;
      col += T * vec3(1., .74, .96) * exp(-gr * gr) * dt * .13;

      // Diskin üstündeki ve altındaki ince gaz sisi
      float hh = dot(pos, uN);
      float rho0 = length(pos - hh * uN);
      if (rho0 > RIN - .5 && rho0 < ROUT + 1.){
        float sig = .10 + .045 * rho0;
        if (abs(hh) < 4. * sig){
          float dens = exp(-hh * hh / (2. * sig * sig));
          float edge = smoothstep(RIN - .5, RIN + .4, rho0) * (1. - smoothstep(ROUT - 3., ROUT + 1., rho0));
          float hz = dens * pow(RIN / max(rho0, RIN), 1.6) * edge;
          col += T * ramp(.1 + .6 * (rho0 - RIN) / (ROUT - RIN)) * hz * dt * .07;
        }
      }

      vec3 acc = -1.5 * h2 * pos / (r2 * r2 * r);
      vel = normalize(vel + acc * dt);
      vec3 np = pos + vel * dt;

      float hNow = dot(np, uN);
      if (hPrev * hNow < 0. && nc < 4){
        nc++;
        float tt = hPrev / (hPrev - hNow);
        vec3 pc3 = mix(pos, np, tt);
        float rho = length(pc3);
        if (rho > RIN - .3 && rho < ROUT + 1.5){
          vec3 rad = pc3 / rho;
          float phi = atan(dot(pc3, uE2), dot(pc3, vec3(1., 0., 0.)));
          float om = OMEGA * pow(rho, -1.5);
          float ph0 = phi - om * uDiskT;

          // Alan bükme: şeritleri düzenli halkalar yerine akan gaz gibi dalgalandırır
          float wn = vnoise3(vec3(cos(ph0) * 1.3, sin(ph0) * 1.3, rho * 1.1) + 3.) - .5;
          float ph = ph0 + wn * 1.1;
          float ca = cos(ph);
          float sa = sin(ph);

          // Gaz dokusu: halka boyunca uzayan şeritler, ince taneler, kıvrılan kollar
          float n1 = fbm3(vec3(ca * 2.2, sa * 2.2, rho * 2.1 + wn * 2.));
          float n2 = vnoise3(vec3(ca * 6., sa * 6., rho * 6.) + 5.);
          float spark = smoothstep(.80, .96, vnoise3(vec3(ca * 17., sa * 17., rho * 19.) + 11.));
          float arms = .5 + .5 * sin(2. * ph + 3.5 * log(rho));
          float turb = n1 * 1.2 + n2 * .4 + arms * .22;
          float rings = .93 + .07 * sin(rho * 21. + n1 * 9.);

          float inner = smoothstep(RIN - .25, RIN + .45, rho);
          float outer = 1. - smoothstep(ROUT - 3.5, ROUT, rho);
          float E0 = 2.8 * pow(RIN / max(rho, RIN), 1.9);
          float gas = .12 + 1.9 * smoothstep(.18, .95, turb);
          float E = (E0 * gas * rings + spark * 1.9 * pow(RIN / rho, 1.)) * inner * outer;

          // Doppler: bize gelen taraf parlak ve pembe, giden taraf sönük ve mavi
          vec3 vd = cross(uN, rad);
          float beta = clamp(sqrt(.5 / max(rho - 1., .3)), 0., .6);
          float g = sqrt(1. - beta * beta) / (1. - beta * dot(vd, -vel));
          g *= sqrt(max(1. - 1. / rho, .05));
          float boost = pow(max(g, .05), 1.8);

          float tc = pow(clamp((rho - RIN) / (ROUT - RIN), 0., 1.), .75) + (1. - g) * .22 + (n1 - .5) * .18;
          col += T * ramp(tc) * E * boost;

          float a = clamp((.55 + .4 * turb) * inner * outer, 0., .95);
          T *= 1. - a;
        }
      }
      hPrev = hNow;
      pos = np;
    }
  }

  if (!cap) col += T * background(vel);

  // Dış parıltı ve diskin ışık sızıntısı
  float outside = smoothstep(.92, 1.25, sd);
  col += vec3(.84, .38, .78) * .16 * exp(-max(sd - 1., 0.) * 1.05) * outside;
  float spillE = exp(-(q.x * q.x / 11. + q.y * q.y / 1.3));
  col += mix(vec3(.45, .18, .62), vec3(.2, .28, .85), smoothstep(0., 3.5, abs(q.x))) * .2 * spillE * outside;

  // Kayarken arkada kalan ışık izi
  for (int i = 0; i < 8; i++){
    vec3 tr = uTrail[i];
    float d = length(frag - tr.xy) / (uRk * 1.7);
    col += vec3(.87, .46, .82) * tr.z * exp(-d * d * 2.) * .5;
  }

  col = vec3(1.) - exp(-col * 1.15);
  float lum = max(max(col.r, col.g), col.b);
  float a = cap ? 1. : clamp(lum, 0., 1.);
  gl_FragColor = vec4(col, a) * uMaster;
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[blackhole] shader derlenemedi:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
function link(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[blackhole] program bağlanamadı:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

let probed = null;
// Gerçek canvas'ı WebGL'e kilitlemeden önce shader'ın derlendiğini ayrı bir canvas'ta dene.
function webglOk() {
  if (probed !== null) return probed;
  probed = false;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    const gl = c.getContext("webgl");
    if (gl) {
      const p = link(gl);
      probed = !!p;
      if (p) gl.deleteProgram(p);
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
  } catch {
    probed = false;
  }
  return probed;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onFrame?: (f: {x:number,y:number,r:number,title:number}) => void,
 *           onGo?: () => void, onDone?: () => void }} hooks
 * @returns {{ stop: () => void }}
 */
export function startBlackHole(canvas, hooks = {}) {
  // Telefonlarda ışın izleme shader'ı yerine hafif 2D sürüm çalışır: iPhone'da sayfa belleği ve GPU
  // sınırı düşük, ağır shader + sayfa birlikte Safari'yi çökertebiliyor ("birçok kez sorun oluştu").
  if (window.innerWidth < 700) return start2D(canvas, hooks);

  let gl = null;
  if (webglOk()) {
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });
    } catch {
      gl = null;
    }
  }
  const prog = gl ? link(gl) : null;
  if (!gl || !prog) return start2D(canvas, hooks);

  const loc = (n) => gl.getUniformLocation(prog, n);
  const U = {
    center: loc("uCenter"),
    rk: loc("uRk"),
    time: loc("uTime"),
    diskT: loc("uDiskT"),
    master: loc("uMaster"),
    starA: loc("uStarA"),
    starS: loc("uStarS"),
    n: loc("uN"),
    e2: loc("uE2"),
    trail: loc("uTrail[0]"),
  };
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  const trail = new Float32Array(24);
  let W = 0; // css px
  let H = 0;
  let scale = 1; // render px / css px
  let scaleMul = 1;
  let R = 60;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let diskT = 0;
  let went = false;
  let finished = false;
  let ema = 16;
  let frames = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    const phone = W < 600;
    const maxPx = phone ? 0.65e6 : 1.7e6;
    scale = dpr * scaleMul;
    if (W * H * scale * scale > maxPx) scale = Math.sqrt(maxPx / (W * H));
    canvas.width = Math.max(2, Math.round(W * scale));
    canvas.height = Math.max(2, Math.round(H * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    R = Math.min(W, H) * 0.1;
    // Yıldız ızgarası: ekranda ~13 px'lik hücreler
    gl.uniform1f(U.starS, (CAM_D * R * scale) / CRIT / (13 * scale));
  }

  function onLost(e) {
    e.preventDefault();
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    if (!went) {
      went = true;
      if (hooks.onGo) hooks.onGo();
    }
    if (hooks.onDone) hooks.onDone();
  }
  canvas.addEventListener("webglcontextlost", onLost);

  function frame(now) {
    if (finished) return;
    const raw = last ? Math.min(100, now - last) : 16;
    const dtMs = Math.min(50, raw);
    last = now;
    clock += dtMs;
    const dt = dtMs / 1000;
    const t = clock;

    // Cihaz yavaşsa çözünürlüğü düşür.
    ema = ema * 0.92 + raw * 0.08;
    if (++frames > 24 && ema > 30 && scaleMul > 0.45) {
      scaleMul *= 0.78;
      frames = 0;
      ema = 16;
      resize();
    }

    const slideP = clamp((t - ORBIT_MS) / SLIDE_MS);
    const s = easeInOut(slideP);
    const push = 1 + 0.14 * clamp(t / ORBIT_MS);
    const entry = clamp(t / 900);
    const spin = 1 + 5 * s;
    diskT += dt * spin;

    const cx0 = W * 0.5;
    const cy0 = H * 0.47;
    const holeAt = (u) => {
      if (u <= 0) return { x: cx0, y: cy0, sc: 1 };
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      return {
        x: a * cx0 + b * W * 0.2 + c * -W * 0.22,
        y: a * cy0 + b * H * 0.1 + c * H * 1.18,
        sc: 1 - 0.7 * u,
      };
    };
    const hp = holeAt(s);
    const k = hp.sc * push;
    const Rk = R * k;
    const master = 1 - clamp((slideP - 0.7) / 0.3);
    const starA = entry * (1 - clamp(slideP / 0.55));

    // Kamera hafifçe nefes alır: disk düzlemine bakış açısı yavaşça sallanır.
    const elev = 0.24 + 0.022 * Math.sin(t * 0.00036 * TAU);
    const ce = Math.cos(elev);
    const se = Math.sin(elev);

    gl.uniform2f(U.center, hp.x * scale, (H - hp.y) * scale);
    gl.uniform1f(U.rk, Rk * scale);
    gl.uniform1f(U.time, t * 0.001);
    gl.uniform1f(U.diskT, diskT);
    gl.uniform1f(U.master, master * entry);
    gl.uniform1f(U.starA, starA);
    gl.uniform3f(U.n, 0, ce, se);
    gl.uniform3f(U.e2, 0, se, -ce);

    trail.fill(0);
    if (s > 0.02) {
      for (let i = 1; i <= 8; i++) {
        const tp = holeAt(Math.max(0, s - i * 0.034));
        trail[(i - 1) * 3] = tp.x * scale;
        trail[(i - 1) * 3 + 1] = (H - tp.y) * scale;
        trail[(i - 1) * 3 + 2] = 0.2 * (1 - i / 10) * master;
      }
    }
    gl.uniform3fv(U.trail, trail);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const title = clamp((t - 1100) / 1500) * (1 - clamp(slideP / 0.35));
    const maxR = Math.hypot(W, H) * 1.5 + 160;
    const r = Math.pow(slideP, 1.8) * maxR;
    if (hooks.onFrame) hooks.onFrame({ x: hp.x, y: hp.y, r, title });

    if (!went && slideP > 0.42) {
      went = true;
      if (hooks.onGo) hooks.onGo();
    }
    if (slideP >= 1) {
      finished = true;
      if (hooks.onDone) hooks.onDone();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onLost);
      try {
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      } catch {}
    },
  };
}
