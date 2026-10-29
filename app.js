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
/* ══ the engineer half speaks in a terminal ═══════════════
   Each project is a shell window: a prompt, a command, and its number
   or word drawn as a 5 × 7 bitmap of 1s, green on black. */
const TERM = {
  feed:    { path: '~/arthis.space', cmd: 'ls games | wc -l', word: '105' },
  wall:    { path: '~/arthis.land',  cmd: 'cat rooms/*.json | jq length', word: 'WALL' },
  hex:     { path: '~/hexabed',      cmd: 'unity -batch -build world', word: '160+' },
  net:     { path: '~/clymora',      cmd: 'python train_gpt2.py', word: 'GPT-2' },
  factory: { path: '~/game-factory', cmd: 'factory new "a fishing game"', word: 'GAME' },
  cv:      { path: '~/cv-forge',     cmd: 'cvforge tailor job.txt', word: 'ATS' },
  tools:   { path: '~/apps',         cmd: 'npm run ship', word: 'SHIP' }
};
/* every character on a 32 × 32 grid: lit cells print 1, the rest print a dim 0 */
const BIN = 32;
const _glyph = document.createElement('canvas'); _glyph.width = _glyph.height = BIN;
const _gctx = _glyph.getContext('2d', { willReadFrequently: true });
function glyphCells(ch){
  const g = _gctx; g.clearRect(0, 0, BIN, BIN);
  g.font = '900 100px Archivo, "Helvetica Neue", Arial, sans-serif'; if ('fontStretch' in g) g.fontStretch = 'normal';
  const m = g.measureText(ch), w = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || 60, h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 72;
  const pad = 3, k = Math.min((BIN - 2 * pad) / w, (BIN - 2 * pad) / h);
  g.save(); g.translate(BIN / 2, BIN / 2); g.scale(k, k);
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  g.fillText(ch, -w / 2 + (m.actualBoundingBoxLeft || 0), h / 2 - (m.actualBoundingBoxDescent || 0));
  g.restore();
  const d = g.getImageData(0, 0, BIN, BIN).data, cells = new Uint8Array(BIN * BIN);
  for (let k2 = 0; k2 < BIN * BIN; k2++) cells[k2] = d[k2 * 4 + 3] > 110 ? 1 : 0;
  return cells;
}
/* resolve 0..1: 0 is pure binary, 1 is the smooth glyph the binary was sampled from */
function drawBinary(cv, word, cell, resolve){
  cell = cell || 12; const r = clamp(resolve || 0, 0, 1);
  const chars = Array.from(word), cols = chars.length * BIN;
  cv.width = cols * cell; cv.height = BIN * cell;
  const g = cv.getContext('2d'), grids = chars.map(glyphCells);
  g.clearRect(0, 0, cv.width, cv.height);
  g.globalAlpha = 1 - r * .92;
  g.font = '800 ' + Math.round(cell * .95) + 'px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  /* lit cells get a soft tile behind their 1, so the character reads at a glance */
  g.fillStyle = 'rgba(59,240,122,.2)';
  grids.forEach((cells, n) => { for (let y = 0; y < BIN; y++) for (let x = 0; x < BIN; x++) if (cells[y * BIN + x]) g.fillRect((n * BIN + x) * cell + .5, y * cell + .5, cell - 1, cell - 1); });
  for (let pass = 0; pass < 2; pass++){
    g.fillStyle = pass ? '#5CFF94' : 'rgba(59,240,122,.09)';
    if (pass){ g.shadowColor = 'rgba(59,240,122,.55)'; g.shadowBlur = cell * .5; }
    grids.forEach((cells, n) => { for (let y = 0; y < BIN; y++) for (let x = 0; x < BIN; x++){
      const on = cells[y * BIN + x]; if ((on === 1) !== !!pass) continue;
      g.fillText(on ? '1' : '0', (n * BIN + x + .5) * cell, (y + .5) * cell);
    } });
  }
  g.shadowBlur = 0; g.globalAlpha = 1;
  if (r > 0){
    /* the same glyph, drawn as a smooth curve over the cells it was sampled into */
    g.globalAlpha = r; g.fillStyle = '#5CFF94'; g.shadowColor = 'rgba(59,240,122,.6)'; g.shadowBlur = cell * 1.2;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    chars.forEach((ch, n) => {
      g.font = '900 100px Archivo, "Helvetica Neue", Arial, sans-serif'; if ('fontStretch' in g) g.fontStretch = 'normal';
      const m = g.measureText(ch), w = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || 60, h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 72;
      const k = Math.min((BIN - 6) / w, (BIN - 6) / h) * cell;
      g.save(); g.translate((n * BIN + BIN / 2) * cell, BIN / 2 * cell); g.scale(k, k);
      g.fillText(ch, -w / 2 + (m.actualBoundingBoxLeft || 0), h / 2 - (m.actualBoundingBoxDescent || 0));
      g.restore();
    });
    g.shadowBlur = 0; g.globalAlpha = 1;
  }
}
function drawAllBinary(){ $$('canvas.term-bin').forEach(cv => drawBinary(cv, cv.dataset.word, 12)); }
function termHTML(key){
  const t = TERM[key]; if (!t) return posterHTML(key);
  return '<div class="term"><div class="term-bar"><i></i><i></i><i></i><span>' + esc(t.path) + ' — zsh</span></div>' +
    '<p class="term-line"><b>aayush@nitj</b>:<em>' + esc(t.path) + '</em>$ ' + esc(t.cmd) + '</p>' +
    '<canvas class="term-bin term-bits" data-word="' + esc(t.word) + '" role="img" aria-label="' + esc(t.word) + ' in binary"></canvas>' +
    '<p class="term-line"><b>aayush@nitj</b>:<em>' + esc(t.path) + '</em>$ <span class="caret"></span></p></div>';
}
$$('.lc-art[data-art]').forEach(f => { f.innerHTML = f.closest('#laneL') ? termHTML(f.dataset.art) : posterHTML(f.dataset.art); });
drawAllBinary();
if (document.fonts && document.fonts.load) Promise.all(['900 100px Archivo', '800 20px "JetBrains Mono"'].map(f => document.fonts.load(f))).then(drawAllBinary, () => {});
/* a quiet field of 0s and 1s behind the engineer half */
(function(){
  const lane = $('#laneL'); if (!lane) return;
  let bits = ''; for (let k = 0; k < 3400; k++) bits += Math.random() > .5 ? '1' : '0';
  const f = document.createElement('div'); f.className = 'bin-field'; f.setAttribute('aria-hidden', 'true'); f.textContent = bits;
  lane.prepend(f);
})();

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
const ACT1 = 520, MERGE = 260, STEP = 110;
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
body.classList.toggle('low', LOW);
/* a still film grain, made once */
(function grain(){
  const c = document.createElement('canvas'); c.width = c.height = 180; const g = c.getContext('2d'), d = g.createImageData(180, 180);
  for (let k = 0; k < d.data.length; k += 4){ const v = Math.random() * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; }
  g.putImageData(d, 0, 0); $('#grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
})();

/* ── the loader lifts away by itself once everything is built ── */
const gateFill = $('#gateFill'), gateMsg = $('#gateMsg');
let loadedN = 0, loadTotal = 1;
/* the inline starter counted while the scripts downloaded; carry on from where it got to */
window.__gateTaken = true;
let gateShown = parseInt(($('#gateNum') || {}).textContent, 10) || 0, gateWant = gateShown;
function progress(){
  gateWant = Math.max(gateWant, Math.round(100 * loadedN / loadTotal));
  gateFill.style.width = gateWant + '%';
}
/* the boot log on the engineer side ticks off real facts as loading passes them */
const BOOT = [[0, './boot --portfolio', true], [12, 'mount engineer.half'], [30, 'load arthis.space · 105 games'], [48, 'compile hexabed · 3,705 lines c#'],
  [66, 'warm up gpt-2 weights'], [84, 'render dioramas · 28 add-ons'], [98, 'build nine rooms']];
const CRE_MSG = [[0, 'Waking the halves'], [30, 'Rendering dioramas'], [66, 'Hanging the posters'], [98, 'Opening the doors']];
function bootLog(n){
  const log = $('#gateLog'); if (!log) return;
  log.innerHTML = BOOT.filter(b => b[2] || n >= b[0] - 12).map(b => b[2]
    ? '<span><b>aayush@nitj</b>:~$ ' + b[1] + '</span>'
    : '<span>[ ' + (n >= b[0] ? '<b>ok</b>' : '<em>..</em>') + ' ] ' + b[1] + '</span>').join('');
  const m = CRE_MSG.filter(c => n >= c[0]).pop(); gateMsg.textContent = m ? m[1] : '';
}
/* both halves count up together, smoothly rather than in jumps */
let gateDrawn = -1;
(function count(){
  if (!body.classList.contains('booting')) return;
  gateShown += (gateWant - gateShown) * .1;
  const n = Math.min(100, Math.round(gateShown));
  if (n !== gateDrawn){
    gateDrawn = n;
    $('#gateNum').textContent = n;
    $('#gateBits').textContent = '0b' + n.toString(2);
    const cv = $('#gateBin'); if (cv) drawBinary(cv, String(n).padStart(2, '0'), 12, smooth(50, 92, n));
    bootLog(n);
  }
  requestAnimationFrame(count);
})();
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
    ? Promise.all(['900 100px Archivo', '500 20px Geist', '500 20px "Geist Mono"', '800 20px "JetBrains Mono"', '400 20px "JetBrains Mono"'].map(f => document.fonts.load(f))).catch(() => {})
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
const wallColor = s => s === 'eng' ? 0x0B110D : s === 'cre' ? C.red : C.paper;
function sideAt(x, z){
  if (x < -HALF || x > HALF || z > 0 || z < Z_BACK) return null;
  if (z > -HALL_D) return 'hall';
  const r = Math.floor((-HALL_D - z) / CELL);
  if (r >= 4) return 'both';
  const k = ROOMS.findIndex((R0, i) => i < 8 && Math.abs(R0.cz - rowZ(r)) < .1 && Math.sign(R0.cx) === Math.sign(x));
  return k >= 0 ? ROOMS[k].side : 'both';
}
/* the walls speak like the two halves: binary on the engineer side, a printed halftone on the creator side */
let WALL_TEX = null;
function wallTextures(){
  if (WALL_TEX) return WALL_TEX;
  const [bc, bg] = makeCanvas(512, 512);
  bg.fillStyle = '#0B110D'; bg.fillRect(0, 0, 512, 512);
  bg.font = '700 15px "JetBrains Mono", ui-monospace, monospace'; bg.textBaseline = 'top';
  for (let y = 0; y < 512; y += 19) for (let x = 0; x < 512; x += 13){
    const v = Math.random(); bg.fillStyle = 'rgba(59,240,122,' + (v > .93 ? .34 : .07 + v * .07).toFixed(3) + ')'; bg.fillText(Math.random() > .5 ? '1' : '0', x + 1, y + 2);
  }
  const [dc, dg] = makeCanvas(256, 256);
  dg.fillStyle = HEX.red; dg.fillRect(0, 0, 256, 256); dg.fillStyle = 'rgba(120,16,6,.16)';
  for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16){ dg.beginPath(); dg.arc(x + (y / 16 % 2 ? 8 : 0), y, 2.6, 0, Math.PI * 2); dg.fill(); }
  const [fc, fg] = makeCanvas(256, 256);
  fg.fillStyle = '#0D140F'; fg.fillRect(0, 0, 256, 256); fg.strokeStyle = 'rgba(59,240,122,.28)'; fg.lineWidth = 2; fg.strokeRect(1, 1, 254, 254);
  fg.fillStyle = 'rgba(59,240,122,.5)'; [[1, 1], [255, 1], [1, 255], [255, 255]].forEach(q => fg.fillRect(q[0] - 3, q[1] - 3, 6, 6));
  WALL_TEX = { bin: texFrom(bc), dot: texFrom(dc), grid: texFrom(fc) };
  Object.values(WALL_TEX).forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  return WALL_TEX;
}
function faceMat(s, w, h){
  if (s === 'eng' || s === 'cre'){
    const base = wallTextures()[s === 'eng' ? 'bin' : 'dot'], t = base.clone(); t.needsUpdate = true;
    t.repeat.set(Math.max(1, w / (s === 'eng' ? 3.4 : 2.2)), Math.max(1, h / (s === 'eng' ? 3.4 : 2.2)));
    return new THREE.MeshLambertMaterial({ map: t });
  }
  return mat(s === null || s === 'hall' ? C.paper : wallColor(s));
}

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
      mats = [end, end, end, end, faceMat(sideAt(mid, at + .5), len, h), faceMat(sideAt(mid, at - .5), len, h)];
    } else {                      // runs along z, at x = at
      g = boxGeo(WT, h, len); pos = V3(at, sp[2] + h / 2, mid);
      const end = mat(C.paper);
      mats = [faceMat(sideAt(at + .5, mid), len, h), faceMat(sideAt(at - .5, mid), len, h), end, end, end, end];
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

  /* engineer rooms get a dark floor with a green grid, like a terminal's */
  ROOMS.forEach(rm => {
    if (rm.side !== 'eng') return;
    const t = wallTextures().grid.clone(); t.needsUpdate = true; t.repeat.set(CELL / 1.6, CELL / 1.6);
    const f = plane(world, CELL - WT, CELL - WT, new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), rm.cx, .003, rm.cz);
    f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
  });
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

