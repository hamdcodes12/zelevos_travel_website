import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const base64Img = fs.readFileSync(path.resolve('artifacts/zelevos/public/zelevos-security-icons-strip.png')).toString('base64');

  await page.setContent(`
    <!DOCTYPE html><html><body>
      <img id="src" src="data:image/png;base64,${base64Img}" />
      <canvas id="c"></canvas>
    </body></html>
  `);
  await page.waitForSelector('#src');

  const coords = await page.evaluate(() => {
    const img = document.getElementById('src');
    const canvas = document.getElementById('c');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    function isBadgePixel(x, y) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
      return maxDiff > 25;
    }

    const regions = [
      { name: 'security-access-shield.png', minX: 0, maxX: 341 },
      { name: 'security-protected-data.png', minX: 341, maxX: 682 },
      { name: 'security-role-based.png', minX: 682, maxX: 1024 },
    ];

    const out = {};
    for (const reg of regions) {
      let minPx = 10000,
        maxPx = -1,
        minPy = 10000,
        maxPy = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = reg.minX; x < reg.maxX; x++) {
          if (isBadgePixel(x, y)) {
            if (x < minPx) minPx = x;
            if (x > maxPx) maxPx = x;
            if (y < minPy) minPy = y;
            if (y > maxPy) maxPy = y;
          }
        }
      }
      const cx = (minPx + maxPx) / 2;
      const cy = (minPy + maxPy) / 2;
      const r = Math.max((maxPx - minPx) / 2, (maxPy - minPy) / 2);

      const cropCanvas = document.createElement('canvas');
      const size = Math.ceil(r * 2);
      cropCanvas.width = size;
      cropCanvas.height = size;
      const cropCtx = cropCanvas.getContext('2d');

      cropCtx.save();
      cropCtx.beginPath();
      cropCtx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      cropCtx.closePath();
      cropCtx.clip();

      cropCtx.drawImage(img, cx - r, cy - r, r * 2, r * 2, 0, 0, size, size);
      cropCtx.restore();

      out[reg.name] = {
        cx,
        cy,
        r,
        dataUrl: cropCanvas.toDataURL('image/png'),
      };
    }
    return out;
  });

  console.log('Coordinates:', {
    icon1: { cx: coords['security-access-shield.png'].cx, cy: coords['security-access-shield.png'].cy, r: coords['security-access-shield.png'].r },
    icon2: { cx: coords['security-protected-data.png'].cx, cy: coords['security-protected-data.png'].cy, r: coords['security-protected-data.png'].r },
    icon3: { cx: coords['security-role-based.png'].cx, cy: coords['security-role-based.png'].cy, r: coords['security-role-based.png'].r },
  });

  for (const [filename, info] of Object.entries(coords)) {
    const base64Data = info.dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.resolve('artifacts/zelevos/public', filename), Buffer.from(base64Data, 'base64'));
    console.log('Saved pixel-perfect transparent icon:', filename);
  }

  await browser.close();
}

main().catch(console.error);
