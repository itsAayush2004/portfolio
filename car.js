/* ══════════════════════════════════════════════════════════
   CAR — a toy car laps every room, trailing exhaust smoke.

   Self-contained and additive: it patches WebGLRenderer.render
   so it can reach the gallery's scene without touching the main
   script, then drives itself off the same frame clock. If the
   assets fail to load, nothing happens and the gallery is
   exactly as it was.

   assets/car.bin  — quantised geometry (see parse() for layout)
   assets/car.jpg  — base colour map
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof THREE === 'undefined' || !THREE.WebGLRenderer) return;

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE  = innerWidth < 860;

  /* room grid — mirrors CELL/ROOM in the main script */
  var ROOM = 20;
  var CELL = [[0,0],[0,-1],[-1,-1],[-1,-2],[0,-2],[0,-3],[-1,-3],[-1,-4],[0,-4]];

  var SCALE   = 1.4;                 // model is 1.0 tall as authored
  var LAP     = 6.6;                 // lap radius inside the 20×20 room
  var SPEED   = REDUCED ? 0 : 0.30;  // rad/s
  var PUFFS   = (MOBILE || REDUCED) ? 0 : 8;
  var EMIT    = 0.085;               // seconds between puffs
  var LIFE    = 1.5;                 // puff lifetime, seconds

  var scene = null, cars = [], last = 0, started = false;

  /* ---------- frame hook ----------
     three r128 hangs render() off the instance, not the prototype, so the
     renderer has to be wrapped as it is constructed */
  function hook(sc) {
    if (!started && sc && sc.isScene) { started = true; scene = sc; load(); }
    if (cars.length) step();
  }

  var Renderer = THREE.WebGLRenderer;
  function Wrapped(params) {
    var r = new Renderer(params);
    var draw = r.render;
    if (typeof draw === 'function') {
      r.render = function (sc, cam) { hook(sc); return draw.call(this, sc, cam); };
    }
    return r;
  }
  Wrapped.prototype = Renderer.prototype;
  THREE.WebGLRenderer = Wrapped;

  /* ---------- geometry blob ---------- */
  /* CARM | u32 vertCount | u32 indexCount | f32 min[3] | f32 size[3]
     u16 pos[v*3] · i8 nrm[v*3] · u16 uv[v*2] · u16 idx[i]   (4-byte aligned) */
  function parse(buf) {
    var dv = new DataView(buf);
    if (dv.getUint8(0) !== 67 || dv.getUint8(1) !== 65 ||
        dv.getUint8(2) !== 82 || dv.getUint8(3) !== 77) return null;

    var vc = dv.getUint32(4, true), ic = dv.getUint32(8, true);
    var mn = [dv.getFloat32(12, true), dv.getFloat32(16, true), dv.getFloat32(20, true)];
    var sz = [dv.getFloat32(24, true), dv.getFloat32(28, true), dv.getFloat32(32, true)];
    var pad = function (n) { return (n + 3) & ~3; };

    var o  = 36;
    var pq = new Uint16Array(buf, o, vc * 3); o = pad(o + vc * 6);
    var nq = new Int8Array  (buf, o, vc * 3); o = pad(o + vc * 3);
    var uq = new Uint16Array(buf, o, vc * 2); o = pad(o + vc * 4);
    var iq = new Uint16Array(buf, o, ic);

    var pos = new Float32Array(vc * 3), nrm = new Float32Array(vc * 3),
        uv  = new Float32Array(vc * 2);
    for (var i = 0; i < vc; i++) {
      for (var c = 0; c < 3; c++) {
        pos[i * 3 + c] = mn[c] + (pq[i * 3 + c] / 65535) * sz[c];
        nrm[i * 3 + c] = nq[i * 3 + c] / 127;
      }
      uv[i * 2]     = uq[i * 2]     / 65535;
      uv[i * 2 + 1] = uq[i * 2 + 1] / 65535;
    }

    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal',   new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(iq), 1));
    return g;
  }

  /* ---------- soft puff sprite ---------- */
  function puffTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0,   'rgba(255,255,255,.95)');
    r.addColorStop(.45, 'rgba(255,255,255,.42)');
    r.addColorStop(1,   'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- load ---------- */
  function load() {
    var geo = null, map = null, want = 2;
    var done = function () { if (--want === 0 && geo) build(geo, map); };

    fetch('assets/car.bin')
      .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (b) { if (b) geo = parse(b); done(); })
      .catch(done);

    map = new THREE.TextureLoader().load('assets/car.jpg', done, undefined, done);
    if (map && 'sRGBEncoding' in THREE) map.encoding = THREE.sRGBEncoding;
    map.flipY = false;   // glTF-style UVs
  }

  /* ---------- build ---------- */
  function build(geo, map) {
    var mat = THREE.MeshToonMaterial
      ? new THREE.MeshToonMaterial({ map: map })
      : new THREE.MeshLambertMaterial({ map: map });

    var ptex = PUFFS ? puffTexture() : null;

    for (var i = 0; i < CELL.length; i++) {
      var cx = CELL[i][0] * ROOM, cz = CELL[i][1] * ROOM;

      var g = new THREE.Group();
      var mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(SCALE);
      g.add(mesh);
      scene.add(g);

      var puffs = [];
      for (var k = 0; k < PUFFS; k++) {
        var s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: ptex, color: 0xd7d4cc, transparent: true,
          opacity: 0, depthWrite: false, fog: false
        }));
        s.visible = false;
        scene.add(s);
        puffs.push({ s: s, t: 0, vx: 0, vy: 0, vz: 0 });
      }

      cars.push({
        g: g, cx: cx, cz: cz,
        a: (i * 2.4) % (Math.PI * 2),          // stagger the grid
        w: SPEED * (0.82 + (i % 4) * 0.11),    // each room at its own pace
        r: LAP - (i % 3) * 0.35,
        puffs: puffs, next: 0, n: 0
      });
    }
  }

  /* ---------- per frame ---------- */
  var UP  = new THREE.Vector3(0, 1, 0);
  var FWD = new THREE.Vector3(), RGT = new THREE.Vector3();
  var M   = new THREE.Matrix4();

  function step() {
    var now = performance.now() / 1000;
    var dt  = last ? Math.min(0.05, now - last) : 0.016;
    last = now;

    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      c.a += c.w * dt;

      var sa = Math.sin(c.a), ca = Math.cos(c.a);
      c.g.position.set(c.cx + sa * c.r, 0, c.cz + ca * c.r);

      /* heading = tangent of the lap; model is authored facing +Z */
      FWD.set(ca, 0, -sa);
      RGT.crossVectors(UP, FWD);
      M.makeBasis(RGT, UP, FWD);
      c.g.quaternion.setFromRotationMatrix(M);

      if (!c.puffs.length) continue;

      /* emit from the tailpipe */
      c.next -= dt;
      if (c.next <= 0) {
        c.next = EMIT;
        var p = c.puffs[c.n % c.puffs.length]; c.n++;
        p.t = LIFE;
        p.s.visible = true;
        p.s.position.set(
          c.g.position.x - FWD.x * 0.62 * SCALE,
          0.24 * SCALE,
          c.g.position.z - FWD.z * 0.62 * SCALE
        );
        p.vx = -FWD.x * 0.55 + (Math.random() - 0.5) * 0.22;
        p.vz = -FWD.z * 0.55 + (Math.random() - 0.5) * 0.22;
        p.vy = 0.34 + Math.random() * 0.2;
      }

      for (var k = 0; k < c.puffs.length; k++) {
        var q = c.puffs[k];
        if (q.t <= 0) continue;
        q.t -= dt;
        if (q.t <= 0) { q.s.visible = false; q.s.material.opacity = 0; continue; }

        q.s.position.x += q.vx * dt;
        q.s.position.y += q.vy * dt;
        q.s.position.z += q.vz * dt;
        q.vx *= 0.965; q.vz *= 0.965; q.vy *= 0.985;

        var u = 1 - q.t / LIFE;                    // 0 → 1 over its life
        var sc = (0.34 + u * 1.15) * SCALE;
        q.s.scale.set(sc, sc, 1);
        q.s.material.opacity = 0.46 * (1 - u) * Math.min(1, u * 6);
      }
    }
  }
})();