/* ══ the pieces, in the ARTHIS flat-2D language ══════════════
   Matte colour lit by a third of itself, three tones per family
   (main · trim ×0.55 · facet ×1.18), flat-shaded facets, 8-sided
   round parts, one-segment bevels, one accent per piece, and every
   piece grounded on its own base. No outlines, no cel bands, no gloss. */
const FAM = { green: 0x3BF07A, wood: 0xB07A4A, cream: 0xEFE6D2, conc: 0x9E9A92, ink: 0x2B2B2E, red: 0xF23A1D, steel: 0x8D96A0,
  pump: 0x3F95C4, grass: 0x7DB55A, sand: 0xE2C98F, water: 0x4FA3D1, stone: 0xA8A39A, leaf: 0x4F8A3E, lamp: 0xFFE7B0 };
const F2M = new Map();
function fm(fam, tone){
  const key = fam + (tone || 'm');
  if (F2M.has(key)) return F2M.get(key);
  const c = new THREE.Color(FAM[fam]);
  if (tone === 't') c.multiplyScalar(.55);
  if (tone === 'f'){ c.multiplyScalar(1.18); c.r = Math.min(1, c.r + .04); c.g = Math.min(1, c.g + .04); c.b = Math.min(1, c.b + .04); }
  const L = c.convertSRGBToLinear();
  const m = LOW ? new THREE.MeshLambertMaterial({ color: L, emissive: L.clone().multiplyScalar(.32) })
    : new THREE.MeshPhongMaterial({ color: L, emissive: L.clone().multiplyScalar(.32), flatShading: true, shininess: 0, specular: 0x000000 });
  F2M.set(key, m); return m;
}
/* a chunky box: one-segment chamfer, straight-cut corners */
function cgeo(w, h, d, r){
  r = Math.min(r, w / 2 - .002, d / 2 - .002, h / 2 - .002);
  const k = 'c' + [w, h, d, r].map(v => v.toFixed(3)).join(',');
  if (GEO.has(k)) return GEO.get(k);
  const W = w - 2 * r, Dd = d - 2 * r, s = new THREE.Shape();
  s.moveTo(-W / 2, -Dd / 2); s.lineTo(W / 2, -Dd / 2); s.lineTo(W / 2, Dd / 2); s.lineTo(-W / 2, Dd / 2); s.lineTo(-W / 2, -Dd / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: LOW ? 1 : 3, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, r, 0); g.computeVertexNormals();
  GEO.set(k, g); return g;
}
const K = (par, w, h, d, m, x, y, z, o) => mesh(par, cgeo(w, h, d, (o && o.r) || Math.min(.06, w * .2, h * .2, d * .2)), m, x, y, z, o);
const O8 = (par, rt, rb, h, m, x, y, z, o) => CYL(par, rt, rb, h, (o && o.seg) || 12, m, x, y, z, o);

/* every piece stands on its own base: a slab with a darker rim, like a diorama island */
function base(g, w, d, fam, round){
  fam = fam || 'cream';
  if (round){ O8(g, w + .06, w + .1, .06, fm(fam, 't'), 0, 0, 0, { seg: 10 }); O8(g, w, w, .14, fm(fam), 0, .06, 0, { seg: 10 }); }
  else { K(g, w + .1, .06, d + .1, fm(fam, 't'), 0, 0, 0); K(g, w, .14, d, fm(fam), 0, .06, 0); }
  return .2;
}

/* the room's name, painted across its far wall and cropped by it */
const WORDS = [];
const WALLWORD = ['ARTHIS', 'BLENDER', 'AKVERSE', 'HEXABED', 'INFERENCE', 'THE BOARD', '154', 'ARCADE', 'LET’S BUILD'];
function wallType(i){
  const rm = ROOMS[i], word = WALLWORD[i];
  const inner = i === 8 ? 13.5 : rm.w - WT - .04;
  const col = rm.side === 'eng' ? '#3BF07A' : rm.side === 'cre' ? HEX.black : HEX.red;
  const W = 2048, [c0, g0] = makeCanvas(W, 10);
  const px = fitText(g0, word, W * 1.04, 2000);
  const H = Math.round(px * .78), [c, g] = makeCanvas(W, H);
  g.fillStyle = col; posterFont(g, px); g.textBaseline = 'alphabetic'; g.fillText(word, -W * .02, H - px * .02);
  const h = inner * H / W, f = frameOf(i), y = RH - .45 - h / 2;
  const pl = plane(f, inner, h, decal(texFrom(c), { transparent: true }), 0, y, .012);
  WORDS[i] = { pl, y, a: -1 };
}
function frameOf(i){
  const rm = ROOMS[i], g = new THREE.Group(); g.position.copy(rm.f).addScaledVector(rm.n, WT / 2 + .005); g.rotation.y = rm.ry; world.add(g);
  return g;
}
function stand(i, dist){
  const rm = ROOMS[i], g = new THREE.Group();
  g.position.copy(rm.f).addScaledVector(rm.n, dist); g.rotation.y = rm.ry; world.add(g);
  g.userData.dist = dist; return g;
}

