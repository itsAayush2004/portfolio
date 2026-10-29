/* ════════════════════════════════════════════════════════════════
   TWO HALVES, NINE ROOMS

   Scroll is the only control you need. It drives one camera through
   three acts:
     I   two lanes of real HTML, the engineer (black) and the creator
         (red), scroll past each other; the hall shows through the seam
     II  the lanes swing open on their outer edges like doors and settle
         on the hall's side walls; the camera lifts out to show the whole
         building as a cut-away model, then dives back in
     III the camera walks through nine rooms in a serpentine, doorway by
         doorway: black rooms for the engineer, red for the creator,
         white for both. Each room has one piece, one poster, one label,
         and its card builds itself as you arrive.

   The lanes are CSS3DObjects and the rooms are WebGL, drawn from the
   same camera. The canvas sits on top and cuts a clear hole where each
   lane is. Every word lives in #codex as plain HTML.

   Proportions follow φ: posters are golden rectangles, the station sits
   on the screen's golden line, type and spacing step by φ.
   ════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const body = document.body;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PHI = 1.618;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const store = {
  get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} },
  del(k){ try { localStorage.removeItem(k); } catch (e) {} }
};

/* ══ the palette, shared by the posters, the canvas and the rooms ═ */
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

/* ══ the game marks: one geometric symbol and a stacked name per game ══ */
const GAMEMARKS = {
  fruit:  { name: ['Fruit', 'Blast'],    v: 'red' },
  doodle: { name: ['Doodle', 'Militia'], v: 'black' },
  chess:  { name: ['Chess'],             v: 'white' },
  tennis: { name: ['Table', 'Tennis'],   v: 'black-red' }
};
/* each mark is drawn on a 100 × 100 grid, once as SVG and once on canvas */
const MARKS = {
  fruit:  (fg, hl) => [['c', 52, 60, 27, hl], ['c', 27, 33, 14, fg], ['c', 74, 26, 10, fg], ['r', 50, 22, 4, 16, fg]],
  doodle: (fg, hl) => [['ring', 50, 50, 30, 7, fg], ['r', 46.5, 6, 7, 26, fg], ['r', 46.5, 68, 7, 26, fg], ['r', 6, 46.5, 26, 7, fg], ['r', 68, 46.5, 26, 7, fg], ['c', 50, 50, 8, hl]],
  chess:  (fg, hl) => { const o = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) o.push(['r', 14 + x * 18, 14 + y * 18, 18, 18, x === 2 && y === 2 ? hl : fg]); return o; },
  tennis: (fg, hl) => [['c', 42, 42, 28, fg], ['r', 58, 62, 11, 30, fg, 45], ['c', 80, 22, 8, hl]]
};
function markSVG(key, fg, hl){
  const parts = MARKS[key](fg, hl).map(m => m[0] === 'c' ? '<circle cx="' + m[1] + '" cy="' + m[2] + '" r="' + m[3] + '" fill="' + m[4] + '"/>'
    : m[0] === 'ring' ? '<circle cx="' + m[1] + '" cy="' + m[2] + '" r="' + m[3] + '" fill="none" stroke="' + m[5] + '" stroke-width="' + m[4] + '"/>'
    : '<rect x="' + m[1] + '" y="' + m[2] + '" width="' + m[3] + '" height="' + m[4] + '" fill="' + m[5] + '"' + (m[6] ? ' transform="rotate(' + m[6] + ' ' + (m[1] + m[3] / 2) + ' ' + (m[2] + m[4] / 2) + ')"' : '') + '/>').join('');
  return '<svg viewBox="0 0 100 100" aria-hidden="true">' + parts + '</svg>';
}
function gameHTML(key){
  const gm = GAMEMARKS[key], v = VARIANT[gm.v];
  return '<div class="gm" style="background:' + v.bg + ';color:' + v.fg + '">' + markSVG(key, v.fg, v.hl) + '<b>' + gm.name.map(esc).join('<br>') + '</b></div>';
}
$$('.lc-art[data-games]').forEach(f => { f.innerHTML = Object.keys(GAMEMARKS).map(gameHTML).join(''); });

/* letters that rise out of a mask in the intro */
function splitChars(el){
  const t = el.textContent; el.setAttribute('aria-label', t);
  el.innerHTML = Array.from(t).map((c, k) => c === ' ' ? ' ' : '<span class="ch" aria-hidden="true" style="--i:' + k + '">' + esc(c) + '</span>').join('');
}
$$('.lane-h b, .seam-name span').forEach(splitChars);
$$('.lane').forEach(l => $$('.lc', l).forEach((c, k) => c.style.setProperty('--k', k)));

/* ══ the stations, read from the codex ═══════════════════════ */
const STATIONS = $$('#codex .st').map((a, i) => ({
  i, id: a.dataset.id, side: a.dataset.side, title: a.dataset.title,
  blurb: a.dataset.blurb, chips: (a.dataset.chips || '').split('|').filter(Boolean).slice(0, 2), el: a
}));
const N = STATIONS.length;
const SIDE_LABEL = { eng: 'Engineer room', cre: 'Creator room', both: 'Shared room' };
const HALL = { id: 'hall', side: 'both', title: 'Nine rooms',
  blurb: 'Black rooms hold the engineering, red rooms the creative work.', chips: ['9 rooms', '4 games'] };

const GAMES = {
  flappy: { file: 'game-flappy.html', name: 'Flappy Fird',    hint: 'Tap, or press Space, to flap' },
  runner: { file: 'game-runner.html', name: 'Trigger Runner', hint: 'Tap, or press Space, to jump' },
  g3072:  { file: 'game-3072.html',   name: '3072',           hint: 'Swipe, or use the arrow keys' },
  sudoku: { file: 'game-sudoku.html', name: 'Sudoku',         hint: 'Tap a cell, then tap a number' }
};

/* ══ the scroll timeline, in viewport-heights × 100 ═════════ */
const ACT1 = 220, MERGE = 240, STEP = 100;
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
  while (box.children.length > 1) box.firstChild.remove();
}

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

/* ── the loader lifts away by itself once everything is built ── */
const gateFill = $('#gateFill'), gateMsg = $('#gateMsg');
let loadedN = 0, loadTotal = 1;
function progress(){
  const k = Math.round(100 * loadedN / loadTotal);
  gateFill.style.width = k + '%';
  gateMsg.textContent = 'Loading ' + k + '%';
}
const bootAt = performance.now();
function start(){ body.classList.remove('booting'); body.classList.add('intro'); }

/* ── three ── */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.25 : 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const css = new THREE.CSS3DRenderer();
$('#css3d').appendChild(css.domElement);

const scene = new THREE.Scene();
const FOV = 50;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 260);

const C = { black: 0x0C0C0D, black2: 0x1C1C1F, paper: 0xF3F1EC, paper2: 0xDEDBD4, red: 0xF23A1D, steel: 0x6E6D6A, oak: 0xC9A27A };
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const MATS = new Map();
function mat(hex, o){
  if (!o && MATS.has(hex)) return MATS.get(hex);
  const M = LOW ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  const m = new M(Object.assign({ color: lin(hex) }, LOW ? {} : { roughness: .8, metalness: 0 }, o || {}));
  if (!o) MATS.set(hex, m);
  return m;
}
const flat = (hex, o) => new THREE.MeshBasicMaterial(Object.assign({ color: lin(hex) }, o || {}));
/* anything laid flat on another surface is pulled forward in depth, so it never fights it */
const decal = (map, o) => new THREE.MeshBasicMaterial(Object.assign({ map, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o || {}));
const toM = m => typeof m === 'number' ? mat(m) : m;

const GEO = new Map();
function boxGeo(w, h, d){
  const k = 'b' + w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  if (!GEO.has(k)) GEO.set(k, new THREE.BoxGeometry(w, h, d));
  return GEO.get(k);
}
/* a box with softened edges: a rounded plan, bevelled top and bottom */
function rgeo(w, h, d, r){
  r = Math.min(r, w / 2 - .002, d / 2 - .002, h / 2 - .002);
  const k = 'r' + [w, h, d, r].map(v => v.toFixed(3)).join(',');
  if (GEO.has(k)) return GEO.get(k);
  const W = w - 2 * r, Dd = d - 2 * r, c = Math.min(r, W / 2, Dd / 2) * .9, s = new THREE.Shape();
  s.moveTo(-W / 2 + c, -Dd / 2); s.lineTo(W / 2 - c, -Dd / 2); s.quadraticCurveTo(W / 2, -Dd / 2, W / 2, -Dd / 2 + c);
  s.lineTo(W / 2, Dd / 2 - c); s.quadraticCurveTo(W / 2, Dd / 2, W / 2 - c, Dd / 2); s.lineTo(-W / 2 + c, Dd / 2);
  s.quadraticCurveTo(-W / 2, Dd / 2, -W / 2, Dd / 2 - c); s.lineTo(-W / 2, -Dd / 2 + c); s.quadraticCurveTo(-W / 2, -Dd / 2, -W / 2 + c, -Dd / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: LOW ? 1 : 3, curveSegments: LOW ? 2 : 5 });
  g.rotateX(-Math.PI / 2); g.translate(0, r, 0); g.computeVertexNormals();
  GEO.set(k, g); return g;
}
function mesh(par, g, m, x, y, z, o){
  o = o || {};
  const me = new THREE.Mesh(g, toM(m)); me.position.set(x, y, z);
  if (o.ry) me.rotation.y = o.ry; if (o.rx) me.rotation.x = o.rx; if (o.rz) me.rotation.z = o.rz;
  me.castShadow = !o.noShadow; me.receiveShadow = true; par.add(me); return me;
}
/* B: sharp box, R: rounded box; both with their bottom at y */
const B = (par, w, h, d, m, x, y, z, o) => mesh(par, boxGeo(w, h, d), m, x, y + h / 2, z, o);
const R = (par, w, h, d, m, x, y, z, o) => mesh(par, rgeo(w, h, d, (o && o.r) || .035), m, x, y, z, o);
function CYL(par, rt, rb, h, seg, m, x, y, z, o){ return mesh(par, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z, o); }
/* turned shapes: plinths, lamps, cups. pts are [radius, height] pairs */
function LATHE(par, pts, m, x, y, z, seg){ return mesh(par, new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || (LOW ? 20 : 40)), m, x, y, z); }
function plane(par, w, h, m, x, y, z, ry){
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  me.position.set(x, y, z); me.rotation.y = ry || 0; par.add(me); return me;
}

