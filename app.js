/* ════════════════════════════════════════════════════════════════
   TWO HALVES, ONE ROOM

   Scroll is the only control you need. It drives one camera through
   three acts:
     I   two lanes of real HTML, the engineer (black) and the creator
         (red), scroll past each other; the room shows through the seam
     II  the lanes swing open on their outer edges like doors, the camera
         lifts out to show the whole room as a cut-away, and the lanes
         are now its two side walls, each on the wall of its own colour
     III the camera drops in and walks nine stations, zig-zagging between
         the two walls to the exit at the back, and each station's card
         opens by itself as you arrive

   The lanes are CSS3DObjects and the room is WebGL, drawn from the same
   camera. The canvas sits on top and cuts a clear hole where each lane
   is, so anything standing in front of a lane still hides it.
   Every word lives in #codex as plain HTML; the room reads it from there.
   ════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const body = document.body;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const store = {
  get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} },
  del(k){ try { localStorage.removeItem(k); } catch (e) {} }
};

/* ══ the palette, shared by the posters, the canvas and the room ═ */
const HEX = { black: '#0C0C0D', paper: '#F3F1EC', red: '#F23A1D', grey: '#8C8A85' };
const VARIANT = {
  'red':       { bg: HEX.red,   fg: HEX.paper, hl: HEX.black },
  'red-ink':   { bg: HEX.red,   fg: HEX.black, hl: HEX.paper },
  'white':     { bg: HEX.paper, fg: HEX.black, hl: HEX.red },
  'white-red': { bg: HEX.paper, fg: HEX.red,   hl: HEX.black },
  'black':     { bg: HEX.black, fg: HEX.paper, hl: HEX.red },
  'black-red': { bg: HEX.black, fg: HEX.red,   hl: HEX.paper }
};

/* ══ the posters: every project's picture, set in type ══════════ */
const POSTERS = {
  feed:    { v: 'white',     big: '105',   l: ['ARTHIS.space', 'Games, one feed'], deco: 'sq' },
  wall:    { v: 'red',       words: ['The', 'Wall'], hl: 1, l: ['ARTHIS.land', 'A city of rooms'], deco: 'grid' },
  hex:     { v: 'white-red', big: '160+',  dots: true, l: ['HexaBed', 'Hex tiles'] },
  net:     { v: 'red-ink',   big: 'GPT-2', l: ['Clymora', 'From scratch'] },
  factory: { v: 'white',     words: ['Idea →', 'Game'], hl: 1, l: ['Game Factory', 'Judged by AI'] },
  cv:      { v: 'red',       big: 'ATS',   l: ['CV Forge', 'One memory'], deco: 'dot' },
  tools:   { v: 'white-red', words: ['Ship', 'it.'], hl: 1, l: ['Web apps', 'End to end'] },
  rig:     { v: 'black',     big: '28',    dots: true, l: ['Blender', 'Add-ons'], deco: 'dot' },
  house:   { v: 'white',     words: ['Kaleshi', 'Family'], hl: 1, l: ['AKverse', 'Mini-drama'] },
  build:   { v: 'black-red', words: ['Aaj hum', 'banayenge!'], small: true, l: ['Diorama', 'Build shorts'] },
  reel:    { v: 'white-red', big: 'Reel',  l: ['Reel Factory', 'Script → render'], deco: 'sq' },
  channel: { v: 'black',     big: '21.9K', l: ['AKverse', 'Subscribers'] },
  numbers: { v: 'white',     big: '154',   dots: true, l: ['Evidence', 'Builds'] },
  arcade:  { v: 'red',       words: ['Insert', 'coin'], hl: 1, l: ['Arcade', '4 games'] }
};
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function posterHTML(key){
  const p = POSTERS[key]; if (!p) return '';
  let h = '<div class="po ' + p.v + '"><div class="po-l"><span>' + esc(p.l[0]) + '</span><span>' + esc(p.l[1]) + '</span></div>';
  if (p.deco === 'sq') h += '<i class="po-sq"></i>';
  if (p.deco === 'dot') h += '<i class="po-dot"></i>';
  if (p.deco === 'grid') h += '<div class="po-grid">' + Array.from({ length: 12 }, (_, k) => '<i' + (k === 6 ? ' class="on"' : '') + '></i>').join('') + '</div>';
  if (p.big){
    const fs = Math.min(50, 94 / (p.big.length * .47));
    h += '<p class="po-big' + (p.dots ? ' dots' : '') + '" style="font-size:' + fs.toFixed(1) + 'cqw">' + esc(p.big) + '</p>';
  } else {
    h += '<p class="po-stack' + (p.small ? ' sm' : '') + '">' + p.words.map((w, k) => '<span' + (k === p.hl ? ' class="hl"' : '') + '>' + esc(w) + '</span>').join('') + '</p>';
  }
  return h + '</div>';
}
$$('.lc-art[data-art]').forEach(f => { f.innerHTML = posterHTML(f.dataset.art); });

/* ══ the stations, read from the codex ═══════════════════════ */
const STATIONS = $$('#codex .st').map((a, i) => ({
  i, id: a.dataset.id, side: a.dataset.side, title: a.dataset.title,
  blurb: a.dataset.blurb, chips: (a.dataset.chips || '').split('|').filter(Boolean), el: a,
  pts: $$('li', a).slice(0, 3).map(li => li.textContent.replace(/\s+/g, ' ').trim())
}));
const N = STATIONS.length;
const SIDE_LABEL = { eng: 'Engineer wall', cre: 'Creator wall', both: 'Both halves' };
const HALL = { id: 'hall', side: 'both', title: 'The room', pts: [],
  blurb: 'Nine stations. Engineer work on the black wall, creator work on the red one, and both meet at the back. Keep scrolling and the camera walks you through.',
  chips: ['9 stations', '4 playable games', '1 exit'] };

const GAMES = {
  flappy: { file: 'game-flappy.html', name: 'Flappy Fird',    hint: 'Tap, or press Space, to flap' },
  runner: { file: 'game-runner.html', name: 'Trigger Runner', hint: 'Tap, or press Space, to jump' },
  g3072:  { file: 'game-3072.html',   name: '3072',           hint: 'Swipe, or use the arrow keys' },
  sudoku: { file: 'game-sudoku.html', name: 'Sudoku',         hint: 'Tap a cell, then tap a number' }
};

/* ══ the scroll timeline, in viewport-heights × 100 ═════════ */
const ACT1 = 260, MERGE = 280, STEP = 110;
const HALL_AT = ACT1 + MERGE;
const TOTAL = HALL_AT + N * STEP;
const posOf = i => i < 0 ? HALL_AT : HALL_AT + (i + 1) * STEP;     // -1 is the hall
const KEYS = [0, HALL_AT].concat(STATIONS.map(s => posOf(s.i)));

const found = new Set((store.get('aak-found') || '').split(',').filter(Boolean));

/* ══ shared UI: overlays, copy, games, simple view ══════════ */
let openLayer = null;
function openOverlay(el){ closeOverlay(); el.hidden = false; openLayer = el; const f = $('[data-close]', el); if (f) f.focus({ preventScroll: true }); }
function closeOverlay(){
  if (!openLayer) return;
  if (openLayer.id === 'arcade') $('#arcFrame').src = 'about:blank';
  openLayer.hidden = true; openLayer = null;
}
function playGame(key){
  const g = GAMES[key]; if (!g) return;
  closeOverlay();
  $('#arcT').textContent = g.name; $('#arcHint').textContent = g.hint;
  $('#arcFrame').src = g.file;
  openOverlay($('#arcade'));
  sfx('start');
}
function copyText(text, btn){
  const done = () => { if (btn){ const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = was, 1400); } toast('Copied', esc(text)); };
  const fallback = () => {
    const span = btn && btn.previousElementSibling;
    if (span){ const r = document.createRange(); r.selectNodeContents(span); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast('Copy', 'Select and copy <b>' + esc(text) + '</b>');
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-play],[data-copy],[data-close],[data-simple],[data-room],[data-inspect]');
  if (!t) return;
  if (t.dataset.play){ e.preventDefault(); playGame(t.dataset.play); }
  else if (t.dataset.copy){ e.preventDefault(); copyText(t.dataset.copy, t); }
  else if (t.hasAttribute('data-close')) closeOverlay();
  else if (t.hasAttribute('data-simple')){ e.preventDefault(); goSimple(); }
  else if (t.hasAttribute('data-room')){ store.del('aak-view'); location.hash = ''; location.reload(); }
  else if (t.hasAttribute('data-inspect')) inspect(t.dataset.inspect);
});
$$('.menu,.dossier').forEach(el => el.addEventListener('click', e => { if (e.target === el) closeOverlay(); }));

function toast(tag, html){
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = '<i>' + tag + '</i><span>' + html + '</span>';
  box.appendChild(t); setTimeout(() => t.remove(), 3500);
  while (box.children.length > 2) box.firstChild.remove();
}

/* ══ sound: a few soft tones, off until asked for ═══════════ */
let AC = null, soundOn = false;
function sfx(kind){
  if (!soundOn || !AC) return;
  const now = AC.currentTime;
  const note = (f, at, dur, vol) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, now + at);
    g.gain.setValueAtTime(0, now + at); g.gain.linearRampToValueAtTime(vol || .08, now + at + .01);
    g.gain.exponentialRampToValueAtTime(.0001, now + at + dur);
    o.connect(g).connect(AC.destination); o.start(now + at); o.stop(now + at + dur + .02);
  };
  if (kind === 'step') note(520, 0, .12, .05);
  else if (kind === 'found'){ note(660, 0, .18); note(990, .09, .28); }
  else if (kind === 'all'){ [523, 659, 784, 1047].forEach((f, k) => note(f, k * .1, .4)); }
  else if (kind === 'merge'){ note(196, 0, .9, .06); note(294, .15, .9, .05); }
  else if (kind === 'start'){ note(440, 0, .12); note(660, .08, .2); }
  else if (kind === 'open') note(780, 0, .08, .05);
}
$('#soundBtn').addEventListener('click', e => {
  soundOn = !soundOn;
  if (soundOn && !AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { soundOn = false; } }
  if (AC && AC.state === 'suspended') AC.resume();
  e.currentTarget.setAttribute('aria-pressed', soundOn);
  e.currentTarget.textContent = soundOn ? 'Sound on' : 'Sound off';
  sfx('start');
});

