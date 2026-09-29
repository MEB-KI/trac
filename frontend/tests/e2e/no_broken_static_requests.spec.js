const { test, expect } = require('@playwright/test');
const { PARTICIPANT_PAGES } = require('./participant_pages.js');

// Fails when a page cannot load a static file it asks for.
//
// Nothing else in the suite looks at the network: a renamed GIF, a deleted
// locale file, a mistyped settings path or a font that was never committed all
// "pass" every other test and only show up as a broken page for participants.
//
// Only static requests (by file extension) are tracked, so failing API calls -
// which several specs provoke on purpose - are not flagged here.
const STATIC_REQUEST = /\.(gif|png|jpe?g|svg|ico|webp|css|js|json|woff2?|ttf)$/i;

/**
 * Record static requests that did not return a success response.
 * @param {import('@playwright/test').Page} page
 * @returns {string[]}
 */
function trackBrokenStaticRequests(page) {
  const broken = [];

  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (!STATIC_REQUEST.test(path)) return;
    if (response.status() >= 400) {
      broken.push(`${response.status()} ${path}`);
    }
  });

  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname;
    if (!STATIC_REQUEST.test(path)) return;
    const failure = request.failure();
    broken.push(`FAILED ${path} (${failure ? failure.errorText : 'unknown'})`);
  });

  return broken;
}

const PAGES = PARTICIPANT_PAGES;

for (const target of PAGES) {
  test(`no broken static requests on ${target.name}`, async ({ page }) => {
    const broken = trackBrokenStaticRequests(page);

    await page.goto(target.url, { waitUntil: 'load' });

    // Give late (lazy-loaded) requests a moment to settle: the instructions
    // page loads its GIFs when they scroll into view, and the pages fetch their
    // locale file after the study config.
    await page.waitForLoadState('networkidle');

    expect(broken, `failed static requests: ${broken.join(', ')}`).toEqual([]);
  });
}