/* ── canvas: the same posters, for the walls ── */
function makeCanvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texFrom(c){ const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = LOW ? 2 : 8; return t; }
function posterFont(g, px){
  g.font = '900 ' + px + 'px Archivo, "Helvetica Neue", Arial, sans-serif';
  if ('fontStretch' in g) g.fontStretch = 'extra-condensed';
}
function fitText(g, text, width, maxPx){
  posterFont(g, 100); const w = g.measureText(text).width || 1;
  const px = Math.min(maxPx, 100 * width / w); posterFont(g, px); return px;
}
function halftone(g, draw, w, h, color, step){
  const [, og] = makeCanvas(w, h); draw(og);
  const d = og.getImageData(0, 0, w, h).data;
  g.fillStyle = color;
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step){
    if (d[((y | 0) * w + (x | 0)) * 4 + 3] > 120){ g.beginPath(); g.arc(x, y, step * .46, 0, Math.PI * 2); g.fill(); }
  }
}
/* a poster is a golden rectangle, W × W·φ */
function posterCanvas(key, W){
  const H = Math.round(W * PHI), p = POSTERS[key], v = VARIANT[p.v];
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
    const draw = gg => { gg.fillStyle = v.fg; const px = fitText(gg, p.big.toUpperCase(), W * 1.02, H * .5); gg.fillText(p.big.toUpperCase(), -W * .02, H + px * .06); };
    if (p.dots) halftone(g, draw, W, H, v.fg, Math.round(W / 90)); else draw(g);
  } else {
    const words = p.words.map(w => w.toUpperCase());
    let px = Infinity; words.forEach(w => { px = Math.min(px, fitText(g, w, W * .94, H * (p.small ? .16 : .24))); });
    posterFont(g, px);
    words.forEach((w, k) => { g.fillStyle = k === p.hl ? v.hl : v.fg; g.fillText(w, m * .7, H - m * .6 - (words.length - 1 - k) * px * .82); });
  }
  return c;
}
/* a game mark on canvas: a golden rectangle, symbol on top, name below */
function gameCanvas(key, W){
  const H = Math.round(W * PHI), gm = GAMEMARKS[key], v = VARIANT[gm.v], [c, g] = makeCanvas(W, H);
  g.fillStyle = v.bg; g.fillRect(0, 0, W, H);
  if (gm.v === 'white'){ g.strokeStyle = HEX.black; g.lineWidth = Math.max(2, W * .01); g.strokeRect(1, 1, W - 2, H - 2); }
  const s = W * .62 / 100, ox = W * .19, oy = W * .16;
  MARKS[key](v.fg, v.hl).forEach(m => {
    g.save();
    if (m[0] === 'c'){ g.fillStyle = m[4]; g.beginPath(); g.arc(ox + m[1] * s, oy + m[2] * s, m[3] * s, 0, Math.PI * 2); g.fill(); }
    else if (m[0] === 'ring'){ g.strokeStyle = m[5]; g.lineWidth = m[4] * s; g.beginPath(); g.arc(ox + m[1] * s, oy + m[2] * s, m[3] * s, 0, Math.PI * 2); g.stroke(); }
    else { g.fillStyle = m[5]; g.translate(ox + (m[1] + m[3] / 2) * s, oy + (m[2] + m[4] / 2) * s); if (m[6]) g.rotate(m[6] * Math.PI / 180); g.fillRect(-m[3] * s / 2, -m[4] * s / 2, m[3] * s, m[4] * s); }
    g.restore();
  });
  const words = gm.name.map(w => w.toUpperCase());
  let px = Infinity; words.forEach(w => { px = Math.min(px, fitText(g, w, W * .86, H * .17)); });
  posterFont(g, px); g.fillStyle = v.fg; g.textBaseline = 'alphabetic';
  words.forEach((w, k) => g.fillText(w, W * .07, H - W * .07 - (words.length - 1 - k) * px * .84));
  return c;
}
const GAMEC = {};
function gameTex(key){ if (!GAMEC[key]) GAMEC[key] = gameCanvas(key, 240); return GAMEC[key]; }


/* ── images: game covers, the channel avatar ── */
const loader = new THREE.TextureLoader();
const TEX = {}, IMG = {};
const SOURCES = { dp: 'assets/brand/dp.png' };
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

/* ══ the building ═══════════════════════════════════════════
   An entrance hall across the front, then two columns of rooms,
   four deep, and a last room across the back. The camera snakes
   through them: hall → L0 → R0 → R1 → L1 → L2 → R2 → R3 → L3 → back. */
const CELL = 12.5, WT = .26, RH = 7.6, HALL_D = 8, DW = 3.2, DH = 4.6;
const HALF = CELL, XL = -CELL / 2, XR = CELL / 2;
const rowZ = r => -HALL_D - CELL / 2 - r * CELL;
const Z_BACK = -HALL_D - 5 * CELL;
const world = new THREE.Group(); scene.add(world);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/* the door into each room, in station order */
const DOORS = [
  { x: XL, z: -HALL_D, a: 'x' }, { x: 0, z: rowZ(0), a: 'z' }, { x: XR, z: -HALL_D - CELL, a: 'x' },
  { x: 0, z: rowZ(1), a: 'z' }, { x: XL, z: -HALL_D - 2 * CELL, a: 'x' }, { x: 0, z: rowZ(2), a: 'z' },
  { x: XR, z: -HALL_D - 3 * CELL, a: 'x' }, { x: 0, z: rowZ(3), a: 'z' }, { x: XL, z: -HALL_D - 4 * CELL, a: 'x' }
];
const ROOMS = [[XL, 0], [XR, 0], [XR, 1], [XL, 1], [XL, 2], [XR, 2], [XR, 3], [XL, 3], [0, 4]].map((c, i) => {
  const cx = c[0], cz = rowZ(c[1]), d = DOORS[i], w = i === 8 ? 2 * CELL : CELL;
  const nin = d.a === 'x' ? V3(0, 0, Math.sign(cz - d.z)) : V3(Math.sign(cx - d.x), 0, 0);
  /* the far wall, opposite the door, holds the room's piece */
  const n = nin.clone().negate();
  const f = d.a === 'x' ? V3(cx, 0, cz + nin.z * (CELL / 2 - WT / 2)) : V3(cx + nin.x * (CELL / 2 - WT / 2), 0, cz);
  return { cx, cz, w, side: STATIONS[i].side, door: d, nin, n, f, ry: Math.atan2(n.x, n.z) };
});
const wallColor = s => s === 'eng' ? C.black2 : s === 'cre' ? C.red : C.paper;
function sideAt(x, z){
  if (x < -HALF || x > HALF || z > 0 || z < Z_BACK) return null;
  if (z > -HALL_D) return 'hall';
  const r = Math.floor((-HALL_D - z) / CELL);
  if (r >= 4) return 'both';
  const k = ROOMS.findIndex((R0, i) => i < 8 && Math.abs(R0.cz - rowZ(r)) < .1 && Math.sign(R0.cx) === Math.sign(x));
  return k >= 0 ? ROOMS[k].side : 'both';
}
const faceMat = s => mat(s === null || s === 'hall' ? C.paper : wallColor(s));

const anim = [];
let ceilMats = [], keyLight = null;