/* ══ the simple view ═════════════════════════════════════════ */
let running = false;
function goSimple(){
  store.set('aak-view', 'simple');
  running = false;
  closeOverlay();
  const lanesBox = $('#lanes');
  [$('#laneL'), $('#laneR')].forEach(l => { l.removeAttribute('style'); l.classList.remove('wide', 'thin'); $('.strip', l).removeAttribute('style'); lanesBox.appendChild(l); });
  body.classList.remove('three', 'booting', 'room', 'act1', 'merge');
  body.classList.add('simple');
  scrollTo(0, 0);
}
function hasWebGL(){
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}
if (store.get('aak-view') === 'simple' || !window.THREE || !THREE.CSS3DRenderer || !hasWebGL()){ goSimple(); return; }

/* ════════════════════════════════════════════════════════════
   THE 3D VERSION
   ════════════════════════════════════════════════════════════ */
body.classList.add('three', 'act1');
const MOBILE = innerWidth < 760 || (matchMedia('(pointer: coarse)').matches && innerWidth < 1000);
const LOW = MOBILE || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

/* ── the loader: it lifts away by itself once the room is built ── */
const gateFill = $('#gateFill'), gateMsg = $('#gateMsg');
let loadedN = 0, loadTotal = 1;
function progress(){
  const k = Math.round(100 * loadedN / loadTotal);
  gateFill.style.width = k + '%';
  gateMsg.textContent = 'Loading ' + k + '%';
}
const bootAt = performance.now();
function start(){ body.classList.remove('booting'); }

/* ── three ── */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.25 : 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const css = new THREE.CSS3DRenderer();
$('#css3d').appendChild(css.domElement);

const scene = new THREE.Scene();
const FOV = 50;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 160);

const C = { black: 0x0C0C0D, black2: 0x1B1B1D, paper: 0xF3F1EC, paper2: 0xDEDBD4, red: 0xF23A1D, redD: 0xB8270F, grey: 0x8C8A85, steel: 0x6E6D6A };
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const MATS = new Map();
function mat(hex, o){
  if (!o && MATS.has(hex)) return MATS.get(hex);
  const m = new THREE.MeshLambertMaterial(Object.assign({ color: lin(hex) }, o || {}));
  if (!o) MATS.set(hex, m);
  return m;
}
const flat = (hex, o) => new THREE.MeshBasicMaterial(Object.assign({ color: lin(hex) }, o || {}));
const BOX = new Map();
function boxGeo(w, h, d){
  const k = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  if (!BOX.has(k)) BOX.set(k, new THREE.BoxGeometry(w, h, d));
  return BOX.get(k);
}
/* a box with its bottom at y */
function B(par, w, h, d, m, x, y, z, o){
  o = o || {};
  const mesh = new THREE.Mesh(boxGeo(w, h, d), typeof m === 'number' ? mat(m) : m);
  mesh.position.set(x, y + h / 2, z);
  if (o.ry) mesh.rotation.y = o.ry;
  if (o.rx) mesh.rotation.x = o.rx;
  if (o.rz) mesh.rotation.z = o.rz;
  mesh.castShadow = !o.noShadow; mesh.receiveShadow = true;
  par.add(mesh); return mesh;
}
function CYL(par, rt, rb, h, seg, m, x, y, z){
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof m === 'number' ? mat(m) : m);
  mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
  par.add(mesh); return mesh;
}
function plane(par, w, h, m, x, y, z, ry){
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.set(x, y, z); mesh.rotation.y = ry || 0; mesh.receiveShadow = true;
  par.add(mesh); return mesh;
}

