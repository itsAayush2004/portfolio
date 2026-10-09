/* Renders art/src/poster.html?i=0…7 to art/00.jpg … art/07.jpg.
   Usage, from the repo root:  node art/src/render.js [0,3,5]
   Needs Playwright (npm i playwright) and, for the JPEG step, sharp
   (npm i sharp) — without sharp it writes PNGs next to the JPEGs' names. */
const path = require('path');
const { chromium } = require('playwright');
const only = (process.argv[2] || '0,1,2,3,4,5,6,7').split(',').map(Number);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1600, height:900 } });
  let sharp = null; try { sharp = require('sharp'); } catch (e) {}
  for (const i of only){
    await p.goto('file://' + path.join(__dirname, 'poster.html') + '?i=' + i);
    await p.waitForFunction(() => document.title === 'ready', null, { timeout:20000 });
    const png = await p.locator('svg').screenshot();
    const out = path.join(__dirname, '..', '0' + i + (sharp ? '.jpg' : '.png'));
    if (sharp) await sharp(png).jpeg({ quality:88, progressive:true }).toFile(out);
    else require('fs').writeFileSync(out, png);
    console.log('wrote', out);
  }
  await b.close();
})();
