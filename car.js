/* ══════════════════════════════════════════════════════════
   CAR — a toy car laps every room, kicking up a trail of
   chunky pixel dust off its back tyres, with a CLICK ME sign
   riding above it that opens one of the two live products.

   Self-contained and additive: it wraps the renderer as it is
   constructed so it can reach the gallery's scene without
   touching the main script, then drives itself off the same
   frame clock. If the assets fail to load, nothing happens and
   the gallery is exactly as it was.

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

  var SCALE = 2.0;                 // model is 1.0 tall as authored
  var LAP   = 6.6;                 // lap radius inside the 20×20 room
  var SPEED = REDUCED ? 0 : 0.30;  // rad/s
  var GRIT  = (MOBILE || REDUCED) ? 0 : 14;   // dust blocks per car
  var EMIT  = 0.05;                // seconds between blocks
  var LIFE  = 1.15;                // block lifetime, seconds
  var DUST  = 0xa8996f;            // dust colour

  /* the two live products, handed out alternately down the house */
  var LINKS = [
    { url: 'https://arthis.space', label: 'arthis.space' },
    { url: 'https://arthis.land',  label: 'arthis.land'  }
  ];

  var scene = null, camera = null, cars = [], panels = [];
  var last = 0, started = false, wired = false;

  /* ---------- finding the scene and camera ----------
     both are shut inside the gallery's closure, so borrow them from the one
     call three makes on each of them every frame:
       renderer.render() → scene.updateMatrixWorld() and camera.updateMatrixWorld()
     The hook takes itself back out as soon as it has both. */
  var origUpdate = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Object3D.prototype.updateMatrixWorld = function (force) {
    if (!scene && this.isScene) {
      scene = this;
      if (!started) { started = true; load(); }
    } else if (!camera && this.isCamera) {
      camera = this;
    }
    if (scene && camera) THREE.Object3D.prototype.updateMatrixWorld = origUpdate;
    return origUpdate.call(this, force);
  };

  (function frame() {
    requestAnimationFrame(frame);
    if (cars.length) step();
  })();

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

  /* ---------- 8-bit dust blocks ----------
     three little 8×8 bitmaps, drawn at NearestFilter so every
     dust mote stays a hard-edged cluster of squares */
  var BLOBS = [
    ['00111000',
     '01111100',
     '11111110',
     '11111111',
     '11111110',
     '01111100',
     '00111000',
     '00010000'],
    ['00011000',
     '00111100',
     '01111110',
     '11111100',
     '01111110',
     '00111100',
     '00011000',
     '00000000'],
    ['00110000',
     '01111000',
     '11111100',
     '11111110',
     '01111100',
     '00111100',
     '00011000',
     '00000000']
  ];

  function blockTexture(rows) {
    var c = document.createElement('canvas'); c.width = c.height = 8;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    for (var y = 0; y < 8; y++)
      for (var x = 0; x < 8; x++)
        if (rows[y].charAt(x) === '1') g.fillRect(x, y, 1, 1);
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    return t;
  }

  /* ---------- the CLICK ME sign ---------- */
  function signTexture(label) {
    var W = 384, H = 132, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var PX = '"Pixelify Sans", monospace';

    g.fillStyle = '#14140f'; g.fillRect(0, 0, W, H);              // hard ink border
    g.fillStyle = '#f2f1ee'; g.fillRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#c0472c'; g.fillRect(6, 6, 10, H - 12);        // accent rail

    g.textAlign = 'center';
    g.fillStyle = '#14140f';
    g.font = '600 46px ' + PX;
    g.fillText('CLICK ME', W / 2 + 6, 58);
    g.fillStyle = '#c0472c';
    g.font = '400 30px ' + PX;
    g.fillText(label, W / 2 + 6, 102);

    var t = new THREE.CanvasTexture(c);
    t.anisotropy = MOBILE ? 2 : 8;
    if ('sRGBEncoding' in THREE) t.encoding = THREE.sRGBEncoding;
    return t;
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
    if ('sRGBEncoding' in THREE) map.encoding = THREE.sRGBEncoding;
    map.flipY = false;   // glTF-style UVs
  }

  /* ---------- build ---------- */
  function build(geo, map) {
    var mat = THREE.MeshToonMaterial
      ? new THREE.MeshToonMaterial({ map: map })
      : new THREE.MeshLambertMaterial({ map: map });

    var grit = GRIT ? BLOBS.map(blockTexture) : null;
    var signs = LINKS.map(function (l) { return signTexture(l.label); });

    for (var i = 0; i < CELL.length; i++) {
      var cx = CELL[i][0] * ROOM, cz = CELL[i][1] * ROOM;

      var g = new THREE.Group();
      var mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(SCALE);
      g.add(mesh);
      scene.add(g);

      /* the sign rides above the roof, always facing you */
      var link = LINKS[i % LINKS.length];
      var sign = new THREE.Sprite(new THREE.SpriteMaterial({
        map: signs[i % LINKS.length], transparent: true, depthWrite: false, fog: false
      }));
      sign.scale.set(SCALE * 1.55, SCALE * 0.53, 1);
      sign.userData.url = link.url;
      scene.add(sign);
      panels.push(sign);

      var dust = [];
      for (var k = 0; k < GRIT; k++) {
        var s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: grit[k % grit.length], color: DUST, transparent: true,
          opacity: 0, depthWrite: false, fog: false
        }));
        s.visible = false;
        scene.add(s);
        dust.push({ s: s, t: 0, vx: 0, vy: 0, vz: 0 });
      }

      cars.push({
        g: g, sign: sign, cx: cx, cz: cz,
        a: (i * 2.4) % (Math.PI * 2),          // stagger the grid
        w: SPEED * (0.82 + (i % 4) * 0.11),    // each room at its own pace
        r: LAP - (i % 3) * 0.35,
        dust: dust, next: 0, n: 0, side: 1
      });
    }

    wireClicks();
  }

  /* ---------- clicking the sign ---------- */
  function wireClicks() {
    if (wired) return;
    var canvas = document.getElementById('scene') || document.querySelector('canvas');
    if (!canvas) return;
    wired = true;

    var ray = new THREE.Raycaster(), pt = new THREE.Vector2();
    var armed = null, downX = 0, downY = 0;

    function pick(e) {
      if (!camera) return null;
      var r = canvas.getBoundingClientRect();
      pt.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
      pt.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
      ray.setFromCamera(pt, camera);
      var hits = ray.intersectObjects(panels, false);
      return hits.length ? hits[0].object : null;
    }

    addEventListener('pointermove', function (e) {
      if (armed) return;
      canvas.style.cursor = pick(e) ? 'pointer' : '';
    }, { passive: true });

    canvas.addEventListener('pointerdown', function (e) {
      var hit = pick(e);
      if (!hit) return;
      armed = hit; downX = e.clientX; downY = e.clientY;
      e.stopPropagation();
    }, true);

    canvas.addEventListener('pointerup', function (e) {
      if (!armed) return;
      var moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
      var url = armed.userData.url;
      armed = null;
      if (moved < 8) { e.stopPropagation(); open(url, '_blank', 'noopener'); }
    }, true);
  }

  /* ---------- per frame ---------- */
  var UP  = new THREE.Vector3(0, 1, 0);
  var FWD = new THREE.Vector3(), RGT = new THREE.Vector3();
  var M   = new THREE.Matrix4();

  var STEP_SCALE   = [0.20, 0.30, 0.42, 0.56];   // stepped, not smooth — keeps it 8-bit
  var STEP_OPACITY = [0.80, 0.62, 0.40, 0.17];

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

      /* sign floats over the roof with a slow bob */
      c.sign.position.set(
        c.g.position.x,
        SCALE * (1.34 + Math.sin(now * 1.6 + i) * 0.045),
        c.g.position.z
      );

      if (!c.dust.length) continue;

      /* kick a block out from under whichever back tyre is next */
      c.next -= dt;
      if (c.next <= 0) {
        c.next = EMIT;
        c.side = -c.side;
        var p = c.dust[c.n % c.dust.length]; c.n++;
        p.t = LIFE;
        p.s.visible = true;
        p.s.position.set(
          c.g.position.x - FWD.x * 0.34 * SCALE + RGT.x * 0.19 * SCALE * c.side,
          0.07 * SCALE,
          c.g.position.z - FWD.z * 0.34 * SCALE + RGT.z * 0.19 * SCALE * c.side
        );
        p.vx = -FWD.x * 0.75 + RGT.x * 0.25 * c.side + (Math.random() - 0.5) * 0.2;
        p.vz = -FWD.z * 0.75 + RGT.z * 0.25 * c.side + (Math.random() - 0.5) * 0.2;
        p.vy = 0.42 + Math.random() * 0.28;
      }

      for (var k = 0; k < c.dust.length; k++) {
        var q = c.dust[k];
        if (q.t <= 0) continue;
        q.t -= dt;
        if (q.t <= 0) { q.s.visible = false; q.s.material.opacity = 0; continue; }

        q.s.position.x += q.vx * dt;
        q.s.position.y += q.vy * dt;
        q.s.position.z += q.vz * dt;
        q.vx *= 0.94; q.vz *= 0.94;
        q.vy = q.vy * 0.94 - 0.55 * dt;               // settles back down
        if (q.s.position.y < 0.03) q.s.position.y = 0.03;

        var stage = Math.min(3, Math.floor((1 - q.t / LIFE) * 4));
        var sc = STEP_SCALE[stage] * SCALE;
        q.s.scale.set(sc, sc, 1);
        q.s.material.opacity = STEP_OPACITY[stage];
      }
    }
  }
})();