/* ── canvas: the same posters, for the walls ── */
function makeCanvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texFrom(c){ const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = LOW ? 2 : 8; return t; }
function posterFont(g, px){
  g.font = '900 ' + px + 'px Archivo, "Helvetica Neue", Arial, sans-serif';
  if ('fontStretch' in g) g.fontStretch = 'extra-condensed';
}
/* text set to fill a width exactly, the way a poster crops it */
function fitText(g, text, width, maxPx){
  posterFont(g, 100); const w = g.measureText(text).width || 1;
  const px = Math.min(maxPx, 100 * width / w); posterFont(g, px); return px;
}
function halftone(g, draw, w, h, color, step){
  const [oc, og] = makeCanvas(w, h); draw(og);
  const d = og.getImageData(0, 0, w, h).data;
  g.fillStyle = color;
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step){
    if (d[((y | 0) * w + (x | 0)) * 4 + 3] > 120){ g.beginPath(); g.arc(x, y, step * .46, 0, Math.PI * 2); g.fill(); }
  }
}
function posterCanvas(key, W, H){
  const p = POSTERS[key], v = VARIANT[p.v];
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = v.bg; g.fillRect(0, 0, W, H);
  const m = W * .06;
  g.fillStyle = v.fg; g.font = '500 ' + Math.round(W * .036) + 'px "Geist Mono", ui-monospace, monospace'; g.textBaseline = 'top';
  g.fillText(p.l[0].toUpperCase(), m, m);
  g.textAlign = 'right'; g.fillText(p.l[1].toUpperCase(), W - m, m); g.textAlign = 'left';
  g.fillRect(m, m + W * .06, W - 2 * m, Math.max(2, W * .004));
  if (p.deco === 'sq'){ g.fillStyle = v.hl; g.fillRect(W - m - W * .16, m + W * .12, W * .16, W * .16); }
  if (p.deco === 'dot'){ g.fillStyle = v.hl; g.beginPath(); g.arc(W - m - W * .09, m + W * .21, W * .09, 0, Math.PI * 2); g.fill(); }
  if (p.deco === 'grid'){ for (let k = 0; k < 12; k++){ const x = W - m - (4 - k % 4) * W * .07, y = m + W * .12 + Math.floor(k / 4) * W * .06;
    if (k === 6){ g.fillStyle = v.hl; g.fillRect(x, y, W * .055, W * .042); } else { g.strokeStyle = v.fg; g.lineWidth = 3; g.strokeRect(x, y, W * .055, W * .042); } } }
  g.textBaseline = 'alphabetic';
  if (p.big){
    const draw = gg => { gg.fillStyle = v.fg; const px = fitText(gg, p.big.toUpperCase(), W * 1.02, H * .62); gg.fillText(p.big.toUpperCase(), -W * .02, H + px * .06); };
    if (p.dots) halftone(g, draw, W, H, v.fg, Math.round(W / 90)); else draw(g);
  } else {
    const words = p.words.map(w => w.toUpperCase());
    let px = Infinity; words.forEach(w => { px = Math.min(px, fitText(g, w, W * .94, H * (p.small ? .2 : .3))); });
    posterFont(g, px);
    words.forEach((w, k) => { g.fillStyle = k === p.hl ? v.hl : v.fg; g.fillText(w, m * .7, H - m * .6 - (words.length - 1 - k) * px * .82); });
  }
  return c;
}
/* a museum label: the station's number, name and a line */
function labelCanvas(s){
  const W = 900, H = 520, [c, g] = makeCanvas(W, H);
  const dark = s.side === 'eng';
  g.fillStyle = dark ? HEX.paper : HEX.black; g.fillRect(0, 0, W, H);
  const ink = dark ? HEX.black : HEX.paper;
  g.fillStyle = HEX.red; g.fillRect(0, 0, W, 16);
  g.fillStyle = ink; g.font = '500 30px "Geist Mono", ui-monospace, monospace'; g.textBaseline = 'top';
  g.fillText(String(s.i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0'), 48, 54);
  g.textAlign = 'right'; g.fillText(SIDE_LABEL[s.side].toUpperCase(), W - 48, 54); g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  const t = s.title.toUpperCase(); const px = fitText(g, t, W - 96, 170); g.fillText(t, 44, 120 + px * .82);
  g.font = '500 32px Geist, Arial, sans-serif'; g.fillStyle = dark ? '#3B3A38' : '#C9C6BF';
  const words = s.blurb.split(' '); let line = '', y = 170 + px * .82;
  words.forEach(w => { const tst = line ? line + ' ' + w : w; if (g.measureText(tst).width > W - 96){ g.fillText(line, 48, y); line = w; y += 44; } else line = tst; });
  if (line) g.fillText(line, 48, y);
  return texFrom(c);
}

/* ── images: game covers and logos only ── */
const loader = new THREE.TextureLoader();
const TEX = {}, IMG = {};
const SOURCES = {
  dp: 'assets/brand/dp.png',
  fruit: 'assets/brand/cover-fruit-blast.jpg', doodle: 'assets/brand/cover-doodle-militia.jpg',
  chess: 'assets/brand/cover-chess.jpg', tt: 'assets/brand/cover-table-tennis.jpg'
};
const ASSETS = Object.keys(SOURCES);
loadTotal = ASSETS.length + 2;
function loadAll(){
  const jobs = ASSETS.map(k => new Promise(res => {
    loader.load(SOURCES[k], t => { t.encoding = THREE.sRGBEncoding; t.anisotropy = LOW ? 2 : 8; TEX[k] = t; IMG[k] = t.image; loadedN++; progress(); res(); },
      undefined, () => { loadedN++; progress(); res(); });
  }));
  const fonts = (document.fonts && document.fonts.load
    ? Promise.all(['900 100px Archivo', '500 20px Geist', '500 20px "Geist Mono"'].map(f => document.fonts.load(f))).catch(() => {})
    : Promise.resolve()).then(() => { loadedN++; progress(); });
  return Promise.race([Promise.all(jobs.concat([fonts])), new Promise(res => setTimeout(res, 9000))]);
}

/* ══ the room ═══════════════════════════════════════════════ */
const RW = 18, RH = 7.6, Z_FRONT = 1, Z_BACK = -34;
const HALF = RW / 2, D = Z_FRONT - Z_BACK, MZ = (Z_FRONT + Z_BACK) / 2;
const world = new THREE.Group(); scene.add(world);
const pick = [], anim = [], MARK = [];
let ceiling = null;
const AT = [
  { x: -6.9, y: 1.9, z: -11.2 },              // arthis
  { x:  6.5, y: 1.9, z: -13.4 },              // blender
  { x: -6.6, y: 1.5, z: -17.4 },              // hexabed
  { x:  6.6, y: 2.0, z: -19.6 },              // akverse
  { x: -6.9, y: 2.3, z: -23.6 },              // ai
  { x:  8.5, y: 3.3, z: -25.6 },              // board
  { x: -5.6, y: 2.0, z: -31.6 },              // arcade
  { x:  5.6, y: 2.3, z: -32.8 },              // numbers
  { x:  0.0, y: 2.4, z: -33.8 }               // contact
];
function tagStation(obj, i){ obj.traverse(o => { if (o.isMesh){ o.userData.st = i; pick.push(o); } }); }
function poster(key, w, x, y, z, ry){
  const h = w * 4 / 3;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; world.add(g);
  plane(g, w, h, new THREE.MeshBasicMaterial({ map: texFrom(posterCanvas(key, 600, 800)) }), 0, 0, .02);
  return g;
}
function label(s, x, y, z, ry){ return plane(world, 1.5, .867, new THREE.MeshBasicMaterial({ map: labelCanvas(s) }), x, y, z, ry); }

function buildShell(){
  /* floor: pale concrete, the red seam down the middle */
  const [fc, fg] = makeCanvas(512, 512);
  fg.fillStyle = '#E6E3DD'; fg.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 5000; k++){ const v = Math.sin(k * 12.9898) * 43758.5453; const r = v - Math.floor(v); fg.fillStyle = r > .5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; fg.fillRect((k * 37.3) % 512, (k * 91.7) % 512, 2, 2); }
  fg.fillStyle = 'rgba(12,12,13,.12)'; fg.fillRect(0, 0, 512, 2); fg.fillRect(0, 0, 2, 512);
  const ft = texFrom(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(RW / 3, D / 3);
  const floor = plane(world, RW, D, mat(0xffffff, { map: ft }), 0, 0, MZ); floor.rotation.x = -Math.PI / 2;
  const seam = plane(world, .22, D, flat(C.red), 0, .01, MZ); seam.rotation.x = -Math.PI / 2;
  /* walls: black for the engineer, red for the creator, white at the back */
  function wall(x, z, len, ry, col, skirt){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
    plane(g, len, RH, mat(col), 0, RH / 2, 0);
    B(g, len, .16, .04, skirt, 0, 0, .02, { noShadow: true });
    return g;
  }
  wall(-HALF, MZ, D, Math.PI / 2, C.black2, C.red);
  wall(HALF, MZ, D, -Math.PI / 2, C.red, C.black);
  wall(0, Z_BACK, RW, 0, C.paper, C.black);
  /* the words on each wall, set like posters */
  const word = (w, color, W, H) => { const [c, g] = makeCanvas(W, H); g.fillStyle = color; g.textBaseline = 'alphabetic'; const px = fitText(g, w, W, H * 1.2); g.fillText(w, 0, H * .5 + px * .38); return texFrom(c); };
  plane(world, 15, 2.0, new THREE.MeshBasicMaterial({ map: word('ENGINEER', HEX.red, 2048, 300), transparent: true }), -HALF + .02, 6.1, -19.5, Math.PI / 2);
  plane(world, 13.5, 2.0, new THREE.MeshBasicMaterial({ map: word('CREATOR', HEX.black, 2048, 300), transparent: true }), HALF - .02, 6.1, -20.5, -Math.PI / 2);

  /* the shell from outside: white walls on a black slab, a cut-away model */
  B(world, .5, RH + .2, D + .5, C.paper, -HALF - .3, 0, MZ - .25, { noShadow: true });
  B(world, .5, RH + .2, D + .5, C.paper, HALF + .3, 0, MZ - .25, { noShadow: true });
  B(world, RW + 1.1, RH + .2, .5, C.paper, 0, 0, Z_BACK - .3, { noShadow: true });
  B(world, RW + 1.2, .9, D + 1, C.black2, 0, -.95, MZ - .25, { noShadow: true });
  B(world, RW + 1.24, .12, D + 1.04, C.red, 0, -.25, MZ - .25, { noShadow: true });
  const [gc, gg] = makeCanvas(128, 128); gg.fillStyle = HEX.black; gg.fillRect(0, 0, 128, 128); gg.fillStyle = '#2A2928'; gg.fillRect(63, 0, 2, 128); gg.fillRect(0, 63, 128, 2);
  const gt = texFrom(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(50, 50);
  const ground = plane(world, 240, 240, new THREE.MeshBasicMaterial({ map: gt }), 0, -5, MZ); ground.rotation.x = -Math.PI / 2;

  /* the ceiling: white, with light slots; lifted off when the camera is above */
  ceiling = new THREE.Group(); world.add(ceiling);
  const ceil = plane(ceiling, RW, D, mat(C.paper), 0, RH, MZ); ceil.rotation.x = Math.PI / 2;
  for (let z = -3; z > Z_BACK + 1; z -= 5){
    const s = plane(ceiling, 10, .16, flat(0xffffff), 0, RH - .01, z); s.rotation.x = Math.PI / 2;
  }
}

/* ── 0 · ARTHIS: a desk, two screens, a phone ── */
let feedTex = null, feedIdx = 0;
function drawFeed(){
  const [c, g] = makeCanvas(640, 400);
  g.fillStyle = HEX.black; g.fillRect(0, 0, 640, 400);
  g.fillStyle = HEX.paper; g.font = '600 18px "Geist Mono", monospace'; g.fillText('ARTHIS.SPACE', 24, 36);
  g.fillStyle = HEX.red; g.fillRect(24, 50, 592, 2);
  g.fillStyle = HEX.grey; g.font = '500 14px "Geist Mono", monospace'; g.fillText('105 GAMES · SWIPE UP', 430, 36);
  const covers = ['fruit', 'doodle', 'chess', 'tt'].filter(k => IMG[k]);
  covers.forEach((k, n) => {
    const slot = (n - feedIdx % covers.length + covers.length) % covers.length;
    const x = 24 + slot * 152; g.globalAlpha = slot === 0 ? 1 : .45;
    g.drawImage(IMG[k], x, 74, 140, 250); g.globalAlpha = 1;
    if (slot === 0){ g.strokeStyle = HEX.red; g.lineWidth = 4; g.strokeRect(x, 74, 140, 250); }
  });
  g.fillStyle = HEX.paper; posterFont(g, 64); g.fillText('PLAY NOW', 24, 384);
  if (!feedTex) feedTex = texFrom(c); else { feedTex.image = c; feedTex.needsUpdate = true; }
}
function buildArthis(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(a.x, 0, a.z); world.add(g);
  B(g, 2.2, .08, 4.2, C.paper, 0, 1.0, 0);
  [[-.95, 1.95], [.95, 1.95], [-.95, -1.95], [.95, -1.95]].forEach(p => B(g, .06, 1.0, .06, C.black, p[0], 0, p[1]));
  drawFeed();
  [[-.9, feedTex, 1], [.95, texFrom(posterCanvas('wall', 600, 800)), 0]].forEach(m => {
    const mon = new THREE.Group(); mon.position.set(-.4, 1.08, m[0]); mon.rotation.y = m[2] ? -.12 : .12; g.add(mon);
    B(mon, .1, .45, .1, C.black, 0, 0, 0);
    if (m[2]){ B(mon, .08, 1.16, 1.86, C.black, 0, .42, 0); plane(mon, 1.74, 1.08, new THREE.MeshBasicMaterial({ map: m[1] }), .05, 1.0, 0, Math.PI / 2); }
    else { B(mon, .08, 1.7, 1.3, C.black, 0, .42, 0); plane(mon, 1.2, 1.6, new THREE.MeshBasicMaterial({ map: m[1] }), .05, 1.27, 0, Math.PI / 2); }
  });
  B(g, .4, .03, 1.1, C.black2, .45, 1.08, 0);
  CYL(g, .1, .1, .22, 16, C.red, .55, 1.08, 1.5);
  const ph = new THREE.Group(); ph.position.set(.3, 1.08, -1.65); ph.rotation.y = .5; g.add(ph);
  B(ph, .05, .7, .38, C.black, 0, 0, 0, { rz: .1 });
  if (TEX.fruit) plane(ph, .32, .58, new THREE.MeshBasicMaterial({ map: TEX.fruit }), .035, .38, 0, Math.PI / 2);
  const ch = new THREE.Group(); ch.position.set(1.7, 0, .1); g.add(ch);
  B(ch, .8, .08, .8, C.black, 0, .62, 0); B(ch, .08, .8, .8, C.black, .4, .7, 0); B(ch, .06, .62, .06, C.steel, 0, 0, 0);
  tagStation(g, i);
  poster('feed', 1.9, -HALF + .06, 3.55, a.z + 2.2, Math.PI / 2);
  label(STATIONS[i], -HALF + .05, 3.4, a.z - 1.3, Math.PI / 2);
  anim.push(t => { const k = Math.floor(t / 2.4); if (k !== feedIdx){ feedIdx = k; drawFeed(); } });
}

/* ── 1 · Blender: an armature turning on a white plinth ── */
function buildBlender(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(a.x, 0, a.z); world.add(g);
  CYL(g, 1.3, 1.3, .9, 48, C.paper, 0, 0, 0);
  CYL(g, 1.32, 1.32, .04, 48, C.black, 0, .9, 0);
  const fig = new THREE.Group(); fig.position.y = .94; g.add(fig);
  const W = mat(C.paper);
  const J = { head: [0, 2.05, 0], neck: [0, 1.72, 0], chest: [0, 1.45, 0], hip: [0, 1.0, 0],
    lh: [-.48, 1.12, .15], rh: [.5, 1.3, -.1], le: [-.32, 1.38, .08], re: [.34, 1.5, 0],
    lk: [-.16, .52, .08], rk: [.18, .55, -.06], lf: [-.2, .05, .12], rf: [.22, .05, -.04] };
  const V = k => new THREE.Vector3(J[k][0], J[k][1], J[k][2]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 20, 14), W); head.position.copy(V('head')); head.castShadow = true; fig.add(head);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.2, .15, .62, 16), W);
  torso.position.set(0, 1.27, 0); torso.castShadow = true; fig.add(torso);
  const bonesP = [['neck', 'chest'], ['chest', 'hip'], ['chest', 're'], ['re', 'rh'], ['chest', 'le'], ['le', 'lh'], ['hip', 'lk'], ['lk', 'lf'], ['hip', 'rk'], ['rk', 'rf']];
  const limb = (p, q) => { const A = V(p), Bv = V(q), len = A.distanceTo(Bv);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.055, .065, len, 10), W); m.position.copy(A).add(Bv).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()); m.castShadow = true; fig.add(m); };
  bonesP.slice(2).forEach(b => limb(b[0], b[1]));
  const pts = []; bonesP.forEach(b => pts.push(V(b[0]).setZ(.26), V(b[1]).setZ(.26)));
  fig.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: lin(C.red) })));
  Object.keys(J).forEach(k => { const s = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), flat(C.red)); s.position.copy(V(k)).setZ(.26); fig.add(s); });
  /* a softbox and a camera on a tripod */
  const sb = new THREE.Group(); sb.position.set(1.6, 0, 2.1); sb.rotation.y = -2.4; g.add(sb);
  B(sb, .04, 2.4, .04, C.black, 0, 0, 0);
  B(sb, 1.3, 1.0, .25, C.black, 0, 2.2, 0);
  plane(sb, 1.2, .9, flat(0xffffff), 0, 2.7, .13);
  const cam = new THREE.Group(); cam.position.set(-1.9, 0, 2.2); cam.rotation.y = 2.1; g.add(cam);
  [0, 2.1, 4.2].forEach(r => B(cam, .035, 1.5, .035, C.black, Math.sin(r) * .3, 0, Math.cos(r) * .3, { rx: Math.cos(r) * -.2, rz: Math.sin(r) * .2 }));
  B(cam, .62, .4, .4, C.black, 0, 1.45, 0);
  const lens = CYL(cam, .14, .17, .28, 20, C.black2, 0, 1.5, .34); lens.rotation.x = Math.PI / 2;
  const rec = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), flat(C.red)); rec.position.set(.22, 1.9, 0); cam.add(rec);
  tagStation(g, i);
  poster('rig', 1.9, HALF - .06, 3.55, a.z + 1.6, -Math.PI / 2);
  label(STATIONS[i], HALF - .05, 3.4, a.z - 1.6, -Math.PI / 2);
  anim.push((t, dt) => { fig.rotation.y += dt * (REDUCED ? 0 : .6); rec.visible = Math.floor(t * 2) % 2 === 0; });
}

