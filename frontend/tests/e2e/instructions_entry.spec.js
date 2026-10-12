// The instructions page as an entry point, not a reading assignment.
//
// Measured at a phone viewport (390x664) before this change: the page was
// 4779 px (7.2 screens) and the Start button sat at px 4623 - the last element
// of the document, since the nav is `position: static`. The generic
// walk-through ("Visual Illustrations", 4 animated GIFs + helpful tools) was
// 5 of those screens; the study's own text - which is the study's protocol, not
// ours - sits above it, so nothing about the study's content could be trimmed
// to fix this.
//
// So the walk-through is a closed <details> and the nav is pinned on phones:
// the page is 1524 px (2.3 screens) and Start is at px 605, inside the first
// screen. These specs pin down "short entry", "nothing was removed" and the
// phone nav staying in reach while the walk-through is open.
const { test, expect } = require('@playwright/test');
const { MOBILE_VIEWPORT } = require('./participant_pages.js');
const { enterConsentAndInstructionsIfNeeded } = require('./e2e_helpers.js');

test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true });

const HOW_TO = '#howToSection';
const FIRST_STEP = '#instruction-step-copy-day';

async function openInstructions(page, lang = 'en') {
  await page.goto(
    `index.html?pid=instr-entry-${Date.now()}-${lang}&study_name=default&lang=${lang}`,
    { waitUntil: 'load' }
  );
  await enterConsentAndInstructionsIfNeeded(page);
  await expect(page.locator(HOW_TO)).toBeAttached();
  await expect(page.locator('#continueBtn')).toBeVisible();
  await page.waitForTimeout(400);
}

/** Is the control inside the visible viewport right now? */
async function isInViewport(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
}

test('a phone reaches Start without scrolling through the walk-through', async ({
  page,
}) => {
  await openInstructions(page, 'de');

  // The walk-through starts closed, but is still there: the summary line is the
  // affordance and the study's own text stays where it was.
  expect(await page.locator(HOW_TO).evaluate((el) => el.open)).toBe(false);
  await expect(page.locator('.how-to-summary')).toBeVisible();
  await expect(page.locator('#study-custom-message-instructions')).toBeVisible();
  await expect(page.locator(FIRST_STEP)).toBeHidden();

  // ...and the entry is short enough that Start is on the first screen, without
  // a single scroll.
  expect(await isInViewport(page, '#continueBtn')).toBe(true);

  // Opening it brings the steps (and their GIFs) back in full.
  await page.locator('.how-to-summary').click();
  expect(await page.locator(HOW_TO).evaluate((el) => el.open)).toBe(true);
  await expect(page.locator(FIRST_STEP)).toBeVisible();

  // With the walk-through open the page is long again - the pinned nav is what
  // keeps Start reachable instead of 4000 px away, which is the reason it is
  // fixed on phones.
  await page.evaluate(() =>
    window.scrollTo(0, document.scrollingElement.scrollHeight / 2)
  );
  await page.waitForTimeout(300);
  expect(await isInViewport(page, '#continueBtn')).toBe(true);
});

test('the walk-through is optional, not gone', async ({ page }) => {
  await openInstructions(page, 'en');
  await page.locator('.how-to-summary').click();

  // The old page content, unchanged: every step and the helpful tools.
  for (const stepTitle of [
    'Select and Place an Activity',
    'Adjust Activity Duration',
    'Copy a Day',
    'Saving and Submitting Your Diary',
  ]) {
    await expect(page.getByRole('heading', { name: stepTitle })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Helpful tools' })).toBeVisible();

  // And it can be closed again, which is what keeps "short" true.
  await page.locator('.how-to-summary').click();
  expect(await page.locator(HOW_TO).evaluate((el) => el.open)).toBe(false);
  await expect(page.locator(FIRST_STEP)).toBeHidden();
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1600, height: 900 }, hasTouch: false });

  test('the entry is short there too, without a pinned bar', async ({ page }) => {
    await openInstructions(page, 'en');

    expect(await page.locator(HOW_TO).evaluate((el) => el.open)).toBe(false);
    await expect(page.locator('#study-custom-message-instructions')).toBeVisible();

    // No fixed bar on desktop: the collapsed page is around one screen, so
    // Start is reached by scrolling, not by pinning a bar across the layout.
    const navPosition = await page
      .locator('.navigation')
      .evaluate((el) => getComputedStyle(el).position);
    expect(navPosition).not.toBe('fixed');

    const screens = await page.evaluate(
      () => document.scrollingElement.scrollHeight / window.innerHeight
    );
    expect(screens, `collapsed desktop page is ${screens} screens`).toBeLessThan(2);
  });

  // A window taller than the page used to stretch the body grid's auto rows, and
  // the Start button with them: at 1600x1300 the row grew to 196 px and the
  // button became a 140x131 square (default align-items: stretch on the nav).
  test.describe('on a tall window', () => {
    test.use({ viewport: { width: 1600, height: 1300 } });

    test('the Start button keeps its shape instead of filling the row', async ({
      page,
    }) => {
      await openInstructions(page, 'en');

      // The study's text is still the page's content here, too.
      await expect(page.locator('#study-custom-message-instructions')).toBeVisible();

      const button = await page.locator('#continueBtn').boundingBox();
      expect(
        button.width,
        `button is ${button.width}x${button.height}`
      ).toBeGreaterThan(button.height);
      expect(button.height).toBeLessThan(80);

      const nav = await page.locator('.navigation').boundingBox();
      expect(nav.height, `Start row is ${nav.height} px tall`).toBeLessThan(140);
    });
  });
});