/* ── 0 · ARTHIS: a work desk with the feed on screen ── */
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
function chair(par, x, z, ry, acc){
  acc = acc || 'red';
  const ch = new THREE.Group(); ch.position.set(x, 0, z); ch.rotation.y = ry || 0; par.add(ch);
  K(ch, .62, .1, .6, fm(acc), 0, .5, 0); K(ch, .62, .05, .6, fm(acc, 't'), 0, .45, 0);
  K(ch, .62, .66, .1, fm(acc), 0, .62, -.27); K(ch, .66, .06, .14, fm(acc, 't'), 0, 1.26, -.27);
  O8(ch, .045, .045, .4, fm('ink'), 0, .05, 0);
  for (let k = 0; k < 5; k++){ const a = k * Math.PI * 2 / 5; K(ch, .08, .06, .36, fm('ink', 't'), Math.sin(a) * .17, .02, Math.cos(a) * .17, { ry: a }); }
}
function buildArthis(i){
  const g = stand(i, 1.9), b = base(g, 4.4, 2.6);
  K(g, 3.4, .1, 1.3, fm('wood'), 0, b + .92, -.2); K(g, 3.44, .07, 1.34, fm('wood', 't'), 0, b + .86, -.2);
  [[-1.55, -.75], [1.55, -.75], [-1.55, .35], [1.55, .35]].forEach(p => K(g, .12, .86, .12, fm('ink'), p[0], b, p[1]));
  K(g, 3.1, .08, .08, fm('ink', 't'), 0, b + .3, -.75);
  drawFeed();
  const top = b + 1.02;
  const m1 = new THREE.Group(); m1.position.set(-.55, top, -.55); g.add(m1);
  O8(m1, .2, .22, .04, fm('ink', 't'), 0, 0, 0); K(m1, .08, .36, .08, fm('ink'), 0, .04, -.02);
  K(m1, 1.76, 1.06, .12, fm('ink'), 0, .36, 0); K(m1, 1.8, .06, .14, fm('ink', 't'), 0, .33, 0);
  plane(m1, 1.6, .9, decal(feedTex), 0, .89, .065);
  const m2 = new THREE.Group(); m2.position.set(1.0, top, -.55); m2.rotation.y = -.2; g.add(m2);
  O8(m2, .17, .19, .04, fm('ink', 't'), 0, 0, 0); K(m2, .08, .3, .08, fm('ink'), 0, .04, -.02);
  K(m2, .78, 1.16, .12, fm('ink'), 0, .3, 0);
  plane(m2, .66, 1.04, decal(texFrom(posterCanvas('wall', 300))), 0, .88, .065);
  K(g, .96, .04, .32, fm('cream'), -.4, top, .1); K(g, .96, .02, .32, fm('cream', 't'), -.4, top - .01, .1);
  O8(g, .085, .08, .16, fm('cream'), 1.25, top, .15); O8(g, .09, .09, .02, fm('cream', 't'), 1.25, top + .16, .15);
  const ph = new THREE.Group(); ph.position.set(-1.45, top, .05); ph.rotation.y = .4; g.add(ph);
  K(ph, .22, .03, .16, fm('ink', 't'), 0, 0, 0); K(ph, .22, .4, .04, fm('ink'), 0, .03, -.04, { rx: -.2 });
  plane(ph, .17, .275, decal(texFrom(gameTex('fruit'))), 0, .25, -.01).rotation.x = -.2;
  chair(g, .2, .95, Math.PI + .3, 'green');
  /* a desk lamp in the street-lamp language, and a cable run to the floor */
  const dl = new THREE.Group(); dl.position.set(1.55, b + 1.02, -.6); g.add(dl);
  O8(dl, .12, .14, .04, fm('ink', 't'), 0, 0, 0); K(dl, .04, .5, .04, fm('ink'), 0, .04, 0, { rz: .2 }); K(dl, .04, .04, .32, fm('ink'), -.05, .52, .1, { rx: .4 });
  K(dl, .2, .12, .14, fm('ink'), -.05, .5, .28); plane(dl, .16, .1, flat(0xEFFFF4), -.05, .5, .35).rotation.x = Math.PI / 2;
  K(g, .05, .05, 1.2, fm('green', 't'), -1.4, b, -.4, { r: .02 });
  wallType(i);
  anim.push(t => { const k = Math.floor(t / 2.4); if (k !== feedIdx){ feedIdx = k; drawFeed(); } });
  return g;
}

/* ── 1 · Blender: a chunky mannequin turning on a turntable ── */
function buildBlender(i){
  const g = stand(i, 3.4), b = base(g, 1.75, 0, 'cream', true);
  O8(g, 1.1, 1.18, .5, fm('ink'), 0, b, 0, { seg: 10 }); O8(g, 1.2, 1.2, .06, fm('ink', 't'), 0, b + .5, 0, { seg: 10 });
  const plate = O8(g, 1.04, 1.04, .06, fm('red'), 0, b + .56, 0, { seg: 10 });
  const fig = new THREE.Group(); fig.position.y = b + .62; g.add(fig);
  const W = fm('cream'), T = fm('cream', 't');
  const limb = (x0, y0, x1, y1, r, z) => { const A = V3(x0, y0, z || 0), Bv = V3(x1, y1, z || 0), len = A.distanceTo(Bv);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 8), W); m.position.copy(A).add(Bv).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), Bv.clone().sub(A).normalize()); m.castShadow = true; fig.add(m);
    const j = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.3, r * 1.2, 8), T); j.position.copy(Bv); j.quaternion.copy(m.quaternion); fig.add(j); };
  K(fig, .5, .62, .3, W, 0, 1.0, 0); K(fig, .54, .08, .34, T, 0, 1.6, 0); K(fig, .44, .16, .28, T, 0, .92, 0);
  O8(fig, .2, .22, .4, W, 0, 1.72, 0); O8(fig, .22, .22, .05, T, 0, 2.1, 0); O8(fig, .07, .08, .1, T, 0, 1.64, 0);
  limb(-.3, 1.52, -.55, 1.2, .07); limb(-.55, 1.2, -.45, .92, .06); limb(.3, 1.52, .58, 1.34, .07); limb(.58, 1.34, .74, 1.6, .06);
  limb(-.13, .92, -.18, .48, .09); limb(-.18, .48, -.2, .04, .08); limb(.13, .92, .2, .5, .09); limb(.2, .5, .22, .04, .08);
  /* a softbox and a camera on a tripod, both on the same base */
  const sb = new THREE.Group(); sb.position.set(-2.2, 0, .6); sb.rotation.y = .9; g.add(sb);
  O8(sb, .18, .22, .05, fm('ink', 't'), 0, 0, 0); O8(sb, .035, .035, 2.2, fm('ink'), 0, .05, 0);
  K(sb, 1.2, .9, .34, fm('ink'), 0, 1.95, 0); K(sb, 1.26, .07, .38, fm('ink', 't'), 0, 2.82, 0);
  plane(sb, 1.06, .76, flat(0xFFF4DE), 0, 2.4, .175);
  const cam = new THREE.Group(); cam.position.set(2.0, 0, 1.4); cam.rotation.y = -2.4 + Math.PI; g.add(cam);
  [0, 2.1, 4.2].forEach(r => K(cam, .05, 1.42, .05, fm('ink'), Math.sin(r) * .3, 0, Math.cos(r) * .3, { rx: Math.cos(r) * -.2, rz: Math.sin(r) * .2 }));
  K(cam, .62, .4, .38, fm('ink'), 0, 1.38, 0); K(cam, .66, .06, .42, fm('ink', 't'), 0, 1.36, 0);
  const lens = O8(cam, .15, .17, .3, fm('ink', 't'), 0, 1.58, .32); lens.rotation.x = Math.PI / 2;
  const rec = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .02, 8), flat(C.red)); rec.position.set(.22, 1.79, 0); cam.add(rec);
  /* the timeline as an orbit: keyframe diamonds circling the turntable */
  const keys = new THREE.Group(); keys.position.y = b + 1.6; g.add(keys);
  for (let k = 0; k < 10; k++){
    const a = k / 10 * Math.PI * 2, d = new THREE.Mesh(new THREE.OctahedronGeometry(k % 3 ? .07 : .11, 0), k % 3 ? fm('cream') : fm('red'));
    d.position.set(Math.cos(a) * 1.75, Math.sin(a * 2) * .08, Math.sin(a) * 1.75); keys.add(d);
  }
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.75, .008, 6, 96), flat(0xF3F1EC, { transparent: true, opacity: .45 })); orbit.rotation.x = Math.PI / 2; keys.add(orbit);
  wallType(i);
  anim.push((t, dt) => { fig.rotation.y += dt * (REDUCED ? 0 : .5); plate.rotation.y = fig.rotation.y; keys.rotation.y = REDUCED ? 0 : -t * .3; rec.visible = Math.floor(t * 1.5) % 2 === 0; });
  return g;
}