/* a wall along one axis, with door gaps; each face takes its own room's colour */
function wall(axis, at, a0, a1, gaps){
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  const cuts = (gaps || []).slice().sort((p, q) => p - q);
  const spans = []; let s = lo;
  cuts.forEach(g => { spans.push([s, g - DW / 2, 0, RH]); spans.push([g - DW / 2, g + DW / 2, DH, RH]); s = g + DW / 2; });
  spans.push([s, hi, 0, RH]);
  spans.forEach(sp => {
    const len = sp[1] - sp[0], h = sp[3] - sp[2], mid = (sp[0] + sp[1]) / 2; if (len < .01) return;
    let g, mats, pos;
    if (axis === 'z'){            // runs along x, at z = at
      g = boxGeo(len, h, WT); pos = V3(mid, sp[2] + h / 2, at);
      const end = mat(C.paper);
      mats = [end, end, end, end, faceMat(sideAt(mid, at + .5)), faceMat(sideAt(mid, at - .5))];
    } else {                      // runs along z, at x = at
      g = boxGeo(WT, h, len); pos = V3(at, sp[2] + h / 2, mid);
      const end = mat(C.paper);
      mats = [faceMat(sideAt(at + .5, mid)), faceMat(sideAt(at - .5, mid)), end, end, end, end];
    }
    const me = new THREE.Mesh(g, mats); me.position.copy(pos); me.receiveShadow = true; me.castShadow = true; world.add(me);
  });
}
function buildShell(){
  /* floor: pale concrete with a faint joint grid */
  const [fc, fg] = makeCanvas(512, 512);
  fg.fillStyle = '#E8E5DF'; fg.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 4000; k++){ const v = Math.sin(k * 12.9898) * 43758.5453; const r = v - Math.floor(v); fg.fillStyle = r > .5 ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.05)'; fg.fillRect((k * 37.3) % 512, (k * 91.7) % 512, 2, 2); }
  fg.fillStyle = 'rgba(12,12,13,.08)'; fg.fillRect(0, 0, 512, 2); fg.fillRect(0, 0, 2, 512);
  const ft = texFrom(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(2 * HALF / 3.09, -Z_BACK / 3.09);
  const floor = plane(world, 2 * HALF, -Z_BACK, mat(0xffffff, { map: ft }), 0, 0, Z_BACK / 2); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  /* the slab under it, and its red edge, for the view from above */
  B(world, 2 * HALF + .8, 1.2, -Z_BACK + .8, C.black2, 0, -1.25, Z_BACK / 2, { noShadow: true });
  B(world, 2 * HALF + .84, .1, -Z_BACK + .84, C.red, 0, -.2, Z_BACK / 2, { noShadow: true });
  const [gc, gg] = makeCanvas(128, 128); gg.fillStyle = HEX.black; gg.fillRect(0, 0, 128, 128); gg.fillStyle = '#242322'; gg.fillRect(63, 0, 2, 128); gg.fillRect(0, 63, 128, 2);
  const gt = texFrom(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(60, 60);
  const ground = plane(world, 400, 400, new THREE.MeshBasicMaterial({ map: gt }), 0, -6, Z_BACK / 2); ground.rotation.x = -Math.PI / 2;

  /* walls: the outside, five cross walls, and the spine down the middle */
  wall('x', -HALF, 0, Z_BACK); wall('x', HALF, 0, Z_BACK); wall('z', Z_BACK, -HALF - WT / 2, HALF + WT / 2);
  [0, 1, 2, 3, 4].forEach(r => wall('z', -HALL_D - r * CELL, -HALF, HALF, [r % 2 ? XR : XL]));
  wall('x', 0, -HALL_D, -HALL_D - 4 * CELL, [0, 1, 2, 3].map(rowZ));

  /* the path you walk, drawn on the floor in red */
  const pts = [V3(0, 0, 0)];
  ROOMS.forEach(rm => { pts.push(V3(rm.door.x, 0, rm.door.z)); pts.push(V3(rm.cx, 0, rm.cz)); });
  const lineM = flat(C.red, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (let k = 0; k < pts.length - 1; k++){
    const a = pts[k], b = pts[k + 1], len = a.distanceTo(b); if (len < .01) continue;
    const seg = plane(world, .14, len + .14, lineM, (a.x + b.x) / 2, .005, (a.z + b.z) / 2);
    seg.rotation.x = -Math.PI / 2; seg.rotation.z = Math.atan2(b.x - a.x, b.z - a.z);
  }

  /* the ceiling fades out as the camera rises above the walls */
  const cm = mat(C.paper, { transparent: true }); ceilMats.push(cm);
  const ceil = plane(world, 2 * HALF, -Z_BACK, cm, 0, RH, Z_BACK / 2); ceil.rotation.x = Math.PI / 2;
  /* one pendant per room */
  const shadeM = mat(C.black, { transparent: true }), bulbM = flat(0xFFF7E8, { transparent: true });
  ceilMats.push(shadeM, bulbM);
  [{ cx: 0, cz: -HALL_D / 2 }].concat(ROOMS).forEach(rm => {
    const cord = new THREE.Mesh(boxGeo(.02, 1.4, .02), shadeM); cord.position.set(rm.cx, RH - .7, rm.cz); world.add(cord);
    const sh = new THREE.Mesh(new THREE.LatheGeometry([[0, .32], [.34, .3], [.42, 0], [.4, 0]].map(p => new THREE.Vector2(p[0], p[1])), 32), shadeM);
    sh.position.set(rm.cx, RH - 1.72, rm.cz); world.add(sh);
    const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 10), bulbM); b.position.set(rm.cx, RH - 1.72, rm.cz); world.add(b);
  });

  /* the hall: the name of the building on its back wall */
  const [hc, hg] = makeCanvas(1600, 990);
  hg.fillStyle = HEX.black; let px = fitText(hg, 'NINE', 1560, 520); hg.fillText('NINE', 10, 480);
  hg.fillStyle = HEX.red; px = fitText(hg, 'ROOMS.', 1560, 520); hg.fillText('ROOMS.', 10, 960);
  plane(world, 6.47, 4.0, decal(texFrom(hc), { transparent: true }), 3.4, 3.9, -HALL_D + WT / 2 + .01);
}

/* each room's frame: origin on the floor at the middle of its far wall, +z into the room */
function frameOf(i){
  const rm = ROOMS[i], g = new THREE.Group(); g.position.copy(rm.f).addScaledVector(rm.n, WT / 2 + .005); g.rotation.y = rm.ry; world.add(g);
  return g;
}
/* the poster sits on the wall's golden section, the label under it */
function dress(i, key, opts){
  opts = opts || {};
  const g = frameOf(i), dark = ROOMS[i].side === 'eng', x = opts.x != null ? opts.x : 3.5;
  if (key){
    const w = opts.w || 2.2, h = w * PHI;
    B(g, w + .1, h + .1, .04, dark ? C.paper : C.black, x, 4.1 - h / 2 - .05, .02, { noShadow: true });
    plane(g, w, h, decal(texFrom(posterCanvas(key, 500))), x, 4.1, .05);
  }
  return g;
}
/* an asset group stands `dist` out from the far wall, facing the door */
function stand(i, dist){
  const rm = ROOMS[i], g = new THREE.Group();
  g.position.copy(rm.f).addScaledVector(rm.n, dist); g.rotation.y = rm.ry; world.add(g);
  g.userData.dist = dist; return g;
}

/* ── 0 · ARTHIS: a desk with two screens and a phone ── */
let feedTex = null, feedIdx = 0;
function drawFeed(){
  const [c, g] = makeCanvas(640, 396);
  g.fillStyle = HEX.black; g.fillRect(0, 0, 640, 396);
  g.fillStyle = HEX.paper; g.font = '600 18px "Geist Mono", monospace'; g.fillText('ARTHIS.SPACE', 24, 36);
  g.fillStyle = HEX.red; g.fillRect(24, 50, 592, 2);
  const keys = Object.keys(GAMEMARKS);
  keys.forEach((k, n) => {
    const slot = (n - feedIdx % keys.length + keys.length) % keys.length;
    const x = 24 + slot * 152; g.globalAlpha = slot === 0 ? 1 : .35;
    g.drawImage(gameTex(k), x, 70, 140, 226); g.globalAlpha = 1;
    if (slot === 0){ g.fillStyle = HEX.red; g.fillRect(x, 302, 140, 4); }
  });
  g.fillStyle = HEX.paper; posterFont(g, 60); g.fillText('105 GAMES · SWIPE UP', 24, 376);
  if (!feedTex) feedTex = texFrom(c); else { feedTex.image = c; feedTex.needsUpdate = true; }
}
function chair(par, x, z, ry){
  const ch = new THREE.Group(); ch.position.set(x, 0, z); ch.rotation.y = ry || 0; par.add(ch);
  R(ch, .56, .08, .54, C.black, 0, .48, 0, { r: .03 });
  R(ch, .56, .62, .07, C.black, 0, .62, -.26, { r: .03 });
  CYL(ch, .03, .03, .42, 10, C.steel, 0, .06, 0);
  for (let k = 0; k < 5; k++){ const a = k * Math.PI * 2 / 5; B(ch, .05, .04, .32, C.steel, Math.sin(a) * .16, .04, Math.cos(a) * .16, { ry: a }); }
  return ch;
}
function buildArthis(i){
  const g = stand(i, 1.6);
  R(g, 3.6, .06, 1.4, C.paper, 0, .95, 0, { r: .025 });
  [[-1.65, -.55], [1.65, -.55], [-1.65, .55], [1.65, .55]].forEach(p => CYL(g, .025, .025, .95, 10, C.black, p[0], 0, p[1]));
  drawFeed();
  const m1 = new THREE.Group(); m1.position.set(-.55, 1.01, -.35); g.add(m1);
  CYL(m1, .16, .18, .02, 24, C.black, 0, 0, 0); B(m1, .05, .38, .05, C.black, 0, .02, -.03);
  R(m1, 1.64, .98, .05, C.black, 0, .36, 0, { r: .02 });
  plane(m1, 1.58, .92, decal(feedTex), 0, .85, .03);
  const m2 = new THREE.Group(); m2.position.set(.95, 1.01, -.35); m2.rotation.y = -.18; g.add(m2);
  CYL(m2, .14, .16, .02, 24, C.black, 0, 0, 0); B(m2, .05, .3, .05, C.black, 0, .02, -.03);
  R(m2, .7, 1.1, .05, C.black, 0, .28, 0, { r: .02 });
  plane(m2, .64, 1.04, decal(texFrom(posterCanvas('wall', 300))), 0, .83, .03);
  R(g, .9, .025, .28, C.black2, -.4, .98, .25, { r: .01 });
  R(g, .07, .03, .11, C.black2, .3, .98, .3, { r: .015 });
  LATHE(g, [[0, 0], [.07, 0], [.075, .14], [.068, .14], [.06, .01], [0, .01]], C.red, 1.3, .98, .3);
  const ph = new THREE.Group(); ph.position.set(-1.45, 1.01, .05); ph.rotation.y = .4; g.add(ph);
  R(ph, .2, .02, .14, C.black, 0, 0, 0, { r: .01 }); R(ph, .2, .38, .02, C.black, 0, .02, -.03, { r: .008, rx: -.2 });
  plane(ph, .17, .275, decal(texFrom(gameTex('fruit'))), 0, .22, .01).rotation.x = -.2;
  chair(g, .1, 1.05, Math.PI + .25);
  dress(i, 'feed');
  anim.push(t => { const k = Math.floor(t / 2.4); if (k !== feedIdx){ feedIdx = k; drawFeed(); } });
  return g;
}

