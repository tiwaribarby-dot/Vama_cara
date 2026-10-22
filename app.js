'use strict';

/* ==========================================================================
   VAMA CARA — Video Ad Creator, version 2
   (Version 1 is kept untouched as index_v1_original.html / app_v1_original.js)
   Everything you are likely to edit is in CONFIG.
   ========================================================================== */
const CONFIG = {
  // Model photos, relative to index.html. Order = shot order below.
  images: [
    'sale/image_1.jpg',
    'sale/image_2.jpg',
    'sale/image_3.jpg',
    'sale/image_4.jpg',
    'sale/image_5.jpg',
  ],

  // Official logo, used exactly as supplied (never redrawn or re-typeset).
  // mode 'plate'    : original black artwork on a light plate (pixels unchanged)
  // mode 'reversed' : same artwork recoloured light for dark backgrounds
  logo: { path: 'sale/Vama_Cara_TM_Logo.png', mode: 'plate', plateColor: '#f5f0e4' },

  music: { path: 'sale/music.mp3', volume: 0.5, fadeIn: 1.5, fadeOut: 2.5 },

  fps: 30,
  holdEndMs: 600,

  resolutions: {
    '1080': { w: 1920, h: 1080, bitrate: 10_000_000 },
    '720': { w: 1280, h: 720, bitrate: 5_000_000 },
  },
  preview: { w: 960, h: 540, fps: 30 },

  filenamePrefix: 'VAMA-CARA-Export-Edition-v2',

  // Seconds. Shots overlap: each one dissolves in while the previous is still moving.
  timeline: {
    shotsStart: 3.5, // when the first shot begins to dissolve in
    step: 3.3,       // time between one shot starting and the next
    fade: 0.9,       // dissolve length between shots
    endFade: 1.0,    // dissolve into the end card
    endDur: 5.0,     // end card length
  },

  fontSerif: '"Cormorant Garamond","Playfair Display",Didot,"Bodoni 72",Georgia,"Noto Serif","Times New Roman",serif',

  fontSans: 'system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',

  colors: { ink: '#050403', gold: '#c9a96a', goldLight: '#ead9ae', goldDeep: '#8f7440', ivory: '#f4efe4' },

  // Short, supportable text only. No prices, discounts or performance claims.
  copy: {
    edition: 'EXPORT EDITION',
    introHeadline: 'Luxury Without the Markup.',
    endHeadline: 'Discover Your Signature Style.',
    endLine: 'Discover the VAMA CARA Collection',
    contactLine: '',
  },

  // `feature` is a short on-photo caption (like the feature callouts in marketplace product videos).
  // It is EMPTY on purpose: fill each one with wording copied from the product page's A+ content and
  // description, so every claim in the video matches the listing. Empty = no caption is drawn.
  // `lines` is the brand tagline beside the photo; set it to [] to remove it.

  // Camera move per shot. Positions are fractions of the photo (0..1, from top-left).
  // The camera starts on the whole photo and slowly pushes in to `to`. Defaults are a gentle,
  // safe push toward the centre because the photos were not available when this was written.
  // For a collar or button close-up, tap that spot in the Camera framing panel on the page.
  // You can also set these on the page with the Camera framing panel (saved on this device).
  shots: [
    { image: 0, label: 'Gentle push-in', lines: ['Refined Style.'], feature: '', motion: { to: { x: 0.5, y: 0.42, z: 1.12 } } },
    { image: 1, label: 'Gentle push-in', lines: ['Everyday', 'Confidence.'], feature: '', motion: { to: { x: 0.5, y: 0.42, z: 1.12 } } },
    { image: 2, label: 'Gentle push-in', lines: ['Look Closer.'], feature: '', motion: { to: { x: 0.5, y: 0.42, z: 1.12 } } },
    { image: 3, label: 'Gentle push-in', lines: ['Premium Style.'], feature: '', motion: { to: { x: 0.5, y: 0.42, z: 1.12 } } },
    { image: 4, label: 'Gentle push-in', lines: ['Accessible', 'Luxury.'], feature: '', motion: { to: { x: 0.5, y: 0.42, z: 1.12 } } },
  ],
};

/* ==========================================================================
   Helpers
   ========================================================================== */
const C = CONFIG.colors;
const SERIF = CONFIG.fontSerif;

// Layers: intro, one per shot, end card. Later layers dissolve in over earlier ones.
const LAYERS = (() => {
  const T = CONFIG.timeline;
  const n = CONFIG.shots.length;
  const layers = [{ type: 'intro', start: 0, end: T.shotsStart + T.fade, fade: 0 }];
  CONFIG.shots.forEach((s, i) => {
    const start = T.shotsStart + i * T.step;
    const last = i === n - 1;
    layers.push({ type: 'shot', index: i, start, end: start + T.step + (last ? T.endFade : T.fade), fade: T.fade });
  });
  const endStart = T.shotsStart + n * T.step;
  layers.push({ type: 'end', start: endStart, end: endStart + T.endDur, fade: T.endFade });
  return layers;
})();
const TOTAL = LAYERS[LAYERS.length - 1].end;
const POSTER_T = 2.9;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoother = (t) => t * t * t * (t * (6 * t - 15) + 10);
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const el = (id) => document.getElementById(id);