/* ── 2 · AKverse: the Kaleshi Family set, mid-shoot ── */
function handPump(par, x, z, ry){
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry || 0; par.add(p);
  K(p, .9, .08, .9, fm('conc', 't'), 0, 0, 0); K(p, .82, .06, .82, fm('conc'), 0, .08, 0);
  K(p, .14, .03, .4, fm('conc', 't'), 0, .14, .5);
  O8(p, .11, .14, .14, fm('pump', 't'), 0, .14, 0);
  O8(p, .07, .08, .6, fm('pump'), 0, .28, 0);
  O8(p, .13, .13, .34, fm('pump'), 0, .88, 0); O8(p, .14, .14, .04, fm('pump', 't'), 0, 1.06, 0);
  K(p, .2, .14, .2, fm('pump', 'f'), 0, 1.22, 0);
  const sp = K(p, .06, .06, .3, fm('pump'), 0, 1.0, .2); sp.rotation.x = .35;
  const h = new THREE.Group(); h.position.set(0, 1.3, -.06); h.rotation.x = -.35; p.add(h);
  K(h, .05, .05, .7, fm('pump'), 0, 0, -.35); K(h, .07, .07, .16, fm('pump', 't'), 0, -.01, -.66);
  O8(p, .1, .08, .14, fm('steel'), 0, .14, .32); O8(p, .105, .105, .02, fm('steel', 't'), 0, .28, .32);
}
function charpai(par, x, z, ry){
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry || 0; par.add(c);
  [[-.5, -.28], [.5, -.28], [-.5, .28], [.5, .28]].forEach(q => { O8(c, .045, .04, .36, fm('wood'), q[0], 0, q[1]); O8(c, .055, .055, .04, fm('wood', 't'), q[0], .14, q[1]); });
  K(c, 1.12, .06, .07, fm('wood', 't'), 0, .32, -.28); K(c, 1.12, .06, .07, fm('wood', 't'), 0, .32, .28);
  K(c, .07, .06, .62, fm('wood', 't'), -.52, .32, 0); K(c, .07, .06, .62, fm('wood', 't'), .52, .32, 0);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 7; q++) K(c, .13, .02, .12, fm('cream', (r + q) % 2 ? 't' : 'm'), -.42 + q * .14, .33, -.2 + r * .135, { r: .004 });
}
function buildAkverse(i){
  const g = stand(i, 2.4), b = base(g, 5.2, 3.4, 'sand');
  /* the house: cream walls, a red door, a parapet and a black tank on the roof */
  const H = new THREE.Group(); H.position.set(-1.0, b, -.8); g.add(H);
  K(H, 2.2, 1.7, 1.5, fm('cream'), 0, 0, 0);
  K(H, 2.3, .1, 1.6, fm('cream', 't'), 0, 1.7, 0);
  K(H, 2.3, .22, .1, fm('cream'), 0, 1.8, .75); K(H, 2.3, .22, .1, fm('cream'), 0, 1.8, -.75); K(H, .1, .22, 1.6, fm('cream'), 1.1, 1.8, 0); K(H, .1, .22, 1.6, fm('cream'), -1.1, 1.8, 0);
  O8(H, .26, .26, .36, fm('ink'), -.6, 1.8, -.35); O8(H, .28, .28, .05, fm('ink', 't'), -.6, 2.16, -.35);
  K(H, .5, .9, .06, fm('red'), .35, 0, .76); K(H, .6, .06, .08, fm('red', 't'), .35, .9, .76);
  [[-.55, .9], [.95, .9]].forEach(w => { K(H, .38, .38, .05, fm('ink'), w[0], w[1], .76); K(H, .44, .05, .07, fm('cream', 't'), w[0], w[1] - .03, .77); });
  K(H, .7, .06, .3, fm('conc'), .35, 0, .92); K(H, .6, .06, .2, fm('conc', 't'), .35, .06, .88);
  K(H, 2.3, .08, .08, fm('red'), 0, 1.45, .76);
  charpai(g, 1.25, .55, -.3);
  handPump(g, 1.85, -.95, .4);
  /* the camera that shoots it */
  const cam = new THREE.Group(); cam.position.set(-1.6, b, 1.3); cam.rotation.y = 2.7; g.add(cam);
  [0, 2.1, 4.2].forEach(r => K(cam, .04, 1.1, .04, fm('ink'), Math.sin(r) * .24, 0, Math.cos(r) * .24, { rx: Math.cos(r) * -.2, rz: Math.sin(r) * .2 }));
  K(cam, .44, .3, .3, fm('ink'), 0, 1.06, 0); O8(cam, .11, .13, .22, fm('ink', 't'), 0, 1.21, .24).rotation.x = Math.PI / 2;
  const recL = O8(cam, .03, .03, .02, flat(C.red), .14, 1.36, 0);
  /* a boom mic reaching over the set */
  const bm = new THREE.Group(); bm.position.set(2.3, b, 1.0); g.add(bm);
  [0, 2.1, 4.2].forEach(r => K(bm, .035, .8, .035, fm('ink'), Math.sin(r) * .22, 0, Math.cos(r) * .22, { rx: Math.cos(r) * -.25, rz: Math.sin(r) * .25 }));
  O8(bm, .025, .025, 1.6, fm('ink'), 0, .7, 0);
  const arm = new THREE.Group(); arm.position.y = 2.3; arm.rotation.y = 2.4; bm.add(arm);
  K(arm, .04, .04, 2.2, fm('ink'), 0, 0, -1.0, { rx: -.18, r: .015 });
  const mic = O8(arm, .07, .07, .42, fm('ink', 't'), 0, -.2, -2.05); mic.rotation.x = Math.PI / 2;
  O8(arm, .09, .09, .3, fm('cream', 't'), 0, -.2, -2.05).rotation.x = Math.PI / 2;
  wallType(i);
  anim.push(t => { recL.visible = Math.floor(t * 1.4) % 2 === 0; });
  return g;
}

/* ── 3 · HexaBed: a hex island that builds itself, in his terrain tones ── */
let hexRegen = null;
function buildHexa(i){
  const g = stand(i, 3.4), b = base(g, 1.95, 0, 'cream', true);
  O8(g, .5, .6, .7, fm('ink'), 0, b, 0, { seg: 10 }); O8(g, 1.7, 1.7, .08, fm('ink', 't'), 0, b + .7, 0, { seg: 10 });
  /* the projector: a glowing green ring on the table, the island floating above it */
  const ringM = new THREE.MeshBasicMaterial({ color: lin(FAM.green), transparent: true, opacity: .9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, .025, 8, 72), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = b + .8; g.add(ring);
  const beamT = (function(){ const [c, x] = makeCanvas(4, 128); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(59,240,122,0)'); gr.addColorStop(1, 'rgba(59,240,122,.55)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 128); return texFrom(c); })();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, .55, 48, 1, true), new THREE.MeshBasicMaterial({ map: beamT, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = b + 1.08; g.add(beam);
  const scan = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.5, 64), new THREE.MeshBasicMaterial({ color: lin(FAM.green), transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  scan.rotation.x = -Math.PI / 2; g.add(scan);
  const isle = new THREE.Group(); isle.position.y = b + 1.05; g.add(isle);
  anim.push(t => { isle.rotation.y = REDUCED ? 0 : t * .18; isle.position.y = b + 1.05 + Math.sin(t * 1.4) * .04; const u = (t * .5) % 1; scan.position.y = b + .82 + u * .7; scan.material.opacity = .45 * (1 - u); });
  const Rr = .2, tiles = [], hexG = new THREE.CylinderGeometry(Rr * .96, Rr * .96, 1, 6);
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++){
    if (Math.abs(q + r) > 3) continue;
    const x = (q + r / 2) * Rr * 1.732, z = r * Rr * 1.5, d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    const m = new THREE.Mesh(hexG, fm('grass')); m.position.set(x, 0, z); m.rotation.y = Math.PI / 6;
    m.castShadow = m.receiveShadow = true; isle.add(m); tiles.push({ m, q, r, d, h: .2, t0: 0 });
  }
  const trees = [];
  for (let k = 0; k < 7; k++){
    const tr = new THREE.Group();
    O8(tr, .025, .03, .12, fm('wood', 't'), 0, 0, 0);
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(.11, .2, 8), fm('leaf')); c1.position.y = .2; tr.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(.08, .16, 8), fm('leaf', 'f')); c2.position.y = .32; tr.add(c2);
    isle.add(tr); trees.push(tr);
  }
  let seed = 1, born = -10;
  hexRegen = function(now){
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = (a2, b2) => { const v = Math.sin(a2 * 12.9898 + b2 * 78.233 + seed * .013) * 43758.5453; return v - Math.floor(v); };
    tiles.forEach(t => {
      const n = Math.sin(t.q * 1.3 + seed) * .8 + Math.cos(t.r * 1.1 - seed * .7) * .7 + 1.2;
      t.water = t.d > 0 && t.d < 3 && rnd(t.q, t.r) < .14;
      t.road = !t.water && ((t.r === 0 && t.q > -3 && t.q < 3) || (t.q === 0 && t.r < 0 && t.r > -3));
      t.h = t.water ? .06 : t.d === 3 ? .08 : .1 + Math.max(0, n) * .15;
      if (t.road) t.h = Math.min(t.h, .14);
      t.m.material = t.water ? fm('water') : t.road ? fm('ink', 'f') : t.d === 3 ? fm('sand') : t.h > .38 ? fm('stone') : fm('grass', (t.q + t.r) % 3 ? 'm' : 'f');
      t.t0 = t.d * .09 + rnd(t.r, t.q) * .12;
    });
    const land = tiles.filter(t => !t.road && !t.water && t.d < 3 && t.h <= .38);
    trees.forEach((tr, k) => { tr.userData.t = land.length ? land[(k * 7 + seed) % land.length] : null; tr.visible = !!tr.userData.t; });
    born = now;
  };
  hexRegen(0);
  wallType(i);
  anim.push(t => {
    const age = t - born;
    tiles.forEach(tl => { const k = REDUCED ? 1 : ease(clamp((age - tl.t0) / .5, 0, 1)); const h = Math.max(.001, tl.h * k); tl.m.scale.y = h; tl.m.position.y = h / 2; });
    trees.forEach(tr => { const tl = tr.userData.t; if (!tl) return; tr.position.set(tl.m.position.x, tl.m.scale.y, tl.m.position.z); tr.scale.setScalar(REDUCED ? 1 : clamp((age - tl.t0 - .35) / .3, .001, 1)); });
  });
  return g;
}

