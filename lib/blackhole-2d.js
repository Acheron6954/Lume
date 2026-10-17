// Karadelik açılış animasyonu.
// Aşamalar: (1) yıldızlar + yörüngede dönen disk, (2) karadelik kayarak uzaklaşır,
// onun açtığı daire büyüyüp arkadaki siteyi ortaya çıkarır.
// Framework'e bağımlı değil: sadece bir <canvas> ve geri çağrılar alır.

export const ORBIT_MS = 4800;
export const SLIDE_MS = 2300;

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Diskin içinden dışına renk geçişi: sıcak bej-pembe, mürdüm, lacivert.
const STOPS = [
  [248, 186, 232],
  [214, 96, 200],
  [162, 61, 156],
  [78, 99, 232],
  [40, 56, 170],
];
function ramp(t) {
  const p = clamp(t) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(p));
  const f = p - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f))];
}
function makeSprite(rgb, size = 24) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
  grd.addColorStop(0.3, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},.55)`);
  grd.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onFrame?: (f: {x:number,y:number,r:number,title:number}) => void,
 *           onGo?: () => void, onDone?: () => void }} hooks
 * @returns {{ stop: () => void }}
 */
export function startBlackHole(canvas, hooks = {}) {
  const ctx = canvas.getContext("2d");
  const sprites = Array.from({ length: 24 }, (_, i) => makeSprite(ramp(i / 23)));
  let W = 0;
  let H = 0;
  let dpr = 1;
  let R = 60;
  let stars = [];
  let parts = [];
  let gas = [];
  let ring = [];
  const glow = makeSprite([222, 118, 208], 96);
  let raf = 0;
  let last = 0;
  let clock = 0; // ms, kare süresi sınırlanmış sayaç
  let went = false;
  let finished = false;

  function build() {
    const phone = W < 600;
    R = Math.min(W, H) * 0.1;
    const n = phone ? 1500 : 2900;
    stars = Array.from({ length: phone ? 150 : 280 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.4 + Math.random() * 1.2,
      ph: Math.random() * TAU,
      sp: 0.6 + Math.random() * 1.8,
    }));
    parts = Array.from({ length: n }, () => {
      const q = Math.pow(Math.random(), 1.7);
      const r = 1.45 + q * 3.55; // yarıçap, R biriminde
      return {
        r,
        a: Math.random() * TAU,
        w: 1.6 * Math.pow(1.6 / r, 1.5),
        size: (0.7 + Math.random() * 1.7) * (phone ? 0.95 : 1.15),
        t: q,
        yj: (Math.random() - 0.5) * 0.07 * (0.4 + q),
      };
    });
    // Gaz bulutu: büyük, silik parıltılar. Diski noktalı değil sürekli gösterir.
    gas = Array.from({ length: phone ? 110 : 210 }, () => {
      const q = Math.pow(Math.random(), 1.5);
      const r = 1.5 + q * 3.3;
      return { r, a: Math.random() * TAU, w: 1.6 * Math.pow(1.6 / r, 1.5), t: q, size: 0.7 + Math.random() * 1.1 };
    });
    ring = Array.from({ length: phone ? 460 : 920 }, () => ({
      ang: Math.random() * TAU,
      rr: 1.03 + Math.pow(Math.random(), 2) * 0.32,
      fan: Math.random(), // üstte dışa doğru yelpazelenme payı
      sp: 0.12 + Math.random() * 0.22,
      size: 0.8 + Math.random() * 1.3,
    }));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    build();
  }

  function frame(now) {
    if (finished) return;
    const dtMs = last ? Math.min(50, now - last) : 16;
    last = now;
    clock += dtMs;
    const dt = dtMs / 1000;
    const t = clock;

    const slideP = clamp((t - ORBIT_MS) / SLIDE_MS);
    const s = easeInOut(slideP);
    const push = 1 + 0.14 * clamp(t / ORBIT_MS); // yavaş yaklaşma
    const entry = clamp(t / 900);
    const spin = 1 + 5 * s;

    // Karadelik merkezi: ekranın ortası, sonra sol alta doğru kıvrılarak kayar.
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
    const cx = hp.x;
    const cy = hp.y;
    const k = hp.sc * push;
    const Rk = R * k;
    const master = 1 - clamp((slideP - 0.7) / 0.3);
    const tilt = -0.2;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const flat = 0.28;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    // Yıldızlar
    const starA = entry * (1 - clamp(slideP / 0.55));
    if (starA > 0.01) {
      ctx.fillStyle = "#f5ede0";
      for (const st of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * 0.001 * st.sp + st.ph);
        ctx.globalAlpha = starA * tw * 0.9;
        const sx = st.x * W + (st.x - 0.5) * W * 0.08 * (push - 1) * 6;
        const sy = st.y * H + (st.y - 0.5) * H * 0.08 * (push - 1) * 6;
        ctx.fillRect(sx, sy, st.s, st.s);
      }
    }

    // Dış parıltı
    let g = ctx.createRadialGradient(cx, cy, Rk * 0.9, cx, cy, Rk * 3.6);
    g.addColorStop(0, "rgba(214,107,200,.50)");
    g.addColorStop(0.32, "rgba(110,36,120,.26)");
    g.addColorStop(0.7, "rgba(30,44,140,.10)");
    g.addColorStop(1, "rgba(10,15,46,0)");
    ctx.globalAlpha = master * entry;
    ctx.fillStyle = g;
    ctx.fillRect(cx - Rk * 3.7, cy - Rk * 3.7, Rk * 7.4, Rk * 7.4);

    // Parçacık konumları
    const drawParts = (front) => {
      for (const p of parts) {
        const ang = p.a;
        const sn = Math.sin(ang);
        if (sn >= 0 !== front) continue;
        const rr = p.r * R * k;
        const ux = Math.cos(ang) * rr;
        const uy = (sn * flat * p.r * R + p.yj * R) * k;
        const x = cx + ux * cosT - uy * sinT;
        const y = cy + ux * sinT + uy * cosT;
        const dop = 0.5 + 0.65 * (0.5 - 0.5 * Math.cos(ang)); // sol taraf daha parlak
        const al = dop * (0.26 + 0.5 * (1 - p.t)) * master * entry;
        if (al < 0.02) continue;
        ctx.globalAlpha = Math.min(1, al);
        const sz = p.size * 5.2 * Math.sqrt(k);
        ctx.drawImage(sprites[(p.t * 23) | 0], x - sz / 2, y - sz / 2, sz, sz);
      }
    };

    // Kayarken arkada kalan ışık izi
    if (s > 0.02) {
      for (let i = 1; i <= 9; i++) {
        const tp = holeAt(Math.max(0, s - i * 0.028));
        ctx.globalAlpha = 0.2 * (1 - i / 10) * master;
        const gz = Rk * (4.2 - i * 0.22);
        ctx.drawImage(glow, tp.x - gz / 2, tp.y - gz / 2, gz, gz);
      }
    }

    // Gaz bulutu (disk boyunca sürekli parıltı)
    const drawGas = (front) => {
      for (const p of gas) {
        const sn = Math.sin(p.a);
        if (sn >= 0 !== front) continue;
        const rr = p.r * R * k;
        const ux = Math.cos(p.a) * rr;
        const uy = sn * flat * p.r * R * k;
        const x = cx + ux * cosT - uy * sinT;
        const y = cy + ux * sinT + uy * cosT;
        const dop = 0.5 + 0.6 * (0.5 - 0.5 * Math.cos(p.a));
        ctx.globalAlpha = Math.min(1, dop * (0.07 + 0.17 * (1 - p.t)) * master * entry);
        const sz = Rk * (0.5 + p.size * 0.5);
        ctx.drawImage(sprites[(p.t * 23) | 0], x - sz / 2, y - sz / 2, sz, sz);
      }
    };

    ctx.globalCompositeOperation = "lighter";
    drawGas(false);
    drawParts(false); // diskin arka yarısı

    // Kütleçekim merceği: deliğin üstünden ve altından kıvrılan ışık
    for (const q of ring) {
      const ang = q.ang;
      const v = -Math.sin(ang);
      const w = 0.12 + (v > 0 ? Math.pow(v, 0.9) : 0.5 * Math.pow(-v, 1.1));
      const rr = q.rr * Rk * (1 + (v > 0 ? 0.5 * v * v * q.fan : 0.25 * v * v * q.fan));
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr * 0.97;
      ctx.globalAlpha = Math.min(1, w * 0.85) * master * entry;
      const sz = q.size * 4.6 * Math.sqrt(k);
      ctx.drawImage(sprites[((0.15 + 0.35 * Math.abs(Math.cos(ang))) * 23) | 0], x - sz / 2, y - sz / 2, sz, sz);
    }

    // Olay ufku
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = master * entry;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx, cy, Rk, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(1, Rk * 0.03);
    ctx.strokeStyle = "rgba(255,222,244,.95)";
    ctx.shadowColor = "rgba(222,118,208,.95)";
    ctx.shadowBlur = Rk * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, Rk * 1.012, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "lighter";
    drawGas(true);
    drawParts(true); // diskin ön yarısı deliğin önünden geçer
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // Hareket
    for (const p of parts) p.a = (p.a + p.w * dt * spin) % TAU;
    for (const p of gas) p.a = (p.a + p.w * dt * spin) % TAU;
    for (const q of ring) q.ang = (q.ang + q.sp * dt * spin) % TAU;

    // Başlık: 1.1 sn'de belirir, kayma başlarken söner
    const title = clamp((t - 1100) / 1500) * (1 - clamp(slideP / 0.35));

    // Ortaya çıkış dairesi: deliğin merkezinden büyür
    const maxR = Math.hypot(W, H) * 1.5 + 160;
    const r = Math.pow(slideP, 1.8) * maxR;
    if (hooks.onFrame) hooks.onFrame({ x: cx, y: cy, r, title });

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
    },
  };
}
