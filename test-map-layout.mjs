import { chromium } from 'playwright';

(async () => {
  const url = 'http://localhost:8081/fleetops/map/live';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    console.log('[PLAYWRIGHT] page loaded');
    
    // Wait for the map container
    await page.waitForTimeout(2000);
    
    // Extract map container info
    const mapInfo = await page.evaluate(() => {
      const maps = Array.from(document.querySelectorAll('.leaflet-container, .maplibregl-map, [class*="h-[600px]"]'));
      return maps.map(el => {
        const style = window.getComputedStyle(el);
        return {
          className: el.className,
          width: style.width,
          height: style.height,
          display: style.display,
          position: style.position,
          visibility: style.visibility
        };
      });
    });
    
    console.log('[MAP INFO]', JSON.stringify(mapInfo, null, 2));

  } catch (e) {
    console.log('[ERROR]:', e.message);
  }
  
  await browser.close();
  process.exit(0);
})();
