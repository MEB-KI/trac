// Temporary probe #7 (not a spec): are the mobile resize bands actually displayed?
const { chromium } = require('@playwright/test');
const { MOBILE_VIEWPORT } = require('./participant_pages.js');
const { enterStudyIfNeeded, placeActivityMobile } = require('./e2e_helpers.js');

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:3000/report/';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}index.html?pid=probe7-${Date.now()}&study_name=default&lang=en`, {
    waitUntil: 'load',
  });
  await enterStudyIfNeeded(page);
  await page.waitForSelector('#contextBar', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(2500);
  const bannerClose = page.locator('#instructionBanner .banner-close');
  if (await bannerClose.isVisible().catch(() => false)) {
    await bannerClose.click().catch(() => undefined);
    await page.waitForTimeout(800);
  }
  await placeActivityMobile(page);

  const data = await page.evaluate(() => {
    const block = document.querySelector('.activity-block');
    const rect = block.getBoundingClientRect();
    const zones = [...block.querySelectorAll('.activity-block-edge-zone')].map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        cls: String(el.className),
        display: cs.display,
        touchAction: cs.touchAction,
        height: Math.round(r.height * 10) / 10,
      };
    });
    const probeY = Math.round(rect.bottom - 4);
    const hit = document.elementFromPoint(Math.round(rect.left + rect.width / 2), probeY);
    return {
      blockHeight: Math.round(rect.height * 10) / 10,
      blockTouchAction: getComputedStyle(block).touchAction,
      zones,
      pointFourAboveBottom: {
        hit: hit ? String(hit.className || hit.tagName) : null,
        hitTouchAction: hit ? getComputedStyle(hit).touchAction : null,
      },
    };
  });
  console.log(JSON.stringify(data, null, 1));
  await browser.close();
})();