/* ── 1 · Blender: an armature turning on a white plinth ── */
function buildBlender(i){
  const g = stand(i, 3.4);
  LATHE(g, [[0, 0], [1.05, 0], [1.05, .02], [.98, .06], [.95, .62], [1.02, .66], [1.02, .7], [0, .7]], C.paper, 0, 0, 0);
  const plate = CYL(g, 1.0, 1.0, .03, 64, C.black, 0, .7, 0);
  const fig = new THREE.Group(); fig.position.y = .73; g.add(fig);
  const W = mat(C.paper);
  const J = { head: [0, 2.0, 0], neck: [0, 1.7, 0], chest: [0, 1.42, 0], hip: [0, .98, 0],
    lh: [-.5, 1.1, .16], rh: [.52, 1.32, -.1], le: [-.33, 1.36, .08], re: [.35, 1.5, 0],
    lk: [-.15, .52, .1], rk: [.17, .55, -.06], lf: [-.19, .05, .14], rf: [.21, .05, -.03] };
  const V = k => V3(J[k][0], J[k][1], J[k][2]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.19, 32, 20), W); head.position.copy(V('head')); head.castShadow = true; fig.add(head);
  const torso = new THREE.Mesh(new THREE.LatheGeometry([[0, -.32], [.14, -.3], [.19, -.05], [.22, .2], [.16, .32], [0, .34]].map(p => new THREE.Vector2(p[0], p[1])), 32), W);
  torso.position.set(0, 1.25, 0); torso.castShadow = true; fig.add(torso);
  const bones = [['neck', 'chest'], ['chest', 'hip'], ['chest', 're'], ['re', 'rh'], ['chest', 'le'], ['le', 'lh'], ['hip', 'lk'], ['lk', 'lf'], ['hip', 'rk'], ['rk', 'rf']];
  bones.slice(2).forEach(b => { const A = V(b[0]), Bv = V(b[1]), len = A.distanceTo(Bv);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, len, 16), W); m.position.copy(A).add(Bv).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), Bv.clone().sub(A).normalize()); m.castShadow = true; fig.add(m); });
  const pts = []; bones.forEach(b => pts.push(V(b[0]).setZ(.27), V(b[1]).setZ(.27)));
  fig.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: lin(C.red) })));
  Object.keys(J).forEach(k => { const s = new THREE.Mesh(new THREE.SphereGeometry(.04, 12, 8), flat(C.red)); s.position.copy(V(k)).setZ(.27); fig.add(s); });
  /* a softbox and a camera on a tripod, both aimed at the figure */
  const sb = new THREE.Group(); sb.position.set(-2.2, 0, .6); sb.rotation.y = .9; g.add(sb);
  CYL(sb, .025, .025, 2.3, 10, C.black, 0, 0, 0);
  R(sb, 1.2, .9, .3, C.black, 0, 2.05, 0, { r: .03 });
  plane(sb, 1.08, .78, flat(0xFFFFFF), 0, 2.5, .16);
  const cam = new THREE.Group(); cam.position.set(2.0, 0, 1.5); cam.rotation.y = -2.4 + Math.PI; g.add(cam);
  [0, 2.1, 4.2].forEach(r => B(cam, .03, 1.45, .03, C.black, Math.sin(r) * .28, 0, Math.cos(r) * .28, { rx: Math.cos(r) * -.19, rz: Math.sin(r) * .19 }));
  R(cam, .56, .36, .34, C.black, 0, 1.42, 0, { r: .04 });
  CYL(cam, .13, .15, .26, 32, C.black2, 0, 1.6, .3).rotation.x = Math.PI / 2;
  const rec = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), flat(C.red)); rec.position.set(.2, 1.82, 0); cam.add(rec);
  dress(i, 'rig');
  anim.push((t, dt) => { fig.rotation.y += dt * (REDUCED ? 0 : .5); plate.rotation.y = fig.rotation.y; rec.visible = Math.floor(t * 1.5) % 2 === 0; });
  return g;
}

/* ── 2 · AKverse: the channel on a screen, the house as an architect's model ── */
function drawChannel(){
  const [c, g] = makeCanvas(640, 396);
  g.fillStyle = HEX.paper; g.fillRect(0, 0, 640, 396);
  g.fillStyle = HEX.red; g.fillRect(0, 0, 640, 120);
  g.fillStyle = HEX.black; posterFont(g, 128); g.fillText('AKVERSE', 22, 112);
  if (IMG.dp) g.drawImage(IMG.dp, 530, 18, 90, 90);
  g.fillStyle = HEX.black; g.font = '500 16px "Geist Mono", monospace'; g.fillText('@AKVERSEOFFICIAL · 21.9K', 24, 152);
  [['KALESHI', 'FAMILY', HEX.black, HEX.paper], ['DIORAMA', 'BUILD', HEX.red, HEX.paper], ['DR', 'LODHA', HEX.paper, HEX.black]].forEach((t, k) => {
    const x = 24 + k * 202, y = 172;
    g.fillStyle = t[2]; g.fillRect(x, y, 188, 200); if (t[2] === HEX.paper){ g.strokeStyle = HEX.black; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 186, 198); }
    g.fillStyle = t[3]; posterFont(g, 62); g.fillText(t[0], x + 12, y + 130); g.fillText(t[1], x + 12, y + 184);
  });
  return texFrom(c);
}
function buildAkverse(i){
  const g = stand(i, 1.2);
  R(g, 3.2, .5, .55, C.black, 0, 0, -.1, { r: .03 });
  [-1.2, 1.2].forEach(x => B(g, .5, .02, .5, C.black2, x, .25, .19, { noShadow: true }));
  const tv = new THREE.Group(); tv.position.set(0, .5, -.2); g.add(tv);
  B(tv, .4, .02, .2, C.black, 0, 0, 0); B(tv, .06, .24, .06, C.black, 0, .02, -.04);
  R(tv, 2.6, 1.6, .05, C.black, 0, .25, 0, { r: .02 });
  plane(tv, 2.52, 1.52, decal(drawChannel()), 0, 1.05, .03);
  /* the house, white on a plinth */
  const d = new THREE.Group(); d.position.set(2.3, 0, 1.6); d.rotation.y = -.45; g.add(d);
  R(d, .95, .92, .95, C.paper, 0, 0, 0, { r: .02 });
  B(d, 1.04, .04, 1.04, C.black, 0, .92, 0);
  const H = new THREE.Group(); H.position.y = .96; d.add(H);
  B(H, .7, .55, .56, C.paper, -.06, 0, -.06);
  B(H, .72, .03, .58, C.paper2, -.06, .55, -.06);
  [[-.06, .3], [.29, -.06]].forEach(() => {});
  B(H, .72, .08, .02, C.paper, -.06, .58, .22); B(H, .02, .08, .58, C.paper, .3, .58, -.06);
  CYL(H, .07, .07, .14, 20, C.black, -.25, .58, -.2);
  B(H, .12, .24, .01, C.red, .05, 0, .225);
  [[-.25, .3], [.2, .3]].forEach(p => B(H, .1, .1, .01, C.black, p[0], p[1], .225));
  B(H, .01, .1, .1, C.black, .295, .3, -.05);
  B(H, .26, .04, .16, C.paper2, .26, .06, .28);
  [[.17, .22], [.35, .22], [.17, .34], [.35, .34]].forEach(p => B(H, .015, .06, .015, C.black, p[0], 0, p[1]));
  /* a ring light */
  const rl = new THREE.Group(); rl.position.set(-2.2, 0, .8); rl.rotation.y = .5; g.add(rl);
  [0, 2.1, 4.2].forEach(r => B(rl, .025, .5, .025, C.black, Math.sin(r) * .18, 0, Math.cos(r) * .18, { rx: Math.cos(r) * -.3, rz: Math.sin(r) * .3 }));
  CYL(rl, .02, .02, 1.6, 10, C.black, 0, .4, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .045, 16, 64), flat(0xFFFFFF)); ring.position.y = 2.15; rl.add(ring);
  /* a clapperboard on the console */
  const cl = new THREE.Group(); cl.position.set(-1.1, .5, .02); cl.rotation.y = .3; g.add(cl);
  B(cl, .42, .3, .03, C.black, 0, 0, 0);
  for (let k = 0; k < 5; k++) B(cl, .084, .07, .034, k % 2 ? C.black : C.paper, -.168 + k * .084, .31, 0, { noShadow: true });
  dress(i, 'house');
  return g;
}