/* ── 4 · Inference: racks on a plinth, a network thinking above ── */
function buildAI(i){
  const g = stand(i, 1.1), b = base(g, 3.8, 1.4);
  const ON = [flat(0xC9F5D6), flat(FAM.green)], OFF = fm('ink', 't');
  const leds = [];
  [-1.1, 0, 1.1].forEach(x => {
    K(g, .96, 2.4, .86, fm('ink'), x, b, 0); K(g, 1.0, .08, .9, fm('ink', 't'), x, b + 2.4, 0); K(g, 1.0, .1, .9, fm('ink', 't'), x, b, 0);
    for (let r = 0; r < 10; r++){
      K(g, .78, .04, .02, fm('ink', 't'), x, b + .26 + r * .21, .44, { r: .005 });
      for (let c = 0; c < 3; c++){ const m = new THREE.Mesh(boxGeo(.05, .05, .02), OFF); m.position.set(x - .28 + c * .08, b + .36 + r * .21, .445); g.add(m); leds.push(m); }
    }
  });
  const net = new THREE.Group(); net.position.set(0, b + 3.4, .4); g.add(net);
  const LAY = [3, 4, 3, 1], nodes = [];
  LAY.forEach((n, li) => { for (let k = 0; k < n; k++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), li === 3 ? fm('green') : fm('cream'));
    m.position.set((li - 1.5) * .62, (k - (n - 1) / 2) * .4, 0); net.add(m); nodes.push({ m, li });
  } });
  const pts = [], edges = [];
  nodes.forEach(p => nodes.forEach(q => { if (q.li === p.li + 1){ pts.push(p.m.position, q.m.position); edges.push([p.m.position, q.m.position, p.li]); } }));
  net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: lin(0x6E6B66) })));
  const pulses = edges.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), flat(FAM.green)); net.add(m); return m; });
  /* cable runs from the racks across the floor */
  [-1.1, 0, 1.1].forEach((x, k) => K(g, .07, .04, 1.4 + k * .3, fm('green', 't'), x + .3, b, 1.1 + k * .15, { r: .015 }));
  wallType(i);
  let last = 0;
  anim.push(t => {
    if (t - last > .16){ last = t; leds.forEach((m, k) => { const v = Math.sin(k * 12.9898 + Math.floor(t * 6) * 78.233) * 43758.5453; const r = v - Math.floor(v); m.material = r > .85 ? ON[1] : r > .45 ? ON[0] : OFF; }); }
    const u = (t * .8) % 1, layer = Math.floor((t * .8) % 3);
    edges.forEach((e, k) => { const p = pulses[k]; p.visible = !REDUCED && e[2] === layer; if (p.visible) p.position.lerpVectors(e[0], e[1], u); });
    net.position.y = b + 3.4 + Math.sin(t * 1.3) * .05;
  });
  return g;
}

/* ── 5 · The Board: a wood-framed pinboard, a stool, a crate of cards ── */
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
  K(w, 6.4, 3.4, .1, fm('wood', 't'), -.4, .9, .05); K(w, 6.1, 3.1, .06, fm('cream'), -.4, 1.05, .12);
  const items = [
    { tex: texFrom(posterCanvas('cv', 300)), w: .8, h: .8 * PHI, x: -2.9, y: 3.2 },
    { tex: texFrom(posterCanvas('tools', 300)), w: .8, h: .8 * PHI, x: -1.95, y: 3.25 },
    { tex: texFrom(gameTex('fruit')), w: .56, h: .56 * PHI, x: -1.0, y: 3.35 },
    { tex: texFrom(gameTex('doodle')), w: .56, h: .56 * PHI, x: -.35, y: 3.3 },
    { tex: cardCanvas('Hustiq', 'Edit by chatting', true), w: 1.05, h: .65, x: .95, y: 3.5 },
    { tex: cardCanvas('Travel Atlas', '30+ places'), w: 1.05, h: .65, x: -2.6, y: 1.75 },
    { tex: cardCanvas('Avatar Maker', 'Presets + parts', true), w: 1.05, h: .65, x: -1.35, y: 1.7 },
    { tex: cardCanvas('Daily Rest', 'Pomodoro'), w: 1.05, h: .65, x: -.1, y: 1.75 },
    { tex: cardCanvas('Asset viewer', 'Three.js', true), w: 1.05, h: .65, x: 1.2, y: 2.2 }
  ];
  const pins = [];
  items.forEach((it, k) => {
    plane(w, it.w, it.h, decal(it.tex), it.x, it.y, .2 + k * .003);
    O8(w, .035, .035, .04, fm('red'), it.x, it.y + it.h / 2 - .06, .2).rotation.x = Math.PI / 2;
    pins.push(V3(it.x, it.y + it.h / 2 - .06, .24));
  });
  const order = [0, 5, 6, 1, 2, 7, 3, 8, 4, 0];
  const sp = []; for (let k = 0; k < order.length - 1; k++) sp.push(pins[order[k]], pins[order[k + 1]]);
  w.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), new THREE.LineBasicMaterial({ color: lin(C.red) })));
  const g = stand(i, 1.8), b = base(g, 3.0, 1.4);
  const st = new THREE.Group(); st.position.set(-.8, b, 0); g.add(st);
  O8(st, .3, .3, .07, fm('wood'), 0, .62, 0); O8(st, .31, .31, .03, fm('wood', 't'), 0, .6, 0);
  [0, 2.1, 4.2].forEach(r => K(st, .06, .62, .06, fm('wood', 't'), Math.sin(r) * .2, 0, Math.cos(r) * .2, { rx: Math.cos(r) * -.08, rz: Math.sin(r) * .08 }));
  K(g, .9, .5, .6, fm('wood'), .7, b, 0); K(g, .94, .06, .64, fm('wood', 't'), .7, b + .5, 0);
  [[.5, .1], [.75, -.05], [.95, .12]].forEach((q, k) => K(g, .3, .02, .22, fm(k === 1 ? 'red' : 'cream'), q[0], b + .56 + k * .02, q[1], { ry: k * .3, r: .004 }));
  wallType(i);
  return g;
}

/* ── 6 · 154: the numbers as a chunky bar chart ── */
function plaqueCanvas(n, l, dark){
  const [c, g] = makeCanvas(300, 200);
  g.fillStyle = dark ? HEX.black : HEX.paper; g.fillRect(0, 0, 300, 200);
  g.fillStyle = dark ? HEX.paper : HEX.black; fitText(g, n, 270, 130); g.fillText(n, 14, 140);
  g.font = '500 20px "Geist Mono", monospace'; g.fillStyle = dark ? '#B7B4AD' : '#5C5B58'; g.fillText(l.toUpperCase(), 16, 182);
  return texFrom(c);
}
function buildNumbers(i){
  const g = stand(i, 2.4), b = base(g, 5.0, 2.0);
  const BARS = [['154', 'Builds', 154, 'red'], ['43', 'Three.js', 43, 'ink'], ['28', 'Add-ons', 28, 'conc'], ['15', 'P2P games', 15, 'cream']];
  BARS.forEach((bar, k) => {
    const x = -1.65 + k * 1.1, h = .5 + Math.sqrt(bar[2] / 154) * 2.6;
    K(g, .8, h, .8, fm(bar[3]), x, b, 0); K(g, .86, .08, .86, fm(bar[3], 't'), x, b + h, 0);
    plane(g, .7, .467, decal(plaqueCanvas(bar[0], bar[1], bar[3] === 'ink' || bar[3] === 'red')), x, b + .42, .41);
  });
  const extra = [['AIR 8956', 'JEE Adv.'], ['98.9', 'JEE Main %ile']];
  extra.forEach((e, k) => { const p = new THREE.Group(); p.position.set(2.0, b, .2 - k * .5); p.rotation.y = -.4; g.add(p);
    K(p, .5, .5 + k * .2, .4, fm('cream'), 0, 0, 0); plane(p, .46, .3, decal(plaqueCanvas(e[0], e[1], false)), 0, .3 + k * .1, .21); });
  wallType(i);
  return g;
}