/* ── 2 · HexaBed: a white terrain model that rebuilds itself ── */
let hexRegen = null;
function buildHexa(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(a.x, 0, a.z); world.add(g);
  CYL(g, 2.05, 2.05, .08, 64, C.paper, 0, .98, 0);
  CYL(g, .08, .08, .98, 12, C.black, 0, 0, 0);
  CYL(g, .7, .7, .04, 32, C.black, 0, 0, 0);
  const isle = new THREE.Group(); isle.position.y = 1.06; g.add(isle);
  const R = .27, tiles = [], hexG = new THREE.CylinderGeometry(R * .96, R * .96, 1, 6);
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++){
    if (Math.abs(q + r) > 3) continue;
    const x = (q + r / 2) * R * 1.732, z = r * R * 1.5, d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    const m = new THREE.Mesh(hexG, mat(C.paper)); m.position.set(x, 0, z); m.rotation.y = Math.PI / 6;
    m.castShadow = m.receiveShadow = true; isle.add(m); tiles.push({ m, q, r, d, h: .2, t0: 0 });
  }
  const trees = [];
  for (let k = 0; k < 8; k++){
    const tr = new THREE.Mesh(new THREE.ConeGeometry(.09, .32, 12), mat(C.black)); tr.castShadow = true; isle.add(tr); trees.push(tr);
  }
  let seed = 1, born = -10;
  hexRegen = function(now){
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = (a2, b2) => { const v = Math.sin(a2 * 12.9898 + b2 * 78.233 + seed * .013) * 43758.5453; return v - Math.floor(v); };
    tiles.forEach(t => {
      const n = Math.sin(t.q * 1.3 + seed) * .8 + Math.cos(t.r * 1.1 - seed * .7) * .7 + 1.2;
      t.h = t.d === 3 ? .1 : .12 + Math.max(0, n) * .2;
      t.road = (t.r === 0 && t.q > -3 && t.q < 3) || (t.q === 0 && t.r < 0 && t.r > -3);
      t.m.material = mat(t.road ? C.red : t.h > .45 ? C.paper2 : C.paper);
      if (t.road) t.h = Math.min(t.h, .2);
      t.t0 = t.d * .09 + rnd(t.r, t.q) * .12;
    });
    const land = tiles.filter(t => !t.road && t.d < 3);
    trees.forEach((tr, k) => { tr.userData.t = land[(k * 7 + seed) % land.length]; });
    born = now;
  };
  hexRegen(0);
  tagStation(g, i);
  poster('hex', 1.9, -HALF + .06, 3.55, a.z - 1.4, Math.PI / 2);
  label(STATIONS[i], -HALF + .05, 3.4, a.z + 1.9, Math.PI / 2);
  anim.push(t => {
    const age = t - born;
    tiles.forEach(tl => { const k = REDUCED ? 1 : ease(clamp((age - tl.t0) / .5, 0, 1)); const h = Math.max(.001, tl.h * k); tl.m.scale.y = h; tl.m.position.y = h / 2; });
    trees.forEach(tr => { const tl = tr.userData.t; if (!tl) return; tr.position.set(tl.m.position.x, tl.m.scale.y + .16, tl.m.position.z); tr.scale.setScalar(REDUCED ? 1 : clamp((age - tl.t0 - .35) / .3, .001, 1)); });
  });
}

/* ── 3 · AKverse: a channel on screen, a white model house, a ring light ── */
function drawChannel(){
  const [c, g] = makeCanvas(640, 380);
  g.fillStyle = HEX.paper; g.fillRect(0, 0, 640, 380);
  g.fillStyle = HEX.red; g.fillRect(0, 0, 640, 110);
  g.fillStyle = HEX.black; posterFont(g, 120); g.fillText('AKVERSE', 22, 104);
  if (IMG.dp) g.drawImage(IMG.dp, 540, 14, 82, 82);
  g.fillStyle = HEX.black; g.font = '500 15px "Geist Mono", monospace'; g.fillText('@AKVERSEOFFICIAL · 21.9K SUBSCRIBERS', 24, 140);
  [['KALESHI', 'FAMILY', HEX.black, HEX.paper], ['DIORAMA', 'BUILD', HEX.red, HEX.paper], ['DR', 'LODHA', HEX.paper, HEX.black]].forEach((t, k) => {
    const x = 24 + k * 202, y = 160;
    g.fillStyle = t[2]; g.fillRect(x, y, 188, 196); if (t[2] === HEX.paper){ g.strokeStyle = HEX.black; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 186, 194); }
    g.fillStyle = t[3]; posterFont(g, 62); g.fillText(t[0], x + 12, y + 128); g.fillText(t[1], x + 12, y + 180);
  });
  return texFrom(c);
}
function buildAkverse(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(a.x, 0, a.z); world.add(g);
  B(g, .9, .7, 3.4, C.black, .95, 0, 0);
  const tv = new THREE.Group(); tv.position.set(1.0, .7, 0); g.add(tv);
  B(tv, .12, .3, .12, C.black, 0, 0, 0);
  B(tv, .08, 1.62, 2.76, C.black, 0, .28, 0);
  plane(tv, 2.62, 1.5, new THREE.MeshBasicMaterial({ map: drawChannel() }), -.05, 1.09, 0, -Math.PI / 2);
  /* the house, as a white architect's model */
  const d = new THREE.Group(); d.position.set(-.7, 0, 1.55); d.rotation.y = -.5; g.add(d);
  B(d, 1.2, .95, 1.2, C.black, 0, 0, 0);
  B(d, 1.3, .06, 1.3, C.paper, 0, .95, 0);
  B(d, .76, .66, .66, C.paper, -.12, 1.01, -.12);
  B(d, .8, .05, .7, C.paper2, -.12, 1.67, -.12);
  B(d, .22, .2, .22, C.black, -.3, 1.72, -.3);
  B(d, .16, .3, .02, C.red, -.02, 1.01, .22);
  B(d, .34, .04, .2, C.paper, .38, 1.12, .34);
  const rl = new THREE.Group(); rl.position.set(-.5, 0, -2.0); g.add(rl);
  B(rl, .04, 1.8, .04, C.black, 0, 0, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 12, 48), flat(0xffffff)); ring.position.y = 2.1; ring.rotation.y = -1.2; rl.add(ring);
  const cl = new THREE.Group(); cl.position.set(-1.5, 0, .3); cl.rotation.y = .8; g.add(cl);
  B(cl, .7, .45, .05, C.black, 0, 0, 0);
  for (let k = 0; k < 5; k++) B(cl, .12, .1, .06, k % 2 ? C.black : C.paper, -.28 + k * .14, .47, 0, { noShadow: true });
  tagStation(g, i);
  poster('house', 1.9, HALF - .06, 3.55, a.z - 1.7, -Math.PI / 2);
  label(STATIONS[i], HALF - .05, 3.4, a.z + 1.5, -Math.PI / 2);
}