/* ── 3 · HexaBed: a white terrain model that rebuilds itself ── */
let hexRegen = null;
function buildHexa(i){
  const g = stand(i, 3.4);
  LATHE(g, [[0, 0], [.6, 0], [.6, .03], [.09, .06], [.07, .9], [1.55, .9], [1.6, .93], [1.58, .97], [0, .97]], C.paper, 0, 0, 0);
  const isle = new THREE.Group(); isle.position.y = .97; g.add(isle);
  const Rr = .22, tiles = [], hexG = new THREE.CylinderGeometry(Rr * .95, Rr * .95, 1, 6);
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++){
    if (Math.abs(q + r) > 3) continue;
    const x = (q + r / 2) * Rr * 1.732, z = r * Rr * 1.5, d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    const m = new THREE.Mesh(hexG, mat(C.paper)); m.position.set(x, 0, z); m.rotation.y = Math.PI / 6;
    m.castShadow = m.receiveShadow = true; isle.add(m); tiles.push({ m, q, r, d, h: .2, t0: 0 });
  }
  const trees = [];
  for (let k = 0; k < 8; k++){ const tr = new THREE.Mesh(new THREE.ConeGeometry(.075, .28, 16), mat(C.black)); tr.castShadow = true; isle.add(tr); trees.push(tr); }
  let seed = 1, born = -10;
  hexRegen = function(now){
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = (a2, b2) => { const v = Math.sin(a2 * 12.9898 + b2 * 78.233 + seed * .013) * 43758.5453; return v - Math.floor(v); };
    tiles.forEach(t => {
      const n = Math.sin(t.q * 1.3 + seed) * .8 + Math.cos(t.r * 1.1 - seed * .7) * .7 + 1.2;
      t.h = t.d === 3 ? .08 : .1 + Math.max(0, n) * .17;
      t.road = (t.r === 0 && t.q > -3 && t.q < 3) || (t.q === 0 && t.r < 0 && t.r > -3);
      t.m.material = mat(t.road ? C.red : t.h > .4 ? C.paper2 : C.paper);
      if (t.road) t.h = Math.min(t.h, .16);
      t.t0 = t.d * .09 + rnd(t.r, t.q) * .12;
    });
    const land = tiles.filter(t => !t.road && t.d < 3);
    trees.forEach((tr, k) => { tr.userData.t = land[(k * 7 + seed) % land.length]; });
    born = now;
  };
  hexRegen(0);
  dress(i, 'hex');
  anim.push(t => {
    const age = t - born;
    tiles.forEach(tl => { const k = REDUCED ? 1 : ease(clamp((age - tl.t0) / .5, 0, 1)); const h = Math.max(.001, tl.h * k); tl.m.scale.y = h; tl.m.position.y = h / 2; });
    trees.forEach(tr => { const tl = tr.userData.t; if (!tl) return; tr.position.set(tl.m.position.x, tl.m.scale.y + .14, tl.m.position.z); tr.scale.setScalar(REDUCED ? 1 : clamp((age - tl.t0 - .35) / .3, .001, 1)); });
  });
  return g;
}

/* ── 4 · AI: racks, and a network thinking above them ── */
function buildAI(i){
  const g = stand(i, .75);
  const ON = [flat(0xffffff), flat(C.red)], OFF = flat(0x2A2A2C);
  const leds = [];
  [-1.05, 0, 1.05].forEach(x => {
    R(g, .92, 2.5, .8, C.black, x, 0, 0, { r: .025 });
    B(g, .78, 2.2, .01, C.black2, x, .15, .405, { noShadow: true });
    for (let r = 0; r < 12; r++){ B(g, .7, .012, .012, 0x2E2E31, x, .22 + r * .18, .41, { noShadow: true }); }
    for (let r = 0; r < 12; r++) for (let c = 0; c < 3; c++){
      const m = new THREE.Mesh(boxGeo(.03, .03, .01), OFF); m.position.set(x - .28 + c * .06, .28 + r * .18, .415); g.add(m); leds.push(m);
    }
  });
  const net = new THREE.Group(); net.position.set(0, 3.7, .3); g.add(net);
  const LAY = [3, 4, 3, 1], nodes = [];
  LAY.forEach((n, li) => { for (let k = 0; k < n; k++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(.09, 24, 16), li === 3 ? flat(C.red) : mat(C.paper));
    m.position.set((li - 1.5) * .62, (k - (n - 1) / 2) * .4, 0); net.add(m); nodes.push({ m, li });
  } });
  const pts = [], edges = [];
  nodes.forEach(p => nodes.forEach(q => { if (q.li === p.li + 1){ pts.push(p.m.position, q.m.position); edges.push([p.m.position, q.m.position, p.li]); } }));
  net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: lin(0x5A5957) })));
  const pulses = edges.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(.028, 8, 6), flat(C.red)); net.add(m); return m; });
  dress(i, 'net');
  let last = 0;
  anim.push(t => {
    if (t - last > .16){ last = t; leds.forEach((m, k) => { const v = Math.sin(k * 12.9898 + Math.floor(t * 6) * 78.233) * 43758.5453; const r = v - Math.floor(v); m.material = r > .85 ? ON[1] : r > .45 ? ON[0] : OFF; }); }
    const u = (t * .8) % 1, layer = Math.floor((t * .8) % 3);
    edges.forEach((e, k) => { const p = pulses[k]; p.visible = !REDUCED && e[2] === layer; if (p.visible) p.position.lerpVectors(e[0], e[1], u); });
    net.position.y = 3.7 + Math.sin(t * 1.3) * .05;
  });
  return g;
}

/* ── 5 · The Board: a white pinboard and red thread ── */
function cardCanvas(title, sub, dark){
  const [c, g] = makeCanvas(486, 300);
  g.fillStyle = dark ? HEX.black : HEX.paper; g.fillRect(0, 0, 486, 300);
  g.fillStyle = HEX.red; g.fillRect(0, 0, 486, 10);
  g.fillStyle = dark ? HEX.paper : HEX.black; g.textBaseline = 'alphabetic';
  const px = fitText(g, title.toUpperCase(), 440, 130); g.fillText(title.toUpperCase(), 22, 70 + px * .8);
  g.font = '500 21px "Geist Mono", monospace'; g.fillStyle = dark ? '#B7B4AD' : '#5C5B58'; g.fillText(sub.toUpperCase(), 24, 276);
  return texFrom(c);
}
function buildBoard(i){
  const w = frameOf(i);
  R(w, 6.2, 3.83, .06, C.paper, -.6, 1.6, .03, { r: .02 });
  const items = [
    { tex: texFrom(posterCanvas('cv', 300)), w: .9, h: .9 * PHI, x: -2.9, y: 4.0 },
    { tex: texFrom(posterCanvas('tools', 300)), w: .9, h: .9 * PHI, x: -1.8, y: 4.05 },
    { tex: texFrom(gameTex('fruit')), w: .6, h: .6 * PHI, x: -.7, y: 4.25 },
    { tex: texFrom(gameTex('doodle')), w: .6, h: .6 * PHI, x: 0, y: 4.2 },
    { tex: cardCanvas('Hustiq', 'Edit by chatting', true), w: 1.1, h: .68, x: 1.3, y: 4.5 },
    { tex: cardCanvas('Travel Atlas', '30+ places'), w: 1.1, h: .68, x: -2.7, y: 2.4 },
    { tex: cardCanvas('Avatar Maker', 'Presets + parts', true), w: 1.1, h: .68, x: -1.4, y: 2.35 },
    { tex: cardCanvas('Daily Rest', 'Pomodoro'), w: 1.1, h: .68, x: -.1, y: 2.4 },
    { tex: cardCanvas('Asset viewer', 'Three.js', true), w: 1.1, h: .68, x: 1.25, y: 2.95 }
  ];
  const pins = [];
  items.forEach((it, k) => {
    plane(w, it.w, it.h, decal(it.tex || null, { color: it.tex ? 0xffffff : lin(C.paper2) }), it.x, it.y, .1 + k * .003);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), flat(C.red)); pin.position.set(it.x, it.y + it.h / 2 - .05, .14); w.add(pin);
    pins.push(V3(it.x, it.y + it.h / 2 - .05, .15));
  });
  const order = [0, 5, 6, 1, 2, 7, 3, 8, 4, 0];
  const sp = []; for (let k = 0; k < order.length - 1; k++) sp.push(pins[order[k]], pins[order[k + 1]]);
  w.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), new THREE.LineBasicMaterial({ color: lin(C.red) })));
  const g = stand(i, 1.9);
  const st = new THREE.Group(); st.position.set(-1.6, 0, 0); g.add(st);
  LATHE(st, [[0, .7], [.28, .7], [.3, .74], [0, .76]], C.black, 0, 0, 0);
  [0, 2.1, 4.2].forEach(r => B(st, .035, .72, .035, C.black, Math.sin(r) * .18, 0, Math.cos(r) * .18, { rx: Math.cos(r) * -.08, rz: Math.sin(r) * .08 }));
  R(g, 1.0, .72, .6, C.black, .3, 0, -.4, { r: .03 });
  R(g, .3, .2, .22, C.paper, .2, .72, -.4, { r: .02 });
  dress(i, null, { lx: 3.9, ly: 1.45 });
  return g;
}

/* ── 6 · Numbers: a black shelf on the white wall ── */
function statCanvas(n, l, v){
  const W = 300, H = Math.round(300 * PHI), [c, g] = makeCanvas(W, H); const s = VARIANT[v];
  g.fillStyle = s.bg; g.fillRect(0, 0, W, H);
  if (v === 'white'){ g.strokeStyle = HEX.black; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3); }
  g.fillStyle = s.fg; g.font = '500 19px "Geist Mono", monospace'; g.fillText(l.toUpperCase(), 18, 38);
  g.fillRect(18, 52, W - 36, 2);
  fitText(g, n, W - 28, 300); g.fillText(n, 13, H - 18);
  return texFrom(c);
}
function buildNumbers(i){
  const g = stand(i, .26);
  [0, 1.36, 2.72].forEach(y => R(g, 3.6, .05, .5, C.black, 0, y + .1, 0, { r: .01 }));
  R(g, .05, 2.9, .5, C.black, -1.8, 0, 0, { r: .01 }); R(g, .05, 2.9, .5, C.black, 1.8, 0, 0, { r: .01 });
  [['154', 'Builds', 'red'], ['141K', 'Lines', 'white'], ['43', 'Three.js', 'black'],
   ['AIR 8956', 'JEE Adv.', 'black'], ['98.9', 'JEE Main', 'red'], ['28', 'Add-ons', 'white']].forEach((s, k) => {
    const x = -1.15 + (k % 3) * 1.15, y = k < 3 ? 1.51 : .15;
    const p = plane(g, .66, .66 * PHI, decal(statCanvas(s[0], s[1], s[2])), x, y + .54, .02); p.rotation.x = -.05;
  });
  B(g, .5, .5, .5, C.red, -2.6, 0, .6, { ry: .3 }); B(g, .31, .31, .31, C.black, -2.2, 0, .9, { ry: -.2 });
  dress(i, 'numbers');
  return g;
}

