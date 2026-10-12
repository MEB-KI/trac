// Timeline visibility on a phone: what the second timeline is, and whether the
// participant has touched it.
//
// Two things are pinned down here.
//
// 1. "Requirement met" was reported for a timeline with min_coverage 0 even when
//    it was completely empty - and min_coverage 0 is satisfied by nothing at
//    all. The green ✓ next to a timeline nobody had touched read as "this one is
//    done, skip it", the opposite of what an optional track needs. An empty
//    timeline with no requirement now reports itself as empty, and a requirement
//    that is met is the only thing that earns the ✓.
//
// 2. Below the breakpoint only the active timeline is laid out - every other
//    container measures 0×0 - so nothing on the page mentioned the other
//    timeline, and a participant who never opened the context bar's timeline
//    picker never learned it existed. An untouched other timeline is now
//    advertised as a tappable row inside the active timeline's label block.
const { test, expect } = require('@playwright/test');
const { MOBILE_VIEWPORT } = require('./participant_pages.js');
const { enterStudyIfNeeded, placeActivityMobile } = require('./e2e_helpers.js');

test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true });

// Only one timeline is laid out at this width, so `:visible` is how the active
// timeline is found - that is the behaviour under test, not an implementation
// detail.
const VISIBLE_INDICATOR = '.timeline-coverage-indicator:visible';
const HINT_ROW = '.empty-timeline-hint-row';

async function openDiary(page, pid) {
  await page.goto(`index.html?pid=${pid}&study_name=default&lang=en`, {
    waitUntil: 'load',
  });
  await enterStudyIfNeeded(page);
  await expect
    .poll(
      async () => page.evaluate(() => !!window.timelineManager?.activeTimeline),
      { timeout: 30000, message: 'waiting for the timeline to initialize' }
    )
    .toBe(true);

  // The day-one banner inserts itself above the timeline and is moved again
  // while the page settles, which shifts every coordinate measured in the
  // meantime. Close it first - a real participant does the same.
  const bannerClose = page.locator('#instructionBanner .banner-close');
  if (await bannerClose.isVisible().catch(() => false)) {
    await bannerClose.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

/** Switch timelines through the context bar - the path a phone offers. */
async function switchTimeline(page, index) {
  await page.locator('#timelinePickerBtn').click();
  const menu = page.locator('#timelineMenu');
  await expect(menu).toBeVisible();
  await menu.locator('.timeline-menu-item').nth(index).click();
  await page.waitForTimeout(600);
}

test('an empty timeline without a requirement is not reported as met', async ({
  page,
}) => {
  await openDiary(page, `e2e-timeline-empty-${Date.now()}`);

  // The primary timeline requires 10 minutes and is empty: the red shortfall,
  // unchanged.
  const indicator = page.locator(VISIBLE_INDICATOR);
  await expect(indicator).toHaveText('0 of 10 required minutes covered');
  await expect(indicator).toHaveClass(/is-missing/);

  // The secondary has min_coverage 0 and is empty. "Met" is true there and says
  // nothing, so it must not be claimed.
  await switchTimeline(page, 1);
  await expect(page.locator('#contextTimelineName')).toHaveText(
    'Secondary Activity'
  );
  await expect(indicator).toHaveText('nothing entered yet');
  await expect(indicator).toHaveClass(/is-empty/);
  await expect(indicator).not.toHaveClass(/is-met/);

  // With an entry the ✓ is back: here nothing is required and something is
  // there, which is what the ✓ now means.
  await placeActivityMobile(page, 40);
  await expect(indicator).toHaveText('✓');
  await expect(indicator).toHaveClass(/is-met/);
});

test('the phone advertises an untouched other timeline inside the day', async ({
  page,
}) => {
  await openDiary(page, `e2e-timeline-hint-${Date.now()}`);

  // Standing on the primary, the untouched secondary is named where the
  // participant starts the day.
  const row = page.locator(HINT_ROW);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Secondary Activity');
  await expect(row).toContainText('nothing entered yet');

  // Tapping it switches timelines - with real touch input, since that is what a
  // phone sends.
  await row.tap();
  await expect(page.locator('#contextTimelineName')).toHaveText(
    'Secondary Activity'
  );

  // The row now advertises the timeline left behind, which is still empty.
  await expect(page.locator(HINT_ROW)).toHaveCount(1);
  await expect(page.locator(HINT_ROW)).toContainText('Main Activity');

  // Filling the advertised timeline removes its row: a timeline with entries
  // needs no introduction.
  await placeActivityMobile(page, 40);
  await switchTimeline(page, 0);
  await expect(page.locator('#contextTimelineName')).toHaveText('Main Activity');
  await expect(page.locator(HINT_ROW)).toHaveCount(0);
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1600, height: 900 }, hasTouch: false });

  test('both timelines are on screen, so nothing is advertised', async ({
    page,
  }) => {
    await openDiary(page, `e2e-timeline-hint-desktop-${Date.now()}`);

    await expect(page.locator(HINT_ROW)).toHaveCount(0);

    // Both timelines report their own state, and the optional empty one reads
    // as empty here too instead of claiming a met requirement.
    const indicators = page.locator('.timeline-coverage-indicator');
    await expect(indicators).toHaveCount(2);
    await expect(indicators.nth(0)).toHaveText(
      '0 of 10 required minutes covered'
    );
    await expect(indicators.nth(1)).toHaveText('nothing entered yet');
    await expect(indicators.nth(1)).not.toHaveClass(/is-met/);
  });
});