/* ── 4 · AI: black racks, and a network thinking above them ── */
function buildAI(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(a.x, 0, a.z); world.add(g);
  const ON = [flat(0xffffff), flat(C.red)], OFF = flat(0x2A2A2C);
  const leds = [];
  [-1.25, 0, 1.25].forEach(z => {
    B(g, 1.1, 2.9, 1.0, C.black2, -.5, 0, z);
    B(g, .02, 2.6, .86, C.black, .06, .15, z, { noShadow: true });
    for (let r = 0; r < 10; r++) for (let c = 0; c < 3; c++){
      const m = new THREE.Mesh(boxGeo(.02, .03, .1), OFF); m.position.set(.08, .4 + r * .24, z - .3 + c * .2); g.add(m); leds.push(m);
    }
  });
  const net = new THREE.Group(); net.position.set(1.0, 3.8, 0); net.rotation.y = Math.PI / 2; g.add(net);
  const LAY = [3, 4, 3, 1], nodes = [];
  LAY.forEach((n, li) => { for (let k = 0; k < n; k++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(.1, 18, 12), li === 3 ? flat(C.red) : mat(C.paper));
    m.position.set((li - 1.5) * .62, (k - (n - 1) / 2) * .42, 0); net.add(m); nodes.push({ m, li });
  } });
  const pts = [], edges = [];
  nodes.forEach(p => nodes.forEach(q => { if (q.li === p.li + 1){ pts.push(p.m.position, q.m.position); edges.push([p.m.position, q.m.position, p.li]); } }));
  net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: lin(0x6A6966) })));
  const pulses = edges.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), flat(C.red)); net.add(m); return m; });
  tagStation(g, i);
  poster('net', 1.7, -HALF + .06, 3.6, a.z + 2.0, Math.PI / 2);
  poster('factory', 1.25, -HALF + .06, 4.0, a.z - 1.1, Math.PI / 2);
  poster('reel', 1.25, -HALF + .06, 4.0, a.z - 2.7, Math.PI / 2);
  label(STATIONS[i], -HALF + .05, 3.3, a.z - 4.5, Math.PI / 2);
  let last = 0;
  anim.push(t => {
    if (t - last > .14){ last = t; leds.forEach((m, k) => { const v = Math.sin(k * 12.9898 + Math.floor(t * 7) * 78.233) * 43758.5453; const r = v - Math.floor(v); m.material = r > .8 ? ON[1] : r > .4 ? ON[0] : OFF; }); }
    const u = (t * .9) % 1, layer = Math.floor((t * .9) % 3);
    edges.forEach((e, k) => { const p = pulses[k]; p.visible = !REDUCED && e[2] === layer; if (p.visible) p.position.lerpVectors(e[0], e[1], u); });
    net.position.y = 3.8 + Math.sin(t * 1.3) * .05;
  });
}

/* ── 5 · The Board: a white pinboard, red thread ── */
function cardCanvas(title, sub, dark){
  const [c, g] = makeCanvas(400, 300);
  g.fillStyle = dark ? HEX.black : HEX.paper; g.fillRect(0, 0, 400, 300);
  g.fillStyle = HEX.red; g.fillRect(0, 0, 400, 10);
  g.fillStyle = dark ? HEX.paper : HEX.black; g.textBaseline = 'alphabetic';
  const px = fitText(g, title.toUpperCase(), 360, 120); g.fillText(title.toUpperCase(), 20, 60 + px * .8);
  g.font = '500 20px "Geist Mono", monospace'; g.fillStyle = dark ? '#B7B4AD' : '#5C5B58'; g.fillText(sub.toUpperCase(), 22, 278);
  return texFrom(c);
}
function buildBoard(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(HALF - .06, 0, a.z); g.rotation.y = -Math.PI / 2; world.add(g);
  B(g, 5.6, 3.2, .06, C.paper, 0, 1.7, 0);
  const items = [
    { tex: texFrom(posterCanvas('cv', 450, 600)), w: .9, h: 1.2, x: -2.2, y: 4.1 },
    { tex: texFrom(posterCanvas('tools', 450, 600)), w: .9, h: 1.2, x: -1.1, y: 4.15 },
    { tex: TEX.fruit, w: .56, h: 1.0, x: -.1, y: 4.05 },
    { tex: TEX.doodle, w: .56, h: 1.0, x: .55, y: 4.12 },
    { tex: cardCanvas('Hustiq', 'Edit by chatting', true), w: 1.0, h: .75, x: 1.7, y: 4.25 },
    { tex: cardCanvas('Travel Atlas', '30+ places, a globe'), w: 1.0, h: .75, x: -1.9, y: 2.55 },
    { tex: cardCanvas('Avatar Maker', 'Presets + parts', true), w: 1.0, h: .75, x: -.6, y: 2.45 },
    { tex: cardCanvas('Daily Rest', 'Pomodoro · Electron'), w: 1.0, h: .75, x: .7, y: 2.55 },
    { tex: cardCanvas('Asset viewer', 'Three.js props', true), w: 1.0, h: .75, x: 2.0, y: 2.45 }
  ];
  const pins = [];
  items.forEach((it, k) => {
    plane(g, it.w, it.h, new THREE.MeshBasicMaterial({ map: it.tex || null, color: it.tex ? 0xffffff : lin(C.paper2) }), it.x, it.y, .05 + k * .002);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), flat(C.red)); pin.position.set(it.x, it.y + it.h / 2 - .05, .09); g.add(pin);
    pins.push(new THREE.Vector3(it.x, it.y + it.h / 2 - .05, .1));
  });
  const order = [0, 5, 6, 1, 2, 7, 3, 8, 4, 0];
  const sp = []; for (let k = 0; k < order.length - 1; k++) sp.push(pins[order[k]], pins[order[k + 1]]);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), new THREE.LineBasicMaterial({ color: lin(C.red) })));
  const st = new THREE.Group(); st.position.set(-1.3, 0, 1.1); g.add(st);
  CYL(st, .3, .3, .06, 24, C.black, 0, .72, 0); [0, 2.1, 4.2].forEach(r => B(st, .04, .72, .04, C.black, Math.sin(r) * .2, 0, Math.cos(r) * .2));
  tagStation(g, i);
}

/* ── 6 · The arcade cabinet ── */
let arcTex = null, arcCtx = null;
function drawArcade(t){
  if (!arcCtx){ const [c, g] = makeCanvas(256, 224); arcCtx = g; arcTex = texFrom(c); }
  const g = arcCtx;
  g.fillStyle = HEX.black; g.fillRect(0, 0, 256, 224);
  const px = ((-t * 60) % 120 + 120) % 120;
  g.fillStyle = HEX.paper; [0, 1, 2].forEach(k => { const x = px + k * 120 - 20, gap = 76 + 20 * Math.sin(k * 2.1); g.fillRect(x, 0, 22, gap - 30); g.fillRect(x, gap + 34, 22, 224); });
  const by = 96 + Math.sin(t * 4) * 18;
  g.fillStyle = HEX.red; g.fillRect(70, by, 18, 14);
  g.fillStyle = HEX.paper; g.font = '600 13px "Geist Mono", monospace'; g.textAlign = 'center';
  if (Math.floor(t * 2) % 2 === 0) g.fillText('PICK A GAME ON THE CARD', 128, 208);
  g.textAlign = 'left';
  arcTex.needsUpdate = true;
}
function buildArcade(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(a.x, 0, a.z); g.rotation.y = .6; world.add(g);
  B(g, 1.4, 1.05, 1.1, C.black2, 0, 0, 0);
  B(g, 1.4, .14, .95, C.black, 0, 1.05, .2, { rx: -.2 });
  B(g, 1.4, 1.5, .5, C.black2, 0, 1.2, -.3);
  B(g, 1.4, .5, .85, C.red, 0, 2.6, -.13);
  drawArcade(0);
  const scr = plane(g, 1.15, 1.0, new THREE.MeshBasicMaterial({ map: arcTex }), 0, 1.92, -.04); scr.rotation.x = -.12;
  const [mc, mg] = makeCanvas(512, 180); mg.fillStyle = HEX.red; mg.fillRect(0, 0, 512, 180); mg.fillStyle = HEX.paper; const mp = fitText(mg, 'ARCADE', 470, 170); mg.fillText('ARCADE', 21, 90 + mp * .38);
  plane(g, 1.3, .46, new THREE.MeshBasicMaterial({ map: texFrom(mc) }), 0, 2.85, .3);
  CYL(g, .03, .03, .2, 8, C.paper, -.3, 1.18, .33); const knob = new THREE.Mesh(new THREE.SphereGeometry(.08, 14, 10), flat(C.red)); knob.position.set(-.3, 1.42, .33); g.add(knob);
  [.15, .38, .6].forEach((x, k) => CYL(g, .065, .065, .05, 16, k === 0 ? C.red : C.paper, x, 1.18, .36));
  tagStation(g, i);
  poster('arcade', 1.5, -HALF + .06, 4.1, a.z + 2.6, Math.PI / 2);
  anim.push(t => drawArcade(t));
}

