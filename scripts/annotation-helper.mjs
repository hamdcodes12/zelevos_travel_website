// Helper to inject elegant, non-destructive annotations onto a live web page before screenshotting
export async function injectAnnotations(page, annotations) {
  await page.evaluate((items) => {
    // Remove existing if any
    const old = document.getElementById('zelevos-annotation-layer');
    if (old) old.remove();

    const layer = document.createElement('div');
    layer.id = 'zelevos-annotation-layer';
    layer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;font-family:Inter,system-ui,sans-serif;';

    items.forEach((item, index) => {
      let rect = null;
      if (item.selector) {
        const el = document.querySelector(item.selector);
        if (el) {
          rect = el.getBoundingClientRect();
        }
      }
      
      const x = rect ? rect.left + (item.offsetX || 0) : (item.x || 100);
      const y = rect ? rect.top + (item.offsetY || 0) : (item.y || 100);
      const w = rect ? rect.width : (item.w || 200);
      const h = rect ? rect.height : (item.h || 40);

      // Highlight Box
      if (item.box !== false) {
        const box = document.createElement('div');
        box.style.cssText = `position:absolute;left:${x - 4}px;top:${y - 4}px;width:${w + 8}px;height:${h + 8}px;border:3px solid #ef4444;border-radius:8px;background:rgba(239,68,68,0.08);box-shadow:0 0 15px rgba(239,68,68,0.5);pointer-events:none;animation:pulse 2s infinite;`;
        layer.appendChild(box);
      }

      // Badge & Label
      const label = document.createElement('div');
      const num = item.num || (index + 1);
      const title = item.title || `STEP ${num}`;
      const desc = item.desc || '';
      
      // Determine position (above or below)
      const topPos = y > 80 ? Math.max(10, y - 56) : y + h + 10;

      label.style.cssText = `position:absolute;left:${Math.max(10, x)}px;top:${topPos}px;background:linear-gradient(135deg, #1e293b, #0f172a);color:#fff;padding:6px 12px;border-radius:8px;border:1px solid #ef4444;box-shadow:0 10px 25px rgba(0,0,0,0.6);display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;max-width:340px;pointer-events:none;`;
      
      label.innerHTML = `
        <span style="background:#ef4444;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;">${num}</span>
        <div style="display:flex;flex-direction:column;line-height:1.2;">
          <span style="color:#fca5a5;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${title}</span>
          <span style="color:#f8fafc;font-size:12px;font-weight:600;">${desc}</span>
        </div>
      `;
      layer.appendChild(label);
    });

    document.body.appendChild(layer);
  }, annotations);
}

export async function removeAnnotations(page) {
  await page.evaluate(() => {
    const layer = document.getElementById('zelevos-annotation-layer');
    if (layer) layer.remove();
  });
}
