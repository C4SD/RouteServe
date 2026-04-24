import { chromium } from 'playwright';

(async () => {
  const url = 'http://localhost:8081/fleetops/map/operational';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('[PAGE ERROR]:', err.message);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    console.log('[PLAYWRIGHT] page loaded');
  } catch (e) {
    console.log('[GOTO ERROR]:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
  process.exit(0);
})();