/* ── 7 · The arcade: two red cabinets and a station bench ── */
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
  const P = [[-.5, 0], [.5, 0], [.5, 1.0], [.64, 1.08], [.64, 1.18], [.26, 1.32], [.12, 2.16], [.4, 2.26], [.4, 2.72], [-.5, 2.72]];
  const s = new THREE.Shape(); s.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => s.lineTo(p[0], p[1]));
  const side = new THREE.ExtrudeGeometry(s, { depth: .12, bevelEnabled: false });
  side.rotateY(-Math.PI / 2);
  [-.6, .72].forEach(sx => mesh(cab, side, fm('red'), sx, 0, 0));
  const core = new THREE.ExtrudeGeometry(s, { depth: 1.18, bevelEnabled: false }); core.translate(0, 0, -.59); core.rotateY(-Math.PI / 2);
  mesh(cab, core, fm('ink'), -.04, -.001, 0).scale.set(1, .998, .97);
  const a = P[5], bb = P[6], len = Math.hypot(bb[0] - a[0], bb[1] - a[1]), nz = bb[1] - a[1], ny = a[0] - bb[0], nl = Math.hypot(nz, ny);
  const scr = plane(cab, 1.0, len * .9, decal(arcTex), 0, (a[1] + bb[1]) / 2 + ny / nl * .03, (a[0] + bb[0]) / 2 + nz / nl * .03 - .02);
  scr.rotation.x = -Math.atan2(ny, nz);
  const [mc, mg] = makeCanvas(512, 190); mg.fillStyle = HEX.paper; mg.fillRect(0, 0, 512, 190); mg.fillStyle = HEX.red; const mp = fitText(mg, label, 470, 170); mg.fillText(label, 21, 95 + mp * .38);
  plane(cab, 1.1, .4, decal(texFrom(mc)), 0, 2.49, .41);
  O8(cab, .02, .02, .14, fm('ink', 't'), -.28, 1.2, .45); const knob = O8(cab, .07, .07, .08, fm('red'), -.28, 1.33, .45);
  [.08, .26, .44].forEach((bx, k) => O8(cab, .05, .05, .04, fm(k === 0 ? 'red' : 'cream'), bx, 1.2, .48));
  return cab;
}
function bench(par, x, z, ry){
  const bn = new THREE.Group(); bn.position.set(x, 0, z); bn.rotation.y = ry || 0; par.add(bn);
  [-.75, .75].forEach(sx => { K(bn, .08, .44, .5, fm('ink'), sx, 0, 0); K(bn, .08, .5, .08, fm('ink'), sx, .44, -.22); K(bn, .1, .04, .52, fm('ink', 't'), sx, .42, 0); });
  for (let k = 0; k < 4; k++) K(bn, 1.7, .05, .11, fm('wood', k % 2 ? 'f' : 'm'), 0, .46, -.18 + k * .125);
  for (let k = 0; k < 3; k++) K(bn, 1.7, .1, .04, fm('wood', k % 2 ? 'f' : 'm'), 0, .58 + k * .13, -.24);
}
function buildArcade(i){
  const g = stand(i, 1.9), b = base(g, 3.4, 1.6);
  drawArcade(0);
  const cabs = new THREE.Group(); cabs.position.y = b; g.add(cabs);
  cabinet(cabs, -.8, .14, 'ARCADE'); cabinet(cabs, .8, -.14, 'PLAY');
  bench(g, 0, 2.3, Math.PI);
  wallType(i);
  anim.push(t => drawArcade(t));
  return g;
}

/* ── 8 · The exit: a door, a street lamp, a bench and a postbox ── */
function streetLamp(par, x, z, ry){
  const l = new THREE.Group(); l.position.set(x, 0, z); l.rotation.y = ry || 0; par.add(l);
  K(l, .5, .2, .5, fm('conc'), 0, 0, 0); K(l, .56, .05, .56, fm('conc', 't'), 0, .18, 0);
  O8(l, .06, .1, 3.4, fm('ink'), 0, .2, 0);
  [.6, 1.6, 2.6].forEach(y => O8(l, .1, .1, .05, fm('ink', 't'), 0, .2 + y, 0));
  K(l, .07, .07, .9, fm('ink'), 0, 3.5, .38, { rx: -.12 });
  K(l, .05, .05, .5, fm('ink', 't'), 0, 3.25, .2, { rx: .7 });
  K(l, .3, .16, .4, fm('ink'), 0, 3.42, .84); plane(l, .26, .32, flat(FAM.lamp), 0, 3.42, .84).rotation.x = Math.PI / 2;
}
function buildContact(i){
  const w = frameOf(i);
  K(w, 2.5, 4.1, .14, fm('cream', 't'), 0, 0, .07); K(w, 2.2, 3.9, .1, fm('wood'), 0, 0, .14);
  [[-.5, .5], [.5, .5], [-.5, 2.2], [.5, 2.2]].forEach(q => K(w, .8, 1.4, .04, fm('wood', 't'), q[0], q[1], .22));
  O8(w, .05, .05, .06, fm('red'), .82, 1.8, .26).rotation.x = Math.PI / 2;
  const g = stand(i, 2.2), b = base(g, 7.0, 1.8);
  streetLamp(g, -1.6, -.3, 0);
  bench(g, -3.0, .1, 0);
  const mb = new THREE.Group(); mb.position.set(2.2, b, 0); g.add(mb);
  O8(mb, .07, .07, .9, fm('ink'), 0, 0, 0);
  K(mb, .46, .5, .62, fm('red'), 0, .9, 0); K(mb, .5, .06, .66, fm('red', 't'), 0, 1.4, 0); K(mb, .3, .03, .04, fm('ink'), 0, 1.25, .31);
  const pl = new THREE.Group(); world.add(pl);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .5, -.3, 0, -.3, 0, .05, -.15, 0, 0, .5, 0, .05, -.15, .3, 0, -.3], 3));
  pg.computeVertexNormals();
  pl.add(new THREE.Mesh(pg, new THREE.MeshPhongMaterial({ color: lin(C.paper), emissive: lin(C.paper).multiplyScalar(.32), side: THREE.DoubleSide, flatShading: true, shininess: 0, specular: 0x000000 })));
  const rm = ROOMS[i];
  wallType(i);
  anim.push(t => {
    const u = REDUCED ? 0 : t * .5;
    pl.position.set(rm.cx + Math.sin(u) * 3, 3.2 + Math.sin(u * 2) * .3, rm.cz + Math.cos(u) * 1.6);
    pl.rotation.set(0, u + Math.PI / 2, Math.sin(u * 2) * .3);
  });
  return g;
}