function fmtTime(s) {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function fmtBytes(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

/* ---------- Canvas drawing helpers ---------- */
function setFont(ctx, size, { weight = 500, italic = false } = {}) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${SERIF}`;
}
function trackedWidth(ctx, text, track) {
  const chars = [...text];
  let w = 0;
  for (const ch of chars) w += ctx.measureText(ch).width;
  return w + track * (chars.length - 1);
}
function drawTracked(ctx, text, x, y, track, align = 'left') {
  const chars = [...text];
  const total = trackedWidth(ctx, text, track);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
  return total;
}
function reveal(t, start, dur = 0.8) {
  const e = easeOut(seg(t, start, start + dur));
  return { a: e, dy: (1 - e) * 20 };
}
function drawCover(ctx, img, dx, dy, dw, dh, zoom = 1, fx = 0.5, fy = 0.5) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(dw / iw, dh / ih) * zoom;
  const sw = dw / scale;
  const sh = dh / scale;
  ctx.drawImage(img, (iw - sw) * fx, (ih - sh) * fy, sw, sh, dx, dy, dw, dh);
}
function makeBlur(img) {
  const mid = document.createElement('canvas');
  mid.width = 256; mid.height = 144;
  const mx = mid.getContext('2d');
  mx.imageSmoothingQuality = 'high';
  drawCover(mx, img, 0, 0, 256, 144, 1.15, 0.5, 0.4);
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(mid, 0, 0, 64, 36);
  return c;
}

/* ---------- Logo preparation ----------
   The supplied PNG has large white margins. We trim the margins by copying the
   exact pixels of the artwork (no scaling, no redraw) so its proportions are
   untouched. 'reversed' is the same shapes recoloured light, built from the
   artwork's own darkness as the alpha channel. */
function prepareLogo(img) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const src = document.createElement('canvas');
  src.width = iw; src.height = ih;
  const sx = src.getContext('2d', { willReadFrequently: true });
  sx.drawImage(img, 0, 0);
  const data = sx.getImageData(0, 0, iw, ih).data;
  let minX = iw, minY = ih, maxX = -1, maxY = -1;
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const i = (y * iw + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (data[i + 3] > 20 && lum < 235) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('The logo file looks blank');
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(src, minX, minY, w, h, 0, 0, w, h);

  const reversed = document.createElement('canvas');
  reversed.width = w; reversed.height = h;
  const rx = reversed.getContext('2d', { willReadFrequently: true });
  rx.drawImage(canvas, 0, 0);
  const id = rx.getImageData(0, 0, w, h);
  for (let i = 0; i < id.data.length; i += 4) {
    const lum = (id.data[i] + id.data[i + 1] + id.data[i + 2]) / 3;
    const a = ((255 - lum) / 255) * (id.data[i + 3] / 255);
    id.data[i] = 244; id.data[i + 1] = 239; id.data[i + 2] = 228;
    id.data[i + 3] = Math.round(a * 255);
  }
  rx.putImageData(id, 0, 0);
  return { canvas, reversed, aspect: w / h };
}

/* ==========================================================================
   Renderer: a pure function of time, so preview and export look identical
   ========================================================================== */
function makeFx(ctx, W, H) {
  const vignette = document.createElement('canvas');
  vignette.width = W; vignette.height = H;
  const vx = vignette.getContext('2d');
  const g = vx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  vx.fillStyle = g;
  vx.fillRect(0, 0, W, H);

  const grains = [];
  for (let k = 0; k < 3; k++) {
    const c = document.createElement('canvas');
    c.width = 192; c.height = 192;
    const x = c.getContext('2d');
    const id = x.createImageData(192, 192);
    for (let i = 0; i < id.data.length; i += 4) {
      const n = Math.random() * 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = n;
      id.data[i + 3] = 14;
    }
    x.putImageData(id, 0, 0);
    grains.push(ctx.createPattern(c, 'repeat'));
  }
  return { vignette, grains };
}
function makeRenderer(ctx, W, H) {
  return { ctx, W, H, u: H / 1080, fx: makeFx(ctx, W, H), frame: 0 };
}

function drawBackdrop(R, p = 1) {
  const { ctx, W, H } = R;
  const g = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, H * 0.95);
  g.addColorStop(0, '#1d1710');
  g.addColorStop(0.55, '#0d0a07');
  g.addColorStop(1, C.ink);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const b = ctx.createRadialGradient(W / 2, H * 0.40, 0, W / 2, H * 0.40, H * 0.6);
  b.addColorStop(0, `rgba(201,169,106,${0.10 * p})`);
  b.addColorStop(1, 'rgba(201,169,106,0)');
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* Official logo. Uniform scale only, so proportions are never changed. */
function drawLogo(R, cx, cy, plateW, alpha, scale = 1) {
  const { ctx, u } = R;
  const L = state.logo;
  if (!L || alpha <= 0) return { w: plateW, h: 0 };
  const logoW = plateW * 0.86;
  const logoH = logoW / L.aspect;
  const padY = logoH * 0.55;
  const plateH = logoH + padY * 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = 'high';
  if (CONFIG.logo.mode === 'reversed') {
    ctx.drawImage(L.reversed, -logoW / 2, -logoH / 2, logoW, logoH);
  } else {
    ctx.fillStyle = CONFIG.logo.plateColor;
    ctx.fillRect(-plateW / 2, -plateH / 2, plateW, plateH);
    ctx.globalCompositeOperation = 'multiply'; // white margin of the artwork melts into the plate; black ink stays black
    ctx.drawImage(L.canvas, -logoW / 2, -logoH / 2, logoW, logoH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = C.gold;
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = Math.max(1, 1.6 * u);
    ctx.strokeRect(-plateW / 2 - 14 * u, -plateH / 2 - 14 * u, plateW + 28 * u, plateH + 28 * u);
  }
  ctx.restore();
  return { w: plateW, h: plateH };
}

/* Camera move: uniform crop of the photo, so the model and shirt are never stretched. */
function drawFocus(ctx, img, x, y, w, h, to, p) {
  const e = smoother(clamp(p));
  const z = lerp(1, to.z, e);
  const fx = lerp(0.5, to.x, e);
  const fy = lerp(0.5, to.y, e);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const sw = iw / z, sh = ih / z;
  const sx = clamp(fx * iw - sw / 2, 0, iw - sw);
  const sy = clamp(fy * ih - sh / 2, 0, ih - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawPanel(R, img, cx, cy, maxW, maxH, to, p, alpha) {
  const { ctx, u } = R;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = Math.min(maxW / iw, maxH / ih);
  const w = iw * s, h = ih * s;
  const x = cx - w / 2, y = cy - h / 2;

  ctx.save();
  ctx.fillStyle = '#000';
  for (let i = 6; i >= 1; i--) {
    ctx.globalAlpha = alpha * 0.07;
    ctx.fillRect(x - i * 9 * u, y - i * 5 * u + 22 * u, w + i * 18 * u, h + i * 12 * u);
  }
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  drawFocus(ctx, img, x, y, w, h, to, p);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha * 0.75;
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = Math.max(1, 1.6 * u);
  ctx.strokeRect(x - 16 * u, y - 16 * u, w + 32 * u, h + 32 * u);
  ctx.restore();
  return { x, y, w, h };
}

function lightSweep(ctx, r, p, alpha) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const band = r.w * 0.55;
  const x = lerp(r.x - band, r.x + r.w + band, easeInOut(p));
  const g = ctx.createLinearGradient(x - band / 2, r.y, x + band / 2, r.y + r.h * 0.35);
  g.addColorStop(0, 'rgba(233,214,168,0)');
  g.addColorStop(0.5, `rgba(233,214,168,${0.10 * alpha})`);
  g.addColorStop(1, 'rgba(233,214,168,0)');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/* One shot: blurred backdrop of the same photo, framed photo with the camera move,
   and one short headline on the left. Same layout for every shot so dissolves stay clean. */
function drawShotLayer(R, index, local, presence, A) {
  const { ctx, W, H, u } = R;
  const T = CONFIG.timeline;
  const shot = CONFIG.shots[index];
  const asset = state.images[shot.image];
  if (!asset) return;

  ctx.save();
  ctx.globalAlpha = A;
  ctx.drawImage(asset.blur, 0, 0, W, H);
  ctx.fillStyle = 'rgba(5,4,3,0.74)';
  ctx.fillRect(0, 0, W, H);

  const cx = W * 0.70, cy = H * 0.5;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.62);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  g.addColorStop(0, `rgba(201,169,106,${0.13 * A})`);
  g.addColorStop(1, 'rgba(201,169,106,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const p = clamp(local / presence);
  const r = drawPanel(R, asset.img, cx, cy, W * 0.40, H * 0.80, shot.motion.to, p, A);
  lightSweep(ctx, r, seg(local, 0.8, 3.0), A);

  // headline
  const x = W * 0.08, colW = W * 0.40;
  const lines = shot.lines;
  let size = 100 * u;
  setFont(ctx, size, { weight: 500 });
  const widest = lines.length ? Math.max(...lines.map((l) => ctx.measureText(l).width)) : 0;
  if (widest > colW) size *= colW / widest;
  setFont(ctx, size, { weight: 500 });
  const lineH = size * 1.14;
  const total = lineH * lines.length + 46 * u;
  let y = H / 2 - total / 2;
  const out = 1 - seg(local, T.step - 0.1, T.step + 0.5); // text clears before the next shot's text arrives

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    const rv = reveal(local, 0.55 + i * 0.2);
    ctx.globalAlpha = A * rv.a * out;
    ctx.fillStyle = C.ivory;
    ctx.fillText(line, x, y + size * 0.9 + rv.dy * u);
    y += lineH;
  });
  if (lines.length) {
    const rr = reveal(local, 0.55 + lines.length * 0.2, 0.9);
    ctx.globalAlpha = A * rr.a * out;
    ctx.fillStyle = C.gold;
    ctx.fillRect(x, y + 14 * u, 110 * u * rr.a, Math.max(2, 3 * u));
  }

  // feature caption over the bottom of the photo (only if you filled it in)
  if (shot.feature) {
    const fr = reveal(local, 1.0, 0.8);
    const fa = A * fr.a * out;
    if (fa > 0.002) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      const gh = r.h * 0.26;
      const gg = ctx.createLinearGradient(0, r.y + r.h - gh, 0, r.y + r.h);
      gg.addColorStop(0, 'rgba(5,4,3,0)');
      gg.addColorStop(1, 'rgba(5,4,3,0.72)');
      ctx.globalAlpha = fa;
      ctx.fillStyle = gg;
      ctx.fillRect(r.x, r.y + r.h - gh, r.w, gh);
      ctx.restore();

      let fs = 40 * u;
      ctx.font = `500 ${fs}px ${CONFIG.fontSans}`;
      const tw = ctx.measureText(shot.feature).width;
      if (tw > r.w * 0.88) fs *= (r.w * 0.88) / tw;
      ctx.font = `500 ${fs}px ${CONFIG.fontSans}`;
      ctx.globalAlpha = fa;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(shot.feature, r.x + r.w / 2, r.y + r.h - 34 * u + fr.dy * u);
    }
  }
  ctx.restore();
}

function drawIntroLayer(R, t, cover) {
  const { ctx, W, H, u } = R;
  const copy = CONFIG.copy;
  drawBackdrop(R, seg(t, 0, 2));
  const cx = W / 2;

  const pe = easeOut(seg(t, 0.4, 1.7));
  R.logoQueue = { cx, cy: H * 0.36, plateW: W * 0.56, alpha: pe * (1 - cover), scale: lerp(0.97, 1, pe) };

  const rp = easeInOut(seg(t, 0.8, 2.0));
  ctx.fillStyle = C.gold;
  const rw = 420 * u * rp;
  ctx.fillRect(cx - rw / 2, H * 0.58, rw, Math.max(2, 3 * u));

  let r = reveal(t, 1.5, 0.9);
  ctx.save();
  ctx.globalAlpha = r.a;
  setFont(ctx, 36 * u, { weight: 500 });
  ctx.fillStyle = C.gold;
  ctx.textBaseline = 'alphabetic';
  drawTracked(ctx, copy.edition, cx, H * 0.665 + r.dy * u, 14 * u, 'center');
  ctx.restore();

  r = reveal(t, 2.2, 1.0);
  ctx.save();
  ctx.globalAlpha = r.a;
  setFont(ctx, 68 * u, { weight: 400, italic: true });
  ctx.fillStyle = C.ivory;
  ctx.textAlign = 'center';
  ctx.fillText(copy.introHeadline, cx, H * 0.78 + r.dy * u);
  ctx.restore();
}

function drawEndLayer(R, t, A) {
  const { ctx, W, H, u } = R;
  const copy = CONFIG.copy;
  ctx.save();
  ctx.globalAlpha = A;
  drawBackdrop(R, seg(t, 0, 1.5));
  ctx.restore();
  const cx = W / 2;

  const pe = easeOut(seg(t, 1.0, 2.3));
  R.logoQueue = { cx, cy: H * 0.34, plateW: W * 0.60, alpha: pe * A, scale: lerp(0.97, 1, pe) };

  let r = reveal(t, 2.0, 1.0);
  ctx.save();
  ctx.globalAlpha = r.a * A;
  setFont(ctx, 70 * u, { weight: 400, italic: true });
  ctx.fillStyle = C.ivory;
  ctx.textAlign = 'center';
  ctx.fillText(copy.endHeadline, cx, H * 0.695 + r.dy * u);
  ctx.restore();

  const rp = easeInOut(seg(t, 2.6, 3.4));
  ctx.save();
  ctx.globalAlpha = A;
  ctx.fillStyle = C.gold;
  const rw = 300 * u * rp;
  ctx.fillRect(cx - rw / 2, H * 0.745, rw, Math.max(2, 3 * u));
  ctx.restore();

  r = reveal(t, 2.9, 0.9);
  ctx.save();
  ctx.globalAlpha = r.a * A;
  setFont(ctx, 34 * u, { weight: 500 });
  ctx.fillStyle = C.goldLight;
  ctx.textBaseline = 'alphabetic';
  drawTracked(ctx, copy.endLine.toUpperCase(), cx, H * 0.83 + r.dy * u, 6 * u, 'center');
  ctx.restore();

  if (copy.contactLine) {
    r = reveal(t, 3.4, 0.9);
    ctx.save();
    ctx.globalAlpha = r.a * A * 0.9;
    setFont(ctx, 32 * u, { weight: 400 });
    ctx.fillStyle = C.ivory;
    ctx.textAlign = 'center';
    ctx.fillText(copy.contactLine, cx, H * 0.90 + r.dy * u);
    ctx.restore();
  }
}

function shotStartTime(i) {
  return LAYERS.find((l) => l.type === 'shot' && l.index === i).start;
}

function renderFrame(R, t) {
  const { ctx, W, H } = R;
  t = clamp(t, 0, TOTAL);
  R.logoQueue = null;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  LAYERS.forEach((layer, li) => {
    if (t < layer.start || t > layer.end) return;
    const A = li === 0 ? 1 : easeInOut(seg(t, layer.start, layer.start + layer.fade));
    if (A <= 0) return;
    const local = t - layer.start;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    if (layer.type === 'intro') drawIntroLayer(R, local, li + 1 < LAYERS.length ? easeInOut(seg(t, LAYERS[li + 1].start, LAYERS[li + 1].start + LAYERS[li + 1].fade)) : 0);
    else if (layer.type === 'shot') drawShotLayer(R, layer.index, local, layer.end - layer.start, A);
    else drawEndLayer(R, local, A);
    ctx.restore();
  });

  // fade up from black at the very start
  const f = 1 - easeOut(seg(t, 0, 0.8));
  if (f > 0.001) {
    ctx.save();
    ctx.globalAlpha = f;
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  ctx.drawImage(R.fx.vignette, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = R.fx.grains[R.frame % 3];
  ctx.translate(-((R.frame * 37) % 192), -((R.frame * 91) % 192));
  ctx.fillRect(0, 0, W + 192, H + 192);
  ctx.restore();

  // The official logo is drawn after vignette and grain so its colours stay exactly as supplied.
  if (R.logoQueue) {
    const q = R.logoQueue;
    drawLogo(R, q.cx, q.cy, q.plateW, q.alpha * (1 - f), q.scale);
  }
  R.frame++;
}

/* ==========================================================================
   State and UI
   ========================================================================== */
const ui = {
  canvas: el('preview'), stageMsg: el('stageMsg'), barFill: el('barFill'), timeText: el('timeText'),
  play: el('playBtn'), pause: el('pauseBtn'), restart: el('restartBtn'), stop: el('stopBtn'), exp: el('exportBtn'),
  res: el('resSelect'), fmt: el('fmtSelect'), sound: el('soundToggle'), autoHint: el('autoHint'),
  notice: el('notice'), noticeTitle: el('noticeTitle'), noticeBody: el('noticeBody'), noticeList: el('noticeList'), retry: el('retryBtn'),
  output: el('output'), outputTitle: el('outputTitle'), video: el('resultVideo'), stats: el('stats'),
  download: el('downloadLink'), open: el('openLink'), share: el('shareBtn'), again: el('againBtn'), outputNote: el('outputNote'),
  framingList: el('framingList'), resetFraming: el('resetFraming'),
  assetGrid: el('assetGrid'), musicStatus: el('musicStatus'), formatSupport: el('formatSupport'),
};

const state = {
  images: [],            // { img, blur, path }
  logo: null,            // { canvas, reversed, aspect }
  assetsOk: false,
  audio: { status: 'unknown', ctx: null, buffer: null },
  mode: 'loading',       // loading | error | idle | playing | paused | ended | exporting
  t: 0, last: 0, lastDraw: 0, raf: 0,
  music: null,
  abort: null,
  outputUrl: null,
  retryFn: null,
};

const pctx = ui.canvas.getContext('2d', { alpha: false });
ui.canvas.width = CONFIG.preview.w;
ui.canvas.height = CONFIG.preview.h;
let previewR = null;

function setMode(m) {
  state.mode = m;
  const ready = state.assetsOk;
  const busy = m === 'exporting';
  ui.play.disabled = !ready || busy || m === 'playing';
  ui.play.textContent = m === 'paused' ? 'Resume' : m === 'ended' ? 'Replay' : 'Play preview';
  ui.pause.disabled = m !== 'playing';
  ui.restart.disabled = !ready || busy;
  ui.stop.disabled = busy ? false : !(m === 'playing' || m === 'paused' || m === 'ended');
  ui.stop.textContent = busy ? 'Cancel export' : 'Stop';
  ui.exp.disabled = !ready || busy;
  ui.exp.textContent = busy ? 'Exporting…' : 'Export video';
  ui.res.disabled = busy;
  ui.fmt.disabled = busy;
}
function showStage(msg) { ui.stageMsg.textContent = msg; ui.stageMsg.hidden = false; }
function hideStage() { ui.stageMsg.hidden = true; }
function updateProgress(t) {
  ui.barFill.style.width = (clamp(t / TOTAL) * 100).toFixed(1) + '%';
  ui.timeText.textContent = `${fmtTime(t)} / ${fmtTime(TOTAL)}`;
}
function showNotice({ kind = 'error', title, body = '', items = [], retryLabel = '', retryFn = null }) {
  ui.notice.className = 'banner ' + kind;
  ui.noticeTitle.textContent = title;
  ui.noticeBody.textContent = body;
  ui.noticeList.textContent = '';
  items.forEach((i) => { const li = document.createElement('li'); li.textContent = i; ui.noticeList.appendChild(li); });
  state.retryFn = retryFn;
  ui.retry.hidden = !retryFn;
  ui.retry.textContent = retryLabel;
  ui.notice.hidden = false;
}
function hideNotice() { ui.notice.hidden = true; }

/* ---------- Asset loading ---------- */
function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try { if (img.decode) await img.decode(); } catch (e) { /* decode errors are caught by the size check */ }
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('Image is empty or corrupt'));
      else resolve(img);
    };
    img.onerror = () => reject(new Error('File not found or not a valid image'));
    img.src = path;
  });
}
function canvasAllowsImage(img) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, 2, 2);
    x.getImageData(0, 0, 1, 1);
    return true;
  } catch (e) { return false; }
}
function renderAssetGrid(results, logoRes) {
  ui.assetGrid.textContent = '';
  const items = CONFIG.images.map((path, i) => ({ path, r: results[i], logo: false }));
  items.push({ path: CONFIG.logo.path, r: logoRes, logo: true });
  items.forEach(({ path, r, logo }) => {
    const li = document.createElement('li');
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const ok = r && r.status === 'fulfilled';
    if (ok) {
      const im = document.createElement('img');
      im.src = path; im.alt = path;
      if (logo) { im.style.objectFit = 'contain'; im.style.background = '#fff'; }
      thumb.appendChild(im);
    } else {
      thumb.textContent = 'Missing';
    }
    const name = document.createElement('span');
    name.textContent = logo ? `${path} (official logo)` : path;
    const st = document.createElement('span');
    st.className = ok ? 'ok' : 'bad';
    st.textContent = ok ? `Loaded ${r.value.naturalWidth}×${r.value.naturalHeight}` : 'Not loaded';
    li.append(thumb, name, st);
    ui.assetGrid.appendChild(li);
  });
}

function ensureAudioCtx() {
  if (state.audio.ctx) return state.audio.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  state.audio.ctx = new AC();
  return state.audio.ctx;
}
async function loadMusic() {
  const a = state.audio;
  a.buffer = null;
  let res;
  try {
    res = await fetch(CONFIG.music.path, { cache: 'no-store' });
  } catch (e) { a.status = 'absent'; return; }
  if (!res.ok) { a.status = 'absent'; return; }
  const ac = ensureAudioCtx();
  if (!ac) { a.status = 'unsupported'; return; }
  try {
    const data = await res.arrayBuffer();
    a.buffer = await new Promise((ok, bad) => ac.decodeAudioData(data, ok, bad));
    a.status = 'ok';
  } catch (e) { a.status = 'undecodable'; }
}
function describeMusic() {
  const p = CONFIG.music.path;
  const s = state.audio.status;
  ui.musicStatus.textContent =
    s === 'ok' ? `Music found (${p}, ${state.audio.buffer.duration.toFixed(0)} s). It will be mixed into the export with a fade in and fade out.` :
    s === 'undecodable' ? `${p} exists but this browser could not decode it. The export will be silent. Try an MP3 or M4A file.` :
    s === 'unsupported' ? 'This browser cannot mix audio. The export will be silent.' :
    `No music file at ${p}. The export will be a silent video, which is fine.`;
}

async function loadAllAssets(bust = false) {
  stopPreviewSilently();
  state.assetsOk = false;
  setMode('loading');
  hideNotice();
  showStage('Loading photos and logo…');
  const tag = bust ? `?v=${Date.now()}` : '';
  const [results, logoRes] = await Promise.all([
    Promise.allSettled(CONFIG.images.map((p) => loadImage(p + tag))),
    Promise.allSettled([loadImage(CONFIG.logo.path + tag)]).then((a) => a[0]),
  ]);
  renderAssetGrid(results, logoRes);

  const failed = [];
  results.forEach((r, i) => { if (r.status === 'rejected') failed.push(`${CONFIG.images[i]}: ${r.reason.message}`); });
  if (logoRes.status === 'rejected') failed.push(`${CONFIG.logo.path} (official logo): ${logoRes.reason.message}`);
  if (failed.length) {
    showStage('Some files could not be loaded.');
    showNotice({
      title: `${failed.length} file${failed.length > 1 ? 's' : ''} could not be loaded`,
      body: 'The video will not be rendered until all five photos and the logo load. Check that the "sale" folder sits next to index.html, that the file names match exactly (including capitals), and that you opened the page through a local server.',
      items: failed,
      retryLabel: 'Reload files',
      retryFn: () => loadAllAssets(true),
    });
    setMode('error');
    return;
  }
  if (!canvasAllowsImage(results[0].value)) {
    showStage('The browser is blocking the images.');
    showNotice({
      title: 'Images loaded but the browser blocks them from the canvas',
      body: 'This almost always means the page was opened with file://. A video recorded from a blocked canvas would be blank, so rendering is disabled.',
      items: ['Serve the folder over http, e.g. python -m http.server 8080, then open http://localhost:8080', 'See README.md for step-by-step Android instructions.'],
      retryLabel: 'Check again',
      retryFn: () => loadAllAssets(true),
    });
    setMode('error');
    return;
  }

  let logo;
  try { logo = prepareLogo(logoRes.value); }
  catch (e) {
    showStage('The logo could not be used.');
    showNotice({ title: 'The logo file could not be read', body: String(e.message || e), retryLabel: 'Reload files', retryFn: () => loadAllAssets(true) });
    setMode('error');
    return;
  }
  state.logo = logo;
  state.images = results.map((r, i) => ({ img: r.value, path: CONFIG.images[i], blur: makeBlur(r.value) }));
  await loadMusic();
  describeMusic();

  state.assetsOk = true;
  previewR = makeRenderer(pctx, CONFIG.preview.w, CONFIG.preview.h);
  state.t = 0;
  drawPoster();
  updateProgress(0);
  hideStage();
  setMode('idle');
  buildFraming();
}

function drawPoster() {
  if (!previewR) return;
  renderFrame(previewR, POSTER_T);
}

/* ---------- Music (preview and export share this) ---------- */
function startMusic(destination, videoT) {
  const a = state.audio;
  const ac = a.ctx;
  const { volume, fadeIn, fadeOut } = CONFIG.music;
  const src = ac.createBufferSource();
  src.buffer = a.buffer;
  src.loop = true;
  const g = ac.createGain();
  const now = ac.currentTime;
  const at = (vt) => now + Math.max(0, vt - videoT);
  const gainAt = (vt) => volume * clamp(Math.min(vt / fadeIn, (TOTAL - vt) / fadeOut));

  g.gain.setValueAtTime(gainAt(videoT), now);
  if (videoT < fadeIn) g.gain.linearRampToValueAtTime(volume, at(fadeIn));
  const fadeStart = TOTAL - fadeOut;
  if (fadeStart > Math.max(videoT, fadeIn)) g.gain.setValueAtTime(volume, at(fadeStart));
  g.gain.linearRampToValueAtTime(0, at(TOTAL));

  src.connect(g);
  g.connect(destination);
  src.start(now, videoT % a.buffer.duration);
  try { src.stop(at(TOTAL) + 0.2); } catch (e) { /* ignore */ }
  return {
    stop() {
      try { src.stop(); } catch (e) { /* already stopped */ }
      try { g.disconnect(); } catch (e) { /* ignore */ }
    },
  };
}
function stopMusic() {
  if (state.music) { state.music.stop(); state.music = null; }
}
function startPreviewMusic() {
  stopMusic();
  if (state.audio.status !== 'ok' || !ui.sound.checked) return;
  const ac = state.audio.ctx;
  ac.resume().then(() => {
    if (state.mode !== 'playing') return;
    stopMusic();
    state.music = startMusic(ac.destination, state.t);
  }).catch(() => { /* preview stays silent */ });
}

/* ---------- Preview controls ---------- */
function previewTick(now) {
  if (state.mode !== 'playing') return;
  const dt = Math.min(0.25, (now - state.last) / 1000);
  state.last = now;
  state.t = Math.min(TOTAL, state.t + dt);
  if (now - state.lastDraw >= 1000 / CONFIG.preview.fps - 2) {
    renderFrame(previewR, state.t);
    state.lastDraw = now;
  }
  updateProgress(state.t);
  if (state.t >= TOTAL) {
    renderFrame(previewR, TOTAL);
    stopMusic();
    setMode('ended');
    return;
  }
  state.raf = requestAnimationFrame(previewTick);
}
function previewPlay() {
  if (!state.assetsOk || state.mode === 'exporting' || state.mode === 'playing') return;
  if (state.mode === 'ended' || state.t >= TOTAL - 0.01) state.t = 0;
  state.mode = 'playing';
  setMode('playing');
  state.last = performance.now();
  state.lastDraw = 0;
  startPreviewMusic();
  state.raf = requestAnimationFrame(previewTick);
}
function previewPause() {
  if (state.mode !== 'playing') return;
  cancelAnimationFrame(state.raf);
  stopMusic();
  setMode('paused');
}
function previewRestart() {
  if (!state.assetsOk || state.mode === 'exporting') return;
  cancelAnimationFrame(state.raf);
  stopMusic();
  state.t = 0;
  state.mode = 'idle';
  previewPlay();
}
function stopPreviewSilently() {
  cancelAnimationFrame(state.raf);
  stopMusic();
  state.t = 0;
}
function previewStop() {
  if (state.mode === 'exporting') { if (state.abort) state.abort('Export cancelled.'); return; }
  stopPreviewSilently();
  drawPoster();
  updateProgress(0);
  setMode('idle');
}

/* ---------- Camera framing (tap to choose where each shot pushes in) ---------- */
const FRAMING_KEY = 'vamacara.framing.v2';
const DEFAULT_TO = CONFIG.shots.map((s) => ({ ...s.motion.to }));
function loadFraming() {
  try {
    const saved = JSON.parse(localStorage.getItem(FRAMING_KEY) || 'null');
    if (!Array.isArray(saved)) return;
    saved.forEach((m, i) => {
      if (!m || !CONFIG.shots[i]) return;
      const x = Number(m.x), y = Number(m.y), z = Number(m.z);
      if ([x, y, z].every(Number.isFinite)) Object.assign(CONFIG.shots[i].motion.to, { x: clamp(x), y: clamp(y), z: clamp(z, 1, 2.4) });
    });
  } catch (e) { /* storage unavailable: defaults are used */ }
}
function saveFraming() {
  try { localStorage.setItem(FRAMING_KEY, JSON.stringify(CONFIG.shots.map((s) => s.motion.to))); } catch (e) { /* optional */ }
}
function previewShot(i) {
  if (!state.assetsOk || state.mode === 'playing' || state.mode === 'exporting') return;
  state.t = shotStartTime(i) + 3.0;
  renderFrame(previewR, state.t);
  updateProgress(state.t);
  setMode('paused');
}
function buildFraming() {
  ui.framingList.textContent = '';
  CONFIG.shots.forEach((shot, i) => {
    const asset = state.images[shot.image];
    const li = document.createElement('li');
    const box = document.createElement('div');
    box.className = 'fr-img';
    box.style.aspectRatio = `${asset.img.naturalWidth} / ${asset.img.naturalHeight}`;
    const im = document.createElement('img');
    im.src = asset.path; im.alt = `Shot ${i + 1} photo`;
    const dot = document.createElement('span');
    dot.className = 'dot';
    box.append(im, dot);

    const cap = document.createElement('span');
    cap.textContent = `Shot ${i + 1}: ${shot.label}`;

    const lab = document.createElement('label');
    const out = document.createElement('output');
    const range = document.createElement('input');
    range.type = 'range'; range.min = '1'; range.max = '2.4'; range.step = '0.05';
    range.setAttribute('aria-label', `Zoom for shot ${i + 1}`);
    lab.append('Zoom ', range, out);

    const refresh = () => {
      const to = shot.motion.to;
      dot.style.left = (to.x * 100) + '%';
      dot.style.top = (to.y * 100) + '%';
      range.value = String(to.z);
      out.textContent = ` ${to.z.toFixed(2)}×`;
    };
    box.addEventListener('click', (e) => {
      const r = box.getBoundingClientRect();
      shot.motion.to.x = clamp((e.clientX - r.left) / r.width);
      shot.motion.to.y = clamp((e.clientY - r.top) / r.height);
      refresh(); saveFraming(); previewShot(i);
    });
    range.addEventListener('input', () => {
      shot.motion.to.z = Number(range.value);
      refresh(); saveFraming(); previewShot(i);
    });
    refresh();
    li.append(box, cap, lab);
    ui.framingList.appendChild(li);
  });
}

/* ==========================================================================
   Export
   ========================================================================== */
class ExportError extends Error {
  constructor(message, details = []) { super(message); this.details = details; }
}

function pickFormat(withAudio, pref) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  const mp4 = withAudio
    ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=h264,aac']
    : ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4;codecs=h264', 'video/mp4'];
  const webm = withAudio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=av1,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const groups = pref === 'mp4' ? [['mp4', mp4]] : pref === 'webm' ? [['webm', webm]] : [['mp4', mp4], ['webm', webm]];
  for (const [kind, list] of groups) {
    for (const mime of list) {
      let ok = false;
      try { ok = MediaRecorder.isTypeSupported(mime); } catch (e) { ok = false; }
      if (ok) return { mime, kind };
    }
  }
  return null;
}
function describeSupport() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    ui.formatSupport.textContent = 'This browser cannot record canvas video. Use a recent Chrome.';
    return;
  }
  const m = pickFormat(false, 'mp4'), w = pickFormat(false, 'webm');
  const parts = [];
  if (m) parts.push('MP4');
  if (w) parts.push('WebM');
  ui.formatSupport.textContent = parts.length
    ? `This browser can record: ${parts.join(' and ')}.${m ? '' : ' MP4 is not available here, so exports will be WebM.'}`
    : 'No supported recording format was found in this browser.';
}
function autoRes() {
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  return lowMem || lowCpu ? '720' : '1080';
}
function updateAutoHint() {
  const r = CONFIG.resolutions[autoRes()];
  ui.autoHint.textContent = `Auto will export at ${r.w}×${r.h} on this device. Higher resolution takes more memory on phones.`;
}

async function sniffContainer(blob) {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  const tag = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (['ftyp', 'styp', 'moov', 'mdat', 'free'].includes(tag)) return 'mp4';
  return null;
}
function verifyPlayable(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata'; v.playsInline = true;
    let done = false;
    let timer = null;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      try { v.load(); } catch (e) { /* ignore */ }
      resolve(r);
    };
    timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), 12000);
    v.onerror = () => finish({ ok: false, reason: 'error' });
    v.onloadedmetadata = () => {
      const w = v.videoWidth, h = v.videoHeight;
      if (v.duration === Infinity || Number.isNaN(v.duration)) {
        v.ontimeupdate = () => {
          if (Number.isFinite(v.duration)) finish({ ok: w > 0, width: w, height: h, duration: v.duration });
        };
        setTimeout(() => finish({ ok: w > 0, width: w, height: h, duration: null }), 3000);
        try { v.currentTime = 1e101; } catch (e) { /* ignore */ }
      } else {
        finish({ ok: w > 0, width: w, height: h, duration: v.duration });
      }
    };
    v.src = url;
  });
}
function fixInfiniteDuration(video) {
  video.addEventListener('loadedmetadata', function onMeta() {
    video.removeEventListener('loadedmetadata', onMeta);
    if (video.duration !== Infinity) return;
    const back = () => { video.removeEventListener('timeupdate', back); video.currentTime = 0; };
    video.addEventListener('timeupdate', back);
    try { video.currentTime = 1e101; } catch (e) { /* ignore */ }
  });
}

function revokeOutput() {
  if (state.outputUrl) { URL.revokeObjectURL(state.outputUrl); state.outputUrl = null; }
}
function clearOutput() {
  ui.output.hidden = true;
  ui.video.pause();
  ui.video.removeAttribute('src');
  try { ui.video.load(); } catch (e) { /* ignore */ }
  revokeOutput();
}

async function exportVideo() {
  if (state.mode === 'exporting' || !state.assetsOk) return;
  stopPreviewSilently();
  clearOutput();
  hideNotice();
  setMode('exporting');
  updateProgress(0);

  let canvas = null, stream = null, recorder = null, wake = null, musicHandle = null;
  let aborted = null;
  state.abort = (reason) => { aborted = reason; };
  let intentionalStop = false;
  const onVisibility = () => { if (document.hidden && state.abort) state.abort('Export interrupted because the screen or tab went to the background. Keep this tab open and the screen on while exporting.'); };

  try {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
      throw new ExportError('This browser cannot record canvas video.', ['Use a recent version of Chrome on Android or desktop.']);
    }

    const resKey = ui.res.value === 'auto' ? autoRes() : ui.res.value;
    const res = CONFIG.resolutions[resKey];
    const W = res.w, H = res.h;

    // Audio plan
    let withAudio = state.audio.status === 'ok';
    let audioNote = withAudio ? 'Music mixed in' : 'Silent (no music file)';
    let fmt = pickFormat(withAudio, ui.fmt.value);
    if (!fmt && withAudio) {
      fmt = pickFormat(false, ui.fmt.value);
      if (fmt) { withAudio = false; audioNote = 'Silent (this browser cannot record audio in that format)'; }
    }
    if (!fmt) {
      throw new ExportError('No supported video format was found.', ['This browser does not offer MP4 or WebM recording.', 'Try the latest Chrome.']);
    }

    let dest = null;
    if (withAudio) {
      const ac = state.audio.ctx;
      await ac.resume();
      dest = ac.createMediaStreamDestination();
    }

    document.addEventListener('visibilitychange', onVisibility);
    if (aborted) throw new ExportError(aborted);
    if (navigator.wakeLock && navigator.wakeLock.request) {
      try { wake = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }
    }

    // Export canvas (kept in the DOM, almost invisible)
    canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.className = 'export-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });
    const R = makeRenderer(ctx, W, H);

    // First frame must exist before recording starts
    renderFrame(R, 0);
    stream = canvas.captureStream(CONFIG.fps);
    if (withAudio) dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    const opts = { mimeType: fmt.mime, videoBitsPerSecond: res.bitrate };
    if (withAudio) opts.audioBitsPerSecond = 128000;
    try {
      recorder = new MediaRecorder(stream, opts);
    } catch (e1) {
      try { recorder = new MediaRecorder(stream, { mimeType: fmt.mime }); }
      catch (e2) { throw new ExportError('The video recorder could not be created.', [String(e2.message || e2)]); }
    }

    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    let recorderError = null;
    const stopped = new Promise((resolve) => {
      recorder.onstop = () => resolve();
      recorder.onerror = (e) => { recorderError = (e && e.error) || new Error('MediaRecorder error'); resolve(); };
    });

    recorder.start(1000);
    await nextFrame();
    renderFrame(R, 0);
    await nextFrame();
    await nextFrame();

    if (aborted) throw new ExportError(aborted);

    // Real-time render loop
    const frameMs = 1000 / CONFIG.fps;
    const t0 = performance.now();
    let nextDraw = t0;
    if (withAudio) musicHandle = startMusic(dest, 0);

    await new Promise((resolve, reject) => {
      const loop = (now) => {
        if (aborted) { reject(new ExportError(aborted)); return; }
        if (recorderError) { reject(new ExportError('The recorder reported an error.', [String(recorderError.message || recorderError)])); return; }
        const t = Math.max(0, (now - t0) / 1000);
        if (now >= nextDraw) {
          renderFrame(R, Math.min(t, TOTAL));
          pctx.drawImage(canvas, 0, 0, CONFIG.preview.w, CONFIG.preview.h);
          nextDraw += frameMs;
          if (now - nextDraw > 250) nextDraw = now + frameMs;
          updateProgress(Math.min(t, TOTAL));
        }
        if (t >= TOTAL) { resolve(); return; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });

    // Hold the end card so the last frame is definitely captured
    renderFrame(R, TOTAL);
    pctx.drawImage(canvas, 0, 0, CONFIG.preview.w, CONFIG.preview.h);
    updateProgress(TOTAL);
    await sleep(CONFIG.holdEndMs / 2);
    renderFrame(R, TOTAL);
    await sleep(CONFIG.holdEndMs / 2);
    const recordedSeconds = (performance.now() - t0) / 1000;
    if (aborted) throw new ExportError(aborted);

    intentionalStop = true;
    if (musicHandle) { musicHandle.stop(); musicHandle = null; }
    try { recorder.requestData(); } catch (e) { /* ignore */ }
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    if (recorderError) throw new ExportError('The recorder failed while finishing the file.', [String(recorderError.message || recorderError)]);

    // Build and validate the file
    if (!chunks.length) throw new ExportError('The recording is empty.', ['The browser produced no video data. Retry, or choose WebM only.']);
    const rawType = (recorder.mimeType || fmt.mime).split(';')[0];
    let blob = new Blob(chunks, { type: rawType });
    if (!blob.size) throw new ExportError('The recording is empty.', ['Retry, or choose WebM only.']);
    const kind = await sniffContainer(blob);
    if (!kind) throw new ExportError('The browser produced a file in an unrecognised format.', ['Retry with "WebM only".']);
    const finalType = kind === 'mp4' ? 'video/mp4' : 'video/webm';
    const ext = kind === 'mp4' ? 'mp4' : 'webm';
    if (blob.type !== finalType) blob = new Blob([blob], { type: finalType });
    if (blob.size < 20000) throw new ExportError('The recording is too small to be a valid video.', [`Only ${fmtBytes(blob.size)} was produced. Retry the export.`]);

    revokeOutput();
    state.outputUrl = URL.createObjectURL(blob);
    const check = await verifyPlayable(state.outputUrl);
    const filename = `${CONFIG.filenamePrefix}-${H}p.${ext}`;
    showResult({ blob, filename, kind, ext, finalType, W, H, check, recordedSeconds, audioNote, fmt });
  } catch (err) {
    const isCancel = err instanceof ExportError && err.message && /cancelled/i.test(err.message);
    if (!(err instanceof ExportError)) console.error(err);
    showNotice({
      kind: isCancel ? 'warn' : 'error',
      title: isCancel ? 'Export cancelled' : 'Export failed',
      body: err instanceof ExportError ? err.message : 'Something unexpected went wrong while exporting: ' + (err && err.message ? err.message : String(err)),
      items: err instanceof ExportError ? err.details : [],
      retryLabel: 'Retry export',
      retryFn: () => exportVideo(),
    });
    clearOutput();
  } finally {
    document.removeEventListener('visibilitychange', onVisibility);
    state.abort = null;
    if (musicHandle) musicHandle.stop();
    if (recorder && recorder.state !== 'inactive' && !intentionalStop) { try { recorder.stop(); } catch (e) { /* ignore */ } }
    if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ignore */ } });
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (wake) { try { wake.release(); } catch (e) { /* ignore */ } }
    state.t = 0;
    drawPoster();
    updateProgress(0);
    setMode('idle');
  }
}

function showResult({ blob, filename, kind, ext, finalType, W, H, check, recordedSeconds, audioNote, fmt }) {
  const url = state.outputUrl;
  const duration = check && Number.isFinite(check.duration) ? check.duration : recordedSeconds;
  const playable = check && check.ok;
  const label = kind === 'mp4' ? 'MP4 (H.264, recorded by the browser)' : 'WebM (recorded by the browser)';

  ui.video.src = url;
  fixInfiniteDuration(ui.video);
  ui.download.href = url;
  ui.download.download = filename;
  ui.open.href = url;

  ui.stats.textContent = '';
  const rows = [
    ['Format', `${label}, .${ext}`],
    ['Duration', `${duration.toFixed(1)} s`],
    ['Resolution', `${W}×${H} at ${CONFIG.fps} fps`],
    ['File size', fmtBytes(blob.size)],
    ['Audio', audioNote],
    ['File name', filename],
  ];
  rows.forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    ui.stats.append(dt, dd);
  });

  ui.outputTitle.textContent = playable ? 'Your video is ready' : 'Video file created, playback not confirmed';
  const notes = [];
  if (!playable) notes.push('The file was created, but this browser could not confirm it plays back. Try Download video and open it on another device before sending it to the client.');
  if (kind === 'webm') notes.push('This file is WebM, not MP4. Many editors and players handle WebM, but to deliver an MP4, convert it with a video editor or HandBrake, or with ffmpeg: ffmpeg -i input.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac output.mp4');
  if (kind === 'mp4') notes.push('Browser-recorded MP4 files are valid but not heavily optimised. For maximum compatibility with every platform, a re-encode in a video editor is optional.');
  notes.push('If your browser opens the video instead of saving it, use the player menu, long-press the video, or use Share or save.');
  ui.outputNote.textContent = notes.join(' ');

  // Share (only when the browser supports sharing files)
  ui.share.hidden = true;
  try {
    const file = new File([blob], filename, { type: finalType });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      ui.share.hidden = false;
      ui.share.onclick = async () => {
        try { await navigator.share({ files: [file], title: 'VAMA CARA Export Edition' }); }
        catch (e) { if (e && e.name !== 'AbortError') showNotice({ kind: 'warn', title: 'Sharing failed', body: String(e.message || e) }); }
      };
    }
  } catch (e) { /* sharing is optional */ }

  ui.output.hidden = false;
  ui.output.scrollIntoView({ behavior: 'smooth', block: 'start' });
  hideNotice();
}

/* ==========================================================================
   Wiring
   ========================================================================== */
ui.play.addEventListener('click', previewPlay);
ui.pause.addEventListener('click', previewPause);
ui.restart.addEventListener('click', previewRestart);
ui.stop.addEventListener('click', previewStop);
ui.exp.addEventListener('click', exportVideo);
ui.again.addEventListener('click', () => { clearOutput(); exportVideo(); });
ui.retry.addEventListener('click', () => { const f = state.retryFn; if (f) f(); });
ui.sound.addEventListener('change', () => {
  if (state.mode !== 'playing') return;
  if (ui.sound.checked) startPreviewMusic(); else stopMusic();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') previewPause();
});
window.addEventListener('pagehide', revokeOutput);
ui.resetFraming.addEventListener('click', () => {
  CONFIG.shots.forEach((s, i) => Object.assign(s.motion.to, DEFAULT_TO[i]));
  try { localStorage.removeItem(FRAMING_KEY); } catch (e) { /* optional */ }
  if (state.assetsOk) { buildFraming(); previewShot(0); }
});

function init() {
  loadFraming();
  if (location.protocol === 'file:') el('fileWarning').hidden = false;
  updateAutoHint();
  describeSupport();
  updateProgress(0);
  setMode('loading');
  loadAllAssets();
}
init();