/* ── 7 · Numbers: black shelving on the white wall ── */
function statCanvas(n, l, v){
  const [c, g] = makeCanvas(300, 400); const s = VARIANT[v];
  g.fillStyle = s.bg; g.fillRect(0, 0, 300, 400);
  if (v === 'white'){ g.strokeStyle = HEX.black; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 297, 397); }
  g.fillStyle = s.fg; g.font = '500 18px "Geist Mono", monospace'; g.fillText(l.toUpperCase(), 18, 36);
  g.fillRect(18, 48, 264, 2);
  fitText(g, n, 270, 260); g.fillText(n, 14, 380);
  return texFrom(c);
}
function buildNumbers(i){
  const a = AT[i], g = new THREE.Group(); g.position.set(a.x, 0, Z_BACK + .5); world.add(g);
  [0, 1.15, 2.3, 3.45].forEach(y => B(g, 3.6, .06, .9, C.black, 0, y + .1, 0));
  B(g, .06, 3.55, .9, C.black, -1.8, 0, 0); B(g, .06, 3.55, .9, C.black, 1.8, 0, 0);
  [['154', 'Builds', 'red'], ['141K', 'Lines of code', 'white'], ['43', 'Three.js', 'black'], ['15', 'P2P games', 'white'],
   ['AIR 8956', 'JEE Advanced', 'black'], ['98.9', 'JEE Main %ile', 'red']].forEach((s, k) => {
    const x = -1.15 + (k % 3) * 1.15, y = k < 3 ? 2.42 : 1.27;
    const p = plane(g, .75, 1.0, new THREE.MeshBasicMaterial({ map: statCanvas(s[0], s[1], s[2]) }), x, y + .52, .05); p.rotation.x = -.06;
  });
  B(g, .6, .6, .6, C.red, -1.0, .16, 0); B(g, .45, .45, .45, C.paper, -.3, .16, .05); B(g, .5, .9, .5, C.black2, .9, .16, 0);
  tagStation(g, i);
  poster('numbers', 1.5, a.x, 5.2, Z_BACK + .04, 0);
}

/* ── 8 · The exit: a black door under the biggest words in the room ── */
function buildContact(i){
  const g = new THREE.Group(); g.position.set(0, 0, Z_BACK + .04); world.add(g);
  B(g, 2.4, 3.9, .1, C.black, 0, 0, .05);
  B(g, .05, .3, .05, C.paper, .85, 1.75, .14);
  const [c, gg] = makeCanvas(1600, 520);
  gg.fillStyle = HEX.red; const px = fitText(gg, 'LET’S BUILD', 1600, 520); gg.fillText('LET’S BUILD', 0, 260 + px * .38);
  plane(g, 6.4, 2.08, new THREE.MeshBasicMaterial({ map: texFrom(c), transparent: true }), 0, 5.35, .02);
  const mb = new THREE.Group(); mb.position.set(-2.4, 0, 1.4); g.add(mb);
  B(mb, .06, 1.1, .06, C.black, 0, 0, 0);
  B(mb, .46, .42, .78, C.red, 0, 1.1, 0);
  B(mb, .3, .03, .22, C.paper, 0, 1.52, .1, { rx: .3 });
  const m = plane(world, 2.4, 1.0, flat(C.black), 0, .02, Z_BACK + 1.2); m.rotation.x = -Math.PI / 2;
  const pl = new THREE.Group(); world.add(pl);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .5, -.3, 0, -.3, 0, .05, -.15, 0, 0, .5, 0, .05, -.15, .3, 0, -.3], 3));
  pg.computeVertexNormals();
  pl.add(new THREE.Mesh(pg, mat(C.paper, { side: THREE.DoubleSide })));
  tagStation(g, i);
  anim.push(t => {
    const u = REDUCED ? 0 : t * .5;
    pl.position.set(Math.sin(u) * 2.6, 3.4 + Math.sin(u * 2) * .3, Z_BACK + 2.6 + Math.cos(u) * 1.2);
    pl.rotation.set(0, u + Math.PI / 2, Math.sin(u * 2) * .3);
  });
}

/* ── markers: a small cube over each station; white once found ── */
const RING = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.68, 64), new THREE.MeshBasicMaterial({ color: lin(C.red), transparent: true, opacity: .9, depthWrite: false }));
RING.rotation.x = -Math.PI / 2; RING.visible = false; world.add(RING);
const MK_OFF = flat(C.red), MK_ON = flat(0xffffff);
function buildMarkers(){
  AT.forEach((a, i) => {
    const m = new THREE.Mesh(boxGeo(.24, .24, .24), found.has(STATIONS[i].id) ? MK_ON : MK_OFF);
    m.position.set(i === 5 ? HALF - 1.2 : a.x, i === 5 ? 5.4 : i === 8 ? 4.4 : i === 4 ? 5.0 : 3.6, a.z);
    m.userData.st = i; m.userData.y = m.position.y; pick.push(m); world.add(m); MARK.push(m);
  });
}

function buildLights(){
  scene.add(new THREE.HemisphereLight(0xffffff, 0xCFCBC4, .75));
  const key = new THREE.DirectionalLight(0xFFFFFF, .55);
  key.position.set(4, 16, 8); key.target.position.set(0, 0, -18); scene.add(key.target);
  if (!LOW){
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    const s = key.shadow.camera; s.left = -14; s.right = 14; s.top = 24; s.bottom = -24; s.near = 1; s.far = 60;
    key.shadow.bias = -.0005; key.shadow.radius = 4;
  }
  scene.add(key);
}

/* ══ the lanes in 3D ════════════════════════════════════════ */
const laneEls = [$('#laneL'), $('#laneR')];
const lanes = laneEls.map((el, k) => {
  const o = new THREE.CSS3DObject(el);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide }));
  o.add(hole); scene.add(o);
  return { el, o, hole, strip: $('.strip', el), head: $('.lane-h', el), side: k === 0 ? -1 : 1, travel: 0 };
});
const Y0 = 3.3, ZL = .6, DIST = 7;
let VW = innerWidth, VH = innerHeight, seamPx = 0, laneW = 0, sScreen = 1, sWall = 1;
let pTarget = 0, pNow = 0, lastHere = -2, lastPhase = '';
function layout(){
  VW = innerWidth; VH = innerHeight;
  seamPx = VW >= 1000 ? clamp(VW * .3, 380, 460) : VW >= 760 ? 330 : 0;
  laneW = Math.round((VW - seamPx) / 2);
  document.documentElement.style.setProperty('--seam', seamPx + 'px');
  sScreen = 2 * DIST * Math.tan(FOV * Math.PI / 360) / VH;
  sWall = Math.min(6.4 / VH, 7.6 / laneW);
  lanes.forEach(L => {
    L.el.style.width = laneW + 'px'; L.el.style.height = VH + 'px';
    L.el.classList.toggle('wide', laneW >= 440);
    L.el.classList.toggle('thin', laneW < 300);
    L.hole.geometry.dispose(); L.hole.geometry = new THREE.PlaneGeometry(laneW, VH);
    L.strip.style.paddingTop = (L.head.offsetHeight + 4) + 'px';
    L.travel = Math.max(0, L.strip.offsetHeight - VH);
  });
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
  renderer.setSize(VW, VH, false); css.setSize(VW, VH);
  const keep = pTarget;
  $('#scroller').style.height = Math.round((TOTAL / 100 + 1) * VH) + 'px';
  scrollTo(0, keep / 100 * VH);
}
const _up = new THREE.Vector3(0, 1, 0);
function placeLanes(t){
  /* t: 0 = flat across the screen, 1 = open against the side walls */
  const a = ease(clamp(t, 0, 1));
  lanes.forEach(L => {
    const s = lerp(sScreen, sWall, a);
    const hx = lerp(L.side * (VW / 2) * sScreen, L.side * (HALF - .04), a);
    const hy = lerp(Y0, .3 + VH * sWall / 2, a), hz = lerp(ZL, -.3, a);
    const th = -L.side * a * Math.PI / 2;
    const off = -L.side * laneW / 2 * s;            // from the hinge to the middle of the lane
    L.o.position.set(hx + off * Math.cos(th), hy, hz - off * Math.sin(th));
    L.o.quaternion.setFromAxisAngle(_up, th);
    L.o.scale.setScalar(s);
  });
}

