/* Renders each poster's loop to media/loops/0N.webm and 0N.mp4.
   Usage, from the repo root:  node art/src/loops.js [0,3,5]
   Needs Playwright (npm i playwright) and ffmpeg with libvpx-vp9 and
   libx264 on the PATH. 96 frames at 24 fps — a four-second loop that
   closes on itself, because every motion in poster.html is periodic. */
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const only = (process.argv[2] || '0,1,2,3,4,5,6,7').split(',').map(Number);
const F = 96, OUT = path.join(__dirname, '..', '..', 'media', 'loops');
(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1600, height:900 } });
  for (const i of only){
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop' + i + '-'));
    await p.goto('file://' + path.join(__dirname, 'poster.html') + '?i=' + i);
    await p.waitForFunction(() => document.title === 'ready', null, { timeout:20000 });
    const el = p.locator('svg');
    for (let f = 0; f < F; f++){
      await p.evaluate(t => window.frame(t), f / F);
      await el.screenshot({ path:path.join(dir, String(f).padStart(3, '0') + '.png') });
    }
    const src = ['-y', '-loglevel', 'error', '-framerate', '24', '-i', path.join(dir, '%03d.png'),
                 '-vf', 'scale=1280:720:flags=lanczos,format=yuv420p', '-an'];
    const base = path.join(OUT, '0' + i);
    execFileSync('ffmpeg', [...src, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', base + '.webm']);
    execFileSync('ffmpeg', [...src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-tune', 'animation', '-movflags', '+faststart', base + '.mp4']);
    fs.rmSync(dir, { recursive:true, force:true });
    console.log('wrote', base + '.webm / .mp4');
  }
  await b.close();
})();
