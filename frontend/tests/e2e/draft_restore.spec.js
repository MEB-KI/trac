const { test, expect } = require('@playwright/test');
const { enterStudyIfNeeded, placeActivity } = require('./e2e_helpers.js');

test.use({ viewport: { width: 1600, height: 900 } });

const DRAFT_KEY = 'trac.timelineDraftState.v1';

/** Number of activities on the timeline that is currently shown. */
async function currentTimelineActivityCount(page) {
  return page.evaluate(() => {
    const manager = window.timelineManager;
    if (!manager || !manager.keys) {
      return -1;
    }
    const key = manager.keys[manager.currentIndex];
    return (manager.activities?.[key] || []).length;
  });
}

/** Wait until the diary wrote its draft (the write is debounced). */
async function waitForStoredDraft(page) {
  await expect
    .poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), DRAFT_KEY), {
      timeout: 5000,
      message: 'waiting for the draft to be persisted',
    })
    .toBe(true);
}

// The diary keeps unsaved work in the browser and restores it after a reload
// (accidental refresh, phone call, browser crash). A broken restore silently
// loses a participant's work, and nothing else in the suite would notice.
//
// The same-source rule (a draft belongs to one participant/study/day and must
// never be restored for another) is covered by the unit tests of
// js/draft_storage.js: in the browser, switching participant always goes through
// the consent/instructions pages, which drop the pending state before the diary
// loads - so an end-to-end test of that rule would pass for the wrong reason.
test.describe('Unsaved diary work (draft restore)', () => {
  test('unsaved activities survive a page reload', async ({ page }) => {
    await page.goto('index.html?study_name=default&lang=en', {
      waitUntil: 'domcontentloaded',
    });
    await enterStudyIfNeeded(page);

    await placeActivity(page, { activityName: 'Sleeping', positionPercent: 20 });
    await expect
      .poll(() => currentTimelineActivityCount(page), { timeout: 5000 })
      .toBeGreaterThan(0);

    await waitForStoredDraft(page);

    // Nothing was saved to the backend - only the browser knows about it.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterStudyIfNeeded(page);

    await expect
      .poll(() => currentTimelineActivityCount(page), {
        timeout: 15000,
        message: 'the unsaved activity should be restored after a reload',
      })
      .toBeGreaterThan(0);
  });
});