/* ══ atmosphere: a gallery beam over every piece, and the air of each half ══ */
function gradTex(stops, w, h, radial){
  const [c, g] = makeCanvas(w, h);
  const gr = radial ? g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2) : g.createLinearGradient(0, h, 0, 0);
  stops.forEach(st => gr.addColorStop(st[0], st[1])); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  return texFrom(c);
}
function glyphTex(ch, sq){
  const [c, g] = makeCanvas(64, 64); g.fillStyle = '#fff';
  if (sq) g.fillRect(22, 22, 20, 14);
  else { g.font = '800 52px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 34); }
  return texFrom(c);
}
const AIR = [], BEAMS = [];
function buildAtmosphere(){
  const beamTex = gradTex([[0, 'rgba(255,255,255,0)'], [.55, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,.9)']], 4, 256);
  const poolTex = gradTex([[0, 'rgba(255,255,255,.9)'], [.45, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']], 256, 256, true);
  const TINT = { eng: 0x9DFFC0, cre: 0xFFE2C2, both: 0xFFFFFF };
  PIECE.forEach((g, i) => {
    const p = new THREE.Vector3(); g.getWorldPosition(p); const tint = lin(TINT[ROOMS[i].side]);
    const h = RH - .4, beam = new THREE.Mesh(new THREE.ConeGeometry(2.5, h, 48, 1, true),
      new THREE.MeshBasicMaterial({ map: beamTex, color: tint, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(p.x, h / 2, p.z); world.add(beam); BEAMS.push(beam);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.MeshBasicMaterial({ map: poolTex, color: tint, transparent: true, opacity: .38, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(p.x, .012, p.z); world.add(pool);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, .22, 12), fm('ink').clone()); lamp.position.set(p.x, RH - .11, p.z); world.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.2, 16), flat(0xFFFFFF)); lens.rotation.x = Math.PI / 2; lens.position.set(p.x, RH - .23, p.z); world.add(lens);
    ceilMats.push(lamp.material);
  });
  /* the air: 1s and 0s rising through the engineer rooms, paper flecks settling in the creator rooms */
  const per = LOW ? 34 : 70;
  [['eng', '1', 1], ['eng', '0', 1], ['cre', '', -1]].forEach(spec => {
    const rooms = ROOMS.filter(r => r.side === spec[0]), n = rooms.length * per, pos = new Float32Array(n * 3), spd = new Float32Array(n);
    rooms.forEach((rm, r) => { for (let k = 0; k < per; k++){ const j = (r * per + k) * 3;
      pos[j] = rm.cx + (Math.random() - .5) * (CELL - 1.2); pos[j + 1] = .3 + Math.random() * (RH - 1); pos[j + 2] = rm.cz + (Math.random() - .5) * (CELL - 1.2);
      spd[r * per + k] = .15 + Math.random() * .35; } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glyphTex(spec[1], !spec[1]), color: lin(spec[0] === 'eng' ? FAM.green : C.paper),
      size: spec[1] ? .2 : .12, transparent: true, opacity: spec[1] ? .55 : .7, depthWrite: false, blending: spec[1] ? THREE.AdditiveBlending : THREE.NormalBlending }));
    world.add(pts); AIR.push({ pts, pos, spd, dir: spec[2] });
  });
  anim.push((t, dt) => {
    if (REDUCED) return;
    AIR.forEach(a => {
      for (let k = 0; k < a.spd.length; k++){
        const j = k * 3; a.pos[j + 1] += a.dir * a.spd[k] * dt;
        if (a.dir < 0) a.pos[j] += Math.sin(t * .8 + k) * .002;
        if (a.pos[j + 1] > RH - .6) a.pos[j + 1] = .3; else if (a.pos[j + 1] < .25) a.pos[j + 1] = RH - .8;
      }
      a.pts.geometry.attributes.position.needsUpdate = true;
    });
  });
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xCFCBC4, .5));
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
const flatBox = $('#flat');
/* each panel opens on half of the name, then one project per frame */
[['laneL', 'Aayush', 'game_developer && ai_engineer'], ['laneR', 'Kumar', '3D animator · Jaipur, India']].forEach(d => {
  const el = $('#' + d[0]), strip = $('.strip', el);
  const intro = document.createElement('div'); intro.className = 'lc lc-intro'; intro.setAttribute('aria-hidden', 'true');
  intro.innerHTML = '<div class="intro-name">' + d[1] + '</div><div class="intro-line"><span>' + d[2] + '</span><span>Scroll ↓</span></div>';
  strip.prepend(intro);
  const cnt = document.createElement('span'); cnt.className = 'lane-count'; cnt.textContent = '00 / 07';
  $('.lane-h', el).appendChild(cnt);
});
const lanes = laneEls.map((el, k) => {
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide }));
  return { el, o: null, hole, strip: $('.strip', el), head: $('.lane-h', el), count: $('.lane-count', el), side: k === 0 ? -1 : 1, headH: 0, cards: [], n: 1, ch: 0, idx: -1 };
});
/* In the opening the lanes are flat, ordinary HTML over the canvas: text is drawn once and only
   slides. When the merge starts they hand over to CSS3D at exactly the same place, so the switch
   can't be seen. A fresh CSS3DObject each time keeps the renderer's style cache honest. */
let isFlat = null;
function setFlat(on){
  if (on === isFlat) return; isFlat = on;
  lanes.forEach(L => {
    if (on){
      if (L.o){ L.o.remove(L.hole); scene.remove(L.o); L.o = null; }
      L.el.style.transform = ''; L.el.style.display = '';
      flatBox.appendChild(L.el); placeFlat(L);
    } else {
      L.el.style.left = L.el.style.top = '';
      L.cards.forEach(c => { c.el.style.transform = ''; c.el.style.opacity = ''; c.d = null; });
      L.o = new THREE.CSS3DObject(L.el); L.o.add(L.hole); scene.add(L.o);
    }
  });
  body.classList.toggle('flat', on);
}
function laneTop(L){ return STACK ? (L.side < 0 ? TOPBAR : TOPBAR + laneH + INSET) : INSET; }
function placeFlat(L){
  L.el.style.position = 'absolute'; L.el.style.top = laneTop(L) + 'px';
  L.el.style.left = (STACK || L.side < 0 ? INSET : VW / 2 + seamPx / 2) + 'px';
}
/* a rounded rectangle, in the lane's own pixels, for the hole the canvas cuts */
function roundRectGeo(w, h, r){
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 8);
}
const Y0 = 3.3, ZL = .6, DIST = 7;
/* the pale ground behind the two panels lives in the scene, just behind them, and fades as the doors open */
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ color: lin(0xE4E1DA), transparent: true, depthWrite: false }));
backdrop.position.set(0, Y0, ZL - .03); scene.add(backdrop);
let VW = innerWidth, VH = innerHeight, seamPx = 0, laneW = 0, laneH = 0, INSET = 13, RAD = 34, TOPBAR = 0, STACK = false, sScreen = 1, sWall = 1;
let pTarget = 0, pNow = 0, lastHere = -2, lastPhase = '';
function layout(){
  VW = innerWidth; VH = innerHeight;
  /* the seam is the small part of a golden cut of the screen's middle */
  /* two rounded panels with a narrow seam between them: 89 px, a Fibonacci step */
  /* on a phone the halves stack: Engineer above, Creator below, each the full width */
  STACK = VW < 760;
  body.classList.toggle('stack', STACK);
  INSET = STACK ? 8 : 13; RAD = STACK ? 21 : 34; TOPBAR = STACK ? 58 : 0;
  seamPx = STACK ? 0 : 89;
  if (STACK){ laneW = VW - 2 * INSET; laneH = Math.round((VH - TOPBAR - 2 * INSET) / 2); }
  else { laneW = Math.round((VW - seamPx) / 2 - INSET); laneH = VH - 2 * INSET; }
  document.documentElement.style.setProperty('--seam', seamPx + 'px');
  sScreen = 2 * DIST * Math.tan(FOV * Math.PI / 360) / VH;
  sWall = STACK ? Math.min(7.4 / laneH, 20 / laneW) : Math.min(6.2 / laneH, 7.4 / laneW);
  lanes.forEach(L => {
    L.el.style.width = laneW + 'px'; L.el.style.height = laneH + 'px';
    L.el.classList.remove('wide');
    L.el.classList.toggle('thin', laneW < 300);
    L.hole.geometry.dispose(); L.hole.geometry = roundRectGeo(laneW, laneH, RAD);
    L.headH = L.head.offsetHeight;
    L.ch = laneH - L.headH;
    L.step = STACK ? laneW : L.ch;
    L.el.style.setProperty('--hh', L.headH + 'px');
    L.el.style.setProperty('--ch', L.ch + 'px');
    L.el.style.setProperty('--cw', laneW + 'px');
    L.strip.style.top = L.headH + 'px'; L.strip.style.paddingTop = '0px';
    L.cards = $$('.lc', L.el).map(el => ({ el, big: $('.po-big, .po-stack, .term-bits, .intro-name', el) || { style: {} }, pos: STACK ? el.offsetLeft : el.offsetTop, py: null, d: null }));
    L.n = L.cards.length;
    if (isFlat) placeFlat(L);
  });
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
  renderer.setSize(VW, VH, false); css.setSize(VW, VH);
  const keep = pTarget;
  $('#scroller').style.height = Math.round((TOTAL / 100 + 1) * VH) + 'px';
  scrollTo(0, keep / 100 * VH);
}
const _up = V3(0, 1, 0);
const HINGE_X = HALF - WT / 2 - .05;
const _ax = V3(1, 0, 0);
function placeLanes(t){
  /* t: 0 = flat across the screen, 1 = open against the hall's side walls */
  const a = ease(clamp(t, 0, 1));
  if (STACK){
    /* stacked: the top panel swings up to the ceiling, the bottom one down to the floor */
    lanes.forEach(L => {
      if (!L.o) return;
      const s = lerp(sScreen, sWall, a), top = L.side < 0;
      const yc = Y0 + (VH / 2 - (laneTop(L) + laneH / 2)) * sScreen;
      const hy0 = yc + (top ? 1 : -1) * laneH / 2 * sScreen;
      const hy = lerp(hy0, top ? RH - .12 : .03, a), hz = lerp(ZL, -.3, a);
      const th = (top ? 1 : -1) * a * Math.PI / 2, v = (top ? -1 : 1) * laneH / 2 * s;
      L.o.position.set(0, hy + v * Math.cos(th), hz + v * Math.sin(th));
      L.o.quaternion.setFromAxisAngle(_ax, th);
      L.o.scale.setScalar(s);
    });
    return;
  }
  lanes.forEach(L => {
    if (!L.o) return;
    const s = lerp(sScreen, sWall, a);
    /* the hinge starts on the panel's outer edge, exactly where the flat panel sat */
    const hx = lerp(L.side * (seamPx / 2 + laneW) * sScreen, L.side * HINGE_X, a);
    const hy = lerp(Y0, .4 + laneH * sWall / 2, a), hz = lerp(ZL, -.3, a);
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
  look.y = i === 8 ? 3.2 : 2.7;
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

const seamCard = $('#seamCard'), seamV = $('#seamV'), mergeCap = $('#mergeCap'), tkFill = $('#tkFill');
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
  skew += ((REDUCED ? 0 : clamp(vel * .006, -2.5, 2.5)) - skew) * k;

  /* Act I: the strips run in opposite directions and lean with the scroll */
  const t1 = clamp(p / ACT1, 0, 1);
  if (p < HALL_AT + STEP * .6) lanes.forEach((L, n) => {
    /* each frame holds, then glides to the next: a dwell on every project */
    const steps = Math.max(1, L.n - 1), u = t1 * steps, k0 = Math.min(steps - 1, Math.floor(u));
    const st = (k0 + ease(smooth(.3, .82, u - k0))) / steps;
    const travel = steps * L.step;
    const y = n === 0 ? -st * travel : -(1 - st) * travel;
    const idx = Math.round(st * steps);
    if (idx !== L.idx){ L.idx = idx; L.count.innerHTML = n === 0 ? '[<i class="roll">' + String(idx).padStart(2, '0') + '</i>/' + String(steps).padStart(2, '0') + ']'
      : '<i class="roll">' + String(idx).padStart(2, '0') + '</i> / ' + String(steps).padStart(2, '0'); }
    L.strip.style.transform = STACK ? 'translate3d(' + y.toFixed(1) + 'px,0,0)'
      : 'translate3d(0,' + y.toFixed(1) + 'px,0) skewY(' + ((n ? -1 : 1) * skew).toFixed(2) + 'deg)';
    if (REDUCED) return;
    /* the frame on show sits forward; the ones leaving and arriving recede, and their type drifts */
    L.cards.forEach(c => {
      const d = (c.pos + y) / L.step;
      if (Math.abs(d) > 1.6) return;
      const dq = Math.round(clamp(Math.abs(d), 0, 1) * 200) / 200;
      if (dq !== c.d){ c.d = dq; c.el.style.transform = 'scale(' + (1 - dq * .08).toFixed(3) + ')'; c.el.style.opacity = (1 - dq * .55).toFixed(3); }
      const py = clamp(d, -1, 1) * -14;
      if (c.py === null || Math.abs(py - c.py) > .05){ c.py = py; c.big.style.transform = STACK ? 'translate3d(' + py.toFixed(2) + '%,0,0)' : 'translate3d(0,' + py.toFixed(2) + '%,0)'; }
    });
  });
  const so = VW < 760 ? 1 - smooth(10, 45, p) : 1 - smooth(ACT1 * .1, ACT1 * .2, p);
  seamCard.style.opacity = 0; seamCard.style.visibility = 'hidden';
  const sv = 1 - smooth(ACT1 - 20, ACT1 + 15, p);
  seamV.style.opacity = sv.toFixed(3); seamV.style.visibility = sv < .02 ? 'hidden' : 'visible';
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
  setFlat(p <= ACT1);
  placeLanes(smooth(0, .36, tm));
  const bo = 1 - smooth(ACT1 - 25, ACT1 - 2, p);
  backdrop.material.opacity = bo; backdrop.visible = bo > .002;
  lanes.forEach(L => { if (L.o) L.o.visible = p < HALL_AT + STEP * .6 && !(STACK && L.side < 0 && tm > .42); });
  if (p < HALL_AT){
    const up = ease(smooth(.3, .58, tm)), down = ease(smooth(.7, 1, tm));
    tmpPos.lerpVectors(DOOR.pos, REVEAL.pos, up).lerp(HALLP.pos, down);
    tmpLook.lerpVectors(DOOR.look, REVEAL.look, up).lerp(HALLP.look, down);
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
    /* each room's word rises into place as you come through its door */
    WORDS.forEach((w, j) => {
      if (!w) return;
      const ar = REDUCED ? 1 : ease(clamp(1.35 - Math.abs(kk - (j + 1)) * 1.6, 0, 1));
      if (Math.abs(ar - w.a) < .002) return; w.a = ar;
      w.pl.position.y = w.y - (1 - ar) * 1.4; w.pl.material.opacity = ar;
    });
  }

  /* the ceiling fades as the camera rises over the walls */
  const co = 1 - smooth(RH - .8, RH + 4, camera.position.y);
  const inside = camera.position.y < RH - .3; BEAMS.forEach(b => { b.visible = inside; });
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
  $('#objN').textContent = i < 0 ? '00' : String(i + 1).padStart(2, '0');
  $('#objT').textContent = s.title;
  $('#objP').textContent = s.blurb;
  $('#objChips').innerHTML = s.chips.map(c => '<span>' + esc(c) + '</span>').join('');
  const act = $('#objAct'); act.innerHTML = '';
  const btn = (labelTxt, cls, attrs) => { const b = document.createElement(attrs && attrs.href ? 'a' : 'button'); b.className = 'btn btn-sm ' + (cls || ''); b.innerHTML = labelTxt;
    if (b.tagName === 'BUTTON') b.type = 'button'; Object.keys(attrs || {}).forEach(k => b.setAttribute(k, attrs[k])); act.appendChild(b); return b; };
  if (i < 0){ btn('Walk in ↓', 'btn-solid', { 'data-next': '' }); return; }
  if (s.id === 'arcade'){ Object.keys(GAMES).forEach((k, n) => btn('▶ ' + GAMES[k].name, n ? '' : 'btn-solid', { 'data-play': k })); return; }
  if (first0(s)) btn(esc(first0(s).textContent.replace(/^Open /, '')), '', { href: first0(s).href, target: '_blank', rel: 'noopener' });
  if (s.id === 'contact') btn('Copy email', '', { 'data-copy': 'aayushkumarofficial21@gmail.com' });
  btn('Read more', 'btn-solid', { 'data-inspect': s.id });
}
const first0 = s => s.id === 'contact' ? null : $('.st-go a', s.el);
function replayObj(){
  $$('.obj-chips span, .obj-act > *', obj).forEach((el, n) => el.style.setProperty('--i', n + 1));
  obj.classList.remove('enter'); void obj.offsetWidth; obj.classList.add('enter');
}
obj.addEventListener('click', e => { if (e.target.closest('[data-next]')) travel(posOf(0)); });
const railN = $('#railN'), railT = $('#railT');
function setRail(n, t){
  if (railN.textContent === n && railT.textContent === t) return;
  railN.textContent = n; railT.textContent = t;
  railN.classList.remove('roll'); void railN.offsetWidth; railN.classList.add('roll');
}
function arrive(here){
  $('#where').textContent = where();
  if (here >= 0) setRail(String(here + 1).padStart(2, '0'), STATIONS[here].title);
  else if (here === -1) setRail('00', 'The hall');
  else if (here === -2) setRail('00', pNow < ACT1 ? 'Two halves' : 'Nine rooms');
  if (here === -2 || here === -3){ obj.classList.remove('show'); markHere(-9); return; }
  const s = here < 0 ? HALL : STATIONS[here];
  fillObj(s, here);
  const right = here >= 0 && POSES[here + 1].u < 0;
  obj.classList.toggle('right', right); obj.classList.toggle('left', !right);
  obj.classList.add('show'); replayObj();
  markHere(here);
  if (here >= 0){
    pop = { i: here, t0: clockT };
    if (s.id === 'hexabed' && hexRegen) hexRegen(clockT);
    if (!found.has(s.id)) discover(here);
  }
}
function discover(i){
  const s = STATIONS[i];
  found.add(s.id); store.set('aak-found', Array.from(found).join(','));
  renderPips();
}
function renderPips(){
  $$('#ticks button[data-i]').forEach(b => b.classList.toggle('found', found.has(STATIONS[+b.dataset.i].id)));
}
function markHere(i){ $$('#ticks button[data-i]').forEach(b => b.classList.toggle('here', +b.dataset.i === i)); }

function buildTrack(){
  const box = $('#ticks');
  STATIONS.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
    b.style.left = (100 * posOf(i) / TOTAL - (i === N - 1 ? 1.2 : 0)) + '%';
    b.setAttribute('aria-label', 'Go to ' + s.title); b.dataset.t = s.title;
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
$('.player').addEventListener('click', e => { e.preventDefault(); travel(0); });

function openMenu(){
  const l = $('#menuL'); l.innerHTML = '';
  [{ title: 'The two halves', side: 'both', p: 0 }, { title: 'The hall', side: 'both', p: HALL_AT }].concat(STATIONS.map(s => ({ title: s.title, side: s.side, p: posOf(s.i), id: s.id }))).forEach((s, k) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.innerHTML = '<span class="n">' + String(k).padStart(2, '0') + '</span><span class="t">' + esc(s.title) + (s.id && found.has(s.id) ? '<span class="f">found</span>' : '') + '</span><span class="s ' + s.side + '">' + (s.side === 'both' ? 'Shared' : s.side === 'eng' ? 'Engineer' : 'Creator') + '</span>';
    b.addEventListener('click', () => travel(s.p));
    b.classList.add('side-' + s.side); li.style.setProperty('--i', k);
    if (s.id && hereOf(pTarget) === STATIONS.findIndex(x => x.id === s.id)) b.classList.add('here');
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
let clockT = 0, lastNow = performance.now(), pop = null;
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
  if (pop && PIECE[pop.i]){
    const age = clockT - pop.t0, sc = REDUCED ? 1 : 1 - .07 * Math.exp(-age * 5) * Math.cos(age * 11);
    PIECE[pop.i].scale.setScalar(sc); if (age > 2){ PIECE[pop.i].scale.setScalar(1); pop = null; }
  }
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
  buildHits(); buildAtmosphere(); buildTrack();
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