/* ══ camera poses ═══════════════════════════════════════════ */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const DOOR = { pos: V3(0, Y0, ZL + DIST), look: V3(0, Y0, ZL - 20) };
const HALLP = { pos: V3(0, 4.6, 3.6), look: V3(0, 1.6, -19), u: 0, v: 0 };
let REVEAL = { pos: V3(0, 17, 17), look: V3(0, -1, -14) };
function stationPose(i){
  const a = AT[i], s = STATIONS[i];
  let pos, u;
  if (s.id === 'arcade'){ pos = V3(-2.0, 2.8, a.z + 5.6); u = -.2; }
  else if (s.id === 'trophies'){ pos = V3(1.0, 2.8, a.z + 6.9); u = .22; }
  else if (s.id === 'contact'){ return { pos: V3(0, 3.3, a.z + 11.5), look: V3(0, 3.5, a.z), u: .22, v: 0 }; }
  else if (s.id === 'board'){ pos = V3(-1.6, 3.0, a.z + 4.6); u = .24; }
  else { const left = a.x < 0; pos = V3(left ? 2.1 : -2.1, 2.9, a.z + 4.4); u = left ? -.22 : .22; }
  return { pos, look: V3(a.x, a.y, a.z), u, v: 0 };
}
let POSES = [];
function buildPoses(){
  const narrow = VW < 760;
  POSES = [HALLP].concat(STATIONS.map((s, i) => {
    const p = stationPose(i);
    if (narrow){
      const back = p.pos.clone().sub(p.look); back.y = 0; back.multiplyScalar(.45);
      p.pos.add(back); p.pos.x = clamp(p.pos.x, -2.4, 2.4); p.pos.y += .5; p.u = 0; p.v = .24;
    }
    return p;
  }));
  /* the reveal frames the whole model, from further away on a tall screen */
  const k = clamp(1.2 / (VW / VH), .8, 2.2);
  REVEAL = { pos: V3(0, 14 + 6 * k, 13 + 10 * k), look: V3(0, -1, -15) };
}
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
function applyPose(pos, look, u, v){
  camera.position.copy(pos);
  camera.lookAt(look);
  const tH = Math.tan(FOV * Math.PI / 360);
  if (u) camera.rotateY(Math.atan(u * tH * camera.aspect));
  if (v) camera.rotateX(-Math.atan(v * tH));
}

/* ══ the director: scroll in, everything out ════════════════ */
function readScroll(){ pTarget = clamp(scrollY / VH * 100, 0, TOTAL); }
addEventListener('scroll', () => { readScroll(); armSnap(); }, { passive: true });

const seamCard = $('#seamCard'), mergeCap = $('#mergeCap'), tkFill = $('#tkFill');
function phaseOf(p){ return p < ACT1 ? 'act1' : p < HALL_AT ? 'merge' : 'room'; }
function hereOf(p){
  if (p < HALL_AT - 25) return -2;
  const k = (p - HALL_AT) / STEP, r = Math.round(k);
  return Math.abs(k - r) < .24 ? r - 1 : -3;            // -1 hall, -3 walking
}

function direct(p, t){
  const ph = phaseOf(p);
  if (ph !== lastPhase){
    body.classList.toggle('act1', ph === 'act1'); body.classList.toggle('merge', ph === 'merge'); body.classList.toggle('room', ph === 'room');
    if (ph === 'merge' && lastPhase === 'act1') sfx('merge');
    lastPhase = ph;
  }
  /* Act I: the strips run in opposite directions */
  const t1 = clamp(p / ACT1, 0, 1);
  lanes[0].strip.style.transform = 'translate3d(0,' + (-t1 * lanes[0].travel).toFixed(1) + 'px,0)';
  lanes[1].strip.style.transform = 'translate3d(0,' + (-(1 - t1) * lanes[1].travel).toFixed(1) + 'px,0)';
  const so = VW < 760 ? 1 - smooth(10, 45, p) : 1 - smooth(ACT1 * .82, ACT1 + 10, p);
  seamCard.style.opacity = so.toFixed(3); seamCard.style.visibility = so < .02 ? 'hidden' : 'visible';
  const mc = smooth(ACT1 + MERGE * .4, ACT1 + MERGE * .5, p) * (1 - smooth(ACT1 + MERGE * .64, ACT1 + MERGE * .72, p));
  mergeCap.style.opacity = mc.toFixed(3);

  /* Act II: doors open, the camera lifts out to the whole model, then drops in */
  const tm = clamp((p - ACT1) / MERGE, 0, 1);
  placeLanes(smooth(0, .36, tm));
  lanes.forEach(L => { L.o.visible = p < HALL_AT + STEP * .6; });
  if (p < HALL_AT){
    const up = ease(smooth(.3, .58, tm)), down = ease(smooth(.7, 1, tm));
    tmpPos.lerpVectors(DOOR.pos, REVEAL.pos, up).lerp(HALLP.pos, down);
    tmpLook.lerpVectors(DOOR.look, REVEAL.look, up).lerp(HALLP.look, down);
    if (!REDUCED && p < ACT1) tmpLook.x += Math.sin(t * .25) * .3;
    applyPose(tmpPos, tmpLook, 0, 0);
  } else {
    /* Act III: walk between poses, resting at each one */
    const k = clamp((p - HALL_AT) / STEP, 0, N), i = Math.min(N - 1, Math.floor(k));
    const f = ease(smooth(.2, .8, k - i));
    const A = POSES[i], Bp = POSES[Math.min(N, i + 1)];
    tmpPos.lerpVectors(A.pos, Bp.pos, f); tmpLook.lerpVectors(A.look, Bp.look, f);
    if (!REDUCED) tmpPos.y += Math.sin(t * .9) * .02;
    applyPose(tmpPos, tmpLook, lerp(A.u, Bp.u, f), lerp(A.v, Bp.v, f));
  }
  const here = hereOf(p);
  if (here !== lastHere){ arrive(here); lastHere = here; }
  tkFill.style.width = (100 * p / TOTAL).toFixed(2) + '%';
}

/* ══ HUD ════════════════════════════════════════════════════ */
const obj = $('#obj');
function where(){
  const p = pNow;
  if (p < ACT1) return 'Two halves';
  if (p < HALL_AT) return 'One room';
  const h = hereOf(p);
  if (h === -1) return 'The room';
  if (h >= 0) return STATIONS[h].title;
  return 'Walking';
}
function fillObj(s, i){
  obj.dataset.side = s.side;
  $('#objSide').textContent = SIDE_LABEL[s.side];
  $('#objN').textContent = (i < 0 ? '00' : String(i + 1).padStart(2, '0')) + ' / ' + String(N).padStart(2, '0');
  $('#objT').textContent = s.title;
  $('#objP').textContent = s.blurb;
  let pts = $('#objPts');
  if (!pts){ pts = document.createElement('ul'); pts.id = 'objPts'; pts.className = 'obj-pts'; $('#objP').after(pts); }
  pts.innerHTML = s.pts.map(t => '<li>' + esc(t) + '</li>').join(''); pts.hidden = !s.pts.length;
  $('#objChips').innerHTML = s.chips.map(c => '<span>' + esc(c) + '</span>').join('');
  const act = $('#objAct'); act.innerHTML = '';
  const btn = (labelTxt, cls, attrs) => { const b = document.createElement(attrs && attrs.href ? 'a' : 'button'); b.className = 'btn btn-sm ' + (cls || ''); b.innerHTML = labelTxt;
    if (b.tagName === 'BUTTON') b.type = 'button'; Object.keys(attrs || {}).forEach(k => b.setAttribute(k, attrs[k])); act.appendChild(b); return b; };
  if (i < 0){ btn('Keep scrolling ↓', 'btn-solid', { 'data-next': '' }); btn('All stations', '', { 'data-menu': '' }); return; }
  if (s.id === 'arcade'){ Object.keys(GAMES).forEach((k, n) => btn('▶ ' + GAMES[k].name, n ? '' : 'btn-solid', { 'data-play': k })); return; }
  btn('Read more', 'btn-solid', { 'data-inspect': s.id });
  if (s.id === 'contact'){ btn('Copy email', '', { 'data-copy': 'aayushkumarofficial21@gmail.com' }); btn('Email me', '', { href: 'mailto:aayushkumarofficial21@gmail.com' }); return; }
  const first = $('.st-go a', s.el);
  if (first) btn(esc(first.textContent), '', { href: first.href, target: '_blank', rel: 'noopener' });
}
obj.addEventListener('click', e => {
  if (e.target.closest('[data-next]')) travel(posOf(0));
  if (e.target.closest('[data-menu]')) openMenu();
});
function arrive(here){
  $('#where').textContent = where();
  if (here === -2 || here === -3){ obj.classList.remove('show'); markHere(-9); return; }
  const s = here < 0 ? HALL : STATIONS[here];
  fillObj(s, here);
  const right = here >= 0 && POSES[here + 1].u < 0;
  obj.classList.toggle('right', right); obj.classList.toggle('left', !right);
  obj.classList.add('show');
  markHere(here);
  if (here >= 0){
    sfx('step');
    if (s.id === 'hexabed' && hexRegen) hexRegen(clockT);
    if (!found.has(s.id)) discover(here);
  }
}
function discover(i){
  const s = STATIONS[i];
  found.add(s.id); store.set('aak-found', Array.from(found).join(','));
  MARK[i].material = MK_ON;
  renderPips();
  toast(found.size + '/' + N, 'Found <b>' + esc(s.title) + '</b>');
  sfx('found');
  if (found.size === N) setTimeout(() => { toast('9/9', '<b>Every station found.</b> Thanks for walking the room.'); sfx('all'); }, 900);
}
function renderPips(){
  $('#pips').innerHTML = STATIONS.map(s => '<i class="' + (found.has(s.id) ? 'on' : '') + '"></i>').join('');
  $('#foundN').textContent = found.size + '/' + N;
  $$('#ticks button[data-i]').forEach(b => b.classList.toggle('found', found.has(STATIONS[+b.dataset.i].id)));
}
function markHere(i){ $$('#ticks button[data-i]').forEach(b => b.classList.toggle('here', +b.dataset.i === i)); }

