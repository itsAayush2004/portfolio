/* isometric voxel + prism renderer that emits SVG strings */
(function(G){
const C30 = Math.cos(Math.PI/6), S30 = .5;
function hex2rgb(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function rgb2hex(r){ return '#'+r.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function shade(h,k){ const c=hex2rgb(h); return k>=1 ? rgb2hex(c.map(v=>v+(255-v)*(k-1))) : rgb2hex(c.map(v=>v*k)); }
G.shade = shade;

function Scene(s, ox, oy){ this.s=s; this.ox=ox; this.oy=oy; this.v=new Map(); this.extra=[]; this.ink='#17161C'; this.lw=2.2; }
Scene.prototype.P = function(x,y,z){ const s=this.s; return [this.ox + (x-y)*C30*s, this.oy + (x+y)*S30*s - z*s]; };
Scene.prototype.set = function(x,y,z,c,o){ this.v.set(x+','+y+','+z, {c:c, glow:o&&o.glow}); return this; };
Scene.prototype.get = function(x,y,z){ return this.v.get(x+','+y+','+z); };
Scene.prototype.has = function(x,y,z){ return this.v.has(x+','+y+','+z); };
Scene.prototype.box = function(x0,x1,y0,y1,z0,z1,c,o){
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++) this.set(x,y,z,c,o); return this; };
Scene.prototype.del = function(x0,x1,y0,y1,z0,z1){
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++) this.v.delete(x+','+y+','+z); return this; };
/* free-standing items drawn into the same depth order: {d:depth, svg:string} */
Scene.prototype.add = function(d, svg){ this.extra.push({d:d, svg:svg}); return this; };

Scene.prototype.render = function(){
  const items = [], self=this;
  const pt = (a)=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  this.v.forEach(function(val, key){
    const q=key.split(',').map(Number), x=q[0], y=q[1], z=q[2], c=val.c;
    const same = (a,b,cc)=>{ const n=self.get(a,b,cc); return n && n.c===c; };
    let out='';
    const T=shade(c,1.12), L=shade(c,.9), R=shade(c,.74);
    const top = !self.has(x,y,z+1), left = !self.has(x,y+1,z), right = !self.has(x+1,y,z);
    const A=self.P(x,y,z+1), B=self.P(x+1,y,z+1), Cc=self.P(x+1,y+1,z+1), D=self.P(x,y+1,z+1);
    const E=self.P(x+1,y,z), F=self.P(x+1,y+1,z), Hh=self.P(x,y+1,z);
    const lines=[];
    if (top){
      out += `<polygon points="${pt([A,B,Cc,D])}" fill="${val.glow?c:T}" stroke="${val.glow?c:T}" stroke-width=".8"/>`;
      // edges of top face: A-B (y-), B-C (x+), C-D (y+), D-A (x-)
      const vis=(a,b,cc)=>{ const n=self.get(a,b,cc); return n && n.c===c && !self.has(a,b,cc+1); };
      if(!vis(x,y-1,z)) lines.push([A,B]);
      if(!vis(x+1,y,z)) lines.push([B,Cc]);
      if(!vis(x,y+1,z)) lines.push([Cc,D]);
      if(!vis(x-1,y,z)) lines.push([D,A]);
    }
    if (left){ // +y face: D, C, F, H
      out += `<polygon points="${pt([D,Cc,F,Hh])}" fill="${val.glow?shade(c,.95):L}" stroke="${val.glow?shade(c,.95):L}" stroke-width=".8"/>`;
      const vis=(a,b,cc)=>{ const n=self.get(a,b,cc); return n && n.c===c && !self.has(a,b+1,cc); };
      if(!vis(x,y,z+1)) lines.push([D,Cc]);
      if(!vis(x,y,z-1)) lines.push([Hh,F]);
      if(!vis(x-1,y,z)) lines.push([D,Hh]);
      if(!vis(x+1,y,z)) lines.push([Cc,F]);
    }
    if (right){ // +x face: B, C, F, E
      out += `<polygon points="${pt([B,Cc,F,E])}" fill="${val.glow?shade(c,.85):R}" stroke="${val.glow?shade(c,.85):R}" stroke-width=".8"/>`;
      const vis=(a,b,cc)=>{ const n=self.get(a,b,cc); return n && n.c===c && !self.has(a+1,b,cc); };
      if(!vis(x,y,z+1)) lines.push([B,Cc]);
      if(!vis(x,y,z-1)) lines.push([E,F]);
      if(!vis(x,y-1,z)) lines.push([B,E]);
      if(!vis(x,y+1,z)) lines.push([Cc,F]);
    }
    if (!out) return;
    if (lines.length){
      out += `<path d="${lines.map(l=>'M'+l[0][0].toFixed(1)+' '+l[0][1].toFixed(1)+'L'+l[1][0].toFixed(1)+' '+l[1][1].toFixed(1)).join('')}" stroke="${self.ink}" stroke-width="${self.lw}" stroke-linecap="round" fill="none"/>`;
    }
    items.push({ d: x+y+z + (x+y)*0.0001, svg: out });
  });
  this.extra.forEach(e=>items.push(e));
  items.sort((a,b)=>a.d-b.d);
  return items.map(i=>i.svg).join('');
};

/* a hexagonal prism, pointy-top hex in the ground plane, as an extra item */
Scene.prototype.hexPrism = function(cx, cy, r, z0, z1, col, opts){
  opts = opts||{};
  const pts=[]; for(let k=0;k<6;k++){ const a=Math.PI/6 + k*Math.PI/3; pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); }
  const top = pts.map(p=>this.P(p[0],p[1],z1)), bot = pts.map(p=>this.P(p[0],p[1],z0));
  const f = (a)=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  let s='';
  // side faces facing viewer: normals with positive (x+y) component
  for(let k=0;k<6;k++){
    const k2=(k+1)%6, mx=(pts[k][0]+pts[k2][0])/2-cx, my=(pts[k][1]+pts[k2][1])/2-cy;
    if (mx+my <= 0.01) continue;
    const lit = mx>my ? .74 : .9;
    const sc = opts.side || col;
    s += `<polygon points="${f([top[k],top[k2],bot[k2],bot[k]])}" fill="${shade(sc,lit)}" stroke="${this.ink}" stroke-width="${this.lw}" stroke-linejoin="round"/>`;
  }
  s += `<polygon points="${f(top)}" fill="${shade(col,1.08)}" stroke="${this.ink}" stroke-width="${this.lw}" stroke-linejoin="round"/>`;
  this.add(cx+cy+z0+ (opts.dz||0), s);
  return this;
};
G.IsoScene = Scene;
G.isoP = function(s,ox,oy,x,y,z){ return [ox+(x-y)*C30*s, oy+(x+y)*S30*s - z*s]; };
})(window);
