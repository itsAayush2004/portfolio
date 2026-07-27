/* ══════════════════════════════════════════════════════════
   DECOR — dresses the nine rooms.

   Everything here is painted at runtime into small canvases and
   sampled at NearestFilter, so the house reads as pixel art
   rather than flat colour: patterned wallpaper, oak floorboards,
   coffered ceilings, walnut skirting and crown moulding, a
   museum plaque on the wall of every room, and a plant in the
   corners that are free.

   It is purely additive. It finds the gallery's scene the same
   way car.js does, re-skins what is already there by cloning
   materials (never mutating shared ones), and adds a handful of
   props only where a collision test says there is room. If
   anything is missing it quietly does nothing.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;

  var MOBILE = innerWidth < 860;

  var ROOM = 20, H = 7.4;
  var CELL = [[0,0],[0,-1],[-1,-1],[-1,-2],[0,-2],[0,-3],[-1,-3],[-1,-4],[0,-4]];
  var CENTRES = CELL.map(function (c) { return { x: c[0] * ROOM, z: c[1] * ROOM }; });

  var INK    = '#14140f';
  var PAPER  = '#f2f1ee';
  var ACCENT = '#c0472c';
  var PX     = '"Pixelify Sans", monospace';

  var scene = null, camera = null, done = false, RAMP = null;

  /* new props are shaded the same way the house already is */
  function toonMat(opts) {
    if (THREE.MeshToonMaterial) {
      if (RAMP) opts.gradientMap = RAMP;
      return new THREE.MeshToonMaterial(opts);
    }
    return new THREE.MeshLambertMaterial(opts);
  }

  /* ---------- find the scene ---------- */
  var origUpdate = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Object3D.prototype.updateMatrixWorld = function (force) {
    if (!scene && this.isScene) {
      scene = this;
      if (!done) { done = true; setTimeout(dress, 0); }
    } else if (!camera && this.isCamera) {
      camera = this;
    }
    if (scene && camera) THREE.Object3D.prototype.updateMatrixWorld = origUpdate;
    return origUpdate.call(this, force);
  };

  /* ══════════════ pixel painting helpers ══════════════ */

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }

  function pixelTexture(c, rx, ry) {
    var t = new THREE.CanvasTexture(c);
    var mip = THREE.NearestMipmapLinearFilter || THREE.NearestMipMapLinearFilter;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = (MOBILE || !mip) ? THREE.NearestFilter : mip;
    t.generateMipmaps = !MOBILE && !!mip;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = MOBILE ? 2 : 8;
    if ('sRGBEncoding' in THREE) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* nudge a hex colour by a signed amount, clamped */
  function shade(hex, d) {
    var r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + d));
    var g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + d));
    var b = Math.max(0, Math.min(255, (hex & 255) + d));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------- wallpaper: fine stripe with a small repeating motif ---------- */
  var wallCache = {};
  function wallpaper(hex) {
    if (wallCache[hex]) return wallCache[hex];
    var S = 32, c = canvas(S), g = c.getContext('2d');

    g.fillStyle = shade(hex, 0); g.fillRect(0, 0, S, S);

    // vertical ticking stripes
    g.fillStyle = shade(hex, -9);
    for (var x = 0; x < S; x += 8) g.fillRect(x, 0, 1, S);
    g.fillStyle = shade(hex, 5);
    for (x = 3; x < S; x += 8) g.fillRect(x, 0, 2, S);

    // a four-pixel diamond, dropped on the half-step
    function diamond(cx, cy, col) {
      g.fillStyle = col;
      g.fillRect(cx, cy - 2, 1, 1); g.fillRect(cx, cy + 2, 1, 1);
      g.fillRect(cx - 2, cy, 1, 1); g.fillRect(cx + 2, cy, 1, 1);
      g.fillRect(cx - 1, cy - 1, 3, 3);
    }
    diamond(8, 8, shade(hex, -26));
    diamond(24, 24, shade(hex, -26));
    diamond(8, 8 + 16, shade(hex, -14));
    diamond(24, 24 - 16, shade(hex, -14));

    var t = pixelTexture(c, 8, 3);
    wallCache[hex] = t;
    return t;
  }

  /* ---------- floor: oak boards with offset seams and grain ---------- */
  var floorCache = {};
  function floorboards(hex) {
    if (floorCache[hex]) return floorCache[hex];
    var S = 64, c = canvas(S), g = c.getContext('2d');

    g.fillStyle = shade(hex, -6); g.fillRect(0, 0, S, S);

    var rows = 4, hgt = S / rows;
    for (var r = 0; r < rows; r++) {
      var y = r * hgt;
      // board face, alternating tone
      g.fillStyle = shade(hex, r % 2 ? 4 : -2);
      g.fillRect(0, y, S, hgt - 1);
      // seam between boards
      g.fillStyle = shade(hex, -34);
      g.fillRect(0, y + hgt - 1, S, 1);
      // staggered end joints
      var joint = (r % 2 ? 20 : 44);
      g.fillRect(joint, y, 1, hgt - 1);
      // grain
      g.fillStyle = shade(hex, -16);
      for (var i = 0; i < 5; i++) {
        var gx = (r * 13 + i * 11) % S;
        g.fillRect(gx, y + 2 + (i % 3) * 3, 6, 1);
      }
      g.fillStyle = shade(hex, 12);
      g.fillRect((r * 7 + 5) % S, y + 5, 9, 1);
    }

    var t = pixelTexture(c, 8, 8);
    floorCache[hex] = t;
    return t;
  }

  /* ---------- ceiling: coffered tiles ---------- */
  var ceilCache = {};
  function coffer(hex) {
    if (ceilCache[hex]) return ceilCache[hex];
    var S = 32, c = canvas(S), g = c.getContext('2d');
    g.fillStyle = shade(hex, -12); g.fillRect(0, 0, S, S);
    g.fillStyle = shade(hex, 2);   g.fillRect(2, 2, S - 4, S - 4);
    g.fillStyle = shade(hex, -6);  g.fillRect(5, 5, S - 10, S - 10);
    g.fillStyle = shade(hex, 8);   g.fillRect(7, 7, S - 14, S - 14);
    // rivets in the corners
    g.fillStyle = shade(hex, -28);
    g.fillRect(4, 4, 1, 1); g.fillRect(S - 5, 4, 1, 1);
    g.fillRect(4, S - 5, 1, 1); g.fillRect(S - 5, S - 5, 1, 1);
    var t = pixelTexture(c, 10, 10);
    ceilCache[hex] = t;
    return t;
  }

  /* ---------- walnut, for skirting, rail and crown ---------- */
  var woodTex = null;
  function walnut() {
    if (woodTex) return woodTex;
    var W = 32, Hh = 8, c = canvas(W, Hh), g = c.getContext('2d');
    g.fillStyle = '#4a3a2a'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#5b4834'; g.fillRect(0, 1, W, 3);
    g.fillStyle = '#3a2c1f';
    for (var i = 0; i < 6; i++) g.fillRect((i * 7) % W, (i % 3) + 2, 5, 1);
    g.fillStyle = '#6b573f'; g.fillRect(0, 0, W, 1);
    g.fillStyle = '#2c2118'; g.fillRect(0, Hh - 1, W, 1);
    woodTex = pixelTexture(c, 10, 1);
    return woodTex;
  }

  /* ---------- terracotta, for the pots ---------- */
  var potTex = null;
  function terracotta() {
    if (potTex) return potTex;
    var W = 16, Hh = 16, c = canvas(W, Hh), g = c.getContext('2d');
    g.fillStyle = '#b5643f'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#c4744c'; g.fillRect(0, 0, W, 4);
    g.fillStyle = '#9c5133';
    for (var i = 0; i < W; i += 5) g.fillRect(i, 5, 1, Hh - 5);
    g.fillStyle = '#8a4529'; g.fillRect(0, Hh - 2, W, 2);
    potTex = pixelTexture(c, 1, 1);
    return potTex;
  }

  /* ══════════════ re-skin what is already there ══════════════ */

  function near(a, b) { return Math.abs(a - b) < 0.02; }

  function reskin() {
    var walls = [], skirts = [], rails = [];

    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      var g = o.geometry, p = g.parameters;
      if (!p) return;
      var m = o.material;
      if (!m || !m.color) return;

      if (g.type === 'PlaneGeometry' && near(p.width, ROOM) && near(p.height, ROOM)) {
        var floor = o.rotation.x < 0;
        var mat = m.clone();
        mat.map = floor ? floorboards(m.color.getHex()) : coffer(m.color.getHex());
        mat.color.setHex(0xffffff);        // the texture already carries the tint
        mat.needsUpdate = true;
        o.material = mat;
        if (!RAMP && mat.gradientMap) RAMP = mat.gradientMap;
        return;
      }

      if (p.height === undefined) return;
      var span = Math.max(p.width || 0, p.depth || 0);

      /* the black outline copies share the wall geometry — leave them alone */
      if (near(p.height, H) && span > 5 && m.color.getHex() !== 0x14140f) walls.push(o);
      else if (near(p.height, 0.18) && span > 15) skirts.push(o);
      else if (near(p.height, 0.07) && span > 15) rails.push(o);
    });

    walls.forEach(function (o) {
      var mat = o.material.clone();
      mat.map = wallpaper(o.material.color.getHex());
      mat.color.setHex(0xffffff);          // let the paper carry the colour
      mat.needsUpdate = true;
      o.material = mat;
      if (!RAMP && mat.gradientMap) RAMP = mat.gradientMap;
    });

    [skirts, rails].forEach(function (list) {
      list.forEach(function (o) {
        var mat = o.material.clone();
        mat.map = walnut();
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
        o.material = mat;
      });
    });

    return walls;
  }

  /* ══════════════ crown moulding ══════════════ */

  function crown(walls) {
    var mat = toonMat({ map: walnut() });
    walls.forEach(function (o) {
      var p = o.geometry.parameters;
      var alongZ = p.depth > p.width;           // wall runs along Z
      var w = alongZ ? 0.44 : p.width;
      var d = alongZ ? p.depth : 0.44;
      var bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.26, d), mat);
      bar.position.set(o.position.x, H - 0.15, o.position.z);
      scene.add(bar);
    });
  }

  /* ══════════════ museum plaques ══════════════ */

  function wrap(g, text, max) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (g.measureText(test).width > max && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function plaqueTexture(kicker, title, body) {
    var W = 768, Hh = 384, c = canvas(W, Hh), g = c.getContext('2d');

    g.fillStyle = INK;    g.fillRect(0, 0, W, Hh);
    g.fillStyle = PAPER;  g.fillRect(10, 10, W - 20, Hh - 20);
    g.fillStyle = ACCENT; g.fillRect(10, 10, 14, Hh - 20);

    // pixel corner ticks
    g.fillStyle = INK;
    [[26, 26], [W - 40, 26], [26, Hh - 40], [W - 40, Hh - 40]].forEach(function (p) {
      g.fillRect(p[0], p[1], 14, 3); g.fillRect(p[0], p[1], 3, 14);
    });

    var x = 52, y = 74;
    g.textAlign = 'left';

    g.fillStyle = ACCENT;
    g.font = '600 26px ' + PX;
    g.fillText(String(kicker).toUpperCase(), x, y);

    y += 22;
    g.fillStyle = INK;
    g.fillRect(x, y, 120, 3);

    y += 52;
    g.font = '600 46px ' + PX;
    wrap(g, title, W - x - 60).slice(0, 2).forEach(function (l) {
      g.fillText(l, x, y); y += 50;
    });

    y += 12;
    g.fillStyle = '#5b5850';
    g.font = '400 26px ' + PX;
    wrap(g, body, W - x - 60).slice(0, 4).forEach(function (l) {
      g.fillText(l, x, y); y += 32;
    });

    var t = new THREE.CanvasTexture(c);
    t.anisotropy = MOBILE ? 2 : 8;
    if ('sRGBEncoding' in THREE) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* every mesh already standing in a room, so props can dodge them */
  function occupancy() {
    var boxes = [];
    scene.traverse(function (o) {
      if (!o.isMesh || o.isSprite || !o.geometry) return;
      var p = o.geometry.parameters;
      if (!p) return;                       // the car and anything else custom
      /* skip the shells: floors, ceilings, walls, skirting, rails */
      if (o.geometry.type === 'PlaneGeometry' && near(p.width, ROOM)) return;
      if (near(p.height, H) || near(p.height, 0.18) || near(p.height, 0.07)) return;
      if (o.userData.__decor) return;
      var b = new THREE.Box3().setFromObject(o);
      if (isFinite(b.min.x)) boxes.push(b);
    });
    return boxes;
  }

  function clear(box, boxes) {
    for (var i = 0; i < boxes.length; i++) if (box.intersectsBox(boxes[i])) return false;
    return true;
  }

  var SIDES = [
    { nx:  0, nz: -1 },   // back wall (−Z)
    { nx:  0, nz:  1 },
    { nx: -1, nz:  0 },
    { nx:  1, nz:  0 }
  ];

  function plaques(boxes) {
    var panels = [].slice.call(document.querySelectorAll('.panel'));
    if (!panels.length) return;

    var PW = 5.0, PH = 2.5, MID = 3.5;

    CENTRES.forEach(function (c, i) {
      var el = panels[i] && panels[i].querySelector('.inner');
      if (!el) return;
      var kicker = (el.querySelector('.room-kicker') || {}).textContent || '';
      var title  = (el.querySelector('h2') || {}).textContent || '';
      var body   = (el.querySelector('p.body') || {}).textContent || '';
      if (!title) return;

      /* try each wall, sliding along it, and take the first clear spot */
      var spot = null;
      for (var s = 0; s < SIDES.length && !spot; s++) {
        var d = SIDES[s];
        for (var k = 0; k < 3 && !spot; k++) {
          var slide = [0, 5.0, -5.0][k];
          var px = c.x + d.nx * (ROOM / 2 - 0.35) + (d.nx ? 0 : slide);
          var pz = c.z + d.nz * (ROOM / 2 - 0.35) + (d.nz ? 0 : slide);
          var box = new THREE.Box3(
            new THREE.Vector3(px - (d.nx ? 0.5 : PW / 2), MID - PH / 2, pz - (d.nz ? 0.5 : PW / 2)),
            new THREE.Vector3(px + (d.nx ? 0.5 : PW / 2), MID + PH / 2, pz + (d.nz ? 0.5 : PW / 2))
          );
          if (clear(box, boxes)) spot = { x: px, z: pz, d: d };
        }
      }
      if (!spot) return;

      var grp = new THREE.Group();
      grp.userData.__decor = true;
      grp.position.set(spot.x, MID, spot.z);
      grp.rotation.y = Math.atan2(-spot.d.nx, -spot.d.nz);

      var frame = new THREE.Mesh(
        new THREE.BoxGeometry(PW + 0.22, PH + 0.22, 0.16),
        toonMat({ map: walnut() })
      );
      grp.add(frame);

      var face = new THREE.Mesh(
        new THREE.PlaneGeometry(PW, PH),
        new THREE.MeshBasicMaterial({ map: plaqueTexture(kicker, title, body) })
      );
      face.position.z = 0.09;
      grp.add(face);

      scene.add(grp);
      boxes.push(new THREE.Box3().setFromObject(grp));
    });
  }

  /* ══════════════ a plant in the corners that are free ══════════════ */

  function plant() {
    var g = new THREE.Group();
    g.userData.__decor = true;

    var pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.26, 0.5, 8),
      toonMat({ map: terracotta() })
    );
    pot.position.y = 0.25;
    g.add(pot);

    var soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8),
      toonMat({ color: 0x3b2f22 })
    );
    soil.position.y = 0.5;
    g.add(soil);

    var leafMat = toonMat({ color: 0x6f8a63 });
    var leafDark = toonMat({ color: 0x55704b });
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2;
      var h = 0.7 + (i % 3) * 0.28;
      var blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, h, 0.13), i % 2 ? leafMat : leafDark);
      blade.position.set(Math.cos(a) * 0.16, 0.5 + h / 2, Math.sin(a) * 0.16);
      blade.rotation.z = Math.cos(a) * 0.26;
      blade.rotation.x = -Math.sin(a) * 0.26;
      g.add(blade);
    }
    return g;
  }

  function plants(boxes) {
    var inset = 1.9, made;
    CENTRES.forEach(function (c) {
      made = 0;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (q) {
        if (made >= 2) return;
        var x = c.x + q[0] * (ROOM / 2 - inset);
        var z = c.z + q[1] * (ROOM / 2 - inset);
        var box = new THREE.Box3(
          new THREE.Vector3(x - 0.6, 0, z - 0.6),
          new THREE.Vector3(x + 0.6, 1.7, z + 0.6)
        );
        if (!clear(box, boxes)) return;
        var g = plant();
        g.position.set(x, 0, z);
        g.rotation.y = (x + z) * 0.37;
        scene.add(g);
        boxes.push(box);
        made++;
      });
    });
  }

  /* ══════════════ go ══════════════ */

  function dress() {
    try {
      var walls = reskin();
      crown(walls);
      var boxes = occupancy();
      plaques(boxes);
      plants(boxes);
    } catch (e) {
      /* a half-dressed room is still a room — never take the gallery down */
      if (window.console) console.warn('decor skipped:', e);
    }
  }
})();