function buildTrack(){
  const box = $('#ticks');
  const lab = (txt, p) => { const s = document.createElement('span'); s.className = 'tk-l'; s.textContent = txt; s.style.left = (100 * p / TOTAL) + '%'; box.appendChild(s); };
  lab('Two halves', 0); lab('Merge', ACT1); lab('The room', HALL_AT);
  STATIONS.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
    b.style.left = (100 * posOf(i) / TOTAL - (i === N - 1 ? 1.2 : 0)) + '%';
    b.setAttribute('aria-label', 'Go to ' + s.title); b.title = s.title;
    b.addEventListener('click', () => travel(posOf(i)));
    box.appendChild(b);
  });
  renderPips();
}
function travel(p){ closeOverlay(); scrollTo({ top: p / 100 * VH, behavior: REDUCED ? 'auto' : 'smooth' }); }
function stepTo(dir){
  const p = pTarget;
  const next = dir > 0 ? KEYS.find(k => k > p + 2) : KEYS.slice().reverse().find(k => k < p - 2);
  if (next !== undefined) travel(next);
}
$('#prevBtn').addEventListener('click', () => stepTo(-1));
$('#nextBtn').addEventListener('click', () => stepTo(1));
$('.player').addEventListener('click', e => { e.preventDefault(); travel(0); });

/* when scrolling stops inside the room, settle on the nearest station */
let snapT = 0;
function armSnap(){
  clearTimeout(snapT);
  snapT = setTimeout(() => {
    if (openLayer || pTarget < HALL_AT - STEP * .5) return;
    const near = KEYS.reduce((b, k) => Math.abs(k - pTarget) < Math.abs(b - pTarget) ? k : b, KEYS[0]);
    if (Math.abs(near - pTarget) > 1.5 && Math.abs(near - pTarget) < STEP * .5) travel(near);
  }, 260);
}

function openMenu(){
  const l = $('#menuL'); l.innerHTML = '';
  [{ title: 'The two halves', side: 'both', p: 0 }, { title: 'The room', side: 'both', p: HALL_AT }].concat(STATIONS.map(s => ({ title: s.title, side: s.side, p: posOf(s.i), id: s.id }))).forEach((s, k) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.innerHTML = '<span class="n">' + String(k).padStart(2, '0') + '</span><span class="t">' + esc(s.title) + (s.id && found.has(s.id) ? '<span class="f">found</span>' : '') + '</span><span class="s ' + s.side + '">' + (s.side === 'both' ? 'Both' : s.side === 'eng' ? 'Engineer' : 'Creator') + '</span>';
    b.addEventListener('click', () => travel(s.p));
    li.appendChild(b); l.appendChild(li);
  });
  openOverlay($('#menu'));
}
$('#foundBtn').addEventListener('click', openMenu);
$('#map').addEventListener('click', openMenu);

function inspect(id){
  const s = STATIONS.find(x => x.id === id); if (!s) return;
  const bodyEl = $('#dosBody');
  bodyEl.innerHTML = s.el.innerHTML;
  const h = $('h2', bodyEl); if (h) h.id = 'dosT';
  $('#dosK').textContent = SIDE_LABEL[s.side] + ' · ' + String(s.i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
  openOverlay($('#dossier'));
  $('.dos-card').scrollTop = 0;
  sfx('open');
}

addEventListener('keydown', e => {
  if (e.key === 'Escape'){ closeOverlay(); return; }
  if (openLayer || (e.target.closest && e.target.closest('input,textarea'))) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowright' || k === 'd'){ e.preventDefault(); stepTo(1); }
  else if (k === 'arrowleft' || k === 'a'){ e.preventDefault(); stepTo(-1); }
  else if (k === 'e'){ const h = hereOf(pTarget); if (h >= 0) inspect(STATIONS[h].id); }
  else if (k === 'm') openMenu();
  else if (/^[1-9]$/.test(k)) travel(posOf(+k - 1));
});

/* the plan */
const SVGNS = 'http://www.w3.org/2000/svg';
let mapMe = null;
function buildMap(){
  const svg = $('#mapSvg');
  const el = (n, a) => { const e = document.createElementNS(SVGNS, n); Object.keys(a).forEach(k => e.setAttribute(k, a[k])); svg.appendChild(e); return e; };
  el('rect', { x: -9, y: -34, width: 18, height: 35, fill: '#F3F1EC' });
  el('rect', { x: -9, y: -34, width: 1.2, height: 35, fill: '#3A3A3C' });
  el('rect', { x: 7.8, y: -34, width: 1.2, height: 35, fill: '#F23A1D' });
  el('line', { x1: 0, y1: -34, x2: 0, y2: 1, stroke: '#F23A1D', 'stroke-width': .4 });
  AT.forEach((a, i) => { const c = el('rect', { x: clamp(a.x, -7.4, 7.4) - .9, y: clamp(a.z, -32.6, 0) - .9, width: 1.8, height: 1.8, fill: '#0C0C0D' }); c.dataset.i = i; });
  mapMe = el('path', { d: 'M0 -2.4L1.6 1.4L0 .5L-1.6 1.4Z', fill: '#F23A1D' });
}
const _dir = new THREE.Vector3();
function updateMap(){
  if (!mapMe) return;
  camera.getWorldDirection(_dir);
  const ang = Math.atan2(_dir.x, -_dir.z) * 180 / Math.PI;
  mapMe.setAttribute('transform', 'translate(' + clamp(camera.position.x, -8.5, 8.5).toFixed(2) + ' ' + clamp(camera.position.z, -33.5, .8).toFixed(2) + ') rotate(' + ang.toFixed(1) + ')');
  $$('#mapSvg rect[data-i]').forEach(c => c.setAttribute('fill', found.has(STATIONS[+c.dataset.i].id) ? '#F23A1D' : '#0C0C0D'));
}

/* ══ the pointer, optional: hover rings, click walks or reads ══ */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const tip = $('#tip');
let hover = -1;
function hitAt(x, y){
  ndc.set(x / VW * 2 - 1, -(y / VH) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(pick, false)[0];
  return h ? h.object.userData.st : -1;
}
function overUI(t){ return !t || !t.closest || !!t.closest('#hud .obj,#hud .hud-top,#hud .track,#hud .map,.lane,.menu,.dossier,.arcade,#gate'); }
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' || openLayer || pNow < HALL_AT - 30 || overUI(e.target)){ if (hover !== -1){ hover = -1; tip.hidden = true; body.style.cursor = ''; } return; }
  const i = hitAt(e.clientX, e.clientY);
  if (i !== hover){
    hover = i; body.style.cursor = i >= 0 ? 'pointer' : '';
    if (i >= 0) tip.innerHTML = (hereOf(pTarget) === i ? 'Read more · ' : 'Go to · ') + esc(STATIONS[i].title);
    tip.hidden = i < 0;
  }
  if (i >= 0){ tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; }
});
addEventListener('click', e => {
  if (openLayer || overUI(e.target) || pNow < HALL_AT - 30) return;
  if (e.target.closest('a,button')) return;
  const i = hitAt(e.clientX, e.clientY);
  if (i < 0) return;
  if (hereOf(pTarget) === i) inspect(STATIONS[i].id); else travel(posOf(i));
});
$$('.lc[data-go]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  const s = STATIONS.find(x => x.id === a.dataset.go);
  if (s) travel(posOf(s.i));
}));

/* ══ the loop ═══════════════════════════════════════════════ */
let clockT = 0, lastNow = performance.now();
function frame(now){
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastNow) / 1000); lastNow = now; clockT += dt;
  pNow = REDUCED ? pTarget : pNow + (pTarget - pNow) * (1 - Math.exp(-dt * 6));
  if (Math.abs(pTarget - pNow) < .01) pNow = pTarget;
  direct(pNow, clockT);
  anim.forEach(f => f(clockT, dt));
  MARK.forEach((m, i) => { m.rotation.y = clockT * (hover === i ? 3 : .8); m.rotation.x = .6; m.position.y = m.userData.y + Math.sin(clockT * 1.6 + i) * .06; });
  if (hover >= 0){ const a = AT[hover]; RING.visible = true; RING.position.set(clamp(a.x, -7.2, 7.2), .03, a.z); }
  else RING.visible = false;
  if (ceiling) ceiling.visible = camera.position.y < RH - .2;
  renderer.render(scene, camera);
  css.render(scene, camera);
  if (Math.floor(clockT * 10) % 3 === 0) updateMap();
  if (Math.floor(clockT * 4) !== Math.floor((clockT - dt) * 4)) $('#where').textContent = where();
}

/* ══ boot ═══════════════════════════════════════════════════ */
let resizeT = 0, lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    /* a phone's address bar sliding away is not worth a relayout */
    if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 140) return;
    lastW = innerWidth; lastH = innerHeight;
    layout(); buildPoses();
  }, 160);
});
history.scrollRestoration = 'manual';
loadAll().then(() => {
  buildLights(); buildShell();
  [buildArthis, buildBlender, buildHexa, buildAkverse, buildAI, buildBoard, buildArcade, buildNumbers, buildContact].forEach((f, i) => f(i));
  buildMarkers(); buildTrack(); buildMap();
  layout(); buildPoses();
  const want = location.hash.replace('#st-', '').replace('#', '');
  const s = STATIONS.find(x => x.id === want);
  if (s){ pTarget = pNow = posOf(s.i); scrollTo(0, pTarget / 100 * VH); }
  else { scrollTo(0, 0); readScroll(); pNow = pTarget; }
  loadedN = loadTotal; progress();
  running = true; requestAnimationFrame(frame);
  setTimeout(start, Math.max(REDUCED ? 0 : 500, 1100 - (performance.now() - bootAt)));
});
})();