/* ── 7 · The arcade: two cabinets with a proper silhouette ── */
let arcTex = null, arcCtx = null;
function drawArcade(t){
  if (!arcCtx){ const [c, g] = makeCanvas(256, 210); arcCtx = g; arcTex = texFrom(c); }
  const g = arcCtx;
  g.fillStyle = HEX.black; g.fillRect(0, 0, 256, 210);
  const px = ((-t * 60) % 120 + 120) % 120;
  g.fillStyle = HEX.paper; [0, 1, 2].forEach(k => { const x = px + k * 120 - 20, gap = 74 + 18 * Math.sin(k * 2.1); g.fillRect(x, 0, 22, gap - 30); g.fillRect(x, gap + 34, 22, 210); });
  const by = 92 + Math.sin(t * 4) * 18;
  g.fillStyle = HEX.red; g.fillRect(70, by, 18, 14);
  arcTex.needsUpdate = true;
}
function cabinet(par, x, ry, label){
  const cab = new THREE.Group(); cab.position.set(x, 0, 0); cab.rotation.y = ry; par.add(cab);
  /* the side profile, extruded across the width */
  const P = [[-.5, 0], [.5, 0], [.5, 1.0], [.64, 1.08], [.64, 1.18], [.26, 1.32], [.12, 2.16], [.4, 2.26], [.4, 2.72], [-.5, 2.72]];
  const s = new THREE.Shape(); s.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => s.lineTo(p[0], p[1]));
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2 });
  geo.translate(0, 0, -.6); geo.rotateY(-Math.PI / 2); geo.computeVertexNormals();
  mesh(cab, geo, C.black, 0, 0, 0);
  /* the screen on the slanted face */
  const a = P[5], b = P[6], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nz = b[1] - a[1], ny = a[0] - b[0];
  const nl = Math.hypot(nz, ny);
  const scr = plane(cab, 1.02, len * .92, decal(arcTex), 0, (a[1] + b[1]) / 2 + ny / nl * .03, (a[0] + b[0]) / 2 + nz / nl * .03);
  scr.rotation.x = -Math.atan2(ny, nz);
  const [mc, mg] = makeCanvas(512, 190); mg.fillStyle = HEX.red; mg.fillRect(0, 0, 512, 190); mg.fillStyle = HEX.paper; const mp = fitText(mg, label, 470, 170); mg.fillText(label, 21, 95 + mp * .38);
  plane(cab, 1.1, .4, decal(texFrom(mc)), 0, 2.49, .425);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.06, 16, 12), flat(C.red)); knob.position.set(-.28, 1.33, .45); cab.add(knob);
  CYL(cab, .015, .015, .12, 8, C.paper, -.28, 1.2, .45);
  [.08, .26, .44].forEach((bx, k) => CYL(cab, .045, .045, .03, 20, k === 0 ? C.red : C.paper, bx, 1.21, .48));
  return cab;
}
function buildArcade(i){
  const g = stand(i, 1.4);
  drawArcade(0);
  cabinet(g, -.85, .14, 'ARCADE'); cabinet(g, .85, -.14, 'PLAY');
  dress(i, 'arcade');
  anim.push(t => drawArcade(t));
  return g;
}

/* ── 8 · The exit: a black door under the biggest words in the building ── */
function buildContact(i){
  const w = frameOf(i);
  B(w, 2.3, 3.9, .1, C.black, 0, 0, .05);
  R(w, .05, .34, .07, C.paper, .85, 1.72, .14, { r: .02 });
  const [c, gg] = makeCanvas(1618, 500);
  gg.fillStyle = HEX.red; const px = fitText(gg, 'LET’S BUILD', 1618, 500); gg.fillText('LET’S BUILD', 0, 250 + px * .38);
  plane(w, 8.09, 2.5, decal(texFrom(c), { transparent: true }), 0, 5.6, .02);
  const g = stand(i, 1.6);
  const mb = new THREE.Group(); mb.position.set(-2.6, 0, 0); g.add(mb);
  CYL(mb, .03, .03, 1.1, 10, C.black, 0, 0, 0);
  R(mb, .44, .4, .7, C.red, 0, 1.1, 0, { r: .1 });
  R(mb, .28, .02, .2, C.paper, 0, 1.5, .08, { r: .01, rx: .3 });
  const pl = new THREE.Group(); world.add(pl);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .5, -.3, 0, -.3, 0, .05, -.15, 0, 0, .5, 0, .05, -.15, .3, 0, -.3], 3));
  pg.computeVertexNormals();
  pl.add(new THREE.Mesh(pg, mat(C.paper, { side: THREE.DoubleSide })));
  const rm = ROOMS[i];
  dress(i, null, { label: false });
  anim.push(t => {
    const u = REDUCED ? 0 : t * .5;
    pl.position.set(rm.cx + Math.sin(u) * 3, 3.5 + Math.sin(u * 2) * .3, rm.cz + Math.cos(u) * 1.6);
    pl.rotation.set(0, u + Math.PI / 2, Math.sin(u * 2) * .3);
  });
  return g;
}

/* ── one invisible box per room's piece answers the pointer ── */
const RING = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.5, 64), new THREE.MeshBasicMaterial({ color: lin(C.red), transparent: true, opacity: .9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
RING.rotation.x = -Math.PI / 2; RING.visible = false; world.add(RING);
const PIECE = [], HITS = [];
function buildHits(){
  PIECE.forEach((g, i) => {
    const bb = new THREE.Box3().setFromObject(g), sz = new THREE.Vector3(), c = new THREE.Vector3();
    bb.getSize(sz); bb.getCenter(c);
    const m = new THREE.Mesh(boxGeo(Math.max(sz.x, .5), Math.max(sz.y, .5), Math.max(sz.z, .5)), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(c); m.userData.st = i; world.add(m); HITS.push(m);
  });
}

function buildLights(){
  scene.add(new THREE.HemisphereLight(0xffffff, 0xCFCBC4, LOW ? .78 : .7));
  keyLight = new THREE.DirectionalLight(0xFFFFFF, .55);
  keyLight.position.set(5, 14, 7); scene.add(keyLight.target);
  if (!LOW){
    /* the shadow box follows the camera, so it stays sharp and never shimmers */
    keyLight.castShadow = true; keyLight.shadow.mapSize.set(1536, 1536);
    const s = keyLight.shadow.camera; s.left = -13; s.right = 13; s.top = 13; s.bottom = -13; s.near = 1; s.far = 50;
    keyLight.shadow.bias = -.0004; keyLight.shadow.normalBias = .04; keyLight.shadow.radius = 3;
  }
  scene.add(keyLight);
}

/* ══ the lanes in 3D ════════════════════════════════════════ */
const laneEls = [$('#laneL'), $('#laneR')];
const lanes = laneEls.map((el, k) => {
  const o = new THREE.CSS3DObject(el);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide }));
  o.add(hole); scene.add(o);
  return { el, o, hole, strip: $('.strip', el), head: $('.lane-h', el), side: k === 0 ? -1 : 1, travel: 0, headH: 0, cards: [] };
});
const Y0 = 3.3, ZL = .6, DIST = 7;
let VW = innerWidth, VH = innerHeight, seamPx = 0, laneW = 0, sScreen = 1, sWall = 1;
let pTarget = 0, pNow = 0, lastHere = -2, lastPhase = '';
function layout(){
  VW = innerWidth; VH = innerHeight;
  /* the seam is the small part of a golden cut of the screen's middle */
  seamPx = VW >= 1000 ? clamp(VW * .236, 360, 420) : VW >= 760 ? 320 : 0;
  laneW = Math.round((VW - seamPx) / 2);
  document.documentElement.style.setProperty('--seam', seamPx + 'px');
  sScreen = 2 * DIST * Math.tan(FOV * Math.PI / 360) / VH;
  sWall = Math.min(6.2 / VH, 7.4 / laneW);
  lanes.forEach(L => {
    L.el.style.width = laneW + 'px'; L.el.style.height = VH + 'px';
    L.el.classList.toggle('wide', laneW >= 440);
    L.el.classList.toggle('thin', laneW < 300);
    L.hole.geometry.dispose(); L.hole.geometry = new THREE.PlaneGeometry(laneW, VH);
    L.strip.style.paddingTop = (L.head.offsetHeight + 4) + 'px';
    L.travel = Math.max(0, L.strip.offsetHeight - VH);
    L.headH = L.head.offsetHeight;
    L.cards = $$('.lc', L.el).map(el => ({ el, big: $('.po-big, .po-stack', el) || el.querySelector('.lc-art') || el, top: el.offsetTop, h: el.offsetHeight, py: null, bl: null }));
  });
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
  renderer.setSize(VW, VH, false); css.setSize(VW, VH);
  const keep = pTarget;
  $('#scroller').style.height = Math.round((TOTAL / 100 + 1) * VH) + 'px';
  scrollTo(0, keep / 100 * VH);
}
const _up = V3(0, 1, 0);
const HINGE_X = HALF - WT / 2 - .05;
function placeLanes(t){
  /* t: 0 = flat across the screen, 1 = open against the hall's side walls */
  const a = ease(clamp(t, 0, 1));
  lanes.forEach(L => {
    const s = lerp(sScreen, sWall, a);
    const hx = lerp(L.side * (VW / 2) * sScreen, L.side * HINGE_X, a);
    const hy = lerp(Y0, .4 + VH * sWall / 2, a), hz = lerp(ZL, -.3, a);
    const th = -L.side * a * Math.PI / 2;
    const off = -L.side * laneW / 2 * s;
    L.o.position.set(hx + off * Math.cos(th), hy, hz - off * Math.sin(th));
    L.o.quaternion.setFromAxisAngle(_up, th);
    L.o.scale.setScalar(s);
  });
}

/* ══ camera poses ═══════════════════════════════════════════ */
const DOOR = { pos: V3(0, Y0, ZL + DIST), look: V3(0, Y0, ZL - 20) };
const HALLP = { pos: V3(0, 4.2, 9), look: V3(-.4, 3.1, -HALL_D), u: 0, v: 0 };
let REVEAL = { pos: V3(0, 52, 24), look: V3(0, -2, -36) };
/* the golden line: a piece sits 0.118 of the width right of centre, the card fills the 38.2% on the left */
const GOLD_U = 2 * (PHI - 1) - 1;   // 0.236
function stationPose(i){
  const rm = ROOMS[i], g = PIECE[i], d = rm.door;
  const pos = V3(d.x, 3.0, d.z).addScaledVector(rm.nin, 2.0);
  const look = rm.f.clone().addScaledVector(rm.n, g.userData.dist * .6);
  look.y = i === 8 ? 3.6 : i === 5 ? 3.1 : 2.0;
  if (i === 8) pos.x = rm.door.x + 2.5;
  return { pos, look, u: GOLD_U, v: 0 };
}
let POSES = [], LEGS = [];
function buildPoses(){
  const narrow = VW < 760;
  POSES = [HALLP].concat(STATIONS.map((s, i) => {
    const p = stationPose(i);
    if (narrow){ p.pos.addScaledVector(ROOMS[i].nin, -1.2); p.pos.y += .6; p.u = 0; p.v = .24; }
    return p;
  }));
  /* every walk goes through a door: a curve from pose to pose that passes the door's middle */
  LEGS = STATIONS.map((s, i) => {
    const A = POSES[i].pos, Bp = POSES[i + 1].pos, Dp = V3(DOORS[i].x, 3.0, DOORS[i].z);
    return { C: Dp.clone().multiplyScalar(2).sub(A.clone().add(Bp).multiplyScalar(.5)) };
  });
  const k = clamp(1.25 / (VW / VH), .8, 2.4);
  REVEAL = { pos: V3(0, 52 + 18 * k, 6 + 6 * k), look: V3(0, 0, -36) };
}
const tmpPos = V3(0, 0, 0), tmpLook = V3(0, 0, 0), tan = V3(0, 0, 0), _t = V3(0, 0, 0);
function applyPose(pos, look, u, v){
  camera.position.copy(pos);
  camera.lookAt(look);
  const tH = Math.tan(FOV * Math.PI / 360);
  if (u) camera.rotateY(Math.atan(u * tH * camera.aspect));
  if (v) camera.rotateX(-Math.atan(v * tH));
}

/* ══ the director: scroll in, everything out ════════════════ */
function readScroll(){ pTarget = clamp(scrollY / VH * 100, 0, TOTAL); }
/* the wheel glides: each notch moves a target, and the page eases to it */
let sTarget = 0, sCur = 0, gliding = false, ownScroll = false;
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
addEventListener('wheel', e => {
  if (e.ctrlKey || openLayer || REDUCED || body.classList.contains('booting')) return;
  e.preventDefault();
  if (!gliding) sTarget = sCur = scrollY;
  sTarget = clamp(sTarget + (e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY), 0, maxScroll());
  gliding = true;
}, { passive: false });
function glide(dt){
  if (!gliding) return;
  sCur += (sTarget - sCur) * (1 - Math.exp(-dt * 7));
  if (Math.abs(sTarget - sCur) < .5){ sCur = sTarget; gliding = false; }
  ownScroll = true; scrollTo(0, sCur);
}
addEventListener('scroll', () => { readScroll(); if (!ownScroll){ gliding = false; } ownScroll = false; }, { passive: true });
['touchstart', 'keydown', 'mousedown'].forEach(ev => addEventListener(ev, () => { if (ev !== 'keydown') gliding = false; }, { passive: true }));

const seamCard = $('#seamCard'), mergeCap = $('#mergeCap'), tkFill = $('#tkFill');
const capA = $('span', mergeCap), capB = $('b', mergeCap), wipeA = $('#wipe i');
let lastP = 0, lastT = 0, skew = 0;
function phaseOf(p){ return p < ACT1 ? 'act1' : p < HALL_AT ? 'merge' : 'room'; }
function hereOf(p){
  if (p < HALL_AT - 25) return -2;
  const k = (p - HALL_AT) / STEP, r = Math.round(k), d = Math.abs(k - r);
  /* hysteresis: the card stays while you hover near a room, so it never blinks */
  if (d < .2 || (d < .3 && lastHere === r - 1)) return r - 1;
  return -3;                                          // -1 hall, -3 walking
}

function direct(p, t){
  const ph = phaseOf(p);
  if (ph !== lastPhase){
    body.classList.toggle('act1', ph === 'act1'); body.classList.toggle('merge', ph === 'merge'); body.classList.toggle('room', ph === 'room');
    if (ph === 'merge' && lastPhase === 'act1')
    lastPhase = ph;
  }
  /* scroll speed drives the lean of the lanes */
  const dt = Math.max(.001, t - lastT), vel = (p - lastP) / dt; lastP = p; lastT = t;
  const k = 1 - Math.exp(-dt * 9);
  skew += ((REDUCED ? 0 : clamp(vel * .008, -4, 4)) - skew) * k;

  /* Act I: the strips run in opposite directions and lean with the scroll */
  const t1 = clamp(p / ACT1, 0, 1);
  if (p < HALL_AT + STEP * .6) lanes.forEach((L, n) => {
    const y = n === 0 ? -t1 * L.travel : -(1 - t1) * L.travel;
    L.strip.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0) skewY(' + ((n ? -1 : 1) * skew).toFixed(2) + 'deg)';
    if (REDUCED) return;
    /* the focus band sits on the golden line of the lane: cards sharpen there, blur away from it */
    const focusY = VH * (PHI - 1), live = p < ACT1;
    L.cards.forEach(c => {
      const top = c.top + y;
      if (top > VH + 40 || top + c.h < -40) return;
      const py = clamp((top + c.h / 2 - VH / 2) / VH, -1, 1) * -12;
      const dist = Math.abs(top + c.h / 2 - focusY) / VH;
      const far = live && dist > .34;
      if (c.py === null || Math.abs(py - c.py) > .05){ c.py = py; c.big.style.transform = 'translate3d(0,' + py.toFixed(2) + '%,0)'; }
      if (c.bl !== far){ c.bl = far; c.el.classList.toggle('far', far); }
    });
  });
  const so = VW < 760 ? 1 - smooth(10, 45, p) : 1 - smooth(ACT1 * .82, ACT1 + 10, p);
  seamCard.style.opacity = so.toFixed(3); seamCard.style.visibility = so < .02 ? 'hidden' : 'visible';
  const mc = smooth(ACT1 + MERGE * .4, ACT1 + MERGE * .5, p) * (1 - smooth(ACT1 + MERGE * .64, ACT1 + MERGE * .72, p));
  mergeCap.style.opacity = mc.toFixed(3);
  /* the two words slide in from opposite sides until they lock together */
  const lock = ease(smooth(ACT1 + MERGE * .36, ACT1 + MERGE * .52, p)), out = smooth(ACT1 + MERGE * .62, ACT1 + MERGE * .72, p);
  capA.style.transform = 'translateX(' + ((1 - lock) * -45).toFixed(2) + 'vw) skewX(' + ((1 - lock) * 12).toFixed(1) + 'deg) scale(' + (1 + out * .3).toFixed(3) + ')';
  capB.style.transform = 'translateX(' + ((1 - lock) * 45).toFixed(2) + 'vw) skewX(' + ((1 - lock) * -12).toFixed(1) + 'deg) scale(' + (1 + out * .3).toFixed(3) + ')';
  /* a red slash, then a black one, wipe across as the camera dives in */
  if (!REDUCED){
    const w1 = smooth(ACT1 + MERGE * .68, ACT1 + MERGE * .9, p);
    wipeA.style.transform = 'translateX(' + lerp(-140, 140, w1).toFixed(2) + '%) skewX(-14deg)';
  }

  /* Act II: doors open, the camera lifts out to the whole building, then drops into the hall */
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
    /* Act III: walk room to room, through each door, resting at every piece */
    const kk = clamp((p - HALL_AT) / STEP, 0, N), i = Math.min(N - 1, Math.floor(kk));
    const f = ease(smooth(.06, .94, kk - i));
    const A = POSES[i], Bp = POSES[i + 1], Cc = LEGS[i].C;
    const a = (1 - f) * (1 - f), b = 2 * (1 - f) * f, c = f * f;
    tmpPos.set(A.pos.x * a + Cc.x * b + Bp.pos.x * c, A.pos.y * a + Cc.y * b + Bp.pos.y * c, A.pos.z * a + Cc.z * b + Bp.pos.z * c);
    tan.copy(Cc).sub(A.pos).multiplyScalar(2 * (1 - f)).add(_t.copy(Bp.pos).sub(Cc).multiplyScalar(2 * f));
    const walking = Math.pow(Math.sin(Math.PI * f), 2);
    tmpLook.lerpVectors(A.look, Bp.look, f);
    if (tan.lengthSq() > 1e-6){ _t.copy(tan).normalize().multiplyScalar(6).add(tmpPos); _t.y = 2.6; tmpLook.lerp(_t, walking * .85); }
    applyPose(tmpPos, tmpLook, lerp(A.u, Bp.u, f) * (1 - walking), lerp(A.v, Bp.v, f) * (1 - walking));
  }

  /* the ceiling fades as the camera rises over the walls */
  const co = 1 - smooth(RH - .8, RH + 4, camera.position.y);
  ceilMats.forEach(m => { const on = co > .001; m.opacity = co; if (m.visible !== on) m.visible = on; const tr = co < .999; if (m.transparent !== tr){ m.transparent = tr; m.needsUpdate = true; } });
  /* and the key light follows what you look at, so its shadows stay crisp */
  if (keyLight){
    camera.getWorldDirection(_dir);
    const fx = clamp(camera.position.x + _dir.x * 6, -HALF, HALF), fz = clamp(camera.position.z + _dir.z * 6, Z_BACK, 0);
    keyLight.target.position.set(fx, 0, fz); keyLight.position.set(fx + 5, 16, fz + 7);
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
  if (p < HALL_AT) return 'Nine rooms';
  const h = hereOf(p);
  if (h === -1) return 'The hall';
  if (h >= 0) return STATIONS[h].title;
  return 'Walking';
}
function fillObj(s, i){
  obj.dataset.side = s.side;
  $('#objSide').textContent = SIDE_LABEL[s.side];
  $('#objN').textContent = (i < 0 ? '00' : String(i + 1).padStart(2, '0')) + ' / ' + String(N).padStart(2, '0');
  $('#objT').setAttribute('aria-label', s.title);
  $('#objT').innerHTML = s.title.split(' ').map((w, n) => '<span class="w" aria-hidden="true"><i style="--i:' + n + '">' + esc(w) + '</i></span>').join(' ');
  $('#objP').textContent = s.blurb;
  $('#objChips').innerHTML = s.chips.map(c => '<span>' + esc(c) + '</span>').join('');
  const act = $('#objAct'); act.innerHTML = '';
  const btn = (labelTxt, cls, attrs) => { const b = document.createElement(attrs && attrs.href ? 'a' : 'button'); b.className = 'btn btn-sm ' + (cls || ''); b.innerHTML = labelTxt;
    if (b.tagName === 'BUTTON') b.type = 'button'; Object.keys(attrs || {}).forEach(k => b.setAttribute(k, attrs[k])); act.appendChild(b); return b; };
  if (i < 0){ btn('Keep scrolling ↓', 'btn-solid', { 'data-next': '' }); return; }
  if (s.id === 'arcade'){ Object.keys(GAMES).forEach((k, n) => btn('▶ ' + GAMES[k].name, n ? '' : 'btn-solid', { 'data-play': k })); return; }
  btn('Read more', 'btn-solid', { 'data-inspect': s.id });
  if (s.id === 'contact'){ btn('Copy email', '', { 'data-copy': 'aayushkumarofficial21@gmail.com' }); return; }
  const first = $('.st-go a', s.el);
  if (first) btn(esc(first.textContent.replace(/^Open /, '')), '', { href: first.href, target: '_blank', rel: 'noopener' });
}
function replayObj(){
  $$('.obj-chips span, .obj-act > *', obj).forEach((el, n) => el.style.setProperty('--i', n + 1));
  obj.classList.remove('enter'); void obj.offsetWidth; obj.classList.add('enter');
}
obj.addEventListener('click', e => { if (e.target.closest('[data-next]')) travel(posOf(0)); });
function arrive(here){
  $('#where').textContent = where();
  if (here === -2 || here === -3){ obj.classList.remove('show'); markHere(-9); return; }
  const s = here < 0 ? HALL : STATIONS[here];
  fillObj(s, here);
  const right = here >= 0 && POSES[here + 1].u < 0;
  obj.classList.toggle('right', right); obj.classList.toggle('left', !right);
  obj.classList.add('show'); replayObj();
  markHere(here);
  if (here >= 0){
    if (s.id === 'hexabed' && hexRegen) hexRegen(clockT);
    if (!found.has(s.id)) discover(here);
  }
}
function discover(i){
  const s = STATIONS[i];
  found.add(s.id); store.set('aak-found', Array.from(found).join(','));
  renderPips();
  if (found.size === N) toast('9/9', '<b>Every room found.</b> Thanks for walking through.');
}
function renderPips(){
  $('#pips').innerHTML = STATIONS.map(s => '<i class="' + (found.has(s.id) ? 'on' : '') + '"></i>').join('');
  $('#foundN').textContent = found.size + '/' + N;
  $$('#ticks button[data-i]').forEach(b => b.classList.toggle('found', found.has(STATIONS[+b.dataset.i].id)));
}
function markHere(i){ $$('#ticks button[data-i]').forEach(b => b.classList.toggle('here', +b.dataset.i === i)); }

function buildTrack(){
  const box = $('#ticks');
  STATIONS.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
    b.style.left = (100 * posOf(i) / TOTAL - (i === N - 1 ? 1.2 : 0)) + '%';
    b.setAttribute('aria-label', 'Go to ' + s.title); b.title = s.title;
    b.addEventListener('click', () => travel(posOf(i)));
    box.appendChild(b);
  });
  renderPips();
}
function travel(p){ closeOverlay(); if (REDUCED){ scrollTo(0, p / 100 * VH); return; } if (!gliding) sCur = scrollY; sTarget = clamp(p / 100 * VH, 0, maxScroll()); gliding = true; }
function stepTo(dir){
  const p = pTarget;
  const next = dir > 0 ? KEYS.find(k => k > p + 2) : KEYS.slice().reverse().find(k => k < p - 2);
  if (next !== undefined) travel(next);
}
$('#prevBtn').addEventListener('click', () => stepTo(-1));
$('#nextBtn').addEventListener('click', () => stepTo(1));
$('.player').addEventListener('click', e => { e.preventDefault(); travel(0); });

function openMenu(){
  const l = $('#menuL'); l.innerHTML = '';
  [{ title: 'The two halves', side: 'both', p: 0 }, { title: 'The hall', side: 'both', p: HALL_AT }].concat(STATIONS.map(s => ({ title: s.title, side: s.side, p: posOf(s.i), id: s.id }))).forEach((s, k) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.innerHTML = '<span class="n">' + String(k).padStart(2, '0') + '</span><span class="t">' + esc(s.title) + (s.id && found.has(s.id) ? '<span class="f">found</span>' : '') + '</span><span class="s ' + s.side + '">' + (s.side === 'both' ? 'Shared' : s.side === 'eng' ? 'Engineer' : 'Creator') + '</span>';
    b.addEventListener('click', () => travel(s.p));
    li.appendChild(b); l.appendChild(li);
  });
  openOverlay($('#menu'));
}
$('#foundBtn').addEventListener('click', openMenu);

function inspect(id){
  const s = STATIONS.find(x => x.id === id); if (!s) return;
  const bodyEl = $('#dosBody');
  bodyEl.innerHTML = s.el.innerHTML;
  const h = $('h2', bodyEl); if (h) h.id = 'dosT';
  $('#dosK').textContent = SIDE_LABEL[s.side] + ' · ' + String(s.i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
  openOverlay($('#dossier'));
  $('.dos-card').scrollTop = 0;
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
const _dir = V3(0, 0, 0);

/* ══ the pointer, optional: hover rings, click walks or reads ══ */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const tip = $('#tip');
let hover = -1;
function hitAt(x, y){
  ndc.set(x / VW * 2 - 1, -(y / VH) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(HITS, false)[0];
  return h ? h.object.userData.st : -1;
}
function overUI(t){ return !t || !t.closest || !!t.closest('#hud .obj,#hud .hud-top,#hud .track,.lane,.menu,.dossier,.arcade,#gate'); }
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' || openLayer || pNow < HALL_AT - 30 || overUI(e.target)){ if (hover !== -1){ hover = -1; tip.hidden = true; } return; }
  const i = hitAt(e.clientX, e.clientY);
  if (i !== hover){
    hover = i;
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

/* the cursor: trails the pointer, grows over anything you can press */
const cur = $('#cursor'); let cx = -100, cy = -100, mx = -100, my = -100;
addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; if (e.pointerType !== 'mouse') return;
  cur.classList.toggle('on', !!(e.target.closest && e.target.closest('a,button,.lc,[data-play]')) || hover >= 0); }, { passive: true });
function moveCursor(dt){ const kk = REDUCED ? 1 : 1 - Math.exp(-dt * 18); cx += (mx - cx) * kk; cy += (my - cy) * kk; cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)'; }

/* ══ the loop ═══════════════════════════════════════════════ */
let clockT = 0, lastNow = performance.now();
function frame(now){
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastNow) / 1000); lastNow = now; clockT += dt;
  glide(dt);
  pNow = REDUCED ? pTarget : pNow + (pTarget - pNow) * (1 - Math.exp(-dt * 10));
  if (Math.abs(pTarget - pNow) < .01) pNow = pTarget;
  direct(pNow, clockT);
  anim.forEach(f => f(clockT, dt));
  moveCursor(dt);
  if (hover >= 0){ const pp = PIECE[hover].position; RING.visible = true; RING.position.set(pp.x, .02, pp.z); }
  else RING.visible = false;
  renderer.render(scene, camera);
  css.render(scene, camera);
  if (Math.floor(clockT * 4) !== Math.floor((clockT - dt) * 4)) $('#where').textContent = where();
}

/* ══ boot ═══════════════════════════════════════════════════ */
let resizeT = 0, lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 140) return;
    lastW = innerWidth; lastH = innerHeight;
    layout(); buildPoses();
  }, 160);
});
history.scrollRestoration = 'manual';
loadAll().then(() => {
  buildLights(); buildShell();
  [buildArthis, buildBlender, buildAkverse, buildHexa, buildAI, buildBoard, buildNumbers, buildArcade, buildContact].forEach((f, i) => { PIECE[i] = f(i); });
  buildHits(); buildTrack();
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
